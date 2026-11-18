/**
 * Interactive 3D preview of the #3DBenchy calibration model.
 *
 * The model is the official single-part STL from CreativeTools/3DBenchy,
 * decimated to 30k triangles by scripts/build-benchy.mjs and stored as a
 * quantised mesh (see that script for the format). It is gzipped in
 * public/models/, decompressed with DecompressionStream and parsed here.
 *
 * Rotate with a drag or the arrow keys; it never zooms, so the page keeps its
 * scroll. Dropping an STL file onto the stage parses it locally in the browser
 * (nothing is uploaded) and previews it in place. Rendering pauses off screen
 * and for reduced motion.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

const MODEL_URL = `${import.meta.env.BASE_URL}models/3dbenchy.mesh.gz`;

/** A visitor's own STL is parsed in memory, so keep a sane ceiling. */
const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;

function parseModel(buffer) {
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== "G3D1") throw new Error("Unexpected model format.");

  const view = new DataView(buffer);
  const vertexCount = view.getUint32(4, true);
  const indexCount = view.getUint32(8, true);
  const min = [view.getFloat32(12, true), view.getFloat32(16, true), view.getFloat32(20, true)];
  const max = [view.getFloat32(24, true), view.getFloat32(28, true), view.getFloat32(32, true)];

  const positions = new Float32Array(vertexCount * 3);
  const quantized = new Uint16Array(buffer, 36, vertexCount * 3);
  for (let i = 0; i < vertexCount * 3; i++) {
    const axis = i % 3;
    positions[i] = min[axis] + (quantized[i] / 65535) * (max[axis] - min[axis]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(buffer, 36 + vertexCount * 6, indexCount), 1));
  geometry.computeVertexNormals();
  return geometry;
}

async function loadGeometry() {
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`Model request failed (${response.status})`);

  const compressed = await response.arrayBuffer();
  const bytes = new Uint8Array(compressed, 0, Math.min(2, compressed.byteLength));
  let data = compressed;

  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("This browser cannot decompress the model.");
    }
    const stream = new Response(compressed).body.pipeThrough(new DecompressionStream("gzip"));
    data = await new Response(stream).arrayBuffer();
  }

  return parseModel(data);
}

