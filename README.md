# Ruang Kendali Agent 🤖

Web animasi yang menampilkan beberapa **agent** (karakter robot) yang seolah-olah
sedang bekerja, masing-masing dengan tugasnya sendiri. Cocok dijadikan halaman
status / dashboard dekoratif untuk web app kamu.

## Para Agent

| Agent | Tugas |
|-------|-------|
| 🛡️ **Penjaga Server** | Memantau beban server (CPU/RAM), menyalakan alarm saat beban tinggi |
| 🔄 **Pemeriksa Update** | Mencari, mengunduh, dan memasang pembaruan, lalu menaikkan nomor versi |
| 📡 **Pemantau Status** | Cek layanan **online/offline** beserta nilai ping |
| 💾 **Petugas Backup** | Mencadangkan folder satu per satu dengan progress bar |

Di bawahnya ada **Log Aktivitas Langsung** yang terus berjalan, plus jam & uptime
sistem di header.

## Cara menjalankan

Tidak butuh build atau dependensi apa pun — cukup buka file-nya:

```bash
# langsung buka di browser
open index.html        # macOS
xdg-open index.html    # Linux

# atau lewat server statis sederhana
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

## Catatan

Semua angka (CPU, RAM, ping, versi, status online/offline) **disimulasikan secara
acak di browser** murni untuk visualisasi — tidak terhubung ke server sungguhan.
Kalau nanti mau dihubungkan ke data nyata, tinggal ganti bagian simulasi di
`app.js` dengan pemanggilan API/`fetch` kamu.

## Struktur

```
index.html   — struktur halaman & para agent
styles.css   — gaya & semua animasi
app.js       — logika simulasi (jam, metrik, log)
```

Animasi otomatis dimatikan untuk pengguna yang mengaktifkan
`prefers-reduced-motion`.
