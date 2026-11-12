import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Client, DailyPlanItem, WarehouseProduct, SystemLog, MonthlyPlan } from '../types';
import {
  getDeletedClientIds,
  markClientAsDeleted,
  getDeletedWarehouseIds,
  markWarehouseProductAsDeleted,
  getDeletedPlanIds,
  markPlanAsDeleted,
  isClosedPlanExpired7Days,
} from './storage';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence and ignoreUndefinedProperties
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  // If already initialized
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = dbInstance;
export const auth = getAuth(app);

// Helper to strip undefined fields recursively so Firestore setDoc never rejects payload
function cleanFirestoreData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

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
// Device Persistent Hardware-Anchored MAC Address & Device Info
// -------------------------------------------------------------
const DEVICE_MAC_STORAGE_KEY = 'savdo_device_mac_v1';
let cachedDeviceMac: string | null = null;

function hashString32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getClientDeviceMacAndInfo(): { macAddress: string; deviceInfo: string } {
  if (typeof window === 'undefined') {
    return { macAddress: 'DA:4F:8C:00:00:01', deviceInfo: 'Server [Web]' };
  }

  // Detect OS / Device & Mode (PWA vs Web)
  const ua = window.navigator.userAgent || '';
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const modeTag = isStandalone ? 'PWA' : 'Web';

  let osName = 'Qurilma';
  if (/android/i.test(ua)) osName = 'Android';
  else if (/iphone/i.test(ua)) osName = 'iPhone (iOS)';
  else if (/ipad/i.test(ua)) osName = 'iPad (iOS)';
  else if (/windows/i.test(ua)) osName = 'Windows PC';
  else if (/macintosh|mac os x/i.test(ua)) osName = 'MacOS';
  else if (/linux/i.test(ua)) osName = 'Linux';

  let browserName = 'Browser';
  if (/edg\//i.test(ua)) browserName = 'Edge';
  else if (/chrome|crios/i.test(ua)) browserName = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browserName = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browserName = 'Firefox';

  const deviceInfo = `${osName} • ${browserName} [${modeTag}]`;

  if (cachedDeviceMac) {
    return { macAddress: cachedDeviceMac, deviceInfo };
  }

  try {
    const storedLocal = localStorage.getItem(DEVICE_MAC_STORAGE_KEY);
    const storedCookie = readCookie(DEVICE_MAC_STORAGE_KEY);
    const existingMac = storedLocal || storedCookie;
    if (existingMac && /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(existingMac)) {
      cachedDeviceMac = existingMac.toUpperCase();
      if (!storedLocal) localStorage.setItem(DEVICE_MAC_STORAGE_KEY, cachedDeviceMac);
      if (!storedCookie) writeCookie(DEVICE_MAC_STORAGE_KEY, cachedDeviceMac);
      return { macAddress: cachedDeviceMac, deviceInfo };
    }

    // Generate deterministic hardware-prefix + unique device suffix
    const hwSignature = [
      window.navigator.platform || '',
      osName,
      window.screen?.width || 0,
      window.screen?.height || 0,
      window.screen?.colorDepth || 24,
      window.navigator.hardwareConcurrency || 4,
      (window.navigator as unknown as { deviceMemory?: number }).deviceMemory || 4,
    ].join('|');

    const hwHash = hashString32(hwSignature);
    // First byte: locally administered unicast MAC (bit 1 = 1, bit 0 = 0 -> e.g. DA, E2, F6...)
    const b0 = ((hwHash & 0xfc) | 0x02) & 0xff;
    const b1 = (hwHash >>> 8) & 0xff;
    const b2 = (hwHash >>> 16) & 0xff;

    // Last 3 bytes: unique per physical device instance
    const randSeed = Math.floor(Math.random() * 0xffffff);
    const b3 = (randSeed >>> 16) & 0xff;
    const b4 = (randSeed >>> 8) & 0xff;
    const b5 = randSeed & 0xff;

    const toHex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
    const generatedMac = [toHex(b0), toHex(b1), toHex(b2), toHex(b3), toHex(b4), toHex(b5)].join(':');

    cachedDeviceMac = generatedMac;
    localStorage.setItem(DEVICE_MAC_STORAGE_KEY, generatedMac);
    writeCookie(DEVICE_MAC_STORAGE_KEY, generatedMac);
    return { macAddress: generatedMac, deviceInfo };
  } catch {
    return { macAddress: 'DA:4F:8C:21:9B:07', deviceInfo };
  }
}

// -------------------------------------------------------------
// System Audit Log Service (with In-Memory Read/Write Cache)
// -------------------------------------------------------------
const SYSTEM_LOGS_STORAGE_KEY = 'savdo_system_logs_v1';
const SYSTEM_ARCHIVES_STORAGE_KEY = 'savdo_system_archives_v1';
let localSystemLogsCache: SystemLog[] | null = null;

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
      details: 'adminc1 boshqaruvi orqali tizimga muvaffaqiyatli kirildi. IP va MAC tekshiruvi amalga oshirildi.',
      ipAddress: '195.158.12.84',
      macAddress: 'DA:4F:8C:10:A2:01',
      deviceInfo: 'Windows PC • Chrome [Web]',
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
      macAddress: 'E2:9A:34:7B:11:C8',
      deviceInfo: 'Android • Chrome [PWA]',
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
      macAddress: 'F6:1C:55:89:4D:32',
      deviceInfo: 'iPhone (iOS) • Safari [PWA]',
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
      macAddress: 'DA:4F:8C:10:A2:01',
      deviceInfo: 'Windows PC • Chrome [Web]',
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
      macAddress: 'F6:1C:55:89:4D:32',
      deviceInfo: 'iPhone (iOS) • Safari [PWA]',
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
      macAddress: 'DA:4F:8C:10:A2:01',
      deviceInfo: 'Windows PC • Chrome [Web]',
    },
  ];
}

