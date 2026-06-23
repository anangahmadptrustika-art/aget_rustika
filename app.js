/* ====================================================================
   Ruang Kendali Agent — simulasi animasi di browser.
   Semua data di sini disimulasikan (acak), murni untuk visualisasi.
   ==================================================================== */

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
    server: { key: "server", label: "Penjaga Server" },
    update: { key: "update", label: "Pemeriksa Update" },
    status: { key: "status", label: "Pemantau Status" },
    backup: { key: "backup", label: "Petugas Backup" },
  };

  function setAgentMood(agentSel, mood) {
    const el = document.querySelector(`.station[data-agent="${agentSel}"] .agent`);
    if (el) el.dataset.mood = mood;
  }
  function setStatusDot(agentSel, state) {
    const dot = document.querySelector(`.station[data-agent="${agentSel}"] .status-dot`);
    if (dot) dot.dataset.state = state;
  }
  function setBubble(id, text) { const b = $(id); if (b) b.textContent = text; }

  function setBar(barEl, valEl, value) {
    value = clamp(Math.round(value), 0, 100);
    barEl.style.width = value + "%";
    barEl.classList.toggle("warn", value >= 65 && value < 85);
    barEl.classList.toggle("high", value >= 85);
    if (valEl) valEl.textContent = value + "%";
    return value;
  }

  /* ================================================================
     AGENT 1 — Penjaga Server (beban CPU/RAM)
     ================================================================ */
  (() => {
    const cpuBar = $("#cpu-bar"), cpuVal = $("#cpu-val");
    const ramBar = $("#ram-bar"), ramVal = $("#ram-val");
    let cpu = 35, ram = 48;

    const okMsgs = [
      "Semua node sehat ✔", "Beban server normal", "Tidak ada antrian menumpuk",
      "Latensi DB stabil", "Memeriksa health-check…",
    ];

    function step() {
      cpu = clamp(cpu + rand(-12, 14), 5, 99);
      ram = clamp(ram + rand(-7, 9), 20, 97);
      setBar(cpuBar, cpuVal, cpu);
      setBar(ramBar, ramVal, ram);

      const peak = Math.max(cpu, ram);
      if (peak >= 88) {
        setAgentMood("server", "alert");
        setStatusDot("server", "bad");
        setBubble("#bubble-server", "Beban tinggi! Menyeimbangkan…");
        log(A.server, `Lonjakan beban: CPU ${cpu}% / RAM ${ram}% — scaling`, true);
      } else if (peak >= 70) {
        setAgentMood("server", "busy");
        setStatusDot("server", "busy");
        setBubble("#bubble-server", "Memantau beban server…");
        if (Math.random() < 0.5) log(A.server, `Beban naik: CPU ${cpu}% / RAM ${ram}%`);
      } else {
        setAgentMood("server", "ok");
        setStatusDot("server", "ok");
        setBubble("#bubble-server", pick(okMsgs));
        if (Math.random() < 0.4) log(A.server, pick(okMsgs));
      }
    }
    step();
    setInterval(step, 3200);
  })();

  /* ================================================================
     AGENT 2 — Pemeriksa Update (progress ring + bump versi)
     ================================================================ */
  (() => {
    const ring = $("#update-ring");
    const pctEl = $("#update-pct");
    const nowEl = $("#version-now");
    const nextEl = $("#version-next");
    const CIRC = 2 * Math.PI * 52; // ~326.7
    ring.style.strokeDasharray = CIRC.toFixed(1);

    let ver = [1, 0, 0];
    let pct = 0;
    let phase = "scan"; // scan -> download -> install -> idle

    function verStr(v) { return `v${v[0]}.${v[1]}.${v[2]}`; }
    function bumpVer() {
      if (Math.random() < 0.15) { ver[1]++; ver[2] = 0; }
      else ver[2]++;
    }

    nowEl.textContent = verStr(ver);
    nextEl.textContent = verStr([ver[0], ver[1], ver[2] + 1]);

    function render() {
      ring.style.strokeDashoffset = (CIRC * (1 - pct / 100)).toFixed(1);
      pctEl.textContent = Math.round(pct);
    }

    function step() {
      if (phase === "idle") {
        setBubble("#bubble-update", "Sistem sudah versi terbaru ✔");
        setStatusDot("update", "ok");
        setAgentMood("update", "ok");
        if (Math.random() < 0.5) { phase = "scan"; pct = 0; }
        return;
      }
      setAgentMood("update", "busy");
      setStatusDot("update", "busy");
      pct = clamp(pct + rand(8, 22), 0, 100);
      render();

      if (phase === "scan") {
        setBubble("#bubble-update", "Mencari pembaruan…");
        if (pct >= 100) { phase = "download"; pct = 0; log(A.update, `Pembaruan ditemukan: ${nextEl.textContent}`); }
      } else if (phase === "download") {
        setBubble("#bubble-update", `Mengunduh ${nextEl.textContent}…`);
        if (pct >= 100) { phase = "install"; pct = 0; log(A.update, "Unduhan selesai, memverifikasi paket…"); }
      } else if (phase === "install") {
        setBubble("#bubble-update", "Memasang pembaruan…");
        if (pct >= 100) {
          const old = verStr(ver);
          bumpVer();
          nowEl.textContent = verStr(ver);
          nextEl.textContent = verStr([ver[0], ver[1], ver[2] + 1]);
          log(A.update, `Berhasil diperbarui ${old} → ${verStr(ver)} ✔`);
          phase = "idle"; pct = 0;
        }
      }
    }
    render();
    step();
    setInterval(step, 1600);
  })();

  /* ================================================================
     AGENT 3 — Pemantau Status (online/offline + ping)
     ================================================================ */
  (() => {
    const listEl = $("#service-list");
    const services = [
      { name: "api.webapp", online: true, ping: 42 },
      { name: "web-frontend", online: true, ping: 31 },
      { name: "database", online: true, ping: 12 },
      { name: "cdn-assets", online: true, ping: 58 },
    ];

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

    function step() {
      let anyOffline = false;
      for (const s of services) {
        if (s.online) {
          // sesekali sebuah layanan turun
          if (Math.random() < 0.06) {
            s.online = false;
            log(A.status, `${s.name} TIDAK MERESPON — menandai OFFLINE`, true);
          } else {
            s.ping = clamp(s.ping + rand(-12, 14), 8, 240);
            if (s.ping > 180 && Math.random() < 0.5)
              log(A.status, `${s.name} latensi tinggi ${s.ping} ms`);
          }
        } else {
          anyOffline = true;
          // coba pulih
          if (Math.random() < 0.4) {
            s.online = true;
            s.ping = rand(20, 80);
            log(A.status, `${s.name} kembali ONLINE (${s.ping} ms) ✔`);
          }
        }
      }
      render();

      if (anyOffline) {
        setAgentMood("status", "alert");
        setStatusDot("status", "bad");
        setBubble("#bubble-status", "Ada layanan offline! Cek ulang…");
      } else {
        setAgentMood("status", "ok");
        setStatusDot("status", "ok");
        setBubble("#bubble-status", "Semua layanan online ✔");
        if (Math.random() < 0.3) log(A.status, "Semua layanan merespon normal");
      }
    }
    render();
    step();
    setInterval(step, 2800);
  })();

  /* ================================================================
     AGENT 4 — Petugas Backup (isi file + progress)
     ================================================================ */
  (() => {
    const files = Array.from(document.querySelectorAll("#backup-files .file"));
    const bar = $("#backup-bar"), val = $("#backup-val");
    let idx = 0, pct = 0;

    const targets = ["database", "uploads", "config", "logs", "media", "secrets"];

    function step() {
      setAgentMood("backup", "busy");
      setStatusDot("backup", "busy");
      pct = clamp(pct + rand(10, 24), 0, 100);
      setBar(bar, val, pct);

      const filled = Math.round((pct / 100) * files.length);
      files.forEach((f, i) => f.classList.toggle("done", i < filled));
      setBubble("#bubble-backup", `Mencadangkan /${targets[idx % targets.length]}…`);

      if (pct >= 100) {
        log(A.backup, `Cadangan /${targets[idx % targets.length]} selesai ✔`);
        idx++;
        pct = 0;
        files.forEach((f) => f.classList.remove("done"));
        setStatusDot("backup", "ok");
        setAgentMood("backup", "ok");
        setBubble("#bubble-backup", "Cadangan tersimpan ✔");
      }
    }
    setBar(bar, val, 0);
    step();
    setInterval(step, 1900);
  })();

  /* ---------- Sapaan awal ---------- */
  log(A.server, "Sistem dimulai — agent online");
  log(A.status, "Memulai pemantauan layanan");
  log(A.update, "Penjadwalan pengecekan pembaruan");
  log(A.backup, "Inisialisasi jadwal cadangan");
})();
