import React, {useEffect, useState} from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Cpu,
  FolderOpen,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  AudioMode,
  BitrateMode,
  DeviceCapabilities,
  FpsOption,
  OptimizationRecommendation,
  OptimizationResult,
  OptimizationSettings,
  QualityPreset,
  VideoCodec,
  VideoMetadata,
} from '../types/video';
import {
  computeTargetDimensions,
  computeWhatsAppSweetSpotKbps,
  optimizeVideoFast,
  resetFFmpegInstance,
} from '../utils/ffmpegProcessor';
import {isWebCodecsSupported} from '../utils/webcodecsProcessor';
import {
  formatBitrate,
  formatBytes,
  formatDuration,
} from '../utils/videoInspector';
import {ExportActionBar} from './ExportActionBar';

interface OptimizerViewProps {
  sourceFile: File | null;
  sourceUrl: string | null;
  metadata: VideoMetadata | null;
  recommendation: OptimizationRecommendation | null;
  capabilities: DeviceCapabilities;
  settings: OptimizationSettings;
  result: OptimizationResult | null;
  onChangeSettings: (next: OptimizationSettings) => void;
  onOptimizationComplete: (res: OptimizationResult) => void;
  onRequestSelectVideo: () => void;
  onSwitchToHome: () => void;
}

