import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'shared_state.json');
const DB_WIPE_CUTOFF_TS = 1794400000000;
const SHARED_CLOUD_DOC_ID = 'shared_cloud_state_v1';

let firebaseCfg: any = null;
try {
  firebaseCfg = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8')
  );
} catch {
  // ignore if missing
}

interface SharedStateStore {
  clients: Record<string, any>;
  dailyPlans: Record<string, any>;
  warehouseProducts: Record<string, any>;
  monthlyPlans: Record<string, any>;
  systemLogs: Record<string, any>;
  deletedClientIds: string[];
  deletedWarehouseIds: string[];
  deletedPlanIds: string[];
  updatedAt: number;
}

function isLegacyWipedRecord(id?: string | null): boolean {
  if (!id) return false;
  const strId = String(id);
  if (
    strId === 'cli_1' ||
    strId === 'cli_2' ||
    strId === 'cli_3' ||
    strId === 'wh_1' ||
    strId === 'wh_2' ||
    strId === 'month_plan_seed_1' ||
    strId.startsWith('log_seed_') ||
    strId.startsWith('shared_cloud_state_') ||
    strId.startsWith('sync_snap_') ||
    strId.startsWith('test_')
  ) {
    return true;
  }
  const matches = strId.match(/179[34]\d{9}/g);
  if (matches && matches.length > 0) {
    return matches.some((m) => Number(m) < DB_WIPE_CUTOFF_TS);
  }
  return false;
}

function createEmptyState(): SharedStateStore {
  return {
    clients: {},
    dailyPlans: {},
    warehouseProducts: {},
    monthlyPlans: {},
    systemLogs: {},
    deletedClientIds: [],
    deletedWarehouseIds: [],
    deletedPlanIds: [],
    updatedAt: Date.now(),
  };
}

function loadState(): SharedStateStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        clients: parsed.clients || {},
        dailyPlans: parsed.dailyPlans || {},
        warehouseProducts: parsed.warehouseProducts || {},
        monthlyPlans: parsed.monthlyPlans || {},
        systemLogs: parsed.systemLogs || {},
        deletedClientIds: Array.isArray(parsed.deletedClientIds) ? parsed.deletedClientIds : [],
        deletedWarehouseIds: Array.isArray(parsed.deletedWarehouseIds)
          ? parsed.deletedWarehouseIds
          : [],
        deletedPlanIds: Array.isArray(parsed.deletedPlanIds) ? parsed.deletedPlanIds : [],
        updatedAt: parsed.updatedAt || Date.now(),
      };
    }
  } catch (err) {
    console.error('Failed to load shared_state.json:', err);
  }
  return createEmptyState();
}

const sharedState: SharedStateStore = loadState();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let cloudPushInFlight = false;
let cloudPushQueued = false;
let serverFirestoreCooldownUntil = 0;
let serverFirestoreConsecutive429s = 0;
const SNAP_META_DOC_ID = 'sync_snap_v2_meta';