export function getLocalSystemLogs(): SystemLog[] {
  if (localSystemLogsCache) return localSystemLogsCache;
  try {
    const raw = localStorage.getItem(SYSTEM_LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localSystemLogsCache = parsed;
        return parsed;
      }
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
    const sliced = logs.slice(0, 500);
    localSystemLogsCache = sliced;
    localStorage.setItem(SYSTEM_LOGS_STORAGE_KEY, JSON.stringify(sliced));
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
    const CHUNK_SIZE = 400;
    for (let i = 0; i < logIds.length; i += CHUNK_SIZE) {
      const chunk = logIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        batch.delete(doc(db, 'systemLogs', id));
      });
      await batch.commit();
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
    | 'oylik_arxivlash'
    | 'reja_yopish'
    | 'reja_ochirish';
  actionTitle: string;
  details: string;
  metadata?: Record<string, any>;
}): Promise<SystemLog> {
  const ip = await getClientIpAddress();
  const { macAddress, deviceInfo } = getClientDeviceMacAndInfo();
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
    macAddress,
    deviceInfo,
    metadata: entry.metadata || {},
    createdAt: now.toISOString(),
  };

  // 1. Save immediately to LocalStorage (works offline!)
  const localLogs = [...getLocalSystemLogs()];
  localLogs.unshift(log);
  saveLocalSystemLogs(localLogs);

  // 2. Sync to Firestore (if offline, Firestore IndexedDB persistence queues it automatically)
  try {
    await setDoc(doc(db, 'systemLogs', log.id), cleanFirestoreData(log));
  } catch (err) {
    console.warn('Firestore log write deferred to offline queue:', err);
  }

  return log;
}


// -------------------------------------------------------------
// Firestore Realtime Collections Synchronizers
// -------------------------------------------------------------

// Sync Clients (Single & Batched Bulk)
export async function syncClientToFirestore(client: Client): Promise<void> {
  try {
    await setDoc(doc(db, 'clients', client.id), cleanFirestoreData(client));
  } catch (e) {
    console.warn('Deferred client sync to Firestore (offline queue)', e);
  }
}

export async function syncClientsBulkToFirestore(clients: Client[]): Promise<void> {
  if (!clients || clients.length === 0) return;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < clients.length; i += CHUNK_SIZE) {
      const chunk = clients.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (let j = 0; j < chunk.length; j++) {
        const c = chunk[j];
        batch.set(doc(db, 'clients', c.id), cleanFirestoreData(c));
      }
      await batch.commit();
    }
  } catch (e) {
    console.warn('Deferred bulk clients sync to Firestore (offline queue)', e);
  }
}

