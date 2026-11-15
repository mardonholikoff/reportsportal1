import fs from 'fs';
import path from 'path';

const SNAP_META_DOC_ID = 'sync_snap_v2_meta';
const SHARED_CLOUD_DOC_ID = 'shared_cloud_state_v1';
const DB_WIPE_CUTOFF_TS = 1794400000000;

const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'gen-lang-client-0815446247',
  apiKey: 'AIzaSyA9aWu_1OgTHZglbalkt7x5aUY3AHZ_dDA',
  firestoreDatabaseId: 'ai-studio-savdovamijozlarn-1ec2bb08-4a16-4e77-bd92-74076dff5a84',
};

function getFirebaseCfg() {
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (parsed?.projectId && parsed?.apiKey && parsed?.firestoreDatabaseId) {
        return parsed;
      }
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_FIREBASE_CONFIG;
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

async function readFirestoreDoc(cfg: any, docId: string): Promise<any | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents/monthlyPlans/${docId}?key=${cfg.apiKey}`;
    const r = await fetch(url, { cache: 'no-store' });
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

async function patchFirestoreDoc(cfg: any, docId: string, jsonStr: string): Promise<boolean> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents/monthlyPlans/${docId}?key=${cfg.apiKey}`;
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
    return r.status === 200;
  } catch {
    return false;
  }
}

async function pullCloudState(cfg: any) {
  const meta = await readFirestoreDoc(cfg, SNAP_META_DOC_ID);
  if (meta && typeof meta === 'object') {
    const clientChunksCount = Math.max(Number(meta.clientChunksCount) || 0, 1);
    const warehouseChunksCount = Math.max(Number(meta.warehouseChunksCount) || 0, 1);
    const planChunksCount = Math.max(Number(meta.planChunksCount) || 0, 1);

    const chunkPromises: Promise<{ type: string; items: any[] }>[] = [];
    for (let i = 0; i < clientChunksCount; i++) {
      chunkPromises.push(
        readFirestoreDoc(cfg, `sync_snap_v2_clients_${i}`).then((d) => ({
          type: 'clients',
          items: Array.isArray(d?.items) ? d.items : [],
        }))
      );
    }
    for (let i = 0; i < warehouseChunksCount; i++) {
      chunkPromises.push(
        readFirestoreDoc(cfg, `sync_snap_v2_warehouse_${i}`).then((d) => ({
          type: 'warehouse',
          items: Array.isArray(d?.items) ? d.items : [],
        }))
      );
    }
    for (let i = 0; i < planChunksCount; i++) {
      chunkPromises.push(
        readFirestoreDoc(cfg, `sync_snap_v2_plans_${i}`).then((d) => ({
          type: 'plans',
          items: Array.isArray(d?.items) ? d.items : [],
        }))
      );
    }

    const chunkResults = await Promise.all(chunkPromises);
    const clients: any[] = [];
    const warehouseProducts: any[] = [];
    const dailyPlans: any[] = [];
    for (const cr of chunkResults) {
      if (cr.type === 'clients') clients.push(...cr.items);
      else if (cr.type === 'warehouse') warehouseProducts.push(...cr.items);
      else if (cr.type === 'plans') dailyPlans.push(...cr.items);
    }

    return {
      clients,
      warehouseProducts,
      dailyPlans,
      monthlyPlans: [],
      systemLogs: Array.isArray(meta.systemLogs) ? meta.systemLogs : [],
      deletedClientIds: Array.isArray(meta.deletedClientIds) ? meta.deletedClientIds : [],
      deletedWarehouseIds: Array.isArray(meta.deletedWarehouseIds) ? meta.deletedWarehouseIds : [],
      deletedPlanIds: Array.isArray(meta.deletedPlanIds) ? meta.deletedPlanIds : [],
      updatedAt: meta.updatedAt || Date.now(),
    };
  }

  const [c0, w0, p0, legacy] = await Promise.all([
    readFirestoreDoc(cfg, 'sync_snap_v2_clients_0'),
    readFirestoreDoc(cfg, 'sync_snap_v2_warehouse_0'),
    readFirestoreDoc(cfg, 'sync_snap_v2_plans_0'),
    readFirestoreDoc(cfg, SHARED_CLOUD_DOC_ID),
  ]);

  if (c0 || w0 || p0) {
    return {
      clients: Array.isArray(c0?.items) ? c0.items : [],
      warehouseProducts: Array.isArray(w0?.items) ? w0.items : [],
      dailyPlans: Array.isArray(p0?.items) ? p0.items : [],
      monthlyPlans: [],
      systemLogs: [],
      deletedClientIds: [],
      deletedWarehouseIds: [],
      deletedPlanIds: [],
      updatedAt: Date.now(),
    };
  }

  if (legacy && typeof legacy === 'object') {
    return {
      clients: Array.isArray(legacy.clients) ? legacy.clients : [],
      warehouseProducts: Array.isArray(legacy.warehouseProducts) ? legacy.warehouseProducts : [],
      dailyPlans: Array.isArray(legacy.dailyPlans) ? legacy.dailyPlans : [],
      monthlyPlans: Array.isArray(legacy.monthlyPlans) ? legacy.monthlyPlans : [],
      systemLogs: Array.isArray(legacy.systemLogs) ? legacy.systemLogs : [],
      deletedClientIds: Array.isArray(legacy.deletedClientIds) ? legacy.deletedClientIds : [],
      deletedWarehouseIds: Array.isArray(legacy.deletedWarehouseIds) ? legacy.deletedWarehouseIds : [],
      deletedPlanIds: Array.isArray(legacy.deletedPlanIds) ? legacy.deletedPlanIds : [],
      updatedAt: legacy.updatedAt || Date.now(),
    };
  }

  return {
    clients: [],
    warehouseProducts: [],
    dailyPlans: [],
    monthlyPlans: [],
    systemLogs: [],
    deletedClientIds: [],
    deletedWarehouseIds: [],
    deletedPlanIds: [],
    updatedAt: Date.now(),
  };
}

