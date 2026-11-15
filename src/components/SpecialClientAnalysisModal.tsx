import React, { useState, useMemo, useEffect } from 'react';
import { Client, DailyPlanItem } from '../types';
import {
  formatMoney,
  formatDateDMY,
  formatNumber,
  getAgentDisplayName,
} from '../utils/format';
import {
  storageService,
  getPlanSoldProductsData,
  getPlanDateKey,
  getClosedDateKey,
} from '../services/storage';
import {
  X,
  Calendar,
  Package,
  CreditCard,
  RotateCcw,
  Receipt,
  BarChart3,
  PhoneCall,
} from 'lucide-react';
import { StickyTableWrapper } from './StickyTableWrapper';

interface SpecialClientAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  dailyPlans?: DailyPlanItem[];
}

const getTodayYMD = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getOffsetYMD = (daysOffset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getMonthStartYMD = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
};

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

const extractTimeHM = (raw?: string): string => {
  if (!raw || !raw.includes('T')) return '';
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return raw.slice(11, 16);
};

interface DayProductRow {
  id: string;
  eventType: 'delivered' | 'partial_returned' | 'returned';
  date: string;
  planDate: string;
  author: string;
  productName: string;
  unit: string;
  quantity: number;
  returnedQuantity: number;
  returnDates: string[];
  unitPrice: number;
  totalPrice: number;
  paymentLabel: string;
  creditRatio: number;
  paidRatio: number;
  note?: string;
}

interface PaymentRecordRow {
  id: string;
  date: string;
  timeStr: string;
  sortKey: string;
  author: string;
  category: 'product' | 'simple';
  amountUsd: number;
  methodLabel: string;
  details: string;
}

interface ActionAnalysisRow {
  id: string;
  date: string;
  timeStr: string;
  sortKey: string;
  author: string;
  actionType: 'joyiga borildi' | 'telefon qilindi' | 'telefon qilindi + joyiga borildi' | 'planned';
  actionLabel: string;
  status: 'bajarilgan' | 'bajarilmagan';
  isClosedWithoutAction?: boolean;
  productReceiptUsd: number;
  productMethodLabel: string;
  simpleReceiptUsd: number;
  simpleMethodLabel: string;
  totalReceiptUsd: number;
  note: string;
}