export async function deleteClientFromFirestore(
  clientId: string,
  knownPlanIds: string[] = []
): Promise<boolean> {
  markClientAsDeleted(clientId);
  try {
    // 1. Delete client document from Firestore
    await deleteDoc(doc(db, 'clients', clientId));

    // 2. Immediately delete any known dailyPlan IDs for this client
    for (const planId of knownPlanIds) {
      try {
        await deleteDoc(doc(db, 'dailyPlans', planId));
      } catch {
        // ignore individual plan delete error
      }
    }

    // 3. Cascade delete any remaining daily plans for this client from Firestore
    try {
      const plansSnap = await getDocs(collection(db, 'dailyPlans'));
      for (const pDoc of plansSnap.docs) {
        const pData = pDoc.data() as DailyPlanItem;
        if (pData.clientId === clientId) {
          await deleteDoc(pDoc.ref);
        }
      }
    } catch {
      // ignore plan cascade errors
    }

    // 4. Clean monthlyPlans in Firestore if any reference this clientId in initialClientDebts
    try {
      const mpSnap = await getDocs(collection(db, 'monthlyPlans'));
      for (const mpDoc of mpSnap.docs) {
        const mpData = mpDoc.data() as MonthlyPlan;
        if (mpData.initialClientDebts && clientId in mpData.initialClientDebts) {
          const updatedDebts = { ...mpData.initialClientDebts };
          delete updatedDebts[clientId];
          const updatedTotal = Object.values(updatedDebts).reduce(
            (sum, v) => sum + (Number(v) || 0),
            0
          );
          await setDoc(
            mpDoc.ref,
            cleanFirestoreData({
              ...mpData,
              initialClientDebts: updatedDebts,
              initialTotalDebt: updatedTotal,
            })
          );
        }
      }
    } catch {
      // ignore monthly plan cascade errors
    }

    return true;
  } catch (e) {
    console.error('Failed to delete client from Firestore:', e);
    return false;
  }
}

function preparePlanPayloadForFirestore(plan: DailyPlanItem): any {
  const payload: any = cleanFirestoreData(plan);
  if (!plan.isClosed && plan.status !== 'yopildi') {
    payload.isClosed = false;
    payload.closedWithoutAction = false;
    payload.unperformedClose = null;
    payload.closedAt = null;
    payload.closedDisplayDate = null;
    payload.closedUpdatedAt = null;
    payload.closedBy = null;
    payload.closeReason = null;
    if (!payload.status || payload.status === 'yopildi') {
      payload.status = 'rejalashtirilgan';
    }
  } else {
    const displayClosedAt =
      (plan as any).closedDisplayDate || plan.closedAt || new Date().toISOString();
    payload.isClosed = true;
    payload.status = 'yopildi';
    payload.closedDisplayDate = displayClosedAt;
    // Keep raw closedAt fresh so older cached clients/PWAs never treat historical close dates as >7d expired
    payload.closedAt = new Date().toISOString();
    payload.unperformedClose = Boolean(plan.closedWithoutAction);
    payload.closedWithoutAction = Boolean(plan.closedWithoutAction);
    payload.reopenedAt = null;
    payload.reopenedBy = null;
    payload.reopenReason = null;
  }
  return payload;
}

export function normalizeIncomingPlanFromFirestore(raw: any): DailyPlanItem {
  if (!raw || typeof raw !== 'object') return raw as DailyPlanItem;
  const item: any = { ...raw };
  if (item.isClosed || item.status === 'yopildi') {
    if (item.closedDisplayDate) {
      item.closedAt = item.closedDisplayDate;
    }
    if (item.unperformedClose !== undefined && item.unperformedClose !== null) {
      item.closedWithoutAction = Boolean(item.unperformedClose);
    } else {
      item.closedWithoutAction = Boolean(item.closedWithoutAction);
    }
  }
  return item as DailyPlanItem;
}

// Sync Daily Plans (Single & Batched Bulk)
export async function syncPlanToFirestore(plan: DailyPlanItem): Promise<void> {
  try {
    const payload = preparePlanPayloadForFirestore(plan);
    await setDoc(doc(db, 'dailyPlans', plan.id), payload);
  } catch (e) {
    console.warn('Deferred plan sync to Firestore (offline queue)', e);
  }
}

export async function syncPlansBulkToFirestore(plans: DailyPlanItem[]): Promise<void> {
  if (!plans || plans.length === 0) return;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < plans.length; i += CHUNK_SIZE) {
      const chunk = plans.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (let j = 0; j < chunk.length; j++) {
        const p = chunk[j];
        const payload = preparePlanPayloadForFirestore(p);
        batch.set(doc(db, 'dailyPlans', p.id), payload);
      }
      await batch.commit();
    }
  } catch (e) {
    console.warn('Deferred bulk daily plans sync to Firestore', e);
  }
}

