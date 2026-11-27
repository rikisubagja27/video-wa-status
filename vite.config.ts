import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type ViteDevServer} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const ROOT_DIR = import.meta.dirname;
const FFMPEG_ESM_DIR = path.resolve(ROOT_DIR, 'node_modules/@ffmpeg/core/dist/esm');
const CHUNK_COUNT = 2; // Splits 32.2 MB wasm into two ~16.1 MB files (< 25 MiB Cloudflare Pages limit)

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.webmanifest',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'WA Status HD Pro',
          short_name: 'WA HD Pro',
          description:
            'Pengolah dan pengoptimal video lokal berteknologi PWA untuk mempertahankan kualitas HD pada WhatsApp Status.',
          theme_color: '#101820',
          background_color: '#101820',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          lang: 'id',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/ffmpeg/**', '**/_headers'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              urlPattern: /\/ffmpeg\/.*\.(js|wasm|part\d+)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ffmpeg-wasm-cache',
                expiration: {
                  maxEntries: 6,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      // Serves FFmpeg core in dev and splits ffmpeg-core.wasm into <25 MiB chunks in dist/ for Cloudflare Pages
      {
        name: 'ffmpeg-cloudflare-chunks',
        configureServer(server: ViteDevServer): void {
          server.middlewares.use('/ffmpeg', (req, res, next) => {
            const urlPath = (req.url || '').split('?')[0];
            const jsPath = path.join(FFMPEG_ESM_DIR, 'ffmpeg-core.js');
            const wasmPath = path.join(FFMPEG_ESM_DIR, 'ffmpeg-core.wasm');

            if (urlPath === '/ffmpeg-core.js' && fs.existsSync(jsPath)) {
              res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
              fs.createReadStream(jsPath).pipe(res);
              return;
            }
            if (urlPath === '/ffmpeg-core.wasm' && fs.existsSync(wasmPath)) {
              res.setHeader('Content-Type', 'application/wasm');
              fs.createReadStream(wasmPath).pipe(res);
              return;
            }
            const partMatch = /^\/ffmpeg-core\.wasm\.part(\d+)$/.exec(urlPath);
            if (partMatch && fs.existsSync(wasmPath)) {
              const partIdx = Number(partMatch[1]);
              if (partIdx >= 0 && partIdx < CHUNK_COUNT) {
                const buf = fs.readFileSync(wasmPath);
                const chunkSize = Math.ceil(buf.length / CHUNK_COUNT);
                const start = partIdx * chunkSize;
                const end = Math.min(buf.length, start + chunkSize);
                res.setHeader('Content-Type', 'application/octet-stream');
                res.end(buf.subarray(start, end));
                return;
              }
            }
            next();
          });
        },
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(ROOT_DIR, 'dist');
          const distFfmpegDir = path.join(distDir, 'ffmpeg');
          const srcJs = path.join(FFMPEG_ESM_DIR, 'ffmpeg-core.js');
          const srcWasm = path.join(FFMPEG_ESM_DIR, 'ffmpeg-core.wasm');
          if (!fs.existsSync(distDir) || !fs.existsSync(srcJs) || !fs.existsSync(srcWasm)) {
            return;
          }
          fs.mkdirSync(distFfmpegDir, {recursive: true});
          fs.copyFileSync(srcJs, path.join(distFfmpegDir, 'ffmpeg-core.js'));

          const wasmBuffer = fs.readFileSync(srcWasm);
          const chunkSize = Math.ceil(wasmBuffer.length / CHUNK_COUNT);
          for (let i = 0; i < CHUNK_COUNT; i++) {
            const start = i * chunkSize;
            const end = Math.min(wasmBuffer.length, start + chunkSize);
            fs.writeFileSync(
              path.join(distFfmpegDir, `ffmpeg-core.wasm.part${i}`),
              wasmBuffer.subarray(start, end),
            );
          }
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(ROOT_DIR, 'dist');
          const srcAssets = path.resolve(ROOT_DIR, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    resolve: {
      alias: {
        '@': path.resolve(ROOT_DIR, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
