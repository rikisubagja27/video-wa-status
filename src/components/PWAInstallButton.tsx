import React, {useState} from 'react';
import {Download, PlusSquare, Share, Smartphone, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenFullGuide?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({onOpenFullGuide}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Instal Aplikasi</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowIOSModal(true)}
        className="min-h-[40px] px-3.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-medium text-xs sm:text-sm inline-flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span>{isIOS ? 'Instal iPhone' : 'Instal PWA'}</span>
      </button>

      {showIOSModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#131B22] border border-white/10 p-6 pb-safe shadow-2xl">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="pwa-guide-title" className="font-display text-lg font-bold text-white">
                  Instal WA Status HD Pro di iPhone
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Jalankan seperti aplikasi penuh tanpa address bar Safari dan tetap siap digunakan offline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                aria-label="Tutup panduan instalasi"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="mt-5 space-y-4 text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <p className="font-medium text-white">Buka halaman ini di browser Safari</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pastikan Anda menggunakan Safari bawaan iPhone (bukan browser dalam aplikasi).
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <p className="font-medium text-white flex items-center gap-1.5">
                    Ketuk ikon Bagikan <Share className="w-4 h-4 text-emerald-400 inline" /> di bilah Safari
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Terletak di bagian bawah layar iPhone atau kanan atas pada layar lebar.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <p className="font-medium text-white flex items-center gap-1.5">
                    Pilih Tambah ke Layar Utama <PlusSquare className="w-4 h-4 text-emerald-400 inline" />
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ketuk <span className="text-slate-200 font-medium">Tambah</span> di pojok kanan atas untuk menyimpan ikon WA HD Pro.
                  </p>
                </div>
              </li>
            </ol>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              {onOpenFullGuide && (
                <button
                  type="button"
                  onClick={() => {
                    setShowIOSModal(false);
                    onOpenFullGuide();
                  }}
                  className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-200 hover:bg-white/5 text-sm font-medium transition cursor-pointer"
                >
                  Lihat Panduan Lengkap
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold transition cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
