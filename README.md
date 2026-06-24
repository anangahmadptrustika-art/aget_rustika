# Rustika · Ops Center 3D 🤖

Kantor **isometrik** (gaya "The Sims") berisi 6 **agent** AI berwarna-warni yang
**berjalan & bekerja** di sebuah ruangan: menjaga server, cek update, memantau
online/offline, backup, keamanan, dan cache. Digambar dengan **Canvas 2D** (render
di CPU) sehingga **jalan di perangkat apa pun — tidak butuh WebGL/GPU** (aman di
VM/remote desktop). Bisa **digeser (drag)** dan **zoom (scroll)**. Panel kanan
menampilkan metrik, status layanan, dan log aktivitas. Bisa jalan dengan data
**simulasi** (langsung hidup tanpa setup) atau dihubungkan ke **data nyata** web
app kamu lewat `fetch`.

> Tanpa dependensi/library eksternal — file statis murni, aman di Vercel/hosting
> statik mana pun, dan tidak perlu CDN.

## Para Agent

| Agent | Tugas |
|-------|-------|
| 🛡️ **Penjaga Server** | Memantau beban server (CPU/RAM), menyalakan alarm saat beban tinggi |
| 🔄 **Pemeriksa Update** | Mencari, mengunduh, dan memasang pembaruan, lalu menaikkan nomor versi |
| 📡 **Pemantau Status** | Cek layanan **online/offline** beserta nilai ping |
| 💾 **Petugas Backup** | Mencadangkan folder satu per satu dengan progress bar |
| 🔒 **Penjaga Keamanan** | Memindai ancaman, menghitung serangan yang diblokir, alarm saat ada ancaman |
| 🧹 **Pembersih Cache** | Memantau ukuran cache & hit rate, membersihkan saat penuh |

Di bawahnya ada **Log Aktivitas Langsung** yang terus berjalan, plus jam & uptime
sistem di header. Tiap agent punya badge sumber data: **LIVE** (data asli),
**SIM** (simulasi), atau **ERR** (gagal ambil data, sementara pakai simulasi).

## Cara menjalankan

Tidak butuh build atau dependensi apa pun:

```bash
# lewat server statis sederhana (disarankan, agar fetch berfungsi)
python3 -m http.server 8000
# lalu buka http://localhost:8000

# atau langsung buka file
xdg-open index.html    # Linux
open index.html        # macOS
```

## Menghubungkan ke data NYATA web app kamu

Semua sumber data diatur di **`config.js`** — tidak perlu menyentuh `app.js`.

- Endpoint **diisi**  → agent mengambil data asli via `fetch` (badge **LIVE**)
- Endpoint **`null`** → agent jalan dengan simulasi acak (badge **SIM**)
- `fetch` **gagal**   → otomatis balik ke simulasi sementara (badge **ERR**)

### 1. Pemantau online/offline (paling gampang)

Cukup isi daftar URL — **tidak butuh CORS atau endpoint khusus**. Cek memakai
`fetch(mode: "no-cors")`, jadi selama situsnya bisa dijangkau dianggap ONLINE
dan latensinya diukur:

```js
services: [
  { name: "api.webapp",   url: "https://api.webappku.com/health" },
  { name: "web-frontend", url: "https://webappku.com" },
],
```

### 2. Endpoint JSON untuk agent lain

Ini API milik kamu sendiri yang mengembalikan JSON (**harus mengizinkan CORS**
dari halaman ini). Bentuk JSON yang diharapkan:

| Agent | Field `endpoints` | Bentuk JSON yang dikembalikan |
|-------|-------------------|-------------------------------|
| Penjaga Server   | `server`   | `{ "cpu": 0-100, "ram": 0-100 }` |
| Pemeriksa Update | `update`   | `{ "current": "v1.2.3", "latest": "v1.2.4" }` |
| Petugas Backup   | `backup`   | `{ "percent": 0-100, "target": "database" }` |
| Penjaga Keamanan | `security` | `{ "blocked": int, "activeThreats": int, "lastScan": "..." }` |
| Pembersih Cache  | `cache`    | `{ "cacheMB": number, "filesCleaned": int, "hitRate": 0-100 }` |

Contoh:

```js
endpoints: {
  server:   "https://api.webappku.com/metrics",
  update:   "https://api.webappku.com/version",
  backup:   null,   // biarkan simulasi
  security: "https://api.webappku.com/security",
  cache:    null,
},
```

Selang polling tiap agent dan timeout fetch juga bisa diatur di `config.js`
(`pollIntervalMs`, `fetchTimeoutMs`).

## Data NYATA per app via `/api/status`

Pemantau Status sudah **nyata** (ping online/offline + latensi). Untuk data lebih
dalam (versi yang ter-deploy, region, memori, uptime), tambahkan endpoint JSON di
tiap app Vercel kamu:

1. Salin `contoh-endpoint/api/status.js` ke app kamu pada path `api/status.js`, deploy ulang.
2. Di `config.js`, isi `api` untuk app itu: `api: "https://<app>.vercel.app/api/status"`.
3. Dashboard otomatis menampilkan badge **API** + data nyata app tsb.

Selama `api` belum diisi/endpoint belum ada, dashboard tetap jalan dengan cek ping
biasa. Panduan lengkap (termasuk Next.js) ada di `contoh-endpoint/README.md`.

## Struktur

```
index.html   — HUD overlay (panel, kartu metrik, gelembung) + mount canvas
styles.css   — tema terang HUD + gelembung + panel
scene.js     — scene isometrik Canvas 2D: ruangan, perabot, & karakter agent berjalan
config.js    — KONFIGURASI: hubungkan ke data nyata (edit di sini)
app.js       — logika data: fetch asli + fallback simulasi + log (mengisi window.AGENT_STATE)
```

`scene.js` membaca `window.AGENT_STATE` (diisi `app.js`) untuk mengatur teks
gelembung dan ekspresi/mood tiap karakter. Tiap agent berjalan ke area kerjanya →
bekerja sebentar → berkeliling → kembali, terus-menerus.

**Kontrol:** seret untuk menggeser, scroll untuk zoom.

Animasi otomatis dimatikan untuk pengguna yang mengaktifkan
`prefers-reduced-motion`.
