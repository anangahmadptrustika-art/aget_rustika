# API Status untuk tiap app (data NYATA)

Tambahkan satu file ini ke **setiap** web app Vercel kamu supaya dashboard
bisa menampilkan data **nyata** (versi yang ter-deploy, region, memori, uptime,
dan data milikmu sendiri).

## Langkah

1. Di repo app kamu, buat file: **`api/status.js`** (salin dari `contoh-endpoint/api/status.js`).
   - Tidak punya folder `api/`? Buat saja di root project. Vercel otomatis
     menjadikannya serverless function.
2. **Commit & deploy** ulang ke Vercel.
3. Buka di browser untuk memastikan muncul JSON:
   `https://<app-kamu>.vercel.app/api/status`
4. Di **`config.js`** dashboard, isi field `api` untuk app tersebut, contoh:

   ```js
   services: [
     { name: "Kwitansi Rustika", url: "https://kwitansi-rustika.vercel.app/",
       api: "https://kwitansi-rustika.vercel.app/api/status" },
     // ...dst
   ],
   ```

5. Refresh dashboard → app itu kini berlabel **API** dan menampilkan
   versi/region/memori nyata. (Selama `api` belum diisi / endpoint belum ada,
   dashboard tetap jalan dengan cek ping biasa.)

## Contoh JSON yang dikembalikan

```json
{
  "status": "ok",
  "version": "main",
  "commit": "a1b2c3d",
  "region": "sin1",
  "node": "v20.x",
  "memoryMB": 71,
  "uptimeSec": 1234,
  "time": "2026-06-24T09:40:00.000Z"
}
```

## Mau data lebih spesifik?

Di dalam `api/status.js`, tambahkan field apa pun yang app-mu punya (jumlah user
online, status backup, ukuran cache, dll) — ambil dari database/penyimpanan
app, lalu kembalikan di JSON. Dashboard bisa diarahkan menampilkannya.

## Khusus Next.js App Router

Kalau app pakai **Next.js App Router**, buat `app/api/status/route.js`:

```js
export const dynamic = "force-dynamic";

export async function GET() {
  const mem = process.memoryUsage();
  return new Response(JSON.stringify({
    status: "ok",
    version: process.env.VERCEL_GIT_COMMIT_REF || "main",
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7),
    region: process.env.VERCEL_REGION || "local",
    node: process.version,
    memoryMB: Math.round(mem.rss / 1048576),
    uptimeSec: Math.round(process.uptime()),
    time: new Date().toISOString(),
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
```
