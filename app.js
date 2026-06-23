/* ====================================================================
   Ruang Kendali Agent — animasi + data nyata (opsional) via fetch.
   --------------------------------------------------------------------
   Tiap agent mencoba mengambil data ASLI dari endpoint di config.js.
   Bila endpoint kosong / gagal, agent otomatis pakai data simulasi
   sehingga halaman tetap hidup. Badge LIVE/SIM/ERR menandai sumbernya.
   ==================================================================== */

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const CFG = window.AGENT_CONFIG || {};
  const EP = CFG.endpoints || {};
  const POLL = CFG.pollIntervalMs || {};
  const TIMEOUT = CFG.fetchTimeoutMs || 4000;

  /* ---------- Helper fetch ---------- */
  async function fetchJSON(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally { clearTimeout(t); }
  }

  // Cek reachability tanpa kena CORS (no-cors). Kembalikan latensi (ms) bila
  // bisa dijangkau, lempar error bila tidak.
  async function pingURL(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    const start = performance.now();
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
      return Math.round(performance.now() - start);
    } finally { clearTimeout(t); }
  }

  // Jalankan fn berulang tanpa saling tumpang-tindih (penting untuk async).
  function runLoop(fn, interval) {
    let busy = false;
    const wrap = async () => {
      if (busy) return;
      busy = true;
      try { await fn(); } catch (e) { /* abaikan, sudah ditangani di dalam */ }
      busy = false;
    };
    wrap();
    return setInterval(wrap, Math.max(500, interval || 2500));
  }

  /* ---------- Jam & uptime ---------- */
  const bootTime = Date.now();
  const clockEl = $("#clock");
  const uptimeEl = $("#uptime");
  function pad(n) { return String(n).padStart(2, "0"); }
  function tickClock() {
    const now = new Date();
    clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    let s = Math.floor((Date.now() - bootTime) / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600);  s -= h * 3600;
    const m = Math.floor(s / 60);    s -= m * 60;
    uptimeEl.textContent = `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  setInterval(tickClock, 1000);
  tickClock();

  /* ---------- Log aktivitas ---------- */
  const logEl = $("#log");
  let paused = false;
  const MAX_LOG = 60;
  function log(who, msg, bad = false) {
    if (paused) return;
    const now = new Date();
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="time">${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}</span>` +
      `<span class="who ${who.key}">[${who.label}]</span>` +
      `<span class="msg${bad ? " bad" : ""}"></span>`;
    li.querySelector(".msg").textContent = msg;
    logEl.appendChild(li);
    while (logEl.children.length > MAX_LOG) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }
  $("#pause-btn").addEventListener("click", (e) => {
    paused = !paused;
    e.target.textContent = paused ? "▶ Lanjut" : "⏸ Jeda";
  });

  const A = {
    server:   { key: "server",   label: "Penjaga Server" },
    update:   { key: "update",   label: "Pemeriksa Update" },
    status:   { key: "status",   label: "Pemantau Status" },
    backup:   { key: "backup",   label: "Petugas Backup" },
    security: { key: "security", label: "Penjaga Keamanan" },
    cache:    { key: "cache",    label: "Pembersih Cache" },
  };

  // State bersama yang dibaca scene.js (untuk mood karakter 3D).
  window.AGENT_STATE = window.AGENT_STATE || {};
  Object.keys(A).forEach((k) => { window.AGENT_STATE[k] = { mood: "ok", bubble: "" }; });

  /* ---------- Helper UI ---------- */
  function setAgentMood(a, mood) {
    if (window.AGENT_STATE[a]) window.AGENT_STATE[a].mood = mood;       // dipakai scene 3D
    document.querySelectorAll(`.card[data-agent="${a}"], .panel-sec[data-agent="${a}"]`)
      .forEach((el) => { el.dataset.mood = mood; });                    // highlight kartu HUD
  }
  function setStatusDot(a, state) {
    const dot = document.querySelector(`.card[data-agent="${a}"] .status-dot, .panel-sec[data-agent="${a}"] .status-dot`);
    if (dot) dot.dataset.state = state;
  }
  function setBubble(id, text) {
    const b = $(id);
    if (b) b.textContent = text;
    const key = id.replace("#bubble-", "");
    if (window.AGENT_STATE[key]) window.AGENT_STATE[key].bubble = text;
  }
  function setSource(a, mode) {
    const el = document.getElementById("src-" + a);
    if (el) { el.dataset.src = mode; el.textContent = mode.toUpperCase(); }
  }
  function setBar(barEl, valEl, value, suffix = "%") {
    value = clamp(Math.round(value), 0, 100);
    barEl.style.width = value + "%";
    barEl.classList.toggle("warn", value >= 65 && value < 85);
    barEl.classList.toggle("high", value >= 85);
    if (valEl) valEl.textContent = value + suffix;
    return value;
  }

  /* ================================================================
     AGENT 1 — Penjaga Server (endpoint: { cpu, ram })
     ================================================================ */
  (() => {
    const cpuBar = $("#cpu-bar"), cpuVal = $("#cpu-val");
    const ramBar = $("#ram-bar"), ramVal = $("#ram-val");
    const url = EP.server;
    let cpu = 35, ram = 48;
    const okMsgs = ["Semua node sehat ✔", "Beban server normal", "Tidak ada antrian menumpuk", "Latensi DB stabil", "Memeriksa health-check…"];

    function simulate() {
      cpu = clamp(cpu + rand(-12, 14), 5, 99);
      ram = clamp(ram + rand(-7, 9), 20, 97);
    }
    function apply(mode) {
      setBar(cpuBar, cpuVal, cpu);
      setBar(ramBar, ramVal, ram);
      setSource("server", mode);
      const peak = Math.max(cpu, ram);
      if (peak >= 88) {
        setAgentMood("server", "alert"); setStatusDot("server", "bad");
        setBubble("#bubble-server", "Beban tinggi! Menyeimbangkan…");
        if (Math.random() < 0.7) log(A.server, `Lonjakan beban: CPU ${cpu}% / RAM ${ram}% — scaling`, true);
      } else if (peak >= 70) {
        setAgentMood("server", "busy"); setStatusDot("server", "busy");
        setBubble("#bubble-server", "Memantau beban server…");
        if (Math.random() < 0.4) log(A.server, `Beban naik: CPU ${cpu}% / RAM ${ram}%`);
      } else {
        setAgentMood("server", "ok"); setStatusDot("server", "ok");
        setBubble("#bubble-server", pick(okMsgs));
        if (Math.random() < 0.35) log(A.server, pick(okMsgs));
      }
    }
    async function step() {
      if (url) {
        try {
          const d = await fetchJSON(url);
          cpu = clamp(Math.round(Number(d.cpu)), 0, 100);
          ram = clamp(Math.round(Number(d.ram)), 0, 100);
          return apply("live");
        } catch (e) {
          log(A.server, `Gagal ambil metrik asli (${e.message}) — pakai simulasi`, true);
          simulate(); return apply("err");
        }
      }
      simulate(); apply("sim");
    }
    runLoop(step, POLL.server || 3200);
  })();

  /* ================================================================
     AGENT 2 — Pemeriksa Update (endpoint: { current, latest })
     ================================================================ */
  (() => {
    const ring = $("#update-ring");
    const pctEl = $("#update-pct");
    const nowEl = $("#version-now");
    const nextEl = $("#version-next");
    const url = EP.update;
    const CIRC = 2 * Math.PI * 52;
    ring.style.strokeDasharray = CIRC.toFixed(1);

    let ver = [1, 0, 0];
    let pct = 0;
    let phase = "scan"; // scan -> download -> install -> idle

    const verStr = (v) => `v${v[0]}.${v[1]}.${v[2]}`;
    function render() {
      ring.style.strokeDashoffset = (CIRC * (1 - pct / 100)).toFixed(1);
      pctEl.textContent = Math.round(pct);
    }
    nowEl.textContent = verStr(ver);
    nextEl.textContent = verStr([ver[0], ver[1], ver[2] + 1]);

    // --- mode LIVE ---
    async function stepLive() {
      const d = await fetchJSON(url);
      const cur = String(d.current || "?");
      const lat = String(d.latest || cur);
      nowEl.textContent = cur; nextEl.textContent = lat;
      setSource("update", "live");
      if (cur === lat) {
        pct = 100; render();
        setAgentMood("update", "ok"); setStatusDot("update", "ok");
        setBubble("#bubble-update", "Sistem sudah versi terbaru ✔");
        if (Math.random() < 0.3) log(A.update, `Versi terkini: ${cur}`);
      } else {
        pct = clamp(pct + rand(6, 16), 0, 96); render();
        setAgentMood("update", "busy"); setStatusDot("update", "busy");
        setBubble("#bubble-update", `Pembaruan tersedia: ${lat}`);
        if (Math.random() < 0.4) log(A.update, `Pembaruan tersedia ${cur} → ${lat}`);
      }
    }

    // --- mode SIMULASI ---
    function bumpVer() { if (Math.random() < 0.15) { ver[1]++; ver[2] = 0; } else ver[2]++; }
    function stepSim(mode) {
      setSource("update", mode);
      if (phase === "idle") {
        setBubble("#bubble-update", "Sistem sudah versi terbaru ✔");
        setStatusDot("update", "ok"); setAgentMood("update", "ok");
        if (Math.random() < 0.5) { phase = "scan"; pct = 0; }
        return;
      }
      setAgentMood("update", "busy"); setStatusDot("update", "busy");
      pct = clamp(pct + rand(8, 22), 0, 100); render();
      if (phase === "scan") {
        setBubble("#bubble-update", "Mencari pembaruan…");
        if (pct >= 100) { phase = "download"; pct = 0; log(A.update, `Pembaruan ditemukan: ${nextEl.textContent}`); }
      } else if (phase === "download") {
        setBubble("#bubble-update", `Mengunduh ${nextEl.textContent}…`);
        if (pct >= 100) { phase = "install"; pct = 0; log(A.update, "Unduhan selesai, memverifikasi paket…"); }
      } else if (phase === "install") {
        setBubble("#bubble-update", "Memasang pembaruan…");
        if (pct >= 100) {
          const old = verStr(ver); bumpVer();
          nowEl.textContent = verStr(ver);
          nextEl.textContent = verStr([ver[0], ver[1], ver[2] + 1]);
          log(A.update, `Berhasil diperbarui ${old} → ${verStr(ver)} ✔`);
          phase = "idle"; pct = 0;
        }
      }
    }

    async function step() {
      if (url) {
        try { return await stepLive(); }
        catch (e) { log(A.update, `Gagal cek versi asli (${e.message}) — simulasi`, true); return stepSim("err"); }
      }
      stepSim("sim");
    }
    render();
    runLoop(step, POLL.update || 1600);
  })();

  /* ================================================================
     AGENT 3 — Pemantau Status (services: [{ name, url }])
     URL diisi -> ping nyata. URL null -> simulasi per-layanan.
     ================================================================ */
  (() => {
    const listEl = $("#service-list");
    const defaults = [
      { name: "api.webapp", url: null }, { name: "web-frontend", url: null },
      { name: "database", url: null }, { name: "cdn-assets", url: null },
    ];
    const src = (CFG.services && CFG.services.length) ? CFG.services : defaults;
    const services = src.map((s) => ({ name: s.name, url: s.url || null, online: true, ping: rand(20, 60), prev: true }));
    const anyReal = services.some((s) => s.url);

    function render() {
      listEl.innerHTML = "";
      for (const s of services) {
        const li = document.createElement("li");
        li.innerHTML =
          `<span class="status-dot" data-state="${s.online ? "ok" : "bad"}"></span>` +
          `<span class="name"></span>` +
          `<span class="ping">${s.online ? s.ping + " ms" : "—"}</span>` +
          `<span class="tag ${s.online ? "online" : "offline"}">${s.online ? "ONLINE" : "OFFLINE"}</span>`;
        li.querySelector(".name").textContent = s.name;
        listEl.appendChild(li);
      }
    }

    async function probe(s) {
      if (s.url) {
        try { s.ping = await pingURL(s.url); s.online = true; }
        catch (e) { s.online = false; }
      } else {
        if (s.online) {
          if (Math.random() < 0.06) s.online = false;
          else s.ping = clamp(s.ping + rand(-12, 14), 8, 240);
        } else if (Math.random() < 0.4) { s.online = true; s.ping = rand(20, 80); }
      }
    }

    async function step() {
      await Promise.all(services.map(probe));
      let anyOffline = false;
      for (const s of services) {
        if (!s.online) anyOffline = true;
        if (s.online !== s.prev) {
          if (s.online) log(A.status, `${s.name} kembali ONLINE (${s.ping} ms) ✔`);
          else log(A.status, `${s.name} TIDAK MERESPON — OFFLINE`, true);
          s.prev = s.online;
        } else if (s.online && s.ping > 180 && Math.random() < 0.3) {
          log(A.status, `${s.name} latensi tinggi ${s.ping} ms`);
        }
      }
      render();
      setSource("status", anyReal ? "live" : "sim");
      if (anyOffline) {
        setAgentMood("status", "alert"); setStatusDot("status", "bad");
        setBubble("#bubble-status", "Ada layanan offline! Cek ulang…");
      } else {
        setAgentMood("status", "ok"); setStatusDot("status", "ok");
        setBubble("#bubble-status", "Semua layanan online ✔");
        if (Math.random() < 0.25) log(A.status, "Semua layanan merespon normal");
      }
    }
    render();
    runLoop(step, POLL.status || 2800);
  })();

  /* ================================================================
     AGENT 4 — Petugas Backup (endpoint: { percent, target })
     ================================================================ */
  (() => {
    const files = Array.from(document.querySelectorAll("#backup-files .file"));
    const bar = $("#backup-bar"), val = $("#backup-val");
    const url = EP.backup;
    let idx = 0, pct = 0;
    const targets = ["database", "uploads", "config", "logs", "media", "secrets"];

    function paint(target) {
      setBar(bar, val, pct);
      const filled = Math.round((pct / 100) * files.length);
      files.forEach((f, i) => f.classList.toggle("done", i < filled));
      setAgentMood("backup", pct >= 100 ? "ok" : "busy");
      setStatusDot("backup", pct >= 100 ? "ok" : "busy");
      setBubble("#bubble-backup", pct >= 100 ? "Cadangan tersimpan ✔" : `Mencadangkan /${target}…`);
    }

    async function step() {
      if (url) {
        try {
          const d = await fetchJSON(url);
          pct = clamp(Math.round(Number(d.percent)), 0, 100);
          const target = d.target || targets[idx % targets.length];
          setSource("backup", "live");
          paint(target);
          if (pct >= 100 && Math.random() < 0.5) log(A.backup, `Cadangan /${target} selesai ✔`);
          return;
        } catch (e) {
          log(A.backup, `Gagal ambil status backup (${e.message}) — simulasi`, true);
          setSource("backup", "err");
        }
      } else {
        setSource("backup", "sim");
      }
      // simulasi
      pct = clamp(pct + rand(10, 24), 0, 100);
      const target = targets[idx % targets.length];
      paint(target);
      if (pct >= 100) {
        log(A.backup, `Cadangan /${target} selesai ✔`);
        idx++; pct = 0;
        files.forEach((f) => f.classList.remove("done"));
      }
    }
    runLoop(step, POLL.backup || 1900);
  })();

  /* ================================================================
     AGENT 5 — Penjaga Keamanan
     endpoint: { blocked, activeThreats, lastScan }
     ================================================================ */
  (() => {
    const station = document.querySelector('.furniture[data-agent="security"]');
    const blockedEl = $("#sec-blocked"), activeEl = $("#sec-active");
    const url = EP.security;
    let blocked = rand(120, 320), active = 0;
    const calm = ["Pemindaian rutin selesai", "Firewall aktif ✔", "Tidak ada anomali", "Sertifikat TLS valid", "Memeriksa log akses…"];

    function apply(mode) {
      blockedEl.textContent = blocked;
      activeEl.textContent = active;
      setSource("security", mode);
      if (active > 0) {
        station.dataset.alert = "1";
        setAgentMood("security", "alert"); setStatusDot("security", "bad");
        setBubble("#bubble-security", "Ancaman terdeteksi! Memblokir…");
      } else {
        station.dataset.alert = "0";
        setAgentMood("security", "busy"); setStatusDot("security", "ok");
        setBubble("#bubble-security", "Memindai ancaman…");
      }
    }
    function simulate() {
      if (active > 0) { blocked++; active--; log(A.security, `Ancaman diblokir ✔ (total ${blocked})`); }
      else if (Math.random() < 0.16) { active = 1; log(A.security, "⚠ Aktivitas mencurigakan terdeteksi", true); }
      else if (Math.random() < 0.3) { log(A.security, pick(calm)); }
    }
    async function step() {
      if (url) {
        try {
          const d = await fetchJSON(url);
          blocked = Number(d.blocked) || blocked;
          active = Number(d.activeThreats) || 0;
          apply("live");
          if (active > 0 && Math.random() < 0.6) log(A.security, `${active} ancaman aktif terdeteksi`, true);
          return;
        } catch (e) {
          log(A.security, `Gagal ambil status keamanan (${e.message}) — simulasi`, true);
          simulate(); return apply("err");
        }
      }
      simulate(); apply("sim");
    }
    runLoop(step, POLL.security || 3000);
  })();

  /* ================================================================
     AGENT 6 — Pembersih Cache
     endpoint: { cacheMB, filesCleaned, hitRate }
     ================================================================ */
  (() => {
    const blks = Array.from(document.querySelectorAll("#cache-blocks .blk"));
    const sizeEl = $("#cache-size"), hitEl = $("#cache-hit");
    const url = EP.cache;
    const MAXMB = 120;
    let cacheMB = rand(40, 80), hit = rand(85, 98);

    function apply(mode) {
      sizeEl.textContent = Math.round(cacheMB);
      hitEl.textContent = Math.round(hit) + "%";
      const activeCount = Math.round(clamp(cacheMB / MAXMB, 0, 1) * blks.length);
      blks.forEach((b, i) => b.classList.toggle("swept", i >= activeCount));
      setSource("cache", mode);
      const cleaning = cacheMB > MAXMB - 10;
      setAgentMood("cache", cleaning ? "busy" : "ok");
      setStatusDot("cache", cleaning ? "busy" : "ok");
      setBubble("#bubble-cache", cleaning ? "Membersihkan cache…" : "Cache optimal ✔");
    }
    function simulate() {
      if (cacheMB > MAXMB - 5) {
        const freed = rand(55, 90);
        log(A.cache, `Cache penuh ${Math.round(cacheMB)} MB — membersihkan…`);
        cacheMB = clamp(cacheMB - freed, 12, 200);
        log(A.cache, `Cache dibersihkan, sisa ${Math.round(cacheMB)} MB ✔`);
      } else {
        cacheMB += rand(4, 12);
        if (Math.random() < 0.25) log(A.cache, `Cache bertambah → ${Math.round(cacheMB)} MB`);
      }
      hit = clamp(hit + rand(-2, 2), 70, 99);
    }
    async function step() {
      if (url) {
        try {
          const d = await fetchJSON(url);
          cacheMB = Number(d.cacheMB);
          hit = Number(d.hitRate);
          apply("live");
          if (d.filesCleaned && Math.random() < 0.5) log(A.cache, `${d.filesCleaned} file cache dibersihkan ✔`);
          return;
        } catch (e) {
          log(A.cache, `Gagal ambil status cache (${e.message}) — simulasi`, true);
          simulate(); return apply("err");
        }
      }
      simulate(); apply("sim");
    }
    runLoop(step, POLL.cache || 2200);
  })();

  /* ---------- Sapaan awal ---------- */
  log(A.server, "Sistem dimulai — semua agent online");
  log(A.status, "Memulai pemantauan layanan");
  log(A.update, "Penjadwalan pengecekan pembaruan");
  log(A.backup, "Inisialisasi jadwal cadangan");
  log(A.security, "Memuat aturan firewall & pemindai");
  log(A.cache, "Menyiapkan pembersih cache terjadwal");
})();
