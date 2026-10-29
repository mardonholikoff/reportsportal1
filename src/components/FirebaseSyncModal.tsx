import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatDate } from '../utils/format';
import {
  X,
  Cloud,
  CheckCircle,
  RefreshCw,
  Download,
  Upload,
  Database,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted: () => void;
}

export const FirebaseSyncModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSyncCompleted,
}) => {
  const isOnline = useOnlineStatus();
  const [projectId, setProjectId] = useState('');
  const [collectionName, setCollectionName] = useState('clients_ledger');
  const [autoSync, setAutoSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = storageService.getFirebaseConfig();
      if (cfg) {
        setProjectId(cfg.projectId || '');
        setCollectionName(cfg.collectionName || 'clients_ledger');
        setAutoSync(cfg.autoSync ?? true);
      }
      setQueueCount(storageService.getSyncQueue().length);
      setLastSyncTime(storageService.getLastSyncedTime());
      setSyncMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    storageService.saveFirebaseConfig({
      projectId: projectId.trim(),
      collectionName: collectionName.trim(),
      autoSync,
    });
    setSyncMessage("Firebase sozlamalari muvaffaqiyatli saqlandi.");
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    const res = await storageService.syncWithCloud();
    setIsSyncing(false);
    setSyncMessage(res.message);
    setQueueCount(storageService.getSyncQueue().length);
    setLastSyncTime(storageService.getLastSyncedTime());
    onSyncCompleted();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = storageService.importFromJSON(content);
      if (res.success) {
        setSyncMessage(`Muvaffaqiyatli tiklandi: ${res.count} ta mijoz kiritildi.`);
        onSyncCompleted();
      } else {
        setSyncMessage(`Xatolik: ${res.error}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-rose-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50 via-white to-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-700 text-white flex items-center justify-center shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900">
                Oflayn & Firebase Bulut Sinxronizatsiyasi
              </h2>
              <p className="text-xs text-neutral-500">
                Lokal xotira, zaxira va kelgusi Firebase Firestore ulanishi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center min-h-[44px] min-w-[44px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {syncMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900">
              <CheckCircle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{syncMessage}</span>
            </div>
          )}

          {/* Current Status Box */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
                Tarmoq va Sinxron holati
              </span>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isOnline
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Internet bor (Onlayn)</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-rose-700" />
                    <span>Oflayn rejim</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-neutral-500 block">Kutilayotgan o'zgarishlar:</span>
                <span className="font-bold font-mono text-neutral-900 text-sm">
                  {queueCount} ta amaliyot
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Oxirgi sinxron vaqti:</span>
                <span className="font-semibold text-neutral-800 text-xs">
                  {lastSyncTime ? formatDate(lastSyncTime) : "Hali qilinmagan"}
                </span>
              </div>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition disabled:opacity-50 min-h-[44px]"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? "Sinxronlanmoqda..." : "Hozir sinxronlash (Sync Now)"}</span>
            </button>
          </div>

          {/* Firebase Credentials Configuration */}
          <form onSubmit={handleSaveConfig} className="space-y-3 pt-2 border-t border-neutral-200">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-rose-700" />
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                Google Firebase Firestore sozlamalari
              </h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Google Firebase loyihangizni ulaganingizda, barcha yangi mijozlar, tovarlar va qarzlar avtomatik tarzda bulutga yoziladi va qurilmalar o'rtasida yangilanadi.
            </p>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Firebase Project ID (Loyixa identifikatori)
              </label>
              <input
                type="text"
                placeholder="Masalan: savdo-nazorat-app"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-rose-500 text-xs font-mono text-neutral-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Firestore Kolleksiya nomi
              </label>
              <input
                type="text"
                placeholder="clients_ledger"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-rose-500 text-xs font-mono text-neutral-900 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoSyncCheck"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-neutral-300 focus:ring-rose-500"
              />
              <label htmlFor="autoSyncCheck" className="text-xs font-medium text-neutral-800 cursor-pointer">
                Internet paydo bo'lganda avtomatik sinxronlash
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold transition min-h-[40px]"
              >
                Sozlamalarni saqlash
              </button>
            </div>
          </form>

          {/* Backup / Restore section */}
          <div className="pt-3 border-t border-neutral-200 space-y-3">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
              Lokal Zaxira va Eksport
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => storageService.exportToJSON()}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-800 transition min-h-[40px]"
              >
                <Download className="w-3.5 h-3.5 text-neutral-600" />
                <span>Zaxira nusxa (JSON)</span>
              </button>

              <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-800 transition min-h-[40px] cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-neutral-600" />
                <span>Nusxadan tiklash</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileImport}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-semibold min-h-[40px]"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
