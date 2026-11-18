import React, { useState, useMemo, useEffect } from 'react';
import {
  Client,
  ClientMonthlyInfoEntry,
  DailyPlanItem,
  WarehouseProduct,
} from '../types';
import {
  formatMoney,
  formatDateDMY,
  formatNumber,
} from '../utils/format';
import {
  storageService,
  getPlanSoldProductsData,
  getPlanDateKey,
  getClosedDateKey,
} from '../services/storage';
import {
  X,
  UserCheck,
  Save,
  Check,
  Calendar,
  Building2,
  Phone,
  MapPin,
  Users,
  Droplets,
  Wrench,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import { StickyTableWrapper } from './StickyTableWrapper';

interface ClientFullInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  dailyPlans?: DailyPlanItem[];
  warehouseProducts?: WarehouseProduct[];
  userRole?: 'admin' | 'agent';
  currentUsername?: string;
  onSaveMonthlyDetails?: (
    clientId: string,
    monthlyDetails: Record<string, ClientMonthlyInfoEntry>
  ) => void;
}

const MONTH_NAMES = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

const toLocalYMD = (raw?: string, fallback?: string): string => {
  if (!raw) return fallback || '';
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return trimmed.slice(0, 10) || fallback || '';
};

const getTodayYMD = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

type OilBucket = '10w40_sl_4l' | '5w30_sp_4l' | 'other';

