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

export function getLocalSystemLogs(): SystemLog[] {
  try {
    const raw = localStorage.getItem(SYSTEM_LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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
    | 'ombor_ochirish';
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
        if (!snapshot.empty) {
          const list: SystemLog[] = [];
          snapshot.forEach((d) => list.push(d.data() as SystemLog));
          list.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          callbacks.onLogsChange?.(list);
        }
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
