#!/usr/bin/env node
/**
 * Builds the site icon set from one vector mark.
 *
 *   node scripts/build-icons.mjs
 *
 * Outputs (all in public/):
 *   favicon.svg            crisp rounded mark for modern browsers
 *   favicon.ico            16/32/48 PNG-in-ICO for older browsers and OSes
 *   favicon-32.png         fallback PNG
 *   apple-touch-icon.png   180px, full-bleed (iOS applies its own mask)
 *   icon-192.png           manifest "any"
 *   icon-512.png           manifest "any"
 *   icon-maskable-512.png  manifest "maskable", mark inside the safe zone
 *
 * The mark is an isometric cube: white top face, two greens for the sides,
 * on the site's ink background. It stays legible down to 16px, which the
 * older text-based favicon did not.
 */
import { writeFileSync, statSync } from "node:fs";
import sharp from "sharp";

const INK = "#0b0f14";
const TOP = "#e9eff3";
const LEFT = "#2fbd82";
const RIGHT = "#15734f";

/** Cube faces in a 64-unit viewBox, centred on (32, 32). */
const CUBE = `
  <polygon points="32,15 49,24.5 32,34 15,24.5" fill="${TOP}"/>
  <polygon points="15,24.5 32,34 32,53 15,43.5" fill="${LEFT}"/>
  <polygon points="49,24.5 49,43.5 32,53 32,34" fill="${RIGHT}"/>`;

/**
 * @param {object} options
 * @param {boolean} [options.rounded]  rounded background (browser/launcher)
 * @param {number}  [options.scale]    cube scale, 1 = full 64-unit mark
 */
function mark({ rounded = true, scale = 1 } = {}) {
  const background = rounded
    ? `<rect width="64" height="64" rx="12" fill="${INK}"/>`
    : `<rect width="64" height="64" fill="${INK}"/>`;
  const transform =
    scale === 1 ? "" : ` transform="translate(32 32) scale(${scale}) translate(-32 -32)"`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  ${background}<g${transform}>${CUBE}</g>
</svg>
`;
}

const png = async (source, size) =>
  sharp(Buffer.from(source)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** Packs PNGs into an ICO container (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, buffer }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buffer.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.buffer)]);
}

const rounded = mark({ rounded: true });
const bleed = mark({ rounded: false, scale: 0.9 });
const maskable = mark({ rounded: false, scale: 0.78 });

writeFileSync("public/favicon.svg", rounded);
writeFileSync("public/favicon-32.png", await png(rounded, 32));
writeFileSync("public/apple-touch-icon.png", await png(bleed, 180));
writeFileSync("public/icon-192.png", await png(rounded, 192));
writeFileSync("public/icon-512.png", await png(rounded, 512));
writeFileSync("public/icon-maskable-512.png", await png(maskable, 512));

const icoSizes = [16, 32, 48];
const icoImages = [];
for (const size of icoSizes) {
  icoImages.push({ size, buffer: await png(rounded, size) });
}
writeFileSync("public/favicon.ico", ico(icoImages));

for (const file of [
  "favicon.ico",
  "favicon.svg",
  "favicon-32.png",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
]) {
  console.log(`public/${file}: ${(statSync(`public/${file}`).size / 1024).toFixed(1)} KB`);
}