function classifyOilProduct(
  productName: string,
  wh?: WarehouseProduct
): OilBucket {
  const rawCombined = [
    productName,
    wh?.brand,
    wh?.name,
    wh?.mark1,
    wh?.mark2,
    ...(wh?.extraMarks || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const norm = rawCombined
    .replace(/(\d)w[\s-]*(\d)/g, '$1w$2')
    .replace(/4[\s-]*(l|litr|liter|л)\b/g, '4l')
    .replace(/\s+/g, ' ');

  const has4L =
    norm.includes('4l') ||
    (wh?.volumePerPiece === 4 &&
      (wh?.baseUnit || '').toLowerCase().startsWith('l'));

  if (norm.includes('10w40') && /\bsl\b/i.test(norm) && has4L) {
    return '10w40_sl_4l';
  }
  if (norm.includes('5w30') && /\bsp\b/i.test(norm) && has4L) {
    return '5w30_sp_4l';
  }
  return 'other';
}

function findMatchingWarehouse(
  warehouseList: WarehouseProduct[],
  warehouseId?: string,
  productName?: string
): WarehouseProduct | undefined {
  if (warehouseId) {
    const byId = warehouseList.find((w) => w.id === warehouseId);
    if (byId) return byId;
  }
  if (productName) {
    const clean = productName.trim().toLowerCase();
    return warehouseList.find((w) => {
      const full = `${w.brand} - ${w.name} ${w.mark1 ? `[${w.mark1}]` : ''}`
        .trim()
        .toLowerCase();
      return (
        full === clean ||
        clean.includes(`${w.brand} - ${w.name}`.toLowerCase()) ||
        (w.name && clean.includes(w.name.toLowerCase()))
      );
    });
  }
  return undefined;
}

function convertToKanistrPieces(
  quantity: number,
  unit: string,
  wh?: WarehouseProduct
): number {
  const qty = Number(quantity) || 0;
  if (qty <= 0) return 0;
  if (wh) {
    const uClean = (unit || '').trim().toLowerCase();
    const pkgClean = (wh.packageUnitName || '').trim().toLowerCase();
    if (pkgClean && uClean === pkgClean && (wh.piecesPerPackage || 1) > 1) {
      return Math.round(qty * (wh.piecesPerPackage || 1) * 100) / 100;
    }
  }
  return Math.round(qty * 100) / 100;
}

export const ClientFullInfoModal: React.FC<ClientFullInfoModalProps> = ({
  isOpen,
  onClose,
  client,
  dailyPlans,
  warehouseProducts: propWarehouse,
  userRole = 'admin',
  currentUsername = 'adminc',
  onSaveMonthlyDetails,
}) => {
  const isAdmin =
    userRole === 'admin' ||
    currentUsername === 'adminc' ||
    currentUsername === 'adminc1';

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [draftMonthly, setDraftMonthly] = useState<
    Record<string, ClientMonthlyInfoEntry>
  >({});
  const [isDirty, setIsDirty] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Initialize draft when opening modal or switching client
  useEffect(() => {
    if (isOpen && client) {
      setDraftMonthly(client.monthlyDetails ? { ...client.monthlyDetails } : {});
      setSelectedYear(new Date().getFullYear());
      setIsDirty(false);
      setSavedToast(false);
    }
  }, [isOpen, client?.id]);

  const warehouseProducts = useMemo(() => {
    if (propWarehouse && propWarehouse.length > 0) return propWarehouse;
    return storageService.getWarehouseProducts();
  }, [propWarehouse, isOpen]);

  const clientPlans = useMemo(() => {
    if (!client) return [];
    const source =
      dailyPlans && dailyPlans.length > 0
        ? dailyPlans
        : storageService.getDailyPlans();

    const rawClientPlans = source.filter(
      (p) =>
        p &&
        (p.clientId === client.id ||
          ((p.clientName || '').trim().toLowerCase() ===
            client.name.trim().toLowerCase() &&
            (p.clientPhone || '').replace(/\D/g, '') ===
              (client.phone || '').replace(/\D/g, '')))
    );

    const getEffectiveDate = (p: DailyPlanItem): string =>
      getClosedDateKey(p) ||
      (p as any).lastClosedDateKey ||
      getPlanDateKey(p) ||
      toLocalYMD(p.planDate || p.createdAt);

    const getFreshnessScore = (p: DailyPlanItem): string =>
      p.lastExecutedAt ||
      (p as any).closedUpdatedAt ||
      p.reopenedAt ||
      p.closedAt ||
      p.completedAt ||
      p.createdAt ||
      '';

    const dedupByDate = new Map<string, DailyPlanItem>();
    rawClientPlans.forEach((plan) => {
      const dKey = getEffectiveDate(plan) || plan.id;
      const existing = dedupByDate.get(dKey);
      if (!existing || getFreshnessScore(plan) >= getFreshnessScore(existing)) {
        dedupByDate.set(dKey, plan);
      }
    });

    return Array.from(dedupByDate.values());
  }, [client, dailyPlans, isOpen]);

  // Compute monthly auto-metrics across all years
  const {
    monthlyMetrics,
    availableYears,
    earliestActiveMonthKey,
  } = useMemo(() => {
    interface MonthMetric {
      tovarOlish: number;
      tolov: number;
      tovarQaytdi: number;
      bonus: number;
      oil10w40: number;
      oil5w30: number;
      otherOils: number;
    }

    const metricsMap = new Map<string, MonthMetric>();
    const yearsSet = new Set<number>([currentYear]);
    const activeMonthsSet = new Set<string>();

    const ensureMonth = (monthKey: string): MonthMetric => {
      if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
        const y = Number(monthKey.slice(0, 4));
        if (!isNaN(y) && y > 2000 && y < 2100) yearsSet.add(y);
        activeMonthsSet.add(monthKey);
      }
      const existing = metricsMap.get(monthKey);
      if (existing) return existing;
      const fresh: MonthMetric = {
        tovarOlish: 0,
        tolov: 0,
        tovarQaytdi: 0,
        bonus: 0,
        oil10w40: 0,
        oil5w30: 0,
        otherOils: 0,
      };
      metricsMap.set(monthKey, fresh);
      return fresh;
    };

    if (!client) {
      return {
        monthlyMetrics: metricsMap,
        availableYears: [currentYear],
        earliestActiveMonthKey: `${currentYear}-01`,
      };
    }

    if (client.createdAt) {
      const mk = toLocalYMD(client.createdAt).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(mk)) {
        yearsSet.add(Number(mk.slice(0, 4)));
        activeMonthsSet.add(mk);
      }
    }
    if (client.workStartDate && /^\d{4}-\d{2}/.test(client.workStartDate)) {
      yearsSet.add(Number(client.workStartDate.slice(0, 4)));
    }
    if (client.monthlyDetails) {
      Object.keys(client.monthlyDetails).forEach((mk) => {
        if (/^\d{4}-\d{2}$/.test(mk)) {
          yearsSet.add(Number(mk.slice(0, 4)));
        }
      });
    }

    // 1. Delivered products & Returns
    interface DeliveryTrack {
      monthKey: string;
      productId?: string;
      warehouseId?: string;
      name: string;
      unit: string;
      qty: number;
      returnedQty: number;
      pieces: number;
      unitPrice: number;
      grossTotal: number;
      rawDiscount: number;
      bucket: OilBucket;
    }

    interface ReturnTrack {
      monthKey: string;
      productId?: string;
      warehouseId?: string;
      name: string;
      unit: string;
      qty: number;
      unitPrice: number;
    }

    const deliveries: DeliveryTrack[] = [];
    const returns: ReturnTrack[] = [];
    const coveredProductIds = new Set<string>();
    const coveredWarehouseIds = new Set<string>();
    const coveredProductNames = new Set<string>();

    clientPlans.forEach((plan) => {
      const planDateKey =
        getClosedDateKey(plan) ||
        (plan as any).lastClosedDateKey ||
        getPlanDateKey(plan) ||
        toLocalYMD(plan.planDate || plan.createdAt);

      const soldData = getPlanSoldProductsData(plan);
      const prods = (soldData.productsDelivered || []).filter(
        (p) => p && (p.name || '').trim() !== '' && (Number(p.quantity) || 0) > 0
      );

      prods.forEach((p) => {
        if (p.id) coveredProductIds.add(p.id);
        if (p.warehouseId) coveredWarehouseIds.add(p.warehouseId);
        coveredProductNames.add(p.name.trim().toLowerCase());

        const itemDate =
          ((p as any).date ? toLocalYMD(String((p as any).date)) : '') ||
          planDateKey;
        const monthKey = itemDate.slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(monthKey)) return;

        const qty = Number(p.quantity) || 0;
        const uPrice = Number(p.unitPrice) || 0;
        const grossTotal =
          p.totalPrice !== undefined && p.totalPrice >= 0
            ? Number(p.totalPrice)
            : Math.round(qty * uPrice * 100) / 100;

        let rawDiscount = 0;
        if (p.discountAmount !== undefined && Number(p.discountAmount) > 0) {
          rawDiscount = Number(p.discountAmount);
        } else if (
          p.originalUnitPrice !== undefined &&
          Number(p.originalUnitPrice) > uPrice
        ) {
          rawDiscount = Math.max(
            0,
            Math.round((qty * Number(p.originalUnitPrice) - grossTotal) * 100) / 100
          );
        }

        const wh = findMatchingWarehouse(
          warehouseProducts,
          p.warehouseId,
          p.name
        );
        const pieces = convertToKanistrPieces(qty, p.unit || 'dona', wh);
        const bucket = classifyOilProduct(p.name, wh);

        deliveries.push({
          monthKey,
          productId: p.id,
          warehouseId: p.warehouseId,
          name: p.name,
          unit: p.unit || 'dona',
          qty,
          returnedQty: 0,
          pieces,
          unitPrice: uPrice,
          grossTotal,
          rawDiscount,
          bucket,
        });
      });

      // Collect returns
      const planRets: any[] = [];
      if (Array.isArray(plan.productsReturned) && plan.productsReturned.length > 0) {
        planRets.push(...plan.productsReturned);
      } else if (Array.isArray(plan.actionsHistory)) {
        plan.actionsHistory.forEach((act) => {
          if (Array.isArray(act.productsReturned)) {
            planRets.push(...act.productsReturned);
          }
        });
      }

      planRets.forEach((r) => {
        if (!r || !(r.name || '').trim() || (Number(r.quantity) || 0) <= 0)
          return;
        const retDate = toLocalYMD(r.returnedAt || planDateKey, planDateKey);
        const retMonthKey = retDate.slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(retMonthKey)) return;

        let uPrice = Number(r.unitPrice) || 0;
        if (uPrice <= 0) {
          const matchedDel = prods.find(
            (ap) =>
              (r.productId && ap.id === r.productId) ||
              (r.warehouseId && ap.warehouseId === r.warehouseId) ||
              ap.name.trim().toLowerCase() === r.name.trim().toLowerCase()
          );
          if (matchedDel) {
            uPrice = Number(matchedDel.unitPrice) || 0;
          }
        }

        returns.push({
          monthKey: retMonthKey,
          productId: r.productId,
          warehouseId: r.warehouseId,
          name: r.name,
          unit: r.unit || 'dona',
          qty: Number(r.quantity) || 0,
          unitPrice: uPrice,
        });
      });
    });

    // Fallback initial client.products not covered by plans
    if (client.products && client.products.length > 0) {
      const fallbackMonth = toLocalYMD(
        client.createdAt || client.updatedAt
      ).slice(0, 7);
      client.products.forEach((p) => {
        if (!p || !(p.name || '').trim()) return;
        const normName = p.name.trim().toLowerCase();
        if (p.id && coveredProductIds.has(p.id)) return;
        if (p.warehouseId && coveredWarehouseIds.has(p.warehouseId)) return;
        if (coveredProductNames.has(normName)) return;

        const qty = Number(p.quantity) || 0;
        if (qty <= 0) return;
        const itemMonth =
          ((p as any).date
            ? toLocalYMD(String((p as any).date)).slice(0, 7)
            : '') || fallbackMonth;
        if (!/^\d{4}-\d{2}$/.test(itemMonth)) return;

        const uPrice = Number(p.unitPrice) || 0;
        const grossTotal =
          p.totalPrice !== undefined && p.totalPrice >= 0
            ? Number(p.totalPrice)
            : Math.round(qty * uPrice * 100) / 100;

        let rawDiscount = 0;
        if (p.discountAmount !== undefined && Number(p.discountAmount) > 0) {
          rawDiscount = Number(p.discountAmount);
        } else if (
          p.originalUnitPrice !== undefined &&
          Number(p.originalUnitPrice) > uPrice
        ) {
          rawDiscount = Math.max(
            0,
            Math.round((qty * Number(p.originalUnitPrice) - grossTotal) * 100) / 100
          );
        }

        const wh = findMatchingWarehouse(
          warehouseProducts,
          p.warehouseId,
          p.name
        );
        const pieces = convertToKanistrPieces(qty, p.unit || 'dona', wh);
        const bucket = classifyOilProduct(p.name, wh);

        deliveries.push({
          monthKey: itemMonth,
          productId: p.id,
          warehouseId: p.warehouseId,
          name: p.name,
          unit: p.unit || 'dona',
          qty,
          returnedQty: 0,
          pieces,
          unitPrice: uPrice,
          grossTotal,
          rawDiscount,
          bucket,
        });
      });
    }

    // Match returns chronologically to compute net sold kanistrs & return USD value
    const sortedDeliveries = [...deliveries].sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey)
    );

    returns.forEach((ret) => {
      const mEntry = ensureMonth(ret.monthKey);
      let rem = ret.qty;
      const retNameNorm = ret.name.trim().toLowerCase();

      const candidates = sortedDeliveries.filter((d) => {
        if (d.returnedQty >= d.qty) return false;
        if (ret.productId && d.productId && ret.productId === d.productId)
          return true;
        if (ret.warehouseId && d.warehouseId && ret.warehouseId === d.warehouseId)
          return true;
        return d.name.trim().toLowerCase() === retNameNorm;
      });

      let resolvedPrice = ret.unitPrice;
      for (const target of candidates) {
        if (rem <= 0) break;
        if (resolvedPrice <= 0 && target.unitPrice > 0) {
          resolvedPrice = target.unitPrice;
        }
        const avail = Math.max(0, target.qty - target.returnedQty);
        if (avail <= 0) continue;
        const matched = Math.min(avail, rem);
        target.returnedQty =
          Math.round((target.returnedQty + matched) * 100) / 100;
        rem = Math.round((rem - matched) * 100) / 100;
      }

      const retValue = Math.round(ret.qty * resolvedPrice * 100) / 100;
      mEntry.tovarQaytdi = Math.round((mEntry.tovarQaytdi + retValue) * 100) / 100;
    });

    // Aggregate deliveries per month
    deliveries.forEach((d) => {
      const mEntry = ensureMonth(d.monthKey);
      mEntry.tovarOlish =
        Math.round((mEntry.tovarOlish + d.grossTotal) * 100) / 100;

      const activeRatio =
        d.qty > 0 ? Math.max(0, d.qty - d.returnedQty) / d.qty : 0;
      const netBonus =
        Math.round(d.rawDiscount * activeRatio * 100) / 100;
      mEntry.bonus = Math.round((mEntry.bonus + netBonus) * 100) / 100;

      const netPieces = Math.round(d.pieces * activeRatio * 100) / 100;
      if (d.bucket === '10w40_sl_4l') {
        mEntry.oil10w40 = Math.round((mEntry.oil10w40 + netPieces) * 100) / 100;
      } else if (d.bucket === '5w30_sp_4l') {
        mEntry.oil5w30 = Math.round((mEntry.oil5w30 + netPieces) * 100) / 100;
      } else {
        mEntry.otherOils =
          Math.round((mEntry.otherOils + netPieces) * 100) / 100;
      }
    });

    // 2. Payments per month (from clientPlans + standalone client.logs)
    clientPlans.forEach((plan) => {
      const planDateKey =
        getClosedDateKey(plan) ||
        (plan as any).lastClosedDateKey ||
        getPlanDateKey(plan) ||
        toLocalYMD(plan.planDate || plan.createdAt);

      const hasTopLevelOps = Boolean(
        (plan.financialAction && plan.financialAction.amount > 0) ||
          (plan.deliveryPayment && plan.deliveryPayment.paidAmount > 0)
      );

      const planActions =
        plan.actionsHistory && plan.actionsHistory.length > 0
          ? plan.actionsHistory
          : hasTopLevelOps
          ? [
              {
                timestamp:
                  plan.lastExecutedAt ||
                  plan.completedAt ||
                  plan.closedAt ||
                  plan.createdAt,
                financialAction: plan.financialAction,
                deliveryPayment: plan.deliveryPayment,
              },
            ]
          : [];

      let anyActionHadDeliveryPay = false;

      planActions.forEach((act) => {
        const rawTs =
          act.timestamp ||
          plan.lastExecutedAt ||
          plan.completedAt ||
          plan.createdAt;
        const dateStr =
          planActions.length === 1 && planDateKey
            ? planDateKey
            : toLocalYMD(rawTs, planDateKey);
        const mk = dateStr.slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(mk)) return;

        const mEntry = ensureMonth(mk);

        if (act.financialAction) {
          const fin = act.financialAction;
          let amt = 0;
          if (Array.isArray(fin.splits) && fin.splits.length > 0) {
            const spSum = fin.splits.reduce(
              (s, sp) => s + (Number(sp.amount) || 0),
              0
            );
            amt = Number(fin.amount) > 0 ? Number(fin.amount) : spSum;
          } else {
            amt = Number(fin.amount) || 0;
          }
          if (amt > 0) {
            mEntry.tolov = Math.round((mEntry.tolov + amt) * 100) / 100;
          }
        }

        const dp =
          act.deliveryPayment ||
          (planActions.length === 1 ? plan.deliveryPayment : undefined);
        if (dp) {
          if (act.deliveryPayment) anyActionHadDeliveryPay = true;
          let paidAmt = 0;
          if (Array.isArray(dp.splits) && dp.splits.length > 0) {
            const spSum = dp.splits.reduce(
              (s, sp) => s + (Number(sp.amount) || 0),
              0
            );
            paidAmt = Number(dp.paidAmount) > 0 ? Number(dp.paidAmount) : spSum;
          } else {
            paidAmt = Number(dp.paidAmount) || 0;
          }
          if (paidAmt > 0) {
            mEntry.tolov = Math.round((mEntry.tolov + paidAmt) * 100) / 100;
          }
        }
      });

      if (
        planActions.length > 1 &&
        !anyActionHadDeliveryPay &&
        plan.deliveryPayment
      ) {
        const dp = plan.deliveryPayment;
        let paidAmt = 0;
        if (Array.isArray(dp.splits) && dp.splits.length > 0) {
          const spSum = dp.splits.reduce(
            (s, sp) => s + (Number(sp.amount) || 0),
            0
          );
          paidAmt = Number(dp.paidAmount) > 0 ? Number(dp.paidAmount) : spSum;
        } else {
          paidAmt = Number(dp.paidAmount) || 0;
        }
        const mk = planDateKey.slice(0, 7);
        if (paidAmt > 0 && /^\d{4}-\d{2}$/.test(mk)) {
          const mEntry = ensureMonth(mk);
          mEntry.tolov = Math.round((mEntry.tolov + paidAmt) * 100) / 100;
        }
      }
    });

    if (Array.isArray(client.logs)) {
      client.logs.forEach((log) => {
        if (
          log.type !== 'payment' ||
          String(log.id || '').endsWith('_fin') ||
          String(log.id || '').endsWith('_fin_edit') ||
          String(log.id || '').endsWith('_whdebt')
        ) {
          return;
        }
        const text = `${log.title || ''} ${log.details || ''}`.toLowerCase();
        if (
          text.includes("qarz qo'shildi") ||
          text.includes("qarzdorlik qo'shildi")
        )
          return;

        const amt = Math.round((Number(log.amountChanged) || 0) * 100) / 100;
        if (amt <= 0) return;

        const mk = toLocalYMD(log.timestamp).slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(mk)) {
          const mEntry = ensureMonth(mk);
          mEntry.tolov = Math.round((mEntry.tolov + amt) * 100) / 100;
        }
      });
    }

    const sortedActiveMonths = Array.from(activeMonthsSet).sort();
    const earliest =
      sortedActiveMonths[0] ||
      (client.createdAt
        ? toLocalYMD(client.createdAt).slice(0, 7)
        : `${currentYear}-01`);

    return {
      monthlyMetrics: metricsMap,
      availableYears: Array.from(yearsSet).sort((a, b) => b - a),
      earliestActiveMonthKey: earliest,
    };
  }, [client, clientPlans, warehouseProducts, currentYear]);

  // Helper: client debt/advance balance as of YYYY-MM-31
  const getEndOfMonthBalance = (monthKey: string) => {
    if (!client) return { status: 'empty' as const, debt: 0, advance: 0 };
    const currentMonthKey = getTodayYMD().slice(0, 7);
    if (monthKey > currentMonthKey) {
      return { status: 'future' as const, debt: 0, advance: 0 };
    }
    const mData = monthlyMetrics.get(monthKey);
    const hasActivity =
      Boolean(mData) &&
      (mData!.tovarOlish > 0 ||
        mData!.tolov > 0 ||
        mData!.tovarQaytdi > 0 ||
        mData!.bonus > 0);
    if (monthKey < earliestActiveMonthKey && !hasActivity) {
      return { status: 'before_start' as const, debt: 0, advance: 0 };
    }

    const cutoffDate = `${monthKey}-31`;
    let net =
      (Number(client.currentDebt) || 0) - (Number(client.currentAdvance) || 0);
    const logs = Array.isArray(client.logs) ? client.logs : [];

    logs.forEach((l) => {
      const dStr = toLocalYMD(l.timestamp);
      const amt = Number(l.amountChanged) || 0;
      if (!dStr || dStr <= cutoffDate || amt <= 0) return;

      if (l.type === 'product_added') {
        const isReturn =
          String(l.id || '').endsWith('_ret') ||
          (l.title || '').toLowerCase().includes('qaytarildi');
        const delta = isReturn ? -amt : amt;
        net = Math.round((net - delta) * 100) / 100;
      } else if (l.type === 'payment') {
        const text = `${l.title || ''} ${l.details || ''}`.toLowerCase();
        const isDebtAddition =
          text.includes("qarz qo'shildi") ||
          text.includes("qarzdorlik qo'shildi") ||
          String(l.id || '').endsWith('_whdebt');
        const delta = isDebtAddition ? amt : -amt;
        net = Math.round((net - delta) * 100) / 100;
      }
    });

    return {
      status: 'active' as const,
      debt: net > 0 ? Math.round(net * 100) / 100 : 0,
      advance: net < 0 ? Math.round(Math.abs(net) * 100) / 100 : 0,
    };
  };

  const handleFieldChange = (
    monthKey: string,
    field: keyof Omit<ClientMonthlyInfoEntry, 'updatedAt' | 'updatedBy'>,
    value: string
  ) => {
    setDraftMonthly((prev) => ({
      ...prev,
      [monthKey]: {
        ...(prev[monthKey] || {}),
        [field]: value,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUsername,
      },
    }));
    setIsDirty(true);
    setSavedToast(false);
  };

  const commitSave = (nextMap?: Record<string, ClientMonthlyInfoEntry>) => {
    if (!client || !isAdmin || !onSaveMonthlyDetails) return;
    const payload = nextMap || draftMonthly;
    onSaveMonthlyDetails(client.id, payload);
    setIsDirty(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const rowsForYear = useMemo(() => {
    return MONTH_NAMES.map((label, idx) => {
      const mNum = String(idx + 1).padStart(2, '0');
      const monthKey = `${selectedYear}-${mNum}`;
      const metrics = monthlyMetrics.get(monthKey) || {
        tovarOlish: 0,
        tolov: 0,
        tovarQaytdi: 0,
        bonus: 0,
        oil10w40: 0,
        oil5w30: 0,
        otherOils: 0,
      };
      const balance = getEndOfMonthBalance(monthKey);
      const manual = draftMonthly[monthKey] || {};
      return {
        monthKey,
        label,
        metrics,
        balance,
        manual,
      };
    });
  }, [selectedYear, monthlyMetrics, draftMonthly, client]);

  const yearTotals = useMemo(() => {
    let tovarOlish = 0;
    let tolov = 0;
    let tovarQaytdi = 0;
    let bonus = 0;
    let oil10w40 = 0;
    let oil5w30 = 0;
    let otherOils = 0;

    rowsForYear.forEach((r) => {
      tovarOlish = Math.round((tovarOlish + r.metrics.tovarOlish) * 100) / 100;
      tolov = Math.round((tolov + r.metrics.tolov) * 100) / 100;
      tovarQaytdi =
        Math.round((tovarQaytdi + r.metrics.tovarQaytdi) * 100) / 100;
      bonus = Math.round((bonus + r.metrics.bonus) * 100) / 100;
      oil10w40 = Math.round((oil10w40 + r.metrics.oil10w40) * 100) / 100;
      oil5w30 = Math.round((oil5w30 + r.metrics.oil5w30) * 100) / 100;
      otherOils = Math.round((otherOils + r.metrics.otherOils) * 100) / 100;
    });

    // Latest active balance in selectedYear
    const latestActive = [...rowsForYear]
      .reverse()
      .find((r) => r.balance.status === 'active');

    return {
      tovarOlish,
      tolov,
      tovarQaytdi,
      bonus,
      oil10w40,
      oil5w30,
      otherOils,
      endBalance: latestActive?.balance || null,
    };
  }, [rowsForYear]);

  if (!isOpen || !client) return null;

  const phoneDisplay =
    client.phones && client.phones.length > 0
      ? client.phones.join(', ')
      : client.phone || 'Kiritilmagan';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto"
      onClick={() => {
        if (isDirty && isAdmin) commitSave();
        onClose();
      }}
    >
      <div
        className="relative w-full max-w-[96vw] xl:max-w-[1440px] bg-white rounded-3xl shadow-2xl border border-neutral-200 my-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Bar */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-neutral-900 via-rose-950 to-neutral-900 text-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold font-display text-white truncate">
                  To&apos;liq ma&apos;lumot — {client.name}
                </h2>
                <p className="text-xs text-rose-200/80 truncate">
                  {client.clientCode ? `Klient kodi: ${client.clientCode} · ` : ''}
                  Mijoz pasporti va oylik aylanma hisob-kitob jadvali
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isDirty && isAdmin) commitSave();
              onClose();
            }}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* ========================================================= */}
          {/* 1. MIJOZNING TO'LIQ ANKETA MA'LUMOTLARI (11 TA MAYDON)    */}
          {/* ========================================================= */}
          <section className="rounded-2xl border border-rose-100 bg-rose-50/30 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-rose-100 pb-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2">
                <Building2 className="w-4 h-4 text-rose-700" />
                <span>Mijoz haqida to&apos;liq ma&apos;lumot</span>
              </h3>
              {client.businessType && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-700 text-white text-xs font-bold shadow-2xs">
                  {client.businessType}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-neutral-200/80">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase">
                  Klient kodi
                </div>
                <div className="text-sm font-bold text-neutral-900 font-mono mt-0.5">
                  {client.clientCode || (
                    <span className="text-neutral-400 font-sans font-normal">
                      Kiritilmagan
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-neutral-200/80">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase">
                  Mijoz ismi / Tashkilot nomi
                </div>
                <div className="text-sm font-bold text-neutral-900 mt-0.5">
                  {client.name}
                </div>
                {client.contactName && client.contactName !== client.name && (
                  <div className="text-[11px] text-neutral-600 mt-0.5">
                    Ismi: <span className="font-semibold">{client.contactName}</span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white border border-neutral-200/80">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase">
                  Do&apos;kon / Servis / Moy almashtirish turi
                </div>
                <div className="text-sm font-bold text-neutral-900 mt-0.5">
                  {client.businessType || (
                    <span className="text-neutral-400 font-normal">
                      Tanlanmagan
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-neutral-200/80">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                  <Phone className="w-3 h-3 text-rose-600" />
                  <span>Telefon raqami</span>
                </div>
                <div className="text-sm font-bold text-neutral-900 font-mono mt-0.5">
                  {phoneDisplay}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-neutral-200/80">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-600" />
                  <span>Mo&apos;ljal</span>
                </div>
                <div className="text-sm font-semibold text-neutral-900 mt-0.5">
                  {client.landmark || (
                    <span className="text-neutral-400 font-normal">
                      Kiritilmagan
                    </span>
                  )}
                </div>
                {(client.region || client.district) && (
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {[client.region, client.district].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white border border-neutral-200/80">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                  <Users className="w-3 h-3 text-rose-600" />
                  <span>Ishchilar soni</span>
                </div>
                <div className="text-sm font-bold text-neutral-900 mt-0.5">
                  {client.employeesCount || (
                    <span className="text-neutral-400 font-normal">
                      Kiritilmagan
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-neutral-200/80">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-rose-600" />
                  <span>Biz bilan ish boshlagan sanasi</span>
                </div>
                <div className="text-sm font-bold text-neutral-900 font-mono mt-0.5">
                  {client.workStartDate ? (
                    formatDateDMY(client.workStartDate)
                  ) : (
                    <span className="text-neutral-400 font-sans font-normal">
                      Kiritilmagan
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-neutral-200/80">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3 text-rose-600" />
                  <span>Dam olish kuni</span>
                </div>
                <div className="text-sm font-bold text-neutral-900 mt-0.5">
                  {client.dayOff || (
                    <span className="text-neutral-400 font-normal">
                      Kiritilmagan
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-neutral-200/80">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-rose-600" />
                  <span>Asosiy sotadigan moylari</span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-neutral-900 mt-0.5">
                  {client.mainOils || (
                    <span className="text-neutral-400 font-normal">
                      Kiritilmagan
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-neutral-200/80 sm:col-span-1 lg:col-span-2">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase">
                  Shogirtlar va hamkasblar haqida ma&apos;lumot
                </div>
                <div className="text-xs sm:text-sm font-medium text-neutral-900 mt-0.5 whitespace-pre-line">
                  {client.apprenticesInfo || (
                    <span className="text-neutral-400 font-normal">
                      Kiritilmagan
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-neutral-200/80">
                <div className="text-[10.5px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                  <Wrench className="w-3 h-3 text-rose-600" />
                  <span>Zapchast to&apos;g&apos;risida ma&apos;lumot</span>
                </div>
                <div className="text-xs sm:text-sm font-medium text-neutral-900 mt-0.5 whitespace-pre-line">
                  {client.sparePartsInfo || (
                    <span className="text-neutral-400 font-normal">
                      Kiritilmagan
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* 2. YILLIK VA OYLIK 15-USTUNLI HISOBOT JADVALI             */}
          {/* ========================================================= */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-rose-700" />
                  <span>Oylik savdo, to&apos;lov va moylar tahlil jadvali</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Tovar olish, to&apos;lov, tovar qaytdi, bonus, qoldiq hamda 10w40 SL 4L / 5w30 SP 4L / Boshqa moylar (kanistr donada) avtomatik shakllanadi.
                  {isAdmin
                    ? " Izoh, SL, SP, 5w40, Bo'sh va Qo'shimcha ma'lumotlar ustunlarini admin to'g'ridan-to'g'ri to'ldirishi mumkin."
                    : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Year selector */}
                <div className="inline-flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                  <span className="text-[11px] font-bold text-neutral-600 px-2">
                    Yil:
                  </span>
                  {availableYears.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setSelectedYear(y)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                        selectedYear === y
                          ? 'bg-rose-700 text-white shadow-2xs'
                          : 'text-neutral-700 hover:bg-white'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>

                {/* Admin Save Button */}
                {isAdmin && onSaveMonthlyDetails && (
                  <button
                    type="button"
                    onClick={() => commitSave()}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
                      isDirty
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                        : savedToast
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                    }`}
                  >
                    {savedToast ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Saqlandi</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>
                          {isDirty ? "O'zgarishlarni saqlash" : 'Saqlash'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-300 shadow-2xs">
              <StickyTableWrapper maxHeightClassName="max-h-[58vh]">
                <table className="w-full min-w-[1480px] text-left text-xs border-collapse">
                  <thead className="bg-neutral-900 text-white sticky top-0 z-20 text-[10.5px] uppercase font-bold">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-neutral-700 bg-rose-900 text-center min-w-[115px] sticky left-0 z-30">
                        <div className="text-[11px] font-extrabold text-amber-300 font-mono">
                          {selectedYear}-yil
                        </div>
                        <div className="text-[10px] text-white/90 font-semibold">
                          Oylar
                        </div>
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-300 bg-rose-50 text-black text-right min-w-[105px]">
                        Tovar olish
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-300 bg-rose-50 text-black text-right min-w-[105px]">
                        To&apos;lov
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-300 bg-rose-50 text-black text-right min-w-[105px]">
                        Tovar qaytdi
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-300 bg-rose-50 text-black text-right min-w-[95px]">
                        Bonus
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-700 bg-rose-50 text-black text-right min-w-[115px]">
                        Qoldiq
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-700 min-w-[155px] bg-neutral-800">
                        Izoh
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-700 text-center min-w-[105px] bg-sky-950">
                        <div>10w40 SL 4L</div>
                        <div className="text-[9px] text-sky-300 font-normal normal-case">
                          (kanistr dona)
                        </div>
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-700 text-center min-w-[105px] bg-sky-950">
                        <div>5w30 SP 4L</div>
                        <div className="text-[9px] text-sky-300 font-normal normal-case">
                          (kanistr dona)
                        </div>
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-700 text-center min-w-[105px] bg-sky-950">
                        <div>Boshqa moylar</div>
                        <div className="text-[9px] text-sky-300 font-normal normal-case">
                          (kanistr dona)
                        </div>
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-700 text-center min-w-[90px] bg-neutral-800">
                        SL
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-700 text-center min-w-[90px] bg-neutral-800">
                        SP
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-700 text-center min-w-[90px] bg-neutral-800">
                        5w40
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-neutral-700 text-center min-w-[90px] bg-neutral-800">
                        Bo&apos;sh
                      </th>
                      <th className="py-2.5 px-2.5 text-left min-w-[170px] bg-neutral-800">
                        Qo&apos;shimcha ma&apos;lumotlar
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {rowsForYear.map((row, idx) => {
                      const { monthKey, label, metrics, balance, manual } = row;
                      const currentMonthKey = getTodayYMD().slice(0, 7);
                      const isCurrentMonth = monthKey === currentMonthKey;

                      return (
                        <tr
                          key={monthKey}
                          className={`transition-colors ${
                            isCurrentMonth
                              ? 'bg-amber-50/40 hover:bg-amber-50/70'
                              : idx % 2 === 0
                              ? 'bg-white hover:bg-rose-50/30'
                              : 'bg-neutral-50/50 hover:bg-rose-50/30'
                          }`}
                        >
                          {/* 1. Yil / Oy */}
                          <td className="py-2 px-3 border-r border-neutral-200 font-bold text-neutral-900 sticky left-0 z-10 bg-inherit">
                            <div className="flex items-center justify-between gap-1.5">
                              <span>{label}</span>
                              {isCurrentMonth && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-bold border border-amber-300">
                                  Joriy
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Tovar olish */}
                          <td className="py-2 px-2.5 border-r border-neutral-200 text-right font-mono tabular-nums">
                            {metrics.tovarOlish > 0 ? (
                              <span className="font-bold text-neutral-900">
                                {formatMoney(metrics.tovarOlish)}
                              </span>
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </td>

                          {/* 3. To'lov */}
                          <td className="py-2 px-2.5 border-r border-neutral-200 text-right font-mono tabular-nums">
                            {metrics.tolov > 0 ? (
                              <span className="font-bold text-emerald-800">
                                {formatMoney(metrics.tolov)}
                              </span>
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </td>

                          {/* 4. Tovar qaytdi */}
                          <td className="py-2 px-2.5 border-r border-neutral-200 text-right font-mono tabular-nums">
                            {metrics.tovarQaytdi > 0 ? (
                              <span className="font-bold text-rose-700">
                                {formatMoney(metrics.tovarQaytdi)}
                              </span>
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </td>

                          {/* 5. Bonus */}
                          <td className="py-2 px-2.5 border-r border-neutral-200 text-right font-mono tabular-nums">
                            {metrics.bonus > 0 ? (
                              <span className="font-bold text-amber-800">
                                {formatMoney(metrics.bonus)}
                              </span>
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </td>

                          {/* 6. Qoldiq */}
                          <td className="py-2 px-2.5 border-r border-neutral-200 text-right font-mono tabular-nums whitespace-nowrap">
                            {balance.status === 'active' ? (
                              balance.debt > 0 ? (
                                <span className="font-bold text-rose-800">
                                  Qarz: {formatMoney(balance.debt)}
                                </span>
                              ) : balance.advance > 0 ? (
                                <span className="font-bold text-emerald-800">
                                  Haq: {formatMoney(balance.advance)}
                                </span>
                              ) : (
                                <span className="text-neutral-500 font-semibold">
                                  $0
                                </span>
                              )
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </td>

                          {/* 7. Izoh (Admin editable) */}
                          <td className="py-1.5 px-1.5 border-r border-neutral-200">
                            {isAdmin ? (
                              <input
                                type="text"
                                value={manual.izoh || ''}
                                onChange={(e) =>
                                  handleFieldChange(monthKey, 'izoh', e.target.value)
                                }
                                onBlur={() => {
                                  if (isDirty) commitSave();
                                }}
                                placeholder="Izoh..."
                                className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-neutral-300 focus:border-rose-500 focus:bg-white bg-neutral-50/70 text-xs text-neutral-900 outline-none transition"
                              />
                            ) : (
                              <span className="px-1 text-neutral-700">
                                {manual.izoh || <span className="text-neutral-300">—</span>}
                              </span>
                            )}
                          </td>

                          {/* 8. 10w40 SL 4L */}
                          <td className="py-2 px-2.5 border-r border-neutral-200 text-center font-mono tabular-nums bg-sky-50/30">
                            {metrics.oil10w40 > 0 ? (
                              <span className="font-extrabold text-sky-950">
                                {formatNumber(metrics.oil10w40)}
                              </span>
                            ) : (
                              <span className="text-neutral-300">0</span>
                            )}
                          </td>

                          {/* 9. 5w30 SP 4L */}
                          <td className="py-2 px-2.5 border-r border-neutral-200 text-center font-mono tabular-nums bg-sky-50/30">
                            {metrics.oil5w30 > 0 ? (
                              <span className="font-extrabold text-sky-950">
                                {formatNumber(metrics.oil5w30)}
                              </span>
                            ) : (
                              <span className="text-neutral-300">0</span>
                            )}
                          </td>

                          {/* 10. Boshqa moylar */}
                          <td className="py-2 px-2.5 border-r border-neutral-200 text-center font-mono tabular-nums bg-sky-50/30">
                            {metrics.otherOils > 0 ? (
                              <span className="font-extrabold text-sky-950">
                                {formatNumber(metrics.otherOils)}
                              </span>
                            ) : (
                              <span className="text-neutral-300">0</span>
                            )}
                          </td>

                          {/* 11. SL (Admin editable) */}
                          <td className="py-1.5 px-1.5 border-r border-neutral-200">
                            {isAdmin ? (
                              <input
                                type="text"
                                value={manual.sl || ''}
                                onChange={(e) =>
                                  handleFieldChange(monthKey, 'sl', e.target.value)
                                }
                                onBlur={() => {
                                  if (isDirty) commitSave();
                                }}
                                placeholder="—"
                                className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-neutral-300 focus:border-rose-500 focus:bg-white bg-neutral-50/70 text-xs text-center font-mono text-neutral-900 outline-none transition"
                              />
                            ) : (
                              <div className="text-center font-mono text-neutral-800">
                                {manual.sl || <span className="text-neutral-300">—</span>}
                              </div>
                            )}
                          </td>

                          {/* 12. SP (Admin editable) */}
                          <td className="py-1.5 px-1.5 border-r border-neutral-200">
                            {isAdmin ? (
                              <input
                                type="text"
                                value={manual.sp || ''}
                                onChange={(e) =>
                                  handleFieldChange(monthKey, 'sp', e.target.value)
                                }
                                onBlur={() => {
                                  if (isDirty) commitSave();
                                }}
                                placeholder="—"
                                className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-neutral-300 focus:border-rose-500 focus:bg-white bg-neutral-50/70 text-xs text-center font-mono text-neutral-900 outline-none transition"
                              />
                            ) : (
                              <div className="text-center font-mono text-neutral-800">
                                {manual.sp || <span className="text-neutral-300">—</span>}
                              </div>
                            )}
                          </td>

                          {/* 13. 5w40 (Admin editable) */}
                          <td className="py-1.5 px-1.5 border-r border-neutral-200">
                            {isAdmin ? (
                              <input
                                type="text"
                                value={manual.w540 || ''}
                                onChange={(e) =>
                                  handleFieldChange(monthKey, 'w540', e.target.value)
                                }
                                onBlur={() => {
                                  if (isDirty) commitSave();
                                }}
                                placeholder="—"
                                className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-neutral-300 focus:border-rose-500 focus:bg-white bg-neutral-50/70 text-xs text-center font-mono text-neutral-900 outline-none transition"
                              />
                            ) : (
                              <div className="text-center font-mono text-neutral-800">
                                {manual.w540 || <span className="text-neutral-300">—</span>}
                              </div>
                            )}
                          </td>

                          {/* 14. Bo'sh (Admin editable) */}
                          <td className="py-1.5 px-1.5 border-r border-neutral-200">
                            {isAdmin ? (
                              <input
                                type="text"
                                value={manual.emptyCol || ''}
                                onChange={(e) =>
                                  handleFieldChange(monthKey, 'emptyCol', e.target.value)
                                }
                                onBlur={() => {
                                  if (isDirty) commitSave();
                                }}
                                placeholder="—"
                                className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-neutral-300 focus:border-rose-500 focus:bg-white bg-neutral-50/70 text-xs text-center text-neutral-900 outline-none transition"
                              />
                            ) : (
                              <div className="text-center text-neutral-800">
                                {manual.emptyCol || <span className="text-neutral-300">—</span>}
                              </div>
                            )}
                          </td>

                          {/* 15. Qo'shimcha ma'lumotlar (Admin editable) */}
                          <td className="py-1.5 px-1.5">
                            {isAdmin ? (
                              <input
                                type="text"
                                value={manual.extraInfo || ''}
                                onChange={(e) =>
                                  handleFieldChange(monthKey, 'extraInfo', e.target.value)
                                }
                                onBlur={() => {
                                  if (isDirty) commitSave();
                                }}
                                placeholder="Qo'shimcha ma'lumot..."
                                className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-neutral-300 focus:border-rose-500 focus:bg-white bg-neutral-50/70 text-xs text-neutral-900 outline-none transition"
                              />
                            ) : (
                              <span className="px-1 text-neutral-700">
                                {manual.extraInfo || (
                                  <span className="text-neutral-300">—</span>
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot className="bg-neutral-100 border-t-2 border-neutral-300 font-bold text-xs sticky bottom-0 z-20">
                    <tr>
                      <td className="py-2.5 px-3 border-r border-neutral-300 text-neutral-900 uppercase sticky left-0 z-30 bg-neutral-100">
                        JAMI ({selectedYear})
                      </td>
                      <td className="py-2.5 px-2.5 border-r border-neutral-300 text-right font-mono text-neutral-950">
                        {formatMoney(yearTotals.tovarOlish)}
                      </td>
                      <td className="py-2.5 px-2.5 border-r border-neutral-300 text-right font-mono text-emerald-900">
                        {formatMoney(yearTotals.tolov)}
                      </td>
                      <td className="py-2.5 px-2.5 border-r border-neutral-300 text-right font-mono text-rose-800">
                        {formatMoney(yearTotals.tovarQaytdi)}
                      </td>
                      <td className="py-2.5 px-2.5 border-r border-neutral-300 text-right font-mono text-amber-900">
                        {formatMoney(yearTotals.bonus)}
                      </td>
                      <td className="py-2.5 px-2.5 border-r border-neutral-300 text-right font-mono whitespace-nowrap">
                        {yearTotals.endBalance ? (
                          yearTotals.endBalance.debt > 0 ? (
                            <span className="text-rose-900">
                              Qarz: {formatMoney(yearTotals.endBalance.debt)}
                            </span>
                          ) : yearTotals.endBalance.advance > 0 ? (
                            <span className="text-emerald-900">
                              Haq: {formatMoney(yearTotals.endBalance.advance)}
                            </span>
                          ) : (
                            '$0'
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 border-r border-neutral-300 text-center text-neutral-400">
                        —
                      </td>
                      <td className="py-2.5 px-2.5 border-r border-neutral-300 text-center font-mono text-sky-950 bg-sky-100/60">
                        {formatNumber(yearTotals.oil10w40)} ta
                      </td>
                      <td className="py-2.5 px-2.5 border-r border-neutral-300 text-center font-mono text-sky-950 bg-sky-100/60">
                        {formatNumber(yearTotals.oil5w30)} ta
                      </td>
                      <td className="py-2.5 px-2.5 border-r border-neutral-300 text-center font-mono text-sky-950 bg-sky-100/60">
                        {formatNumber(yearTotals.otherOils)} ta
                      </td>
                      <td colSpan={5} className="py-2.5 px-2.5 text-neutral-500 text-[11px] font-medium">
                        {isAdmin
                          ? "Admin tomonidan to'ldiriladigan ustunlar"
                          : "Faqat admin tahrirlay oladi"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </StickyTableWrapper>
            </div>
          </section>
        </div>

        {/* Bottom Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2.5">
          {isAdmin && onSaveMonthlyDetails && isDirty && (
            <button
              type="button"
              onClick={() => commitSave()}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Saqlash</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (isDirty && isAdmin) commitSave();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 transition min-h-[40px] cursor-pointer"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
