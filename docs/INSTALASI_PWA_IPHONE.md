# WA Status HD Pro — Dokumentasi Teknis & Instalasi PWA iPhone

## 1. Ringkasan Arsitektur
WA Status HD Pro adalah Progressive Web App (PWA) yang memproses video **100% secara lokal di perangkat pengguna** tanpa mengunggah file video ke server mana pun.

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4.
- **Local Video Engine**: `@ffmpeg/ffmpeg` WebAssembly (`/public/ffmpeg/ffmpeg-core.js` & `ffmpeg-core.wasm`) untuk optimasi H.264/AAC lokal, plus fallback otomatis ke **Original Preserve Mode** (tanpa re-encoding).
- **PWA & Offline Shell**: `vite-plugin-pwa` menghasilkan `manifest.webmanifest` dan Service Worker Workbox (`sw.js`) yang meng-cache app shell dan file inti FFmpeg WASM (`CacheFirst`) untuk penggunaan offline.
- **Penyimpanan Lokal**: IndexedDB (`wa-status-hd-pro-db`) hanya menyimpan metadata riwayat proses apabila diizinkan oleh pengguna di halaman Pengaturan.

## 2. Syarat Deployment Produksi (Wajib HTTPS)
Agar PWA dapat diinstal di iPhone Safari (`Add to Home Screen`) dan Web Share API (`navigator.share({ files })`) berfungsi:
1. Sajikan aplikasi melalui **HTTPS** yang valid.
2. Jalankan build produksi:
   ```bash
   npm run build
   ```
3. Pastikan file berikut tersedia di folder hasil build (`dist/`):
   - `manifest.webmanifest`
   - `sw.js`
   - `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`, `apple-touch-icon.png`, `icon.svg`
   - `ffmpeg/ffmpeg-core.js` & `ffmpeg/ffmpeg-core.wasm`

## 3. Cara Instal di iPhone Safari (iOS 17+)
1. Buka URL HTTPS aplikasi menggunakan **Safari** di iPhone.
2. Ketuk tombol **Bagikan (Share)** di bilah bawah Safari.
3. Pilih **Tambah ke Layar Utama (Add to Home Screen)**.
4. Ketuk **Tambah (Add)**.
5. Buka aplikasi dari ikon **WA HD Pro** di Layar Utama untuk mode **Standalone** tanpa address bar Safari.

## 4. Cara Menyimpan Video MP4 ke Galeri Foto iPhone
1. Setelah optimasi selesai (atau pada file asli), ketuk **Simpan Video (MP4)**.
2. Konfirmasi **Unduh (Download)** pada Safari.
3. Buka ikon panah unduhan Safari atau buka aplikasi **File (Files)** &rarr; **Unduhan**.
4. Ketuk file `.mp4` &rarr; ketuk ikon **Bagikan** &rarr; pilih **Simpan Video (Save Video)** agar tersimpan ke aplikasi **Foto (Photos)**.
