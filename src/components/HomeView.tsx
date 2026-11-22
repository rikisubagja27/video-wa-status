import React, {useRef, useState} from 'react';
import {
  ArrowRight,
  Film,
  FolderOpen,
  Lock,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  DeviceCapabilities,
  OptimizationRecommendation,
  VideoMetadata,
} from '../types/video';
import {
  formatBitrate,
  formatBytes,
  formatDuration,
} from '../utils/videoInspector';
import {BrandLogo} from './BrandLogo';
import {ExportActionBar} from './ExportActionBar';

interface HomeViewProps {
  sourceFile: File | null;
  sourceUrl: string | null;
  metadata: VideoMetadata | null;
  recommendation: OptimizationRecommendation | null;
  capabilities: DeviceCapabilities;
  isInspecting: boolean;
  inspectError: string | null;
  onSelectFile: (file: File) => void;
  onClearFile: () => void;
  onGoToOptimizer: (mode: 'preserve' | 'optimize') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  sourceFile,
  sourceUrl,
  metadata,
  recommendation,
  capabilities,
  isInspecting,
  inspectError,
  onSelectFile,
  onClearFile,
  onGoToOptimizer,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onSelectFile(file);
    }
  };

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Hidden native file input supporting iPhone Photos Library & Files */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.mov,.m4v,.webm,.3gp"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Pilih file video dari Galeri atau Files"
      />

      {/* Top Welcome / Brand Hero Header */}
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="sm:hidden">
              <BrandLogo compact />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Persiapkan Video WhatsApp Status Tetap Tajam dan Jernih
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Analisis kualitas video secara instan, pertahankan file asli tanpa re-encoding, atau optimalkan ke profil H.264/AAC lokal di perangkat Anda tanpa mengunggah ke server mana pun.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                100% Lokal di Perangkat
              </span>
              <span aria-hidden="true">·</span>
              <span>Tanpa Login WhatsApp</span>
              <span aria-hidden="true">·</span>
              <span>Siap Offline PWA</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              type="button"
              onClick={openPicker}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2.5 transition cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span>{sourceFile ? 'Ganti Video' : 'Pilih Video'}</span>
            </button>
            {sourceFile && (
              <button
                type="button"
                onClick={onClearFile}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium inline-flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus dari Sesi</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Error banner */}
      {inspectError && (
        <div
          role="alert"
          className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3.5 text-sm text-rose-200"
        >
          {inspectError}
        </div>
      )}

      {/* Empty State / Dropzone */}
      {!sourceFile && !isInspecting && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={openPicker}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
          className={`rounded-2xl border border-dashed p-8 sm:p-12 text-center transition cursor-pointer ${
            isDragging
              ? 'border-emerald-400 bg-emerald-500/10'
              : 'border-white/15 bg-[#101820] hover:border-emerald-500/50 hover:bg-[#131B22]'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#18222B] border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="font-display text-lg font-semibold text-white">
            Pilih Video dari Galeri Foto atau Aplikasi File
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Mendukung MP4, MOV (iPhone), M4V, WebM, dan format video lain yang kompatibel dengan Safari &amp; browser modern. Video asli tidak akan diubah saat dipilih.
          </p>
          <div className="mt-6 inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#18222B] border border-white/10 text-sm font-medium text-emerald-300">
            Ketuk untuk Memilih Video
          </div>
        </div>
      )}

      {/* Loading metadata */}
      {isInspecting && (
        <div className="rounded-2xl bg-[#131B22] border border-white/10 p-8 text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-300">
            Membaca metadata video secara lokal (tidak mengunggah file)...
          </p>
        </div>
      )}

      {/* Loaded Video Preview + Quality Telemetry + Direct Actions */}
      {sourceFile && sourceUrl && metadata && !isInspecting && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Video Preview Frame */}
          <div className="lg:col-span-5 rounded-2xl bg-[#131B22] border border-white/10 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-display text-base font-semibold text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-emerald-400" />
                  <span>Preview Video Asli</span>
                </h2>
                <span className="font-mono text-xs text-slate-400">
                  {metadata.width}×{metadata.height}
                </span>
              </div>

              <div className="rounded-xl overflow-hidden bg-black border border-white/10 flex items-center justify-center max-h-[460px]">
                <video
                  src={sourceUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-[460px] object-contain"
                />
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              File asli dipertahankan utuh di memori sementara browser tanpa modifikasi.
            </p>
          </div>

          {/* Right: Quality Info + Actions */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="font-display text-base sm:text-lg font-semibold text-white">
                  Informasi Kualitas Video
                </h2>
                <span className="text-xs font-mono text-emerald-400">
                  {metadata.container}
                </span>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4 border-t border-white/10 pt-4">
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-xs text-slate-400">Nama File</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-100 truncate">
                    {metadata.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Ukuran File</dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold text-white">
                    {formatBytes(metadata.sizeBytes)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Durasi</dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold text-white">
                    {formatDuration(metadata.durationSec)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Resolusi</dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold text-white">
                    {metadata.width}×{metadata.height}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Rasio Aspek</dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold text-white">
                    {metadata.aspectRatioLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Frame Rate</dt>
                  <dd className="mt-0.5 font-mono text-sm font-medium text-slate-200">
                    {metadata.fps ? `${metadata.fps} fps` : 'Tidak terdeteksi'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Format / Codec</dt>
                  <dd className="mt-0.5 font-mono text-sm font-medium text-slate-200">
                    {metadata.codecHint ?? metadata.container}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400">Estimasi Bitrate</dt>
                  <dd className="mt-0.5 font-mono text-sm font-medium text-slate-200">
                    {formatBitrate(metadata.estimatedBitrateBps)}
                  </dd>
                </div>
              </dl>

              {recommendation && (
                <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-300">
                        {recommendation.headline}
                      </p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-300">
                        {recommendation.reasons.map((r, i) => (
                          <li key={i}>· {r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {recommendation.statusDurationWarning && (
                    <p className="text-xs text-amber-300 pt-1">
                      Catatan Status: {recommendation.statusDurationWarning}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Primary Home Action Buttons */}
            <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => onGoToOptimizer('optimize')}
                  className="min-h-[48px] flex-1 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Sliders className="w-4 h-4 shrink-0" />
                  <span>Optimasi HD (Smart Optimizer)</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => onGoToOptimizer('preserve')}
                  className="min-h-[48px] px-5 py-3 rounded-xl border border-white/15 bg-[#18222B] hover:bg-[#1F2B36] text-slate-100 font-semibold text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <span>Original Preserve Mode</span>
                </button>
              </div>

              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-slate-400 mb-3">
                  Atau ekspor langsung file asli tanpa encoding ulang:
                </p>
                <ExportActionBar
                  file={sourceFile}
                  labelPrefix="Video Asli"
                  isOriginalPreserve={true}
                  capabilities={capabilities}
                />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
