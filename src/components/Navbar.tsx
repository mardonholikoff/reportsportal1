import React, { useState } from 'react';
import { AuthUser } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PWAInstallButton } from './PWAInstallButton';
import {
  LogOut,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface Props {
  user: AuthUser;
  onLogout: () => void;
  onOpenAddModal: () => void;
  onOpenFirebaseModal: () => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
  pendingSyncCount: number;
}

export const Navbar: React.FC<Props> = ({
  user,
  onLogout,
  onOpenAddModal,
  onTriggerSync,
  isSyncing,
  pendingSyncCount,
}) => {
  const isOnline = useOnlineStatus();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Left area - clean with no brand logos/text as requested */}
        <div className="flex items-center gap-2">
          {/* Online / Offline status badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
            }`}
            title={isOnline ? "Internetga ulangan" : "Oflayn rejim"}
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-600" />
            )}
            <span className="hidden sm:inline">
              {isOnline ? "Onlayn" : "Oflayn"}
            </span>
            {pendingSyncCount > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-rose-200 text-rose-900 px-1 rounded-full">
                {pendingSyncCount}
              </span>
            )}
          </div>

          {/* Sync trigger button */}
          <button
            onClick={onTriggerSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors border border-transparent hover:border-neutral-200 min-h-[36px]"
            title="Bulut bilan sinxronlash"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-neutral-600 ${isSyncing ? 'animate-spin text-rose-600' : ''}`}
            />
            <span className="hidden md:inline">Sinxronlash</span>
          </button>
        </div>

        {/* Zone 2: Primary Action, PWA Install & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Main "Yangi mijoz qo'shish" button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all min-h-[44px] min-w-[44px] justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="whitespace-nowrap">Yangi mijoz</span>
          </button>

          {/* User profile / Logout dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-neutral-200 hover:border-rose-200 hover:bg-rose-50/50 transition-colors text-neutral-800 text-xs font-medium min-h-[44px] min-w-[44px] justify-center cursor-pointer"
              aria-label="Foydalanuvchi menyusi"
            >
              <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800 font-bold text-xs">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <span className="hidden md:inline font-semibold text-neutral-900">
                {user.username}
              </span>
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white shadow-xl border border-rose-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-neutral-100">
                    <div className="text-xs font-bold text-neutral-900">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {user.username}
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>Tizimdan chiqish</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