function chunkItemsBySize<T>(items: T[], maxBytes = 320_000): T[][] {
  if (!items || items.length === 0) return [];
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentBytes = 2;
  for (const item of items) {
    const len = JSON.stringify(item).length + 1;
    if (current.length > 0 && currentBytes + len > maxBytes) {
      chunks.push(current);
      current = [item];
      currentBytes = 2 + len;
    } else {
      current.push(item);
      currentBytes += len;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function patchServerFirestoreDoc(docId: string, jsonStr: string): Promise<'ok' | 'quota' | 'error'> {
  if (Date.now() < serverFirestoreCooldownUntil) return 'quota';
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseCfg.projectId}/databases/${firebaseCfg.firestoreDatabaseId}/documents/monthlyPlans/${docId}?key=${firebaseCfg.apiKey}`;
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          id: { stringValue: docId },
          monthKey: { stringValue: '__sync_snapshot__' },
          payloadJson: { stringValue: jsonStr },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    });
    if (r.status === 200) {
      serverFirestoreCooldownUntil = 0;
      serverFirestoreConsecutive429s = 0;
      return 'ok';
    }
    if (r.status === 429) {
      serverFirestoreConsecutive429s += 1;
      serverFirestoreCooldownUntil = Date.now() + Math.min(300_000, 60_000 * serverFirestoreConsecutive429s);
      return 'quota';
    }
    return 'error';
  } catch {
    return 'error';
  }
}

async function readServerFirestoreDoc(docId: string): Promise<any | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseCfg.projectId}/databases/${firebaseCfg.firestoreDatabaseId}/documents/monthlyPlans/${docId}?key=${firebaseCfg.apiKey}&_t=${Date.now()}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const docData: any = await r.json();
    const rawJson = docData?.fields?.payloadJson?.stringValue;
    if (rawJson && typeof rawJson === 'string') {
      return JSON.parse(rawJson);
    }
  } catch {
    // ignore
  }
  return null;
}

async function pushServerStateToFirestoreCloud(): Promise<void> {
  if (!firebaseCfg || !firebaseCfg.projectId || !firebaseCfg.apiKey) return;
  if (Date.now() < serverFirestoreCooldownUntil) return;
  if (cloudPushInFlight) {
    cloudPushQueued = true;
    return;
  }
  cloudPushInFlight = true;
  try {
    do {
      cloudPushQueued = false;
      if (Date.now() < serverFirestoreCooldownUntil) break;
      const snapshot = serializeStateResponse();
      if (
        snapshot.clients.length === 0 &&
        snapshot.warehouseProducts.length === 0 &&
        snapshot.dailyPlans.length === 0 &&
        snapshot.deletedClientIds.length === 0 &&
        snapshot.deletedWarehouseIds.length === 0
      ) {
        break;
      }
      const compactClients = (snapshot.clients || []).map((c: any) => ({
        ...c,
        logs: Array.isArray(c.logs) && c.logs.length > 30 ? c.logs.slice(0, 30) : c.logs || [],
      }));
      const compactWh = (snapshot.warehouseProducts || []).map((w: any) => ({
        ...w,
        stockHistory:
          Array.isArray(w.stockHistory) && w.stockHistory.length > 35
            ? w.stockHistory.slice(0, 35)
            : w.stockHistory || [],
      }));
      const compactPlans = snapshot.dailyPlans || [];

      const clientChunks = chunkItemsBySize(compactClients, 320_000);
      const warehouseChunks = chunkItemsBySize(compactWh, 320_000);
      const planChunks = chunkItemsBySize(compactPlans, 320_000);

      let aborted = false;
      for (let i = 0; i < clientChunks.length; i++) {
        if ((await patchServerFirestoreDoc(`sync_snap_v2_clients_${i}`, JSON.stringify({ items: clientChunks[i] }))) === 'quota') {
          aborted = true;
          break;
        }
      }
      if (aborted) break;
      for (let i = 0; i < warehouseChunks.length; i++) {
        if ((await patchServerFirestoreDoc(`sync_snap_v2_warehouse_${i}`, JSON.stringify({ items: warehouseChunks[i] }))) === 'quota') {
          aborted = true;
          break;
        }
      }
      if (aborted) break;
      for (let i = 0; i < planChunks.length; i++) {
        if ((await patchServerFirestoreDoc(`sync_snap_v2_plans_${i}`, JSON.stringify({ items: planChunks[i] }))) === 'quota') {
          aborted = true;
          break;
        }
      }
      if (aborted) break;

      await patchServerFirestoreDoc(
        SNAP_META_DOC_ID,
        JSON.stringify({
          clientChunksCount: clientChunks.length,
          warehouseChunksCount: warehouseChunks.length,
          planChunksCount: planChunks.length,
          systemLogs: (snapshot.systemLogs || []).slice(0, 80),
          deletedClientIds: snapshot.deletedClientIds || [],
          deletedWarehouseIds: snapshot.deletedWarehouseIds || [],
          deletedPlanIds: snapshot.deletedPlanIds || [],
          updatedAt: new Date().toISOString(),
        })
      );
    } while (cloudPushQueued);
  } finally {
    cloudPushInFlight = false;
  }
}

async function pullServerStateFromFirestoreCloud(): Promise<void> {
  if (!firebaseCfg || !firebaseCfg.projectId || !firebaseCfg.apiKey) return;
  try {
    const meta = await readServerFirestoreDoc(SNAP_META_DOC_ID);
    if (meta && typeof meta === 'object') {
      const clientChunksCount = Number(meta.clientChunksCount) || 0;
      const warehouseChunksCount = Number(meta.warehouseChunksCount) || 0;
      const planChunksCount = Number(meta.planChunksCount) || 0;
      const clients: any[] = [];
      const warehouseProducts: any[] = [];
      const dailyPlans: any[] = [];
      for (let i = 0; i < clientChunksCount; i++) {
        const d = await readServerFirestoreDoc(`sync_snap_v2_clients_${i}`);
        if (Array.isArray(d?.items)) clients.push(...d.items);
      }
      for (let i = 0; i < warehouseChunksCount; i++) {
        const d = await readServerFirestoreDoc(`sync_snap_v2_warehouse_${i}`);
        if (Array.isArray(d?.items)) warehouseProducts.push(...d.items);
      }
      for (let i = 0; i < planChunksCount; i++) {
        const d = await readServerFirestoreDoc(`sync_snap_v2_plans_${i}`);
        if (Array.isArray(d?.items)) dailyPlans.push(...d.items);
      }
      mergePayloadIntoState(
        {
          clients,
          warehouseProducts,
          dailyPlans,
          systemLogs: Array.isArray(meta.systemLogs) ? meta.systemLogs : [],
          deletedClientIds: Array.isArray(meta.deletedClientIds) ? meta.deletedClientIds : [],
          deletedWarehouseIds: Array.isArray(meta.deletedWarehouseIds) ? meta.deletedWarehouseIds : [],
          deletedPlanIds: Array.isArray(meta.deletedPlanIds) ? meta.deletedPlanIds : [],
        },
        false
      );
      return;
    }
    const legacy = await readServerFirestoreDoc(SHARED_CLOUD_DOC_ID);
    if (legacy && typeof legacy === 'object') {
      mergePayloadIntoState(legacy, false);
    }
  } catch {
    // ignore
  }
}

function scheduleSaveState(triggerCloudPush = true): void {
  sharedState.updatedAt = Date.now();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(sharedState), 'utf8');
    } catch (err) {
      console.error('Failed to write shared_state.json:', err);
    }
    if (triggerCloudPush) {
      pushServerStateToFirestoreCloud();
    }
  }, 150);
}

function getRecordTimestamp(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const tsStr =
    item.updatedAt ||
    item.closedUpdatedAt ||
    item.lastExecutedAt ||
    item.reopenedAt ||
    item.closedAt ||
    item.createdAt ||
    item.timestamp;
  if (!tsStr) return 0;
  const ms = new Date(tsStr).getTime();
  return isNaN(ms) ? 0 : ms;
}

function mergePayloadIntoState(payload: any, triggerCloudPush = true): void {
  if (!payload || typeof payload !== 'object') return;

  const delClientsSet = new Set<string>(sharedState.deletedClientIds);
  const delWhSet = new Set<string>(sharedState.deletedWarehouseIds);
  const delPlansSet = new Set<string>(sharedState.deletedPlanIds);

  if (Array.isArray(payload.deletedClientIds)) {
    for (const id of payload.deletedClientIds) {
      if (id && typeof id === 'string') {
        delClientsSet.add(id);
        delete sharedState.clients[id];
      }
    }
  }

  if (Array.isArray(payload.deletedWarehouseIds)) {
    for (const id of payload.deletedWarehouseIds) {
      if (id && typeof id === 'string') {
        delWhSet.add(id);
        delete sharedState.warehouseProducts[id];
      }
    }
  }

  if (Array.isArray(payload.deletedPlanIds)) {
    for (const id of payload.deletedPlanIds) {
      if (id && typeof id === 'string') {
        delPlansSet.add(id);
        delete sharedState.dailyPlans[id];
      }
    }
  }

  sharedState.deletedClientIds = Array.from(delClientsSet);
  sharedState.deletedWarehouseIds = Array.from(delWhSet);
  sharedState.deletedPlanIds = Array.from(delPlansSet);

  // Purge any plans belonging to deleted clients
  for (const [planId, plan] of Object.entries(sharedState.dailyPlans)) {
    if (!plan || delClientsSet.has(plan.clientId) || delPlansSet.has(planId)) {
      delete sharedState.dailyPlans[planId];
    }
  }

  if (Array.isArray(payload.clients)) {
    for (const c of payload.clients) {
      if (!c || !c.id || delClientsSet.has(c.id) || isLegacyWipedRecord(c.id)) continue;
      const existing = sharedState.clients[c.id];
      if (!existing) {
        sharedState.clients[c.id] = c;
      } else {
        const incomingMs = getRecordTimestamp(c);
        const existingMs = getRecordTimestamp(existing);
        const incomingLogsLen = Array.isArray(c.logs) ? c.logs.length : 0;
        const existingLogsLen = Array.isArray(existing.logs) ? existing.logs.length : 0;
        if (incomingMs >= existingMs || incomingLogsLen >= existingLogsLen) {
          sharedState.clients[c.id] = c;
        }
      }
    }
  }

  if (Array.isArray(payload.warehouseProducts)) {
    for (const w of payload.warehouseProducts) {
      if (!w || !w.id || delWhSet.has(w.id) || isLegacyWipedRecord(w.id)) continue;
      const existing = sharedState.warehouseProducts[w.id];
      if (!existing) {
        sharedState.warehouseProducts[w.id] = w;
      } else {
        const incomingMs = getRecordTimestamp(w);
        const existingMs = getRecordTimestamp(existing);
        const incomingEdits = w.initialEditCount || 0;
        const existingEdits = existing.initialEditCount || 0;
        const incomingHist = Array.isArray(w.stockHistory) ? w.stockHistory.length : 0;
        const existingHist = Array.isArray(existing.stockHistory) ? existing.stockHistory.length : 0;
        if (
          incomingEdits > existingEdits ||
          incomingHist > existingHist ||
          incomingMs >= existingMs
        ) {
          sharedState.warehouseProducts[w.id] = w;
        }
      }
    }
  }

  if (Array.isArray(payload.dailyPlans)) {
    for (const p of payload.dailyPlans) {
      if (
        !p ||
        !p.id ||
        !p.clientId ||
        delPlansSet.has(p.id) ||
        delClientsSet.has(p.clientId) ||
        isLegacyWipedRecord(p.id) ||
        isLegacyWipedRecord(p.clientId)
      ) {
        continue;
      }
      const existing = sharedState.dailyPlans[p.id];
      if (!existing) {
        sharedState.dailyPlans[p.id] = p;
      } else {
        const incomingMs = getRecordTimestamp(p);
        const existingMs = getRecordTimestamp(existing);
        if (incomingMs >= existingMs) {
          sharedState.dailyPlans[p.id] = p;
        }
      }
    }
  }

  if (Array.isArray(payload.monthlyPlans)) {
    for (const mp of payload.monthlyPlans) {
      if (!mp || !mp.id || isLegacyWipedRecord(mp.id)) continue;
      sharedState.monthlyPlans[mp.id] = mp;
    }
  }

  if (Array.isArray(payload.systemLogs)) {
    for (const l of payload.systemLogs) {
      if (!l || !l.id || isLegacyWipedRecord(l.id)) continue;
      sharedState.systemLogs[l.id] = l;
    }
    // Keep most recent 600 logs
    const allLogs: any[] = Object.values(sharedState.systemLogs).sort(
      (a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
    if (allLogs.length > 600) {
      const nextLogs: Record<string, any> = {};
      for (const item of allLogs.slice(0, 600)) {
        nextLogs[item.id] = item;
      }
      sharedState.systemLogs = nextLogs;
    }
  }

  if (Array.isArray(payload.deletedLogIds) && payload.deletedLogIds.length > 0) {
    for (const id of payload.deletedLogIds) {
      delete sharedState.systemLogs[id];
    }
  }

  scheduleSaveState(triggerCloudPush);
}

function serializeStateResponse() {
  const delClientsSet = new Set<string>(sharedState.deletedClientIds);
  const delWhSet = new Set<string>(sharedState.deletedWarehouseIds);
  const delPlansSet = new Set<string>(sharedState.deletedPlanIds);

  return {
    clients: Object.values(sharedState.clients).filter(
      (c: any) => c && c.id && !delClientsSet.has(c.id) && !isLegacyWipedRecord(c.id)
    ),
    warehouseProducts: Object.values(sharedState.warehouseProducts).filter(
      (w: any) => w && w.id && !delWhSet.has(w.id) && !isLegacyWipedRecord(w.id)
    ),
    dailyPlans: Object.values(sharedState.dailyPlans).filter(
      (p: any) =>
        p &&
        p.id &&
        p.clientId &&
        !delPlansSet.has(p.id) &&
        !delClientsSet.has(p.clientId) &&
        !isLegacyWipedRecord(p.id) &&
        !isLegacyWipedRecord(p.clientId)
    ),
    monthlyPlans: Object.values(sharedState.monthlyPlans).filter(
      (m: any) => m && m.id && !isLegacyWipedRecord(m.id)
    ),
    systemLogs: Object.values(sharedState.systemLogs)
      .filter((l: any) => l && l.id && !isLegacyWipedRecord(l.id))
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      ),
    deletedClientIds: sharedState.deletedClientIds,
    deletedWarehouseIds: sharedState.deletedWarehouseIds,
    deletedPlanIds: sharedState.deletedPlanIds,
    updatedAt: sharedState.updatedAt,
  };
}

async function startServer() {
  // Initial pull from Firestore cloud snapshot on startup
  pullServerStateFromFirestoreCloud();
  setInterval(() => {
    pullServerStateFromFirestoreCloud();
  }, 4000);

  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/sync-state', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(serializeStateResponse());
  });

  app.post('/api/sync-state', (req, res) => {
    try {
      mergePayloadIntoState(req.body, true);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(serializeStateResponse());
    } catch (err) {
      console.error('Error in POST /api/sync-state:', err);
      res.status(500).json({ error: 'Failed to merge sync state' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
