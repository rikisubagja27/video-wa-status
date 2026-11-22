# WA Status HD Pro — Dokumentasi Teknis, Cloudflare Pages & Instalasi PWA iPhone

## 1. Ringkasan Arsitektur
WA Status HD Pro adalah Progressive Web App (PWA) yang memproses video **100% secara lokal di perangkat pengguna** tanpa mengunggah file video ke server mana pun.

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4.
- **Local Video Engine**: `@ffmpeg/ffmpeg` WebAssembly (`ffmpeg-core.js` + `ffmpeg-core.wasm.part0` & `.part1`) untuk optimasi H.264/AAC lokal, plus fallback otomatis ke **Original Preserve Mode** (tanpa re-encoding).
- **PWA & Offline Shell**: `vite-plugin-pwa` menghasilkan `manifest.webmanifest` dan Service Worker Workbox (`sw.js`) yang meng-cache app shell dan chunk FFmpeg WASM (`CacheFirst`) untuk penggunaan offline.
- **Penyimpanan Lokal**: IndexedDB (`wa-status-hd-pro-db`) hanya menyimpan metadata riwayat proses apabila diizinkan oleh pengguna di halaman Pengaturan.

## 2. Deployment GitHub ke Cloudflare Pages (HTTPS)
Proyek ini sudah dikonfigurasi agar lolos batasan **25 MiB per file** dan versi Node.js di Cloudflare Pages:

1. **Kompatibilitas Batas 25 MiB Cloudflare Pages**:
   - File `ffmpeg-core.wasm` (~32.2 MB) tidak disimpan di `public/`, melainkan dipecah otomatis saat `npm run build` menjadi dua file ~16.1 MB (`dist/ffmpeg/ffmpeg-core.wasm.part0` dan `part1`), lalu digabungkan kembali di memori browser saat runtime.
2. **Versi Node.js**:
   - File `.node-version` dan `.nvmrc` disetel ke `22` agar Cloudflare Pages memakai Node 22 (syarat Vite 8).
3. **Pengaturan Build di Dashboard Cloudflare Pages**:
   - **Framework preset**: `Vite` (atau `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Environment variables (opsional)**: `NODE_VERSION = 22`
4. **Header PWA**:
   - File `public/_headers` otomatis mengatur `Content-Type: application/manifest+json` untuk `/manifest.webmanifest` dan `Cache-Control: no-cache` untuk `/sw.js`.

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
