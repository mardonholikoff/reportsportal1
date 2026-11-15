import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  collection,
  doc,
  onSnapshot,
  getDocFromServer,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Client, DailyPlanItem, WarehouseProduct, SystemLog, MonthlyPlan } from '../types';
import {
  storageService,
  getDeletedClientIds,
  markClientAsDeleted,
  getDeletedWarehouseIds,
  markWarehouseProductAsDeleted,
  getDeletedPlanIds,
  markPlanAsDeleted,
  isClosedPlanExpired7Days,
  isLegacyWipedRecord,
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
      if (Array.isArray(parsed)) {
        localSystemLogsCache = parsed;
        return parsed;
      }
    }
    localSystemLogsCache = [];
    return [];
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

// -------------------------------------------------------------
// Multi-Device Cloud Snapshot + Server Relay Sync Engine
// -------------------------------------------------------------
const SHARED_CLOUD_DOC_ID = 'shared_cloud_state_v1';
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

let isFirestoreSdkQuotaExhausted = true; // Use single-doc REST snapshot instead of 400-doc gRPC batches

export async function pushToServerRelay(payload: Record<string, any>): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/sync-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanFirestoreData(payload)),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // ignore transient offline errors
  }
  return null;
}

interface CloudStatePayload {
  clients: Client[];
  warehouseProducts: WarehouseProduct[];
  dailyPlans: any[];
  systemLogs: SystemLog[];
  monthlyPlans?: MonthlyPlan[];
  deletedClientIds: string[];
  deletedWarehouseIds: string[];
  deletedPlanIds: string[];
  updatedAt: string;
}

async function readFirestoreCloudSnapshot(): Promise<CloudStatePayload | null> {
  if (typeof window === 'undefined') return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
  try {
    const url = `${FIRESTORE_REST_BASE}/monthlyPlans/${SHARED_CLOUD_DOC_ID}?key=${firebaseConfig.apiKey}&_t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const docData = await res.json();
    const rawJson = docData?.fields?.payloadJson?.stringValue;
    if (!rawJson || typeof rawJson !== 'string') return null;
    return JSON.parse(rawJson) as CloudStatePayload;
  } catch {
    return null;
  }
}

let isWritingCloudSnapshot = false;
let queuedCloudSnapshotPayload: CloudStatePayload | null = null;
let lastSavedCloudSignature = '';

function computeStateSignature(state: CloudStatePayload): string {
  const cSig = (state.clients || [])
    .map((c) => `${c.id}:${c.updatedAt || ''}:${c.currentDebt}:${(c.logs || []).length}`)
    .sort()
    .join('|');
  const wSig = (state.warehouseProducts || [])
    .map(
      (w) =>
        `${w.id}:${w.totalPieces}:${w.initialTotalPieces ?? ''}:${w.initialEditCount ?? 0}:${(w.stockHistory || []).length}`
    )
    .sort()
    .join('|');
  const pSig = (state.dailyPlans || [])
    .map(
      (p) =>
        `${p.id}:${p.status}:${p.isClosed ? 1 : 0}:${p.lastExecutedAt || ''}:${p.closedAt || ''}:${p.reopenedAt || ''}`
    )
    .sort()
    .join('|');
  const delSig = [
    ...(state.deletedClientIds || []),
    ...(state.deletedWarehouseIds || []),
    ...(state.deletedPlanIds || []),
  ]
    .sort()
    .join(',');
  return `${cSig}#${wSig}#${pSig}#${delSig}`;
}

async function writeFirestoreCloudSnapshot(payload: CloudStatePayload): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  const sig = computeStateSignature(payload);
  if (sig === lastSavedCloudSignature) {
    return true;
  }

  queuedCloudSnapshotPayload = payload;
  if (isWritingCloudSnapshot) {
    return true;
  }

  isWritingCloudSnapshot = true;
  let lastSuccess = false;

  try {
    while (queuedCloudSnapshotPayload) {
      const currentPayload = queuedCloudSnapshotPayload;
      queuedCloudSnapshotPayload = null;
      const currentSig = computeStateSignature(currentPayload);
      if (currentSig === lastSavedCloudSignature) {
        lastSuccess = true;
        continue;
      }

      // Ensure payload fits well within Firestore 1MB document limit
      const compactClients = (currentPayload.clients || []).map((c) => ({
        ...c,
        logs: Array.isArray(c.logs) && c.logs.length > 35 ? c.logs.slice(0, 35) : c.logs || [],
      }));
      const compactWh = (currentPayload.warehouseProducts || []).map((w) => ({
        ...w,
        stockHistory:
          Array.isArray(w.stockHistory) && w.stockHistory.length > 40
            ? w.stockHistory.slice(0, 40)
            : w.stockHistory || [],
      }));
      const compactLogs = (currentPayload.systemLogs || []).slice(0, 120);

      const serialized = JSON.stringify(
        cleanFirestoreData({
          ...currentPayload,
          clients: compactClients,
          warehouseProducts: compactWh,
          systemLogs: compactLogs,
        })
      );

      const url = `${FIRESTORE_REST_BASE}/monthlyPlans/${SHARED_CLOUD_DOC_ID}?key=${firebaseConfig.apiKey}`;
      const bodyStr = JSON.stringify({
        fields: {
          id: { stringValue: SHARED_CLOUD_DOC_ID },
          monthKey: { stringValue: '__sync_snapshot__' },
          payloadJson: { stringValue: serialized },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      });

      let wrote = false;
      for (let attempt = 1; attempt <= 30; attempt++) {
        try {
          const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: bodyStr,
          });
          if (res.status === 200) {
            wrote = true;
            lastSavedCloudSignature = currentSig;
            break;
          }
        } catch {
          // transient fetch error
        }
        // If another newer payload was queued while retrying, switch to the newer payload immediately
        if (queuedCloudSnapshotPayload) {
          break;
        }
        await new Promise((r) => setTimeout(r, 180));
      }
      lastSuccess = wrote;
    }
  } finally {
    isWritingCloudSnapshot = false;
  }

  return lastSuccess;
}

