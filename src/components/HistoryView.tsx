import React from 'react';
import {Clock, Lock, Trash2} from 'lucide-react';
import type {HistoryItem} from '../types/video';
import {formatBytes, formatDuration} from '../utils/videoInspector';

interface HistoryViewProps {
  items: HistoryItem[];
  saveHistoryEnabled: boolean;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onOpenSettings: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  items,
  saveHistoryEnabled,
  onDeleteItem,
  onClearAll,
  onOpenSettings,
}) => {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#131B22] border border-white/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
            Riwayat Proses
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Hanya menyimpan ringkasan metadata di browser (IndexedDB). File video pribadi Anda tidak pernah disimpan secara otomatis.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 text-xs font-semibold inline-flex items-center gap-2 transition self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Semua Riwayat</span>
          </button>
        )}
      </section>

      {!saveHistoryEnabled && (
        <div className="rounded-2xl bg-[#131B22] border border-amber-500/30 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-white">Pencatatan Riwayat Sedang Dinonaktifkan</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Anda menonaktifkan penyimpanan metadata riwayat di Pengaturan demi privasi penuh.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-white/15 text-xs font-medium text-slate-200 hover:bg-white/5 transition shrink-0 cursor-pointer"
          >
            Buka Pengaturan
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl bg-[#131B22] border border-white/10 p-10 text-center space-y-2">
          <Clock className="w-8 h-8 text-slate-500 mx-auto" />
          <h2 className="font-display text-base font-semibold text-white">
            Belum Ada Riwayat Proses
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Setelah Anda mengoptimalkan atau mengekspor video, catatan ringkasnya akan muncul di sini apabila izin pencatatan aktif.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#131B22] border border-white/10 divide-y divide-white/10">
          {items.map((item) => {
            const dateStr = new Date(item.createdAt).toLocaleString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {item.fileName}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
                    <span className="text-emerald-400 font-medium">
                      {item.mode === 'preserve' ? 'Original Preserve' : item.qualityLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">
                      {item.beforeResolution} &rarr; {item.afterResolution}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">
                      {formatBytes(item.beforeSizeBytes)} &rarr; {formatBytes(item.afterSizeBytes)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{formatDuration(item.durationSec)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{dateStr}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  aria-label={`Hapus riwayat ${item.fileName}`}
                  className="min-w-[44px] min-h-[44px] px-3 rounded-xl border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-300 inline-flex items-center justify-center gap-1.5 text-xs transition self-end sm:self-center cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="sm:hidden">Hapus</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
