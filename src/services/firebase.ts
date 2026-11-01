import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Client, DailyPlanItem, WarehouseProduct, SystemLog } from '../types';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  }, firebaseConfig.firestoreDatabaseId);
} catch {
  // If already initialized
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = dbInstance;
export const auth = getAuth(app);

// Connection test helper
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'systemConfig', 'connection_test'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline. Offline cache will be used.');
    }
    return false;
  }
}

// Client IP detection cache
let cachedIpAddress: string | null = null;

export async function getClientIpAddress(): Promise<string> {
  if (cachedIpAddress) return cachedIpAddress;
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        cachedIpAddress = data.ip;
        return data.ip;
      }
    }
  } catch {
    // Offline or network restricted
  }
  cachedIpAddress = '192.168.1.104 (mahalliy)';
  return cachedIpAddress;
}

// -------------------------------------------------------------
// System Audit Log Service
// -------------------------------------------------------------
const SYSTEM_LOGS_STORAGE_KEY = 'savdo_system_logs_v1';
const SYSTEM_ARCHIVES_STORAGE_KEY = 'savdo_system_archives_v1';

// Seed initial realistic logs for previous and current months if local storage is blank
function getInitialSampleLogs(): SystemLog[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Dates for current month and previous month
  const prevMonthDate = new Date(currentYear, currentMonth - 1, 15, 14, 30, 0);
  const prevMonthDate2 = new Date(currentYear, currentMonth - 1, 22, 10, 15, 0);
  const prevMonthDate3 = new Date(currentYear, currentMonth - 1, 28, 16, 45, 0);
  const currMonthDate1 = new Date(currentYear, currentMonth, 2, 9, 0, 0);
  const currMonthDate2 = new Date(currentYear, currentMonth, 5, 11, 20, 0);
  const currMonthDate3 = new Date(currentYear, currentMonth, 10, 15, 10, 0);

  return [
    {
      id: 'log_seed_6',
      timestamp: currMonthDate3.toISOString(),
      userId: 'adminc1',
      userRole: 'admin',
      actionType: 'kirish',
      actionTitle: 'Tizimga kirish (adminc1 nazorat seansi)',
      details: 'adminc1 boshqaruvi orqali tizimga muvaffaqiyatli kirildi. IP tekshiruvi amalga oshirildi.',
      ipAddress: '195.158.12.84',
    },
    {
      id: 'log_seed_5',
      timestamp: currMonthDate2.toISOString(),
      userId: 'agentc1',
      userRole: 'agent',
      actionType: 'amal_bajarish',
      actionTitle: 'Mijoz bilan amal: Jamshidbek Nurmatov',
      details: 'Joyiga borildi va to\'lov qabul qilindi: 1 500 000 so\'m (naqd). Qarzdorlik kamaytirildi.',
      ipAddress: '84.54.80.19',
    },
    {
      id: 'log_seed_4',
      timestamp: currMonthDate1.toISOString(),
      userId: 'agentp1',
      userRole: 'agent',
      actionType: 'reja_tuzish',
      actionTitle: 'Kunlik savdo rejasi tuzildi (3 ta mijoz)',
      details: 'Akromjon Karimov, Jamshidbek Nurmatov, Nodirbek Aliyev rejaga kiritildi va tasdiqlandi.',
      ipAddress: '84.54.80.19',
    },
    {
      id: 'log_seed_3',
      timestamp: prevMonthDate3.toISOString(),
      userId: 'adminc',
      userRole: 'admin',
      actionType: 'ombor_kirimi',
      actionTitle: 'Omborga kirim: Castrol - Magnatec Motor moyi',
      details: '20 korobka (80 dona, 400 litr) qabul qilindi. Umumiy summa: 30 400 000 so\'m.',
      ipAddress: '195.158.12.84',
    },
    {
      id: 'log_seed_2',
      timestamp: prevMonthDate2.toISOString(),
      userId: 'agentp1',
      userRole: 'agent',
      actionType: 'tushum_qabul',
      actionTitle: 'To\'lov qabul qilindi: Dilshod Rahimov',
      details: 'Bank o\'tkazmasi orqali 4 200 000 so\'m qabul qilindi va hisobga o\'tkazildi.',
      ipAddress: '84.54.80.25',
    },
    {
      id: 'log_seed_1',
      timestamp: prevMonthDate.toISOString(),
      userId: 'adminc1',
      userRole: 'admin',
      actionType: 'kirish',
      actionTitle: 'Tizimga kirish va xavfsizlik audit tekshiruvi',
      details: 'adminc1 orqali tizim loglari va agentlar amallari nazorat qilindi.',
      ipAddress: '195.158.12.84',
    },
  ];
}

