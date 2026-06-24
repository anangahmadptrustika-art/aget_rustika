/* ====================================================================
   Rustika Ops Center — scene isometrik 2D (Canvas 2D, TANPA WebGL).
   Berjalan di CPU sehingga aman di perangkat apa pun (termasuk VM /
   remote desktop tanpa GPU). Menggambar ruangan kantor isometrik +
   karakter agent yang berjalan & bekerja. Teks gelembung & mood dibaca
   dari window.AGENT_STATE (diisi app.js).
   ==================================================================== */
(() => {
  "use strict";

  const stage = document.getElementById("stage");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fb = document.getElementById("webgl-fallback");
    if (fb) fb.hidden = false;
    return;
  }
  stage.appendChild(canvas);

  /* ---------- Konfigurasi dunia ---------- */
  const GW = 9, GH = 6;            // ukuran ruangan (tile)
  const TW = 74, TH = 37;          // ukuran tile isometrik (2:1)
  const HW = TW / 2, HH = TH / 2;
  const WALL_H = 78;               // tinggi dinding (px)
  const PANEL = 332;               // ruang panel kanan

  const AGENTS = [
    { key: "server",   name: "Penjaga Server",   color: "#ff8a3d", station: { x: 1.5, y: 1.5 } },
    { key: "update",   name: "Pemeriksa Update", color: "#4da3ff", station: { x: 3.5, y: 1.7 } },
    { key: "status",   name: "Pemantau Status",  color: "#9b6bff", station: { x: 6.2, y: 1.7 } },
    { key: "backup",   name: "Petugas Backup",   color: "#32c98a", station: { x: 2.3, y: 4.2 } },
    { key: "security", name: "Penjaga Keamanan", color: "#f65d5d", station: { x: 5.0, y: 4.4 } },
    { key: "cache",    name: "Pembersih Cache",  color: "#f5c63d", station: { x: 7.4, y: 4.0 } },
  ];

  let zoom = 1, pan = { x: 0, y: 0 };
  let W = 0, H = 0, dpr = 1;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function project(wx, wy) {
    return { x: pan.x + (wx - wy) * HW * zoom, y: pan.y + (wx + wy) * HH * zoom };
  }
  function unproject(sx, sy) {
    const a = (sx - pan.x) / (HW * zoom);
    const b = (sy - pan.y) / (HH * zoom);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = clamp(Math.round(r * f), 0, 255);
    g = clamp(Math.round(g * f), 0, 255);
    b = clamp(Math.round(b * f), 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  /* ---------- Ukuran & pemusatan ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    recenter();
  }
  function recenter() {
    // letakkan pusat ruangan di area kiri (sisakan panel kanan)
    const cx = (GW / 2 - GH / 2) * HW * zoom;
    const cy = (GW / 2 + GH / 2) * HH * zoom;
    const targetX = Math.max(260, (W - PANEL) / 2);
    const targetY = H * 0.46;
    pan.x = targetX - cx;
    pan.y = targetY - cy;
  }

  /* ---------- Gambar lantai ---------- */
  function poly(pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }

  function drawFloor() {
    for (let i = 0; i < GW; i++) {
      for (let j = 0; j < GH; j++) {
        const a = project(i, j), b = project(i + 1, j), c = project(i + 1, j + 1), d = project(i, j + 1);
        const light = (i + j) % 2 === 0 ? "#eef2fc" : "#e6ecf8";
        poly([a, b, c, d], light, "rgba(120,140,190,0.18)", 1);
      }
    }
    // karpet aksen
    const r0 = project(3.1, 2.0), r1 = project(5.9, 2.0), r2 = project(5.9, 4.2), r3 = project(3.1, 4.2);
    poly([r0, r1, r2, r3], "rgba(91,124,255,0.10)", "rgba(91,124,255,0.18)", 1);
  }

  function drawWalls() {
    const H0 = WALL_H * zoom;
    // dinding belakang (y = 0)
    let p1 = project(0, 0), p2 = project(GW, 0);
    poly([p1, p2, { x: p2.x, y: p2.y - H0 }, { x: p1.x, y: p1.y - H0 }], "#e3e9f7", "rgba(120,140,190,0.25)", 1);
    // jendela di dinding belakang
    drawWindow(2.0, 0, 1.6);
    drawWindow(5.2, 0, 1.6);
    // dinding kiri (x = 0)
    p1 = project(0, 0); p2 = project(0, GH);
    poly([p1, p2, { x: p2.x, y: p2.y - H0 }, { x: p1.x, y: p1.y - H0 }], "#d7deef", "rgba(120,140,190,0.25)", 1);
    // skirting
    p1 = project(0, 0); p2 = project(GW, 0);
    poly([p1, p2, { x: p2.x, y: p2.y - 7 * zoom }, { x: p1.x, y: p1.y - 7 * zoom }], "rgba(150,165,205,0.5)");
  }

  function drawWindow(wx, wy, ww) {
    const top = WALL_H * zoom - 18 * zoom, bot = 26 * zoom;
    const p1 = project(wx, wy), p2 = project(wx + ww, wy);
    const A = { x: p1.x, y: p1.y - bot }, B = { x: p2.x, y: p2.y - bot };
    const C = { x: p2.x, y: p2.y - top }, D = { x: p1.x, y: p1.y - top };
    poly([A, B, C, D], "rgba(150,200,255,0.55)", "rgba(120,150,210,0.5)", 1.5);
    // bingkai tengah
    const mx = (A.x + B.x) / 2, my1 = (A.y + B.y) / 2, my2 = (C.y + D.y) / 2;
    ctx.strokeStyle = "rgba(120,150,210,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx, my1); ctx.lineTo(mx, my2); ctx.stroke();
  }

  /* ---------- Gambar kotak isometrik (perabot) ---------- */
  function drawBox(wx, wy, fw, fd, hpx, color) {
    const h = hpx * zoom;
    const A = project(wx, wy), B = project(wx + fw, wy), C = project(wx + fw, wy + fd), D = project(wx, wy + fd);
    const tA = { x: A.x, y: A.y - h }, tB = { x: B.x, y: B.y - h }, tC = { x: C.x, y: C.y - h }, tD = { x: D.x, y: D.y - h };
    // sisi kiri-depan (+y) lebih gelap
    poly([D, C, tC, tD], shade(color, 0.72), "rgba(0,0,0,0.06)", 1);
    // sisi kanan-depan (+x)
    poly([B, C, tC, tB], shade(color, 0.86), "rgba(0,0,0,0.06)", 1);
    // atap
    poly([tA, tB, tC, tD], shade(color, 1.06), "rgba(0,0,0,0.05)", 1);
  }

  /* ---------- Perabot statis ---------- */
  function drawDesk(wx, wy) {
    drawBox(wx, wy + 0.15, 1.1, 0.6, 26, "#b88a5e");          // meja
    drawBox(wx + 0.32, wy + 0.28, 0.46, 0.08, 50, "#2b3346"); // monitor (badan)
    // layar
    const s = project(wx + 0.32, wy + 0.30);
    ctx.fillStyle = "#6ee7ff";
    ctx.globalAlpha = 0.9;
    const sw = 30 * zoom, sh = 18 * zoom;
    ctx.fillRect(s.x - sw / 2, s.y - 46 * zoom, sw, sh);
    ctx.globalAlpha = 1;
  }
  function drawRack(wx, wy) {
    drawBox(wx, wy, 0.6, 0.6, 74, "#2a3142");
    // LED
    const p = project(wx + 0.05, wy + 0.55);
    const cols = ["#34d399", "#34d399", "#fbbf24", "#34d399", "#34d399"];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = cols[i];
      ctx.fillRect(p.x, p.y - (24 + i * 11) * zoom, 16 * zoom, 4 * zoom);
    }
  }
  function drawPlant(wx, wy) {
    drawBox(wx, wy, 0.34, 0.34, 14, "#c98a5e");
    const p = project(wx + 0.17, wy + 0.17);
    ctx.fillStyle = "#46b06a";
    ctx.beginPath(); ctx.arc(p.x, p.y - 30 * zoom, 16 * zoom, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5cc77e";
    ctx.beginPath(); ctx.arc(p.x + 8 * zoom, p.y - 40 * zoom, 10 * zoom, 0, Math.PI * 2); ctx.fill();
  }
  function drawBin(wx, wy) { drawBox(wx, wy, 0.32, 0.32, 22, "#6b76a0"); }

  // daftar perabot dengan kunci kedalaman (x+y)
  const PROPS = [
    { x: 0.9, y: 0.9, sum: 1.8, draw: () => drawRack(0.9, 0.9) },
    { x: 1.7, y: 0.9, sum: 2.6, draw: () => drawRack(1.7, 0.9) },
    { x: 3.0, y: 1.0, sum: 4.0, draw: () => drawDesk(3.0, 1.0) },
    { x: 5.7, y: 1.0, sum: 6.7, draw: () => drawDesk(5.7, 1.0) },
    { x: 1.8, y: 4.4, sum: 6.2, draw: () => drawDesk(1.8, 4.4) },
    { x: 4.5, y: 4.6, sum: 9.1, draw: () => drawDesk(4.5, 4.6) },
    { x: 7.5, y: 4.1, sum: 11.6, draw: () => drawBin(7.5, 4.1) },
    { x: 0.5, y: 5.4, sum: 5.9, draw: () => drawPlant(0.5, 5.4) },
    { x: 8.4, y: 0.6, sum: 9.0, draw: () => drawPlant(8.4, 0.6) },
    { x: 8.4, y: 5.3, sum: 13.7, draw: () => drawPlant(8.4, 5.3) },
  ];

  /* ---------- Karakter agent ---------- */
  function drawAgent(ag, alert) {
    const p = project(ag.x, ag.y);
    const z = zoom;
    const bob = ag.bob * z;
    // bayangan
    ctx.fillStyle = "rgba(30,40,70,0.18)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 15 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    const baseY = p.y - bob;
    // badan (kapsul) dengan gradien -> kesan 3D
    const bodyTop = baseY - 44 * z, bodyBot = baseY - 6 * z;
    const bw = 22 * z;
    const grad = ctx.createLinearGradient(p.x - bw, 0, p.x + bw, 0);
    grad.addColorStop(0, shade(ag.color, 0.78));
    grad.addColorStop(0.5, ag.color);
    grad.addColorStop(1, shade(ag.color, 1.12));
    ctx.fillStyle = grad;
    roundedBody(p.x, bodyTop, bodyBot, bw);
    if (alert) { ctx.strokeStyle = "#e5484d"; ctx.lineWidth = 2.5 * z; ctx.stroke(); }

    // kepala
    const hy = baseY - 52 * z, hr = 13 * z;
    const hg = ctx.createLinearGradient(p.x - hr, 0, p.x + hr, 0);
    hg.addColorStop(0, shade(ag.color, 0.85));
    hg.addColorStop(1, shade(ag.color, 1.15));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(p.x, hy, hr, 0, Math.PI * 2); ctx.fill();
    // mata
    ctx.fillStyle = alert ? "#ffd7d7" : "#1a2238";
    ctx.beginPath(); ctx.arc(p.x - 5 * z, hy - 1 * z, 2.4 * z, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + 5 * z, hy - 1 * z, 2.4 * z, 0, Math.PI * 2); ctx.fill();
    // antena
    ctx.strokeStyle = "#9aa6c8"; ctx.lineWidth = 1.6 * z;
    ctx.beginPath(); ctx.moveTo(p.x, hy - hr); ctx.lineTo(p.x, hy - hr - 9 * z); ctx.stroke();
    ctx.fillStyle = alert ? "#e5484d" : "#6ee7ff";
    ctx.beginPath(); ctx.arc(p.x, hy - hr - 11 * z, 3 * z, 0, Math.PI * 2); ctx.fill();
  }
  function roundedBody(cx, top, bot, w) {
    const r = w;
    ctx.beginPath();
    ctx.moveTo(cx - w, top + r);
    ctx.arc(cx, top + r, w, Math.PI, 0);
    ctx.lineTo(cx + w, bot - r * 0.6);
    ctx.quadraticCurveTo(cx + w, bot, cx, bot);
    ctx.quadraticCurveTo(cx - w, bot, cx - w, bot - r * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- State gerak agent ---------- */
  const agents = AGENTS.map((a) => {
    const x = clamp(a.station.x + rand(-0.5, 0.5), 0.6, GW - 0.6);
    const y = clamp(a.station.y + rand(-0.5, 0.5), 0.6, GH - 0.6);
    return {
      ...a, x, y, tx: x, ty: y,
      speed: rand(0.7, 1.1), phase: "rest", rest: rand(0.4, 1.6),
      t: Math.random() * 10, bob: 0,
      bub: document.querySelector(`.bub[data-agent="${a.key}"]`),
    };
  });
  function pickTarget(ag) {
    if (Math.random() < 0.7) {
      return { x: clamp(ag.station.x + rand(-0.7, 0.7), 0.6, GW - 0.6), y: clamp(ag.station.y + rand(-0.7, 0.7), 0.6, GH - 0.6), work: true };
    }
    return { x: rand(0.6, GW - 0.6), y: rand(0.6, GH - 0.6), work: false };
  }

  /* ---------- Loop ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;

    // update agent
    for (const ag of agents) {
      ag.t += dt;
      const st = (window.AGENT_STATE && window.AGENT_STATE[ag.key]) || null;
      ag.alert = !!(st && st.mood === "alert");
      if (ag.phase === "rest") {
        ag.rest -= dt;
        ag.bob = Math.sin(ag.t * 4) * 1.5;
        if (ag.rest <= 0) { ag.phase = "walk"; const t = pickTarget(ag); ag.tx = t.x; ag.ty = t.y; ag.work = t.work; }
      } else {
        const dx = ag.tx - ag.x, dy = ag.ty - ag.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.05) {
          ag.phase = "rest"; ag.rest = ag.work ? rand(2.2, 4.2) : rand(0.4, 1.0); ag.bob = 0;
        } else {
          const sp = ag.speed * (ag.alert ? 1.6 : 1) * dt;
          ag.x += (dx / dist) * Math.min(sp, dist);
          ag.y += (dy / dist) * Math.min(sp, dist);
          ag.bob = Math.abs(Math.sin(ag.t * 11)) * 4;
        }
      }
    }

    // render
    ctx.clearRect(0, 0, W, H);
    drawFloor();
    drawWalls();

    // gabung perabot + agent, urutkan berdasar kedalaman (x+y)
    const items = [];
    for (const pr of PROPS) items.push({ sum: pr.sum, fn: pr.draw });
    for (const ag of agents) items.push({ sum: ag.x + ag.y + 0.01, fn: () => drawAgent(ag, ag.alert) });
    items.sort((a, b) => a.sum - b.sum);
    for (const it of items) it.fn();

    // posisikan gelembung
    for (const ag of agents) {
      if (!ag.bub) continue;
      const p = project(ag.x, ag.y);
      const x = p.x, y = p.y - (70 + ag.bob) * zoom;
      ag.bub.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      ag.bub.classList.add("show");
      ag.bub.dataset.mood = ag.alert ? "alert" : "ok";
    }

    requestAnimationFrame(frame);
  }

  /* ---------- Interaksi: geser & zoom ---------- */
  let dragging = false, lastPt = null;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastPt = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    pan.x += e.clientX - lastPt.x; pan.y += e.clientY - lastPt.y;
    lastPt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("pointercancel", () => { dragging = false; });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const before = unproject(e.clientX, e.clientY);
    zoom = clamp(zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.55, 2.4);
    pan.x = e.clientX - (before.x - before.y) * HW * zoom;
    pan.y = e.clientY - (before.x + before.y) * HH * zoom;
  }, { passive: false });

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
