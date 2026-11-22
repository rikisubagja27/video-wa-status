import React from 'react';
import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-14 sm:top-16 right-4 z-40 flex items-center gap-2 rounded-xl bg-amber-500/95 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg backdrop-blur-sm"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Mode Offline — Pemrosesan video lokal tetap aktif</span>
    </div>
  );
};