export function getLocalSystemLogs(): SystemLog[] {
  try {
    const raw = localStorage.getItem(SYSTEM_LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const sample = getInitialSampleLogs();
    saveLocalSystemLogs(sample);
    return sample;
  } catch {
    return [];
  }
}

export function saveLocalSystemLogs(logs: SystemLog[]): void {
  try {
    localStorage.setItem(SYSTEM_LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 500)));
  } catch (e) {
    console.error('Failed to save local system logs', e);
  }
}

export function deleteLocalSystemLogs(logIds: string[]): void {
  try {
    const current = getLocalSystemLogs();
    const idSet = new Set(logIds);
    const updated = current.filter((l) => !idSet.has(l.id));
    saveLocalSystemLogs(updated);
  } catch (err) {
    console.error('Failed to delete local system logs', err);
  }
}

export async function deleteSystemLogsFromFirestore(logIds: string[]): Promise<void> {
  try {
    for (const id of logIds) {
      await deleteDoc(doc(db, 'systemLogs', id));
    }
  } catch (err) {
    console.warn('Deferred system logs deletion from Firestore:', err);
  }
}

// 15-Day Period Archives Storage
const SYSTEM_PERIOD_ARCHIVES_STORAGE_KEY = 'savdo_system_15day_archives_v1';

export function getPeriodArchives(): import('../types').SystemLogPeriodArchive[] {
  try {
    const raw = localStorage.getItem(SYSTEM_PERIOD_ARCHIVES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePeriodArchive(archive: import('../types').SystemLogPeriodArchive): void {
  try {
    const current = getPeriodArchives();
    const existingIdx = current.findIndex((a) => a.periodKey === archive.periodKey);
    if (existingIdx >= 0) {
      current[existingIdx] = archive;
    } else {
      current.unshift(archive);
    }
    localStorage.setItem(SYSTEM_PERIOD_ARCHIVES_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to save 15-day period archive', e);
  }
}

export function deletePeriodArchive(id: string): void {
  try {
    const current = getPeriodArchives();
    const updated = current.filter((a) => a.id !== id);
    localStorage.setItem(SYSTEM_PERIOD_ARCHIVES_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete period archive', e);
  }
}

// Monthly Archive Records Storage (legacy compatibility)
export function getArchiveRecords(): import('../types').SystemLogMonthlyArchiveRecord[] {
  try {
    const raw = localStorage.getItem(SYSTEM_ARCHIVES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveArchiveRecord(record: import('../types').SystemLogMonthlyArchiveRecord): void {
  try {
    const current = getArchiveRecords();
    current.unshift(record);
    localStorage.setItem(SYSTEM_ARCHIVES_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to save archive record', e);
  }
}


export async function addSystemLog(entry: {
  userId: string;
  userRole: 'admin' | 'agent';
  actionType:
    | 'kirish'
    | 'chiqish'
    | 'reja_tuzish'
    | 'amal_bajarish'
    | 'tushum_qabul'
    | 'mahsulot_topshirish'
    | 'mahsulot_qaytishi'
    | 'mijoz_yaratish'
    | 'mijoz_tahrirlash'
    | 'mijoz_ochirish'
    | 'ombor_kirimi'
    | 'ombor_ochirish'
    | 'oylik_arxivlash';
  actionTitle: string;
  details: string;
  metadata?: Record<string, any>;
}): Promise<SystemLog> {
  const ip = await getClientIpAddress();
  const now = new Date();
  const log: SystemLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    timestamp: now.toISOString(),
    userId: entry.userId,
    userRole: entry.userRole,
    actionType: entry.actionType,
    actionTitle: entry.actionTitle,
    details: entry.details,
    ipAddress: ip,
    metadata: entry.metadata || {},
    createdAt: now.toISOString(),
  };

  // 1. Save immediately to LocalStorage (works offline!)
  const localLogs = getLocalSystemLogs();
  localLogs.unshift(log);
  saveLocalSystemLogs(localLogs);

  // 2. Sync to Firestore (if offline, Firestore IndexedDB persistence queues it automatically)
  try {
    await setDoc(doc(db, 'systemLogs', log.id), log);
  } catch (err) {
    console.warn('Firestore log write deferred to offline queue:', err);
  }

  return log;
}


// -------------------------------------------------------------
// Firestore Realtime Collections Synchronizers
// -------------------------------------------------------------

// Sync Clients
export async function syncClientToFirestore(client: Client): Promise<void> {
  try {
    await setDoc(doc(db, 'clients', client.id), client);
  } catch (e) {
    console.warn('Deferred client sync to Firestore (offline queue)', e);
  }
}

export async function deleteClientFromFirestore(clientId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'clients', clientId));
  } catch (e) {
    console.warn('Deferred client delete from Firestore', e);
  }
}

// Sync Daily Plans
export async function syncPlanToFirestore(plan: DailyPlanItem): Promise<void> {
  try {
    await setDoc(doc(db, 'dailyPlans', plan.id), plan);
  } catch (e) {
    console.warn('Deferred plan sync to Firestore (offline queue)', e);
  }
}

export async function deletePlanFromFirestore(planId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'dailyPlans', planId));
  } catch (e) {
    console.warn('Deferred plan delete from Firestore', e);
  }
}

// Sync Warehouse Products
export async function syncWarehouseProductToFirestore(product: WarehouseProduct): Promise<void> {
  try {
    await setDoc(doc(db, 'warehouseProducts', product.id), product);
  } catch (e) {
    console.warn('Deferred warehouse sync to Firestore (offline queue)', e);
  }
}

export async function deleteWarehouseProductFromFirestore(productId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'warehouseProducts', productId));
  } catch (e) {
    console.warn('Deferred warehouse delete from Firestore', e);
  }
}

