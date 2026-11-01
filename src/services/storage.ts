import {
  Client,
  ClientAuditLog,
  DailyPlanItem,
  PlanActionType,
  FinancialMethodType,
  ProductItem,
  WarehouseProduct,
  DeliveryPaymentInfo,
} from '../types';
import { parseLegacyAddress, formatAddress } from '../utils/location';

const STORAGE_KEY = 'savdo_clients_data_v1';
const SYNC_QUEUE_KEY = 'savdo_sync_queue_v1';
const FIREBASE_CONFIG_KEY = 'savdo_firebase_config_v1';
const SYNC_TIMESTAMP_KEY = 'savdo_last_synced_at';
const DAILY_PLANS_KEY = 'savdo_daily_plans_v1';
const WAREHOUSE_KEY = 'savdo_warehouse_products_v1';
export const DELETED_CLIENT_IDS_KEY = 'savdo_deleted_client_ids_v1';
export const APP_INITIALIZED_KEY = 'savdo_app_initialized_v1';

export function getDeletedClientIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_CLIENT_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markClientAsDeleted(clientId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = getDeletedClientIds();
    ids.add(clientId);
    localStorage.setItem(DELETED_CLIENT_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.error('Failed to mark client as deleted', e);
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
    currency: 'UZS',
    price: 380000,
    intakeDate: new Date().toISOString().slice(0, 10),
    intakeUnitType: 'package',
    intakeQuantity: 20,
    totalSum: 30400000,
    totalPieces: 80,
    totalVolume: 400,
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
    currency: 'UZS',
    price: 54000,
    intakeDate: new Date().toISOString().slice(0, 10),
    intakeUnitType: 'package',
    intakeQuantity: 15,
    totalSum: 8100000,
    totalPieces: 150,
    totalVolume: 450,
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
        unitPrice: 65000,
        totalPrice: 3250000,
      },
      {
        id: 'p1_2',
        name: 'Armatura 12mm (Bekobod)',
        unit: 'metr',
        quantity: 120,
        unitPrice: 11500,
        totalPrice: 1380000,
      },
      {
        id: 'p1_3',
        name: 'Gipsokarton 9.5mm (Knauf)',
        unit: 'dona',
        quantity: 25,
        unitPrice: 52000,
        totalPrice: 1300000,
      },
    ],
    currentDebt: 1850000,
    currentAdvance: 0,
    notes: 'Qolgan 1 850 000 so\'mni hafta oxirigacha beradi.',
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
        details: "Boshlang'ich mahsulotlar va 1 850 000 so'm qarz bilan kiritildi.",
      },
    ],
  },
  {
    id: 'cli_2',
    name: 'Shohruh Mirzayev',
    phone: '+998 93 987 65 43',
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
        unitPrice: 48000,
        totalPrice: 960000,
      },
      {
        id: 'p2_2',
        name: 'Kafel 60x60 oq mramor',
        unit: 'metr kvadrat',
        quantity: 45,
        unitPrice: 95000,
        totalPrice: 4275000,
      },
    ],
    currentDebt: 0,
    currentAdvance: 350000,
    notes: 'Keyingi buyurtma uchun 350 000 so\'m oldindan bergan.',
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
        details: "350 000 so'm avans to'lovi bilan kiritildi.",
      },
    ],
  },
  {
    id: 'cli_3',
    name: 'Dilnoza Saidova',
    phone: '+998 97 555 44 33',
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
        unitPrice: 42000,
        totalPrice: 1260000,
      },
      {
        id: 'p3_2',
        name: 'Shpatlevka (Saten)',
        unit: 'qop',
        quantity: 15,
        unitPrice: 38000,
        totalPrice: 570000,
      },
    ],
    currentDebt: 630000,
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
      window.addEventListener('storage', () => this.notify());
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public getClients(): Client[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const isInit = localStorage.getItem(APP_INITIALIZED_KEY);
      if (!data) {
        return isInit ? [] : INITIAL_CLIENTS;
      }
      const deletedIds = getDeletedClientIds();
      const parsed: Client[] = JSON.parse(data);
      return parsed
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
    } catch (e) {
      console.error('Failed to parse clients:', e);
      return [];
    }
  }

  public saveClients(clients: Client[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    this.notify();
  }

  public getClientById(id: string): Client | undefined {
    return this.getClients().find((c) => c.id === id);
  }

  public addClient(
    clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'logs'>,
    author: string = 'adminc'
  ): Client {
    const clients = this.getClients();
    const clientId = 'cli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const nowStr = new Date().toISOString();

    const initialLog: ClientAuditLog = {
      id: 'log_' + Date.now() + '_init',
      clientId,
      author,
      timestamp: nowStr,
      type: 'created',
      title: "Mijoz ro'yxatga qo'shildi",
      details: `${author} tomonidan yangi mijoz kiritildi. Qarz: ${clientData.currentDebt || 0} so'm, Avans: ${clientData.currentAdvance || 0} so'm`,
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

  public updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>): Client | null {
    const clients = this.getClients();
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
    markClientAsDeleted(id);
    const clients = this.getClients();
    const filtered = clients.filter((c) => c.id !== id);
    if (filtered.length === clients.length) return false;

    this.saveClients(filtered);
    this.addToSyncQueue({ action: 'delete', clientId: id });

    // Cascade delete any daily plans for this client
    try {
      const plans = this.getDailyPlans();
      const remainingPlans = plans.filter((p) => p.clientId !== id);
      if (remainingPlans.length !== plans.length) {
        this.saveDailyPlans(remainingPlans);
      }
    } catch (e) {
      console.warn('Failed to cascade delete daily plans for client', id, e);
    }

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
      details: `${author} tomonidan o'zgartirildi: ${noteAddition || ''}. Yangi qarz: ${newDebt} so'm, Yangi avans: ${newAdvance} so'm.`,
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

  public getDailyPlans(): DailyPlanItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(DAILY_PLANS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public saveDailyPlans(plans: DailyPlanItem[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DAILY_PLANS_KEY, JSON.stringify(plans));
    this.notify();
  }

  // Faqat oxirgi 24 soat ichida tuzilgan faol rejalarni olish
  public getActive24hPlans(agentUsername?: string): DailyPlanItem[] {
    const all = this.getDailyPlans();
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    return all.filter((item) => {
      const createdTime = new Date(item.createdAt).getTime();
      const isWithin24h = createdTime >= twentyFourHoursAgo;
      if (!isWithin24h) return false;

      if (agentUsername) {
        return item.agentUsername === agentUsername;
      }
      return true;
    });
  }

  // Kunlik reja tuzish (agent tomonidan tanlangan mijozlar va izohlar)
  public createDailyPlan(
    agentUsername: string,
    selections: Array<{ clientId: string; planNote?: string } | string>
  ): DailyPlanItem[] {
    const allClients = this.getClients();
    const existingPlans = this.getDailyPlans();
    const nowStr = new Date().toISOString();

    const newItems: DailyPlanItem[] = [];

    selections.forEach((sel) => {
      const cId = typeof sel === 'string' ? sel : sel.clientId;
      const note = typeof sel === 'string' ? undefined : sel.planNote;
      const client = allClients.find((c) => c.id === cId);
      if (!client) return;

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
        planNote: note?.trim() || undefined,
      };
      newItems.push(planItem);
    });

    const updatedPlans = [...newItems, ...existingPlans];
    this.saveDailyPlans(updatedPlans);
    return newItems;
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
        details: `${author} tomonidan to'lov qabul qilindi: ${new Intl.NumberFormat('uz-UZ').format(amt)} ${report.financialAction.currency || 'so\'m'}. ${report.financialAction.note ? `Izoh: ${report.financialAction.note}` : ''}`,
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
            ? `Qarzga berildi (+${new Intl.NumberFormat('uz-UZ').format(debtAdded)} so'm qarzga yozildi)`
            : `To'lov shakli: ${deliveryPay?.paymentLabel || payType} (${new Intl.NumberFormat('uz-UZ').format(paidAmt)} ${deliveryPay?.currency || "so'm"})${debtAdded > 0 ? `, qoldiq qarz: +${new Intl.NumberFormat('uz-UZ').format(debtAdded)} so'm` : ''}`;

        clientLogs.unshift({
          id: 'log_' + Date.now() + '_prod',
          clientId: client.id,
          author,
          timestamp: nowStr,
          type: 'product_added',
          title: "Yangi mahsulotlar topshirildi",
          details: `${author} tomonidan topshirildi: ${prodSumStr}. Qiymati: ${new Intl.NumberFormat('uz-UZ').format(totalDeliveredValue)} so'm. ${payDesc}`,
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
          details: `${author} tomonidan qabul qilindi va omborga qo'shildi: ${returnedStr}. Qarz ${new Intl.NumberFormat('uz-UZ').format(totalReturnedValue)} so'm kamaytirildi.`,
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
  public closeDailyPlanItem(planItemId: string, author: string): boolean {
    const plans = this.getDailyPlans();
    const planIndex = plans.findIndex((p) => p.id === planItemId);
    if (planIndex === -1) return false;

    const plan = plans[planIndex];
    const nowStr = new Date().toISOString();
    plan.isClosed = true;
    plan.status = 'yopildi';
    plan.closedAt = nowStr;
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
        details: `${author} tomonidan ushbu mijoz bo'yicha amallar yakunlandi va reja to'liq yopildi.`,
      });
      this.updateClient(client.id, {
        logs: clientLogs,
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
    try {
      const data = localStorage.getItem(WAREHOUSE_KEY);
      if (!data) {
        localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(INITIAL_WAREHOUSE_PRODUCTS));
        return INITIAL_WAREHOUSE_PRODUCTS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_WAREHOUSE_PRODUCTS;
    }
  }

  public saveWarehouseProducts(items: WarehouseProduct[]): void {
    try {
      localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save warehouse products to localStorage:', e);
    }
  }

  public addWarehouseProduct(
    productData: Omit<WarehouseProduct, 'id' | 'createdAt'>
  ): WarehouseProduct {
    const products = this.getWarehouseProducts();
    const newProduct: WarehouseProduct = {
      ...productData,
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    products.unshift(newProduct);
    this.saveWarehouseProducts(products);
    return newProduct;
  }

  public deleteWarehouseProduct(id: string): void {
    const products = this.getWarehouseProducts();
    const updated = products.filter((p) => p.id !== id);
    this.saveWarehouseProducts(updated);
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
        currency: "so'm",
        price: item.unitPrice || 0,
        intakeDate: new Date().toISOString().slice(0, 10),
        intakeUnitType: 'piece',
        intakeQuantity: item.quantity,
        totalSum: Math.round((item.unitPrice || 0) * item.quantity),
        totalPieces: item.quantity,
        totalVolume: item.quantity,
        createdBy: author,
        createdAt: new Date().toISOString(),
        notes: `${author} tomonidan mijozdan qaytarib olindi`,
      };
      warehouse.unshift(newWh);
    }

    this.saveWarehouseProducts(warehouse);
  }
}

export const storageService = new StorageService();