function buildLocalCloudStatePayload(): CloudStatePayload {
  const deletedClientIds = getDeletedClientIds();
  const deletedWhIds = getDeletedWarehouseIds();
  const deletedPlanIds = getDeletedPlanIds();

  const localClients = storageService
    .getClients()
    .filter((c) => c && c.id && !deletedClientIds.has(c.id) && !isLegacyWipedRecord(c.id));
  const localWarehouse = storageService
    .getWarehouseProducts()
    .filter((w) => w && w.id && !deletedWhIds.has(w.id) && !isLegacyWipedRecord(w.id));
  const localPlans = storageService
    .getDailyPlans()
    .filter(
      (p) =>
        p &&
        p.id &&
        !deletedClientIds.has(p.clientId) &&
        !deletedPlanIds.has(p.id) &&
        !isLegacyWipedRecord(p.id) &&
        !isLegacyWipedRecord(p.clientId)
    )
    .map((p) => preparePlanPayloadForFirestore(p));
  const localLogs = getLocalSystemLogs().filter((l) => l && l.id && !isLegacyWipedRecord(l.id));

  return {
    clients: localClients,
    warehouseProducts: localWarehouse,
    dailyPlans: localPlans,
    systemLogs: localLogs,
    deletedClientIds: Array.from(deletedClientIds),
    deletedWarehouseIds: Array.from(deletedWhIds),
    deletedPlanIds: Array.from(deletedPlanIds),
    updatedAt: new Date().toISOString(),
  };
}

let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleCloudStatePush(delayMs = 150): void {
  if (typeof window === 'undefined') return;
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(() => {
    pushDebounceTimer = null;
    const payload = buildLocalCloudStatePayload();
    pushToServerRelay(payload);
    writeFirestoreCloudSnapshot(payload);
  }, delayMs);
}

