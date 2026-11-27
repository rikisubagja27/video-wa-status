import React from 'react';
import {
  CheckCircle2,
  Download,
  Image,
  PlusSquare,
  Share,
  Shield,
  Smartphone,
} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

export const GuideView: React.FC = () => {
  const {isInstallable, isInstalled, install} = usePWAInstall();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
          Panduan Instalasi PWA &amp; Ekspor iPhone
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Langkah resmi memasang WA Status HD Pro ke layar utama iPhone Safari, menyimpan MP4 ke aplikasi Foto, dan menjaga kualitas WhatsApp Status.
        </p>
      </section>

      {/* Section 1: PWA Install iPhone Safari */}
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="font-display text-lg font-semibold text-white">
              01. Cara Instal PWA di Safari iPhone (Add to Home Screen)
            </h2>
          </div>

          {isInstalled ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Sudah berjalan dalam mode Aplikasi Standalone
            </span>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={install}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Instal Sekarang</span>
            </button>
          ) : null}
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <li className="rounded-xl bg-[#101820] border border-white/10 p-4 space-y-1.5">
            <p className="font-mono text-xs text-emerald-400 font-semibold">Langkah 1</p>
            <p className="font-semibold text-white">Buka dengan Browser Safari</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Pastikan tautan dibuka langsung di aplikasi <strong>Safari</strong> iOS (minimal iOS 17 ke atas untuk performa terbaik), bukan browser dalam aplikasi seperti WhatsApp atau Instagram.
            </p>
          </li>
          <li className="rounded-xl bg-[#101820] border border-white/10 p-4 space-y-1.5">
            <p className="font-mono text-xs text-emerald-400 font-semibold">Langkah 2</p>
            <p className="font-semibold text-white flex items-center gap-1.5">
              Ketuk Tombol Bagikan <Share className="w-4 h-4 text-emerald-400" />
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cari ikon kotak dengan panah ke atas di bagian tengah bawah bilah navigasi Safari iPhone.
            </p>
          </li>
          <li className="rounded-xl bg-[#101820] border border-white/10 p-4 space-y-1.5">
            <p className="font-mono text-xs text-emerald-400 font-semibold">Langkah 3</p>
            <p className="font-semibold text-white flex items-center gap-1.5">
              Pilih Tambah ke Layar Utama <PlusSquare className="w-4 h-4 text-emerald-400" />
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gulir daftar opsi berbagi ke bawah hingga menemukan menu <strong>Tambah ke Layar Utama</strong> (Add to Home Screen).
            </p>
          </li>
          <li className="rounded-xl bg-[#101820] border border-white/10 p-4 space-y-1.5">
            <p className="font-mono text-xs text-emerald-400 font-semibold">Langkah 4</p>
            <p className="font-semibold text-white">Buka dari Layar Utama (Standalone)</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ketuk <strong>Tambah</strong>. Buka aplikasi melalui ikon <strong>WA HD Pro</strong> di Home Screen untuk tampilan penuh tanpa address bar Safari dan dukungan offline.
            </p>
          </li>
        </ol>
      </section>

      {/* Section 2: Save MP4 to iPhone Photos */}
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Image className="w-5 h-5 text-emerald-400 shrink-0" />
          <h2 className="font-display text-lg font-semibold text-white">
            02. Menyimpan Video MP4 ke Galeri Foto (Photos) iPhone
          </h2>
        </div>
        <div className="space-y-2.5 text-sm text-slate-300 leading-relaxed">
          <p>
            1. Ketuk tombol <strong>Simpan Video (MP4)</strong> setelah optimasi selesai atau pada file asli.
          </p>
          <p>
            2. Saat Safari menampilkan konfirmasi unduhan, pilih <strong>Unduh (Download)</strong>.
          </p>
          <p>
            3. Ketuk ikon panah Unduhan di bilah alamat Safari (atau buka aplikasi <strong>File / Files</strong> &rarr; <strong>Unduhan</strong>), lalu buka video tersebut.
          </p>
          <p>
            4. Ketuk tombol <strong>Bagikan</strong> di pojok kiri bawah &rarr; pilih <strong>Simpan Video (Save Video)</strong> agar masuk langsung ke aplikasi <strong>Foto (Photos)</strong>.
          </p>
        </div>
      </section>

      {/* Section 3: Honest WhatsApp Compression Facts */}
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
          <h2 className="font-display text-lg font-semibold text-white">
            03. Cara Kerja Kualitas Video di WhatsApp Status
          </h2>
        </div>
        <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <p>
            Tidak ada aplikasi, ekstensi, ataupun bot otomatis yang dapat memaksa server WhatsApp menonaktifkan kompresi Status sepenuhnya (bot tidak resmi juga melanggar aturan WhatsApp dan berisiko memblokir nomor Anda). Namun Anda dapat memaksimalkan ketajaman dengan dua jalur berikut:
          </p>
          <p>
            <strong>1. Trik Chat HD &rarr; Teruskan ke Status (1080p):</strong> Optimalkan video dengan preset <strong>Full HD 1080p</strong> lalu simpan ke Foto. Buka chat <strong>Pesan ke Diri Sendiri</strong> di WhatsApp, pilih video, aktifkan tombol <strong>HD</strong> di bagian atas, lalu kirim. Setelah terkirim, tahan video tersebut &rarr; pilih <strong>Teruskan (Forward) &rarr; Status Saya</strong>.
          </p>
          <p>
            <strong>2. Upload Langsung ke Tab Status (720p 1.2–2.2 Mbps):</strong> Untuk upload langsung ke tab Status tanpa lewat chat, gunakan preset <strong>WA Status Anti-Buram (720p 30fps CFR)</strong> agar ukuran dan resolusi sudah sesuai batas internal WhatsApp sehingga tidak diturunkan secara kasar.
          </p>
          <p className="text-xs text-slate-400">
            Tips wajib iPhone: unggah lewat aplikasi WhatsApp utama (bukan Share Sheet Safari) pada koneksi <strong>Wi-Fi yang stabil</strong> dengan <strong>Mode Daya Rendah (Low Power Mode) dimatikan</strong>.
          </p>
        </div>
      </section>
    </div>
  );
};
