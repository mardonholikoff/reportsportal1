export interface ProductItem {
  id: string;
  name: string;
  unit: string; // 'kg', 'dona', 'metr', 'litr', 'qop', 'tonna', etc.
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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
  | 'naqd_som'
  | 'naqd_valyuta'
  | 'bank_otkazma'
  | 'karta_otkazma'
  | 'qr_otkazma';

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
  status: 'rejalashtirilgan' | 'bajarildi';
  actionDone?: PlanActionType;
  financialAction?: {
    method: FinancialMethodType;
    methodLabel: string;
    amount: number;
    currency?: string; // 'UZS' | 'USD'
    note?: string;
  };
  productsDelivered?: ProductItem[];
  completedAt?: string;
  reportNote?: string;
  planNote?: string;
}
