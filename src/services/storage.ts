import {
  Client,
  ClientAuditLog,
  DailyPlanItem,
  PlanActionType,
  FinancialMethodType,
  FinancialPaymentSplit,
  ProductItem,
  WarehouseProduct,
  DeliveryPaymentInfo,
  MonthlyPlan,
  MonthlyPlanTarget,
  MonthlyPlanDecadeTargets,
  MonthlyPlanEditLog,
  MonthlyPlanClientItem,
  MonthlyProductPlanClientItem,
  PlannedProductDeliveryItem,
  ClientReminder,
  WarehouseStockChangeLog,
} from '../types';
import { parseLegacyAddress, formatAddress } from '../utils/location';
import { getInitialDebtForClient } from '../utils/format';

const STORAGE_KEY = 'savdo_clients_data_v1';
const SYNC_QUEUE_KEY = 'savdo_sync_queue_v1';
const FIREBASE_CONFIG_KEY = 'savdo_firebase_config_v1';
const SYNC_TIMESTAMP_KEY = 'savdo_last_synced_at';
const DAILY_PLANS_KEY = 'savdo_daily_plans_v1';
const WAREHOUSE_KEY = 'savdo_warehouse_products_v1';
const MONTHLY_PLANS_KEY = 'savdo_monthly_plans_v1';
export const DELETED_CLIENT_IDS_KEY = 'savdo_deleted_client_ids_v1';
export const DELETED_WAREHOUSE_IDS_KEY = 'savdo_deleted_warehouse_ids_v1';
export const DELETED_PLAN_IDS_KEY = 'savdo_deleted_plan_ids_v1';
export const APP_INITIALIZED_KEY = 'savdo_app_initialized_v1';

// Yopilgan rejalar 7 kundan keyin avtomatik tozalanishi va barchada ko'rinmasligi uchun
export const CLOSED_PLAN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 kun

export function isClosedPlanExpired7Days(_plan: DailyPlanItem): boolean {
  // Yopilgan rejalar "Yopilganlar" ro'yxatidan o'z-o'zidan o'chib ketmasligi va har doim ko'rinishi uchun false qaytaramiz
  return false;
}

export function getPlanDateKey(p: DailyPlanItem | null | undefined): string {
  if (!p) return '';
  if (p.isClosed || p.status === 'yopildi') {
    const closedKey = getClosedDateKey(p);
    if (closedKey) return closedKey;
  }
  const lastClosed = String((p as any).lastClosedDateKey || '').trim();
  if (lastClosed && /^\d{4}-\d{2}-\d{2}/.test(lastClosed)) {
    return lastClosed.slice(0, 10);
  }
  if (p.planDate && /^\d{4}-\d{2}-\d{2}/.test(p.planDate.trim())) {
    return p.planDate.trim().slice(0, 10);
  }
  if (p.createdAt) {
    const d = new Date(p.createdAt);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return p.createdAt.slice(0, 10);
  }
  return '';
}

export function getClosedDateKey(p: DailyPlanItem | null | undefined): string {
  if (!p) return '';
  const rawStr = (
    (p as any).closedDisplayDate ||
    (p as any).lastClosedDateKey ||
    p.closedAt ||
    ''
  ).trim();
  if (!rawStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawStr)) {
    return rawStr;
  }
  const d = new Date(rawStr);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return rawStr.slice(0, 10);
}

export function getPlanSoldProductsData(plan: DailyPlanItem | null | undefined): {
  productsDelivered: ProductItem[];
  deliveryPayment?: DeliveryPaymentInfo;
  historyIndex: number;
} {
  if (!plan) return { productsDelivered: [], historyIndex: -1 };
  if (plan.actionsHistory && plan.actionsHistory.length > 0) {
    const idx = plan.actionsHistory.findIndex(
      (act) => act.productsDelivered && act.productsDelivered.length > 0
    );
    if (idx !== -1) {
      return {
        productsDelivered: plan.actionsHistory[idx].productsDelivered || [],
        deliveryPayment: plan.actionsHistory[idx].deliveryPayment || plan.deliveryPayment,
        historyIndex: idx,
      };
    }
  }
  if (plan.productsDelivered && plan.productsDelivered.length > 0) {
    return {
      productsDelivered: plan.productsDelivered,
      deliveryPayment: plan.deliveryPayment,
      historyIndex: -1,
    };
  }
  return { productsDelivered: [], historyIndex: -1 };
}

export function getPlanFinancialActionData(plan: DailyPlanItem | null | undefined): {
  financialAction?: NonNullable<DailyPlanItem['financialAction']>;
  totalFinancialAmount: number;
  historyIndex: number;
} {
  if (!plan) return { totalFinancialAmount: 0, historyIndex: -1 };
  if (plan.actionsHistory && plan.actionsHistory.length > 0) {
    let totalFinancialAmount = 0;
    let firstIdx = -1;
    let latestFinancialAction: NonNullable<DailyPlanItem['financialAction']> | null = null;
    for (let idx = 0; idx < plan.actionsHistory.length; idx++) {
      const act = plan.actionsHistory[idx];
      if (act.financialAction && act.financialAction.amount > 0) {
        if (firstIdx === -1) firstIdx = idx;
        totalFinancialAmount += act.financialAction.amount;
        latestFinancialAction = {
          ...act.financialAction,
          method: act.financialAction.method || 'naqd',
        };
      }
    }
    if (firstIdx !== -1 && latestFinancialAction) {
      const mergedAction: NonNullable<DailyPlanItem['financialAction']> =
        totalFinancialAmount !== latestFinancialAction.amount
          ? {
              ...latestFinancialAction,
              amount: Math.round(totalFinancialAmount * 100) / 100,
            }
          : latestFinancialAction;
      return {
        financialAction: mergedAction,
        totalFinancialAmount: Math.round(totalFinancialAmount * 100) / 100,
        historyIndex: firstIdx,
      };
    }
  }
  if (plan.financialAction && plan.financialAction.amount > 0) {
    return {
      financialAction: plan.financialAction,
      totalFinancialAmount: Math.round(plan.financialAction.amount * 100) / 100,
      historyIndex: -1,
    };
  }
  return { totalFinancialAmount: 0, historyIndex: -1 };
}

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

let deletedPlanIdsCache: Set<string> | null = null;

export function getDeletedPlanIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  if (deletedPlanIdsCache) return deletedPlanIdsCache;
  try {
    const raw = localStorage.getItem(DELETED_PLAN_IDS_KEY);
    deletedPlanIdsCache = raw ? new Set(JSON.parse(raw)) : new Set();
    return deletedPlanIdsCache;
  } catch {
    deletedPlanIdsCache = new Set();
    return deletedPlanIdsCache;
  }
}