export async function deletePlanFromFirestore(planId: string): Promise<void> {
  try {
    markPlanAsDeleted(planId);
    await deleteDoc(doc(db, 'dailyPlans', planId));
  } catch (e) {
    console.warn('Deferred plan delete from Firestore', e);
  }
}

// Sync Warehouse Products
export async function syncWarehouseProductToFirestore(product: WarehouseProduct): Promise<void> {
  try {
    await setDoc(doc(db, 'warehouseProducts', product.id), cleanFirestoreData(product));
  } catch (e) {
    console.warn('Deferred warehouse sync to Firestore (offline queue)', e);
  }
}

export async function syncWarehouseProductsBulkToFirestore(
  products: WarehouseProduct[]
): Promise<void> {
  if (!products || products.length === 0) return;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (let j = 0; j < chunk.length; j++) {
        const p = chunk[j];
        batch.set(doc(db, 'warehouseProducts', p.id), cleanFirestoreData(p));
      }
      await batch.commit();
    }
  } catch (e) {
    console.warn('Deferred bulk warehouse sync to Firestore (offline queue)', e);
  }
}

export async function deleteWarehouseProductFromFirestore(productId: string): Promise<void> {
  try {
    markWarehouseProductAsDeleted(productId);
    await deleteDoc(doc(db, 'warehouseProducts', productId));
  } catch (e) {
    console.warn('Deferred warehouse delete from Firestore', e);
  }
}

// Sync Monthly Plans
export async function syncMonthlyPlanToFirestore(plan: MonthlyPlan): Promise<void> {
  try {
    await setDoc(doc(db, 'monthlyPlans', plan.id), cleanFirestoreData(plan));
  } catch (e) {
    console.warn('Deferred monthly plan sync to Firestore', e);
  }
}

export async function deleteMonthlyPlanFromFirestore(planId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'monthlyPlans', planId));
  } catch (e) {
    console.warn('Deferred monthly plan delete from Firestore', e);
  }
}

// Ultra-responsive snapshot helper (immediate emission on every remote snapshot change)
function createDebouncedCallback<T>(fn: ((data: T) => void) | undefined, delayMs = 0) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const invoke = (data: T) => {
    if (!fn) return;
    if (delayMs <= 0) {
      fn(data);
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(data);
    }, delayMs);
  };
  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return { invoke, cancel };
}

