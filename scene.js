/* ====================================================================
   Rustika Ops Center — kantor isometrik (Canvas 2D, TANPA WebGL).
   Ruangan besar berisi 6 kamar (1 per agent) yang dipisah partisi kaca
   berpintu. Tiap agent berjalan & bekerja di kamarnya, dan sesekali
   pergi ke kamar lain lewat pintu. Berjalan di CPU -> aman di perangkat
   apa pun. Teks gelembung & mood dibaca dari window.AGENT_STATE.
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

  /* ---------- Dunia ---------- */
  const COLS = 3, ROWS = 2;        // 3x2 = 6 kamar
  const RW = 4, RD = 4;            // ukuran tiap kamar (tile)
  const GW = COLS * RW, GH = ROWS * RD; // total lantai = 12 x 8 tile
  const TW = 72, TH = 36, HW = TW / 2, HH = TH / 2;
  const WALL_H = 82;               // tinggi dinding luar
  const PART_H = 46;               // tinggi partisi kaca dalam
  const PANEL = 332;

  // kamar tiap agent (kolom, baris)
  const AGENTS = [
    { key: "server",   name: "Penjaga Server",   color: "#ff8a3d", room: [0, 0] },
    { key: "update",   name: "Pemeriksa Update", color: "#4da3ff", room: [1, 0] },
    { key: "status",   name: "Pemantau Status",  color: "#9b6bff", room: [2, 0] },
    { key: "backup",   name: "Petugas Backup",   color: "#32c98a", room: [0, 1] },
    { key: "security", name: "Penjaga Keamanan", color: "#f65d5d", room: [1, 1] },
    { key: "cache",    name: "Pembersih Cache",  color: "#f5c63d", room: [2, 1] },
  ];

  let zoom = 1, pan = { x: 0, y: 0 };
  let W = 0, H = 0, dpr = 1;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function project(wx, wy) { return { x: pan.x + (wx - wy) * HW * zoom, y: pan.y + (wx + wy) * HH * zoom }; }
  function unproject(sx, sy) {
    const a = (sx - pan.x) / (HW * zoom), b = (sy - pan.y) / (HH * zoom);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = clamp(Math.round(r * f), 0, 255); g = clamp(Math.round(g * f), 0, 255); b = clamp(Math.round(b * f), 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  /* ---------- Pintu & navigasi antar kamar ---------- */
  // Titik pintu di tiap batas kamar bersebelahan.
  function doorBetween(a, b) {
    if (a[1] === b[1]) { const cc = Math.min(a[0], b[0]); return { x: (cc + 1) * RW, y: a[1] * RD + RD / 2 }; }
    const rr = Math.min(a[1], b[1]); return { x: a[0] * RW + RW / 2, y: (rr + 1) * RD };
  }
  function neighbors([c, r]) {
    const out = [];
    if (c > 0) out.push([c - 1, r]); if (c < COLS - 1) out.push([c + 1, r]);
    if (r > 0) out.push([c, r - 1]); if (r < ROWS - 1) out.push([c, r + 1]);
    return out;
  }
  function bfs(start, goal) {
    const key = (q) => q[0] + "," + q[1];
    const prev = { [key(start)]: null }; const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      if (key(cur) === key(goal)) break;
      for (const nb of neighbors(cur)) if (!(key(nb) in prev)) { prev[key(nb)] = cur; queue.push(nb); }
    }
    const path = []; let c = goal;
    while (c) { path.unshift(c); c = prev[key(c)]; }
    return path;
  }
  function roomBounds(c, r, m = 0.7) { return { x0: c * RW + m, x1: (c + 1) * RW - m, y0: r * RD + m, y1: (r + 1) * RD - m }; }
  function pickInRoom(c, r) { const b = roomBounds(c, r); return { x: rand(b.x0, b.x1), y: rand(b.y0, b.y1) }; }

  /* ---------- Segmen partisi kaca (untuk diurut kedalaman) ---------- */
  const wallSegs = [];
  const isDoorV = (y) => Math.abs((y + 0.5) % RD - RD / 2) < 0.9; // dekat pusat baris
  const isDoorH = (x) => Math.abs((x + 0.5) % RW - RW / 2) < 0.9; // dekat pusat kolom
  for (let cc = 1; cc < COLS; cc++) { const X = cc * RW; for (let y = 0; y < GH; y++) if (!isDoorV(y)) wallSegs.push({ sum: X + y + 0.5, kind: "v", X, a: y, b: y + 1 }); }
  for (let rr = 1; rr < ROWS; rr++) { const Y = rr * RD; for (let x = 0; x < GW; x++) if (!isDoorH(x)) wallSegs.push({ sum: x + 0.5 + Y, kind: "h", Y, a: x, b: x + 1 }); }

  /* ---------- Render dasar ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    recenter();
  }
  function recenter() {
    const cx = (GW / 2 - GH / 2) * HW * zoom, cy = (GW / 2 + GH / 2) * HH * zoom;
    pan.x = Math.max(250, (W - PANEL) / 2) - cx;
    pan.y = H * 0.44 - cy;
  }
  function poly(pts, fill, stroke, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }

  function drawFloor() {
    for (let i = 0; i < GW; i++) for (let j = 0; j < GH; j++) {
      const a = project(i, j), b = project(i + 1, j), c = project(i + 1, j + 1), d = project(i, j + 1);
      poly([a, b, c, d], (i + j) % 2 === 0 ? "#eef2fc" : "#e7edf8", "rgba(120,140,190,0.16)", 1);
    }
    // garis batas kamar (lebih tegas) di lantai
    ctx.strokeStyle = "rgba(91,124,255,0.30)"; ctx.lineWidth = 2;
    for (let cc = 1; cc < COLS; cc++) { const p1 = project(cc * RW, 0), p2 = project(cc * RW, GH); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
    for (let rr = 1; rr < ROWS; rr++) { const p1 = project(0, rr * RD), p2 = project(GW, rr * RD); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
  }

  function drawOuterWalls() {
    const h = WALL_H * zoom;
    let p1 = project(0, 0), p2 = project(GW, 0);
    poly([p1, p2, { x: p2.x, y: p2.y - h }, { x: p1.x, y: p1.y - h }], "#e3e9f7", "rgba(120,140,190,0.25)", 1);
    for (let c = 0; c < COLS; c++) drawWindow(c * RW + 1.0, 0, RW - 2.0);
    p1 = project(0, 0); p2 = project(0, GH);
    poly([p1, p2, { x: p2.x, y: p2.y - h }, { x: p1.x, y: p1.y - h }], "#d7deef", "rgba(120,140,190,0.25)", 1);
    p1 = project(0, 0); p2 = project(GW, 0);
    poly([p1, p2, { x: p2.x, y: p2.y - 7 * zoom }, { x: p1.x, y: p1.y - 7 * zoom }], "rgba(150,165,205,0.5)");
  }
  function drawWindow(wx, wy, ww) {
    const top = WALL_H * zoom - 20 * zoom, bot = 28 * zoom;
    const p1 = project(wx, wy), p2 = project(wx + ww, wy);
    const A = { x: p1.x, y: p1.y - bot }, B = { x: p2.x, y: p2.y - bot }, C = { x: p2.x, y: p2.y - top }, D = { x: p1.x, y: p1.y - top };
    poly([A, B, C, D], "rgba(150,200,255,0.5)", "rgba(120,150,210,0.45)", 1.5);
    const mx = (A.x + B.x) / 2;
    ctx.strokeStyle = "rgba(120,150,210,0.45)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx, (A.y + B.y) / 2); ctx.lineTo(mx, (C.y + D.y) / 2); ctx.stroke();
  }
  function drawWallSeg(seg) {
    const h = PART_H * zoom;
    let p1, p2;
    if (seg.kind === "v") { p1 = project(seg.X, seg.a); p2 = project(seg.X, seg.b); }
    else { p1 = project(seg.a, seg.Y); p2 = project(seg.b, seg.Y); }
    const A = p1, B = p2, C = { x: p2.x, y: p2.y - h }, D = { x: p1.x, y: p1.y - h };
    poly([A, B, C, D], "rgba(150,198,255,0.20)", "rgba(120,150,210,0.30)", 1);
    // rel atas
    ctx.strokeStyle = "rgba(130,160,220,0.7)"; ctx.lineWidth = 2.2 * zoom;
    ctx.beginPath(); ctx.moveTo(D.x, D.y); ctx.lineTo(C.x, C.y); ctx.stroke();
  }

  /* ---------- Perabot ---------- */
  function drawBox(wx, wy, fw, fd, hpx, color) {
    const h = hpx * zoom;
    const A = project(wx, wy), B = project(wx + fw, wy), C = project(wx + fw, wy + fd), D = project(wx, wy + fd);
    const tA = { x: A.x, y: A.y - h }, tB = { x: B.x, y: B.y - h }, tC = { x: C.x, y: C.y - h }, tD = { x: D.x, y: D.y - h };
    poly([D, C, tC, tD], shade(color, 0.72), "rgba(0,0,0,0.05)", 1);
    poly([B, C, tC, tB], shade(color, 0.86), "rgba(0,0,0,0.05)", 1);
    poly([tA, tB, tC, tD], shade(color, 1.06), "rgba(0,0,0,0.05)", 1);
  }
  function drawDesk(wx, wy) {
    drawBox(wx, wy + 0.12, 1.0, 0.55, 26, "#b88a5e");
    drawBox(wx + 0.30, wy + 0.24, 0.42, 0.08, 48, "#2b3346");
    const s = project(wx + 0.30, wy + 0.26);
    ctx.fillStyle = "#6ee7ff"; ctx.globalAlpha = 0.92;
    ctx.fillRect(s.x - 15 * zoom, s.y - 44 * zoom, 30 * zoom, 17 * zoom); ctx.globalAlpha = 1;
  }
  function drawRack(wx, wy) {
    drawBox(wx, wy, 0.6, 0.6, 74, "#2a3142");
    const p = project(wx + 0.05, wy + 0.55);
    const cols = ["#34d399", "#34d399", "#fbbf24", "#34d399", "#34d399"];
    for (let i = 0; i < 5; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(p.x, p.y - (24 + i * 11) * zoom, 16 * zoom, 4 * zoom); }
  }
  function drawPlant(wx, wy) {
    drawBox(wx, wy, 0.32, 0.32, 14, "#c98a5e");
    const p = project(wx + 0.16, wy + 0.16);
    ctx.fillStyle = "#46b06a"; ctx.beginPath(); ctx.arc(p.x, p.y - 30 * zoom, 15 * zoom, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5cc77e"; ctx.beginPath(); ctx.arc(p.x + 7 * zoom, p.y - 39 * zoom, 9 * zoom, 0, Math.PI * 2); ctx.fill();
  }
  function drawBin(wx, wy) { drawBox(wx, wy, 0.3, 0.3, 22, "#6b76a0"); }

  const PROPS = [
    { x: 1.4, y: 1.4, draw: () => drawRack(1.4, 1.4) },
    { x: 2.2, y: 1.4, draw: () => drawRack(2.2, 1.4) },
    { x: 5.4, y: 1.3, draw: () => drawDesk(5.4, 1.3) },
    { x: 9.4, y: 1.3, draw: () => drawDesk(9.4, 1.3) },
    { x: 1.4, y: 5.4, draw: () => drawDesk(1.4, 5.4) },
    { x: 5.4, y: 5.4, draw: () => drawDesk(5.4, 5.4) },
    { x: 9.4, y: 5.4, draw: () => drawDesk(9.4, 5.4) },
    { x: 10.6, y: 6.4, draw: () => drawBin(10.6, 6.4) },
    { x: 0.5, y: 3.5, draw: () => drawPlant(0.5, 3.5) },
    { x: 11.4, y: 0.5, draw: () => drawPlant(11.4, 0.5) },
    { x: 11.4, y: 7.4, draw: () => drawPlant(11.4, 7.4) },
    { x: 0.5, y: 7.4, draw: () => drawPlant(0.5, 7.4) },
  ].map((p) => ({ ...p, sum: p.x + p.y }));

  /* ---------- Karakter: robot AI ---------- */
  const OUT = "#3a4670"; // garis tepi navy

  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fs(fill, stroke, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  function drawAgent(ag) {
    const p = project(ag.x, ag.y), z = zoom, t = ag.t, moving = ag.phase === "walk", col = ag.color;
    const lw = Math.max(1.1, 2 * z), lwn = Math.max(0.9, 1.5 * z);
    const light = shade(col, 1.18), darkc = shade(col, 0.78);
    const alert = ag.alert;

    // bayangan
    ctx.fillStyle = "rgba(30,40,70,0.16)";
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 16 * z, 6.5 * z, 0, 0, Math.PI * 2); ctx.fill();

    const vbob = (moving ? Math.abs(Math.sin(t * 8)) * 3 : Math.sin(t * 2.4) * 1.0) * z;
    const sway = (moving ? Math.sin(t * 8) * 1.6 : 0) * z;
    const cx = p.x + sway, FB = p.y - vbob;
    const stepL = (moving ? Math.sin(t * 8) * 2 : 0) * z, stepR = -stepL;

    // kaki
    ctx.fillStyle = darkc;
    rrect(cx - 9 * z, FB - 6 * z + stepL, 7 * z, 6 * z, 2.5 * z); fs(darkc, OUT, lwn);
    rrect(cx + 2 * z, FB - 6 * z + stepR, 7 * z, 6 * z, 2.5 * z); fs(darkc, OUT, lwn);

    // bahu / lengan (panel samping lebih gelap) — di belakang badan
    rrect(cx - 21 * z, FB - 33 * z, 9 * z, 25 * z, 4 * z); fs(darkc, OUT, lwn);
    rrect(cx + 12 * z, FB - 33 * z, 9 * z, 25 * z, 4 * z); fs(darkc, OUT, lwn);

    // badan
    rrect(cx - 17 * z, FB - 35 * z, 34 * z, 30 * z, 8 * z);
    const bg = ctx.createLinearGradient(cx - 17 * z, 0, cx + 17 * z, 0);
    bg.addColorStop(0, darkc); bg.addColorStop(0.45, col); bg.addColorStop(1, light);
    fs(bg, alert ? "#e5484d" : OUT, alert ? Math.max(1.6, 2.4 * z) : lw);
    // tulisan "Ai"
    ctx.fillStyle = OUT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `800 ${13 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText("Ai", cx, FB - 18 * z);

    // leher
    rrect(cx - 6 * z, FB - 41 * z, 12 * z, 8 * z, 2 * z); fs(darkc, OUT, lwn);

    // kuping
    rrect(cx - 27 * z, FB - 62 * z, 8 * z, 16 * z, 3 * z); fs(darkc, OUT, lwn);
    rrect(cx + 19 * z, FB - 62 * z, 8 * z, 16 * z, 3 * z); fs(darkc, OUT, lwn);

    // kepala
    rrect(cx - 22 * z, FB - 70 * z, 44 * z, 30 * z, 11 * z);
    const hg = ctx.createLinearGradient(0, FB - 70 * z, 0, FB - 40 * z);
    hg.addColorStop(0, shade(col, 1.26)); hg.addColorStop(1, light);
    fs(hg, OUT, lw);

    // layar wajah
    rrect(cx - 17 * z, FB - 67 * z, 34 * z, 19 * z, 6 * z); fs("#e8edfb", OUT, lwn);

    // mata (lirik mengikuti arah gerak)
    const ed = clamp((ag.dirx - ag.diry), -1, 1) * 1.8 * z;
    const ey = FB - 57.5 * z;
    for (const ex of [cx - 8 * z, cx + 8 * z]) {
      ctx.beginPath(); ctx.arc(ex, ey, 5.4 * z, 0, Math.PI * 2);
      fs("#ffffff", alert ? "#e5484d" : OUT, lwn);
      ctx.fillStyle = alert ? "#e5484d" : OUT;
      ctx.beginPath(); ctx.arc(ex + ed, ey + 0.4 * z, 2.4 * z, 0, Math.PI * 2); ctx.fill();
    }
    // mulut / speaker
    rrect(cx - 4.5 * z, FB - 45 * z, 9 * z, 3 * z, 1.5 * z); fs(OUT, null, 0);

    // antena atas (ring)
    ctx.strokeStyle = OUT; ctx.lineWidth = lwn;
    ctx.beginPath(); ctx.moveTo(cx, FB - 70 * z); ctx.lineTo(cx, FB - 77 * z); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, FB - 80 * z, 3.4 * z, 0, Math.PI * 2);
    fs(alert ? "#e5484d" : "#ffffff", OUT, lwn);

    // antena samping melengkung + bola (ciri khas)
    ctx.strokeStyle = OUT; ctx.lineWidth = lwn;
    ctx.beginPath(); ctx.moveTo(cx - 22 * z, FB - 55 * z);
    ctx.quadraticCurveTo(cx - 31 * z, FB - 55 * z, cx - 31 * z, FB - 47 * z); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - 31 * z, FB - 44 * z, 3 * z, 0, Math.PI * 2);
    fs(light, OUT, lwn);
  }

  /* ---------- State agent ---------- */
  const agents = AGENTS.map((a) => {
    const [c, r] = a.room; const s = pickInRoom(c, r);
    return {
      ...a, cx: c, cy: r, x: s.x, y: s.y,
      queue: [], destRoom: [c, r], dirx: 0, diry: 0,
      speed: rand(0.85, 1.25), phase: "rest", rest: rand(0.4, 1.8), t: Math.random() * 10,
      bub: document.querySelector(`.bub[data-agent="${a.key}"]`),
    };
  });

  function decideNext(ag) {
    if (Math.random() < 0.75) {
      // berkeliling di kamar sendiri
      ag.queue = [pickInRoom(ag.cx, ag.cy)];
      ag.destRoom = [ag.cx, ag.cy];
    } else {
      // kunjungi kamar lain lewat pintu
      let dc, dr;
      do { dc = (Math.random() * COLS) | 0; dr = (Math.random() * ROWS) | 0; } while (dc === ag.cx && dr === ag.cy);
      const path = bfs([ag.cx, ag.cy], [dc, dr]);
      const wp = [];
      for (let i = 0; i < path.length - 1; i++) wp.push(doorBetween(path[i], path[i + 1]));
      wp.push(pickInRoom(dc, dr));
      ag.queue = wp; ag.destRoom = [dc, dr];
    }
    ag.phase = "walk";
  }

  /* ---------- Loop ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;

    for (const ag of agents) {
      ag.t += dt;
      const st = (window.AGENT_STATE && window.AGENT_STATE[ag.key]) || null;
      ag.alert = !!(st && st.mood === "alert");
      if (ag.phase === "rest") {
        ag.rest -= dt; ag.dirx = ag.diry = 0;
        if (ag.rest <= 0) decideNext(ag);
      } else {
        const tgt = ag.queue[0];
        const dx = tgt.x - ag.x, dy = tgt.y - ag.y, dist = Math.hypot(dx, dy);
        if (dist < 0.06) {
          ag.queue.shift();
          if (!ag.queue.length) { ag.cx = ag.destRoom[0]; ag.cy = ag.destRoom[1]; ag.phase = "rest"; ag.rest = rand(2.0, 4.0); ag.dirx = ag.diry = 0; }
        } else {
          const sp = ag.speed * (ag.alert ? 1.5 : 1) * dt;
          ag.dirx = dx / dist; ag.diry = dy / dist;
          ag.x += ag.dirx * Math.min(sp, dist); ag.y += ag.diry * Math.min(sp, dist);
        }
      }
    }

    ctx.clearRect(0, 0, W, H);
    drawFloor();
    drawOuterWalls();

    const items = [];
    for (const s of wallSegs) items.push({ sum: s.sum, fn: () => drawWallSeg(s) });
    for (const pr of PROPS) items.push({ sum: pr.sum, fn: pr.draw });
    for (const ag of agents) items.push({ sum: ag.x + ag.y + 0.02, fn: () => drawAgent(ag) });
    items.sort((a, b) => a.sum - b.sum);
    for (const it of items) it.fn();

    for (const ag of agents) {
      if (!ag.bub) continue;
      const p = project(ag.x, ag.y);
      ag.bub.style.transform = `translate(-50%, -100%) translate(${p.x.toFixed(1)}px, ${(p.y - 92 * zoom).toFixed(1)}px)`;
      ag.bub.classList.add("show");
      ag.bub.dataset.mood = ag.alert ? "alert" : "ok";
    }

    requestAnimationFrame(frame);
  }

  /* ---------- Interaksi ---------- */
  let dragging = false, lastPt = null;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastPt = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!dragging) return; pan.x += e.clientX - lastPt.x; pan.y += e.clientY - lastPt.y; lastPt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("pointercancel", () => { dragging = false; });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const b = unproject(e.clientX, e.clientY);
    zoom = clamp(zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.5, 2.4);
    pan.x = e.clientX - (b.x - b.y) * HW * zoom; pan.y = e.clientY - (b.x + b.y) * HH * zoom;
  }, { passive: false });

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
