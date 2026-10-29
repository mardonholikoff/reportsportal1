import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

interface Props {
  pendingCount?: number;
}

export const OfflineIndicator: React.FC<Props> = ({ pendingCount = 0 }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 flex items-center gap-3 rounded-xl bg-neutral-900/95 text-white px-4 py-2.5 shadow-xl border border-rose-500/30 backdrop-blur-md"
    >
      <div className="w-8 h-8 rounded-lg bg-rose-950 flex items-center justify-center shrink-0 text-rose-400">
        <WifiOff className="w-4 h-4" />
      </div>
      <div className="text-xs flex-1">
        <div className="font-semibold text-white">Oflayn rejim</div>
        <div className="text-neutral-300 text-[11px] leading-tight">
          Barcha o'zgarishlar qurilmada xavfsiz saqlanmoqda{pendingCount > 0 ? ` (${pendingCount} ta sinxron kutilmoqda)` : ''}.
        </div>
      </div>
    </div>
  );
};