function mergeTwoStates(base: any, incoming: any) {
  const delClients = new Set<string>([
    ...(Array.isArray(base.deletedClientIds) ? base.deletedClientIds : []),
    ...(Array.isArray(incoming?.deletedClientIds) ? incoming.deletedClientIds : []),
  ]);
  const delWh = new Set<string>([
    ...(Array.isArray(base.deletedWarehouseIds) ? base.deletedWarehouseIds : []),
    ...(Array.isArray(incoming?.deletedWarehouseIds) ? incoming.deletedWarehouseIds : []),
  ]);
  const delPlans = new Set<string>([
    ...(Array.isArray(base.deletedPlanIds) ? base.deletedPlanIds : []),
    ...(Array.isArray(incoming?.deletedPlanIds) ? incoming.deletedPlanIds : []),
  ]);

  const clientsMap = new Map<string, any>();
  for (const src of [base.clients, incoming?.clients]) {
    if (!Array.isArray(src)) continue;
    for (const c of src) {
      if (!c || !c.id || delClients.has(c.id) || isLegacyWipedRecord(c.id)) continue;
      const ex = clientsMap.get(c.id);
      if (!ex) {
        clientsMap.set(c.id, c);
      } else {
        const incMs = getRecordTimestamp(c);
        const exMs = getRecordTimestamp(ex);
        const incLogs = Array.isArray(c.logs) ? c.logs.length : 0;
        const exLogs = Array.isArray(ex.logs) ? ex.logs.length : 0;
        if (incMs > exMs || (incMs === exMs && incLogs >= exLogs)) {
          clientsMap.set(c.id, c);
        }
      }
    }
  }

  const whMap = new Map<string, any>();
  for (const src of [base.warehouseProducts, incoming?.warehouseProducts]) {
    if (!Array.isArray(src)) continue;
    for (const w of src) {
      if (!w || !w.id || delWh.has(w.id) || isLegacyWipedRecord(w.id)) continue;
      const ex = whMap.get(w.id);
      if (!ex) {
        whMap.set(w.id, w);
      } else {
        const incEdits = w.initialEditCount || 0;
        const exEdits = ex.initialEditCount || 0;
        const incHist = Array.isArray(w.stockHistory) ? w.stockHistory.length : 0;
        const exHist = Array.isArray(ex.stockHistory) ? ex.stockHistory.length : 0;
        const incMs = getRecordTimestamp(w);
        const exMs = getRecordTimestamp(ex);
        if (incEdits > exEdits || incHist > exHist || incMs >= exMs) {
          whMap.set(w.id, w);
        }
      }
    }
  }

  const plansMap = new Map<string, any>();
  for (const src of [base.dailyPlans, incoming?.dailyPlans]) {
    if (!Array.isArray(src)) continue;
    for (const p of src) {
      if (
        !p ||
        !p.id ||
        !p.clientId ||
        delPlans.has(p.id) ||
        delClients.has(p.clientId) ||
        isLegacyWipedRecord(p.id) ||
        isLegacyWipedRecord(p.clientId)
      ) {
        continue;
      }
      const ex = plansMap.get(p.id);
      if (!ex || getRecordTimestamp(p) >= getRecordTimestamp(ex)) {
        plansMap.set(p.id, p);
      }
    }
  }

  const deletedLogIds = new Set<string>(
    Array.isArray(incoming?.deletedLogIds) ? incoming.deletedLogIds : []
  );
  const logsMap = new Map<string, any>();
  for (const src of [base.systemLogs, incoming?.systemLogs]) {
    if (!Array.isArray(src)) continue;
    for (const l of src) {
      if (!l || !l.id || deletedLogIds.has(l.id) || isLegacyWipedRecord(l.id)) continue;
      logsMap.set(l.id, l);
    }
  }

  const systemLogs = Array.from(logsMap.values())
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 150);

  return {
    clients: Array.from(clientsMap.values()),
    warehouseProducts: Array.from(whMap.values()),
    dailyPlans: Array.from(plansMap.values()),
    monthlyPlans: [],
    systemLogs,
    deletedClientIds: Array.from(delClients),
    deletedWarehouseIds: Array.from(delWh),
    deletedPlanIds: Array.from(delPlans),
    updatedAt: Date.now(),
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const cfg = getFirebaseCfg();

  try {
    if (req.method === 'GET') {
      const state = await pullCloudState(cfg);
      res.status(200).json(state);
      return;
    }

    if (req.method === 'POST') {
      const incoming = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const currentCloud = await pullCloudState(cfg);
      const merged = mergeTwoStates(currentCloud, incoming);

      const hasIncomingChanges =
        (Array.isArray(incoming.clients) && incoming.clients.length > 0) ||
        (Array.isArray(incoming.warehouseProducts) && incoming.warehouseProducts.length > 0) ||
        (Array.isArray(incoming.dailyPlans) && incoming.dailyPlans.length > 0) ||
        (Array.isArray(incoming.systemLogs) && incoming.systemLogs.length > 0) ||
        (Array.isArray(incoming.deletedClientIds) && incoming.deletedClientIds.length > 0) ||
        (Array.isArray(incoming.deletedWarehouseIds) && incoming.deletedWarehouseIds.length > 0) ||
        (Array.isArray(incoming.deletedPlanIds) && incoming.deletedPlanIds.length > 0) ||
        (Array.isArray(incoming.deletedLogIds) && incoming.deletedLogIds.length > 0);

      if (hasIncomingChanges) {
        const compactClients = merged.clients.map((c: any) => ({
          ...c,
          logs: Array.isArray(c.logs) && c.logs.length > 30 ? c.logs.slice(0, 30) : c.logs || [],
        }));
        const compactWh = merged.warehouseProducts.map((w: any) => ({
          ...w,
          stockHistory:
            Array.isArray(w.stockHistory) && w.stockHistory.length > 35
              ? w.stockHistory.slice(0, 35)
              : w.stockHistory || [],
        }));
        const clientChunks = chunkItemsBySize(compactClients, 320_000);
        const warehouseChunks = chunkItemsBySize(compactWh, 320_000);
        const planChunks = chunkItemsBySize(merged.dailyPlans, 320_000);

        for (let i = 0; i < clientChunks.length; i++) {
          await patchFirestoreDoc(
            cfg,
            `sync_snap_v2_clients_${i}`,
            JSON.stringify({ items: clientChunks[i] })
          );
        }
        for (let i = 0; i < warehouseChunks.length; i++) {
          await patchFirestoreDoc(
            cfg,
            `sync_snap_v2_warehouse_${i}`,
            JSON.stringify({ items: warehouseChunks[i] })
          );
        }
        for (let i = 0; i < planChunks.length; i++) {
          await patchFirestoreDoc(
            cfg,
            `sync_snap_v2_plans_${i}`,
            JSON.stringify({ items: planChunks[i] })
          );
        }

        await patchFirestoreDoc(
          cfg,
          SNAP_META_DOC_ID,
          JSON.stringify({
            clientChunksCount: clientChunks.length,
            warehouseChunksCount: warehouseChunks.length,
            planChunksCount: planChunks.length,
            systemLogs: merged.systemLogs.slice(0, 80),
            deletedClientIds: merged.deletedClientIds,
            deletedWarehouseIds: merged.deletedWarehouseIds,
            deletedPlanIds: merged.deletedPlanIds,
            updatedAt: new Date().toISOString(),
          })
        );
      }

      res.status(200).json(merged);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Sync relay error' });
  }
}
