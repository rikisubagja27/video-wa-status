import React, {useState} from 'react';
import {CheckCircle2, Cpu, Shield, Trash2} from 'lucide-react';
import type {
  AppSettings,
  BitrateMode,
  DeviceCapabilities,
  VideoCodec,
} from '../types/video';
import {resetFFmpegInstance} from '../utils/ffmpegProcessor';
import {clearTempWorkspace} from '../utils/storage';

interface SettingsViewProps {
  appSettings: AppSettings;
  capabilities: DeviceCapabilities;
  onUpdateSettings: (next: AppSettings) => void;
  onClearMemoryAndCache: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  appSettings,
  capabilities,
  onUpdateSettings,
  onClearMemoryAndCache,
}) => {
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);

  const handleCleanup = async () => {
    resetFFmpegInstance();
    await clearTempWorkspace();
    await onClearMemoryAndCache();
    setCleanupNotice('Memori sementara FFmpeg, URL blob, dan workspace sementara telah dibersihkan.');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
          Pengaturan &amp; Privasi
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kontrol penuh penyimpanan metadata, pembersihan memori lokal, dan preferensi encoder default.
        </p>
      </section>

      {/* Privacy Toggles */}
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="font-display text-lg font-semibold text-white">
            Privasi &amp; Penyimpanan Lokal
          </h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-start justify-between gap-4 p-4 rounded-xl bg-[#101820] border border-white/10 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-white">
                Izinkan Simpan Riwayat Proses (Metadata Saja)
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Menyimpan nama file, ukuran sebelum/sesudah, dan resolusi di IndexedDB browser. Video asli tidak pernah disimpan permanen.
              </p>
            </div>
            <input
              type="checkbox"
              checked={appSettings.saveHistory}
              onChange={(e) =>
                onUpdateSettings({...appSettings, saveHistory: e.target.checked})
              }
              className="mt-1 w-5 h-5 accent-emerald-500 rounded cursor-pointer shrink-0"
            />
          </label>

          <label className="flex items-start justify-between gap-4 p-4 rounded-xl bg-[#101820] border border-white/10 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-white">
                Bersihkan File Sementara Otomatis
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Menghapus buffer memori FFmpeg dan objek sementara segera setelah sesi optimasi atau ganti video.
              </p>
            </div>
            <input
              type="checkbox"
              checked={appSettings.autoCleanTemp}
              onChange={(e) =>
                onUpdateSettings({...appSettings, autoCleanTemp: e.target.checked})
              }
              className="mt-1 w-5 h-5 accent-emerald-500 rounded cursor-pointer shrink-0"
            />
          </label>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={handleCleanup}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-white/15 bg-[#18222B] hover:bg-[#1F2B36] text-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-emerald-400" />
            <span>Bersihkan Memori &amp; File Sementara Sekarang</span>
          </button>
          {cleanupNotice && (
            <span className="text-xs text-emerald-300 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {cleanupNotice}
            </span>
          )}
        </div>
      </section>

      {/* Default Optimizer Preferences */}
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-white">
          Preferensi Default Smart Optimizer
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="default-codec" className="block text-xs font-medium text-slate-300">
              Codec Default
            </label>
            <select
              id="default-codec"
              value={appSettings.defaultCodec}
              onChange={(e) =>
                onUpdateSettings({
                  ...appSettings,
                  defaultCodec: e.target.value as VideoCodec,
                })
              }
              className="w-full min-h-[44px] rounded-xl bg-[#101820] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="h264">H.264 / AVC (Direkomendasikan)</option>
              <option value="h265">H.265 / HEVC</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="default-bitrate" className="block text-xs font-medium text-slate-300">
              Bitrate Default
            </label>
            <select
              id="default-bitrate"
              value={appSettings.defaultBitrate}
              onChange={(e) =>
                onUpdateSettings({
                  ...appSettings,
                  defaultBitrate: e.target.value as BitrateMode,
                })
              }
              className="w-full min-h-[44px] rounded-xl bg-[#101820] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="auto-hd">Otomatis HD (CRF 19)</option>
              <option value="6m">6 Mbps</option>
              <option value="8m">8 Mbps</option>
              <option value="12m">12 Mbps</option>
            </select>
          </div>
        </div>
      </section>

      {/* Device Compatibility Diagnostics */}
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <h2 className="font-display text-lg font-semibold text-white">
            Kompatibilitas Perangkat &amp; Browser
          </h2>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-white/10 pt-4 text-sm">
          <div>
            <dt className="text-xs text-slate-400">WebAssembly (FFmpeg Lokal)</dt>
            <dd className="mt-1 font-medium text-white">
              {capabilities.supportsWasm ? 'Didukung' : 'Tidak Didukung'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Web Share API (File Video)</dt>
            <dd className="mt-1 font-medium text-white">
              {capabilities.supportsWebShareFiles
                ? 'Didukung (Berbagi File Langsung)'
                : 'Terbatas (Gunakan Simpan Video)'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Mode Tampilan PWA</dt>
            <dd className="mt-1 font-medium text-white">
              {capabilities.isStandalone ? 'Standalone (Terinstal)' : 'Tab Browser'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Platform iPhone / iOS</dt>
            <dd className="mt-1 font-medium text-white">
              {capabilities.isIOS ? 'Ya (Optimasi Memori Safari Aktif)' : 'Desktop / Non-iOS'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Batas Aman 4K WASM</dt>
            <dd className="mt-1 font-medium text-white">
              {capabilities.supports4KProcessing
                ? 'Diizinkan'
                : 'Dibatasi ke 1080p demi stabilitas RAM'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Keamanan Jaringan</dt>
            <dd className="mt-1 font-medium text-emerald-300">
              Zero Server Upload
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
};
