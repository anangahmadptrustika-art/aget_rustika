// ====================================================================
// API STATUS — pasang di TIAP web app Vercel kamu agar dashboard bisa
// menampilkan data NYATA (versi, region, memori, uptime, dll).
//
// Cara pasang:
//   1. Salin file ini ke app kamu pada path:  api/status.js
//      (buat folder "api" di root project bila belum ada)
//   2. Commit & deploy ulang ke Vercel.
//   3. Cek di browser:  https://<app-kamu>.vercel.app/api/status
//      Harus muncul JSON.
//   4. Di dashboard (config.js), isi "api" untuk app tsb dengan URL itu.
//
// CORS sudah diaktifkan (Access-Control-Allow-Origin: *) supaya dashboard
// di domain berbeda boleh membacanya.
//
// Catatan framework:
//   - App statis / Vite / CRA  -> pakai file ini apa adanya (api/status.js)
//   - Next.js (Pages Router)   -> taruh di  pages/api/status.js  (sama)
//   - Next.js (App Router)     -> lihat versi route.js di README
// ====================================================================

export default function handler(req, res) {
  // Izinkan dashboard (domain lain) membaca data ini.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const mem = process.memoryUsage();

  res.status(200).json({
    status: "ok",
    app: process.env.VERCEL_PROJECT_PRODUCTION_URL || req.headers.host || "",
    version: process.env.VERCEL_GIT_COMMIT_REF || "main",          // branch produksi
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7), // SHA commit ter-deploy
    region: process.env.VERCEL_REGION || "local",                  // region server Vercel
    node: process.version,                                         // versi Node
    memoryMB: Math.round(mem.rss / 1048576),                       // memori instance fungsi
    uptimeSec: Math.round(process.uptime()),                       // umur instance (detik)
    time: new Date().toISOString(),                                // waktu server sekarang

    // --- (opsional) isi data NYATA milik app-mu sendiri di sini ---
    // misal ambil dari database / penyimpanan app:
    // users_online: await hitungUserOnline(),
    // backup_percent: 100,
    // cache_mb: 42,
  });
}
