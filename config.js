/* ====================================================================
   KONFIGURASI — hubungkan dashboard ke data web app kamu yang ASLI.
   --------------------------------------------------------------------
   Cara pakai:
   - Isi URL/endpoint di bawah dengan milik web app kamu.
   - Yang DIISI  -> agent mengambil data ASLI lewat fetch  (badge "LIVE")
   - Yang null    -> agent jalan dengan data simulasi acak  (badge "SIM")
   - Kalau fetch gagal -> otomatis balik ke simulasi sementara (badge "ERR")

   Tidak perlu build apa pun — cukup edit file ini lalu refresh browser.
   ==================================================================== */

window.AGENT_CONFIG = {

  /* --------------------------------------------------------------
     1) PEMANTAU STATUS (online/offline)
     Cek reachability tiap web app pakai fetch(no-cors).
     Cukup isi { name, url }. Tidak butuh CORS / endpoint khusus —
     selama situsnya bisa diakses, dianggap ONLINE + diukur ping-nya.
     Kosongkan "url" kalau mau layanan itu disimulasikan saja.
     -------------------------------------------------------------- */
  services: [
    { name: "api.webapp",   url: null /* "https://api.webappku.com/health" */ },
    { name: "web-frontend", url: null /* "https://webappku.com" */ },
    { name: "database",     url: null /* "https://db.webappku.com" */ },
    { name: "cdn-assets",   url: null /* "https://cdn.webappku.com" */ },
  ],

  /* --------------------------------------------------------------
     2) ENDPOINT JSON untuk agent lain.
     Ini API milik kamu sendiri yang mengembalikan JSON (harus
     mengizinkan CORS dari halaman ini). Bentuk JSON yang diharapkan
     ada di komentar masing-masing. Set null = simulasi.
     -------------------------------------------------------------- */
  endpoints: {

    // Penjaga Server  ->  { "cpu": 0-100, "ram": 0-100 }
    server: null,    // "https://api.webappku.com/metrics"

    // Pemeriksa Update -> { "current": "v1.2.3", "latest": "v1.2.4" }
    update: null,    // "https://api.webappku.com/version"

    // Petugas Backup  ->  { "percent": 0-100, "target": "database" }
    backup: null,    // "https://api.webappku.com/backup/status"

    // Penjaga Keamanan -> { "blocked": int, "activeThreats": int, "lastScan": "ISO/teks" }
    security: null,  // "https://api.webappku.com/security"

    // Pembersih Cache  -> { "cacheMB": number, "filesCleaned": int, "hitRate": 0-100 }
    cache: null,     // "https://api.webappku.com/cache/status"
  },

  /* Selang waktu polling tiap agent (milidetik) */
  pollIntervalMs: {
    server:   3200,
    update:   1600,
    status:   2800,
    backup:   1900,
    security: 3000,
    cache:    2200,
  },

  /* Timeout untuk tiap request fetch (milidetik) */
  fetchTimeoutMs: 4000,
};