export function markPlanAsDeleted(planId: string): void {
  if (typeof window === 'undefined' || !planId) return;
  try {
    const ids = getDeletedPlanIds();
    if (ids.has(planId)) return;
    ids.add(planId);
    localStorage.setItem(DELETED_PLAN_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.error('Failed to mark plan as deleted', e);
  }
}

export function unmarkPlanAsDeleted(planId: string): void {
  if (typeof window === 'undefined' || !planId) return;
  try {
    const ids = getDeletedPlanIds();
    if (!ids.has(planId)) return;
    ids.delete(planId);
    localStorage.setItem(DELETED_PLAN_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
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
      const OPS_RESET_FLAG = 'savdo_ops_reset_v20261105';
      if (!localStorage.getItem(OPS_RESET_FLAG)) {
        localStorage.setItem(OPS_RESET_FLAG, 'true');
        localStorage.removeItem(SYNC_QUEUE_KEY);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(DAILY_PLANS_KEY);
        localStorage.removeItem(WAREHOUSE_KEY);
      }
      const isInit = localStorage.getItem(APP_INITIALIZED_KEY);
      if (!isInit) {
        localStorage.setItem(APP_INITIALIZED_KEY, 'true');
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
            initialDebt: getInitialDebtForClient(c),
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
      initialDebt: clientData.initialDebt !== undefined ? clientData.initialDebt : (clientData.currentDebt || 0),
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
        initialDebt: clientData.initialDebt !== undefined ? clientData.initialDebt : (clientData.currentDebt || 0),
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

  public updateClient(id: string, updates: Partial<Omit<Client, 'id'>>): Client | null {
    const clients = [...this.getClients()];
    const index = clients.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const existing = clients[index];
    const newCreatedAt = updates.createdAt || existing.createdAt;

    let updatedLogs = updates.logs ? [...updates.logs] : (existing.logs ? [...existing.logs] : []);
    if (updates.initialDebt !== undefined || updates.createdAt) {
      const initLogIndex = updatedLogs.findIndex(
        (l) => l && (l.type === 'created' || (l.title && (l.title.includes("qo'shildi") || l.title.includes("yuklandi"))))
      );
      const effInitDebt = updates.initialDebt !== undefined ? updates.initialDebt : getInitialDebtForClient(existing);
      if (initLogIndex !== -1) {
        const oldLog = updatedLogs[initLogIndex];
        const newDetails = oldLog.details && oldLog.details.includes('Qarz:')
          ? oldLog.details.replace(/Qarz:\s*[\d.,]+/i, `Qarz: ${effInitDebt}`)
          : `${oldLog.details || ''}. Qarz: ${effInitDebt} USD`.trim();
        updatedLogs[initLogIndex] = {
          ...oldLog,
          timestamp: newCreatedAt,
          details: newDetails,
        };
      } else {
        updatedLogs.unshift({
          id: 'log_' + Date.now() + '_init',
          clientId: id,
          author: existing.createdBy || 'adminc',
          timestamp: newCreatedAt,
          type: 'created',
          title: "Mijoz ro'yxatga qo'shildi",
          details: `Tizimga qo'shildi. Qarz: ${effInitDebt} USD`,
        });
      }
    }

    const updated: Client = {
      ...existing,
      ...updates,
      createdAt: newCreatedAt,
      logs: updatedLogs,
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
    author: string = 'adminc',
    conversionMeta?: {
      amountUzs?: number;
      exchangeRate?: number;
      purpose?: 'payment' | 'product';
      paymentMethodLabel?: string;
      usdAmount?: number;
    }
  ): Client | null {
    const client = this.getClients().find((c) => c.id === id);
    if (!client) return null;

    let updatedNotes = client.notes || '';
    if (noteAddition) {
      const timeStr = new Date().toLocaleDateString('uz-UZ');
      updatedNotes = updatedNotes ? `${updatedNotes} | [${timeStr}]: ${noteAddition}` : `[${timeStr}]: ${noteAddition}`;
    }

    const currentLogs = client.logs || [];
    const defaultChanged = Math.abs(
      (client.currentDebt || 0) - newDebt + ((newAdvance || 0) - (client.currentAdvance || 0))
    );
    currentLogs.unshift({
      id: 'log_' + Date.now() + '_pay',
      clientId: id,
      author,
      timestamp: new Date().toISOString(),
      type: 'payment',
      title: "Hisob-kitob yangilandi",
      details: `${author} tomonidan o'zgartirildi: ${noteAddition || ''}. Yangi qarz: ${newDebt} USD, Yangi avans: ${newAdvance} USD.`,
      amountChanged:
        conversionMeta?.usdAmount && conversionMeta.usdAmount > 0
          ? conversionMeta.usdAmount
          : defaultChanged || Math.abs((client.currentDebt || 0) - newDebt),
      amountUzs: conversionMeta?.amountUzs,
      exchangeRate: conversionMeta?.exchangeRate,
      purpose: conversionMeta?.purpose || 'payment',
      paymentMethodLabel: conversionMeta?.paymentMethodLabel,
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

    const getPlanCloseWallMs = (p: DailyPlanItem): number => {
      const wallStr = (p as any).closedUpdatedAt;
      const wallMs = wallStr ? new Date(wallStr).getTime() : 0;
      const closedMs = p.closedAt ? new Date(p.closedAt).getTime() : 0;
      return Math.max(isNaN(wallMs) ? 0 : wallMs, isNaN(closedMs) ? 0 : closedMs);
    };

    const getPlanEventTime = (p: DailyPlanItem): number => {
      const times = [
        p.reopenedAt ? new Date(p.reopenedAt).getTime() : 0,
        getPlanCloseWallMs(p),
        p.completedAt ? new Date(p.completedAt).getTime() : 0,
        p.lastExecutedAt ? new Date(p.lastExecutedAt).getTime() : 0,
        p.createdAt ? new Date(p.createdAt).getTime() : 0,
      ].filter((t) => !isNaN(t) && t > 0);
      return times.length > 0 ? Math.max(...times) : 0;
    };

    const scorePlan = (p: DailyPlanItem): number => {
      let score = 0;
      if (p.status === 'bajarildi' || p.actionDone) score += 500;
      score += (p.actionsCount || (p.actionsHistory ? p.actionsHistory.length : 0)) * 50;
      return score;
    };

    for (const plan of plans) {
      if (!plan || !plan.clientId) continue;
      const planDateKey = getPlanDateKey(plan);
      const key = `${plan.clientId}_${planDateKey}`;
      const existing = byClient.get(key);
      if (!existing) {
        byClient.set(key, plan);
      } else {
        const existingClosed = Boolean(existing.isClosed || existing.status === 'yopildi');
        const planClosed = Boolean(plan.isClosed || plan.status === 'yopildi');

        const existingReopened = Boolean(existing.reopenedAt && !existingClosed);
        const planReopened = Boolean(plan.reopenedAt && !planClosed);

        let pickCurrent = false;
        if (planReopened && !existingReopened) {
          const planReopenMs = new Date(plan.reopenedAt!).getTime();
          const existingClosedMs = existingClosed ? getPlanCloseWallMs(existing) : 0;
          pickCurrent = planReopenMs > existingClosedMs;
        } else if (existingReopened && !planReopened) {
          const existingReopenMs = new Date(existing.reopenedAt!).getTime();
          const planClosedMs = planClosed ? getPlanCloseWallMs(plan) : 0;
          pickCurrent = planClosedMs >= existingReopenMs;
        } else if (planClosed && !existingClosed) {
          pickCurrent = true;
        } else if (existingClosed && !planClosed) {
          pickCurrent = false;
        } else {
          const existingTime = getPlanEventTime(existing);
          const currentTime = getPlanEventTime(plan);
          if (currentTime > existingTime) {
            pickCurrent = true;
          } else if (currentTime < existingTime) {
            pickCurrent = false;
          } else {
            const existingScore = scorePlan(existing);
            const currentScore = scorePlan(plan);
            pickCurrent = currentScore >= existingScore;
          }
        }

        const winnerBase = pickCurrent ? plan : existing;
        const loserBase = pickCurrent ? existing : plan;
        if (loserBase.id !== winnerBase.id) {
          duplicateIds.push(loserBase.id);
        }

        const authoritativeActionsHistory =
          winnerBase.actionsHistory && winnerBase.actionsHistory.length > 0
            ? winnerBase.actionsHistory
            : loserBase.actionsHistory || [];
        const latestAction = authoritativeActionsHistory[0];

        byClient.set(key, {
          ...winnerBase,
          plannedAction: winnerBase.plannedAction || loserBase.plannedAction,
          plannedAmount: winnerBase.plannedAmount ?? loserBase.plannedAmount,
          planNote: winnerBase.planNote || loserBase.planNote,
          productsDelivered: winnerBase.productsDelivered || loserBase.productsDelivered,
          deliveryPayment: winnerBase.deliveryPayment || loserBase.deliveryPayment,
          financialAction: winnerBase.financialAction || loserBase.financialAction,
          productsReturned: winnerBase.productsReturned || loserBase.productsReturned,
          lastExecutedBy: winnerBase.lastExecutedBy || loserBase.lastExecutedBy || latestAction?.author,
          lastExecutedAt: winnerBase.lastExecutedAt || loserBase.lastExecutedAt || latestAction?.timestamp,
          actionsHistory:
            authoritativeActionsHistory.length > 0
              ? authoritativeActionsHistory
              : winnerBase.actionsHistory,
          actionsCount:
            authoritativeActionsHistory.length > 0
              ? authoritativeActionsHistory.length
              : winnerBase.actionsCount,
        });
      }
    }

    const dedupedByDate = Array.from(byClient.values());

    // Ochiq va qayta ochilgan rejalar har doim ro'yxatning boshida turadi, yopilganlar esa o'z holatida saqlanadi
    const uniquePlans = dedupedByDate.sort((a, b) => {
      const aOpen = !a.isClosed && a.status !== 'yopildi';
      const bOpen = !b.isClosed && b.status !== 'yopildi';
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      const aTime = getPlanEventTime(a);
      const bTime = getPlanEventTime(b);
      return bTime - aTime;
    });

    return { uniquePlans, duplicateIds };
  }

  private recoverClosedPlansFromClientLogs(plans: DailyPlanItem[]): {
    mergedPlans: DailyPlanItem[];
    recoveredAny: boolean;
  } {
    const clients = this.getClients();
    const deletedPlanIds = getDeletedPlanIds();
    // Remove any synthetic plan_rec_ items that were created on dates other than 2026-11-01 (unless they contain delivered products)
    const hasDeliveredProds = (p: DailyPlanItem) =>
      Boolean(
        (p.productsDelivered && p.productsDelivered.length > 0) ||
          (p.actionsHistory &&
            p.actionsHistory.some((a) => a.productsDelivered && a.productsDelivered.length > 0))
      );
    const resultPlans = plans.filter((p) => {
      if (!p || !p.id) return false;
      if (p.id.startsWith('plan_rec_') && !p.id.endsWith('_2026-11-01') && !hasDeliveredProds(p)) {
        return false;
      }
      return true;
    });
    let recoveredAny = resultPlans.length !== plans.length;

    const getLogWallMs = (l: ClientAuditLog): number => {
      if (l.id) {
        const m = l.id.match(/^log_(\d+)/);
        if (m && m[1]) {
          const parsed = Number(m[1]);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      }
      const t = l.timestamp ? new Date(l.timestamp).getTime() : 0;
      return isNaN(t) ? 0 : t;
    };

    for (const client of clients) {
      if (!client || !client.id || !Array.isArray(client.logs) || client.logs.length === 0) {
        continue;
      }

      // Find all close logs for this client
      const closeLogsByDate = new Map<string, { log: ClientAuditLog; wallMs: number }>();
      for (const l of client.logs) {
        if (!l) continue;
        const isCloseLog =
          l.id?.endsWith('_close') ||
          l.title === 'Reja bajarilmasdan yopildi' ||
          l.title === 'Reja yakunlandi va yopildi';
        if (!isCloseLog) continue;

        const dateKey = getPlanDateKey({ createdAt: l.timestamp } as DailyPlanItem);
        if (!dateKey) continue;

        const wallMs = getLogWallMs(l);
        const prev = closeLogsByDate.get(dateKey);
        if (!prev || wallMs > prev.wallMs) {
          closeLogsByDate.set(dateKey, { log: l, wallMs });
        }
      }

      if (closeLogsByDate.size === 0) continue;

      for (const [dateKey, { log: closeLog, wallMs: closeWallMs }] of closeLogsByDate.entries()) {
        // Check if there is a newer reopen or removal log after this closeLog
        const hasNewerReopenOrRemove = client.logs.some((l) => {
          if (!l || l.id === closeLog.id) return false;
          const isReopenOrRemove =
            l.id?.endsWith('_reopen') ||
            l.title === 'Reja qayta ochildi' ||
            l.id?.includes('_plan_rem_') ||
            l.title === 'Rejadan olib tashlandi';
          if (!isReopenOrRemove) return false;
          return getLogWallMs(l) > closeWallMs;
        });

        if (hasNewerReopenOrRemove) continue;

        const recId = `plan_rec_${client.id}_${dateKey}`;
        if (deletedPlanIds.has(recId)) continue;

        // Check if plans already has a plan for this client & dateKey (by planDate or closedAt)
        const existingIdx = resultPlans.findIndex(
          (p) =>
            p.clientId === client.id &&
            (getPlanDateKey(p) === dateKey || getClosedDateKey(p) === dateKey)
        );

        const isUnperformed =
          closeLog.title === 'Reja bajarilmasdan yopildi' ||
          Boolean(closeLog.details?.includes('amal bajarilmasdan'));

        let extractedReason =
          client.lastPlanCloseReason ||
          (isUnperformed ? 'Bajarilmasdan yopildi' : 'Amallar yakunlandi');
        if (closeLog.details) {
          const reasonIdx = closeLog.details.indexOf('Yopilish sababi:');
          if (reasonIdx !== -1) {
            const r = closeLog.details.slice(reasonIdx + 'Yopilish sababi:'.length).trim();
            if (r) extractedReason = r;
          }
        }

        const explicitProdLog = client.logs.find(
          (l) =>
            l &&
            (l.id?.endsWith('_prod') ||
              l.id?.endsWith('_prod_edit') ||
              (l.type === 'product_added' &&
                (l.title === 'Yangi mahsulotlar topshirildi' ||
                  l.title === "Sotilgan mahsulotlar / to'lov turi o'zgartirildi")))
        );

        const sameDateProducts = (client.products || []).filter((prod) => {
          const prodDate = (prod as any).date || (prod as any).deliveredAt;
          if (!prodDate) return Boolean(explicitProdLog);
          return getPlanDateKey({ createdAt: prodDate } as DailyPlanItem) === dateKey || Boolean(explicitProdLog);
        });

        if (existingIdx !== -1) {
          const existingPlan = resultPlans[existingIdx];
          const existingClosed = Boolean(
            existingPlan.isClosed || existingPlan.status === 'yopildi'
          );
          const existingReopenMs = existingPlan.reopenedAt
            ? new Date(existingPlan.reopenedAt).getTime()
            : 0;
          if (!existingClosed && closeWallMs > existingReopenMs) {
            resultPlans[existingIdx] = {
              ...existingPlan,
              isClosed: true,
              status: 'yopildi',
              closedWithoutAction: isUnperformed && sameDateProducts.length === 0,
              closedAt: closeLog.timestamp,
              closedBy: closeLog.author || client.lastPlanClosedBy || existingPlan.agentUsername,
              closeReason: extractedReason,
            };
            (resultPlans[existingIdx] as any).closedDisplayDate = closeLog.timestamp;
            (resultPlans[existingIdx] as any).closedUpdatedAt = new Date(closeWallMs).toISOString();
            delete resultPlans[existingIdx].reopenedAt;
            delete resultPlans[existingIdx].reopenedBy;
            delete resultPlans[existingIdx].reopenReason;
            recoveredAny = true;
          }
          if (
            explicitProdLog &&
            sameDateProducts.length > 0 &&
            !hasDeliveredProds(resultPlans[existingIdx])
          ) {
            const targetP = resultPlans[existingIdx];
            const stampedProds = sameDateProducts.map((sp) => ({
              ...sp,
              date: (sp as any).date || closeLog.timestamp,
            }));
            const updatedHist =
              targetP.actionsHistory && targetP.actionsHistory.length > 0
                ? targetP.actionsHistory.map((ah, idx) =>
                    idx === 0 ? { ...ah, productsDelivered: stampedProds } : ah
                  )
                : [
                    {
                      timestamp: closeLog.timestamp,
                      author:
                        explicitProdLog.author ||
                        closeLog.author ||
                        targetP.lastExecutedBy ||
                        targetP.agentUsername,
                      actionDone: targetP.actionDone || targetP.plannedAction || 'joyiga borildi',
                      productsDelivered: stampedProds,
                      reportNote: targetP.reportNote || extractedReason,
                    },
                  ];
            resultPlans[existingIdx] = {
              ...targetP,
              closedWithoutAction: false,
              productsDelivered: stampedProds,
              actionsHistory: updatedHist,
              actionsCount: Math.max(targetP.actionsCount || 0, 1),
            };
            recoveredAny = true;
          }
          continue;
        }

        // Only synthesize a missing plan_rec_ record for 2026-11-01 (1-November) OR when an explicit product sale log exists (excluding 2026-11-05)
        const shouldRecoverMissing =
          dateKey === '2026-11-01' ||
          (dateKey !== '2026-11-05' && Boolean(explicitProdLog) && sameDateProducts.length > 0);
        if (!shouldRecoverMissing) {
          continue;
        }

        // Reconstruct missing closed plan from client logs & products on that date
        let actionDone: PlanActionType | undefined =
          isUnperformed && sameDateProducts.length === 0 ? undefined : 'joyiga borildi';
        if (closeLog.details) {
          const actMatch = closeLog.details.match(/Amal:\s*([^)]+)\)/);
          if (actMatch && actMatch[1]) {
            const cand = actMatch[1].trim();
            if (
              cand === 'telefon qilindi' ||
              cand === 'joyiga borildi' ||
              cand === 'telefon qilindi + joyiga borildi'
            ) {
              actionDone = cand;
            }
          }
        }

        const sameDatePaymentLog = client.logs.find(
          (l) =>
            l.type === 'payment' &&
            getPlanDateKey({ createdAt: l.timestamp } as DailyPlanItem) === dateKey &&
            (l.amountChanged || 0) > 0
        );

        const financialAction: DailyPlanItem['financialAction'] = sameDatePaymentLog
          ? {
              method: 'naqd',
              methodLabel: sameDatePaymentLog.paymentMethodLabel || 'Naqd pul',
              amount: sameDatePaymentLog.amountChanged || 0,
              amountUzs: sameDatePaymentLog.amountUzs,
              exchangeRate: sameDatePaymentLog.exchangeRate,
              note: sameDatePaymentLog.details,
            }
          : undefined;

        const recoveredPlan: DailyPlanItem = {
          id: recId,
          agentUsername: closeLog.author || client.lastPlanClosedBy || 'agentp1',
          clientId: client.id,
          clientName: client.name,
          clientPhone: client.phone,
          clientAddress: client.address,
          clientRegion: client.region,
          clientDistrict: client.district,
          clientLandmark: client.landmark,
          createdAt: closeLog.timestamp,
          planDate: dateKey,
          status: 'yopildi',
          isClosed: true,
          closedWithoutAction: isUnperformed,
          closedAt: closeLog.timestamp,
          closedBy: closeLog.author || client.lastPlanClosedBy || 'agentp1',
          closeReason: extractedReason,
          plannedAction: actionDone || 'joyiga borildi',
          actionDone,
          completedAt: isUnperformed ? undefined : closeLog.timestamp,
          lastExecutedBy: closeLog.author || client.lastPlanClosedBy || 'agentp1',
          lastExecutedAt: closeLog.timestamp,
          financialAction,
          productsDelivered: sameDateProducts.length > 0 ? sameDateProducts : undefined,
          actionsCount: isUnperformed ? 0 : 1,
          actionsHistory: isUnperformed
            ? []
            : [
                {
                  timestamp: closeLog.timestamp,
                  author: closeLog.author || client.lastPlanClosedBy || 'agentp1',
                  actionDone: actionDone || 'joyiga borildi',
                  financialAction,
                  productsDelivered: sameDateProducts.length > 0 ? sameDateProducts : undefined,
                  reportNote: extractedReason,
                },
              ],
        };
        (recoveredPlan as any).closedDisplayDate = closeLog.timestamp;
        (recoveredPlan as any).closedUpdatedAt = new Date(closeWallMs).toISOString();

        resultPlans.push(recoveredPlan);
        recoveredAny = true;
      }
    }

    return { mergedPlans: resultPlans, recoveredAny };
  }

  public getDailyPlans(): DailyPlanItem[] {
    if (typeof window === 'undefined') return [];
    if (this.plansCache) return this.plansCache;
    try {
      const raw = localStorage.getItem(DAILY_PLANS_KEY);
      const deletedIds = getDeletedClientIds();
      const deletedPlanIds = getDeletedPlanIds();
      const parsed: DailyPlanItem[] = raw ? JSON.parse(raw) : [];
      const filtered = parsed.filter(
        (p) =>
          p &&
          p.clientId &&
          !deletedIds.has(p.clientId) &&
          !deletedPlanIds.has(p.id) &&
          !isClosedPlanExpired7Days(p)
      );
      const { mergedPlans, recoveredAny } = this.recoverClosedPlansFromClientLogs(filtered);
      const { uniquePlans, duplicateIds } = this.deduplicatePlansByClient(mergedPlans);
      if (duplicateIds.length > 0 || filtered.length !== parsed.length || recoveredAny) {
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
    const deletedIds = getDeletedClientIds();
    const deletedPlanIds = getDeletedPlanIds();
    const activeWithin7Days = plans.filter(
      (p) =>
        p &&
        p.clientId &&
        !deletedIds.has(p.clientId) &&
        !deletedPlanIds.has(p.id) &&
        !isClosedPlanExpired7Days(p)
    );
    const { mergedPlans } = this.recoverClosedPlansFromClientLogs(activeWithin7Days);
    const { uniquePlans } = this.deduplicatePlansByClient(mergedPlans);
    this.plansCache = uniquePlans;
    localStorage.setItem(DAILY_PLANS_KEY, JSON.stringify(uniquePlans));
    this.notify();
  }

  // Rejalarni olish (Admin va barcha agentlar uchun barcha agentlar tuzgan rejalar umumiy ko'rinadi)
  public getActive24hPlans(_agentUsername?: string): DailyPlanItem[] {
    return this.getDailyPlans();
  }

  // Kunlik reja tuzish (agent tomonidan tanlangan mijozlar, amal turi, undirish summasi, izohlar va ixtiyoriy sana)
  // Har bir mijoz bir kun (planDate) uchun faqat bir marta tanlanadi va avtomatik bajarildi bo'lmaydi (status: 'rejalashtirilgan')
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
    >,
    customDate?: string // YYYY-MM-DD yoki ISO string
  ): DailyPlanItem[] {
    const allClients = this.getClients();
    const existingPlans = this.getDailyPlans();
    const now = new Date();
    const nowStr = now.toISOString();
    const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let targetCreatedAt = nowStr;
    let targetPlanDate: string = todayLocalStr;

    if (customDate) {
      const trimmedDate = customDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
        targetPlanDate = trimmedDate;
        const [y, m, d] = trimmedDate.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const dt = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
          targetCreatedAt = dt.toISOString();
        }
      } else if (trimmedDate.includes('T')) {
        targetCreatedAt = trimmedDate;
        targetPlanDate = trimmedDate.slice(0, 10);
      }
    }

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

      // Agar mijoz aynan shu sanadagi (targetPlanDate) rejada allaqachon mavjud bo'lsa, dublikat yaratmasdan mavjudini yangilaymiz
      const existingIdx = existingPlans.findIndex((p) => {
        if (p.clientId !== client.id) return false;
        const pDate = p.planDate || (p.createdAt ? p.createdAt.slice(0, 10) : '');
        return pDate === targetPlanDate;
      });
      if (existingIdx !== -1) {
        const current = existingPlans[existingIdx];
        if (!current.isClosed && current.status !== 'yopildi') {
          const updatedItem: DailyPlanItem = {
            ...current,
            plannedAction,
            plannedAmount,
            planNote: note?.trim() || current.planNote || undefined,
            createdAt: customDate ? targetCreatedAt : current.createdAt,
            planDate: targetPlanDate || current.planDate,
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
        createdAt: targetCreatedAt,
        planDate: targetPlanDate,
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
        amountUzs?: number;
        exchangeRate?: number;
        splits?: FinancialPaymentSplit[];
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
    },
    targetDate?: string
  ): { success: boolean; client?: Client } {
    const plans = this.getDailyPlans();
    const planIndex = plans.findIndex((p) => p.id === planItemId);
    if (planIndex === -1) return { success: false };

    const plan = plans[planIndex];
    if (plan.reopenedAt && !plan.closedAt) {
      plan.isClosed = false;
      if (plan.status === 'yopildi') {
        plan.status = 'rejalashtirilgan';
      }
    }
    if (plan.isClosed) {
      return { success: false }; // Yopilgan mijoz ustida qaytib amal bajarib bo'lmaydi
    }
    const nowStr = new Date().toISOString();
    const effectiveDateKey =
      (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim()) ? targetDate.trim() : '') ||
      getClosedDateKey(plan) ||
      (plan as any).lastClosedDateKey ||
      getPlanDateKey(plan) ||
      nowStr.slice(0, 10);
    const effectiveTimestamp =
      effectiveDateKey !== nowStr.slice(0, 10)
        ? `${effectiveDateKey}T${nowStr.slice(11)}`
        : nowStr;

    const existingFin = getPlanFinancialActionData(plan);
    const oldFinAmount = existingFin.totalFinancialAmount || 0;

    const existingSold = getPlanSoldProductsData(plan);
    const oldProducts = existingSold.productsDelivered || [];
    const oldDeliveryPayment = existingSold.deliveryPayment;

    const stampedDeliveredProducts = report.productsDelivered
      ? report.productsDelivered
          .filter((p) => p.name.trim() !== '' && (p.quantity || 0) > 0)
          .map((p) => ({
            ...p,
            date: (p as any).date || effectiveTimestamp,
          }))
      : undefined;

    // 1. Update plan item (record which agent executed the action)
    const effectiveFinancialAction = report.financialAction
      ? {
          method: report.financialAction.method,
          methodLabel: report.financialAction.methodLabel,
          amount: report.financialAction.amount,
          currency: report.financialAction.currency,
          note: report.financialAction.note,
          amountUzs: report.financialAction.amountUzs,
          exchangeRate: report.financialAction.exchangeRate,
          splits: report.financialAction.splits,
        }
      : existingFin.financialAction;

    const effectiveDeliveredProducts =
      stampedDeliveredProducts && stampedDeliveredProducts.length > 0
        ? stampedDeliveredProducts
        : oldProducts.length > 0
        ? oldProducts
        : undefined;

    const effectiveDeliveryPayment =
      stampedDeliveredProducts && stampedDeliveredProducts.length > 0
        ? report.deliveryPayment
        : oldDeliveryPayment;

    const hasFinancialOrProductOps = Boolean(
      (effectiveFinancialAction && effectiveFinancialAction.amount > 0) ||
        (effectiveDeliveredProducts && effectiveDeliveredProducts.length > 0) ||
        (report.productsReturned && report.productsReturned.length > 0)
    );

    // Faqat moliyaviy yoki mahsulotga oid amaliyot bajarilsagina bajarildi bo'ladi, aks holda rejalashtirilgan holda qoladi
    plan.status = hasFinancialOrProductOps ? 'bajarildi' : plan.status || 'rejalashtirilgan';
    plan.closedWithoutAction = false;
    if (hasFinancialOrProductOps && !plan.completedAt) {
      plan.completedAt = effectiveTimestamp;
    }
    plan.lastExecutedBy = author;
    plan.lastExecutedAt = nowStr;
    plan.actionDone = report.actionDone;
    if (effectiveFinancialAction) {
      plan.financialAction = effectiveFinancialAction;
    }
    if (effectiveDeliveredProducts && effectiveDeliveredProducts.length > 0) {
      plan.productsDelivered = effectiveDeliveredProducts;
      plan.deliveryPayment = effectiveDeliveryPayment;
    }
    if (report.productsReturned && report.productsReturned.length > 0) {
      plan.productsReturned = report.productsReturned;
    }
    if (report.reportNote !== undefined && report.reportNote.trim() !== '') {
      plan.reportNote = report.reportNote;
    }

    // Consolidate into a single authoritative actionsHistory entry so reopened/re-saved plans never duplicate products or payments
    plan.actionsHistory = [
      {
        timestamp: plan.actionsHistory?.[0]?.timestamp || effectiveTimestamp,
        author,
        actionDone: report.actionDone,
        financialAction: effectiveFinancialAction,
        productsDelivered: effectiveDeliveredProducts,
        deliveryPayment: effectiveDeliveryPayment,
        productsReturned:
          report.productsReturned && report.productsReturned.length > 0
            ? report.productsReturned
            : plan.productsReturned,
        reportNote: report.reportNote || plan.reportNote,
      },
    ];
    plan.actionsCount = 1;
    plans[planIndex] = plan;
    this.saveDailyPlans(plans);

    // 2. Update client in database & write audit logs (applying ONLY deltas if previous values existed on this plan!)
    const client = this.getClients().find((c) => c.id === plan.clientId);
    if (!client) return { success: true };

    let currentNetDebt = (client.currentDebt || 0) - (client.currentAdvance || 0);
    const clientLogs = [...(client.logs || [])];
    const planDatePrefix = effectiveDateKey || (plan.planDate || plan.createdAt || '').slice(0, 10);

    // Financial payment operation (Section 2 - delta-aware)
    if (report.financialAction && report.financialAction.amount > 0) {
      const newFinAmt = Math.max(0, Math.round(report.financialAction.amount * 100) / 100);
      // Oldin oldFinAmount mijoz qarzini kamaytirgan (-oldFinAmount), endi newFinAmt kamaytiradi (-newFinAmt)
      const finDebtDelta = Math.round((oldFinAmount - newFinAmt) * 100) / 100;
      currentNetDebt = Math.round((currentNetDebt + finDebtDelta) * 100) / 100;

      const formattedNewAmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
        newFinAmt
      );
      const updatedLogDetails = `${author} tomonidan to'lov qabul qilindi: ${formattedNewAmt} USD (${report.financialAction.methodLabel}). ${report.financialAction.note ? `Izoh: ${report.financialAction.note}` : ''}`.trim();

      let paymentLogIdx = clientLogs.findIndex(
        (l) =>
          l.type === 'payment' &&
          (l.id.endsWith('_fin') || l.purpose === 'payment') &&
          planDatePrefix &&
          (l.timestamp || '').slice(0, 10) === planDatePrefix
      );
      if (paymentLogIdx === -1 && oldFinAmount > 0) {
        paymentLogIdx = clientLogs.findIndex(
          (l) => l.type === 'payment' && (l.id.endsWith('_fin') || l.purpose === 'payment')
        );
      }

      if (paymentLogIdx !== -1 && oldFinAmount > 0) {
        clientLogs[paymentLogIdx] = {
          ...clientLogs[paymentLogIdx],
          author,
          title: `Moliyaviy amaliyot: ${report.financialAction.methodLabel}`,
          details: updatedLogDetails,
          amountChanged: newFinAmt,
          amountUzs: report.financialAction.amountUzs,
          exchangeRate: report.financialAction.exchangeRate,
          purpose: 'payment',
          paymentMethodLabel: report.financialAction.methodLabel,
        };
      } else {
        clientLogs.unshift({
          id: 'log_' + Date.now() + '_fin',
          clientId: client.id,
          author,
          timestamp: effectiveTimestamp,
          type: 'payment',
          title: `Moliyaviy amaliyot: ${report.financialAction.methodLabel}`,
          details: updatedLogDetails,
          amountChanged: newFinAmt,
          amountUzs: report.financialAction.amountUzs,
          exchangeRate: report.financialAction.exchangeRate,
          purpose: 'payment',
          paymentMethodLabel: report.financialAction.methodLabel,
        });
      }
    }

    // Products delivered operation (Section 3 - delta-aware)
    let updatedProducts = [...(client.products || [])];
    if (stampedDeliveredProducts && stampedDeliveredProducts.length > 0) {
      const validProds = stampedDeliveredProducts.filter((p) => p.name.trim() !== '');
      if (validProds.length > 0) {
        // 1. If this plan already had oldProducts, restore oldProducts to warehouse first and remove them from client.products
        if (oldProducts.length > 0) {
          oldProducts.forEach((op) => {
            if (op.warehouseId && (op.quantity || 0) > 0) {
              this.restoreProductToWarehouseStockOnly(op.warehouseId, op.quantity, op.unit);
            }
            let removeIdx = updatedProducts.findIndex((cp) => cp.id && op.id && cp.id === op.id);
            if (removeIdx === -1) {
              removeIdx = updatedProducts.findIndex(
                (cp) => cp.name === op.name && cp.unit === op.unit && cp.quantity === op.quantity
              );
            }
            if (removeIdx === -1) {
              removeIdx = updatedProducts.findIndex((cp) => cp.name === op.name);
            }
            if (removeIdx !== -1) {
              updatedProducts.splice(removeIdx, 1);
            }
          });
        }

        const newProdIds = new Set(validProds.map((vp) => vp.id).filter(Boolean));
        updatedProducts = [
          ...validProds,
          ...updatedProducts.filter((cp) => !cp.id || !newProdIds.has(cp.id)),
        ];

        // 2. Deduct new products from warehouse inventory
        validProds.forEach((vp) => {
          if (vp.warehouseId) {
            this.deductProductFromWarehouse(vp.warehouseId, vp.quantity, vp.unit);
          }
        });

        // 3. Calculate old vs new net debt effect
        const oldTotalValue = oldProducts.reduce(
          (sum, p) =>
            sum + (p.totalPrice !== undefined ? p.totalPrice : (p.quantity || 0) * (p.unitPrice || 0)),
          0
        );
        const oldPayType = oldDeliveryPayment?.paymentType || 'qarzga';
        const oldPaidAmt =
          oldDeliveryPayment?.paidAmount !== undefined
            ? oldDeliveryPayment.paidAmount
            : oldPayType === 'qarzga'
            ? 0
            : oldTotalValue;
        const oldNetDebtEffect = oldProducts.length > 0 ? oldTotalValue - oldPaidAmt : 0;

        const totalDeliveredValue = validProds.reduce(
          (sum, p) => sum + (p.totalPrice !== undefined ? p.totalPrice : p.quantity * p.unitPrice),
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
        const newNetDebtEffect = totalDeliveredValue - paidAmt;
        const debtAdded = Math.max(0, Math.round(newNetDebtEffect * 100) / 100);

        const prodDebtDelta = Math.round((newNetDebtEffect - oldNetDebtEffect) * 100) / 100;
        currentNetDebt = Math.round((currentNetDebt + prodDebtDelta) * 100) / 100;

        const prodSumStr = validProds
          .map((p) => `${p.name} (${p.quantity} ${p.unit})`)
          .join(', ');

        const payDesc =
          payType === 'qarzga'
            ? `Qarzga berildi (+${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(debtAdded)} USD qarzga yozildi)`
            : `To'lov shakli: ${deliveryPay?.paymentLabel || payType} (${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(paidAmt)} USD)${debtAdded > 0 ? `, qoldiq qarz: +${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(debtAdded)} USD` : ''}`;

        let prodLogIdx = clientLogs.findIndex(
          (l) =>
            l.type === 'product_added' &&
            (l.id.endsWith('_prod') || l.id.endsWith('_prod_edit') || l.purpose === 'product') &&
            planDatePrefix &&
            (l.timestamp || '').slice(0, 10) === planDatePrefix
        );
        if (prodLogIdx === -1 && oldProducts.length > 0) {
          prodLogIdx = clientLogs.findIndex(
            (l) =>
              l.type === 'product_added' &&
              (l.id.endsWith('_prod') || l.id.endsWith('_prod_edit') || l.purpose === 'product')
          );
        }

        if (prodLogIdx !== -1 && oldProducts.length > 0) {
          clientLogs[prodLogIdx] = {
            ...clientLogs[prodLogIdx],
            id: clientLogs[prodLogIdx].id.endsWith('_prod')
              ? clientLogs[prodLogIdx].id
              : 'log_' + Date.now() + '_prod',
            author,
            timestamp: effectiveTimestamp,
            type: 'product_added',
            title: 'Yangi mahsulotlar topshirildi',
            details: `${author} tomonidan topshirildi: ${prodSumStr}. Qiymati: ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(totalDeliveredValue)} USD. ${payDesc}`,
            amountChanged: debtAdded,
            amountUzs: deliveryPay?.paidAmountUzs,
            exchangeRate: deliveryPay?.exchangeRate,
            purpose: 'product',
            paymentMethodLabel: deliveryPay?.paymentLabel,
          };
        } else {
          clientLogs.unshift({
            id: 'log_' + Date.now() + '_prod',
            clientId: client.id,
            author,
            timestamp: effectiveTimestamp,
            type: 'product_added',
            title: 'Yangi mahsulotlar topshirildi',
            details: `${author} tomonidan topshirildi: ${prodSumStr}. Qiymati: ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(totalDeliveredValue)} USD. ${payDesc}`,
            amountChanged: debtAdded,
            amountUzs: deliveryPay?.paidAmountUzs,
            exchangeRate: deliveryPay?.exchangeRate,
            purpose: 'product',
            paymentMethodLabel: deliveryPay?.paymentLabel,
          });
        }
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
          currentNetDebt = Math.round((currentNetDebt - totalReturnedValue) * 100) / 100;
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
          title: 'Mahsulot omborga qaytarildi',
          details: `${author} tomonidan qabul qilindi va omborga qo'shildi: ${returnedStr}. Qarz ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(totalReturnedValue)} USD kamaytirildi.`,
          amountChanged: totalReturnedValue,
        });
      }
    }

    const newDebt = currentNetDebt >= 0 ? currentNetDebt : 0;
    const newAdvance = currentNetDebt < 0 ? Math.abs(currentNetDebt) : 0;

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

  // Yopilgan yoki hali yopilmagan rejadagi sotilgan mahsulotlarga va to'lov turiga o'zgartirish kiritish
  public updateSoldProductsOnPlanItem(
    planItemId: string,
    author: string,
    updateData: {
      productsDelivered: ProductItem[];
      deliveryPayment: DeliveryPaymentInfo;
      reportNote?: string;
    },
    targetDate?: string
  ): { success: boolean; plan?: DailyPlanItem; client?: Client } {
    const plans = this.getDailyPlans();
    const planIndex = plans.findIndex((p) => p.id === planItemId);
    if (planIndex === -1) return { success: false };

    const plan = plans[planIndex];
    const nowStr = new Date().toISOString();
    const effectiveDateKey =
      (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim()) ? targetDate.trim() : '') ||
      getClosedDateKey(plan) ||
      (plan as any).lastClosedDateKey ||
      getPlanDateKey(plan) ||
      nowStr.slice(0, 10);
    const effectiveTimestamp =
      effectiveDateKey !== nowStr.slice(0, 10)
        ? `${effectiveDateKey}T${nowStr.slice(11)}`
        : nowStr;

    const existingSold = getPlanSoldProductsData(plan);
    const oldProducts = existingSold.productsDelivered || [];
    const oldDeliveryPayment = existingSold.deliveryPayment;

    const newProducts = (updateData.productsDelivered || [])
      .filter((p) => p.name.trim() !== '' && (p.quantity || 0) > 0)
      .map((p) => ({
        ...p,
        date: (p as any).date || effectiveTimestamp,
      }));
    if (newProducts.length === 0 && oldProducts.length === 0) return { success: false };

    // 1. Oldingi sotilgan mahsulotlar miqdorini ombor zaxirasiga qaytarib qo'yamiz
    oldProducts.forEach((op) => {
      if (op.warehouseId && (op.quantity || 0) > 0) {
        this.restoreProductToWarehouseStockOnly(op.warehouseId, op.quantity, op.unit);
      }
    });

    // 2. Yangilangan sotilgan mahsulotlar miqdorini ombor zaxirasidan ayiramiz
    newProducts.forEach((np) => {
      if (np.warehouseId && (np.quantity || 0) > 0) {
        this.deductProductFromWarehouse(np.warehouseId, np.quantity, np.unit);
      }
    });

    // 3. Oldingi va yangi moliyaviy farqni hisoblaymiz
    const oldTotalValue = oldProducts.reduce(
      (sum, p) =>
        sum + (p.totalPrice !== undefined ? p.totalPrice : (p.quantity || 0) * (p.unitPrice || 0)),
      0
    );
    const oldPayType = oldDeliveryPayment?.paymentType || 'qarzga';
    const oldPaidAmt =
      oldDeliveryPayment?.paidAmount !== undefined
        ? oldDeliveryPayment.paidAmount
        : oldPayType === 'qarzga'
        ? 0
        : oldTotalValue;
    const oldNetDebtEffect = oldTotalValue - oldPaidAmt;

    const newTotalValue = newProducts.reduce(
      (sum, p) =>
        sum + (p.totalPrice !== undefined ? p.totalPrice : (p.quantity || 0) * (p.unitPrice || 0)),
      0
    );
    const newDeliveryPayment = updateData.deliveryPayment;
    const newPayType = newDeliveryPayment?.paymentType || 'qarzga';
    const newPaidAmt =
      newProducts.length === 0
        ? 0
        : newDeliveryPayment?.paidAmount !== undefined
        ? newDeliveryPayment.paidAmount
        : newPayType === 'qarzga'
        ? 0
        : newTotalValue;
    const newNetDebtEffect = newTotalValue - newPaidAmt;

    // 4. Reja elementini yangilaymiz (ham ochiq, ham yopilgan holatda ishlaydi)
    plan.productsDelivered = newProducts.length > 0 ? newProducts : undefined;
    plan.deliveryPayment = newProducts.length > 0 ? newDeliveryPayment : undefined;
    plan.lastExecutedBy = author;
    plan.lastExecutedAt = nowStr;
    if (!plan.completedAt) {
      plan.completedAt = effectiveTimestamp;
    }
    if (!plan.isClosed && plan.status !== 'yopildi') {
      plan.status = 'bajarildi';
    }
    plan.closedWithoutAction = false;
    if (!plan.actionDone) {
      plan.actionDone = plan.plannedAction || 'joyiga borildi';
    }
    if (updateData.reportNote !== undefined && updateData.reportNote.trim() !== '') {
      plan.reportNote = updateData.reportNote.trim();
    }

    if (plan.actionsHistory && plan.actionsHistory.length > 0) {
      const historyCopy = [...plan.actionsHistory];
      const targetIdx = existingSold.historyIndex !== -1 ? existingSold.historyIndex : 0;
      for (let i = 0; i < historyCopy.length; i++) {
        if (i === targetIdx) {
          historyCopy[i] = {
            ...historyCopy[i],
            timestamp: historyCopy[i].timestamp || effectiveTimestamp,
            productsDelivered: newProducts.length > 0 ? newProducts : undefined,
            deliveryPayment: newProducts.length > 0 ? newDeliveryPayment : undefined,
            reportNote:
              updateData.reportNote && updateData.reportNote.trim() !== ''
                ? updateData.reportNote.trim()
                : historyCopy[i].reportNote,
          };
        } else if (historyCopy[i].productsDelivered || historyCopy[i].deliveryPayment) {
          historyCopy[i] = {
            ...historyCopy[i],
            productsDelivered: undefined,
            deliveryPayment: undefined,
          };
        }
      }
      plan.actionsHistory = historyCopy;
    } else if (newProducts.length > 0) {
      plan.actionsHistory = [
        {
          timestamp: effectiveTimestamp,
          author,
          actionDone: plan.actionDone || 'joyiga borildi',
          productsDelivered: newProducts,
          deliveryPayment: newDeliveryPayment,
          reportNote: updateData.reportNote?.trim() || plan.reportNote,
        },
      ];
      plan.actionsCount = 1;
    }

    plans[planIndex] = plan;
    this.saveDailyPlans(plans);

    // 5. Mijozning mahsulotlar ro'yxati va qarz/haqdorlik balansini yangilaymiz (faqat farq - delta ta'sir qiladi)
    const client = this.getClients().find((c) => c.id === plan.clientId);
    if (!client) return { success: true, plan };

    const remainingClientProducts = [...(client.products || [])];
    oldProducts.forEach((op) => {
      let removeIdx = remainingClientProducts.findIndex((cp) => cp.id && op.id && cp.id === op.id);
      if (removeIdx === -1) {
        removeIdx = remainingClientProducts.findIndex(
          (cp) => cp.name === op.name && cp.unit === op.unit && cp.quantity === op.quantity
        );
      }
      if (removeIdx === -1) {
        removeIdx = remainingClientProducts.findIndex((cp) => cp.name === op.name);
      }
      if (removeIdx !== -1) {
        remainingClientProducts.splice(removeIdx, 1);
      }
    });

    const newProductIds = new Set(newProducts.map((np) => np.id).filter(Boolean));
    const deduplicatedRemaining = remainingClientProducts.filter(
      (cp) => !cp.id || !newProductIds.has(cp.id)
    );
    const updatedClientProducts = [...newProducts, ...deduplicatedRemaining];

    const currentNetDebt = (client.currentDebt || 0) - (client.currentAdvance || 0);
    const debtDelta = Math.round((newNetDebtEffect - oldNetDebtEffect) * 100) / 100;
    const updatedNetDebt = Math.round((currentNetDebt + debtDelta) * 100) / 100;

    const newDebt = updatedNetDebt >= 0 ? updatedNetDebt : 0;
    const newAdvance = updatedNetDebt < 0 ? Math.abs(updatedNetDebt) : 0;

    const oldProdSumStr =
      oldProducts.length > 0
        ? oldProducts.map((p) => `${p.name} (${p.quantity} ${p.unit})`).join(', ')
        : "Yo'q";
    const prodSumStr =
      newProducts.length > 0
        ? newProducts.map((p) => `${p.name} (${p.quantity} ${p.unit})`).join(', ')
        : "Mahsulotlar bekor qilindi";
    const debtAdded = Math.max(0, Math.round((newTotalValue - newPaidAmt) * 100) / 100);
    const payDesc =
      newPayType === 'qarzga'
        ? `Nasiyaga (Qarzga: +${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(debtAdded)} USD)`
        : `To'lov turi: ${newDeliveryPayment.paymentLabel || newPayType} (To'landi: ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(newPaidAmt)} USD${debtAdded > 0 ? `, Qarzga: +${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(debtAdded)} USD` : ''})`;

    // Remove any legacy duplicate _prod_edit logs that had type === 'product_added' so they aren't double-counted
    const clientLogs = (client.logs || []).filter(
      (l) => !(l.id?.endsWith('_prod_edit') && l.type === 'product_added')
    );
    const planDatePrefix = effectiveDateKey || (plan.planDate || plan.createdAt || '').slice(0, 10);

    // Mavjud mahsulot topshirish (_prod) logini topib yangilaymiz (ikkilanib hisoblanmasligi uchun)
    let prodLogIdx = clientLogs.findIndex(
      (l) =>
        l.type === 'product_added' &&
        (l.id.endsWith('_prod') || l.purpose === 'product') &&
        planDatePrefix &&
        (l.timestamp || '').slice(0, 10) === planDatePrefix
    );
    if (prodLogIdx === -1) {
      prodLogIdx = clientLogs.findIndex(
        (l) => l.type === 'product_added' && (l.id.endsWith('_prod') || l.purpose === 'product')
      );
    }

    if (newProducts.length > 0) {
      const updatedProdDetails = `${author} tomonidan topshirildi: ${prodSumStr}. Qiymati: ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(newTotalValue)} USD. ${payDesc}`;
      if (prodLogIdx !== -1) {
        clientLogs[prodLogIdx] = {
          ...clientLogs[prodLogIdx],
          id: clientLogs[prodLogIdx].id.endsWith('_prod')
            ? clientLogs[prodLogIdx].id
            : 'log_' + Date.now() + '_prod',
          author,
          title: 'Yangi mahsulotlar topshirildi',
          details: updatedProdDetails,
          amountChanged: debtAdded,
          amountUzs: newDeliveryPayment.paidAmountUzs,
          exchangeRate: newDeliveryPayment.exchangeRate,
          purpose: 'product',
          paymentMethodLabel: newDeliveryPayment.paymentLabel,
        };
      } else {
        clientLogs.unshift({
          id: 'log_' + Date.now() + '_prod',
          clientId: client.id,
          author,
          timestamp: effectiveTimestamp,
          type: 'product_added',
          title: 'Yangi mahsulotlar topshirildi',
          details: updatedProdDetails,
          amountChanged: debtAdded,
          amountUzs: newDeliveryPayment.paidAmountUzs,
          exchangeRate: newDeliveryPayment.exchangeRate,
          purpose: 'product',
          paymentMethodLabel: newDeliveryPayment.paymentLabel,
        });
      }
    } else if (prodLogIdx !== -1) {
      clientLogs.splice(prodLogIdx, 1);
    }

    // Tahrirlanganlik haqida audit logi (type: 'visit_action' bo'lgani uchun mahsulot/qarz summasiga 2 marta qo'shilmaydi)
    clientLogs.unshift({
      id: 'log_' + Date.now() + '_prod_edit',
      clientId: client.id,
      author,
      timestamp: nowStr,
      type: 'visit_action',
      title: "Sotilgan mahsulotlar / to'lov turi o'zgartirildi",
      details: `${author} tomonidan sotilgan mahsulotlar va to'lov turi tahrirlandi. Oldin: ${oldProdSumStr} (${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(oldTotalValue)} USD) -> Yangi: ${prodSumStr} (${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(newTotalValue)} USD). ${payDesc}. Balans o'zgarishi (farq): ${debtDelta >= 0 ? '+' : ''}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(debtDelta)} USD.`,
      amountChanged: Math.abs(debtDelta),
    });

    const updatedClient = this.updateClient(client.id, {
      currentDebt: newDebt,
      currentAdvance: newAdvance,
      products: updatedClientProducts,
      logs: clientLogs,
      updatedAt: nowStr,
    });

    return { success: true, plan, client: updatedClient || undefined };
  }

  // Rejadagi mijozga qilingan moliyaviy amaliyot (to'lov)ga o'zgartirish kiritish (ochiq yoki yopilgan rejada)
  public updateFinancialActionOnPlanItem(
    planItemId: string,
    author: string,
    updateData: {
      financialAction: NonNullable<DailyPlanItem['financialAction']>;
      reportNote?: string;
    }
  ): { success: boolean; plan?: DailyPlanItem; client?: Client } {
    const plans = this.getDailyPlans();
    const planIndex = plans.findIndex((p) => p.id === planItemId);
    if (planIndex === -1) return { success: false };

    const plan = { ...plans[planIndex] };
    const nowStr = new Date().toISOString();

    // 1. Oldingi moliyaviy to'lov summasini aniqlaymiz
    const existingFin = getPlanFinancialActionData(plan);
    const oldTotalAmount = existingFin.totalFinancialAmount || 0;

    // 2. Yangi moliyaviy to'lov ma'lumotlari
    const newAmount = Math.max(
      0,
      Math.round((updateData.financialAction.amount || 0) * 100) / 100
    );
    const updatedFinAction: DailyPlanItem['financialAction'] =
      newAmount > 0
        ? {
            ...updateData.financialAction,
            amount: newAmount,
            currency: updateData.financialAction.currency || 'USD',
          }
        : undefined;

    // 3. Plan ma'lumotlarini va actionsHistory'ni yangilaymiz (ikkilanib qolmasligi uchun yagona yozuvga keltiramiz)
    plan.financialAction = updatedFinAction;
    if (updateData.reportNote !== undefined && updateData.reportNote.trim()) {
      plan.reportNote = updateData.reportNote.trim();
    }
    plan.lastExecutedBy = author;

    if (plan.actionsHistory && plan.actionsHistory.length > 0) {
      const historyCopy = [...plan.actionsHistory];
      const targetIdx = existingFin.historyIndex !== -1 ? existingFin.historyIndex : 0;
      for (let i = 0; i < historyCopy.length; i++) {
        if (i === targetIdx) {
          historyCopy[i] = {
            ...historyCopy[i],
            author,
            financialAction: updatedFinAction,
            reportNote: updateData.reportNote?.trim() || historyCopy[i].reportNote,
          };
        } else if (historyCopy[i].financialAction) {
          historyCopy[i] = {
            ...historyCopy[i],
            financialAction: undefined,
          };
        }
      }
      plan.actionsHistory = historyCopy;
    } else if (updatedFinAction) {
      plan.actionsHistory = [
        {
          timestamp: plan.completedAt || nowStr,
          author,
          actionDone: plan.actionDone || plan.plannedAction || 'joyiga borildi',
          financialAction: updatedFinAction,
          reportNote: updateData.reportNote?.trim() || plan.reportNote,
        },
      ];
      plan.actionsCount = 1;
    }

    plans[planIndex] = plan;
    this.saveDailyPlans(plans);

    // 4. Mijozning qarz/haqdorlik balansini va tarix (logs) yozuvini yangilaymiz
    const client = this.getClients().find((c) => c.id === plan.clientId);
    if (!client) return { success: true, plan };

    // Oldin oldTotalAmount mijoz qarzini kamaytirgan edi (-oldTotalAmount), endi newAmount kamaytiradi (-newAmount)
    const currentNetDebt = (client.currentDebt || 0) - (client.currentAdvance || 0);
    const debtDelta = Math.round((oldTotalAmount - newAmount) * 100) / 100;
    const updatedNetDebt = Math.round((currentNetDebt + debtDelta) * 100) / 100;

    const newDebt = updatedNetDebt >= 0 ? updatedNetDebt : 0;
    const newAdvance = updatedNetDebt < 0 ? Math.abs(updatedNetDebt) : 0;

    const clientLogs = [...(client.logs || [])];
    const planDatePrefix = (plan.planDate || plan.createdAt || '').slice(0, 10);

    // Mavjud to'lov logini topib yangilaymiz (ikkilanib hisoblanmasligi uchun)
    let paymentLogIdx = clientLogs.findIndex(
      (l) =>
        l.type === 'payment' &&
        (l.id.endsWith('_fin') || l.purpose === 'payment') &&
        planDatePrefix &&
        (l.timestamp || '').slice(0, 10) === planDatePrefix
    );
    if (paymentLogIdx === -1) {
      paymentLogIdx = clientLogs.findIndex(
        (l) => l.type === 'payment' && (l.id.endsWith('_fin') || l.purpose === 'payment')
      );
    }

    const formattedNewAmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
      newAmount
    );
    const formattedOldAmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
      oldTotalAmount
    );

    if (newAmount > 0 && updatedFinAction) {
      const updatedLogDetails = `${author} tomonidan qabul qilindi: ${formattedNewAmt} USD (${updatedFinAction.methodLabel}). ${updatedFinAction.note || ''}`.trim();
      if (paymentLogIdx !== -1) {
        clientLogs[paymentLogIdx] = {
          ...clientLogs[paymentLogIdx],
          author,
          title: `To'lov qabul qilindi (${updatedFinAction.methodLabel})`,
          details: updatedLogDetails,
          amountChanged: newAmount,
          amountUzs: updatedFinAction.amountUzs,
          exchangeRate: updatedFinAction.exchangeRate,
          purpose: 'payment',
          paymentMethodLabel: updatedFinAction.methodLabel,
        };
      } else {
        clientLogs.unshift({
          id: 'log_' + Date.now() + '_fin',
          clientId: client.id,
          author,
          timestamp: nowStr,
          type: 'payment',
          title: `To'lov qabul qilindi (${updatedFinAction.methodLabel})`,
          details: updatedLogDetails,
          amountChanged: newAmount,
          amountUzs: updatedFinAction.amountUzs,
          exchangeRate: updatedFinAction.exchangeRate,
          purpose: 'payment',
          paymentMethodLabel: updatedFinAction.methodLabel,
        });
      }
    } else if (paymentLogIdx !== -1) {
      clientLogs.splice(paymentLogIdx, 1);
    }

    // Tahrirlanganlik haqida ma'lumot logi (visit_action bo'lgani uchun tushumlar summasiga 2 marta qo'shilmaydi)
    clientLogs.unshift({
      id: 'log_' + Date.now() + '_fin_edit',
      clientId: client.id,
      author,
      timestamp: nowStr,
      type: 'visit_action',
      title: "Moliyaviy amaliyot (to'lov) tahrirlandi",
      details: `${author} tomonidan moliyaviy amaliyot o'zgartirildi: Oldingi to'lov: ${formattedOldAmt} USD -> Yangi to'lov: ${formattedNewAmt} USD (${updatedFinAction?.methodLabel || "To'lov bekor qilindi"}).${updatedFinAction?.note ? ' ' + updatedFinAction.note : ''}`,
      amountChanged: newAmount,
    });

    const updatedClient = this.updateClient(client.id, {
      currentDebt: newDebt,
      currentAdvance: newAdvance,
      logs: clientLogs,
      updatedAt: nowStr,
    });

    return { success: true, plan, client: updatedClient || undefined };
  }

  // Rejadagi mijoz bo'yicha amallarni to'liq yakunlash (Oxirgi marta yopish: bajarib yoki bajarilmasdan yopish, ixtiyoriy sana bilan)
  public closeDailyPlanItem(
    planItemId: string,
    author: string,
    closeReason?: string,
    closedWithoutActionOverride?: boolean,
    customCloseDate?: string
  ): boolean {
    const plans = this.getDailyPlans();
    const planIndex = plans.findIndex((p) => p.id === planItemId);
    if (planIndex === -1) return false;

    const targetPlan = plans[planIndex];
    const targetClientId = targetPlan.clientId;
    const targetPlanDateKey = getPlanDateKey(targetPlan);
    const targetRawDateSlice =
      targetPlan.planDate || (targetPlan.createdAt ? targetPlan.createdAt.slice(0, 10) : '');

    const now = new Date();
    const realWallNowStr = now.toISOString();
    let effectiveClosedAt = realWallNowStr;

    const fallbackPlanDate =
      getClosedDateKey(targetPlan) ||
      (targetPlan as any).lastClosedDateKey ||
      getPlanDateKey(targetPlan);
    const effectiveCustomDate =
      customCloseDate && customCloseDate.trim() ? customCloseDate.trim() : fallbackPlanDate;

    if (effectiveCustomDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveCustomDate)) {
        const [y, m, d] = effectiveCustomDate.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          // Use 12:00 local time so both UTC .slice(0, 10) and local date formatting match YYYY-MM-DD
          const dt = new Date(y, m - 1, d, 12, now.getMinutes(), now.getSeconds());
          effectiveClosedAt = dt.toISOString();
        }
      } else if (effectiveCustomDate.includes('T')) {
        effectiveClosedAt = effectiveCustomDate;
      }
    }
    const nowStr = effectiveClosedAt;
    const closedDateKey = getClosedDateKey({ closedAt: effectiveClosedAt } as DailyPlanItem);
    unmarkPlanAsDeleted(`plan_rec_${targetClientId}_${targetPlanDateKey}`);
    if (closedDateKey) {
      unmarkPlanAsDeleted(`plan_rec_${targetClientId}_${closedDateKey}`);
    }

    const hasCompletedAction = Boolean(
      targetPlan.actionDone ||
        targetPlan.status === 'bajarildi' ||
        (targetPlan.actionsHistory && targetPlan.actionsHistory.length > 0) ||
        (targetPlan.actionsCount && targetPlan.actionsCount > 0)
    );
    const isUnperformedClose =
      closedWithoutActionOverride !== undefined
        ? closedWithoutActionOverride
        : !hasCompletedAction;

    const finalReason =
      closeReason?.trim() ||
      (isUnperformedClose ? 'Bajarilmasdan yopildi' : 'Amallar yakunlandi');

    for (let i = 0; i < plans.length; i++) {
      const p = plans[i];
      const pDateKey = getPlanDateKey(p);
      const pRawDateSlice = p.planDate || (p.createdAt ? p.createdAt.slice(0, 10) : '');
      if (
        p.id === planItemId ||
        (p.clientId === targetClientId &&
          (pDateKey === targetPlanDateKey ||
            (targetRawDateSlice && pRawDateSlice === targetRawDateSlice)))
      ) {
        p.isClosed = true;
        p.closedWithoutAction = isUnperformedClose;
        p.status = 'yopildi';
        p.closedAt = effectiveClosedAt;
        (p as any).closedDisplayDate = effectiveClosedAt;
        (p as any).closedUpdatedAt = realWallNowStr;
        if (closedDateKey && /^\d{4}-\d{2}-\d{2}$/.test(closedDateKey)) {
          p.planDate = closedDateKey;
          (p as any).lastClosedDateKey = closedDateKey;
          if (getPlanDateKey({ createdAt: p.createdAt } as DailyPlanItem) !== closedDateKey) {
            p.createdAt = effectiveClosedAt;
          }
        }
        p.closedBy = author;
        p.closeReason = finalReason;
        delete p.reopenedAt;
        delete p.reopenedBy;
        delete p.reopenReason;
        plans[i] = p;
      }
    }
    this.saveDailyPlans(plans);

    // Audit logga yozish
    const client = this.getClients().find((c) => c.id === targetClientId);
    if (client) {
      const clientLogs = client.logs || [];
      clientLogs.unshift({
        id: 'log_' + Date.now() + '_close',
        clientId: client.id,
        author,
        timestamp: nowStr,
        type: 'visit_action',
        title: isUnperformedClose
          ? 'Reja bajarilmasdan yopildi'
          : 'Reja yakunlandi va yopildi',
        details: `${author} tomonidan ushbu mijoz bo'yicha reja ${
          isUnperformedClose
            ? 'amal bajarilmasdan'
            : `amallar yakunlanib (Amal: ${targetPlan.actionDone || 'joyiga borildi'})`
        } yopildi. Yopilish sababi: ${finalReason}`,
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

  // Yopilgan rejadagi mijozlarni bittalab yoki ko'plab (bulk) qayta ochish (majburiy izoh bilan)
  // Qayta ochilganda mijoz aynan o'zi yopilgan sanasiga (planDate = closedDate) ochiladi, bugun yoki boshqa kunga emas!
  public reopenDailyPlanItems(
    planItemIds: string[],
    author: string,
    reopenReason: string
  ): DailyPlanItem[] {
    if (!Array.isArray(planItemIds) || planItemIds.length === 0) return [];
    const finalReason = reopenReason.trim();
    if (!finalReason) return [];

    const idSet = new Set(planItemIds);
    const plans = this.getDailyPlans();
    const nowStr = new Date().toISOString();
    const reopenedItems: DailyPlanItem[] = [];

    const resolveClosedDateForReopen = (p: DailyPlanItem): string => {
      const displayRaw = (
        (p as any).closedDisplayDate ||
        (p as any).lastClosedDateKey ||
        ''
      ).trim();
      if (displayRaw) {
        const k = getClosedDateKey({ closedAt: displayRaw } as DailyPlanItem);
        if (k && /^\d{4}-\d{2}-\d{2}$/.test(k)) return k;
      }
      const recMatch = p.id?.match(/_(\d{4}-\d{2}-\d{2})$/);
      if (recMatch && recMatch[1]) return recMatch[1];
      const closedKey = getClosedDateKey(p);
      if (closedKey && /^\d{4}-\d{2}-\d{2}$/.test(closedKey)) return closedKey;
      if (p.completedAt) {
        const compKey = getPlanDateKey({ createdAt: p.completedAt } as DailyPlanItem);
        if (compKey && /^\d{4}-\d{2}-\d{2}$/.test(compKey)) return compKey;
      }
      return getPlanDateKey(p);
    };

    // Maqsadli mijozlarning aynan shu sanadagi dublikat reja yozuvlari ham to'liq ochiladi
    const targetedClientDateKeys = new Set<string>();
    for (const p of plans) {
      if (idSet.has(p.id) && p.clientId) {
        const cKey = resolveClosedDateForReopen(p);
        const dKey = getPlanDateKey(p);
        if (cKey) targetedClientDateKeys.add(`${p.clientId}_${cKey}`);
        if (dKey) targetedClientDateKeys.add(`${p.clientId}_${dKey}`);
      }
    }

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      const planDateKey = getPlanDateKey(plan);
      const planClosedKey = resolveClosedDateForReopen(plan);
      if (
        !idSet.has(plan.id) &&
        (!plan.clientId ||
          (!targetedClientDateKeys.has(`${plan.clientId}_${planDateKey}`) &&
            !targetedClientDateKeys.has(`${plan.clientId}_${planClosedKey}`)))
      ) {
        continue;
      }

      // Yopilgan sanani saqlab qolib, aynan shu yopilgan sanaga qayta ochamiz!
      const closedDateYmd = planClosedKey || planDateKey;
      if (closedDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(closedDateYmd)) {
        plan.planDate = closedDateYmd;
        (plan as any).lastClosedDateKey = closedDateYmd;
        if (getPlanDateKey({ createdAt: plan.createdAt } as DailyPlanItem) !== closedDateYmd) {
          const [y, m, d] = closedDateYmd.split('-').map(Number);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            const dt = new Date(y, m - 1, d, 12, 0, 0);
            plan.createdAt = dt.toISOString();
          }
        }
      }

      plan.isClosed = false;
      plan.closedWithoutAction = false;
      plan.status = 'rejalashtirilgan';
      plan.reopenedAt = nowStr;
      plan.reopenedBy = author;
      plan.reopenReason = finalReason;
      delete plan.closedAt;
      delete (plan as any).closedDisplayDate;
      delete (plan as any).unperformedClose;
      delete (plan as any).closedUpdatedAt;
      delete plan.closedBy;
      delete plan.closeReason;

      if (!Array.isArray(plan.reopenHistory)) {
        plan.reopenHistory = [];
      }
      plan.reopenHistory.unshift({
        reopenedAt: nowStr,
        reopenedBy: author,
        reopenReason: finalReason,
      });

      plans[i] = plan;
      reopenedItems.push(plan);

      // Audit log & clear lastPlanCloseReason on client
      const client = this.getClients().find((c) => c.id === plan.clientId);
      if (client) {
        const clientLogs = client.logs || [];
        clientLogs.unshift({
          id: 'log_' + Date.now() + '_reopen',
          clientId: client.id,
          author,
          timestamp: nowStr,
          type: 'visit_action',
          title: 'Reja qayta ochildi',
          details: `${author} tomonidan mijoz rejasi (${closedDateYmd || ''}) sanasiga qayta ochildi. Izoh: ${finalReason}`,
        });
        this.updateClient(client.id, {
          logs: clientLogs,
          lastPlanClosedAt: undefined,
          lastPlanCloseReason: undefined,
          lastPlanClosedBy: undefined,
          updatedAt: nowStr,
        });
      }
    }

    if (reopenedItems.length > 0) {
      this.saveDailyPlans(plans);
    }

    return reopenedItems;
  }

  // Rejadagi mijozlarni (faollarini yoki yopilganini) bittalab yoki bir nechtasini tanlab rejadan olib tashlash (majburiy izoh bilan)
  public removeDailyPlanItems(
    planItemIds: string[],
    author: string,
    reason: string
  ): { success: boolean; removedPlans: DailyPlanItem[] } {
    if (!Array.isArray(planItemIds) || planItemIds.length === 0) {
      return { success: false, removedPlans: [] };
    }
    const finalReason = reason.trim();
    if (!finalReason) {
      return { success: false, removedPlans: [] };
    }

    const idSet = new Set(planItemIds);
    const plans = this.getDailyPlans();
    const removedPlans: DailyPlanItem[] = [];
    const remainingPlans = plans.filter((p) => {
      if (idSet.has(p.id)) {
        removedPlans.push(p);
        markPlanAsDeleted(p.id);
        const dKey = getPlanDateKey(p);
        if (p.clientId && dKey) {
          markPlanAsDeleted(`plan_rec_${p.clientId}_${dKey}`);
        }
        const cKey = getClosedDateKey(p);
        if (p.clientId && cKey) {
          markPlanAsDeleted(`plan_rec_${p.clientId}_${cKey}`);
        }
        return false;
      }
      return true;
    });

    if (removedPlans.length > 0) {
      this.saveDailyPlans(remainingPlans);

      // Audit logga yozish
      const nowStr = new Date().toISOString();
      removedPlans.forEach((rp) => {
        const client = this.getClients().find((c) => c.id === rp.clientId);
        if (client) {
          const clientLogs = client.logs || [];
          clientLogs.unshift({
            id: 'log_' + Date.now() + '_plan_rem_' + Math.random().toString(36).substring(2, 5),
            clientId: client.id,
            author,
            timestamp: nowStr,
            type: 'visit_action',
            title: "Rejadan olib tashlandi",
            details: `${author} tomonidan mijoz rejadan olib tashlandi. Izoh: ${finalReason}`,
          });
          this.updateClient(client.id, {
            logs: clientLogs,
            updatedAt: nowStr,
          });
        }
      });
    }

    return { success: true, removedPlans };
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
    const ensureInitialMetadata = (p: WarehouseProduct): WarehouseProduct => {
      const calcIntakePieces =
        p.intakeUnitType === 'package' && p.packageUnitName && (p.piecesPerPackage || 1) > 1
          ? (p.intakeQuantity || 0) * (p.piecesPerPackage || 1)
          : p.intakeQuantity || p.totalPieces || 0;
      const initPieces =
        p.initialTotalPieces !== undefined && p.initialTotalPieces > 0
          ? p.initialTotalPieces
          : Math.max(calcIntakePieces, p.totalPieces || 0);
      const initVol =
        p.initialTotalVolume !== undefined && p.initialTotalVolume > 0
          ? p.initialTotalVolume
          : initPieces * (p.volumePerPiece || 1);
      const initDate =
        p.initialIntakeDate ||
        p.intakeDate ||
        (p.createdAt ? p.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
      const initUnitType = p.initialIntakeUnitType || p.intakeUnitType || 'piece';
      const initQty =
        p.initialIntakeQuantity !== undefined && p.initialIntakeQuantity > 0
          ? p.initialIntakeQuantity
          : initUnitType === 'package' && (p.piecesPerPackage || 1) > 1
          ? Math.round((initPieces / (p.piecesPerPackage || 1)) * 100) / 100
          : initPieces;

      const existingHistory = Array.isArray(p.stockHistory) ? [...p.stockHistory] : [];
      const hasInitialEntry = existingHistory.some((h) => h && h.changeType === 'initial_intake');
      if (!hasInitialEntry) {
        existingHistory.push({
          id: `whlog_init_${p.id}`,
          timestamp: p.createdAt || `${initDate}T09:00:00.000Z`,
          dateStr: initDate,
          author: p.createdBy || 'adminc',
          changeType: 'initial_intake',
          previousPieces: 0,
          newPieces: initPieces,
          deltaPieces: initPieces,
          previousInitialPieces: 0,
          newInitialPieces: initPieces,
          unit:
            initUnitType === 'package' && p.packageUnitName
              ? p.packageUnitName
              : p.pieceUnitName || 'dona',
          quantityInUnit: initQty,
          note: "Baza yaratilganda / omborga dastlabki kiritilgan qoldiq",
        });
      }

      return {
        ...p,
        currency: 'USD',
        minSellingPricingUnitType: p.minSellingPricingUnitType || p.pricingUnitType || 'piece',
        minSellingPrice: p.minSellingPrice !== undefined ? p.minSellingPrice : p.price || 0,
        initialIntakeDate: initDate,
        initialIntakeUnitType: initUnitType,
        initialIntakeQuantity: initQty,
        initialTotalPieces: initPieces,
        initialTotalVolume: initVol,
        initialEditCount:
          p.initialEditCount !== undefined
            ? p.initialEditCount
            : existingHistory.filter(
                (h) => h && (h.changeType === 'initial_edit' || h.changeType === 'manual_adjustment')
              ).length,
        stockHistory: existingHistory,
      };
    };

    try {
      const deletedIds = getDeletedWarehouseIds();
      const data = localStorage.getItem(WAREHOUSE_KEY);
      if (!data) {
        const initialFiltered = INITIAL_WAREHOUSE_PRODUCTS.filter((p) => !deletedIds.has(p.id)).map(
          ensureInitialMetadata
        );
        localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(initialFiltered));
        this.warehouseCache = initialFiltered;
        return initialFiltered;
      }
      const parsed: WarehouseProduct[] = JSON.parse(data);
      const filtered = parsed
        .filter((p) => p && p.id && !deletedIds.has(p.id))
        .map(ensureInitialMetadata);
      if (filtered.length !== parsed.length) {
        localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(filtered));
      }
      this.warehouseCache = filtered;
      return filtered;
    } catch {
      const deletedIds = getDeletedWarehouseIds();
      const fallback = INITIAL_WAREHOUSE_PRODUCTS.filter((p) => !deletedIds.has(p.id)).map(
        ensureInitialMetadata
      );
      this.warehouseCache = fallback;
      return fallback;
    }
  }

  public saveWarehouseProducts(items: WarehouseProduct[]): void {
    try {
      const deletedIds = getDeletedWarehouseIds();
      const cleanItems = items.filter((p) => p && p.id && !deletedIds.has(p.id));
      localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(cleanItems));
      this.warehouseCache = null;
      this.notify();
    } catch (e) {
      console.error('Failed to save warehouse products to localStorage:', e);
    }
  }

  public addWarehouseProduct(
    productData: Omit<WarehouseProduct, 'id' | 'createdAt'>
  ): WarehouseProduct {
    const products = [...this.getWarehouseProducts()];
    const nowIso = new Date().toISOString();
    const id = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const initDate = productData.intakeDate || nowIso.slice(0, 10);
    const initPieces = productData.totalPieces || 0;
    const initLog: WarehouseStockChangeLog = {
      id: `whlog_init_${id}`,
      timestamp: nowIso,
      dateStr: initDate,
      author: productData.createdBy || 'adminc',
      changeType: 'initial_intake',
      previousPieces: 0,
      newPieces: initPieces,
      deltaPieces: initPieces,
      previousInitialPieces: 0,
      newInitialPieces: initPieces,
      unit:
        productData.intakeUnitType === 'package' && productData.packageUnitName
          ? productData.packageUnitName
          : productData.pieceUnitName || 'dona',
      quantityInUnit: productData.intakeQuantity,
      note: productData.notes || "Baza yaratilganda / omborga dastlabki kiritilgan qoldiq",
    };

    const newProduct: WarehouseProduct = {
      ...productData,
      id,
      createdAt: nowIso,
      initialIntakeDate: initDate,
      initialIntakeUnitType: productData.intakeUnitType,
      initialIntakeQuantity: productData.intakeQuantity,
      initialTotalPieces: initPieces,
      initialTotalVolume: productData.totalVolume,
      initialEditCount: 0,
      stockHistory: [initLog],
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

    const created: WarehouseProduct[] = productsData.map((data, idx) => {
      const id = `wh_${nowMs}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      const initDate = data.intakeDate || nowIso.slice(0, 10);
      const initPieces = data.totalPieces || 0;
      const initLog: WarehouseStockChangeLog = {
        id: `whlog_init_${id}`,
        timestamp: nowIso,
        dateStr: initDate,
        author: data.createdBy || 'adminc',
        changeType: 'initial_intake',
        previousPieces: 0,
        newPieces: initPieces,
        deltaPieces: initPieces,
        previousInitialPieces: 0,
        newInitialPieces: initPieces,
        unit:
          data.intakeUnitType === 'package' && data.packageUnitName
            ? data.packageUnitName
            : data.pieceUnitName || 'dona',
        quantityInUnit: data.intakeQuantity,
        note: data.notes || "Excel (.xlsx) orqali bazaga dastlabki kiritilgan qoldiq",
      };
      return {
        ...data,
        currency: 'USD',
        id,
        createdAt: nowIso,
        initialIntakeDate: initDate,
        initialIntakeUnitType: data.intakeUnitType,
        initialIntakeQuantity: data.intakeQuantity,
        initialTotalPieces: initPieces,
        initialTotalVolume: data.totalVolume,
        initialEditCount: 0,
        stockHistory: [initLog],
      };
    });

    const combined = [...created, ...existing];
    this.saveWarehouseProducts(combined);
    return created;
  }

  public updateWarehouseProduct(
    id: string,
    productData: Omit<WarehouseProduct, 'id' | 'createdAt'>,
    author: string = 'adminc'
  ): WarehouseProduct | null {
    const products = [...this.getWarehouseProducts()];
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const existing = products[index];
    const nowIso = new Date().toISOString();

    const oldIntakePieces =
      existing.intakeUnitType === 'package' &&
      existing.packageUnitName &&
      (existing.piecesPerPackage || 1) > 1
        ? (existing.intakeQuantity || 0) * (existing.piecesPerPackage || 1)
        : existing.intakeQuantity || existing.totalPieces || 0;

    const newIntakePieces =
      productData.intakeUnitType === 'package' &&
      productData.packageUnitName &&
      (productData.piecesPerPackage || 1) > 1
        ? (productData.intakeQuantity || 0) * (productData.piecesPerPackage || 1)
        : productData.intakeQuantity || 0;

    const preservedInitialPieces =
      existing.initialTotalPieces !== undefined && existing.initialTotalPieces > 0
        ? existing.initialTotalPieces
        : oldIntakePieces;
    const preservedInitialVolume =
      existing.initialTotalVolume !== undefined && existing.initialTotalVolume > 0
        ? existing.initialTotalVolume
        : preservedInitialPieces * (existing.volumePerPiece || 1);
    const preservedInitialDate =
      existing.initialIntakeDate ||
      existing.intakeDate ||
      (existing.createdAt ? existing.createdAt.slice(0, 10) : nowIso.slice(0, 10));
    const preservedInitialUnitType =
      existing.initialIntakeUnitType || existing.intakeUnitType || 'piece';
    const preservedInitialQty =
      existing.initialIntakeQuantity !== undefined && existing.initialIntakeQuantity > 0
        ? existing.initialIntakeQuantity
        : existing.intakeQuantity;

    const nextHistory: WarehouseStockChangeLog[] = Array.isArray(existing.stockHistory)
      ? [...existing.stockHistory]
      : [];
    let nextEditCount = existing.initialEditCount || 0;

    const isIntakeChanged = oldIntakePieces !== newIntakePieces;
    const isRemainingPiecesChanged = (existing.totalPieces || 0) !== (productData.totalPieces || 0);

    if (isIntakeChanged || isRemainingPiecesChanged) {
      nextEditCount += 1;
      const deltaPieces = (productData.totalPieces || 0) - (existing.totalPieces || 0);
      const changeLog: WarehouseStockChangeLog = {
        id: `whlog_edit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        dateStr: nowIso.slice(0, 10),
        author: author || productData.createdBy || 'adminc',
        changeType: isIntakeChanged ? 'initial_edit' : 'manual_adjustment',
        previousPieces: existing.totalPieces || 0,
        newPieces: productData.totalPieces || 0,
        deltaPieces,
        previousInitialPieces: oldIntakePieces,
        newInitialPieces: newIntakePieces,
        unit:
          productData.intakeUnitType === 'package' && productData.packageUnitName
            ? productData.packageUnitName
            : productData.pieceUnitName || 'dona',
        quantityInUnit: productData.intakeQuantity,
        note: isIntakeChanged
          ? `Kirim miqdori o'zgartirildi: ${oldIntakePieces} donadan ${newIntakePieces} donaga (Joriy qoldiq: ${existing.totalPieces} -> ${productData.totalPieces} dona)${productData.notes && productData.notes !== existing.notes ? `. Izoh: ${productData.notes}` : ''}`
          : `Ombordagi qoldiq bevosita tahrirlandi: ${existing.totalPieces} donadan ${productData.totalPieces} donaga (${deltaPieces >= 0 ? '+' : ''}${deltaPieces} dona)${productData.notes && productData.notes !== existing.notes ? `. Izoh: ${productData.notes}` : ''}`,
      };
      nextHistory.unshift(changeLog);
    }

    const updatedProduct: WarehouseProduct = {
      ...existing,
      ...productData,
      id: existing.id,
      createdAt: existing.createdAt,
      currency: 'USD',
      initialIntakeDate: preservedInitialDate,
      initialIntakeUnitType: preservedInitialUnitType,
      initialIntakeQuantity: preservedInitialQty,
      initialTotalPieces: preservedInitialPieces,
      initialTotalVolume: preservedInitialVolume,
      initialEditCount: nextEditCount,
      stockHistory: nextHistory,
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

  public restoreProductToWarehouseStockOnly(
    warehouseId: string,
    quantity: number,
    unit: string
  ): void {
    const warehouse = this.getWarehouseProducts();
    const found = warehouse.find((w) => w.id === warehouseId);
    if (!found) return;

    const isPkg = unit === found.packageUnitName;
    const piecesToAdd = isPkg
      ? quantity * (found.piecesPerPackage || 1)
      : quantity;
    const volToAdd = piecesToAdd * (found.volumePerPiece || 0);

    found.totalPieces = Math.max(0, (found.totalPieces || 0) + piecesToAdd);
    found.totalVolume = Math.max(0, (found.totalVolume || 0) + volToAdd);
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
  private buildDefaultDecadeTargets(totalTarget: number): MonthlyPlanDecadeTargets {
    const t = totalTarget > 0 ? totalTarget : 0;
    const d1 = Math.round((t / 3) * 100) / 100;
    const d2 = Math.round((t / 3) * 100) / 100;
    const d3 = Math.max(0, Math.round((t - d1 - d2) * 100) / 100);
    return {
      decade1: d1,
      decade2: d2,
      decade3: d3,
    };
  }

  private buildDefaultClientPlans(
    clients: Client[],
    initialClientDebts?: Record<string, number>
  ): MonthlyPlanClientItem[] {
    const items: MonthlyPlanClientItem[] = [];
    clients.forEach((c) => {
      const baseDebt =
        initialClientDebts && initialClientDebts[c.id] > 0
          ? initialClientDebts[c.id]
          : c.currentDebt > 0
          ? c.currentDebt
          : 0;
      if (baseDebt > 0) {
        const roundedDebt = Math.round(baseDebt * 100) / 100;
        const dec = this.buildDefaultDecadeTargets(roundedDebt);
        items.push({
          clientId: c.id,
          clientName: c.name,
          clientCode: c.region || '',
          clientPhone: c.phone,
          initialDebt: roundedDebt,
          targetAmount: roundedDebt,
          decade1: dec.decade1,
          decade2: dec.decade2,
          decade3: dec.decade3,
        });
      }
    });
    return items;
  }

  public getMonthlyPlans(): MonthlyPlan[] {
    if (this.monthlyPlansCache) return this.monthlyPlansCache;
    try {
      const existingClients = this.getClients();
      const data = localStorage.getItem(MONTHLY_PLANS_KEY);
      if (!data) {
        const now = new Date();
        const startDateStr = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .slice(0, 10);
        const startMs = new Date(startDateStr + 'T00:00:00').getTime();
        // Ensure at least 30 days duration
        const endDateStr = new Date(startMs + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

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
          targets: [{ currency: 'USD', targetAmount: defaultTarget }],
          decadeTargets: this.buildDefaultDecadeTargets(defaultTarget),
          clientPlans: this.buildDefaultClientPlans(existingClients, initialClientDebts),
          initialClientDebts,
          initialTotalDebt: defaultTarget,
          startDate: startDateStr,
          endDate: endDateStr,
          createdAt: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          createdBy: 'agentp1',
          notes: "Mavjud mijozlardan eski qarzdorliklarni undirish bo'yicha 1 oylik reja",
          editHistory: [],
          status: 'active',
        };
        const list = [initialPlan];
        localStorage.setItem(MONTHLY_PLANS_KEY, JSON.stringify(list));
        this.monthlyPlansCache = list;
        return list;
      }
      const parsed: MonthlyPlan[] = JSON.parse(data);
      const normalized = parsed.map((p) => {
        const isProductPlan = p.planType === 'product_delivery';
        const targetAmt = p.targets?.[0]?.targetAmount || p.initialTotalDebt || 0;
        const hasClientPlans = Array.isArray(p.clientPlans) && p.clientPlans.length > 0;
        return {
          ...p,
          planType: isProductPlan ? ('product_delivery' as const) : ('debt_collection' as const),
          targets: (p.targets || []).map((t) => ({ ...t, currency: 'USD' })),
          decadeTargets:
            p.decadeTargets &&
            (p.decadeTargets.decade1 > 0 ||
              p.decadeTargets.decade2 > 0 ||
              p.decadeTargets.decade3 > 0)
              ? p.decadeTargets
              : this.buildDefaultDecadeTargets(targetAmt),
          clientPlans: isProductPlan
            ? p.clientPlans || []
            : hasClientPlans
            ? p.clientPlans
            : this.buildDefaultClientPlans(existingClients, p.initialClientDebts),
          productClientPlans: Array.isArray(p.productClientPlans) ? p.productClientPlans : [],
          editHistory: Array.isArray(p.editHistory) ? p.editHistory : [],
        };
      });
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
      if (p.status === 'active' && p.planType !== 'product_delivery') {
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
    const finalTargetAmt = normalizedTargets[0]?.targetAmount || initialTotalDebt;

    const cleanClientPlans: MonthlyPlanClientItem[] = Array.isArray(planData.clientPlans)
      ? planData.clientPlans
      : [];

    cleanClientPlans.forEach((cp) => {
      if (cp.clientId && !(cp.clientId in initialClientDebts) && cp.initialDebt > 0) {
        initialClientDebts[cp.clientId] = cp.initialDebt;
      }
    });

    const newPlan: MonthlyPlan = {
      ...planData,
      targets: normalizedTargets,
      decadeTargets:
        planData.decadeTargets || this.buildDefaultDecadeTargets(finalTargetAmt),
      clientPlans: cleanClientPlans,
      initialClientDebts,
      initialTotalDebt,
      editHistory: Array.isArray(planData.editHistory) ? planData.editHistory : [],
      id: `mp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    updatedPlans.unshift(newPlan);
    this.saveMonthlyPlans(updatedPlans);
    return newPlan;
  }

  public updateMonthlyPlan(
    planId: string,
    updates: {
      targets: MonthlyPlanTarget[];
      decadeTargets: MonthlyPlanDecadeTargets;
      clientPlans?: MonthlyPlanClientItem[];
      startDate: string;
      endDate: string;
      notes?: string;
      editedBy: string;
      editReason: string;
    }
  ): MonthlyPlan | null {
    const plans = [...this.getMonthlyPlans()];
    const idx = plans.findIndex((p) => p.id === planId);
    if (idx === -1) return null;

    const existing = plans[idx];
    const nowIso = new Date().toISOString();

    const oldTarget = existing.targets?.[0]?.targetAmount || 0;
    const newTarget = updates.targets?.[0]?.targetAmount || oldTarget;

    const summaryParts: string[] = [];
    if (Math.round(oldTarget) !== Math.round(newTarget)) {
      summaryParts.push(
        `Umumiy reja: ${oldTarget.toLocaleString('uz-UZ')} USD -> ${newTarget.toLocaleString('uz-UZ')} USD`
      );
    }
    if (existing.startDate !== updates.startDate || existing.endDate !== updates.endDate) {
      summaryParts.push(
        `Muddat: ${existing.startDate} — ${existing.endDate} -> ${updates.startDate} — ${updates.endDate}`
      );
    }
    summaryParts.push(
      `10 kunliklar: 1-o'n kunlik: ${updates.decadeTargets.decade1.toLocaleString('uz-UZ')} USD, 2-o'n kunlik: ${updates.decadeTargets.decade2.toLocaleString('uz-UZ')} USD, 3-o'n kunlik: ${updates.decadeTargets.decade3.toLocaleString('uz-UZ')} USD`
    );
    if (updates.clientPlans) {
      summaryParts.push(`Mijozlar rejasi: ${updates.clientPlans.length} ta mijoz`);
    }

    const newEditEntry: MonthlyPlanEditLog = {
      id: `mplog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      editedBy: updates.editedBy,
      editedAt: nowIso,
      reason: updates.editReason.trim(),
      changesSummary: summaryParts.join(' | '),
    };

    const existingHistory = Array.isArray(existing.editHistory) ? existing.editHistory : [];
    const updatedInitialDebts: Record<string, number> = {
      ...(existing.initialClientDebts || {}),
    };
    if (updates.clientPlans) {
      updates.clientPlans.forEach((cp) => {
        if (cp.clientId && !(cp.clientId in updatedInitialDebts) && cp.initialDebt > 0) {
          updatedInitialDebts[cp.clientId] = cp.initialDebt;
        }
      });
    }

    const updatedPlan: MonthlyPlan = {
      ...existing,
      targets: updates.targets.map((t) => ({ ...t, currency: 'USD' })),
      decadeTargets: updates.decadeTargets,
      clientPlans:
        updates.clientPlans !== undefined ? updates.clientPlans : existing.clientPlans || [],
      initialClientDebts: updatedInitialDebts,
      startDate: updates.startDate,
      endDate: updates.endDate,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      updatedAt: nowIso,
      updatedBy: updates.editedBy,
      editHistory: [newEditEntry, ...existingHistory],
    };

    plans[idx] = updatedPlan;
    this.saveMonthlyPlans(plans);
    return updatedPlan;
  }

  public getActiveMonthlyPlan(_agentUsername?: string): MonthlyPlan | null {
    const plans = this.getMonthlyPlans().filter((p) => p.planType !== 'product_delivery');
    const active = plans.find((p) => p.status === 'active');
    return active || (plans.length > 0 ? plans[0] : null);
  }

  // =========================================================================
  // 1-MONTH PRODUCT DELIVERY PLAN (1 oylik mahsulot berish rejasi)
  // =========================================================================

  public getActiveMonthlyProductPlan(_agentUsername?: string): MonthlyPlan | null {
    const plans = this.getMonthlyPlans().filter((p) => p.planType === 'product_delivery');
    const active = plans.find((p) => p.status === 'active');
    return active || (plans.length > 0 ? plans[0] : null);
  }

  public addMonthlyProductPlan(planData: {
    agentUsername: string;
    targets: MonthlyPlanTarget[];
    decadeTargets?: MonthlyPlanDecadeTargets;
    productClientPlans: MonthlyProductPlanClientItem[];
    startDate: string;
    endDate: string;
    createdBy: string;
    notes?: string;
  }): MonthlyPlan {
    const plans = this.getMonthlyPlans();
    const updatedPlans = plans.map((p) => {
      if (p.status === 'active' && p.planType === 'product_delivery') {
        return { ...p, status: 'completed' as const };
      }
      return p;
    });

    const autoTotalFromClients = (planData.productClientPlans || []).reduce(
      (sum, cp) => sum + (Number(cp.targetAmount) || 0),
      0
    );
    const finalTargetAmount =
      Math.round(
        ((planData.targets?.[0]?.targetAmount ?? autoTotalFromClients) || autoTotalFromClients) *
          100
      ) / 100;

    const newPlan: MonthlyPlan = {
      id: `mpp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      planType: 'product_delivery',
      agentUsername: planData.agentUsername,
      targets: [{ currency: 'USD', targetAmount: finalTargetAmount }],
      decadeTargets: planData.decadeTargets || {
        decade1: finalTargetAmount,
        decade2: 0,
        decade3: 0,
      },
      productClientPlans: Array.isArray(planData.productClientPlans)
        ? planData.productClientPlans
        : [],
      startDate: planData.startDate,
      endDate: planData.endDate,
      createdAt: new Date().toISOString(),
      createdBy: planData.createdBy,
      notes: planData.notes,
      editHistory: [],
      status: 'active',
    };

    updatedPlans.unshift(newPlan);
    this.saveMonthlyPlans(updatedPlans);
    return newPlan;
  }

  public updateMonthlyProductPlan(
    planId: string,
    updates: {
      targets: MonthlyPlanTarget[];
      decadeTargets?: MonthlyPlanDecadeTargets;
      productClientPlans: MonthlyProductPlanClientItem[];
      startDate: string;
      endDate: string;
      notes?: string;
      editedBy: string;
      editReason: string;
    }
  ): MonthlyPlan | null {
    const plans = [...this.getMonthlyPlans()];
    const idx = plans.findIndex((p) => p.id === planId);
    if (idx === -1) return null;

    const existing = plans[idx];
    const nowIso = new Date().toISOString();

    const autoTotalFromClients = (updates.productClientPlans || []).reduce(
      (sum, cp) => sum + (Number(cp.targetAmount) || 0),
      0
    );
    const oldTarget = existing.targets?.[0]?.targetAmount || 0;
    const newTarget =
      Math.round(
        ((updates.targets?.[0]?.targetAmount ?? autoTotalFromClients) || autoTotalFromClients) * 100
      ) / 100;

    const summaryParts: string[] = [];
    if (Math.round(oldTarget) !== Math.round(newTarget)) {
      summaryParts.push(
        `30 kunlik mahsulot rejasi: ${oldTarget.toLocaleString('uz-UZ')} -> ${newTarget.toLocaleString('uz-UZ')}`
      );
    }
    if (existing.startDate !== updates.startDate || existing.endDate !== updates.endDate) {
      summaryParts.push(
        `Muddat: ${existing.startDate} — ${existing.endDate} -> ${updates.startDate} — ${updates.endDate}`
      );
    }
    summaryParts.push(`Mijozlar: ${updates.productClientPlans.length} ta tanlangan`);

    const newEditEntry: MonthlyPlanEditLog = {
      id: `mpplog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      editedBy: updates.editedBy,
      editedAt: nowIso,
      reason: updates.editReason.trim(),
      changesSummary: summaryParts.join(' | '),
    };

    const existingHistory = Array.isArray(existing.editHistory) ? existing.editHistory : [];

    const updatedPlan: MonthlyPlan = {
      ...existing,
      planType: 'product_delivery',
      targets: [{ currency: 'USD', targetAmount: newTarget }],
      decadeTargets: updates.decadeTargets || {
        decade1: newTarget,
        decade2: 0,
        decade3: 0,
      },
      productClientPlans: updates.productClientPlans,
      startDate: updates.startDate,
      endDate: updates.endDate,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      updatedAt: nowIso,
      updatedBy: updates.editedBy,
      editHistory: [newEditEntry, ...existingHistory],
    };

    plans[idx] = updatedPlan;
    this.saveMonthlyPlans(plans);
    return updatedPlan;
  }

  public calculateMonthlyProductPlanProgress(plan: MonthlyPlan) {
    const startDateObj = new Date(plan.startDate + 'T00:00:00');
    const endDateObj = new Date(plan.endDate + 'T23:59:59');
    const startMs = startDateObj.getTime();

    const clients = this.getClients();
    const clientsMap = this.clientsMapCache || new Map(clients.map((c) => [c.id, c]));
    const deletedIds = getDeletedClientIds();
    const dailyPlans = this.getDailyPlans();

    const perClientDeliveredMap = new Map<
      string,
      {
        totalDelivered: number;
        deliveriesCount: number;
        byPaymentMethod: Record<string, number>;
      }
    >();
    let totalDeliveredOverall = 0;
    let totalDeliveriesCount = 0;

    const recordDelivery = (clientId: string, val: number, paymentMethod?: string) => {
      if (val <= 0 || deletedIds.has(clientId)) return;
      totalDeliveredOverall = Math.round((totalDeliveredOverall + val) * 100) / 100;
      totalDeliveriesCount++;

      const cur = perClientDeliveredMap.get(clientId) || {
        totalDelivered: 0,
        deliveriesCount: 0,
        byPaymentMethod: {},
      };
      cur.totalDelivered = Math.round((cur.totalDelivered + val) * 100) / 100;
      cur.deliveriesCount += 1;
      const methodKey = paymentMethod || 'qarzga';
      cur.byPaymentMethod[methodKey] =
        Math.round(((cur.byPaymentMethod[methodKey] || 0) + val) * 100) / 100;
      perClientDeliveredMap.set(clientId, cur);
    };

    // 1. Track all product deliveries from daily plans (whether on debt/credit, cash, card, bank, or QR)
    dailyPlans.forEach((dp) => {
      if (!dp.clientId || deletedIds.has(dp.clientId)) return;
      if (dp.actionsHistory && dp.actionsHistory.length > 0) {
        dp.actionsHistory.forEach((act) => {
          const actTime = new Date(act.timestamp || dp.completedAt || dp.createdAt);
          if (actTime >= startDateObj && actTime <= endDateObj) {
            if (act.productsDelivered && act.productsDelivered.length > 0) {
              const delivVal = act.productsDelivered.reduce(
                (s, p) => s + (p.totalPrice || (p.quantity || 0) * (p.unitPrice || 0)),
                0
              );
              if (delivVal > 0) {
                recordDelivery(
                  dp.clientId,
                  delivVal,
                  act.deliveryPayment?.paymentType || dp.deliveryPayment?.paymentType || 'qarzga'
                );
              }
            }
          }
        });
      } else if (dp.completedAt && dp.productsDelivered && dp.productsDelivered.length > 0) {
        const compTime = new Date(dp.completedAt);
        if (compTime >= startDateObj && compTime <= endDateObj) {
          const delivVal = dp.productsDelivered.reduce(
            (s, p) => s + (p.totalPrice || (p.quantity || 0) * (p.unitPrice || 0)),
            0
          );
          if (delivVal > 0) {
            recordDelivery(
              dp.clientId,
              delivVal,
              dp.deliveryPayment?.paymentType || 'qarzga'
            );
          }
        }
      }
    });

    // 2. Also track direct product additions on clients not originating from executeDailyPlanItem (_prod suffix)
    clients.forEach((client) => {
      if (!client.id || deletedIds.has(client.id) || !Array.isArray(client.logs)) return;
      client.logs.forEach((log) => {
        if (log.type === 'product_added' && !String(log.id || '').endsWith('_prod')) {
          const logTime = new Date(log.timestamp);
          if (logTime >= startDateObj && logTime <= endDateObj) {
            const val = Number(log.amountChanged) || 0;
            if (val > 0) {
              recordDelivery(client.id, val, 'qarzga');
            }
          }
        }
      });
    });

    const clientPlanResults = (plan.productClientPlans || [])
      .filter((cp) => cp.clientId && !deletedIds.has(cp.clientId))
      .map((cp) => {
        const cObj = clientsMap.get(cp.clientId);
        const prog = perClientDeliveredMap.get(cp.clientId) || {
          totalDelivered: 0,
          deliveriesCount: 0,
          byPaymentMethod: {},
        };

        // Support both new 30-day `plannedProducts` and legacy decade products
        const mergedPlannedProducts =
          Array.isArray(cp.plannedProducts) && cp.plannedProducts.length > 0
            ? cp.plannedProducts
            : [
                ...(cp.decade1Products || []),
                ...(cp.decade2Products || []),
                ...(cp.decade3Products || []),
              ];

        const productsSum = mergedPlannedProducts.reduce(
          (s, p) => s + (Number(p.totalPrice) || 0),
          0
        );
        const tTotal =
          Math.round(((Number(cp.targetAmount) || productsSum) || 0) * 100) / 100;
        const dTotal = prog.totalDelivered;
        const pctTotal =
          tTotal > 0 ? Math.min(100, Math.round(((dTotal / tTotal) * 100) * 10) / 10) : 0;

        return {
          clientId: cp.clientId,
          clientName: cObj?.name || cp.clientName,
          clientCode: cp.clientCode || cObj?.region || '',
          clientPhone: cObj?.phone || cp.clientPhone,
          targetAmount: tTotal,
          deliveredAmount: dTotal,
          remainingAmount: Math.max(0, Math.round((tTotal - dTotal) * 100) / 100),
          percentage: pctTotal,
          deliveriesCount: prog.deliveriesCount,
          byPaymentMethod: prog.byPaymentMethod,
          plannedProducts: mergedPlannedProducts,
        };
      });

    const sumClientTargets = clientPlanResults.reduce((s, c) => s + c.targetAmount, 0);
    const sumClientDelivered = clientPlanResults.reduce((s, c) => s + c.deliveredAmount, 0);

    const rawTarget =
      sumClientTargets > 0 ? sumClientTargets : plan.targets?.[0]?.targetAmount || 0;
    const targetRounded = Math.round(rawTarget * 100) / 100;
    // Overall delivered reflects deliveries to planned clients (or overall deliveries if no clients specified)
    const effectiveDelivered =
      clientPlanResults.length > 0
        ? Math.max(sumClientDelivered, totalDeliveredOverall)
        : totalDeliveredOverall;
    const deliveredRounded = Math.round(effectiveDelivered * 100) / 100;
    const percentage =
      targetRounded > 0
        ? Math.min(100, Math.round(((deliveredRounded / targetRounded) * 100) * 10) / 10)
        : 0;
    const remainingAmount = Math.max(0, Math.round((targetRounded - deliveredRounded) * 100) / 100);

    const targetResults = [
      {
        currency: 'USD',
        targetAmount: targetRounded,
        deliveredAmount: deliveredRounded,
        percentage,
        remainingAmount,
      },
    ];

    const nowMs = Date.now();
    const endMs = endDateObj.getTime();
    const totalDays = Math.max(30, Math.round((endMs - startMs) / (1000 * 3600 * 24)));
    const daysLeft = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 3600 * 24)));
    const isExpired = endMs < nowMs;

    return {
      targetResults,
      clientPlanResults,
      overallPercentage: percentage,
      totalDays,
      daysLeft,
      isExpired,
      totalDeliveriesCount,
    };
  }

  // Calculate progress strictly from pre-existing client debts at the time the plan was created,
  // including separate 1st 10-day, 2nd 10-day, and 3rd 10-day progress percentages.
  public calculateMonthlyPlanProgress(plan: MonthlyPlan) {
    const startDateObj = new Date(plan.startDate + 'T00:00:00');
    const endDateObj = new Date(plan.endDate + 'T23:59:59');
    const planCreatedTime = new Date(plan.createdAt || plan.startDate + 'T00:00:00');

    // Compute the 3 decade date boundaries based on startDate
    const startMs = startDateObj.getTime();
    const DAY_MS = 24 * 3600 * 1000;
    const d1EndDateStr = new Date(startMs + 9 * DAY_MS).toISOString().slice(0, 10);
    const d2StartDateStr = new Date(startMs + 10 * DAY_MS).toISOString().slice(0, 10);
    const d2EndDateStr = new Date(startMs + 19 * DAY_MS).toISOString().slice(0, 10);
    const d3StartDateStr = new Date(startMs + 20 * DAY_MS).toISOString().slice(0, 10);

    const d1EndMs = new Date(d1EndDateStr + 'T23:59:59').getTime();
    const d2EndMs = new Date(d2EndDateStr + 'T23:59:59').getTime();

    const getDecadeIndexForDate = (dt: Date): 0 | 1 | 2 => {
      const ms = dt.getTime();
      if (ms <= d1EndMs) return 0;
      if (ms <= d2EndMs) return 1;
      return 2;
    };

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

    // 1. Determine baseline old debts snapshot
    const baselineDebts: Record<string, number> = {};
    if (plan.initialClientDebts && Object.keys(plan.initialClientDebts).length > 0) {
      Object.entries(plan.initialClientDebts).forEach(([cId, debt]) => {
        if (debt > 0 && !deletedIds.has(cId) && clientsMap.has(cId)) {
          baselineDebts[cId] = debt;
        }
      });
    } else {
      clients.forEach((c) => {
        const cCreated = new Date(c.createdAt || 0);
        if (cCreated <= planCreatedTime && c.currentDebt > 0 && !deletedIds.has(c.id)) {
          baselineDebts[c.id] = c.currentDebt;
        }
      });
    }

    if (Array.isArray(plan.clientPlans)) {
      plan.clientPlans.forEach((cp) => {
        if (
          cp.clientId &&
          !(cp.clientId in baselineDebts) &&
          !deletedIds.has(cp.clientId) &&
          clientsMap.has(cp.clientId)
        ) {
          const fallbackDebt =
            cp.initialDebt > 0
              ? cp.initialDebt
              : Math.max(0, clientsMap.get(cp.clientId)?.currentDebt || cp.targetAmount || 0);
          if (fallbackDebt > 0) {
            baselineDebts[cp.clientId] = fallbackDebt;
          }
        }
      });
    }

    const oldClientIds = Object.keys(baselineDebts);
    let totalOldDebtRecovered = 0;
    let totalPaymentsCount = 0;
    const decadeCollectedTotals: [number, number, number] = [0, 0, 0];
    const perClientProgressMap = new Map<
      string,
      { totalCollected: number; decadeCollected: [number, number, number] }
    >();

    // 2. For each pre-existing debtor client, calculate how much of their OLD debt was closed and in which decade
    oldClientIds.forEach((clientId) => {
      const oldDebt = baselineDebts[clientId] || 0;
      if (oldDebt <= 0) return;

      const clientObj = clientsMap.get(clientId);
      let paymentsClosingOldDebt = 0;
      let newDebtsAddedAfterPlan = 0;
      const clientDecadePayments: [number, number, number] = [0, 0, 0];

      const recordClientPaymentAt = (amount: number, dt: Date, countAsPayment = true) => {
        if (amount <= 0) return;
        paymentsClosingOldDebt += amount;
        const dIdx = getDecadeIndexForDate(dt);
        clientDecadePayments[dIdx] += amount;
        if (countAsPayment) totalPaymentsCount++;
      };

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
              if (act.financialAction && act.financialAction.amount > 0) {
                recordClientPaymentAt(act.financialAction.amount, actTime, true);
              }
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
                  recordClientPaymentAt(overpaid, actTime, true);
                }
              }
              if (act.productsReturned && act.productsReturned.length > 0) {
                const retVal = act.productsReturned.reduce(
                  (s, r) => s + (r.quantity || 0) * (r.unitPrice || 0),
                  0
                );
                if (retVal > 0) {
                  recordClientPaymentAt(retVal, actTime, false);
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
              recordClientPaymentAt(dp.financialAction.amount, compTime, true);
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
                recordClientPaymentAt(overpaid, compTime, true);
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
            recordClientPaymentAt(l.amountChanged, logTime, true);
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

      const recoveredForClient = Math.min(
        oldDebt,
        Math.max(paymentsClosingOldDebt, directOldDebtReduction)
      );

      // Attribute recoveredForClient across the 3 decades capped at oldDebt
      if (recoveredForClient > paymentsClosingOldDebt && clientObj) {
        const extraDiff = recoveredForClient - paymentsClosingOldDebt;
        const fallbackTime = new Date(clientObj.updatedAt || new Date().toISOString());
        const dIdx = getDecadeIndexForDate(fallbackTime);
        clientDecadePayments[dIdx] += extraDiff;
      }

      let remainingCap = recoveredForClient;
      const clientAllocatedDecades: [number, number, number] = [0, 0, 0];
      for (let d = 0; d < 3; d++) {
        const allocated = Math.min(remainingCap, clientDecadePayments[d]);
        clientAllocatedDecades[d] = Math.round(allocated * 100) / 100;
        decadeCollectedTotals[d] += allocated;
        remainingCap = Math.max(0, remainingCap - allocated);
      }

      perClientProgressMap.set(clientId, {
        totalCollected: Math.round(recoveredForClient * 100) / 100,
        decadeCollected: clientAllocatedDecades,
      });

      totalOldDebtRecovered += recoveredForClient;
    });

    const baselineTotalOldDebt =
      plan.initialTotalDebt && plan.initialTotalDebt > 0
        ? plan.initialTotalDebt
        : Object.values(baselineDebts).reduce((s, v) => s + v, 0);

    const rawTarget = plan.targets?.[0]?.targetAmount || 0;
    const effectiveTarget =
      plan.id === 'month_plan_seed_1' && baselineTotalOldDebt > 0 && (!plan.editHistory || plan.editHistory.length === 0)
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

    const decTargets =
      plan.decadeTargets &&
      (plan.decadeTargets.decade1 > 0 ||
        plan.decadeTargets.decade2 > 0 ||
        plan.decadeTargets.decade3 > 0)
        ? plan.decadeTargets
        : this.buildDefaultDecadeTargets(targetRounded);

    const buildDecadeStat = (
      index: 1 | 2 | 3,
      label: string,
      sDate: string,
      eDate: string,
      tAmount: number,
      cAmount: number
    ) => {
      const tRound = Math.round(tAmount * 100) / 100;
      const cRound = Math.round(cAmount * 100) / 100;
      const pct =
        tRound > 0 ? Math.min(100, Math.round(((cRound / tRound) * 100) * 10) / 10) : 0;
      const sMs = new Date(`${sDate}T00:00:00`).getTime();
      const eMs = new Date(`${eDate}T23:59:59`).getTime();
      const nowTime = Date.now();
      const isCurrent = nowTime >= sMs && nowTime <= eMs;
      return {
        index,
        decadeNumber: index,
        label,
        startDate: sDate,
        endDate: eDate,
        targetAmount: tRound,
        collectedAmount: cRound,
        remainingAmount: Math.max(0, Math.round((tRound - cRound) * 100) / 100),
        percentage: pct,
        isCurrent,
      };
    };

    const decadeResults = [
      buildDecadeStat(
        1,
        '1-chi 10 kunlik (1–10 kunlar)',
        plan.startDate,
        d1EndDateStr,
        decTargets.decade1,
        decadeCollectedTotals[0]
      ),
      buildDecadeStat(
        2,
        '2-chi 10 kunlik (11–20 kunlar)',
        d2StartDateStr,
        d2EndDateStr,
        decTargets.decade2,
        decadeCollectedTotals[1]
      ),
      buildDecadeStat(
        3,
        '3-chi 10 kunlik (21-kundan yakunigacha)',
        d3StartDateStr,
        plan.endDate,
        decTargets.decade3,
        decadeCollectedTotals[2]
      ),
    ];

    const clientPlanResults = (plan.clientPlans || [])
      .filter((cp) => cp.clientId && !deletedIds.has(cp.clientId))
      .map((cp) => {
        const cObj = clientsMap.get(cp.clientId);
        const prog = perClientProgressMap.get(cp.clientId) || {
          totalCollected: 0,
          decadeCollected: [0, 0, 0] as [number, number, number],
        };
        const tTotal = Math.round((cp.targetAmount || 0) * 100) / 100;
        const cTotal = prog.totalCollected;
        const pctTotal =
          tTotal > 0 ? Math.min(100, Math.round(((cTotal / tTotal) * 100) * 10) / 10) : 0;

        const d1Target = Math.round((cp.decade1 || 0) * 100) / 100;
        const d1Coll = prog.decadeCollected[0];
        const d1Pct =
          d1Target > 0 ? Math.min(100, Math.round(((d1Coll / d1Target) * 100) * 10) / 10) : 0;

        const d2Target = Math.round((cp.decade2 || 0) * 100) / 100;
        const d2Coll = prog.decadeCollected[1];
        const d2Pct =
          d2Target > 0 ? Math.min(100, Math.round(((d2Coll / d2Target) * 100) * 10) / 10) : 0;

        const d3Target = Math.round((cp.decade3 || 0) * 100) / 100;
        const d3Coll = prog.decadeCollected[2];
        const d3Pct =
          d3Target > 0 ? Math.min(100, Math.round(((d3Coll / d3Target) * 100) * 10) / 10) : 0;

        return {
          clientId: cp.clientId,
          clientName: cObj?.name || cp.clientName,
          clientCode: cp.clientCode || cObj?.region || '',
          clientPhone: cObj?.phone || cp.clientPhone,
          currentDebt: cObj ? cObj.currentDebt : cp.initialDebt,
          initialDebt: cp.initialDebt,
          targetAmount: tTotal,
          collectedAmount: cTotal,
          remainingAmount: Math.max(0, Math.round((tTotal - cTotal) * 100) / 100),
          percentage: pctTotal,
          decade1: {
            target: d1Target,
            collected: d1Coll,
            percentage: d1Pct,
          },
          decade2: {
            target: d2Target,
            collected: d2Coll,
            percentage: d2Pct,
          },
          decade3: {
            target: d3Target,
            collected: d3Coll,
            percentage: d3Pct,
          },
        };
      });

    const nowMs = Date.now();
    const endMs = endDateObj.getTime();
    const totalDays = Math.max(30, Math.round((endMs - startMs) / (1000 * 3600 * 24)));
    const daysLeft = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 3600 * 24)));
    const isExpired = endMs < nowMs;

    return {
      targetResults,
      decadeResults,
      clientPlanResults,
      overallPercentage: percentage,
      initialTotalDebt: Math.round(baselineTotalOldDebt * 100) / 100,
      totalDays,
      daysLeft,
      isExpired,
      totalPaymentsCount,
    };
  }

  // =========================================================================
  // CLIENT REMINDERS (Mijozlar bo'yicha eslatmalar — Kalendar va Jadval uchun)
  // =========================================================================

  public getReminders(): ClientReminder[] {
    const clients = this.getClients();
    const map = new Map<string, ClientReminder>();

    clients.forEach((c) => {
      if (Array.isArray(c.reminders)) {
        c.reminders.forEach((r) => {
          if (r && r.id && r.reminderDate) {
            map.set(r.id, {
              ...r,
              clientId: c.id,
              clientName: c.name,
              clientPhone: c.phone,
              clientAddress: c.address,
            });
          }
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.reminderDate !== b.reminderDate) {
        return a.reminderDate.localeCompare(b.reminderDate);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  public addReminder(data: {
    clientId: string;
    planId?: string;
    reminderDate: string;
    note: string;
    createdBy: string;
  }): { reminder: ClientReminder; updatedClient: Client | null } | null {
    const client = this.getClientById(data.clientId);
    if (!client) return null;

    const nowStr = new Date().toISOString();
    const reminder: ClientReminder = {
      id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientAddress: client.address,
      planItemId: data.planId,
      agentUsername: data.createdBy,
      reminderDate: data.reminderDate,
      note: data.note.trim(),
      createdAt: nowStr,
      status: 'kutilmoqda',
    };

    const existingReminders = Array.isArray(client.reminders) ? [...client.reminders] : [];
    existingReminders.unshift(reminder);

    const currentLogs = client.logs ? [...client.logs] : [];
    currentLogs.unshift({
      id: 'log_' + Date.now() + '_rem',
      clientId: client.id,
      author: data.createdBy,
      timestamp: nowStr,
      type: 'visit_action',
      title: `Eslatma belgilandi (${data.reminderDate})`,
      details: `${data.createdBy} tomonidan ${data.reminderDate} sanasiga eslatma qo'yildi: "${data.note.trim()}"`,
    });

    const updatedClient = this.updateClient(client.id, {
      reminders: existingReminders,
      logs: currentLogs,
    });

    return { reminder, updatedClient };
  }

  public toggleReminderStatus(
    reminderId: string,
    clientId: string,
    author: string
  ): Client | null {
    const client = this.getClientById(clientId);
    if (!client || !Array.isArray(client.reminders)) return null;

    const nowStr = new Date().toISOString();
    let toggledNote = '';
    let toggledDate = '';
    let finalStatus: 'kutilmoqda' | 'bajarildi' = 'bajarildi';

    const updatedReminders = client.reminders.map((r) => {
      if (r.id !== reminderId) return r;
      const nextStatus: 'kutilmoqda' | 'bajarildi' =
        r.status === 'bajarildi' ? 'kutilmoqda' : 'bajarildi';
      finalStatus = nextStatus;
      toggledNote = r.note;
      toggledDate = r.reminderDate;
      return {
        ...r,
        status: nextStatus,
        completedAt: nextStatus === 'bajarildi' ? nowStr : undefined,
        completedBy: nextStatus === 'bajarildi' ? author : undefined,
      };
    });

    const currentLogs = client.logs ? [...client.logs] : [];
    if (toggledNote) {
      currentLogs.unshift({
        id: 'log_' + Date.now() + '_rem_tick',
        clientId: client.id,
        author,
        timestamp: nowStr,
        type: 'visit_action',
        title:
          finalStatus === 'bajarildi'
            ? `Eslatma bajarildi (✓) — @${author}`
            : `Eslatma qayta kutilmoqda holatiga o'tkazildi — @${author}`,
        details: `Eslatma (${toggledDate}): "${toggledNote}". Holatni o'zgartirdi: @${author}`,
      });
    }

    return this.updateClient(client.id, {
      reminders: updatedReminders,
      logs: currentLogs,
    });
  }

  public deleteReminder(reminderId: string, clientId: string): Client | null {
    const client = this.getClientById(clientId);
    if (!client || !Array.isArray(client.reminders)) return null;

    const updatedReminders = client.reminders.filter((r) => r.id !== reminderId);
    return this.updateClient(client.id, {
      reminders: updatedReminders,
    });
  }
}

export const storageService = new StorageService();
