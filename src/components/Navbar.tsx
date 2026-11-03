import React, { useState } from 'react';
import { AuthUser } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PWAInstallButton } from './PWAInstallButton';
import { getAgentDisplayName } from '../utils/format';
import {
  LogOut,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  PackagePlus,
  Warehouse,
} from 'lucide-react';

interface Props {
  user: AuthUser;
  onLogout: () => void;
  onOpenAddModal: () => void;
  onOpenFirebaseModal: () => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
  pendingSyncCount: number;
  onOpenWarehouseModal?: () => void;
  onOpenWarehouseInventoryModal?: () => void;
  warehouseCount?: number;
}

export const Navbar: React.FC<Props> = ({
  user,
  onLogout,
  onOpenAddModal,
  onTriggerSync,
  isSyncing,
  pendingSyncCount,
  onOpenWarehouseModal,
  onOpenWarehouseInventoryModal,
  warehouseCount = 0,
}) => {
  const isOnline = useOnlineStatus();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const displayName = getAgentDisplayName(user.username);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100 w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 w-full">
        {/* Zone 1: Left area - Online status & sync */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Online / Offline status badge */}
          <div
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
            }`}
            title={isOnline ? "Internetga ulangan" : "Oflayn rejim"}
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
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
            className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors border border-transparent hover:border-neutral-200 min-h-[34px] sm:min-h-[36px] cursor-pointer"
            title="Bulut bilan sinxronlash"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-neutral-600 shrink-0 ${isSyncing ? 'animate-spin text-rose-600' : ''}`}
            />
            <span className="hidden md:inline">Sinxronlash</span>
          </button>
        </div>

        {/* Zone 2: Primary Action, PWA Install & User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Admin only: Omborga mahsulotlar kiritish button */}
          {user.role === 'admin' && onOpenWarehouseModal && (
            <button
              onClick={onOpenWarehouseModal}
              className="hidden sm:flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 active:bg-black text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all min-h-[38px] sm:min-h-[44px] justify-center cursor-pointer border border-neutral-800"
              title="Omborga mahsulotlar kiritish"
            >
              <PackagePlus className="w-4 h-4 stroke-[2.2] text-rose-400 shrink-0" />
              <span className="whitespace-nowrap hidden md:inline">Omborga mahsulotlar kiritish</span>
              <span className="whitespace-nowrap md:hidden">Ombor</span>
            </button>
          )}

          {/* Main "Yangi mijoz" button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all min-h-[38px] sm:min-h-[44px] justify-center cursor-pointer"
            title="Yangi mijoz qo'shish"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" />
            <span className="whitespace-nowrap hidden sm:inline">Yangi mijoz</span>
            <span className="whitespace-nowrap sm:hidden text-xs font-bold">Mijoz</span>
          </button>

          {/* Direct Mobile Logout Button for immediate 1-tap exit */}
          <button
            type="button"
            onClick={onLogout}
            className="flex sm:hidden items-center justify-center p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100 transition min-h-[38px] min-w-[38px] cursor-pointer"
            title="Tizimdan chiqish"
            aria-label="Tizimdan chiqish"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
          </button>

          {/* User profile / Logout dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-neutral-200 hover:border-rose-200 hover:bg-rose-50/50 transition-colors text-neutral-800 text-xs font-medium min-h-[38px] sm:min-h-[44px] justify-center cursor-pointer"
              aria-label="Foydalanuvchi menyusi"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 flex items-center justify-center font-bold text-xs shrink-0 uppercase shadow-2xs">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
              <span className="hidden md:inline font-semibold text-neutral-900">
                {displayName}
              </span>
            </button>

            {showUserMenu && (
              <>
                {/* Backdrop overlay */}
                <div
                  className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs"
                  onClick={() => setShowUserMenu(false)}
                />

                {/* Dropdown Menu: Fixed on mobile, absolute on desktop */}
                <div className="fixed sm:absolute top-14 sm:top-full right-2 sm:right-0 mt-1.5 w-64 rounded-2xl bg-white shadow-2xl border border-rose-100 p-3 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2.5">
                  <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-neutral-900 truncate">
                        {displayName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200 uppercase">
                        {user.role === 'admin' ? 'Admin' : 'Agent'}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      Login: @{user.username}
                    </div>
                  </div>

                  {user.role === 'admin' && onOpenWarehouseInventoryModal && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenWarehouseInventoryModal();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Warehouse className="w-4 h-4 text-neutral-600" />
                        <span>Ombor zaxirasi</span>
                      </div>
                      {warehouseCount > 0 && (
                        <span className="text-[10px] font-bold bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded-full">
                          {warehouseCount}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Prominent Red Logout Button */}
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200 text-left cursor-pointer min-h-[40px] shadow-2xs"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Tizimdan chiqish</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
