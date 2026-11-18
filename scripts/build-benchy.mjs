#!/usr/bin/env node
/**
 * Builds public/models/3dbenchy.mesh.gz from the official #3DBenchy STL.
 *
 *   node scripts/build-benchy.mjs [path/to/3DBenchy.stl]
 *
 * Without a path the script downloads the STL from CreativeTools/3DBenchy
 * (public domain, CC0). The mesh is welded, decimated with meshoptimizer,
 * rotated so Y is up, centred, and stored as quantised 16-bit positions:
 *
 *   0  "G3D1"            4 bytes
 *   4  uint32            vertex count
 *   8  uint32            index count
 *   12 float32 x3        bounding box min
 *   24 float32 x3        bounding box max
 *   36 uint16 x 3 x V    positions, normalised across the bounding box
 *   .. uint16 x I        triangle indices
 *
 * The result is gzipped; the site decompresses it in the browser.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { MeshoptSimplifier } from "meshoptimizer";

const SOURCE_URL =
  "https://raw.githubusercontent.com/CreativeTools/3DBenchy/master/Single-part/3DBenchy.stl";
const OUTPUT = "public/models/3dbenchy.mesh.gz";
const TARGET_TRIANGLES = 30000;
const TARGET_ERROR = 0.01;

function parseStl(buffer) {
  const triangles = buffer.readUInt32LE(80);
  const expected = 84 + triangles * 50;
  if (expected !== buffer.length) {
    throw new Error(`Not a binary STL: expected ${expected} bytes, got ${buffer.length}`);
  }
  const positions = new Float32Array(triangles * 9);
  for (let t = 0; t < triangles; t++) {
    const base = 84 + t * 50 + 12;
    for (let i = 0; i < 9; i++) positions[t * 9 + i] = buffer.readFloatLE(base + i * 4);
  }
  return positions;
}

async function getSource() {
  const path = process.argv[2];
  if (path) return readFileSync(path);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

await MeshoptSimplifier.ready;

const source = await getSource();
const raw = parseStl(source);
console.log(`source: ${(source.length / 1024 / 1024).toFixed(1)} MB, ${raw.length / 9} triangles`);

// Weld the STL soup so the simplifier sees a connected surface.
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(raw, 3));
const welded = mergeVertices(geometry, 1e-4);
const positions = welded.getAttribute("position").array;
const indices = Uint32Array.from(welded.getIndex().array);
console.log(`welded: ${positions.length / 3} vertices`);

const [simplified, error] = MeshoptSimplifier.simplify(
  indices,
  positions,
  3,
  TARGET_TRIANGLES * 3,
  TARGET_ERROR
);
console.log(`decimated: ${simplified.length / 3} triangles, error ${error.toFixed(4)}`);

// Drop vertices the simplifier no longer references, and turn the model Y-up.
const remap = new Int32Array(positions.length / 3).fill(-1);
const compact = [];
const outIndices = new Uint16Array(simplified.length);
for (let i = 0; i < simplified.length; i++) {
  const vertex = simplified[i];
  if (remap[vertex] === -1) {
    const x = positions[vertex * 3];
    const y = positions[vertex * 3 + 1];
    const z = positions[vertex * 3 + 2];
    remap[vertex] = compact.length / 3;
    // STL is Z-up; three.js is Y-up.
    compact.push(x, z, -y);
  }
  outIndices[i] = remap[vertex];
}
const vertexCount = compact.length / 3;
if (vertexCount > 65535) throw new Error(`Too many vertices for 16-bit indices: ${vertexCount}`);

const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < vertexCount; i++) {
  for (let axis = 0; axis < 3; axis++) {
    const value = compact[i * 3 + axis];
    if (value < min[axis]) min[axis] = value;
    if (value > max[axis]) max[axis] = value;
  }
}
const centre = [0, 1, 2].map((axis) => (min[axis] + max[axis]) / 2);
for (let i = 0; i < vertexCount; i++) {
  for (let axis = 0; axis < 3; axis++) {
    compact[i * 3 + axis] -= centre[axis];
  }
}
for (let axis = 0; axis < 3; axis++) {
  min[axis] -= centre[axis];
  max[axis] -= centre[axis];
}

const header = Buffer.alloc(36);
header.write("G3D1", 0, "ascii");
header.writeUInt32LE(vertexCount, 4);
header.writeUInt32LE(outIndices.length, 8);
for (let axis = 0; axis < 3; axis++) header.writeFloatLE(min[axis], 12 + axis * 4);
for (let axis = 0; axis < 3; axis++) header.writeFloatLE(max[axis], 24 + axis * 4);

const quantized = Buffer.alloc(vertexCount * 6);
for (let i = 0; i < vertexCount * 3; i++) {
  const axis = i % 3;
  const span = max[axis] - min[axis] || 1;
  const value = Math.round(((compact[i] - min[axis]) / span) * 65535);
  quantized.writeUInt16LE(Math.min(65535, Math.max(0, value)), i * 2);
}
const indexBytes = Buffer.from(outIndices.buffer, outIndices.byteOffset, outIndices.byteLength);

const payload = Buffer.concat([header, quantized, indexBytes]);
const gzipped = gzipSync(payload, { level: 9 });

mkdirSync("public/models", { recursive: true });
writeFileSync(OUTPUT, gzipped);

const size = `${(gzipped.length / 1024).toFixed(0)} KB`;
console.log(
  `${OUTPUT}: ${size} (raw ${(payload.length / 1024).toFixed(0)} KB), ` +
    `${outIndices.length / 3} triangles, ${vertexCount} vertices, ` +
    `size ${(max[0] - min[0]).toFixed(1)} x ${(max[1] - min[1]).toFixed(1)} x ${(max[2] - min[2]).toFixed(1)}`
);
