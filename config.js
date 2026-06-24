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
     1) PEMANTAU STATUS (online/offline) — NYATA
     - "url"  : alamat app. Dicek pakai fetch(no-cors); selama bisa
                diakses -> ONLINE + diukur ping. Tidak butuh apa pun.
     - "api"  : (opsional) URL endpoint JSON /api/status milik app.
                Jika diisi & aktif, dashboard menampilkan data NYATA
                (versi, region, memori, dll). Lihat folder
                contoh-endpoint/ untuk cara memasangnya. Bila kosong
                / belum ada, otomatis pakai cek ping biasa.
     -------------------------------------------------------------- */
  services: [
    { name: "Kwitansi Rustika", url: "https://kwitansi-rustika.vercel.app/",
      api: null /* "https://kwitansi-rustika.vercel.app/api/status" */ },
    { name: "AI Agen",          url: "https://ai-agen-1t5u.vercel.app/",
      api: null /* "https://ai-agen-1t5u.vercel.app/api/status" */ },
    { name: "Rustika Client",   url: "https://rustika-client.vercel.app/",
      api: null /* "https://rustika-client.vercel.app/api/status" */ },
    { name: "Laporan BBG",      url: "https://laporan-bbg.vercel.app/",
      api: null /* "https://laporan-bbg.vercel.app/api/status" */ },
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