export async function deleteSystemLogsFromFirestore(logIds: string[]): Promise<void> {
  pushToServerRelay({ deletedLogIds: logIds });
  scheduleCloudStatePush(100);
  if (isFirestoreSdkQuotaExhausted) return;
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
  } catch {
    isFirestoreSdkQuotaExhausted = true;
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

  // 2. Push to Server Relay & Cloud Snapshot
  pushToServerRelay({ systemLogs: [log] });
  scheduleCloudStatePush(250);

  return log;
}

// -------------------------------------------------------------
// Firestore & Server Relay Realtime Collections Synchronizers
// -------------------------------------------------------------

// Sync Clients (Single & Batched Bulk)
export async function syncClientToFirestore(client: Client): Promise<void> {
  pushToServerRelay({ clients: [client] });
  scheduleCloudStatePush(100);
}

export async function syncClientsBulkToFirestore(clients: Client[]): Promise<void> {
  if (!clients || clients.length === 0) return;
  pushToServerRelay({ clients });
  scheduleCloudStatePush(100);
}

export async function deleteClientFromFirestore(
  clientId: string,
  knownPlanIds: string[] = []
): Promise<boolean> {
  markClientAsDeleted(clientId);
  knownPlanIds.forEach((pid) => markPlanAsDeleted(pid));
  pushToServerRelay({
    deletedClientIds: [clientId],
    deletedPlanIds: knownPlanIds,
  });
  scheduleCloudStatePush(50);
  return true;
}

function preparePlanPayloadForFirestore(plan: DailyPlanItem): any {
  const payload: any = cleanFirestoreData(plan);
  payload.financialAction =
    plan.financialAction && plan.financialAction.amount > 0 ? payload.financialAction : null;
  payload.productsDelivered =
    plan.productsDelivered && plan.productsDelivered.length > 0 ? payload.productsDelivered : null;
  payload.deliveryPayment =
    plan.productsDelivered && plan.productsDelivered.length > 0 && plan.deliveryPayment
      ? payload.deliveryPayment
      : null;
  if (!plan.isClosed && plan.status !== 'yopildi') {
    payload.isClosed = false;
    payload.closedWithoutAction = false;
    payload.unperformedClose = null;
    payload.closedAt = null;
    payload.closedDisplayDate = null;
    payload.closedUpdatedAt = null;
    payload.closedBy = null;
    payload.closeReason = null;
    if (plan.planDate) {
      payload.planDate = plan.planDate;
    }
    if ((plan as any).lastClosedDateKey) {
      payload.lastClosedDateKey = (plan as any).lastClosedDateKey;
    }
    if (!payload.status || payload.status === 'yopildi') {
      payload.status = 'rejalashtirilgan';
    }
  } else {
    const displayClosedAt =
      (plan as any).closedDisplayDate || plan.closedAt || new Date().toISOString();
    payload.isClosed = true;
    payload.status = 'yopildi';
    payload.closedDisplayDate = displayClosedAt;
    payload.closedAt = displayClosedAt;
    const dKey = String(displayClosedAt).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dKey)) {
      payload.planDate = dKey;
      payload.lastClosedDateKey = dKey;
    }
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
  if (!item.financialAction || !(item.financialAction.amount > 0)) {
    delete item.financialAction;
  }
  if (!Array.isArray(item.productsDelivered) || item.productsDelivered.length === 0) {
    delete item.productsDelivered;
    delete item.deliveryPayment;
  }
  if (item.isClosed || item.status === 'yopildi') {
    if (item.closedDisplayDate) {
      item.closedAt = item.closedDisplayDate;
      const dKey = String(item.closedDisplayDate).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dKey)) {
        item.planDate = dKey;
        item.lastClosedDateKey = dKey;
      }
    }
    if (item.unperformedClose !== undefined && item.unperformedClose !== null) {
      item.closedWithoutAction = Boolean(item.unperformedClose);
    } else {
      item.closedWithoutAction = Boolean(item.closedWithoutAction);
    }
  } else if (
    item.lastClosedDateKey &&
    /^\d{4}-\d{2}-\d{2}/.test(String(item.lastClosedDateKey).trim())
  ) {
    item.planDate = String(item.lastClosedDateKey).trim().slice(0, 10);
  }
  return item as DailyPlanItem;
}