export const OptimizerView: React.FC<OptimizerViewProps> = ({
  sourceFile,
  sourceUrl,
  metadata,
  recommendation,
  capabilities,
  settings,
  result,
  onChangeSettings,
  onOptimizationComplete,
  onRequestSelectVideo,
  onSwitchToHome,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [processError, setProcessError] = useState<string | null>(null);
  const [compareTab, setCompareTab] = useState<'both' | 'before' | 'after'>('both');

  useEffect(() => {
    setProcessError(null);
    setProgress(0);
    setStatusMessage('');
  }, [sourceFile]);

  if (!sourceFile || !sourceUrl || !metadata) {
    return (
      <div className="rounded-2xl bg-[#131B22] border border-white/10 p-8 sm:p-12 text-center space-y-4">
        <h2 className="font-display text-xl font-bold text-white">
          Belum Ada Video yang Dipilih
        </h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Pilih video dari Galeri Foto atau aplikasi File terlebih dahulu untuk melihat rekomendasi dan menjalankan optimasi HD lokal.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onRequestSelectVideo}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm inline-flex items-center gap-2 transition cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Pilih Video</span>
          </button>
          <button
            type="button"
            onClick={onSwitchToHome}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-200 text-sm font-medium transition cursor-pointer"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  const shortSide = Math.min(metadata.width, metadata.height);
  const sourceSupports4K = shortSide >= 2160;
  const targetPreviewDims = computeTargetDimensions(
    metadata.width,
    metadata.height,
    settings.quality,
  );
  const targetAudioKbps = settings.audio === 'aac-128' ? 128 : 192;
  const sweetSpotKbps = computeWhatsAppSweetSpotKbps(
    metadata.durationSec,
    targetAudioKbps,
    Math.min(targetPreviewDims.width, targetPreviewDims.height),
  );

  const applyRecommendedSettings = () => {
    if (!recommendation) return;
    onChangeSettings({
      mode: recommendation.recommendedMode,
      quality: recommendation.recommendedPreset,
      codec: recommendation.recommendedCodec,
      audio: 'aac-192',
      bitrate: recommendation.recommendedBitrate,
      fps: recommendation.recommendedFps,
      enforceCfr: true,
      lanczosSharpen: true,
    });
  };

  const handleRunOptimization = async () => {
    setProcessError(null);

    if (settings.mode === 'preserve') {
      onOptimizationComplete({
        mode: 'preserve',
        file: sourceFile,
        previewUrl: sourceUrl,
        sizeBytes: sourceFile.size,
        width: metadata.width,
        height: metadata.height,
        durationSec: metadata.durationSec,
        estimatedBitrateBps: metadata.estimatedBitrateBps,
        codecUsed: metadata.codecHint ?? metadata.container,
        container: metadata.container,
        processingTimeMs: 0,
        note: 'Original Preserve Mode aktif: file asli dipertahankan tanpa re-encoding, tanpa penurunan resolusi, bitrate, FPS, maupun kualitas audio.',
      });
      return;
    }

    if (!isWebCodecsSupported() && !capabilities.supportsWasm) {
      setProcessError(
        'Browser ini tidak mendukung WebCodecs maupun WebAssembly. Gunakan Original Preserve Mode untuk membagikan file asli tanpa encoding ulang.',
      );
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatusMessage(
      isWebCodecsSupported()
        ? 'Mengaktifkan akselerasi GPU perangkat...'
        : 'Menginisialisasi FFmpeg WebAssembly lokal...',
    );

    try {
      const processed = await optimizeVideoFast(sourceFile, metadata, settings, {
        onProgress: setProgress,
        onStatus: setStatusMessage,
      });
      onOptimizationComplete(processed);
    } catch (err) {
      resetFFmpegInstance();
      setProcessError(
        err instanceof Error
          ? `${err.message} Anda tetap dapat menggunakan Original Preserve Mode sebagai fallback aman.`
          : 'Gagal memproses video di memori perangkat. Gunakan Original Preserve Mode sebagai fallback.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelProcessing = () => {
    resetFFmpegInstance();
    setIsProcessing(false);
    setProgress(0);
    setStatusMessage('Pemrosesan dibatalkan dan memori FFmpeg dibersihkan.');
  };

  const qualityOptions: Array<{
    id: QualityPreset;
    label: string;
    detail: string;
    disabled?: boolean;
  }> = [
    {
      id: 'wa-sweetspot',
      label: 'WA Status Anti-Buram (720p)',
      detail: '720p 30fps CFR + 1.2–2.2 Mbps (menghindari resizer buram WhatsApp Status)',
    },
    {
      id: 'original',
      label: 'Resolusi Asli',
      detail: `${metadata.width}×${metadata.height} (Tanpa ubah skala)`,
    },
    {
      id: '1080p',
      label: 'Full HD 1080p',
      detail:
        shortSide <= 1080
          ? 'Sesuai sumber (tanpa upscaling)'
          : 'Downscale presisi ke 1080p',
    },
    {
      id: '720p',
      label: 'HD 720p',
      detail: 'Paling ringan & minim artefak blok pada aksi cepat',
    },
    {
      id: '4k',
      label: '4K UHD',
      detail: !sourceSupports4K
        ? 'Sumber < 4K (hindari upscaling)'
        : !capabilities.supports4KProcessing
          ? 'RAM iOS terbatas untuk 4K WASM'
          : 'Pertahankan 2160p penuh',
      disabled: !sourceSupports4K || !capabilities.supports4KProcessing,
    },
  ];

  const sizeDeltaPct =
    result && metadata.sizeBytes > 0
      ? Math.round(((result.sizeBytes - metadata.sizeBytes) / metadata.sizeBytes) * 100)
      : 0;

  const resultSizeMb = result ? result.sizeBytes / (1024 * 1024) : 0;
  const isResultInWaSafeZone = resultSizeMb > 0 && resultSizeMb <= 8.5;

  return (
    <div className="space-y-6">
      {/* Mode Switcher: Original Preserve vs Smart HD Optimizer */}
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
              Pengaturan Optimasi Video
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {metadata.name} · <span className="font-mono">{formatBytes(metadata.sizeBytes)}</span> ·{' '}
              <span className="font-mono">{metadata.width}×{metadata.height}</span>
            </p>
          </div>

          {recommendation && (
            <button
              type="button"
              onClick={applyRecommendedSettings}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold inline-flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Terapkan Rekomendasi</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChangeSettings({...settings, mode: 'preserve'})}
            className={`text-left p-4 rounded-xl border transition cursor-pointer ${
              settings.mode === 'preserve'
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-white/10 bg-[#101820] hover:border-white/25'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-semibold text-white text-sm sm:text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Original Preserve Mode
              </span>
              {settings.mode === 'preserve' && (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
              Tanpa encoding ulang, tanpa menurunkan resolusi, bitrate, FPS, ataupun audio. Cocok jika file sudah di bawah ~15 MB MP4 H.264.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChangeSettings({...settings, mode: 'optimize'})}
            className={`text-left p-4 rounded-xl border transition cursor-pointer ${
              settings.mode === 'optimize'
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-white/10 bg-[#101820] hover:border-white/25'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-semibold text-white text-sm sm:text-base flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                Smart HD Optimizer (FFmpeg WASM)
              </span>
              {settings.mode === 'optimize' && (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
              Menyamakan resolusi &amp; bitrate dengan batas Status WA (720p 30fps CFR · H.264 SDR) agar server WA tidak mengompres ulang secara buram.
            </p>
          </button>
        </div>

        {/* Recommendation summary */}
        {recommendation && (
          <div className="rounded-xl bg-[#101820] border border-white/10 p-4 text-xs text-slate-300 space-y-1.5">
            <p className="font-semibold text-emerald-300">{recommendation.headline}</p>
            {recommendation.reasons.map((r, idx) => (
              <p key={idx}>· {r}</p>
            ))}
          </div>
        )}
      </section>

      {/* Mode Specific Controls */}
      {settings.mode === 'preserve' ? (
        <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">
            Pertahankan File Asli Tanpa Encoding Ulang
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Seluruh parameter asli (<span className="font-mono">{metadata.width}×{metadata.height}</span>,{' '}
            <span className="font-mono">{formatBytes(metadata.sizeBytes)}</span>,{' '}
            {metadata.fps ? <span className="font-mono">{metadata.fps} fps</span> : 'FPS asli'}, audio asli) dipertahankan 100% identik.
          </p>
          {metadata.sizeBytes > 15.5 * 1024 * 1024 && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
              Peringatan: Ukuran file asli ({formatBytes(metadata.sizeBytes)}) di atas ~15.5 MB. Jika langsung diunggah ke Status WA, WhatsApp biasanya akan mengompres ulang secara berat hingga video terlihat pecah. Disarankan memakai <strong>Smart HD Optimizer &rarr; WA Status Anti-Pecah</strong>.
            </p>
          )}
          <ExportActionBar
            file={sourceFile}
            labelPrefix="Video Asli"
            isOriginalPreserve={true}
            capabilities={capabilities}
            onAfterExport={handleRunOptimization}
          />
        </section>
      ) : (
        <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-6">
          {/* Quality Preset */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-white">
                Profil Resolusi &amp; Kualitas
              </label>
              <span className="font-mono text-xs text-emerald-400">
                Output: {targetPreviewDims.width}×{targetPreviewDims.height}
                {settings.bitrate === 'wa-auto' ? ` · ~${(sweetSpotKbps / 1000).toFixed(1)} Mbps` : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {qualityOptions.map((opt) => {
                const selected = settings.quality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={opt.disabled || isProcessing}
                    onClick={() =>
                      onChangeSettings({
                        ...settings,
                        quality: opt.id,
                        bitrate: opt.id === 'wa-sweetspot' ? 'wa-auto' : settings.bitrate,
                      })
                    }
                    className={`min-h-[68px] text-left p-3.5 rounded-xl border transition ${
                      opt.disabled
                        ? 'opacity-45 cursor-not-allowed border-white/5 bg-[#0D1319]'
                        : selected
                          ? 'border-emerald-500 bg-emerald-500/10 cursor-pointer'
                          : 'border-white/10 bg-[#101820] hover:border-white/25 cursor-pointer'
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{opt.label}</p>
                    <p className="mt-1 text-xs text-slate-400 leading-snug">{opt.detail}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Codec, Audio, Bitrate, FPS Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label htmlFor="codec-select" className="block text-xs font-medium text-slate-300">
                Codec Video
              </label>
              <select
                id="codec-select"
                disabled={isProcessing}
                value={settings.codec}
                onChange={(e) =>
                  onChangeSettings({...settings, codec: e.target.value as VideoCodec})
                }
                className="w-full min-h-[44px] rounded-xl bg-[#101820] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="h264">H.264 High + BT.709 (Terbaik untuk WA)</option>
                <option value="h265">H.265 / HEVC (Jika didukung)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="audio-select" className="block text-xs font-medium text-slate-300">
                Audio Output
              </label>
              <select
                id="audio-select"
                disabled={isProcessing}
                value={settings.audio}
                onChange={(e) =>
                  onChangeSettings({...settings, audio: e.target.value as AudioMode})
                }
                className="w-full min-h-[44px] rounded-xl bg-[#101820] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="aac-192">AAC 192 kbps (Kualitas Tinggi)</option>
                <option value="aac-128">AAC 128 kbps (Hemat Bitrate Video)</option>
                <option value="copy">Salin Audio Asli (Copy)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="bitrate-select" className="block text-xs font-medium text-slate-300">
                Pengaturan Bitrate
              </label>
              <select
                id="bitrate-select"
                disabled={isProcessing}
                value={settings.bitrate}
                onChange={(e) =>
                  onChangeSettings({...settings, bitrate: e.target.value as BitrateMode})
                }
                className="w-full min-h-[44px] rounded-xl bg-[#101820] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="wa-1200k">1.2 Mbps (Anti-Buram Status WA · &le; 4.5 MB)</option>
                <option value="wa-2200k">2.2 Mbps (720p Tajam · Klip &le; 20 Detik)</option>
                <option value="wa-auto">
                  Otomatis Sweet Spot (~{(sweetSpotKbps / 1000).toFixed(1)} Mbps)
                </option>
                <option value="auto-hd">Otomatis HD (Untuk Chat HD / Arsip)</option>
                <option value="6m">6 Mbps (VBV Terkendali)</option>
                <option value="8m">8 Mbps (HD Tajam)</option>
                <option value="12m">12 Mbps (Maksimum Lokal)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="fps-select" className="block text-xs font-medium text-slate-300">
                Frame Rate (FPS)
              </label>
              <select
                id="fps-select"
                disabled={isProcessing}
                value={settings.fps}
                onChange={(e) =>
                  onChangeSettings({...settings, fps: e.target.value as FpsOption})
                }
                className="w-full min-h-[44px] rounded-xl bg-[#101820] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="30">30 fps (Paling Mulus &amp; Stabil di Status WA)</option>
                <option
                  value="60"
                  disabled={metadata.fps !== null && metadata.fps < 50}
                >
                  60 fps {metadata.fps !== null && metadata.fps < 50 ? '(Sumber <60fps)' : '(Butuh bitrate lebih tinggi)'}
                </option>
                <option value="original">Pertahankan FPS Asli</option>
              </select>
            </div>
          </div>

          {/* Smoothness & Sharpness Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#101820] border border-white/10 cursor-pointer">
              <input
                type="checkbox"
                disabled={isProcessing}
                checked={settings.enforceCfr}
                onChange={(e) =>
                  onChangeSettings({...settings, enforceCfr: e.target.checked})
                }
                className="mt-0.5 w-5 h-5 accent-emerald-500 rounded shrink-0 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-semibold text-white">Smooth Motion (Constant Frame Rate / CFR)</p>
                <p className="mt-0.5 text-slate-400">
                  Menghilangkan frame rate tidak tetap (VFR) bawaan kamera iPhone agar video tidak patah-patah setelah diproses WhatsApp.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#101820] border border-white/10 cursor-pointer">
              <input
                type="checkbox"
                disabled={isProcessing}
                checked={settings.lanczosSharpen}
                onChange={(e) =>
                  onChangeSettings({...settings, lanczosSharpen: e.target.checked})
                }
                className="mt-0.5 w-5 h-5 accent-emerald-500 rounded shrink-0 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-semibold text-white">Filter Lanczos + Pertajam Detail Halus</p>
                <p className="mt-0.5 text-slate-400">
                  Menjaga ketajaman tepi objek saat downscale 4K/1080p dan mencegah tampilan buram setelah kompresi Status.
                </p>
              </div>
            </label>
          </div>

          {/* iPhone RAM advisory */}
          {capabilities.isIOS && (
            <p className="text-xs text-slate-400">
              Catatan Safari iPhone: Pemrosesan berjalan 100% di RAM Safari. Menggunakan preset <strong>WA Status Anti-Pecah</strong> dengan <strong>30 fps CFR</strong> memberikan hasil paling mulus dan minim pecah saat diunggah ke Status WhatsApp.
            </p>
          )}

          {/* Action / Progress */}
          {!isProcessing ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleRunOptimization}
                className="min-h-[48px] flex-1 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span>Mulai Optimasi HD Lokal</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-[#101820] border border-emerald-500/30 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-200">{statusMessage}</span>
                <span className="font-mono font-semibold text-emerald-400">{progress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{width: `${Math.max(4, progress)}%`}}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCancelProcessing}
                  className="min-h-[40px] px-4 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-slate-300 cursor-pointer"
                >
                  Batalkan Proses
                </button>
              </div>
            </div>
          )}

          {/* Error + Fallback to Original Preserve */}
          {processError && (
            <div
              role="alert"
              className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 space-y-3"
            >
              <div className="flex items-start gap-2.5 text-sm text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>{processError}</p>
              </div>
              <button
                type="button"
                onClick={() => onChangeSettings({...settings, mode: 'preserve'})}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Beralih ke Original Preserve Mode</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* Before and After Comparison */}
      {result && result.mode === 'optimize' && (
        <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-400" />
                <span>Perbandingan Sebelum &amp; Sesudah Optimasi</span>
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Selesai diproses lokal dalam{' '}
                <span className="font-mono text-slate-200">
                  {(result.processingTimeMs / 1000).toFixed(1)} detik
                </span>
                .
              </p>
            </div>

            {/* Mobile / Tablet comparison view switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#101820] border border-white/10 self-start">
              {(
                [
                  {id: 'both', label: 'Berdampingan'},
                  {id: 'before', label: 'Asli'},
                  {id: 'after', label: 'Hasil HD'},
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCompareTab(tab.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    compareTab === tab.id
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* WA Status Readiness Check */}
          <div
            className={`rounded-xl border px-4 py-3 text-xs flex items-start gap-2.5 ${
              isResultInWaSafeZone
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            }`}
          >
            {isResultInWaSafeZone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">
                {isResultInWaSafeZone
                  ? `Zona Optimal Status WA (${formatBytes(result.sizeBytes)} <= 8.5 MB)`
                  : `Ukuran Output ${formatBytes(result.sizeBytes)} (> 8.5 MB)`}
              </p>
              <p className="opacity-90">
                {isResultInWaSafeZone
                  ? 'Ukuran & profil 720p H.264 sudah sesuai ambang Status WhatsApp sehingga tidak perlu diturunkan paksa oleh resizer kasar WhatsApp.'
                  : 'File di atas 8.5 MB untuk Status WA berisiko dikompres ulang cukup berat saat upload. Jika Status masih terlihat buram, coba gunakan preset WA Status Anti-Buram (720p) + bitrate 1.2 Mbps.'}
              </p>
            </div>
          </div>

          {result.note && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
              {result.note}
            </p>
          )}

          {/* Dual Video Players */}
          <div
            className={`grid gap-4 ${
              compareTab === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {(compareTab === 'both' || compareTab === 'before') && (
              <div className="rounded-xl bg-[#101820] border border-white/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">Sebelum (Video Asli)</span>
                  <span className="font-mono text-slate-400">
                    {metadata.width}×{metadata.height} · {formatBytes(metadata.sizeBytes)}
                  </span>
                </div>
                <div className="rounded-lg overflow-hidden bg-black flex items-center justify-center max-h-[360px]">
                  <video
                    src={sourceUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[360px] object-contain"
                  />
                </div>
              </div>
            )}

            {(compareTab === 'both' || compareTab === 'after') && (
              <div className="rounded-xl bg-[#101820] border border-emerald-500/30 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-300">Sesudah (Hasil Optimasi HD)</span>
                  <span className="font-mono text-emerald-400">
                    {result.width}×{result.height} · {formatBytes(result.sizeBytes)}
                  </span>
                </div>
                <div className="rounded-lg overflow-hidden bg-black flex items-center justify-center max-h-[360px]">
                  <video
                    src={result.previewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[360px] object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Comparison Metrics Table */}
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#101820]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-white/10 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">Parameter</th>
                  <th className="py-3 px-4 font-medium">Sebelum</th>
                  <th className="py-3 px-4 font-medium">Sesudah Optimasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                <tr>
                  <td className="py-3 px-4 text-slate-300">Ukuran File</td>
                  <td className="py-3 px-4 font-mono text-slate-200">
                    {formatBytes(metadata.sizeBytes)}
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-300 font-semibold">
                    {formatBytes(result.sizeBytes)}{' '}
                    <span className="text-slate-400 font-normal">
                      ({sizeDeltaPct > 0 ? `+${sizeDeltaPct}%` : `${sizeDeltaPct}%`})
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-300">Resolusi</td>
                  <td className="py-3 px-4 font-mono text-slate-200">
                    {metadata.width}×{metadata.height}
                  </td>
                  <td className="py-3 px-4 font-mono text-white font-semibold">
                    {result.width}×{result.height}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-300">Estimasi Bitrate</td>
                  <td className="py-3 px-4 font-mono text-slate-200">
                    {formatBitrate(metadata.estimatedBitrateBps)}
                  </td>
                  <td className="py-3 px-4 font-mono text-white">
                    {formatBitrate(result.estimatedBitrateBps)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-300">Format &amp; Codec</td>
                  <td className="py-3 px-4 font-mono text-slate-200">
                    {metadata.container} / {metadata.codecHint ?? 'Auto'}
                  </td>
                  <td className="py-3 px-4 font-mono text-white">
                    {result.container} / {result.codecUsed} + AAC (BT.709)
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-300">Durasi</td>
                  <td className="py-3 px-4 font-mono text-slate-200">
                    {formatDuration(metadata.durationSec)}
                  </td>
                  <td className="py-3 px-4 font-mono text-white">
                    {formatDuration(result.durationSec)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-xl bg-[#101820] border border-white/10 p-4 text-xs text-slate-300 space-y-1.5">
            <p className="font-semibold text-white">Agar Status Tidak Buram Saat Diupload di iPhone:</p>
            <p>1. <strong>Simpan ke Foto terlebih dahulu:</strong> Berbagi langsung lewat Share Sheet Safari sering memakai kompresi ekstensi iOS. Simpan MP4 ke <strong>Foto (Photos)</strong> lalu buka WhatsApp &rarr; <strong>Pembaruan / Status</strong> &rarr; pilih dari Galeri.</p>
            <p>2. <strong>Upload lewat Wi-Fi Stabil &amp; Matikan Mode Daya Rendah:</strong> WhatsApp otomatis menurunkan kualitas upload secara drastis apabila mendeteksi sinyal seluler lambat atau Low Power Mode iPhone aktif.</p>
            <p>3. <strong>Fakta Kompresi Status WA:</strong> Berbeda dengan Chat biasa, fitur Status WhatsApp di sebagian besar versi belum menyediakan tombol HD dan selalu memproses ulang di server sekitar 720p / ~1–1.5 Mbps. Memilih preset <strong>720p · 1.2–2.2 Mbps</strong> mencegah penurunan resolusi ganda yang bikin buram.</p>
          </div>

          {/* Export Buttons */}
          <ExportActionBar
            file={result.file}
            labelPrefix="Video HD Pro"
            isOriginalPreserve={false}
            capabilities={capabilities}
          />
        </section>
      )}
    </div>
  );
};
