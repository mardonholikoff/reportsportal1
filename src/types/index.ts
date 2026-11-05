export interface ProductItem {
  id: string;
  name: string;
  unit: string; // 'kg', 'dona', 'metr', 'litr', 'qop', 'tonna', etc.
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
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
  phones?: string[];
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

export interface FinancialPaymentSplit {
  method: FinancialMethodType;
  methodLabel: string;
  amount: number; // USD da summa
  amountUzs?: number; // So'mda kiritilgan summa (ixtiyoriy)
  exchangeRate?: number; // Konvertatsiya kursi (ixtiyoriy)
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
  planDate?: string; // YYYY-MM-DD formatdagi reja sanasi (boshqa kunda tuzilgan bo'lsa)
  status: 'rejalashtirilgan' | 'bajarildi' | 'yopildi';
  isClosed?: boolean;
  closedWithoutAction?: boolean;
  closedAt?: string;
  closeReason?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  reopenHistory?: Array<{
    reopenedAt: string;
    reopenedBy: string;
    reopenReason: string;
  }>;
  plannedAction?: PlanActionType;
  plannedAmount?: number;
  actionDone?: PlanActionType;
  financialAction?: {
    method: FinancialMethodType;
    methodLabel: string;
    amount: number;
    currency?: string; // 'so'm' | 'USD' | ombor valyutasi
    note?: string;
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
  completedAt?: string;
  lastExecutedBy?: string;
  lastExecutedAt?: string;
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
      note?: string;
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

  // 5-BLOK: Eng kam sotilish narxi (Agentlar mijozga sotayotganda ko'rinadigan narx)
  minSellingPricingUnitType?: 'piece' | 'package'; // Eng kam sotilish narxi birligi
  minSellingPrice?: number; // Eng kam sotilish narxi qiymati (USD)

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

export interface MonthlyPlanDecadeTargets {
  decade1: number; // Birinchi 10 kunlik uchun reja summasi (USD)
  decade2: number; // Ikkinchi 10 kunlik uchun reja summasi (USD)
  decade3: number; // Uchinchi 10 kunlik uchun reja summasi (USD)
}

export interface MonthlyPlanEditLog {
  id: string;
  editedBy: string; // Kim tahrir qilgani
  editedAt: string; // Qachon tahrir qilingani (ISO)
  reason: string; // Tahrir izohi (majburiy)
  changesSummary?: string; // O'zgarishlar qisqacha tavsifi
}

export interface MonthlyPlanClientItem {
  clientId: string;
  clientName: string;
  clientCode?: string;
  clientPhone?: string;
  initialDebt: number; // Mijozning reja tuzilgandagi qarzi (USD)
  targetAmount: number; // Shu tanlangan muddatda umumiy unishi mumkin bo'lgan summa (USD)
  decade1: number; // 1-chi 10 kunlikda unishi mumkin (USD)
  decade2: number; // 2-chi 10 kunlikda unishi mumkin (USD)
  decade3: number; // 3-chi 10 kunlikda unishi mumkin (USD)
}

export interface PlannedProductDeliveryItem {
  id: string;
  warehouseId: string;
  productName: string;
  brand?: string;
  unit: string;
  quantity: number;
  originalUnitPrice: number; // Ombordagi bazaviy narx (1 birlik)
  discountPercent: number; // Foiz hisobida chegirma (%)
  discountAmount?: number; // Son (summa) chegirmasi (1 birlikdan ayirilgan chegirma)
  unitPrice: number; // Chegirmadan keyingi yakuniy narx (1 birlik uchun)
  totalPrice: number; // Avtomatik shakllangan summa (quantity * unitPrice)
}

export interface MonthlyProductPlanClientItem {
  clientId: string;
  clientName: string;
  clientCode?: string;
  clientPhone?: string;
  targetAmount: number; // 30 kunda jami beriladigan mahsulot summasi (avtomatik hisoblangan)
  plannedProducts: PlannedProductDeliveryItem[]; // 30 kunlik reja uchun ombordan tanlangan mahsulotlar
  // Legacy compatibility fields
  decade1?: number;
  decade2?: number;
  decade3?: number;
  decade1Products?: PlannedProductDeliveryItem[];
  decade2Products?: PlannedProductDeliveryItem[];
  decade3Products?: PlannedProductDeliveryItem[];
}

export interface MonthlyPlan {
  id: string;
  planType?: 'debt_collection' | 'product_delivery'; // 'debt_collection' (1 oylik qarz undiruv) | 'product_delivery' (1 oylik mahsulot berish)
  agentUsername: string; // 'agentp1' | 'agentc1' | 'adminc'
  targets: MonthlyPlanTarget[]; // Maqsadli summa
  decadeTargets?: MonthlyPlanDecadeTargets; // 1-chi, 2-chi va 3-chi 10 kunliklar rejasi
  clientPlans?: MonthlyPlanClientItem[]; // Mijozlar kesimida umumiy va 10 kunliklar undiruv rejasi
  productClientPlans?: MonthlyProductPlanClientItem[]; // Mijozlar kesimida 10 kunliklar bo'yicha ombordan mahsulot berish rejasi
  initialClientDebts?: Record<string, number>; // Reja tuzilgan vaqtdagi eski mavjud mijozlar qarzdorligi (USD)
  initialTotalDebt?: number; // Reja tuzilgan vaqtdagi jami eski qarzdorlik (USD)
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  notes?: string;
  editHistory?: MonthlyPlanEditLog[]; // Tahrirlar xronologiyasi
  status: 'active' | 'completed' | 'cancelled';
}