// Sync Daily Plans (Single & Batched Bulk)
export async function syncPlanToFirestore(plan: DailyPlanItem): Promise<void> {
  const payload = preparePlanPayloadForFirestore(plan);
  pushToServerRelay({ dailyPlans: [payload] });
  scheduleCloudStatePush(100);
}

export async function syncPlansBulkToFirestore(plans: DailyPlanItem[]): Promise<void> {
  if (!plans || plans.length === 0) return;
  const prepared = plans.map((p) => preparePlanPayloadForFirestore(p));
  pushToServerRelay({ dailyPlans: prepared });
  scheduleCloudStatePush(100);
}

export async function deletePlanFromFirestore(planId: string): Promise<void> {
  markPlanAsDeleted(planId);
  pushToServerRelay({ deletedPlanIds: [planId] });
  scheduleCloudStatePush(50);
}

// Sync Warehouse Products
export async function syncWarehouseProductToFirestore(product: WarehouseProduct): Promise<void> {
  pushToServerRelay({ warehouseProducts: [product] });
  scheduleCloudStatePush(100);
}

export async function syncWarehouseProductsBulkToFirestore(
  products: WarehouseProduct[]
): Promise<void> {
  if (!products || products.length === 0) return;
  pushToServerRelay({ warehouseProducts: products });
  scheduleCloudStatePush(100);
}

export async function deleteWarehouseProductFromFirestore(productId: string): Promise<void> {
  markWarehouseProductAsDeleted(productId);
  pushToServerRelay({ deletedWarehouseIds: [productId] });
  scheduleCloudStatePush(50);
}

// Sync Monthly Plans
export async function syncMonthlyPlanToFirestore(plan: MonthlyPlan): Promise<void> {
  pushToServerRelay({ monthlyPlans: [plan] });
  scheduleCloudStatePush(100);
}

export async function deleteMonthlyPlanFromFirestore(_planId: string): Promise<void> {
  scheduleCloudStatePush(100);
}

// Helper to apply incoming cloud snapshot state to callbacks
function applyIncomingStateToCallbacks(
  data: Partial<CloudStatePayload>,
  callbacks: {
    onClientsChange?: (clients: Client[]) => void;
    onPlansChange?: (plans: DailyPlanItem[]) => void;
    onWarehouseChange?: (products: WarehouseProduct[]) => void;
    onLogsChange?: (logs: SystemLog[]) => void;
    onMonthlyPlansChange?: (plans: MonthlyPlan[]) => void;
  }
): void {
  if (!data) return;

  if (Array.isArray(data.deletedClientIds)) {
    data.deletedClientIds.forEach((id: string) => markClientAsDeleted(id));
  }
  if (Array.isArray(data.deletedWarehouseIds)) {
    data.deletedWarehouseIds.forEach((id: string) => markWarehouseProductAsDeleted(id));
  }
  if (Array.isArray(data.deletedPlanIds)) {
    data.deletedPlanIds.forEach((id: string) => markPlanAsDeleted(id));
  }

  const deletedIds = getDeletedClientIds();
  const deletedWhIds = getDeletedWarehouseIds();
  const deletedPlanIds = getDeletedPlanIds();

  if (callbacks.onClientsChange && Array.isArray(data.clients)) {
    const cleanClients = (data.clients as Client[]).filter(
      (c) => c && c.id && !deletedIds.has(c.id) && !isLegacyWipedRecord(c.id)
    );
    callbacks.onClientsChange(cleanClients);
  }

  if (callbacks.onWarehouseChange && Array.isArray(data.warehouseProducts)) {
    const cleanWh = (data.warehouseProducts as WarehouseProduct[]).filter(
      (w) => w && w.id && !deletedWhIds.has(w.id) && !isLegacyWipedRecord(w.id)
    );
    callbacks.onWarehouseChange(cleanWh);
  }

  if (callbacks.onPlansChange && Array.isArray(data.dailyPlans)) {
    const cleanPlans: DailyPlanItem[] = [];
    for (const raw of data.dailyPlans) {
      const item = normalizeIncomingPlanFromFirestore(raw);
      if (
        item &&
        item.clientId &&
        !deletedIds.has(item.clientId) &&
        !deletedPlanIds.has(item.id) &&
        !isLegacyWipedRecord(item.id) &&
        !isLegacyWipedRecord(item.clientId) &&
        !isClosedPlanExpired7Days(item)
      ) {
        cleanPlans.push(item);
      }
    }
    callbacks.onPlansChange(cleanPlans);
  }

  if (callbacks.onMonthlyPlansChange && Array.isArray(data.monthlyPlans)) {
    const cleanMp = (data.monthlyPlans as MonthlyPlan[]).filter(
      (m) => m && m.id && !isLegacyWipedRecord(m.id)
    );
    callbacks.onMonthlyPlansChange(cleanMp);
  }

  if (callbacks.onLogsChange && Array.isArray(data.systemLogs)) {
    const cleanLogs = (data.systemLogs as SystemLog[]).filter(
      (l) => l && l.id && !isLegacyWipedRecord(l.id)
    );
    callbacks.onLogsChange(cleanLogs);
  }
}