export const SpecialClientAnalysisModal: React.FC<SpecialClientAnalysisModalProps> = ({
  isOpen,
  onClose,
  client,
  dailyPlans,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayYMD);
  const [payStartDate, setPayStartDate] = useState<string>('');
  const [payEndDate, setPayEndDate] = useState<string>('');
  const [activePayPreset, setActivePayPreset] = useState<
    'all' | 'today' | 'last7' | 'thisMonth' | 'custom'
  >('all');
  const [actStartDate, setActStartDate] = useState<string>('');
  const [actEndDate, setActEndDate] = useState<string>('');
  const [activeActPreset, setActiveActPreset] = useState<
    'all' | 'today' | 'last7' | 'thisMonth' | 'custom'
  >('all');

  useEffect(() => {
    if (isOpen) {
      setSelectedDate(getTodayYMD());
      setPayStartDate('');
      setPayEndDate('');
      setActivePayPreset('all');
      setActStartDate('');
      setActEndDate('');
      setActiveActPreset('all');
    }
  }, [isOpen, client?.id]);

  // Deduplicated plans for this client
  const clientPlans = useMemo(() => {
    if (!client) return [];
    try {
      const sourcePlans =
        dailyPlans && dailyPlans.length > 0 ? dailyPlans : storageService.getDailyPlans();
      const rawClientPlans = sourcePlans.filter(
        (p) =>
          p &&
          (p.clientId === client.id ||
            ((p.clientName || '').trim().toLowerCase() === client.name.trim().toLowerCase() &&
              (p.clientPhone || '').replace(/\D/g, '') === (client.phone || '').replace(/\D/g, '')))
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
    } catch {
      return [];
    }
  }, [client, dailyPlans]);

  // 1. Historical balance (debt / advance) as of selectedDate
  const balanceOnSelectedDate = useMemo(() => {
    if (!client) return { debt: 0, advance: 0 };
    const targetDate = selectedDate || getTodayYMD();

    let net = (Number(client.currentDebt) || 0) - (Number(client.currentAdvance) || 0);
    const logs = Array.isArray(client.logs) ? client.logs : [];

    logs.forEach((l) => {
      const dStr = toLocalYMD(l.timestamp);
      const amt = Number(l.amountChanged) || 0;
      if (!dStr || dStr <= targetDate || amt <= 0) return;

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
      debt: net > 0 ? Math.round(net * 100) / 100 : 0,
      advance: net < 0 ? Math.round(Math.abs(net) * 100) / 100 : 0,
    };
  }, [client, selectedDate]);

  // 2. Delivered and returned products for selectedDate
  const { dayRows, daySummary } = useMemo(() => {
    if (!client || !selectedDate) {
      return {
        dayRows: [] as DayProductRow[],
        daySummary: {
          totalValue: 0,
          creditValue: 0,
          nonCreditValue: 0,
          deliveredQty: 0,
          returnedValue: 0,
          returnedQty: 0,
        },
      };
    }

    const allDeliveries: DayProductRow[] = [];
    const coveredProductIds = new Set<string>();
    const coveredWarehouseIds = new Set<string>();
    const coveredProductNames = new Set<string>();

    interface ReturnEvent {
      id: string;
      planDate: string;
      returnDate: string;
      author: string;
      productId?: string;
      warehouseId?: string;
      name: string;
      unit: string;
      quantity: number;
      unitPrice: number;
    }

    const returnEvents: ReturnEvent[] = [];
    const cancelledOnSelectedDate: DayProductRow[] = [];

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

      const author =
        plan.lastExecutedBy ||
        plan.actionsHistory?.[0]?.author ||
        plan.agentUsername ||
        'agentp1';

      const dp = soldData.deliveryPayment || plan.deliveryPayment;
      const pType = dp?.paymentType || 'qarzga';
      const batchTotal = prods.reduce(
        (s, item) =>
          s +
          (item.totalPrice !== undefined && item.totalPrice >= 0
            ? Number(item.totalPrice)
            : (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
        0
      );

      let creditRatio = 0;
      let paidRatio = 1;
      if (!dp || pType === 'qarzga') {
        creditRatio = 1;
        paidRatio = 0;
      } else if (dp.paidAmount !== undefined || dp.debtAmount !== undefined) {
        const paid = Math.max(0, Number(dp.paidAmount) || 0);
        const debt =
          dp.debtAmount !== undefined
            ? Math.max(0, Number(dp.debtAmount) || 0)
            : Math.max(0, batchTotal - paid);
        const denom = paid + debt > 0 ? paid + debt : batchTotal;
        paidRatio = denom > 0 ? Math.min(1, paid / denom) : 1;
        creditRatio = Math.max(0, 1 - paidRatio);
      } else {
        paidRatio = 1;
        creditRatio = 0;
      }

      const isPartialCredit = creditRatio > 0.001 && creditRatio <= 0.999;
      const isCredit = creditRatio > 0.999;
      const pLabel = isPartialCredit ? 'Qisman qarzga' : isCredit ? 'Qarzga' : 'Naqdga';

      prods.forEach((p, pIdx) => {
        if (p.id) coveredProductIds.add(p.id);
        if (p.warehouseId) coveredWarehouseIds.add(p.warehouseId);
        coveredProductNames.add(p.name.trim().toLowerCase());

        const u = !p.unit || p.unit.toLowerCase() === 'birlik' ? 'dona' : p.unit;
        const qty = Number(p.quantity) || 0;
        const uPrice = Number(p.unitPrice) || 0;
        const tPrice =
          p.totalPrice !== undefined && p.totalPrice >= 0
            ? Number(p.totalPrice)
            : Math.round(qty * uPrice * 100) / 100;
        const itemDate = ((p as any).date ? toLocalYMD(String((p as any).date)) : '') || planDateKey;

        allDeliveries.push({
          id: `${plan.id}_del_${pIdx}_${p.id || p.name}`,
          eventType: 'delivered',
          date: itemDate,
          planDate: planDateKey,
          author,
          productName: p.name,
          unit: u,
          quantity: qty,
          returnedQuantity: 0,
          returnDates: [],
          unitPrice: uPrice,
          totalPrice: tPrice,
          paymentLabel: pLabel,
          creditRatio,
          paidRatio,
        });
      });

      // Cancelled products on selectedDate
      const cancelledList: any[] = Array.isArray((plan as any).cancelledProducts)
        ? (plan as any).cancelledProducts
        : [];
      cancelledList.forEach((cp, cIdx) => {
        if (!cp || !(cp.name || '').trim()) return;
        const cNameNorm = cp.name.trim().toLowerCase();
        const stillSameInActive = prods.some(
          (ap) =>
            ap.name.trim().toLowerCase() === cNameNorm &&
            Number(ap.quantity) >= Number(cp.quantity)
        );
        if (stillSameInActive) return;

        const cancelledDate = toLocalYMD(cp.cancelledAt || planDateKey, planDateKey);
        if (cancelledDate === selectedDate || planDateKey === selectedDate) {
          const u = !cp.unit || cp.unit.toLowerCase() === 'birlik' ? 'dona' : cp.unit;
          const qty = Number(cp.quantity) || 0;
          const uPrice = Number(cp.unitPrice) || 0;
          const tPrice =
            cp.totalPrice !== undefined ? Number(cp.totalPrice) : Math.round(qty * uPrice * 100) / 100;

          cancelledOnSelectedDate.push({
            id: `${plan.id}_canc_${cIdx}_${cp.id || cp.name}`,
            eventType: 'returned',
            date: cancelledDate,
            planDate: planDateKey,
            author: cp.cancelledBy || author,
            productName: cp.name,
            unit: u,
            quantity: qty,
            returnedQuantity: qty,
            returnDates: [cancelledDate],
            unitPrice: uPrice,
            totalPrice: tPrice,
            paymentLabel: 'Qaytarilgan',
            creditRatio: 0,
            paidRatio: 0,
            note: 'Bekor qilingan / omborga qaytarilgan',
          });
        }
      });

      // Returns from this plan
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

      planRets.forEach((r, rIdx) => {
        if (!r || !(r.name || '').trim() || (Number(r.quantity) || 0) <= 0) return;
        const retDate = toLocalYMD(r.returnedAt || planDateKey, planDateKey);
        coveredProductNames.add(r.name.trim().toLowerCase());
        if (r.productId) coveredProductIds.add(r.productId);
        if (r.warehouseId) coveredWarehouseIds.add(r.warehouseId);

        returnEvents.push({
          id: `${plan.id}_ret_${rIdx}_${r.productId || r.name}`,
          planDate: planDateKey,
          returnDate: retDate,
          author: r.author || author,
          productId: r.productId,
          warehouseId: r.warehouseId,
          name: r.name,
          unit: !r.unit || r.unit.toLowerCase() === 'birlik' ? 'dona' : r.unit,
          quantity: Number(r.quantity) || 0,
          unitPrice: Number(r.unitPrice) || 0,
        });
      });
    });

    // Fallback initial products on client not covered by plans
    if (client.products && client.products.length > 0) {
      const fallbackDate = toLocalYMD(client.createdAt || client.updatedAt);
      const fallbackAuthor = client.createdBy || 'adminc';
      const isCredit = (client.currentDebt || 0) > 0;
      const pLabel = isCredit ? 'Qarzga' : 'Naqdga';

      client.products.forEach((p, pIdx) => {
        if (!p || !(p.name || '').trim()) return;
        const normName = p.name.trim().toLowerCase();
        if (p.id && coveredProductIds.has(p.id)) return;
        if (p.warehouseId && coveredWarehouseIds.has(p.warehouseId)) return;
        if (coveredProductNames.has(normName)) return;

        const qty = Number(p.quantity) || 0;
        if (qty <= 0) return;
        const u = !p.unit || p.unit.toLowerCase() === 'birlik' ? 'dona' : p.unit;
        const uPrice = Number(p.unitPrice) || 0;
        const tPrice = Number(p.totalPrice) || Math.round(qty * uPrice * 100) / 100;
        const itemDate = ((p as any).date ? toLocalYMD(String((p as any).date)) : '') || fallbackDate;

        allDeliveries.push({
          id: `cp_${p.id || pIdx}_${p.name}`,
          eventType: 'delivered',
          date: itemDate,
          planDate: itemDate,
          author: fallbackAuthor,
          productName: p.name,
          unit: u,
          quantity: qty,
          returnedQuantity: 0,
          returnDates: [],
          unitPrice: uPrice,
          totalPrice: tPrice,
          paymentLabel: pLabel,
          creditRatio: isCredit ? 1 : 0,
          paidRatio: isCredit ? 0 : 1,
        });
      });
    }

    // Match return events against deliveries chronologically
    const chronologicalDeliveries = [...allDeliveries].sort((a, b) =>
      (a.date || '').localeCompare(b.date || '')
    );

    const extraReturnRowsForSelectedDate: DayProductRow[] = [];

    returnEvents.forEach((ret) => {
      let remToMatch = ret.quantity;
      const retNameClean = ret.name.trim().toLowerCase();

      const candidates = chronologicalDeliveries.filter((row) => {
        if (row.returnedQuantity >= row.quantity) return false;
        return row.productName.trim().toLowerCase() === retNameClean;
      });

      let matchedOnSelectedDateDelivery = false;

      for (const targetRow of candidates) {
        if (remToMatch <= 0) break;
        const available = Math.max(0, targetRow.quantity - targetRow.returnedQuantity);
        if (available <= 0) continue;
        const matched = Math.min(available, remToMatch);
        targetRow.returnedQuantity = Math.round((targetRow.returnedQuantity + matched) * 100) / 100;
        remToMatch = Math.round((remToMatch - matched) * 100) / 100;
        if (!targetRow.returnDates.includes(ret.returnDate)) {
          targetRow.returnDates.push(ret.returnDate);
        }
        if (targetRow.returnedQuantity >= targetRow.quantity) {
          targetRow.eventType = 'returned';
        } else if (targetRow.returnedQuantity > 0) {
          targetRow.eventType = 'partial_returned';
        }
        if (targetRow.date === selectedDate) {
          matchedOnSelectedDateDelivery = true;
        }
      }

      // If this return happened ON selectedDate from an older delivery (or unmatched), show it explicitly
      if (ret.returnDate === selectedDate && (!matchedOnSelectedDateDelivery || remToMatch > 0)) {
        const displayQty = !matchedOnSelectedDateDelivery ? ret.quantity : remToMatch;
        if (displayQty > 0) {
          extraReturnRowsForSelectedDate.push({
            id: `${ret.id}_dayret`,
            eventType: 'returned',
            date: ret.returnDate,
            planDate: ret.planDate,
            author: ret.author,
            productName: ret.name,
            unit: ret.unit,
            quantity: displayQty,
            returnedQuantity: displayQty,
            returnDates: [ret.returnDate],
            unitPrice: ret.unitPrice,
            totalPrice: Math.round(displayQty * ret.unitPrice * 100) / 100,
            paymentLabel: 'Qaytarilgan',
            creditRatio: 0,
            paidRatio: 0,
            note: 'Oldingi yetkazmadan qaytarilgan',
          });
        }
      }
    });

    const selectedDayDeliveries = allDeliveries.filter((d) => d.date === selectedDate);

    let totalValue = 0;
    let creditValue = 0;
    let nonCreditValue = 0;
    let deliveredQty = 0;
    let returnedValue = 0;
    let returnedQty = 0;

    selectedDayDeliveries.forEach((row) => {
      if (row.eventType === 'returned') {
        returnedValue = Math.round((returnedValue + row.totalPrice) * 100) / 100;
        returnedQty = Math.round((returnedQty + row.quantity) * 100) / 100;
        return;
      }
      const activeQty =
        row.eventType === 'partial_returned'
          ? Math.max(0, row.quantity - row.returnedQuantity)
          : row.quantity;
      const activeSum =
        row.eventType === 'partial_returned'
          ? Math.round(activeQty * row.unitPrice * 100) / 100
          : row.totalPrice;

      if (row.eventType === 'partial_returned') {
        returnedQty = Math.round((returnedQty + row.returnedQuantity) * 100) / 100;
        returnedValue =
          Math.round((returnedValue + row.returnedQuantity * row.unitPrice) * 100) / 100;
      }

      const rowCredit = Math.round(activeSum * row.creditRatio * 100) / 100;
      const rowNonCredit = Math.max(0, Math.round((activeSum - rowCredit) * 100) / 100);

      totalValue = Math.round((totalValue + activeSum) * 100) / 100;
      creditValue = Math.round((creditValue + rowCredit) * 100) / 100;
      nonCreditValue = Math.round((nonCreditValue + rowNonCredit) * 100) / 100;
      deliveredQty = Math.round((deliveredQty + activeQty) * 100) / 100;
    });

    [...extraReturnRowsForSelectedDate, ...cancelledOnSelectedDate].forEach((r) => {
      returnedQty = Math.round((returnedQty + r.quantity) * 100) / 100;
      returnedValue = Math.round((returnedValue + r.totalPrice) * 100) / 100;
    });

    const combinedRows = [
      ...selectedDayDeliveries,
      ...extraReturnRowsForSelectedDate,
      ...cancelledOnSelectedDate,
    ];

    return {
      dayRows: combinedRows,
      daySummary: {
        totalValue,
        creditValue,
        nonCreditValue,
        deliveredQty,
        returnedValue,
        returnedQty,
      },
    };
  }, [client, clientPlans, selectedDate]);

  // 3. All payment records (both "Mahsulot uchun" and "Shunchaki to'lov") without double-counting
  const allPayments = useMemo(() => {
    if (!client) return [] as PaymentRecordRow[];
    const records: PaymentRecordRow[] = [];

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
                  plan.lastExecutedAt || plan.completedAt || plan.closedAt || plan.createdAt,
                author: plan.lastExecutedBy || plan.closedBy || plan.agentUsername || 'agentp1',
                actionDone: plan.actionDone || ('joyiga borildi' as const),
                financialAction: plan.financialAction,
                deliveryPayment: plan.deliveryPayment,
                productsDelivered: plan.productsDelivered,
                reportNote: plan.reportNote,
              },
            ]
          : [];

      let anyActionHadDeliveryPay = false;

      planActions.forEach((act, actIdx) => {
        const rawTs = act.timestamp || plan.lastExecutedAt || plan.completedAt || plan.createdAt;
        const dateStr =
          planActions.length === 1 && planDateKey
            ? planDateKey
            : toLocalYMD(rawTs, planDateKey);
        const timeStr = extractTimeHM(rawTs);
        const author = act.author || plan.lastExecutedBy || plan.agentUsername || 'agentp1';

        // Shunchaki to'lov (financialAction)
        const fin = act.financialAction;
        if (fin) {
          let simpleAmt = 0;
          let methodLabel = '';
          if (Array.isArray(fin.splits) && fin.splits.length > 0) {
            const splitSum = fin.splits.reduce((s, sp) => s + (Number(sp.amount) || 0), 0);
            simpleAmt =
              Math.round((Number(fin.amount) > 0 ? Number(fin.amount) : splitSum) * 100) / 100;
            methodLabel = fin.splits
              .filter((sp) => (Number(sp.amount) || 0) > 0)
              .map((sp) => `${sp.methodLabel || sp.method}: ${formatMoney(sp.amount)}`)
              .join(', ');
          } else if ((Number(fin.amount) || 0) > 0) {
            simpleAmt = Math.round(Number(fin.amount) * 100) / 100;
            methodLabel = fin.methodLabel || fin.method || 'Naqd';
          }

          if (simpleAmt > 0) {
            records.push({
              id: `fin_${plan.id}_${actIdx}`,
              date: dateStr,
              timeStr,
              sortKey: `${dateStr}T${timeStr || '00:00'}`,
              author,
              category: 'simple',
              amountUsd: simpleAmt,
              methodLabel,
              details: fin.note?.trim() || act.reportNote?.trim() || "Qarz / avans uchun shunchaki to'lov",
            });
          }
        }

        // Mahsulot uchun to'lov (deliveryPayment)
        const dp =
          act.deliveryPayment || (planActions.length === 1 ? plan.deliveryPayment : undefined);
        if (dp) {
          if (act.deliveryPayment) anyActionHadDeliveryPay = true;
          let prodPaid = 0;
          let prodMethod = '';
          if (Array.isArray(dp.splits) && dp.splits.length > 0) {
            const splitSum = dp.splits.reduce((s, sp) => s + (Number(sp.amount) || 0), 0);
            prodPaid =
              Math.round((Number(dp.paidAmount) > 0 ? Number(dp.paidAmount) : splitSum) * 100) / 100;
            prodMethod = dp.splits
              .filter((sp) => (Number(sp.amount) || 0) > 0)
              .map((sp) => `${sp.methodLabel || sp.method}: ${formatMoney(sp.amount)}`)
              .join(', ');
          } else if ((Number(dp.paidAmount) || 0) > 0) {
            prodPaid = Math.round(Number(dp.paidAmount) * 100) / 100;
            prodMethod = dp.paymentLabel || dp.paymentType || 'Naqd';
          }

          if (prodPaid > 0) {
            const prodNames = (act.productsDelivered || plan.productsDelivered || [])
              .filter((p) => p && (p.name || '').trim())
              .map((p) => `${p.name} (${formatNumber(p.quantity)} ${p.unit || 'dona'})`)
              .join(', ');
            records.push({
              id: `dp_${plan.id}_${actIdx}`,
              date: dateStr,
              timeStr,
              sortKey: `${dateStr}T${timeStr || '00:00'}`,
              author,
              category: 'product',
              amountUsd: prodPaid,
              methodLabel: prodMethod,
              details: prodNames || "Topshirilgan mahsulotlar uchun to'lov",
            });
          }
        }
      });

      // Fallback if multiple actionsHistory exist but deliveryPayment was saved only at plan level
      if (planActions.length > 1 && !anyActionHadDeliveryPay && plan.deliveryPayment) {
        const dp = plan.deliveryPayment;
        let prodPaid = 0;
        let prodMethod = '';
        if (Array.isArray(dp.splits) && dp.splits.length > 0) {
          const splitSum = dp.splits.reduce((s, sp) => s + (Number(sp.amount) || 0), 0);
          prodPaid =
            Math.round((Number(dp.paidAmount) > 0 ? Number(dp.paidAmount) : splitSum) * 100) / 100;
          prodMethod = dp.splits
            .filter((sp) => (Number(sp.amount) || 0) > 0)
            .map((sp) => `${sp.methodLabel || sp.method}: ${formatMoney(sp.amount)}`)
            .join(', ');
        } else if ((Number(dp.paidAmount) || 0) > 0) {
          prodPaid = Math.round(Number(dp.paidAmount) * 100) / 100;
          prodMethod = dp.paymentLabel || dp.paymentType || 'Naqd';
        }

        if (prodPaid > 0) {
          const rawTs = plan.lastExecutedAt || plan.completedAt || plan.closedAt || plan.createdAt;
          const timeStr = extractTimeHM(rawTs);
          const prodNames = (plan.productsDelivered || [])
            .filter((p) => p && (p.name || '').trim())
            .map((p) => `${p.name} (${formatNumber(p.quantity)} ${p.unit || 'dona'})`)
            .join(', ');
          records.push({
            id: `dp_top_${plan.id}`,
            date: planDateKey,
            timeStr,
            sortKey: `${planDateKey}T${timeStr || '00:00'}`,
            author: plan.lastExecutedBy || plan.agentUsername || 'agentp1',
            category: 'product',
            amountUsd: prodPaid,
            methodLabel: prodMethod,
            details: prodNames || "Topshirilgan mahsulotlar uchun to'lov",
          });
        }
      }
    });

    // Standalone payment logs from client.logs (excluding _fin, _fin_edit, _whdebt & debt additions)
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
        if (text.includes("qarz qo'shildi") || text.includes("qarzdorlik qo'shildi")) return;

        const amt = Math.round((Number(log.amountChanged) || 0) * 100) / 100;
        if (amt <= 0) return;

        const dateStr = toLocalYMD(log.timestamp);
        const timeStr = extractTimeHM(log.timestamp);
        const isProductPurpose = log.purpose === 'product';

        records.push({
          id: `log_pay_${log.id}`,
          date: dateStr,
          timeStr,
          sortKey: `${dateStr}T${timeStr || '00:00'}`,
          author: log.author || 'adminc',
          category: isProductPurpose ? 'product' : 'simple',
          amountUsd: amt,
          methodLabel:
            log.paymentMethodLabel || (isProductPurpose ? 'Mahsulotga' : "To'lov"),
          details: log.details || log.title || '',
        });
      });
    }

    records.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return records;
  }, [client, clientPlans]);

  const filteredPayments = useMemo(() => {
    return allPayments.filter((p) => {
      if (payStartDate && p.date < payStartDate) return false;
      if (payEndDate && p.date > payEndDate) return false;
      return true;
    });
  }, [allPayments, payStartDate, payEndDate]);

  const paymentsSummary = useMemo(() => {
    let totalPaid = 0;
    let productPaid = 0;
    let simplePaid = 0;
    let productCount = 0;
    let simpleCount = 0;

    filteredPayments.forEach((p) => {
      totalPaid = Math.round((totalPaid + p.amountUsd) * 100) / 100;
      if (p.category === 'product') {
        productPaid = Math.round((productPaid + p.amountUsd) * 100) / 100;
        productCount++;
      } else {
        simplePaid = Math.round((simplePaid + p.amountUsd) * 100) / 100;
        simpleCount++;
      }
    });

    return { totalPaid, productPaid, simplePaid, productCount, simpleCount };
  }, [filteredPayments]);

  const handlePayPreset = (preset: 'all' | 'today' | 'last7' | 'thisMonth') => {
    setActivePayPreset(preset);
    const today = getTodayYMD();
    if (preset === 'all') {
      setPayStartDate('');
      setPayEndDate('');
    } else if (preset === 'today') {
      setPayStartDate(today);
      setPayEndDate(today);
    } else if (preset === 'last7') {
      setPayStartDate(getOffsetYMD(-7));
      setPayEndDate(today);
    } else if (preset === 'thisMonth') {
      setPayStartDate(getMonthStartYMD());
      setPayEndDate(today);
    }
  };

  // 4. All agent plan actions (executed & unexecuted) for Section 3
  const allAgentPlanActions = useMemo(() => {
    if (!client) return [] as ActionAnalysisRow[];
    const rows: ActionAnalysisRow[] = [];

    const getActionLabel = (actType?: string): string => {
      if (actType === 'telefon qilindi') return 'Telefon qilish';
      if (actType === 'joyiga borildi') return 'Joyiga borish';
      if (actType === 'telefon qilindi + joyiga borildi') return 'Joyiga borish + Telefon qilish';
      return 'Rejalashtirilgan';
    };

    const normalizeActionType = (
      actType?: string
    ): 'joyiga borildi' | 'telefon qilindi' | 'telefon qilindi + joyiga borildi' | 'planned' => {
      if (
        actType === 'joyiga borildi' ||
        actType === 'telefon qilindi' ||
        actType === 'telefon qilindi + joyiga borildi'
      ) {
        return actType;
      }
      return 'planned';
    };

    clientPlans.forEach((plan) => {
      const planDateKey =
        getClosedDateKey(plan) ||
        (plan as any).lastClosedDateKey ||
        getPlanDateKey(plan) ||
        toLocalYMD(plan.planDate || plan.createdAt);

      const hasTopLevelOps = Boolean(
        plan.actionDone ||
          (plan.financialAction && plan.financialAction.amount > 0) ||
          (plan.productsDelivered && plan.productsDelivered.length > 0) ||
          (plan.deliveryPayment && plan.deliveryPayment.paidAmount > 0) ||
          (plan.productsReturned && plan.productsReturned.length > 0)
      );

      const hasActionsHistory = Boolean(plan.actionsHistory && plan.actionsHistory.length > 0);

      if (hasActionsHistory || (hasTopLevelOps && !plan.closedWithoutAction)) {
        const planActions = hasActionsHistory
          ? plan.actionsHistory!
          : [
              {
                timestamp:
                  plan.lastExecutedAt || plan.completedAt || plan.closedAt || plan.createdAt,
                author: plan.lastExecutedBy || plan.closedBy || plan.agentUsername || 'agentp1',
                actionDone: plan.actionDone || ('joyiga borildi' as const),
                financialAction: plan.financialAction,
                deliveryPayment: plan.deliveryPayment,
                productsDelivered: plan.productsDelivered,
                reportNote: plan.reportNote,
              },
            ];

        const anyActHasDeliveryPay = planActions.some((a) => Boolean(a.deliveryPayment));

        planActions.forEach((act, actIdx) => {
          const rawTs = act.timestamp || plan.lastExecutedAt || plan.completedAt || plan.createdAt;
          const dateStr =
            planActions.length === 1 && planDateKey
              ? planDateKey
              : toLocalYMD(rawTs, planDateKey);
          const timeStr = extractTimeHM(rawTs);
          const author = act.author || plan.lastExecutedBy || plan.agentUsername || 'agentp1';
          const actType = normalizeActionType(act.actionDone || plan.actionDone || 'joyiga borildi');

          let simpleReceiptUsd = 0;
          let simpleMethodLabel = '';
          const fin = act.financialAction;
          if (fin) {
            if (Array.isArray(fin.splits) && fin.splits.length > 0) {
              const splitSum = fin.splits.reduce((s, sp) => s + (Number(sp.amount) || 0), 0);
              simpleReceiptUsd =
                Math.round((Number(fin.amount) > 0 ? Number(fin.amount) : splitSum) * 100) / 100;
              simpleMethodLabel = fin.splits
                .filter((sp) => (Number(sp.amount) || 0) > 0)
                .map((sp) => `${sp.methodLabel || sp.method}: ${formatMoney(sp.amount)}`)
                .join(', ');
            } else if ((Number(fin.amount) || 0) > 0) {
              simpleReceiptUsd = Math.round(Number(fin.amount) * 100) / 100;
              simpleMethodLabel = fin.methodLabel || fin.method || 'Naqd';
            }
          }

          let productReceiptUsd = 0;
          let productMethodLabel = '';
          const dp =
            act.deliveryPayment ||
            (!anyActHasDeliveryPay && actIdx === planActions.length - 1
              ? plan.deliveryPayment
              : undefined);
          if (dp) {
            if (Array.isArray(dp.splits) && dp.splits.length > 0) {
              const splitSum = dp.splits.reduce((s, sp) => s + (Number(sp.amount) || 0), 0);
              productReceiptUsd =
                Math.round((Number(dp.paidAmount) > 0 ? Number(dp.paidAmount) : splitSum) * 100) /
                100;
              productMethodLabel = dp.splits
                .filter((sp) => (Number(sp.amount) || 0) > 0)
                .map((sp) => `${sp.methodLabel || sp.method}: ${formatMoney(sp.amount)}`)
                .join(', ');
            } else if ((Number(dp.paidAmount) || 0) > 0) {
              productReceiptUsd = Math.round(Number(dp.paidAmount) * 100) / 100;
              productMethodLabel = dp.paymentLabel || dp.paymentType || 'Naqd';
            }
          }

          const totalReceiptUsd = Math.round((productReceiptUsd + simpleReceiptUsd) * 100) / 100;

          const noteParts: string[] = [];
          const rawActNote = (
            act.reportNote ||
            (planActions.length === 1 ? plan.reportNote : '') ||
            ''
          ).trim();
          if (rawActNote) noteParts.push(rawActNote);
          if (fin?.note && fin.note.trim() && fin.note.trim() !== rawActNote) {
            noteParts.push(fin.note.trim());
          }
          if (planActions.length === 1 && plan.planNote && plan.planNote.trim() && !noteParts.includes(plan.planNote.trim())) {
            noteParts.push(`Reja izohi: ${plan.planNote.trim()}`);
          }
          if (plan.isClosed && plan.closeReason && plan.closeReason.trim()) {
            const cr = plan.closeReason.trim();
            if (!noteParts.includes(cr)) {
              noteParts.push(`Yopilish: ${cr}`);
            }
          }

          rows.push({
            id: `plan_act_${plan.id}_${actIdx}`,
            date: dateStr,
            timeStr,
            sortKey: `${dateStr}T${timeStr || '00:00'}`,
            author,
            actionType: actType,
            actionLabel: getActionLabel(actType),
            status: 'bajarilgan',
            productReceiptUsd,
            productMethodLabel,
            simpleReceiptUsd,
            simpleMethodLabel,
            totalReceiptUsd,
            note: noteParts.join(' · '),
          });
        });
      } else {
        // Bajarilmagan reja (planned or closedWithoutAction)
        const actType = normalizeActionType(plan.plannedAction || plan.actionDone);
        const noteParts: string[] = [];
        if (plan.planNote && plan.planNote.trim()) {
          noteParts.push(plan.planNote.trim());
        }
        if (plan.reportNote && plan.reportNote.trim() && !noteParts.includes(plan.reportNote.trim())) {
          noteParts.push(plan.reportNote.trim());
        }
        if (plan.closeReason && plan.closeReason.trim()) {
          noteParts.push(`Sabab: ${plan.closeReason.trim()}`);
        }

        rows.push({
          id: `plan_unexec_${plan.id}`,
          date: planDateKey,
          timeStr: extractTimeHM(plan.closedAt || plan.createdAt),
          sortKey: `${planDateKey}T00:00`,
          author: plan.closedBy || plan.agentUsername || 'agentp1',
          actionType: actType,
          actionLabel: getActionLabel(actType),
          status: 'bajarilmagan',
          isClosedWithoutAction: Boolean(plan.closedWithoutAction || plan.isClosed),
          productReceiptUsd: 0,
          productMethodLabel: '',
          simpleReceiptUsd: 0,
          simpleMethodLabel: '',
          totalReceiptUsd: 0,
          note: noteParts.join(' · '),
        });
      }
    });

    rows.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return rows;
  }, [client, clientPlans]);

  const filteredAgentPlanActions = useMemo(() => {
    return allAgentPlanActions.filter((row) => {
      if (actStartDate && row.date < actStartDate) return false;
      if (actEndDate && row.date > actEndDate) return false;
      return true;
    });
  }, [allAgentPlanActions, actStartDate, actEndDate]);

  const agentPlanActionsSummary = useMemo(() => {
    let executedCount = 0;
    let unexecutedCount = 0;
    let visitOnlyCount = 0;
    let phoneOnlyCount = 0;
    let bothCount = 0;
    let totalReceiptUsd = 0;
    let productReceiptUsd = 0;
    let simpleReceiptUsd = 0;

    filteredAgentPlanActions.forEach((row) => {
      if (row.status === 'bajarilgan') {
        executedCount++;
        if (row.actionType === 'joyiga borildi') visitOnlyCount++;
        else if (row.actionType === 'telefon qilindi') phoneOnlyCount++;
        else if (row.actionType === 'telefon qilindi + joyiga borildi') bothCount++;
      } else {
        unexecutedCount++;
      }

      totalReceiptUsd = Math.round((totalReceiptUsd + row.totalReceiptUsd) * 100) / 100;
      productReceiptUsd = Math.round((productReceiptUsd + row.productReceiptUsd) * 100) / 100;
      simpleReceiptUsd = Math.round((simpleReceiptUsd + row.simpleReceiptUsd) * 100) / 100;
    });

    return {
      executedCount,
      unexecutedCount,
      visitOnlyCount,
      phoneOnlyCount,
      bothCount,
      totalReceiptUsd,
      productReceiptUsd,
      simpleReceiptUsd,
    };
  }, [filteredAgentPlanActions]);

  const handleActPreset = (preset: 'all' | 'today' | 'last7' | 'thisMonth') => {
    setActiveActPreset(preset);
    const today = getTodayYMD();
    if (preset === 'all') {
      setActStartDate('');
      setActEndDate('');
    } else if (preset === 'today') {
      setActStartDate(today);
      setActEndDate(today);
    } else if (preset === 'last7') {
      setActStartDate(getOffsetYMD(-7));
      setActEndDate(today);
    } else if (preset === 'thisMonth') {
      setActStartDate(getMonthStartYMD());
      setActEndDate(today);
    }
  };

  if (!isOpen || !client) return null;

  const todayYmd = getTodayYMD();
  const yesterdayYmd = getOffsetYMD(-1);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-neutral-200 my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-5 sm:px-6 py-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-rose-700 shrink-0" />
              <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 truncate">
                Maxsus tahlil — {client.name}
              </h2>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2 font-mono">
              <span>{client.phone || "Telefon ko'rsatilmagan"}</span>
              <span aria-hidden="true">·</span>
              <span>Kunlik hisob va to&apos;lovlar tahlili</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-7 max-h-[78vh] overflow-y-auto">
          {/* SECTION 1: MAXSUS SANA BO'YICHA TAHLIL */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  1. Maxsus sana bo&apos;yicha mijoz holati va mahsulotlar
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Tanlangan sana holatiga qarzdorlik/haqdorlik, berilgan va qaytarilgan mahsulotlar
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayYmd)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                      selectedDate === todayYmd
                        ? 'bg-white text-neutral-900 shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Bugun
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(yesterdayYmd)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                      selectedDate === yesterdayYmd
                        ? 'bg-white text-neutral-900 shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Kecha
                  </button>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white">
                  <Calendar className="w-4 h-4 text-rose-700 shrink-0" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                    className="text-xs font-mono font-bold text-neutral-900 bg-transparent focus:outline-none"
                    aria-label="Maxsus sanani tanlash"
                  />
                </div>
              </div>
            </div>

            {/* 5 Clean Tabular Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* 1. Hozirgi qarzi */}
              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col justify-between">
                <span className="text-xs font-semibold text-neutral-600">Hozirgi qarzi</span>
                <div className="text-lg font-bold font-mono tabular-nums text-neutral-900 mt-1">
                  {formatMoney(client.currentDebt || 0)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {(client.currentAdvance || 0) > 0
                    ? `Joriy haqdorlik: ${formatMoney(client.currentAdvance)}`
                    : (client.currentDebt || 0) > 0
                    ? 'Joriy qoldiq qarz'
                    : 'Joriy qarz yopilgan'}
                </div>
              </div>

              {/* 2. Tanlangan sana kungi qarzdorlik yoki haqdorlik */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  balanceOnSelectedDate.debt > 0
                    ? 'bg-rose-50/70 border-rose-200'
                    : balanceOnSelectedDate.advance > 0
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-neutral-50 border-neutral-200'
                }`}
              >
                <span className="text-xs font-semibold text-neutral-700">
                  {formatDateDMY(selectedDate)} kungi holat
                </span>
                <div
                  className={`text-lg font-bold font-mono tabular-nums mt-1 ${
                    balanceOnSelectedDate.debt > 0
                      ? 'text-rose-900'
                      : balanceOnSelectedDate.advance > 0
                      ? 'text-emerald-900'
                      : 'text-neutral-900'
                  }`}
                >
                  {balanceOnSelectedDate.debt > 0
                    ? formatMoney(balanceOnSelectedDate.debt)
                    : balanceOnSelectedDate.advance > 0
                    ? formatMoney(balanceOnSelectedDate.advance)
                    : formatMoney(0)}
                </div>
                <div
                  className={`text-[11px] font-semibold mt-1 ${
                    balanceOnSelectedDate.debt > 0
                      ? 'text-rose-800'
                      : balanceOnSelectedDate.advance > 0
                      ? 'text-emerald-800'
                      : 'text-neutral-500'
                  }`}
                >
                  {balanceOnSelectedDate.debt > 0
                    ? 'Qarzdorlik mavjud edi'
                    : balanceOnSelectedDate.advance > 0
                    ? 'Haqdorlik (Avans) bor edi'
                    : 'Hisob $0 edi'}
                </div>
              </div>

              {/* 3. Shu kuni berilgan mahsulotlar umumiy qiymati */}
              <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex flex-col justify-between">
                <span className="text-xs font-semibold text-neutral-600">
                  Berilgan mahsulotlar qiymati
                </span>
                <div className="text-lg font-bold font-mono tabular-nums text-neutral-900 mt-1">
                  {formatMoney(daySummary.totalValue)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {daySummary.deliveredQty > 0
                    ? `Faol miqdor: ${formatNumber(daySummary.deliveredQty)} dona`
                    : daySummary.returnedQty > 0
                    ? `Qaytarilgan: ${formatNumber(daySummary.returnedQty)} dona`
                    : "Bu kunda mahsulot berilmagan"}
                </div>
              </div>

              {/* 4. Shu kungi qarzga berilgan qismi */}
              <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex flex-col justify-between">
                <span className="text-xs font-semibold text-rose-800">Shundan qarzga</span>
                <div className="text-lg font-bold font-mono tabular-nums text-rose-900 mt-1">
                  {formatMoney(daySummary.creditValue)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {daySummary.totalValue > 0
                    ? `${Math.round((daySummary.creditValue / daySummary.totalValue) * 100)}% qarzga berilgan`
                    : "Qarzga berilmagan"}
                </div>
              </div>

              {/* 5. Shu kungi qarzga emas (to'langan) qismi */}
              <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex flex-col justify-between">
                <span className="text-xs font-semibold text-emerald-800">
                  Shundan qarzga emas
                </span>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-900 mt-1">
                  {formatMoney(daySummary.nonCreditValue)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {daySummary.totalValue > 0
                    ? `${Math.round((daySummary.nonCreditValue / daySummary.totalValue) * 100)}% naqd/to'langan`
                    : "Naqd to'lanmagan"}
                </div>
              </div>
            </div>

            {/* Shu kuni berilgan va qaytarilgan mahsulotlar jadvali */}
            {dayRows.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-500">
                <Package className="w-6 h-6 text-neutral-400 mx-auto mb-1.5" />
                {formatDateDMY(selectedDate)} sanasida mijozga berilgan yoki qaytarilgan mahsulotlar topilmadi.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-neutral-200">
                <StickyTableWrapper maxHeightClassName="max-h-72">
                  <table className="w-full min-w-[760px] text-left text-xs whitespace-nowrap">
                    <thead className="bg-neutral-100 text-neutral-700 border-b border-neutral-200 sticky top-0 z-10 font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Holati</th>
                        <th className="py-2.5 px-3">Mahsulot nomi</th>
                        <th className="py-2.5 px-3">Mas&apos;ul</th>
                        <th className="py-2.5 px-3 text-right">Miqdori</th>
                        <th className="py-2.5 px-3 text-right">Birlik narxi</th>
                        <th className="py-2.5 px-3 text-right">Jami qiymati</th>
                        <th className="py-2.5 px-3 text-center">To&apos;lov shakli</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {dayRows.map((row, idx) => {
                        const isFullyReturned = row.eventType === 'returned';
                        const isPartialReturned = row.eventType === 'partial_returned';
                        const activeQty = Math.max(0, row.quantity - (row.returnedQuantity || 0));
                        const activeSum = isPartialReturned
                          ? Math.round(activeQty * row.unitPrice * 100) / 100
                          : row.totalPrice;

                        return (
                          <tr
                            key={row.id || idx}
                            className={
                              isFullyReturned
                                ? 'bg-rose-50/40'
                                : isPartialReturned
                                ? 'bg-amber-50/40'
                                : 'bg-white hover:bg-neutral-50'
                            }
                          >
                            <td className="py-2.5 px-3 text-center text-neutral-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              {isFullyReturned ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800">
                                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                                  Qaytarilgan
                                </span>
                              ) : isPartialReturned ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800">
                                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                                  Qisman qaytarilgan
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-800">
                                  Berilgan
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div
                                className={`font-bold ${
                                  isFullyReturned
                                    ? 'line-through text-neutral-500'
                                    : 'text-neutral-900'
                                }`}
                              >
                                {row.productName}
                              </div>
                              {row.note && (
                                <div className="text-[10.5px] text-neutral-500">{row.note}</div>
                              )}
                              {!row.note && row.returnDates.length > 0 && (
                                <div className="text-[10.5px] text-rose-700">
                                  Qaytarilgan sana: {row.returnDates.map(formatDateDMY).join(', ')}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-neutral-700 font-medium">
                              {getAgentDisplayName(row.author)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {isFullyReturned ? (
                                <span className="text-rose-800 font-bold">
                                  {formatNumber(row.quantity)} {row.unit}
                                </span>
                              ) : isPartialReturned ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-[10.5px] text-neutral-400 line-through">
                                    {formatNumber(row.quantity)} {row.unit}
                                  </span>
                                  <span className="font-bold text-neutral-900">
                                    Qoldi: {formatNumber(activeQty)} {row.unit}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-semibold text-neutral-900">
                                  {formatNumber(row.quantity)} {row.unit}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-700">
                              {formatMoney(row.unitPrice)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-neutral-900">
                              {isFullyReturned ? (
                                <span className="text-rose-800 line-through">
                                  {formatMoney(row.totalPrice)}
                                </span>
                              ) : (
                                formatMoney(activeSum)
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[11px] font-bold">
                              {isFullyReturned ? (
                                <span className="text-rose-800">Qaytarilgan</span>
                              ) : row.paymentLabel === 'Qisman qarzga' ? (
                                <span className="text-amber-800">Qisman qarzga</span>
                              ) : row.paymentLabel === 'Qarzga' ? (
                                <span className="text-rose-800">Qarzga</span>
                              ) : (
                                <span className="text-emerald-800">Naqdga / To&apos;langan</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </StickyTableWrapper>
              </div>
            )}
          </section>

          {/* SECTION 2: MAXSUS SANA ORALIG'I BO'YICHA TUSHUMLAR VA TO'LOVLAR */}
          <section className="space-y-4 pt-6 border-t border-neutral-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  2. Sana oralig&apos;idagi pul tushumlari va to&apos;lovlar tarixi
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Tanlangan davrda tushgan jami mablag&apos;, mahsulot uchun va shunchaki to&apos;lovlar kesimi
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
                  {(
                    [
                      { key: 'all', label: 'Barchasi' },
                      { key: 'today', label: 'Bugun' },
                      { key: 'last7', label: 'Oxirgi 7 kun' },
                      { key: 'thisMonth', label: 'Bu oy' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handlePayPreset(item.key)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                        activePayPreset === item.key
                          ? 'bg-white text-neutral-900 shadow-xs'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="date"
                    value={payStartDate}
                    onChange={(e) => {
                      setPayStartDate(e.target.value);
                      setActivePayPreset('custom');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-neutral-300 bg-white font-mono"
                    title="Boshlanish sanasi"
                  />
                  <span className="text-neutral-400 font-bold">—</span>
                  <input
                    type="date"
                    value={payEndDate}
                    onChange={(e) => {
                      setPayEndDate(e.target.value);
                      setActivePayPreset('custom');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-neutral-300 bg-white font-mono"
                    title="Tugash sanasi"
                  />
                  {(payStartDate || payEndDate) && (
                    <button
                      type="button"
                      onClick={() => handlePayPreset('all')}
                      className="text-xs text-rose-700 hover:text-rose-900 font-semibold underline px-1 cursor-pointer"
                    >
                      Tozalash
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 3 Payment Summary Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-900">Jami tushgan pul</span>
                  <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-950 mt-1">
                  {formatMoney(paymentsSummary.totalPaid)}
                </div>
                <div className="text-[11px] text-emerald-800 mt-1">
                  Jami {filteredPayments.length} ta to&apos;lov yozuvi
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-700">Mahsulot uchun</span>
                  <Package className="w-4 h-4 text-amber-700 shrink-0" />
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
                  {formatMoney(paymentsSummary.productPaid)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {paymentsSummary.productCount > 0
                    ? `${paymentsSummary.productCount} ta mahsulot to'lovi`
                    : "Mahsulot uchun to'lov yo'q"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-700">
                    Shunchaki to&apos;lov
                  </span>
                  <CreditCard className="w-4 h-4 text-indigo-700 shrink-0" />
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
                  {formatMoney(paymentsSummary.simplePaid)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {paymentsSummary.simpleCount > 0
                    ? `${paymentsSummary.simpleCount} ta qarz/avans to'lovi`
                    : "Shunchaki to'lov yo'q"}
                </div>
              </div>
            </div>

            {/* Payments History Table */}
            {filteredPayments.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-500">
                Tanlangan sana oralig&apos;ida to&apos;lovlar topilmadi.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-neutral-200">
                <StickyTableWrapper maxHeightClassName="max-h-72">
                  <table className="w-full min-w-[740px] text-left text-xs">
                    <thead className="bg-neutral-100 text-neutral-700 border-b border-neutral-200 sticky top-0 z-10 font-bold text-[11px] whitespace-nowrap">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Qachon to&apos;lov qilgan</th>
                        <th className="py-2.5 px-3">Qabul qilgan</th>
                        <th className="py-2.5 px-3">To&apos;lov turi</th>
                        <th className="py-2.5 px-3">To&apos;lov usuli</th>
                        <th className="py-2.5 px-3 text-right">Summa</th>
                        <th className="py-2.5 px-3">Izoh / Tafsilot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredPayments.map((pay, idx) => (
                        <tr key={pay.id || idx} className="bg-white hover:bg-neutral-50">
                          <td className="py-2.5 px-3 text-center text-neutral-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                            <span className="font-bold text-neutral-900">
                              {pay.date ? formatDateDMY(pay.date) : '-'}
                            </span>
                            {pay.timeStr && (
                              <span className="text-neutral-500"> · {pay.timeStr}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-neutral-800 whitespace-nowrap">
                            {getAgentDisplayName(pay.author)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-bold">
                            {pay.category === 'product' ? (
                              <span className="text-amber-800">Mahsulot uchun</span>
                            ) : (
                              <span className="text-indigo-800">Shunchaki to&apos;lov</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-700">{pay.methodLabel}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-900 whitespace-nowrap">
                            {formatMoney(pay.amountUsd)}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600 whitespace-pre-wrap">
                            {pay.details || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-neutral-50 font-bold border-t-2 border-neutral-200 sticky bottom-0 z-10 text-xs">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 text-neutral-900">
                          JAMI TUSHUM ({filteredPayments.length} ta to&apos;lov)
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-900 font-extrabold">
                          {formatMoney(paymentsSummary.totalPaid)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-neutral-600 font-normal">
                          Mahsulot: {formatMoney(paymentsSummary.productPaid)} · Shunchaki:{' '}
                          {formatMoney(paymentsSummary.simplePaid)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </StickyTableWrapper>
              </div>
            )}
          </section>

          {/* SECTION 3: MAXSUS SANA ORALIG'IDA AGENT AMALLARI VA XULOSA */}
          <section className="space-y-4 pt-6 border-t border-neutral-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  3. Agentlar tomonidan qilingan amallar va xulosa
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Telefon qilish, joyiga borish yoki joyiga borish + telefon qilish, bajarilgan/bajarilmagan holati va tushumlar
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
                  {(
                    [
                      { key: 'all', label: 'Barchasi' },
                      { key: 'today', label: 'Bugun' },
                      { key: 'last7', label: 'Oxirgi 7 kun' },
                      { key: 'thisMonth', label: 'Bu oy' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleActPreset(item.key)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                        activeActPreset === item.key
                          ? 'bg-white text-neutral-900 shadow-xs'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="date"
                    value={actStartDate}
                    onChange={(e) => {
                      setActStartDate(e.target.value);
                      setActiveActPreset('custom');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-neutral-300 bg-white font-mono"
                    title="Boshlanish sanasi"
                  />
                  <span className="text-neutral-400 font-bold">—</span>
                  <input
                    type="date"
                    value={actEndDate}
                    onChange={(e) => {
                      setActEndDate(e.target.value);
                      setActiveActPreset('custom');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-neutral-300 bg-white font-mono"
                    title="Tugash sanasi"
                  />
                  {(actStartDate || actEndDate) && (
                    <button
                      type="button"
                      onClick={() => handleActPreset('all')}
                      className="text-xs text-rose-700 hover:text-rose-900 font-semibold underline px-1 cursor-pointer"
                    >
                      Tozalash
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Xulosa (Summary) Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-700">
                    Bajarilgan amallar soni
                  </span>
                  <PhoneCall className="w-4 h-4 text-rose-700 shrink-0" />
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
                  {agentPlanActionsSummary.executedCount} marta
                </div>
                <div className="text-[11px] text-neutral-600 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>Joyiga: {agentPlanActionsSummary.visitOnlyCount}</span>
                  <span>·</span>
                  <span>Tel: {agentPlanActionsSummary.phoneOnlyCount}</span>
                  <span>·</span>
                  <span>Joyi+Tel: {agentPlanActionsSummary.bothCount}</span>
                  {agentPlanActionsSummary.unexecutedCount > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-rose-700 font-semibold">
                        Bajarilmagan: {agentPlanActionsSummary.unexecutedCount}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-900">Jami tushum</span>
                  <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-950 mt-1">
                  {formatMoney(agentPlanActionsSummary.totalReceiptUsd)}
                </div>
                <div className="text-[11px] text-emerald-800 mt-1">
                  Tanlangan davrdagi amallar tushumi
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-700">Mahsulot uchun</span>
                  <Package className="w-4 h-4 text-amber-700 shrink-0" />
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
                  {formatMoney(agentPlanActionsSummary.productReceiptUsd)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Amallar davomida mahsulotga to&apos;langan
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-700">
                    Shunchaki to&apos;lov
                  </span>
                  <CreditCard className="w-4 h-4 text-indigo-700 shrink-0" />
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
                  {formatMoney(agentPlanActionsSummary.simpleReceiptUsd)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Amallar davomida qarz/avansga to&apos;langan
                </div>
              </div>
            </div>

            {/* Agent Actions Table */}
            {filteredAgentPlanActions.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-500">
                Tanlangan sana oralig&apos;ida agent amallari topilmadi.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-neutral-200">
                <StickyTableWrapper maxHeightClassName="max-h-72">
                  <table className="w-full min-w-[840px] text-left text-xs">
                    <thead className="bg-neutral-100 text-neutral-700 border-b border-neutral-200 sticky top-0 z-10 font-bold text-[11px] whitespace-nowrap">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Sana</th>
                        <th className="py-2.5 px-3">Agent</th>
                        <th className="py-2.5 px-3">Qilingan amal</th>
                        <th className="py-2.5 px-3">Holati</th>
                        <th className="py-2.5 px-3 text-right">Mahsulot uchun</th>
                        <th className="py-2.5 px-3 text-right">Shunchaki to&apos;lov</th>
                        <th className="py-2.5 px-3">Izoh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredAgentPlanActions.map((row, idx) => (
                        <tr
                          key={row.id || idx}
                          className={
                            row.status === 'bajarilmagan'
                              ? 'bg-rose-50/30 hover:bg-rose-50/50'
                              : 'bg-white hover:bg-neutral-50'
                          }
                        >
                          <td className="py-2.5 px-3 text-center text-neutral-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                            <span className="font-bold text-neutral-900">
                              {row.date ? formatDateDMY(row.date) : '-'}
                            </span>
                            {row.timeStr && (
                              <span className="text-neutral-500"> · {row.timeStr}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-neutral-800 whitespace-nowrap">
                            {getAgentDisplayName(row.author)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-bold">
                            {row.actionType === 'joyiga borildi' ? (
                              <span className="text-rose-800">Joyiga borish</span>
                            ) : row.actionType === 'telefon qilindi' ? (
                              <span className="text-sky-800">Telefon qilish</span>
                            ) : row.actionType === 'telefon qilindi + joyiga borildi' ? (
                              <span className="text-indigo-800">Joyiga borish + Telefon qilish</span>
                            ) : (
                              <span className="text-neutral-600">{row.actionLabel}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-bold">
                            {row.status === 'bajarilgan' ? (
                              <span className="text-emerald-800">Bajarilgan</span>
                            ) : (
                              <span className="text-rose-800">
                                {row.isClosedWithoutAction ? 'Bajarilmagan (yopilgan)' : 'Bajarilmagan'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {row.productReceiptUsd > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-amber-900 whitespace-nowrap">
                                  {formatMoney(row.productReceiptUsd)}
                                </span>
                                {row.productMethodLabel && (
                                  <span className="text-[10px] text-neutral-500 font-sans">
                                    {row.productMethodLabel}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-neutral-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {row.simpleReceiptUsd > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-indigo-900 whitespace-nowrap">
                                  {formatMoney(row.simpleReceiptUsd)}
                                </span>
                                {row.simpleMethodLabel && (
                                  <span className="text-[10px] text-neutral-500 font-sans">
                                    {row.simpleMethodLabel}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-neutral-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600 whitespace-pre-wrap">
                            {row.note || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-neutral-50 font-bold border-t-2 border-neutral-200 sticky bottom-0 z-10 text-xs">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 text-neutral-900">
                          XULOSA: Bajarilgan {agentPlanActionsSummary.executedCount} marta
                          {agentPlanActionsSummary.unexecutedCount > 0
                            ? ` · Bajarilmagan ${agentPlanActionsSummary.unexecutedCount} ta`
                            : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-900">
                          {formatMoney(agentPlanActionsSummary.productReceiptUsd)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-indigo-900">
                          {formatMoney(agentPlanActionsSummary.simpleReceiptUsd)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] font-bold text-emerald-900 font-mono tabular-nums">
                          Jami: {formatMoney(agentPlanActionsSummary.totalReceiptUsd)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </StickyTableWrapper>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 transition min-h-[40px] cursor-pointer whitespace-nowrap shrink-0"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
