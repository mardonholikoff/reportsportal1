import {
  Client,
  ClientAuditLog,
  DailyPlanItem,
  PlanActionType,
  FinancialMethodType,
  ProductItem,
  WarehouseProduct,
  DeliveryPaymentInfo,
  MonthlyPlan,
  MonthlyPlanTarget,
} from '../types';
import { parseLegacyAddress, formatAddress } from '../utils/location';

const STORAGE_KEY = 'savdo_clients_data_v1';
const SYNC_QUEUE_KEY = 'savdo_sync_queue_v1';
const FIREBASE_CONFIG_KEY = 'savdo_firebase_config_v1';
const SYNC_TIMESTAMP_KEY = 'savdo_last_synced_at';
const DAILY_PLANS_KEY = 'savdo_daily_plans_v1';
const WAREHOUSE_KEY = 'savdo_warehouse_products_v1';
const MONTHLY_PLANS_KEY = 'savdo_monthly_plans_v1';
export const DELETED_CLIENT_IDS_KEY = 'savdo_deleted_client_ids_v1';
export const DELETED_WAREHOUSE_IDS_KEY = 'savdo_deleted_warehouse_ids_v1';
export const APP_INITIALIZED_KEY = 'savdo_app_initialized_v1';

let deletedClientIdsCache: Set<string> | null = null;
let deletedWarehouseIdsCache: Set<string> | null = null;

export function getDeletedClientIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  if (deletedClientIdsCache) return deletedClientIdsCache;
  try {
    const raw = localStorage.getItem(DELETED_CLIENT_IDS_KEY);
    deletedClientIdsCache = raw ? new Set(JSON.parse(raw)) : new Set();
    return deletedClientIdsCache;
  } catch {
    deletedClientIdsCache = new Set();
    return deletedClientIdsCache;
  }
}

export function markClientAsDeleted(clientId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = getDeletedClientIds();
    if (ids.has(clientId)) return;
    ids.add(clientId);
    localStorage.setItem(DELETED_CLIENT_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.error('Failed to mark client as deleted', e);
  }
}

export function getDeletedWarehouseIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  if (deletedWarehouseIdsCache) return deletedWarehouseIdsCache;
  try {
    const raw = localStorage.getItem(DELETED_WAREHOUSE_IDS_KEY);
    deletedWarehouseIdsCache = raw ? new Set(JSON.parse(raw)) : new Set();
    return deletedWarehouseIdsCache;
  } catch {
    deletedWarehouseIdsCache = new Set();
    return deletedWarehouseIdsCache;
  }
}

export function markWarehouseProductAsDeleted(productId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = getDeletedWarehouseIds();
    if (ids.has(productId)) return;
    ids.add(productId);
    localStorage.setItem(DELETED_WAREHOUSE_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.error('Failed to mark warehouse product as deleted', e);
  }
}

const INITIAL_WAREHOUSE_PRODUCTS: WarehouseProduct[] = [
  {
    id: 'wh_1',
    brand: 'Castrol',
    name: 'Magnatec Motor moyi',
    mark1: '5W-40',
    mark2: 'Sintetika',
    extraMarks: ['A3/B4'],
    baseUnit: 'litr',
    pieceUnitName: '1 idish',
    volumePerPiece: 5,
    packageUnitName: 'korobka',
    piecesPerPackage: 4,
    pricingUnitType: 'piece',
    currency: 'USD',
    price: 30,
    intakeDate: new Date().toISOString().slice(0, 10),
    intakeUnitType: 'package',
    intakeQuantity: 20,
    totalSum: 2400,
    totalPieces: 80,
    totalVolume: 400,
    minSellingPricingUnitType: 'piece',
    minSellingPrice: 35,
    createdBy: 'adminc',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    notes: "Boshlang'ich ombor zaxirasi",
  },
  {
    id: 'wh_2',
    brand: 'Knauf',
    name: 'Gipsokarton',
    mark1: '9.5 mm',
    mark2: 'Namlikka chidamli (yashil)',
    extraMarks: ['2500x1200'],
    baseUnit: 'metr kvadrat',
    pieceUnitName: '1 dona',
    volumePerPiece: 3,
    packageUnitName: 'blok',
    piecesPerPackage: 10,
    pricingUnitType: 'piece',
    currency: 'USD',
    price: 4.5,
    intakeDate: new Date().toISOString().slice(0, 10),
    intakeUnitType: 'package',
    intakeQuantity: 15,
    totalSum: 675,
    totalPieces: 150,
    totalVolume: 450,
    minSellingPricingUnitType: 'piece',
    minSellingPrice: 5.5,
    createdBy: 'adminc',
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    notes: "To'g'ridan-to'g'ri zavoddan keltirildi",
  },
];

// Sample initial data with createdBy, location breakdown and audit logs
const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli_1',
    name: 'Akromjon Karimov',
    phone: '+998 90 123 45 67',
    phones: ['+998 90 123 45 67'],
    region: 'Toshkent shahri',
    district: 'Chilonzor tumani',
    landmark: '19-mavze, 45-uy',
    address: 'Toshkent shahri, Chilonzor tumani, 19-mavze, 45-uy',
    products: [
      {
        id: 'p1_1',
        name: 'Sement M500 (Ohangaron)',
        unit: 'qop',
        quantity: 50,
        unitPrice: 5,
        totalPrice: 250,
      },
      {
        id: 'p1_2',
        name: 'Armatura 12mm (Bekobod)',
        unit: 'metr',
        quantity: 120,
        unitPrice: 1,
        totalPrice: 120,
      },
      {
        id: 'p1_3',
        name: 'Gipsokarton 9.5mm (Knauf)',
        unit: 'dona',
        quantity: 25,
        unitPrice: 4,
        totalPrice: 100,
      },
    ],
    currentDebt: 150,
    currentAdvance: 0,
    notes: 'Qolgan 150 USD ni hafta oxirigacha beradi.',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    createdBy: 'adminc',
    syncStatus: 'synced',
    logs: [
      {
        id: 'log_init_1',
        clientId: 'cli_1',
        author: 'adminc',
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        type: 'created',
        title: "Mijoz ro'yxatga qo'shildi",
        details: "Boshlang'ich mahsulotlar va 150 USD qarz bilan kiritildi.",
      },
    ],
  },
  {
    id: 'cli_2',
    name: 'Shohruh Mirzayev',
    phone: '+998 93 987 65 43',
    phones: ['+998 93 987 65 43'],
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    landmark: "Registon ko'chasi, 12-uy",
    address: "Samarqand viloyati, Samarqand shahri, Registon ko'chasi, 12-uy",
    products: [
      {
        id: 'p2_1',
        name: 'Kafel yelim (Master)',
        unit: 'qop',
        quantity: 20,
        unitPrice: 4,
        totalPrice: 80,
      },
      {
        id: 'p2_2',
        name: 'Kafel 60x60 oq mramor',
        unit: 'metr kvadrat',
        quantity: 45,
        unitPrice: 7.5,
        totalPrice: 337.5,
      },
    ],
    currentDebt: 0,
    currentAdvance: 30,
    notes: 'Keyingi buyurtma uchun 30 USD oldindan bergan.',
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    createdBy: 'adminc',
    syncStatus: 'synced',
    logs: [
      {
        id: 'log_init_2',
        clientId: 'cli_2',
        author: 'adminc',
        timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        type: 'created',
        title: "Mijoz ro'yxatga qo'shildi",
        details: "30 USD avans to'lovi bilan kiritildi.",
      },
    ],
  },
  {
    id: 'cli_3',
    name: 'Dilnoza Saidova',
    phone: '+998 97 555 44 33',
    phones: ['+998 97 555 44 33'],
    region: 'Buxoro viloyati',
    district: 'Buxoro shahri',
    landmark: "G'ijduvon shoh ko'chasi, 88-bino",
    address: "Buxoro viloyati, Buxoro shahri, G'ijduvon shoh ko'chasi, 88-bino",
    products: [
      {
        id: 'p3_1',
        name: 'Fasad bo\'yoq (Dufa)',
        unit: 'litr',
        quantity: 30,
        unitPrice: 3.5,
        totalPrice: 105,
      },
      {
        id: 'p3_2',
        name: 'Shpatlevka (Saten)',
        unit: 'qop',
        quantity: 15,
        unitPrice: 3,
        totalPrice: 45,
      },
    ],
    currentDebt: 50,
    currentAdvance: 0,
    notes: 'Yetkazib berilgan, to\'lov kutilmoqda.',
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'agentp1',
    syncStatus: 'synced',
    logs: [
      {
        id: 'log_init_3',
        clientId: 'cli_3',
        author: 'agentp1',
        timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        type: 'created',
        title: "Mijoz ro'yxatga qo'shildi",
        details: "1-Agent (agentp1) tomonidan kiritildi.",
      },
    ],
  },
];

