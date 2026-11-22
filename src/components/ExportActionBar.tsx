import React, {useState} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Info,
  Share2,
  X,
} from 'lucide-react';
import type {DeviceCapabilities} from '../types/video';
import {
  canShareVideoFiles,
  downloadVideoFile,
  shareVideoToWhatsApp,
  type ShareVideoResult,
} from '../utils/shareExport';
import {formatBytes} from '../utils/videoInspector';

interface ExportActionBarProps {
  file: File;
  labelPrefix?: string;
  isOriginalPreserve?: boolean;
  capabilities: DeviceCapabilities;
  onAfterExport?: () => void;
}

export const ExportActionBar: React.FC<ExportActionBarProps> = ({
  file,
  labelPrefix = 'Video',
  isOriginalPreserve = false,
  capabilities,
  onAfterExport,
}) => {
  const [shareState, setShareState] = useState<ShareVideoResult | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showIOSPhotosGuide, setShowIOSPhotosGuide] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const webShareSupported = canShareVideoFiles(file);

  const handleSave = () => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const exportName = isOriginalPreserve
      ? file.name
      : file.name.endsWith('.mp4')
        ? file.name
        : `${file.name.replace(/\.[^.]+$/, '')}_HD_Pro.mp4`;

    downloadVideoFile(file, exportName);
    setSavedNotice(
      `Unduhan ${exportName} (${formatBytes(file.size)}) dimulai.${
        capabilities.isIOS
          ? ' Di iPhone, buka aplikasi File (Files) atau ikon unduhan Safari untuk menyimpannya ke aplikasi Foto.'
          : ''
      }`,
    );
    if (capabilities.isIOS) {
      setShowIOSPhotosGuide(true);
    }
    onAfterExport?.();
    if (ext === 'mp4') {
      // Keep clean state
    }
  };

  const handleShareWhatsApp = async () => {
    setIsSharing(true);
    setShareState(null);
    const result = await shareVideoToWhatsApp(
      file,
      `${labelPrefix} - WA Status HD Pro`,
    );
    setShareState(result);
    setIsSharing(false);
    if (result.status === 'shared') {
      onAfterExport?.();
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="min-h-[48px] px-5 py-3 rounded-xl border border-white/15 bg-[#18222B] hover:bg-[#1F2B36] active:scale-[0.99] text-slate-100 font-semibold text-sm flex items-center justify-center gap-2.5 transition cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{isOriginalPreserve ? 'Simpan Video Asli' : 'Simpan Video (MP4)'}</span>
        </button>

        <button
          type="button"
          onClick={handleShareWhatsApp}
          disabled={isSharing}
          className="min-h-[48px] px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-60 text-slate-950 font-bold text-sm flex items-center justify-center gap-2.5 transition cursor-pointer"
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span>
            {isSharing
              ? 'Membuka Share Sheet...'
              : isOriginalPreserve
                ? 'Bagikan Video Asli'
                : 'Bagikan ke WhatsApp'}
          </span>
        </button>
      </div>

      {!webShareSupported && (
        <div className="rounded-xl bg-[#131B22] border border-white/10 px-4 py-3 text-xs text-slate-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            Browser desktop/mode saat ini tidak mendukung <span className="font-mono text-slate-200">navigator.canShare({'{files}'})</span> secara langsung. Gunakan tombol <strong>Simpan Video</strong> lalu unggah file tersebut secara manual ke WhatsApp.
          </p>
        </div>
      )}

      {savedNotice && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-xs text-emerald-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p>{savedNotice}</p>
              {capabilities.isIOS && (
                <button
                  type="button"
                  onClick={() => setShowIOSPhotosGuide(true)}
                  className="mt-1.5 text-emerald-300 underline underline-offset-2 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Lihat cara simpan ke Galeri Foto iPhone</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSavedNotice(null)}
            aria-label="Tutup pemberitahuan simpan"
            className="text-emerald-300 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {shareState && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs flex items-start justify-between gap-3 ${
            shareState.status === 'shared'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : shareState.status === 'cancelled'
                ? 'bg-[#131B22] border-white/10 text-slate-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {shareState.status === 'shared' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p>{shareState.message}</p>
              {shareState.status === 'unsupported' && (
                <button
                  type="button"
                  onClick={handleSave}
                  className="mt-1.5 font-semibold text-amber-300 underline underline-offset-2 cursor-pointer"
                >
                  Unduh Video Sekarang untuk Berbagi Manual
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShareState(null)}
            aria-label="Tutup pemberitahuan berbagi"
            className="p-1 opacity-75 hover:opacity-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showIOSPhotosGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-save-guide-title"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#131B22] border border-white/10 p-6 pb-safe shadow-2xl">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <h3 id="ios-save-guide-title" className="font-display text-lg font-bold text-white">
                Simpan Video ke Foto iPhone
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSPhotosGuide(false)}
                aria-label="Tutup panduan simpan"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Safari iOS menyimpan file unduhan ke folder Unduhan di aplikasi File. Ikuti 3 langkah cepat ini untuk memasukkannya ke Galeri Foto:
            </p>
            <ol className="mt-4 space-y-3 text-sm text-slate-200">
              <li className="flex gap-3">
                <span className="font-mono text-emerald-400 font-semibold">01.</span>
                <span>Ketuk ikon panah Unduhan di bilah Safari (atau buka aplikasi <strong>File / Files</strong> &rarr; folder <strong>Unduhan</strong>).</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-emerald-400 font-semibold">02.</span>
                <span>Buka file video <span className="font-mono text-xs text-slate-300">.mp4</span> yang baru saja diunduh, lalu ketuk ikon <strong>Bagikan (Share)</strong> di pojok kiri bawah.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-emerald-400 font-semibold">03.</span>
                <span>Pilih <strong>Simpan Video (Save Video)</strong> agar video tersimpan langsung ke aplikasi Foto (Photos).</span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSPhotosGuide(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
