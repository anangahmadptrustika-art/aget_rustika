/* ====================================================================
   Rustika Ops Center — scene 3D (Three.js).
   Membangun ruangan kantor isometrik + karakter agent yang berjalan
   bolak-balik mengerjakan tugasnya. Data/teks gelembung & mood dibaca
   dari window.AGENT_STATE yang diisi app.js.
   ==================================================================== */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const AGENTS = [
  { key: "server",   name: "Penjaga Server",   color: 0xff8a3d, station: { x: 1.5, z: 1.5 } },
  { key: "update",   name: "Pemeriksa Update", color: 0x4da3ff, station: { x: 3.5, z: 1.7 } },
  { key: "status",   name: "Pemantau Status",  color: 0x9b6bff, station: { x: 6.2, z: 1.7 } },
  { key: "backup",   name: "Petugas Backup",   color: 0x32c98a, station: { x: 2.3, z: 4.2 } },
  { key: "security", name: "Penjaga Keamanan", color: 0xf65d5d, station: { x: 5.0, z: 4.4 } },
  { key: "cache",    name: "Pembersih Cache",  color: 0xf5c63d, station: { x: 7.4, z: 4.0 } },
];

const ROOM = { w: 9, d: 6 };
const BOUNDS = { x0: 0.7, x1: 8.3, z0: 0.7, z1: 5.3 };

function showFallback() {
  const fb = document.getElementById("webgl-fallback");
  if (fb) fb.hidden = false;
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch (e) { return false; }
}

