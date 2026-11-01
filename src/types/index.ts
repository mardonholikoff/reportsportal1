export interface ProductItem {
  id: string;
  name: string;
  unit: string; // 'kg', 'dona', 'metr', 'litr', 'qop', 'tonna', etc.
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  warehouseId?: string;
}

export interface ClientAuditLog {
  id: string;
  clientId: string;
  author: string; // 'adminc' | 'agentp1'
  timestamp: string;
  type: 'visit_action' | 'payment' | 'product_added' | 'created' | 'updated';
  title: string;
  details: string;
  amountChanged?: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  region?: string; // Viloyat yoki shahar
  district?: string; // Tuman
  landmark?: string; // Mo'ljal
  products: ProductItem[];
  currentDebt: number; // Joriy qarzdorlik
  currentAdvance: number; // Joriy haqdorlik
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string; // 'adminc' | 'agentp1'
  syncStatus: 'synced' | 'pending' | 'offline';
  logs?: ClientAuditLog[];
  lastPlanClosedAt?: string;
  lastPlanCloseReason?: string;
  lastPlanClosedBy?: string;
}

export interface AuthUser {
  username: string;
  name: string;
  role: 'admin' | 'agent';
  token: string;
}

export interface SummaryStats {
  totalClients: number;
  totalDebt: number;
  totalAdvance: number;
  totalProductsValue: number;
  debtorsCount: number;
  creditorsCount: number;
}

export type PlanActionType = 'telefon qilindi' | 'joyiga borildi' | 'telefon qilindi + joyiga borildi';

export type FinancialMethodType =
  | 'naqd'
  | 'naqd_som'
  | 'naqd_valyuta'
  | 'bank_otkazma'
  | 'karta_otkazma'
  | 'qr_otkazma';

export type DeliveryPaymentType =
  | 'naqd'
  | 'bank'
  | 'karta'
  | 'qr'
  | 'qarzga';

export interface DeliveryPaymentInfo {
  paymentType: DeliveryPaymentType;
  paymentLabel: string;
  currency?: string;
  paidAmount: number;
  totalAmount: number;
  debtAmount: number;
}

export interface DailyPlanItem {
  id: string;
  agentUsername: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  clientRegion?: string;
  clientDistrict?: string;
  clientLandmark?: string;
  createdAt: string;
  status: 'rejalashtirilgan' | 'bajarildi' | 'yopildi';
  isClosed?: boolean;
  closedAt?: string;
  closeReason?: string;
  closedBy?: string;
  actionDone?: PlanActionType;
  financialAction?: {
    method: FinancialMethodType;
    methodLabel: string;
    amount: number;
    currency?: string; // 'so'm' | 'USD' | ombor valyutasi
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
  completedAt?: string;
  reportNote?: string;
  planNote?: string;
  actionsCount?: number;
  actionsHistory?: Array<{
    timestamp: string;
    author: string;
    actionDone: PlanActionType;
    financialAction?: {
      method?: FinancialMethodType;
      methodLabel: string;
      amount: number;
      currency?: string;
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
  }>;
}

export interface WarehouseProduct {
  id: string;
  // 1-BLOK: Mahsulot
  brand: string; // Mahsulot brendi
  name: string; // Mahsulot nomi
  mark1: string; // Mahsulot markasi 1
  mark2: string; // Mahsulot markasi 2
  extraMarks?: string[]; // Qo'shimcha markalar

  // 2-BLOK: O'lcham
  // 2.1:
  baseUnit: string; // O'lchov birligi (litr, kg, metr, gramm, dona...)
  pieceUnitName: string; // Dona / idish (1 idish, 1 dona...)
  volumePerPiece: number; // Donadagi hajm (masalan 5 litr)
  // 2.2:
  packageUnitName: string; // O'lcham (korobka, qop, blok, yashik...)
  piecesPerPackage: number; // Qadoqdagi dona soni (masalan 5 dona)

  // 3-BLOK: Narx
  pricingUnitType: 'piece' | 'package'; // Narxlash birligi
  currency: string; // Valyuta (so'm, USD, erkin matn)
  price: number; // Narx qiymati

  // 4-BLOK: Omborga kirim
  intakeDate: string; // Sana (YYYY-MM-DD)
  intakeUnitType: 'package' | 'piece'; // Qabul qilingan o'lchov turi
  intakeQuantity: number; // Kiritilgan soni
  totalSum: number; // Avtomatik umumiy summa
  totalPieces: number; // Avtomatik umumiy dona
  totalVolume: number; // Avtomatik umumiy hajm
  createdBy: string; // 'adminc'
  createdAt: string;
  notes?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
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
    | string;
  actionTitle: string;
  details: string;
  ipAddress: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}

export interface SystemLogMonthlyArchiveRecord {
  id: string;
  monthKey: string;
  monthLabel: string;
  logsCount: number;
  exportedAt: string;
  exportedBy: string;
  fileName: string;
}

export interface SystemLogPeriodArchive {
  id: string;
  periodKey: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  logsCount: number;
  archivedAt: string;
  exportedBy: string;
  fileName: string;
  logs: SystemLog[];
}
export interface MonthlyPlanTarget {
  currency: string;
  targetAmount: number;
}

export interface MonthlyPlan {
  id: string;
  agentUsername: string; // 'agentp1' | 'agentc1' | 'adminc'
  targets: MonthlyPlanTarget[]; // Valyuta va summa juftliklari
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdAt: string;
  createdBy: string;
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
}