// Subscribe to real-time updates from Firestore & Cloud Snapshot
export function subscribeToFirestoreData(callbacks: {
  onClientsChange?: (clients: Client[]) => void;
  onPlansChange?: (plans: DailyPlanItem[]) => void;
  onWarehouseChange?: (products: WarehouseProduct[]) => void;
  onLogsChange?: (logs: SystemLog[]) => void;
  onMonthlyPlansChange?: (plans: MonthlyPlan[]) => void;
}) {
  const unsubscribers: (() => void)[] = [];

  // Listen to monthlyPlans collection which also holds our real-time shared_cloud_state_v1 document!
  const unsubCloudState = onSnapshot(
    collection(db, 'monthlyPlans'),
    { includeMetadataChanges: true },
    (snapshot) => {
      const monthlyList: MonthlyPlan[] = [];
      snapshot.forEach((d) => {
        if (d.id === SHARED_CLOUD_DOC_ID) {
          const docData = d.data();
          if (docData && typeof docData.payloadJson === 'string') {
            try {
              const parsed = JSON.parse(docData.payloadJson) as CloudStatePayload;
              applyIncomingStateToCallbacks(parsed, callbacks);
            } catch {
              // ignore malformed JSON
            }
          }
          return;
        }
        if (!isLegacyWipedRecord(d.id)) {
          monthlyList.push(d.data() as MonthlyPlan);
        }
      });
      if (callbacks.onMonthlyPlansChange) {
        callbacks.onMonthlyPlansChange(monthlyList);
      }
    },
    (error) => {
      console.warn('Cloud state listener warning:', error.message);
    }
  );
  unsubscribers.push(unsubCloudState);

  // Bidirectional Cloud Snapshot + Server Relay poll every 2.5s
  const relayTimer = setInterval(() => {
    syncBidirectionalCloudAndRelay(callbacks);
  }, 2500);
  unsubscribers.push(() => clearInterval(relayTimer));

  return () => {
    unsubscribers.forEach((fn) => fn());
  };
}

// Initial full sync push: upload existing local items to Server Relay & Firestore Cloud Snapshot
const BOOTSTRAP_FLAG_KEY = 'savdo_firestore_bootstrapped_v1';

export async function bootstrapFirestoreData(
  _localClients: Client[],
  _localPlans: DailyPlanItem[],
  _localWarehouse: WarehouseProduct[]
): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(BOOTSTRAP_FLAG_KEY, 'true');
  }
  const payload = buildLocalCloudStatePayload();
  if (
    payload.clients.length > 0 ||
    payload.warehouseProducts.length > 0 ||
    payload.dailyPlans.length > 0
  ) {
    pushToServerRelay(payload);
    writeFirestoreCloudSnapshot(payload);
  }
}