// Subscribe to real-time updates from Firestore
export function subscribeToFirestoreData(callbacks: {
  onClientsChange?: (clients: Client[]) => void;
  onPlansChange?: (plans: DailyPlanItem[]) => void;
  onWarehouseChange?: (products: WarehouseProduct[]) => void;
  onLogsChange?: (logs: SystemLog[]) => void;
  onMonthlyPlansChange?: (plans: MonthlyPlan[]) => void;
}) {
  const unsubscribers: (() => void)[] = [];

  // Monthly plans listener
  if (callbacks.onMonthlyPlansChange) {
    const debounced = createDebouncedCallback(callbacks.onMonthlyPlansChange, 0);
    const unsub = onSnapshot(
      collection(db, 'monthlyPlans'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const list: MonthlyPlan[] = [];
        snapshot.forEach((d) => list.push(d.data() as MonthlyPlan));
        debounced.invoke(list);
      },
      (error) => {
        console.warn('Monthly plans listener error (offline mode):', error.message);
      }
    );
    unsubscribers.push(() => {
      debounced.cancel();
      unsub();
    });
  }

  // Clients listener
  if (callbacks.onClientsChange) {
    const debounced = createDebouncedCallback(callbacks.onClientsChange, 0);
    const unsub = onSnapshot(
      collection(db, 'clients'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const deletedIds = getDeletedClientIds();
        const list: Client[] = [];
        snapshot.forEach((d) => {
          if (!deletedIds.has(d.id)) {
            list.push(d.data() as Client);
          } else {
            // Document was marked deleted, ensure purged in Firestore too
            deleteDoc(d.ref).catch(() => {});
          }
        });
        debounced.invoke(list);
      },
      (error) => {
        console.warn('Clients snapshot listener error (offline mode active):', error.message);
      }
    );
    unsubscribers.push(() => {
      debounced.cancel();
      unsub();
    });
  }

  // Daily plans listener
  if (callbacks.onPlansChange) {
    const debounced = createDebouncedCallback(callbacks.onPlansChange, 0);
    const unsub = onSnapshot(
      collection(db, 'dailyPlans'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const deletedIds = getDeletedClientIds();
        const deletedPlanIds = getDeletedPlanIds();
        const list: DailyPlanItem[] = [];
        snapshot.forEach((d) => {
          const item = normalizeIncomingPlanFromFirestore(d.data());
          if (
            item &&
            item.clientId &&
            !deletedIds.has(item.clientId) &&
            !deletedPlanIds.has(item.id) &&
            !isClosedPlanExpired7Days(item)
          ) {
            list.push(item);
          } else if (item && (deletedIds.has(item.clientId) || deletedPlanIds.has(item.id))) {
            deleteDoc(d.ref).catch(() => {});
          }
        });
        debounced.invoke(list);
      },
      (error) => {
        console.warn('Plans snapshot listener error (offline mode active):', error.message);
      }
    );
    unsubscribers.push(() => {
      debounced.cancel();
      unsub();
    });
  }

  // Warehouse products listener
  if (callbacks.onWarehouseChange) {
    const debounced = createDebouncedCallback(callbacks.onWarehouseChange, 0);
    const unsub = onSnapshot(
      collection(db, 'warehouseProducts'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const deletedWhIds = getDeletedWarehouseIds();
        const list: WarehouseProduct[] = [];
        snapshot.forEach((d) => {
          if (!deletedWhIds.has(d.id)) {
            list.push(d.data() as WarehouseProduct);
          } else {
            // Document was marked deleted, ensure purged in Firestore too
            deleteDoc(d.ref).catch(() => {});
          }
        });
        debounced.invoke(list);
      },
      (error) => {
        console.warn('Warehouse snapshot listener error (offline mode active):', error.message);
      }
    );
    unsubscribers.push(() => {
      debounced.cancel();
      unsub();
    });
  }

  // System logs listener (also propagates deleted client & warehouse IDs across all sessions/agents)
  if (callbacks.onLogsChange) {
    const debounced = createDebouncedCallback(callbacks.onLogsChange, 0);
    const unsub = onSnapshot(
      collection(db, 'systemLogs'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const list: SystemLog[] = [];
        snapshot.forEach((d) => {
          const logItem = d.data() as SystemLog;
          list.push(logItem);
          if (logItem.actionType === 'mijoz_ochirish') {
            const delId =
              logItem.metadata?.deletedClientId || logItem.metadata?.clientId;
            if (delId && typeof delId === 'string') {
              markClientAsDeleted(delId);
            }
          }
          if (logItem.actionType === 'ombor_ochirish') {
            const delWhId =
              logItem.metadata?.deletedWarehouseId || logItem.metadata?.productId;
            if (delWhId && typeof delWhId === 'string') {
              markWarehouseProductAsDeleted(delWhId);
            }
          }
        });
        list.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        debounced.invoke(list);
      },
      (error) => {
        console.warn('System logs snapshot listener error (offline mode active):', error.message);
      }
    );
    unsubscribers.push(() => {
      debounced.cancel();
      unsub();
    });
  }

  return () => {
    unsubscribers.forEach((fn) => fn());
  };
}

// Initial full sync push: upload existing local items to Firestore if remote is empty
const BOOTSTRAP_FLAG_KEY = 'savdo_firestore_bootstrapped_v1';