function init() {
  const stage = document.getElementById("stage");

  if (!hasWebGL()) { showFallback(); return; }

  // failIfMajorPerformanceCaveat:false -> izinkan WebGL software (mis. di VM/remote
  // desktop tanpa GPU) supaya scene tetap tampil walau lebih lambat.
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    failIfMajorPerformanceCaveat: false,
    powerPreference: "high-performance",
  });

  // Deteksi renderer software -> turunkan beban (matikan bayangan, pixelRatio 1).
  let lowPerf = false;
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const rname = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
    if (/swiftshader|software|llvmpipe|basic render|microsoft/i.test(rname)) lowPerf = true;
  } catch (e) { /* abaikan */ }

  renderer.setPixelRatio(lowPerf ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !lowPerf;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eefb);
  scene.fog = new THREE.Fog(0xe9eefb, 22, 38);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(12.5, 9, 13.5);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(ROOM.w / 2, 0.8, ROOM.d / 2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 26;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.45;
  controls.update();

  /* ---------- Lighting ---------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc4cfe6, 0.95));
  const sun = new THREE.DirectionalLight(0xfff6e8, 1.05);
  sun.position.set(9, 13, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  /* ---------- Helpers ---------- */
  const mat = (color, rough = 0.85, metal = 0.0, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...opts });

  function box(w, h, d, material, x, y, z, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /* ---------- Lantai & dinding ---------- */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    mat(0xf3f6ff, 0.98)
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ROOM.w / 2, 0, ROOM.d / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // garis tile lembut
  const grid = new THREE.GridHelper(Math.max(ROOM.w, ROOM.d) + 2, Math.max(ROOM.w, ROOM.d) + 2, 0xc4cee6, 0xd6def0);
  grid.position.set(ROOM.w / 2, 0.012, ROOM.d / 2);
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);

  // karpet area (aksen)
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), mat(0xdfe6fb, 1));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(4.4, 0.014, 3.0);
  rug.receiveShadow = true;
  scene.add(rug);

  const wallMat = mat(0xeef2fc, 0.95);
  const wallH = 2.2, t = 0.12;
  // dinding belakang (z = 0)
  box(ROOM.w, wallH, t, wallMat, ROOM.w / 2, wallH / 2, 0);
  // dinding kiri (x = 0)
  box(t, wallH, ROOM.d, wallMat, 0, wallH / 2, ROOM.d / 2);
  // skirting (aksen gelap tipis di kaki dinding)
  box(ROOM.w, 0.12, t + 0.02, mat(0xd2dbf0, 0.9), ROOM.w / 2, 0.06, 0.0);
  box(t + 0.02, 0.12, ROOM.d, mat(0xd2dbf0, 0.9), 0.0, 0.06, ROOM.d / 2);

  // jendela di dinding belakang
  const winMat = new THREE.MeshStandardMaterial({ color: 0x9fc6ff, roughness: 0.2, metalness: 0.1, emissive: 0x6fa8ff, emissiveIntensity: 0.25 });
  box(1.6, 1.1, 0.04, winMat, 2.2, 1.45, 0.07);
  box(1.6, 1.1, 0.04, winMat, 4.2, 1.45, 0.07);

  /* ---------- Perabot ---------- */
  const deskTop = mat(0xb88a5e, 0.7);
  const deskLeg = mat(0x6f5235, 0.8);
  const dark = mat(0x2b3346, 0.6, 0.2);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x6ee7ff });

  function desk(x, z, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    box(1.3, 0.08, 0.72, deskTop, 0, 0.74, 0, g);
    box(0.08, 0.72, 0.6, deskLeg, -0.56, 0.37, 0, g);
    box(0.08, 0.72, 0.6, deskLeg, 0.56, 0.37, 0, g);
    // monitor
    box(0.56, 0.36, 0.05, dark, 0, 1.05, -0.12, g);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.28), screenMat);
    scr.position.set(0, 1.05, -0.092);
    g.add(scr);
    box(0.12, 0.12, 0.12, dark, 0, 0.86, -0.12, g);
    // keyboard
    box(0.4, 0.03, 0.16, mat(0xdfe4f2, 0.8), 0, 0.78, 0.16, g);
    scene.add(g);
    return g;
  }

  // chair sederhana
  function chair(x, z, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const c = mat(0x46527a, 0.7);
    box(0.42, 0.07, 0.42, c, 0, 0.46, 0, g);
    box(0.42, 0.4, 0.07, c, 0, 0.68, -0.2, g);
    box(0.07, 0.46, 0.07, mat(0x2f3a5c, 0.7), 0, 0.23, 0, g);
    scene.add(g);
  }

  // server rack
  function serverRack(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    box(0.8, 1.9, 0.8, mat(0x232a3d, 0.5, 0.3), 0, 0.95, 0, g);
    const ledColors = [0x34d399, 0x34d399, 0xfbbf24, 0x34d399];
    for (let i = 0; i < 7; i++) {
      const c = ledColors[i % ledColors.length];
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.04, 0.02),
        new THREE.MeshBasicMaterial({ color: c })
      );
      led.position.set(0, 0.4 + i * 0.2, 0.41);
      g.add(led);
    }
    scene.add(g);
  }

  // partisi kaca
  function glassPanel(x, z, len, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(len, 1.5, 0.06),
      new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, roughness: 0.05, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.4 })
    );
    glass.position.y = 1.0;
    g.add(glass);
    box(len, 0.08, 0.12, mat(0xaab6d8, 0.6, 0.3), 0, 0.28, 0, g);
    box(len, 0.06, 0.1, mat(0xaab6d8, 0.6, 0.3), 0, 1.74, 0, g);
    scene.add(g);
  }

  // tanaman
  function plant(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.3, 12), mat(0xc98a5e, 0.8));
    pot.position.y = 0.15; pot.castShadow = true; g.add(pot);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(0x46b06a, 0.8));
    leaf.position.y = 0.55; leaf.castShadow = true; g.add(leaf);
    const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0x5cc77e, 0.8));
    leaf2.position.set(0.12, 0.75, 0.05); leaf2.castShadow = true; g.add(leaf2);
    scene.add(g);
  }

  // tempat sampah (cache)
  function bin(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.5, 14), mat(0x6b76a0, 0.6, 0.2));
    b.position.y = 0.25; b.castShadow = true; g.add(b);
    scene.add(g);
  }

  // tata letak ruangan
  serverRack(0.9, 1.0);
  serverRack(1.7, 1.0);
  desk(3.5, 1.2, 0);
  chair(3.5, 1.9, Math.PI);
  desk(6.2, 1.2, 0);
  chair(6.2, 1.9, Math.PI);
  desk(2.3, 4.7, Math.PI);
  chair(2.3, 4.0, 0);
  desk(5.0, 4.9, Math.PI);
  chair(5.0, 4.2, 0);
  bin(7.6, 4.2);
  glassPanel(8.5, 3.0, 4.4, Math.PI / 2);
  plant(0.6, 5.4);
  plant(8.4, 0.7);
  plant(8.4, 5.4);

  /* ---------- Karakter agent ---------- */
  const eyeMat = mat(0x1a2238, 0.4);
  const accentMat = mat(0xffffff, 0.4);

  function makeAgent(color) {
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
    const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.18), roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 6, 14), bodyMat);
    body.position.y = 0.48; body.castShadow = true; rig.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), headMat);
    head.position.y = 1.04; head.castShadow = true; rig.add(head);

    // mata (menghadap +Z)
    for (const sx of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMat);
      eye.position.set(sx, 1.07, 0.205);
      rig.add(eye);
    }
    // antena
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 6), mat(0x9aa6c8, 0.6));
    ant.position.y = 1.32; rig.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0x6ee7ff }));
    tip.position.y = 1.43; rig.add(tip);
    // lengan
    for (const sx of [-0.32, 0.32]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 4, 8), bodyMat);
      arm.position.set(sx, 0.55, 0); arm.castShadow = true; rig.add(arm);
    }

    scene.add(root);
    return { root, rig, bodyMat, headMat, baseColor: new THREE.Color(color) };
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const agents = AGENTS.map((a) => {
    const v = makeAgent(a.color);
    const start = { x: clamp(a.station.x + rand(-0.6, 0.6), BOUNDS.x0, BOUNDS.x1), z: clamp(a.station.z + rand(-0.6, 0.6), BOUNDS.z0, BOUNDS.z1) };
    v.root.position.set(start.x, 0, start.z);
    return {
      ...a, ...v,
      pos: { ...start },
      target: { ...start },
      speed: rand(0.9, 1.4),
      phase: "rest",
      rest: rand(0.5, 1.5),
      t: Math.random() * 10,
      facing: 0,
      bub: document.querySelector(`.bub[data-agent="${a.key}"]`),
    };
  });

  function pickTarget(ag) {
    // 70% di dekat stasiun (bekerja), 30% berkeliling (mondar-mandir)
    if (Math.random() < 0.7) {
      return {
        x: clamp(ag.station.x + rand(-0.7, 0.7), BOUNDS.x0, BOUNDS.x1),
        z: clamp(ag.station.z + rand(-0.7, 0.7), BOUNDS.z0, BOUNDS.z1),
        work: true,
      };
    }
    return {
      x: clamp(rand(BOUNDS.x0, BOUNDS.x1), BOUNDS.x0, BOUNDS.x1),
      z: clamp(rand(BOUNDS.z0, BOUNDS.z1), BOUNDS.z0, BOUNDS.z1),
      work: false,
    };
  }

  /* ---------- Loop ---------- */
  const tmp = new THREE.Vector3();
  const W = () => ({ w: window.innerWidth, h: window.innerHeight });
  const clock = new THREE.Clock();

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const dims = W();

    for (const ag of agents) {
      ag.t += dt;
      const st = (window.AGENT_STATE && window.AGENT_STATE[ag.key]) || null;
      const alert = st && st.mood === "alert";

      if (ag.phase === "rest") {
        ag.rest -= dt;
        // pose bekerja: badan naik-turun halus
        ag.rig.position.y = Math.sin(ag.t * 4) * 0.02;
        ag.rig.rotation.z = Math.sin(ag.t * 2) * 0.02;
        if (ag.rest <= 0) {
          ag.phase = "walk";
          ag.target = pickTarget(ag);
        }
      } else {
        const dx = ag.target.x - ag.pos.x;
        const dz = ag.target.z - ag.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.06) {
          ag.phase = "rest";
          ag.rest = ag.target.work ? rand(2.2, 4.2) : rand(0.4, 1.0);
          ag.rig.position.y = 0;
        } else {
          const sp = (ag.speed * (alert ? 1.5 : 1)) * dt;
          ag.pos.x += (dx / dist) * Math.min(sp, dist);
          ag.pos.z += (dz / dist) * Math.min(sp, dist);
          ag.facing = Math.atan2(dx, dz);
          ag.rig.position.y = Math.abs(Math.sin(ag.t * 12)) * 0.06; // langkah
          ag.rig.rotation.z = 0;
        }
      }

      ag.root.position.x = ag.pos.x;
      ag.root.position.z = ag.pos.z;
      // hadap arah jalan (halus)
      const cur = ag.root.rotation.y;
      let diff = ag.facing - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ag.root.rotation.y = cur + diff * Math.min(1, dt * 10);

      // mood -> warna emissive
      const em = alert ? 0.5 : 0.0;
      ag.bodyMat.emissive = ag.bodyMat.emissive || new THREE.Color();
      ag.bodyMat.emissive.setHex(alert ? 0xe5484d : 0x000000);
      ag.bodyMat.emissiveIntensity = em;

      // posisikan gelembung di atas kepala
      if (ag.bub) {
        tmp.set(ag.root.position.x, 1.85, ag.root.position.z).project(camera);
        if (tmp.z < 1) {
          const x = (tmp.x * 0.5 + 0.5) * dims.w;
          const y = (-tmp.y * 0.5 + 0.5) * dims.h;
          ag.bub.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
          ag.bub.classList.add("show");
          ag.bub.dataset.mood = alert ? "alert" : "ok";
        } else {
          ag.bub.classList.remove("show");
        }
      }
    }

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- Resize ---------- */
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

try {
  init();
} catch (err) {
  console.error("Gagal memuat scene 3D:", err);
  showFallback();
}
