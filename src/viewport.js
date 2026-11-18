/**
 * Interactive 3D preview of the #3DBenchy calibration model.
 *
 * The model is the official single-part STL from CreativeTools/3DBenchy,
 * decimated to 30k triangles by scripts/build-benchy.mjs and stored as a
 * quantised mesh (see that script for the format). It is gzipped in
 * public/models/, decompressed with DecompressionStream and parsed here.
 *
 * Rotate with a drag or the arrow keys; it never zooms, so the page keeps its
 * scroll. Rendering pauses off screen and for reduced motion.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MODEL_URL = `${import.meta.env.BASE_URL}models/3dbenchy.mesh.gz`;

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
  const clock = new THREE.Clock();
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const delta = Math.min(clock.getDelta(), 0.05);
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
    if (!raf) frame();
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

  loadGeometry()
    .then((geometry) => {
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const box = geometry.boundingBox;
      const size = new THREE.Vector3();
      box.getSize(size);
      const radius = geometry.boundingSphere.radius;

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
    })
    .catch((error) => {
      console.error("[Grafted3D] 3D preview failed:", error);
      setState("error", "3D preview unavailable.");
    });
}