// Subscribe to real-time updates from Firestore
export function subscribeToFirestoreData(callbacks: {
  onClientsChange?: (clients: Client[]) => void;
  onPlansChange?: (plans: DailyPlanItem[]) => void;
  onWarehouseChange?: (products: WarehouseProduct[]) => void;
  onLogsChange?: (logs: SystemLog[]) => void;
}) {
  const unsubscribers: (() => void)[] = [];

  // Clients listener
  if (callbacks.onClientsChange) {
    const unsub = onSnapshot(
      collection(db, 'clients'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Client[] = [];
          snapshot.forEach((d) => list.push(d.data() as Client));
          callbacks.onClientsChange?.(list);
        }
      },
      (error) => {
        console.warn('Clients snapshot listener error (offline mode active):', error.message);
      }
    );
    unsubscribers.push(unsub);
  }

  // Daily plans listener
  if (callbacks.onPlansChange) {
    const unsub = onSnapshot(
      collection(db, 'dailyPlans'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: DailyPlanItem[] = [];
          snapshot.forEach((d) => list.push(d.data() as DailyPlanItem));
          callbacks.onPlansChange?.(list);
        }
      },
      (error) => {
        console.warn('Plans snapshot listener error (offline mode active):', error.message);
      }
    );
    unsubscribers.push(unsub);
  }

  // Warehouse products listener
  if (callbacks.onWarehouseChange) {
    const unsub = onSnapshot(
      collection(db, 'warehouseProducts'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: WarehouseProduct[] = [];
          snapshot.forEach((d) => list.push(d.data() as WarehouseProduct));
          callbacks.onWarehouseChange?.(list);
        }
      },
      (error) => {
        console.warn('Warehouse snapshot listener error (offline mode active):', error.message);
      }
    );
    unsubscribers.push(unsub);
  }

  // System logs listener
  if (callbacks.onLogsChange) {
    const unsub = onSnapshot(
      collection(db, 'systemLogs'),
      (snapshot) => {
        const list: SystemLog[] = [];
        snapshot.forEach((d) => list.push(d.data() as SystemLog));
        list.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        callbacks.onLogsChange?.(list);
      },
      (error) => {
        console.warn('System logs snapshot listener error (offline mode active):', error.message);
      }
    );
    unsubscribers.push(unsub);
  }

  return () => {
    unsubscribers.forEach((fn) => fn());
  };
}

// Initial full sync push: upload existing local items to Firestore if remote is empty
export async function bootstrapFirestoreData(
  localClients: Client[],
  localPlans: DailyPlanItem[],
  localWarehouse: WarehouseProduct[]
): Promise<void> {
  try {
    const clientSnap = await getDocs(collection(db, 'clients'));
    if (clientSnap.empty && localClients.length > 0) {
      for (const c of localClients) {
        await setDoc(doc(db, 'clients', c.id), c);
      }
    }

    const plansSnap = await getDocs(collection(db, 'dailyPlans'));
    if (plansSnap.empty && localPlans.length > 0) {
      for (const p of localPlans) {
        await setDoc(doc(db, 'dailyPlans', p.id), p);
      }
    }

    const whSnap = await getDocs(collection(db, 'warehouseProducts'));
    if (whSnap.empty && localWarehouse.length > 0) {
      for (const w of localWarehouse) {
        await setDoc(doc(db, 'warehouseProducts', w.id), w);
      }
    }
  } catch (err) {
    console.warn('Bootstrap upload deferred to offline persistence queue', err);
  }
}