export async function bootstrapFirestoreData(
  localClients: Client[],
  localPlans: DailyPlanItem[],
  localWarehouse: WarehouseProduct[]
): Promise<void> {
  // Agar bu brauzerda allaqachon tekshirilgan bo'lsa, qayta og'ir so'rov yubormaymiz
  if (typeof window !== 'undefined' && localStorage.getItem(BOOTSTRAP_FLAG_KEY)) {
    return;
  }
  try {
    const deletedIds = getDeletedClientIds();
    const deletedWhIds = getDeletedWarehouseIds();

    const clientSnap = await getDocs(collection(db, 'clients'));
    if (clientSnap.empty) {
      const toUploadClients = localClients.filter((c) => !deletedIds.has(c.id));
      for (const c of toUploadClients) {
        await setDoc(doc(db, 'clients', c.id), cleanFirestoreData(c));
      }
    }

    const plansSnap = await getDocs(collection(db, 'dailyPlans'));
    if (plansSnap.empty) {
      const toUploadPlans = localPlans.filter((p) => !deletedIds.has(p.clientId));
      for (const p of toUploadPlans) {
        await setDoc(doc(db, 'dailyPlans', p.id), cleanFirestoreData(p));
      }
    }

    const whSnap = await getDocs(collection(db, 'warehouseProducts'));
    if (whSnap.empty) {
      const toUploadWarehouse = localWarehouse.filter((w) => !deletedWhIds.has(w.id));
      for (const w of toUploadWarehouse) {
        await setDoc(doc(db, 'warehouseProducts', w.id), cleanFirestoreData(w));
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(BOOTSTRAP_FLAG_KEY, 'true');
    }
  } catch (err) {
    console.warn('Bootstrap upload deferred to offline persistence queue', err);
  }
}

// Active Server Pull: Ensures PWA & Web on any device stay 100% in sync with live Firestore
// even after background sleep, network switches, or WebChannel idle periods
export async function pullAllFromFirestoreServer(callbacks: {
  onClientsChange?: (clients: Client[]) => void;
  onPlansChange?: (plans: DailyPlanItem[]) => void;
  onWarehouseChange?: (products: WarehouseProduct[]) => void;
  onLogsChange?: (logs: SystemLog[]) => void;
  onMonthlyPlansChange?: (plans: MonthlyPlan[]) => void;
}): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const fetchCollection = async (colName: string) => {
    try {
      return await getDocsFromServer(collection(db, colName));
    } catch {
      return await getDocs(collection(db, colName));
    }
  };

  try {
    const deletedIds = getDeletedClientIds();
    const deletedWhIds = getDeletedWarehouseIds();

    await Promise.all([
      (async () => {
        if (!callbacks.onClientsChange) return;
        const snap = await fetchCollection('clients');
        const list: Client[] = [];
        snap.forEach((d) => {
          if (!deletedIds.has(d.id)) {
            list.push(d.data() as Client);
          }
        });
        callbacks.onClientsChange(list);
      })(),
      (async () => {
        if (!callbacks.onPlansChange) return;
        const deletedPlanIds = getDeletedPlanIds();
        const snap = await fetchCollection('dailyPlans');
        const list: DailyPlanItem[] = [];
        snap.forEach((d) => {
          const item = normalizeIncomingPlanFromFirestore(d.data());
          if (
            item &&
            item.clientId &&
            !deletedIds.has(item.clientId) &&
            !deletedPlanIds.has(item.id) &&
            !isClosedPlanExpired7Days(item)
          ) {
            list.push(item);
          }
        });
        callbacks.onPlansChange(list);
      })(),
      (async () => {
        if (!callbacks.onWarehouseChange) return;
        const snap = await fetchCollection('warehouseProducts');
        const list: WarehouseProduct[] = [];
        snap.forEach((d) => {
          if (!deletedWhIds.has(d.id)) {
            list.push(d.data() as WarehouseProduct);
          }
        });
        callbacks.onWarehouseChange(list);
      })(),
      (async () => {
        if (!callbacks.onMonthlyPlansChange) return;
        const snap = await fetchCollection('monthlyPlans');
        const list: MonthlyPlan[] = [];
        snap.forEach((d) => list.push(d.data() as MonthlyPlan));
        callbacks.onMonthlyPlansChange(list);
      })(),
      (async () => {
        if (!callbacks.onLogsChange) return;
        const snap = await fetchCollection('systemLogs');
        const list: SystemLog[] = [];
        snap.forEach((d) => {
          const logItem = d.data() as SystemLog;
          list.push(logItem);
          if (logItem.actionType === 'mijoz_ochirish') {
            const delId = logItem.metadata?.deletedClientId || logItem.metadata?.clientId;
            if (delId && typeof delId === 'string') markClientAsDeleted(delId);
          }
          if (logItem.actionType === 'ombor_ochirish') {
            const delWhId = logItem.metadata?.deletedWarehouseId || logItem.metadata?.productId;
            if (delWhId && typeof delWhId === 'string') markWarehouseProductAsDeleted(delWhId);
          }
        });
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        callbacks.onLogsChange(list);
      })(),
    ]);
  } catch (err) {
    console.warn('Background server pull skipped (offline or reconnecting):', err);
  }
}