class StorageService {
  private listeners: Set<() => void> = new Set();
  private clientsCache: Client[] | null = null;
  private clientsMapCache: Map<string, Client> | null = null;
  private plansCache: DailyPlanItem[] | null = null;
  private warehouseCache: WarehouseProduct[] | null = null;
  private monthlyPlansCache: MonthlyPlan[] | null = null;
  private notifyPending: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const isInit = localStorage.getItem(APP_INITIALIZED_KEY);
      if (!isInit) {
        localStorage.setItem(APP_INITIALIZED_KEY, 'true');
        const existing = localStorage.getItem(STORAGE_KEY);
        if (!existing) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CLIENTS));
        }
      } else {
        // Upgrade existing records if createdBy or logs missing
        try {
          const existing = localStorage.getItem(STORAGE_KEY);
          if (existing) {
            const parsed: Client[] = JSON.parse(existing);
            let modified = false;
            parsed.forEach((c) => {
              if (!c.createdBy) {
                c.createdBy = 'adminc';
                modified = true;
              }
              if (!c.region || !c.district) {
                const parsedLoc = parseLegacyAddress(c.address);
                if (!c.region && parsedLoc.region) c.region = parsedLoc.region;
                if (!c.district && parsedLoc.district) c.district = parsedLoc.district;
                if (!c.landmark && parsedLoc.landmark) c.landmark = parsedLoc.landmark;
                modified = true;
              }
              if (!c.logs) {
                c.logs = [
                  {
                    id: 'log_' + c.id,
                    clientId: c.id,
                    author: c.createdBy || 'adminc',
                    timestamp: c.createdAt || new Date().toISOString(),
                    type: 'created',
                    title: "Mijoz qo'shildi",
                    details: `Tizimga ${c.createdBy || 'adminc'} tomonidan qo'shildi`,
                  },
                ];
                modified = true;
              }
            });
            if (modified) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            }
          }
        } catch {
          // ignore
        }
      }
      window.addEventListener('storage', () => {
        this.invalidateAllCaches();
        this.notify();
      });
    }
  }

  public invalidateAllCaches(): void {
    this.clientsCache = null;
    this.clientsMapCache = null;
    this.plansCache = null;
    this.warehouseCache = null;
    this.monthlyPlansCache = null;
    deletedClientIdsCache = null;
    deletedWarehouseIdsCache = null;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    if (this.notifyPending) return;
    this.notifyPending = true;
    queueMicrotask(() => {
      this.notifyPending = false;
      this.listeners.forEach((cb) => cb());
    });
  }

  private rebuildClientsMap(clients: Client[]) {
    const map = new Map<string, Client>();
    for (let i = 0; i < clients.length; i++) {
      map.set(clients[i].id, clients[i]);
    }
    this.clientsMapCache = map;
  }

  public getClients(): Client[] {
    if (typeof window === 'undefined') return [];
    if (this.clientsCache) return this.clientsCache;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const isInit = localStorage.getItem(APP_INITIALIZED_KEY);
      if (!data) {
        const fallback = isInit ? [] : INITIAL_CLIENTS;
        this.clientsCache = fallback;
        this.rebuildClientsMap(fallback);
        return fallback;
      }
      const deletedIds = getDeletedClientIds();
      const parsed: Client[] = JSON.parse(data);
      const normalized = parsed
        .filter((c) => !deletedIds.has(c.id))
        .map((c) => {
          let region = c.region;
          let district = c.district;
          let landmark = c.landmark;
          if (!region || !district) {
            const parsedLoc = parseLegacyAddress(c.address);
            if (!region) region = parsedLoc.region;
            if (!district) district = parsedLoc.district;
            if (!landmark) landmark = parsedLoc.landmark;
          }
          return {
            ...c,
            region,
            district,
            landmark,
            createdBy: c.createdBy || 'adminc',
            logs: c.logs || [],
          };
        });
      this.clientsCache = normalized;
      this.rebuildClientsMap(normalized);
      return normalized;
    } catch (e) {
      console.error('Failed to parse clients:', e);
      return [];
    }
  }

  public saveClients(clients: Client[]): void {
    if (typeof window === 'undefined') return;
    const deletedIds = getDeletedClientIds();
    const clean = clients.filter((c) => c && c.id && !deletedIds.has(c.id));
    this.clientsCache = clean;
    this.rebuildClientsMap(clean);
    this.plansCache = null; // Invalidate plans cache in case activeClientIds changed
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    this.notify();
  }

  public getClientById(id: string): Client | undefined {
    if (!this.clientsMapCache) {
      this.getClients();
    }
    return this.clientsMapCache?.get(id);
  }

  public addClient(
    clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'logs'>,
    author: string = 'adminc'
  ): Client {
    const clients = [...this.getClients()];
    const clientId = 'cli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const nowStr = new Date().toISOString();

    const initialLog: ClientAuditLog = {
      id: 'log_' + Date.now() + '_init',
      clientId,
      author,
      timestamp: nowStr,
      type: 'created',
      title: "Mijoz ro'yxatga qo'shildi",
      details: `${author} tomonidan yangi mijoz kiritildi. Qarz: ${clientData.currentDebt || 0} USD, Avans: ${clientData.currentAdvance || 0} USD`,
    };

    const newClient: Client = {
      ...clientData,
      id: clientId,
      createdAt: nowStr,
      updatedAt: nowStr,
      createdBy: author,
      syncStatus: navigator.onLine ? 'synced' : 'pending',
      logs: [initialLog],
    };

    clients.unshift(newClient);
    this.saveClients(clients);
    this.addToSyncQueue({ action: 'create', client: newClient });
    return newClient;
  }

  public addClientsBulk(
    clientsData: Array<Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'logs'>>,
    author: string = 'adminc'
  ): Client[] {
    const existingClients = this.getClients();
    const nowStr = new Date().toISOString();
    const createdClients: Client[] = [];

    clientsData.forEach((clientData, idx) => {
      const clientId =
        'cli_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6);
      const initialLog: ClientAuditLog = {
        id: 'log_' + Date.now() + '_' + idx + '_init',
        clientId,
        author,
        timestamp: nowStr,
        type: 'created',
        title: "Mijoz Excel (.xlsx) orqali ro'yxatga qo'shildi",
        details: `${author} tomonidan Excel fayldan yuklandi. Qarz: ${clientData.currentDebt || 0} USD, Avans: ${clientData.currentAdvance || 0} USD`,
      };

      const newClient: Client = {
        ...clientData,
        id: clientId,
        createdAt: nowStr,
        updatedAt: nowStr,
        createdBy: author,
        syncStatus: navigator.onLine ? 'synced' : 'pending',
        logs: [initialLog],
      };

      createdClients.push(newClient);
    });

    // Batch write to syncQueue once (O(N) instead of O(N^2))
    if (typeof window !== 'undefined' && createdClients.length > 0) {
      try {
        const queue = this.getSyncQueue();
        for (let i = 0; i < createdClients.length; i++) {
          queue.push({
            action: 'create',
            client: createdClients[i],
            timestamp: nowStr,
          });
        }
        // Keep queue bounded so localStorage never overflows
        const boundedQueue = queue.length > 2000 ? queue.slice(queue.length - 2000) : queue;
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(boundedQueue));
      } catch {
        // ignore quota issues on sync queue
      }
    }

    const updatedAll = [...createdClients, ...existingClients];
    this.saveClients(updatedAll);
    return createdClients;
  }

  public updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>): Client | null {
    const clients = [...this.getClients()];
    const index = clients.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const updated: Client = {
      ...clients[index],
      ...updates,
      updatedAt: new Date().toISOString(),
      syncStatus: navigator.onLine ? 'synced' : 'pending',
    };

    clients[index] = updated;
    this.saveClients(clients);
    this.addToSyncQueue({ action: 'update', client: updated });
    return updated;
  }

  public addClientAuditLog(clientId: string, logItem: Omit<ClientAuditLog, 'id' | 'clientId' | 'timestamp'>): void {
    const clients = this.getClients();
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const newLog: ClientAuditLog = {
      ...logItem,
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      clientId,
      timestamp: new Date().toISOString(),
    };

    const currentLogs = client.logs || [];
    currentLogs.unshift(newLog);

    this.updateClient(clientId, {
      logs: currentLogs,
      updatedAt: new Date().toISOString(),
    });
  }

  public deleteClient(id: string): boolean {
    // 1. Mark client ID as permanently deleted
    markClientAsDeleted(id);
    const deletedIds = getDeletedClientIds();

    // 2. Purge from raw clients storage directly (do not rely on pre-filtered getClients)
    if (typeof window !== 'undefined') {
      try {
        const rawClients = localStorage.getItem(STORAGE_KEY);
        const parsedClients: Client[] = rawClients ? JSON.parse(rawClients) : INITIAL_CLIENTS;
        const remainingClients = parsedClients.filter(
          (c) => c.id !== id && !deletedIds.has(c.id)
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingClients));
      } catch (e) {
        console.error('Failed to purge client from localStorage:', e);
      }

      // 3. Cascade delete all daily plans (active, completed, or closed) for this client
      try {
        const rawPlans = localStorage.getItem(DAILY_PLANS_KEY);
        if (rawPlans) {
          const parsedPlans: DailyPlanItem[] = JSON.parse(rawPlans);
          const remainingPlans = parsedPlans.filter(
            (p) => p.clientId !== id && !deletedIds.has(p.clientId)
          );
          localStorage.setItem(DAILY_PLANS_KEY, JSON.stringify(remainingPlans));
        }
      } catch (e) {
        console.warn('Failed to cascade delete daily plans for client', id, e);
      }

      // 4. Cascade clean monthly plans initialClientDebts snapshot
      try {
        const rawMonthly = localStorage.getItem(MONTHLY_PLANS_KEY);
        if (rawMonthly) {
          const parsedMonthly: MonthlyPlan[] = JSON.parse(rawMonthly);
          let monthlyChanged = false;
          const updatedMonthly = parsedMonthly.map((mp) => {
            if (mp.initialClientDebts && id in mp.initialClientDebts) {
              monthlyChanged = true;
              const copyDebts = { ...mp.initialClientDebts };
              delete copyDebts[id];
              const newInitialTotal = Object.values(copyDebts).reduce(
                (acc, v) => acc + (Number(v) || 0),
                0
              );
              return {
                ...mp,
                initialClientDebts: copyDebts,
                initialTotalDebt: newInitialTotal,
              };
            }
            return mp;
          });
          if (monthlyChanged) {
            localStorage.setItem(MONTHLY_PLANS_KEY, JSON.stringify(updatedMonthly));
          }
        }
      } catch (e) {
        console.warn('Failed to clean monthly plans for deleted client', id, e);
      }

      // 5. Remove any pending create/update items for this client from syncQueue and record delete
      try {
        const queue = this.getSyncQueue().filter(
          (q) => q.clientId !== id && q.client?.id !== id
        );
        queue.push({
          action: 'delete',
          clientId: id,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      } catch {
        // ignore
      }
      // Invalidate in-memory caches after deletion
      this.clientsCache = null;
      this.clientsMapCache = null;
      this.plansCache = null;
      this.monthlyPlansCache = null;
    }

    this.notify();
    return true;
  }

  // Quick payment / debt update with audit log
  public updateDebtOrAdvance(
    id: string,
    newDebt: number,
    newAdvance: number,
    noteAddition?: string,
    author: string = 'adminc'
  ): Client | null {
    const client = this.getClients().find((c) => c.id === id);
    if (!client) return null;

    let updatedNotes = client.notes || '';
    if (noteAddition) {
      const timeStr = new Date().toLocaleDateString('uz-UZ');
      updatedNotes = updatedNotes ? `${updatedNotes} | [${timeStr}]: ${noteAddition}` : `[${timeStr}]: ${noteAddition}`;
    }

    const currentLogs = client.logs || [];
    currentLogs.unshift({
      id: 'log_' + Date.now() + '_pay',
      clientId: id,
      author,
      timestamp: new Date().toISOString(),
      type: 'payment',
      title: "Hisob-kitob yangilandi",
      details: `${author} tomonidan o'zgartirildi: ${noteAddition || ''}. Yangi qarz: ${newDebt} USD, Yangi avans: ${newAdvance} USD.`,
      amountChanged: Math.abs((client.currentDebt || 0) - newDebt),
    });

    return this.updateClient(id, {
      currentDebt: Math.max(0, newDebt),
      currentAdvance: Math.max(0, newAdvance),
      notes: updatedNotes,
      logs: currentLogs,
    });
  }

  // =========================================================================
  // DAILY PLANS (Kunlik rejalar — 24 soatlik amal qilish muddati)
  // =========================================================================

  // Bir mijoz rejada faqat bir marta bo'lishini ta'minlash (dublikatlarni tozalash)
  public deduplicatePlansByClient(plans: DailyPlanItem[]): {
    uniquePlans: DailyPlanItem[];
    duplicateIds: string[];
  } {
    const byClient = new Map<string, DailyPlanItem>();
    const duplicateIds: string[] = [];

    const scorePlan = (p: DailyPlanItem): number => {
      let score = 0;
      if (p.isClosed || p.status === 'yopildi') score += 1000;
      if (p.status === 'bajarildi' || p.actionDone) score += 500;
      score += (p.actionsCount || (p.actionsHistory ? p.actionsHistory.length : 0)) * 50;
      return score;
    };

    for (const plan of plans) {
      if (!plan || !plan.clientId) continue;
      const key = plan.clientId;
      const existing = byClient.get(key);
      if (!existing) {
        byClient.set(key, plan);
      } else {
        const existingScore = scorePlan(existing);
        const currentScore = scorePlan(plan);
        const existingTime = new Date(
          existing.completedAt || existing.closedAt || existing.createdAt || 0
        ).getTime();
        const currentTime = new Date(
          plan.completedAt || plan.closedAt || plan.createdAt || 0
        ).getTime();

        const pickCurrent =
          currentScore > existingScore ||
          (currentScore === existingScore && currentTime > existingTime);

        if (pickCurrent) {
          if (existing.id !== plan.id) duplicateIds.push(existing.id);
          byClient.set(key, {
            ...plan,
            plannedAction: plan.plannedAction || existing.plannedAction,
            plannedAmount: plan.plannedAmount ?? existing.plannedAmount,
            planNote: plan.planNote || existing.planNote,
          });
        } else {
          if (plan.id !== existing.id) duplicateIds.push(plan.id);
          byClient.set(key, {
            ...existing,
            plannedAction: existing.plannedAction || plan.plannedAction,
            plannedAmount: existing.plannedAmount ?? plan.plannedAmount,
            planNote: existing.planNote || plan.planNote,
          });
        }
      }
    }

    const uniquePlans = Array.from(byClient.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return { uniquePlans, duplicateIds };
  }

  public getDailyPlans(): DailyPlanItem[] {
    if (typeof window === 'undefined') return [];
    if (this.plansCache) return this.plansCache;
    try {
      const raw = localStorage.getItem(DAILY_PLANS_KEY);
      if (!raw) {
        this.plansCache = [];
        return [];
      }
      const deletedIds = getDeletedClientIds();
      if (!this.clientsMapCache) {
        this.getClients();
      }
      const parsed: DailyPlanItem[] = JSON.parse(raw);
      const filtered = parsed.filter(
        (p) =>
          p &&
          p.clientId &&
          !deletedIds.has(p.clientId) &&
          (this.clientsMapCache ? this.clientsMapCache.has(p.clientId) : true)
      );
      const { uniquePlans, duplicateIds } = this.deduplicatePlansByClient(filtered);
      if (duplicateIds.length > 0 || filtered.length !== parsed.length) {
        localStorage.setItem(DAILY_PLANS_KEY, JSON.stringify(uniquePlans));
      }
      this.plansCache = uniquePlans;
      return uniquePlans;
    } catch {
      this.plansCache = [];
      return [];
    }
  }

  public saveDailyPlans(plans: DailyPlanItem[]): void {
    if (typeof window === 'undefined') return;
    const { uniquePlans } = this.deduplicatePlansByClient(plans);
    this.plansCache = uniquePlans;
    localStorage.setItem(DAILY_PLANS_KEY, JSON.stringify(uniquePlans));
    this.notify();
  }

  // Rejalarni olish (Admin uchun barcha agentlar rejalari, agent uchun o'z rejalari)
  public getActive24hPlans(agentUsername?: string): DailyPlanItem[] {
    const all = this.getDailyPlans();

    return all.filter((item) => {
      if (agentUsername) {
        return item.agentUsername?.toLowerCase() === agentUsername.toLowerCase();
      }
      return true;
    });
  }

  // Kunlik reja tuzish (agent tomonidan tanlangan mijozlar, amal turi, undirish summasi va izohlar)
  // Har bir mijoz faqat bir marta tanlanadi va avtomatik bajarildi bo'lmaydi (status: 'rejalashtirilgan')
  public createDailyPlan(
    agentUsername: string,
    selections: Array<
      | {
          clientId: string;
          plannedAction?: PlanActionType;
          plannedAmount?: number;
          planNote?: string;
        }
      | string
    >
  ): DailyPlanItem[] {
    const allClients = this.getClients();
    const existingPlans = this.getDailyPlans();
    const nowStr = new Date().toISOString();

    const touchedItems: DailyPlanItem[] = [];
    const seenClientIds = new Set<string>();

    selections.forEach((sel) => {
      const cId = typeof sel === 'string' ? sel : sel.clientId;
      if (!cId || seenClientIds.has(cId)) return;
      seenClientIds.add(cId);

      const note = typeof sel === 'string' ? undefined : sel.planNote;
      const plannedAction =
        typeof sel === 'string' ? 'joyiga borildi' : sel.plannedAction || 'joyiga borildi';
      const plannedAmount =
        typeof sel === 'string'
          ? undefined
          : sel.plannedAmount && sel.plannedAmount > 0
          ? sel.plannedAmount
          : undefined;
      const client = allClients.find((c) => c.id === cId);
      if (!client) return;

      // Agar mijoz allaqachon rejada mavjud bo'lsa, ikkinchi marta dublikat yaratmasdan mavjudini yangilaymiz
      const existingIdx = existingPlans.findIndex((p) => p.clientId === client.id);
      if (existingIdx !== -1) {
        const current = existingPlans[existingIdx];
        if (!current.isClosed && current.status !== 'yopildi') {
          const updatedItem: DailyPlanItem = {
            ...current,
            plannedAction,
            plannedAmount,
            planNote: note?.trim() || current.planNote || undefined,
          };
          existingPlans[existingIdx] = updatedItem;
          touchedItems.push(updatedItem);
        }
        return;
      }

      const planItem: DailyPlanItem = {
        id: 'plan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        agentUsername,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        clientAddress: client.address,
        clientRegion: client.region,
        clientDistrict: client.district,
        clientLandmark: client.landmark,
        createdAt: nowStr,
        status: 'rejalashtirilgan',
        plannedAction,
        plannedAmount,
        planNote: note?.trim() || undefined,
      };
      existingPlans.unshift(planItem);
      touchedItems.push(planItem);
    });

    this.saveDailyPlans(existingPlans);
    return touchedItems;
  }

  // Rejadagi mijozga izoh qo'shish yoki o'zgartirish
  public updateDailyPlanNote(planItemId: string, note: string): boolean {
    const plans = this.getDailyPlans();
    const index = plans.findIndex((p) => p.id === planItemId);
    if (index === -1) return false;
    plans[index].planNote = note.trim();
    this.saveDailyPlans(plans);
    return true;
  }

  // Agent tomonidan rejadagi mijoz bo'yicha amalni bajarish (Hisobot topshirish)
  public executeDailyPlanItem(
    planItemId: string,
    author: string,
    report: {
      actionDone: PlanActionType;
      financialAction?: {
        method: FinancialMethodType;
        methodLabel: string;
        amount: number;
        currency?: string;
        note?: string;
      };
      productsDelivered?: ProductItem[];
      deliveryPayment?: DeliveryPaymentInfo;
      productsReturned?: Array<{
        productId: string;
        name: string;
        unit: string;
        quantity: number;
        unitPrice?: number;
        warehouseId?: string;
      }>;
      reportNote?: string;
    }
  ): { success: boolean; client?: Client } {
    const plans = this.getDailyPlans();
    const planIndex = plans.findIndex((p) => p.id === planItemId);
    if (planIndex === -1) return { success: false };

    const plan = plans[planIndex];
    if (plan.isClosed) {
      return { success: false }; // Yopilgan mijoz ustida qaytib amal bajarib bo'lmaydi
    }
    const nowStr = new Date().toISOString();

    // 1. Update plan item
    plan.status = 'bajarildi';
    plan.completedAt = nowStr;
    plan.actionDone = report.actionDone;
    plan.financialAction = report.financialAction;
    plan.productsDelivered = report.productsDelivered;
    plan.deliveryPayment = report.deliveryPayment;
    plan.productsReturned = report.productsReturned;
    plan.reportNote = report.reportNote;
    plan.actionsCount = (plan.actionsCount || 0) + 1;
    plan.actionsHistory = [
      {
        timestamp: nowStr,
        author,
        actionDone: report.actionDone,
        financialAction: report.financialAction
          ? {
              methodLabel: report.financialAction.methodLabel,
              amount: report.financialAction.amount,
              currency: report.financialAction.currency,
            }
          : undefined,
        productsDelivered: report.productsDelivered,
        deliveryPayment: report.deliveryPayment,
        productsReturned: report.productsReturned,
        reportNote: report.reportNote,
      },
      ...(plan.actionsHistory || []),
    ];
    plans[planIndex] = plan;
    this.saveDailyPlans(plans);

    // 2. Update client in database & write audit logs
    const client = this.getClients().find((c) => c.id === plan.clientId);
    if (!client) return { success: true };

    let newDebt = client.currentDebt;
    let newAdvance = client.currentAdvance;
    const clientLogs = client.logs || [];

    // Financial payment operation (Section 2)
    if (report.financialAction && report.financialAction.amount > 0) {
      const amt = report.financialAction.amount;
      if (amt <= newDebt) {
        newDebt -= amt;
      } else {
        newAdvance += amt - newDebt;
        newDebt = 0;
      }

      clientLogs.unshift({
        id: 'log_' + Date.now() + '_fin',
        clientId: client.id,
        author,
        timestamp: nowStr,
        type: 'payment',
        title: `Moliyaviy amaliyot: ${report.financialAction.methodLabel}`,
        details: `${author} tomonidan to'lov qabul qilindi: ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amt)} USD. ${report.financialAction.note ? `Izoh: ${report.financialAction.note}` : ''}`,
        amountChanged: amt,
      });
    }

    // Products delivered operation (Section 3)
    let updatedProducts = [...client.products];
    if (report.productsDelivered && report.productsDelivered.length > 0) {
      const validProds = report.productsDelivered.filter((p) => p.name.trim() !== '');
      if (validProds.length > 0) {
        updatedProducts = [...validProds, ...updatedProducts];

        // Deduct products from warehouse inventory
        validProds.forEach((vp) => {
          if (vp.warehouseId) {
            this.deductProductFromWarehouse(vp.warehouseId, vp.quantity, vp.unit);
          }
        });

        const totalDeliveredValue = validProds.reduce(
          (sum, p) => sum + (p.totalPrice || p.quantity * p.unitPrice),
          0
        );

        const deliveryPay = report.deliveryPayment;
        const payType = deliveryPay?.paymentType || 'qarzga';
        const paidAmt =
          deliveryPay?.paidAmount !== undefined
            ? deliveryPay.paidAmount
            : payType === 'qarzga'
            ? 0
            : totalDeliveredValue;
        const debtAdded = Math.max(0, totalDeliveredValue - paidAmt);
        const overpaid = Math.max(0, paidAmt - totalDeliveredValue);

        // Apply debtAdded: reduces advance first, then adds to debt
        if (debtAdded > 0) {
          if (newAdvance >= debtAdded) {
            newAdvance -= debtAdded;
          } else {
            newDebt += (debtAdded - newAdvance);
            newAdvance = 0;
          }
        }

        // Apply overpaid (if customer paid more than delivered value)
        if (overpaid > 0) {
          if (overpaid <= newDebt) {
            newDebt -= overpaid;
          } else {
            newAdvance += (overpaid - newDebt);
            newDebt = 0;
          }
        }

        const prodSumStr = validProds
          .map((p) => `${p.name} (${p.quantity} ${p.unit})`)
          .join(', ');

        const payDesc =
          payType === 'qarzga'
            ? `Qarzga berildi (+${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(debtAdded)} USD qarzga yozildi)`
            : `To'lov shakli: ${deliveryPay?.paymentLabel || payType} (${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(paidAmt)} USD)${debtAdded > 0 ? `, qoldiq qarz: +${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(debtAdded)} USD` : ''}`;

        clientLogs.unshift({
          id: 'log_' + Date.now() + '_prod',
          clientId: client.id,
          author,
          timestamp: nowStr,
          type: 'product_added',
          title: "Yangi mahsulotlar topshirildi",
          details: `${author} tomonidan topshirildi: ${prodSumStr}. Qiymati: ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(totalDeliveredValue)} USD. ${payDesc}`,
          amountChanged: debtAdded > 0 ? debtAdded : paidAmt,
        });
      }
    }

    // Products returned operation (Mahsulotlarni qaytarish va omborga qo'shish)
    if (report.productsReturned && report.productsReturned.length > 0) {
      const validReturns = report.productsReturned.filter((r) => r.quantity > 0);
      if (validReturns.length > 0) {
        let totalReturnedValue = 0;

        validReturns.forEach((retItem) => {
          // Deduct from client's products
          const pIndex = updatedProducts.findIndex(
            (p) => p.id === retItem.productId || p.name === retItem.name
          );
          if (pIndex !== -1) {
            const existing = updatedProducts[pIndex];
            const newQty = Math.max(0, existing.quantity - retItem.quantity);
            const price = existing.unitPrice || retItem.unitPrice || 0;
            totalReturnedValue += retItem.quantity * price;

            if (newQty <= 0) {
              updatedProducts.splice(pIndex, 1);
            } else {
              updatedProducts[pIndex] = {
                ...existing,
                quantity: newQty,
                totalPrice: Math.round(newQty * price),
              };
            }
          }

          // Return back into warehouse inventory
          this.returnProductToWarehouse(retItem, author);
        });

        // Deduct from client debt if applicable
        if (totalReturnedValue > 0) {
          if (newDebt >= totalReturnedValue) {
            newDebt -= totalReturnedValue;
          } else {
            newAdvance += totalReturnedValue - newDebt;
            newDebt = 0;
          }
        }

        const returnedStr = validReturns
          .map((r) => `${r.name} (${r.quantity} ${r.unit})`)
          .join(', ');

        clientLogs.unshift({
          id: 'log_' + Date.now() + '_ret',
          clientId: client.id,
          author,
          timestamp: nowStr,
          type: 'product_added',
          title: "Mahsulot omborga qaytarildi",
          details: `${author} tomonidan qabul qilindi va omborga qo'shildi: ${returnedStr}. Qarz ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(totalReturnedValue)} USD kamaytirildi.`,
          amountChanged: totalReturnedValue,
        });
      }
    }

    // Action done audit log
    clientLogs.unshift({
      id: 'log_' + Date.now() + '_act',
      clientId: client.id,
      author,
      timestamp: nowStr,
      type: 'visit_action',
      title: `Kunlik amal: ${report.actionDone}`,
      details: `${author} kunlik reja doirasida bajardi: ${report.actionDone}. ${report.reportNote ? `Qayd: ${report.reportNote}` : ''}`,
    });

    const updatedClient = this.updateClient(client.id, {
      currentDebt: newDebt,
      currentAdvance: newAdvance,
      products: updatedProducts,
      logs: clientLogs,
      updatedAt: nowStr,
    });

    return { success: true, client: updatedClient || undefined };
  }

  // Rejadagi mijoz bo'yicha amallarni to'liq yakunlash (Oxirgi marta yopish)
  public closeDailyPlanItem(planItemId: string, author: string, closeReason?: string): boolean {
    const plans = this.getDailyPlans();
    const planIndex = plans.findIndex((p) => p.id === planItemId);
    if (planIndex === -1) return false;

    const plan = plans[planIndex];
    const nowStr = new Date().toISOString();
    const finalReason = closeReason?.trim() || "Amallar yakunlandi";
    plan.isClosed = true;
    plan.status = 'yopildi';
    plan.closedAt = nowStr;
    plan.closedBy = author;
    plan.closeReason = finalReason;
    plans[planIndex] = plan;
    this.saveDailyPlans(plans);

    // Audit logga yozish
    const client = this.getClients().find((c) => c.id === plan.clientId);
    if (client) {
      const clientLogs = client.logs || [];
      clientLogs.unshift({
        id: 'log_' + Date.now() + '_close',
        clientId: client.id,
        author,
        timestamp: nowStr,
        type: 'visit_action',
        title: 'Reja yakunlandi va yopildi',
        details: `${author} tomonidan ushbu mijoz bo'yicha amallar yakunlandi va reja to'liq yopildi. Yopilish sababi: ${finalReason}`,
      });
      this.updateClient(client.id, {
        logs: clientLogs,
        lastPlanClosedAt: nowStr,
        lastPlanCloseReason: finalReason,
        lastPlanClosedBy: author,
        updatedAt: nowStr,
      });
    }

    return true;
  }

  // --- Offline Sync Queue ---
  public getSyncQueue(): Array<{ action: string; client?: Client; clientId?: string; timestamp: string }> {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private addToSyncQueue(item: { action: string; client?: Client; clientId?: string }) {
    if (typeof window === 'undefined') return;
    const queue = this.getSyncQueue();
    queue.push({
      ...item,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  }

  public clearSyncQueue() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SYNC_QUEUE_KEY);
    localStorage.setItem(SYNC_TIMESTAMP_KEY, new Date().toISOString());
    const clients = this.getClients().map((c) => ({ ...c, syncStatus: 'synced' as const }));
    this.saveClients(clients);
  }

  public getLastSyncedTime(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(SYNC_TIMESTAMP_KEY);
  }

  public getFirebaseConfig() {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(FIREBASE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  public saveFirebaseConfig(config: { projectId: string; collectionName: string; autoSync: boolean }) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    this.notify();
  }

  public async syncWithCloud(): Promise<{ success: boolean; message: string; count: number }> {
    const queue = this.getSyncQueue();
    if (!navigator.onLine) {
      return {
        success: false,
        message: "Hozir oflayn rejimdasiz. Internetga ulanganda avtomatik sinxronlanadi.",
        count: queue.length,
      };
    }

    await new Promise((res) => setTimeout(res, 600));

    const count = queue.length;
    this.clearSyncQueue();
    return {
      success: true,
      message: `${count > 0 ? count + " ta o'zgarish bulut bilan muvaffaqiyatli sinxronlandi." : "Barcha ma'lumotlar dolzarb, sinxronlash yakunlandi."}`,
      count,
    };
  }

  public exportToCSV(): void {
    const clients = this.getClients();
    const rows: string[] = [];

    rows.push(['ID', 'Ismi', 'Telefon', 'Manzil', 'Mahsulotlar soni', 'Mahsulotlar umumiy summasi', 'Joriy qarzdorlik', 'Joriy haqdorlik', 'Qo\'shgan login', 'Yaratilgan sana'].join(';'));

    clients.forEach((c) => {
      const totalProdVal = c.products.reduce((acc, p) => acc + (p.totalPrice || p.quantity * p.unitPrice), 0);

      const row = [
        `"${c.id}"`,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.phone}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        c.products.length,
        totalProdVal,
        c.currentDebt,
        c.currentAdvance,
        `"${c.createdBy || 'adminc'}"`,
        `"${c.createdAt}"`,
      ];
      rows.push(row.join(';'));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mijozlar_hisobi_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  public exportToJSON(): void {
    const clients = this.getClients();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(clients, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `mijozlar_zaxira_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  }

  public importFromJSON(jsonString: string): { success: boolean; count: number; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) {
        return { success: false, count: 0, error: "Fayl formati noto'g'ri (massiv emas)" };
      }
      this.saveClients(parsed);
      return { success: true, count: parsed.length };
    } catch (e: any) {
      return { success: false, count: 0, error: e?.message || "JSON faylni o'qishda xatolik" };
    }
  }

  // ==========================================
  // WAREHOUSE MANAGEMENT (Ombor zaxirasi)
  // ==========================================
  public getWarehouseProducts(): WarehouseProduct[] {
    if (this.warehouseCache) return this.warehouseCache;
    try {
      const deletedIds = getDeletedWarehouseIds();
      const data = localStorage.getItem(WAREHOUSE_KEY);
      if (!data) {
        const initialFiltered = INITIAL_WAREHOUSE_PRODUCTS.filter((p) => !deletedIds.has(p.id));
        localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(initialFiltered));
        this.warehouseCache = initialFiltered;
        return initialFiltered;
      }
      const parsed: WarehouseProduct[] = JSON.parse(data);
      const filtered = parsed
        .filter((p) => p && p.id && !deletedIds.has(p.id))
        .map((p) => ({
          ...p,
          currency: 'USD',
          minSellingPricingUnitType: p.minSellingPricingUnitType || p.pricingUnitType || 'piece',
          minSellingPrice: p.minSellingPrice !== undefined ? p.minSellingPrice : p.price || 0,
        }));
      if (filtered.length !== parsed.length) {
        localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(filtered));
      }
      this.warehouseCache = filtered;
      return filtered;
    } catch {
      const deletedIds = getDeletedWarehouseIds();
      const fallback = INITIAL_WAREHOUSE_PRODUCTS.filter((p) => !deletedIds.has(p.id));
      this.warehouseCache = fallback;
      return fallback;
    }
  }

  public saveWarehouseProducts(items: WarehouseProduct[]): void {
    try {
      const deletedIds = getDeletedWarehouseIds();
      const cleanItems = items.filter((p) => p && p.id && !deletedIds.has(p.id));
      this.warehouseCache = cleanItems;
      localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(cleanItems));
      this.notify();
    } catch (e) {
      console.error('Failed to save warehouse products to localStorage:', e);
    }
  }

  public addWarehouseProduct(
    productData: Omit<WarehouseProduct, 'id' | 'createdAt'>
  ): WarehouseProduct {
    const products = [...this.getWarehouseProducts()];
    const newProduct: WarehouseProduct = {
      ...productData,
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    products.unshift(newProduct);
    this.saveWarehouseProducts(products);
    return newProduct;
  }

  public addWarehouseProductsBulk(
    productsData: Array<Omit<WarehouseProduct, 'id' | 'createdAt'>>
  ): WarehouseProduct[] {
    if (!productsData || productsData.length === 0) return [];
    const existing = [...this.getWarehouseProducts()];
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const created: WarehouseProduct[] = productsData.map((data, idx) => ({
      ...data,
      currency: 'USD',
      id: `wh_${nowMs}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: nowIso,
    }));

    const combined = [...created, ...existing];
    this.saveWarehouseProducts(combined);
    return created;
  }

  public updateWarehouseProduct(
    id: string,
    productData: Omit<WarehouseProduct, 'id' | 'createdAt'>
  ): WarehouseProduct | null {
    const products = [...this.getWarehouseProducts()];
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const existing = products[index];
    const updatedProduct: WarehouseProduct = {
      ...existing,
      ...productData,
      id: existing.id,
      createdAt: existing.createdAt,
      currency: 'USD',
    };
    products[index] = updatedProduct;
    this.saveWarehouseProducts(products);
    return updatedProduct;
  }

  public deleteWarehouseProduct(id: string): void {
    markWarehouseProductAsDeleted(id);
    try {
      const raw = localStorage.getItem(WAREHOUSE_KEY);
      const currentList: WarehouseProduct[] = raw ? JSON.parse(raw) : this.getWarehouseProducts();
      const deletedIds = getDeletedWarehouseIds();
      const updated = currentList.filter((p) => p && p.id !== id && !deletedIds.has(p.id));
      this.warehouseCache = updated;
      localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete warehouse product from localStorage:', e);
    }
    this.notify();
  }

  public deductProductFromWarehouse(
    warehouseId: string,
    quantity: number,
    unit: string
  ): void {
    const warehouse = this.getWarehouseProducts();
    const found = warehouse.find((w) => w.id === warehouseId);
    if (!found) return;

    const isPkg = unit === found.packageUnitName;
    const piecesToDeduct = isPkg
      ? quantity * (found.piecesPerPackage || 1)
      : quantity;
    const volToDeduct = piecesToDeduct * (found.volumePerPiece || 0);

    found.totalPieces = Math.max(0, found.totalPieces - piecesToDeduct);
    found.totalVolume = Math.max(0, found.totalVolume - volToDeduct);
    this.saveWarehouseProducts(warehouse);
  }

  public returnProductToWarehouse(
    item: {
      productId: string;
      name: string;
      unit: string;
      quantity: number;
      unitPrice?: number;
      warehouseId?: string;
    },
    author: string
  ): void {
    const warehouse = this.getWarehouseProducts();
    const itemNorm = item.name.toLowerCase().trim();

    // Try finding warehouse product by warehouseId or matching name
    let found = warehouse.find((w) => w.id === item.warehouseId);
    if (!found) {
      found = warehouse.find(
        (w) =>
          itemNorm.includes(w.name.toLowerCase()) ||
          w.name.toLowerCase().includes(itemNorm) ||
          itemNorm.includes(w.brand.toLowerCase())
      );
    }

    if (found) {
      const isPkg = item.unit === found.packageUnitName;
      const piecesToAdd = isPkg
        ? item.quantity * (found.piecesPerPackage || 1)
        : item.quantity;
      const volToAdd = piecesToAdd * (found.volumePerPiece || 0);

      found.totalPieces += piecesToAdd;
      found.totalVolume += volToAdd;
      found.intakeQuantity += isPkg
        ? item.quantity
        : Math.ceil(piecesToAdd / (found.piecesPerPackage || 1));
      found.notes = `${found.notes ? found.notes + '; ' : ''}+${item.quantity} ${item.unit} qaytarildi (${author})`;
    } else {
      // Create new warehouse stock entry for the returned item
      const newWh: WarehouseProduct = {
        id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        brand: 'Mijozdan qaytgan',
        name: item.name,
        mark1: 'Qaytarilgan',
        mark2: '',
        baseUnit: item.unit || 'dona',
        pieceUnitName: item.unit || 'dona',
        volumePerPiece: 1,
        packageUnitName: item.unit || 'dona',
        piecesPerPackage: 1,
        pricingUnitType: 'piece',
        currency: 'USD',
        price: item.unitPrice || 0,
        intakeDate: new Date().toISOString().slice(0, 10),
        intakeUnitType: 'piece',
        intakeQuantity: item.quantity,
        totalSum: Math.round((item.unitPrice || 0) * item.quantity),
        totalPieces: item.quantity,
        totalVolume: item.quantity,
        minSellingPricingUnitType: 'piece',
        minSellingPrice: item.unitPrice || 0,
        createdBy: author,
        createdAt: new Date().toISOString(),
        notes: `${author} tomonidan mijozdan qaytarib olindi`,
      };
      warehouse.unshift(newWh);
    }

    this.saveWarehouseProducts(warehouse);
  }

  // ==========================================
  // MONTHLY DEBT RECOVERY PLANS (1 oylik reja)
  // ==========================================
  public getMonthlyPlans(): MonthlyPlan[] {
    if (this.monthlyPlansCache) return this.monthlyPlansCache;
    try {
      const data = localStorage.getItem(MONTHLY_PLANS_KEY);
      if (!data) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

        const existingClients = this.getClients();
        const initialClientDebts: Record<string, number> = {};
        let initialTotalDebt = 0;
        existingClients.forEach((c) => {
          if (c.currentDebt && c.currentDebt > 0) {
            initialClientDebts[c.id] = c.currentDebt;
            initialTotalDebt += c.currentDebt;
          }
        });

        const defaultTarget = initialTotalDebt > 0 ? initialTotalDebt : 10000;

        const initialPlan: MonthlyPlan = {
          id: 'month_plan_seed_1',
          agentUsername: 'agentp1',
          targets: [
            { currency: 'USD', targetAmount: defaultTarget },
          ],
          initialClientDebts,
          initialTotalDebt: defaultTarget,
          startDate: startOfMonth,
          endDate: endOfMonth,
          createdAt: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          createdBy: 'agentp1',
          notes: "Mavjud mijozlardan eski qarzdorliklarni undirish bo'yicha 1 oylik reja",
          status: 'active',
        };
        const list = [initialPlan];
        localStorage.setItem(MONTHLY_PLANS_KEY, JSON.stringify(list));
        this.monthlyPlansCache = list;
        return list;
      }
      const parsed: MonthlyPlan[] = JSON.parse(data);
      const normalized = parsed.map((p) => ({
        ...p,
        targets: (p.targets || []).map((t) => ({ ...t, currency: 'USD' })),
      }));
      this.monthlyPlansCache = normalized;
      return normalized;
    } catch {
      return [];
    }
  }

  public saveMonthlyPlans(plans: MonthlyPlan[]): void {
    try {
      this.monthlyPlansCache = plans;
      localStorage.setItem(MONTHLY_PLANS_KEY, JSON.stringify(plans));
      this.notify();
    } catch (e) {
      console.error('Failed to save monthly plans:', e);
    }
  }

  public addMonthlyPlan(
    planData: Omit<MonthlyPlan, 'id' | 'createdAt'>
  ): MonthlyPlan {
    const plans = this.getMonthlyPlans();
    const updatedPlans = plans.map((p) => {
      if (p.agentUsername === planData.agentUsername && p.status === 'active') {
        return { ...p, status: 'completed' as const };
      }
      return p;
    });

    // Snapshot existing clients and their current debts at the moment this plan is created
    const existingClients = this.getClients();
    const initialClientDebts: Record<string, number> = planData.initialClientDebts || {};
    let initialTotalDebt = planData.initialTotalDebt || 0;

    if (Object.keys(initialClientDebts).length === 0) {
      initialTotalDebt = 0;
      existingClients.forEach((c) => {
        if (c.currentDebt && c.currentDebt > 0) {
          initialClientDebts[c.id] = c.currentDebt;
          initialTotalDebt += c.currentDebt;
        }
      });
    }

    const normalizedTargets = (planData.targets || []).map((t) => ({
      currency: 'USD',
      targetAmount: t.targetAmount > 0 ? t.targetAmount : initialTotalDebt,
    }));

    const newPlan: MonthlyPlan = {
      ...planData,
      targets: normalizedTargets,
      initialClientDebts,
      initialTotalDebt,
      id: `mp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    updatedPlans.unshift(newPlan);
    this.saveMonthlyPlans(updatedPlans);
    return newPlan;
  }

  public getActiveMonthlyPlan(agentUsername?: string): MonthlyPlan | null {
    const plans = this.getMonthlyPlans();
    if (agentUsername && agentUsername.startsWith('agent')) {
      const found = plans.find((p) => p.agentUsername === agentUsername && p.status === 'active');
      if (found) return found;
    }
    const active = plans.find((p) => p.status === 'active');
    return active || (plans.length > 0 ? plans[0] : null);
  }

  // Calculate progress strictly from pre-existing client debts at the time the plan was created.
  // Optimized with O(1) Map indexes so it runs in O(N + M) instead of O(N * M).
  public calculateMonthlyPlanProgress(plan: MonthlyPlan) {
    const startDateObj = new Date(plan.startDate + 'T00:00:00');
    const endDateObj = new Date(plan.endDate + 'T23:59:59');
    const planCreatedTime = new Date(plan.createdAt || plan.startDate + 'T00:00:00');

    const clients = this.getClients();
    const clientsMap = this.clientsMapCache || new Map(clients.map((c) => [c.id, c]));
    const deletedIds = getDeletedClientIds();
    const dailyPlans = this.getDailyPlans();

    // Index dailyPlans by clientId in O(M)
    const plansByClient = new Map<string, DailyPlanItem[]>();
    for (let i = 0; i < dailyPlans.length; i++) {
      const dp = dailyPlans[i];
      const existing = plansByClient.get(dp.clientId);
      if (existing) {
        existing.push(dp);
      } else {
        plansByClient.set(dp.clientId, [dp]);
      }
    }

    // 1. Determine baseline old debts snapshot (faol eski qarzdorliklar, o'chirilgan mijozlarsiz)
    const baselineDebts: Record<string, number> = {};
    if (plan.initialClientDebts && Object.keys(plan.initialClientDebts).length > 0) {
      Object.entries(plan.initialClientDebts).forEach(([cId, debt]) => {
        if (debt > 0 && !deletedIds.has(cId) && clientsMap.has(cId)) {
          baselineDebts[cId] = debt;
        }
      });
    } else {
      // Fallback for plans without snapshot: include only clients created on or before plan creation
      clients.forEach((c) => {
        const cCreated = new Date(c.createdAt || 0);
        if (cCreated <= planCreatedTime && c.currentDebt > 0 && !deletedIds.has(c.id)) {
          baselineDebts[c.id] = c.currentDebt;
        }
      });
    }

    const oldClientIds = Object.keys(baselineDebts);
    let totalOldDebtRecovered = 0;
    let totalPaymentsCount = 0;

    // 2. For each pre-existing debtor client, calculate how much of their OLD debt was closed
    oldClientIds.forEach((clientId) => {
      const oldDebt = baselineDebts[clientId] || 0;
      if (oldDebt <= 0) return;

      const clientObj = clientsMap.get(clientId);
      let paymentsClosingOldDebt = 0;
      let newDebtsAddedAfterPlan = 0;

      // Check daily plan actions for this client via O(1) Map lookup
      const clientDailyPlans = plansByClient.get(clientId) || [];
      clientDailyPlans.forEach((dp) => {
          if (dp.actionsHistory && dp.actionsHistory.length > 0) {
            dp.actionsHistory.forEach((act) => {
              const actTime = new Date(act.timestamp || dp.completedAt || dp.createdAt);
              const isInPeriod =
                actTime >= startDateObj &&
                actTime <= endDateObj &&
                actTime >= planCreatedTime;

              if (isInPeriod) {
                // Direct financial payment toward debt
                if (act.financialAction && act.financialAction.amount > 0) {
                  paymentsClosingOldDebt += act.financialAction.amount;
                  totalPaymentsCount++;
                }
                // Delivery payment: new debt added vs overpayment closing old debt
                if (act.deliveryPayment) {
                  const debtAdded = act.deliveryPayment.debtAmount || 0;
                  if (debtAdded > 0) {
                    newDebtsAddedAfterPlan += debtAdded;
                  }
                  const overpaid = Math.max(
                    0,
                    (act.deliveryPayment.paidAmount || 0) - (act.deliveryPayment.totalAmount || 0)
                  );
                  if (overpaid > 0) {
                    paymentsClosingOldDebt += overpaid;
                    totalPaymentsCount++;
                  }
                }
                // Product returns reducing debt
                if (act.productsReturned && act.productsReturned.length > 0) {
                  const retVal = act.productsReturned.reduce(
                    (s, r) => s + (r.quantity || 0) * (r.unitPrice || 0),
                    0
                  );
                  if (retVal > 0) {
                    paymentsClosingOldDebt += retVal;
                  }
                }
              }
            });
          } else if (dp.completedAt) {
            const compTime = new Date(dp.completedAt);
            const isInPeriod =
              compTime >= startDateObj &&
              compTime <= endDateObj &&
              compTime >= planCreatedTime;

            if (isInPeriod) {
              if (dp.financialAction && dp.financialAction.amount > 0) {
                paymentsClosingOldDebt += dp.financialAction.amount;
                totalPaymentsCount++;
              }
              if (dp.deliveryPayment) {
                const debtAdded = dp.deliveryPayment.debtAmount || 0;
                if (debtAdded > 0) {
                  newDebtsAddedAfterPlan += debtAdded;
                }
                const overpaid = Math.max(
                  0,
                  (dp.deliveryPayment.paidAmount || 0) - (dp.deliveryPayment.totalAmount || 0)
                );
                if (overpaid > 0) {
                  paymentsClosingOldDebt += overpaid;
                  totalPaymentsCount++;
                }
              }
            }
          }
        });

      // Check client audit logs for independent payments or new debt additions after plan creation
      if (clientObj && clientObj.logs) {
        clientObj.logs.forEach((l) => {
          const logTime = new Date(l.timestamp);
          const isInPeriod =
            logTime >= startDateObj &&
            logTime <= endDateObj &&
            logTime >= planCreatedTime;
          if (!isInPeriod) return;

          const text = `${l.title} ${l.details}`.toLowerCase();
          const isDebtAddition =
            text.includes("qarz qo'shildi") ||
            text.includes("qarzdorlik qo'shildi") ||
            l.id.endsWith('_whdebt');

          if (isDebtAddition && l.amountChanged && l.amountChanged > 0) {
            newDebtsAddedAfterPlan += l.amountChanged;
          } else if (
            l.type === 'payment' &&
            l.amountChanged &&
            l.amountChanged > 0 &&
            !l.id.endsWith('_fin') &&
            !isDebtAddition
          ) {
            paymentsClosingOldDebt += l.amountChanged;
            totalPaymentsCount++;
          }
        });
      }

      // Direct comparison of client's current debt excluding new debts added after plan creation
      let directOldDebtReduction = 0;
      if (clientObj) {
        const currentDebtWithoutNewDebts = Math.max(
          0,
          (clientObj.currentDebt || 0) - newDebtsAddedAfterPlan
        );
        directOldDebtReduction = Math.max(0, oldDebt - currentDebtWithoutNewDebts);
      }

      // Old debt recovered from this client is capped at their initial oldDebt
      // so paying off new debts never inflates the recovery of old debt
      const recoveredForClient = Math.min(
        oldDebt,
        Math.max(paymentsClosingOldDebt, directOldDebtReduction)
      );

      totalOldDebtRecovered += recoveredForClient;
    });

    const baselineTotalOldDebt =
      plan.initialTotalDebt && plan.initialTotalDebt > 0
        ? plan.initialTotalDebt
        : Object.values(baselineDebts).reduce((s, v) => s + v, 0);

    const rawTarget = plan.targets?.[0]?.targetAmount || 0;
    const effectiveTarget =
      plan.id === 'month_plan_seed_1' && baselineTotalOldDebt > 0
        ? baselineTotalOldDebt
        : rawTarget > 0
        ? rawTarget
        : baselineTotalOldDebt;

    const collectedRounded = Math.round(totalOldDebtRecovered * 100) / 100;
    const targetRounded = Math.round(effectiveTarget * 100) / 100;
    const percentage =
      targetRounded > 0
        ? Math.min(100, Math.round(((collectedRounded / targetRounded) * 100) * 10) / 10)
        : 0;
    const remainingAmount = Math.max(0, Math.round((targetRounded - collectedRounded) * 100) / 100);

    const targetResults = [
      {
        currency: 'USD',
        targetAmount: targetRounded,
        collectedAmount: collectedRounded,
        percentage,
        remainingAmount,
      },
    ];

    const nowMs = Date.now();
    const endMs = endDateObj.getTime();
    const daysLeft = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 3600 * 24)));
    const isExpired = endMs < nowMs;

    return {
      targetResults,
      overallPercentage: percentage,
      initialTotalDebt: Math.round(baselineTotalOldDebt * 100) / 100,
      daysLeft,
      isExpired,
      totalPaymentsCount,
    };
  }
}

export const storageService = new StorageService();