export function initStage() {
  const stage = document.querySelector("[data-stage]");
  if (!stage) return;

  const canvas = stage.querySelector("[data-stage-canvas]");
  const status = stage.querySelector("[data-stage-status]");
  const fileBar = stage.querySelector("[data-stage-file]");
  const fileLabel = stage.querySelector("[data-stage-file-name]");
  const fileReset = stage.querySelector("[data-stage-reset]");
  if (!canvas) return;

  const setState = (state, message) => {
    stage.dataset.state = state;
    if (status) status.textContent = message || "";
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (error) {
    console.error("[Grafted3D] WebGL is unavailable:", error);
    setState("error", "3D preview needs WebGL.");
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a795, 1.5));

  const key = new THREE.DirectionalLight(0xfff5e8, 2.3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 5;
  key.shadow.bias = -0.0012;
  scene.add(key);
  scene.add(key.target);

  const fill = new THREE.DirectionalLight(0xffffff, 0.85);
  fill.position.set(-80, 40, -70);
  scene.add(fill);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  canvas.style.touchAction = "pan-y";
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.85;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.5;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.85;

  const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.18, color: 0x4b4237 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Arrow keys orbit the model once the canvas has focus.
  const KEY_ROTATION = {
    ArrowLeft: [1, 0],
    ArrowRight: [-1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const held = new Set();
  const spherical = new THREE.Spherical();
  let ready = false;

  function orbitCamera(azimuth, polar) {
    if (!ready) return;
    const offset = camera.position.clone().sub(controls.target);
    spherical.setFromVector3(offset);
    spherical.theta += azimuth;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + polar,
      controls.minPolarAngle + 0.02,
      controls.maxPolarAngle - 0.02
    );
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
  }

  let raf = 0;
  const timer = new THREE.Timer();
  timer.connect(document);
  const frame = () => {
    raf = requestAnimationFrame(frame);
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.05);
    if (held.size) {
      let azimuth = 0;
      let polar = 0;
      held.forEach((key) => {
        azimuth += KEY_ROTATION[key][0];
        polar += KEY_ROTATION[key][1];
      });
      orbitCamera(azimuth * 1.7 * delta, polar * 1.2 * delta);
    }
    controls.update();
    renderer.render(scene, camera);
  };
  const start = () => {
    if (raf) return;
    frame();
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  new ResizeObserver(resize).observe(stage);
  resize();

  stage.addEventListener("pointerdown", () => {
    stage.classList.add("is-dragging");
    controls.autoRotate = false;
  });
  window.addEventListener("pointerup", () => stage.classList.remove("is-dragging"));
  window.addEventListener("pointercancel", () => stage.classList.remove("is-dragging"));

  canvas.addEventListener("keydown", (event) => {
    if (!KEY_ROTATION[event.key] || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    controls.autoRotate = false;
    held.add(event.key);
  });
  canvas.addEventListener("keyup", (event) => held.delete(event.key));
  canvas.addEventListener("blur", () => held.clear());

  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !document.hidden) start();
        else stop();
      });
    },
    { threshold: 0.01 }
  ).observe(stage);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  /* ------------------------------------------------------------------ models */
  let benchyGeometry = null;
  let currentMesh = null;

  /** Centres a geometry, swaps it in, and reframes camera, shadow and ground. */
  function applyGeometry(geometry) {
    geometry.center();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const previous = currentMesh;
    if (previous) {
      scene.remove(previous);
      previous.material.dispose();
      if (previous.geometry !== benchyGeometry) previous.geometry.dispose();
    }

    const box = geometry.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);
    const radius = Math.max(geometry.boundingSphere.radius, 0.001);

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0xf3ede1,
        roughness: 0.62,
        metalness: 0,
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    currentMesh = mesh;

    ground.position.y = box.min.y - size.y * 0.015;

    const shadowSize = radius * 1.4;
    key.shadow.camera.left = -shadowSize;
    key.shadow.camera.right = shadowSize;
    key.shadow.camera.top = shadowSize;
    key.shadow.camera.bottom = -shadowSize;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = radius * 12;
    key.shadow.camera.updateProjectionMatrix();
    key.position.set(radius * 2.4, radius * 3, radius * 1.8);
    key.target.position.set(0, 0, 0);

    const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.02;
    camera.near = distance * 0.05;
    camera.far = distance * 6;
    camera.position.set(0.72, 0.36, 1).normalize().multiplyScalar(distance);
    camera.updateProjectionMatrix();

    controls.target.set(0, size.y * 0.04, 0);
    controls.update();

    ready = true;
    setState("ready", "");
    start();
  }

  function setFileBar(name) {
    if (!fileBar) return;
    fileBar.hidden = !name;
    if (fileLabel) fileLabel.textContent = name || "";
    stage.classList.toggle("has-file", Boolean(name));
  }

  function flashError(message) {
    setState("error", message);
    window.setTimeout(() => {
      if (currentMesh) setState("ready", "");
    }, 2400);
  }

  async function previewFile(file) {
    if (!/\.stl$/i.test(file.name)) {
      flashError("Only STL files can be previewed.");
      return;
    }
    if (file.size > MAX_PREVIEW_BYTES) {
      flashError("That STL is over 25 MB.");
      return;
    }

    setState("loading", `Reading ${file.name}…`);
    try {
      const buffer = await file.arrayBuffer();
      const geometry = new STLLoader().parse(buffer);
      // STL is conventionally Z-up; the scene is Y-up.
      geometry.rotateX(-Math.PI / 2);
      applyGeometry(geometry);
      setFileBar(file.name);
    } catch (error) {
      console.error("[Grafted3D] Could not read that STL:", error);
      flashError("That STL couldn't be read.");
    }
  }

  ["dragenter", "dragover"].forEach((type) => {
    stage.addEventListener(type, (event) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
      stage.classList.add("is-drop");
    });
  });

  stage.addEventListener("dragleave", (event) => {
    if (stage.contains(event.relatedTarget)) return;
    stage.classList.remove("is-drop");
  });

  stage.addEventListener("drop", (event) => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    stage.classList.remove("is-drop");
    previewFile(event.dataTransfer.files[0]);
  });

  if (fileReset) {
    fileReset.addEventListener("click", () => {
      if (benchyGeometry) applyGeometry(benchyGeometry);
      setFileBar("");
    });
  }

  loadGeometry()
    .then((geometry) => {
      benchyGeometry = geometry;
      applyGeometry(geometry);
    })
    .catch((error) => {
      console.error("[Grafted3D] 3D preview failed:", error);
      setState("error", "3D preview unavailable.");
    });
}
