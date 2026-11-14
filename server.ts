import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'shared_state.json');
const DB_WIPE_CUTOFF_TS = 1794665500000;

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
  const matches = String(id).match(/179[34]\d{9}/g);
  if (matches && matches.length > 0) {
    return matches.some((m) => Number(m) < DB_WIPE_CUTOFF_TS);
  }
  if (
    id === 'cli_1' ||
    id === 'cli_2' ||
    id === 'cli_3' ||
    id === 'wh_1' ||
    id === 'wh_2' ||
    id === 'month_plan_seed_1' ||
    String(id).startsWith('log_seed_')
  ) {
    return true;
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

function scheduleSaveState(): void {
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

function mergePayloadIntoState(payload: any): void {
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

  scheduleSaveState();
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
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/sync-state', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(serializeStateResponse());
  });

  app.post('/api/sync-state', (req, res) => {
    try {
      mergePayloadIntoState(req.body);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(serializeStateResponse());
    } catch (err) {
      console.error('Error in POST /api/sync-state:', err);
      res.status(500).json({ error: 'Failed to merge sync state' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