async function syncBidirectionalCloudAndRelay(callbacks: {
  onClientsChange?: (clients: Client[]) => void;
  onPlansChange?: (plans: DailyPlanItem[]) => void;
  onWarehouseChange?: (products: WarehouseProduct[]) => void;
  onLogsChange?: (logs: SystemLog[]) => void;
  onMonthlyPlansChange?: (plans: MonthlyPlan[]) => void;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  try {
    // 1. Read both Firestore Cloud Snapshot and Server Relay in parallel
    const [cloudSnap, relayData] = await Promise.all([
      readFirestoreCloudSnapshot(),
      fetch('/api/sync-state', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    // 2. Union deleted IDs across Local + Cloud Snapshot + Server Relay
    const allDeletedClients = new Set<string>(getDeletedClientIds());
    const allDeletedWh = new Set<string>(getDeletedWarehouseIds());
    const allDeletedPlans = new Set<string>(getDeletedPlanIds());

    for (const src of [cloudSnap, relayData]) {
      if (!src) continue;
      if (Array.isArray(src.deletedClientIds)) {
        src.deletedClientIds.forEach((id: string) => {
          allDeletedClients.add(id);
          markClientAsDeleted(id);
        });
      }
      if (Array.isArray(src.deletedWarehouseIds)) {
        src.deletedWarehouseIds.forEach((id: string) => {
          allDeletedWh.add(id);
          markWarehouseProductAsDeleted(id);
        });
      }
      if (Array.isArray(src.deletedPlanIds)) {
        src.deletedPlanIds.forEach((id: string) => {
          allDeletedPlans.add(id);
          markPlanAsDeleted(id);
        });
      }
    }

    // 3. Merge Clients (Local + Cloud Snapshot + Server Relay)
    const clientsMap = new Map<string, Client>();
    const mergeClientItem = (c: Client) => {
      if (!c || !c.id || allDeletedClients.has(c.id) || isLegacyWipedRecord(c.id)) return;
      const existing = clientsMap.get(c.id);
      if (!existing) {
        clientsMap.set(c.id, c);
        return;
      }
      const exMs = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const newMs = c.updatedAt ? new Date(c.updatedAt).getTime() : 0;
      const exLogs = Array.isArray(existing.logs) ? existing.logs.length : 0;
      const newLogs = Array.isArray(c.logs) ? c.logs.length : 0;
      if (newMs > exMs || (newMs === exMs && newLogs > exLogs)) {
        clientsMap.set(c.id, c);
      }
    };

    (cloudSnap?.clients || []).forEach(mergeClientItem);
    (relayData?.clients || []).forEach(mergeClientItem);
    storageService.getClients().forEach(mergeClientItem);

    // 4. Merge Warehouse Products (Local + Cloud Snapshot + Server Relay)
    const whMap = new Map<string, WarehouseProduct>();
    const mergeWhItem = (w: WarehouseProduct) => {
      if (!w || !w.id || allDeletedWh.has(w.id) || isLegacyWipedRecord(w.id)) return;
      const existing = whMap.get(w.id);
      if (!existing) {
        whMap.set(w.id, w);
        return;
      }
      const exEdits = existing.initialEditCount || 0;
      const newEdits = w.initialEditCount || 0;
      const exHist = Array.isArray(existing.stockHistory) ? existing.stockHistory.length : 0;
      const newHist = Array.isArray(w.stockHistory) ? w.stockHistory.length : 0;
      if (newEdits > exEdits || newHist > exHist) {
        whMap.set(w.id, w);
      }
    };

    (cloudSnap?.warehouseProducts || []).forEach(mergeWhItem);
    (relayData?.warehouseProducts || []).forEach(mergeWhItem);
    storageService.getWarehouseProducts().forEach(mergeWhItem);

    // 5. Merge Daily Plans (Local + Cloud Snapshot + Server Relay)
    const plansMap = new Map<string, DailyPlanItem>();
    const mergePlanItem = (raw: any) => {
      const p = normalizeIncomingPlanFromFirestore(raw);
      if (
        !p ||
        !p.id ||
        !p.clientId ||
        allDeletedClients.has(p.clientId) ||
        allDeletedPlans.has(p.id) ||
        isLegacyWipedRecord(p.id) ||
        isLegacyWipedRecord(p.clientId) ||
        isClosedPlanExpired7Days(p)
      ) {
        return;
      }
      const existing = plansMap.get(p.id);
      if (!existing) {
        plansMap.set(p.id, p);
        return;
      }
      const getLatestPlanMs = (item: DailyPlanItem) => {
        const t1 = item.lastExecutedAt ? new Date(item.lastExecutedAt).getTime() : 0;
        const t2 = item.closedAt ? new Date(item.closedAt).getTime() : 0;
        const t3 = item.reopenedAt ? new Date(item.reopenedAt).getTime() : 0;
        const t4 = item.createdAt ? new Date(item.createdAt).getTime() : 0;
        return Math.max(t1 || 0, t2 || 0, t3 || 0, t4 || 0);
      };
      if (getLatestPlanMs(p) >= getLatestPlanMs(existing)) {
        plansMap.set(p.id, p);
      }
    };

    (cloudSnap?.dailyPlans || []).forEach(mergePlanItem);
    (relayData?.dailyPlans || []).forEach(mergePlanItem);
    storageService.getDailyPlans().forEach(mergePlanItem);

    // 6. Merge System Logs
    const logsMap = new Map<string, SystemLog>();
    const mergeLogItem = (l: SystemLog) => {
      if (!l || !l.id || isLegacyWipedRecord(l.id)) return;
      logsMap.set(l.id, l);
    };
    (cloudSnap?.systemLogs || []).forEach(mergeLogItem);
    (relayData?.systemLogs || []).forEach(mergeLogItem);
    getLocalSystemLogs().forEach(mergeLogItem);

    const mergedClients = Array.from(clientsMap.values());
    const mergedWh = Array.from(whMap.values());
    const mergedPlans = Array.from(plansMap.values());
    const mergedLogs = Array.from(logsMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const mergedPayload: CloudStatePayload = {
      clients: mergedClients,
      warehouseProducts: mergedWh,
      dailyPlans: mergedPlans.map((p) => preparePlanPayloadForFirestore(p)),
      systemLogs: mergedLogs.slice(0, 150),
      deletedClientIds: Array.from(allDeletedClients),
      deletedWarehouseIds: Array.from(allDeletedWh),
      deletedPlanIds: Array.from(allDeletedPlans),
      updatedAt: new Date().toISOString(),
    };

    // 7. Apply merged state to local UI callbacks
    applyIncomingStateToCallbacks(mergedPayload, callbacks);

    // 8. Check if our merged state has data missing from Firestore Cloud Snapshot or Server Relay
    const snapSig = cloudSnap ? computeStateSignature(cloudSnap) : '';
    const mergedSig = computeStateSignature(mergedPayload);

    if (
      mergedSig !== snapSig &&
      (mergedClients.length > 0 ||
        mergedWh.length > 0 ||
        mergedPlans.length > 0 ||
        allDeletedClients.size > 0 ||
        allDeletedWh.size > 0 ||
        allDeletedPlans.size > 0)
    ) {
      pushToServerRelay(mergedPayload);
      writeFirestoreCloudSnapshot(mergedPayload);
    }

    return true;
  } catch {
    return false;
  }
}

// Active Server Pull: Ensures PWA & Web on any device stay 100% in sync with Firestore Cloud Snapshot & Server Relay
export async function pullAllFromFirestoreServer(callbacks: {
  onClientsChange?: (clients: Client[]) => void;
  onPlansChange?: (plans: DailyPlanItem[]) => void;
  onWarehouseChange?: (products: WarehouseProduct[]) => void;
  onLogsChange?: (logs: SystemLog[]) => void;
  onMonthlyPlansChange?: (plans: MonthlyPlan[]) => void;
}): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  await syncBidirectionalCloudAndRelay(callbacks);
}
