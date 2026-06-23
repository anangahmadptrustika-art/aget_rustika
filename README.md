# Ruang Kendali Agent 🤖

Web animasi yang menampilkan beberapa **agent** (karakter robot) yang seolah-olah
sedang bekerja, masing-masing dengan tugasnya sendiri. Bisa jalan dengan data
**simulasi** (langsung hidup tanpa setup) atau dihubungkan ke **data nyata** web
app kamu lewat `fetch`.

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

## Struktur

```
index.html   — struktur halaman & para agent
styles.css   — gaya & semua animasi
config.js    — KONFIGURASI: hubungkan ke data nyata (edit di sini)
app.js       — logika: fetch data asli + fallback simulasi + log
```

Animasi otomatis dimatikan untuk pengguna yang mengaktifkan
`prefers-reduced-motion`.
