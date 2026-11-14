import React, { useState, useMemo } from 'react';
import { Client, DailyPlanItem } from '../types';
import {
  formatMoney,
  formatDate,
  formatDateDMY,
  formatNumber,
  getAgentDisplayName,
  getInitialDebtForClient,
} from '../utils/format';
import {
  storageService,
  getPlanSoldProductsData,
  getPlanDateKey,
  getClosedDateKey,
} from '../services/storage';
import {
  X,
  Phone,
  MapPin,
  Calendar,
  Edit,
  Trash2,
  Package,
  History,
  FileText,
  Lock,
  BellRing,
  Check,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { StickyTableWrapper } from './StickyTableWrapper';

const getPresetDateRange = (preset: 'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth') => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const todayStr = formatYMD(now);

  if (preset === 'all') return { start: '', end: '' };
  if (preset === 'today') return { start: todayStr, end: todayStr };
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = formatYMD(y);
    return { start: yStr, end: yStr };
  }
  if (preset === 'last7') {
    const l7 = new Date(now);
    l7.setDate(l7.getDate() - 7);
    return { start: formatYMD(l7), end: todayStr };
  }
  if (preset === 'thisMonth') {
    const m = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: formatYMD(m), end: todayStr };
  }
  return { start: '', end: '' };
};

interface Props {
  client: Client | null;
  dailyPlans?: DailyPlanItem[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  onQuickPayment?: (client: Client) => void;
  onOpenWarehouseDebtModal?: (client: Client) => void;
  onToggleReminderStatus?: (reminderId: string, clientId: string) => void;
  onDeleteReminder?: (reminderId: string, clientId: string) => void;
  onNavigateToPlanDate?: (target: {
    clientId: string;
    clientName: string;
    planId?: string;
    planDate: string;
    openEditModal?: boolean;
  }) => void;
  userRole?: 'admin' | 'agent';
  currentUsername?: string;
}

export const ClientDetailModal: React.FC<Props> = ({
  client: propClient,
  dailyPlans,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onToggleReminderStatus,
  onDeleteReminder,
  onNavigateToPlanDate,
  userRole = 'admin',
  currentUsername,
}) => {
  const isAgent = userRole === 'agent';
  const canDelete = currentUsername === 'adminc' || currentUsername === 'adminc1';
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Always resolve the latest client state from storage so the modal is never stale
  const client = useMemo(() => {
    if (!propClient) return null;
    const fresh = storageService.getClientById(propClient.id);
    return fresh || propClient;
  }, [propClient, dailyPlans, isOpen]);

  // Compute the latest note by agentp1 regarding this client
  const latestAgentNote = useMemo(() => {
    if (!client) return null;
    const candidates: { text: string; author: string; date: string }[] = [];

    // 1. From all daily plans for this client
    try {
      const allPlans = storageService.getDailyPlans().filter((p) => p.clientId === client.id);
      allPlans.forEach((p) => {
        // Check actionsHistory first (most specific and chronological)
        if (p.actionsHistory && p.actionsHistory.length > 0) {
          p.actionsHistory.forEach((act) => {
            if (act.reportNote && act.reportNote.trim()) {
              candidates.push({
                text: act.reportNote.trim(),
                author: act.author || p.agentUsername || 'agentp1',
                date: act.timestamp || p.completedAt || p.createdAt,
              });
            }
          });
        }

        // Check plan-level reportNote
        if (p.reportNote && p.reportNote.trim()) {
          candidates.push({
            text: p.reportNote.trim(),
            author: p.agentUsername || 'agentp1',
            date: p.completedAt || p.createdAt,
          });
        }

        // Check planNote
        if (p.planNote && p.planNote.trim()) {
          candidates.push({
            text: p.planNote.trim(),
            author: p.agentUsername || 'agentp1',
            date: p.createdAt,
          });
        }
      });
    } catch {
      // storage read fallback
    }

    // 2. From client audit logs
    if (client.logs && client.logs.length > 0) {
      client.logs.forEach((log) => {
        if (log.details && log.details.trim()) {
          if (log.author?.toLowerCase().includes('agent') || log.type === 'visit_action') {
            candidates.push({
              text: log.details.trim(),
              author: log.author || 'agentp1',
              date: log.timestamp,
            });
          }
        }
      });
    }

    // 3. From client.notes
    if (client.notes && client.notes.trim()) {
      candidates.push({
        text: client.notes.trim(),
        author: client.createdBy || 'agentp1',
        date: client.updatedAt || client.createdAt,
      });
    }

    if (candidates.length === 0) return null;

    // Sort by date descending (most recent first)
    candidates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Prefer candidate specifically by agentp1 if viewing as agent
    const agentCandidate = candidates.find((c) =>
      c.author.toLowerCase().includes('agent')
    );
    return agentCandidate || candidates[0];
  }, [client, dailyPlans, isOpen]);

  // Delivered products date filter state
  const [productStartDate, setProductStartDate] = useState('');
  const [productEndDate, setProductEndDate] = useState('');
  const [activeProductPreset, setActiveProductPreset] = useState<
    'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom'
  >('all');

  // Logs date filter state
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [activeLogPreset, setActiveLogPreset] = useState<
    'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom'
  >('all');

  const handleProductPresetChange = (preset: 'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth') => {
    setActiveProductPreset(preset);
    const range = getPresetDateRange(preset);
    setProductStartDate(range.start);
    setProductEndDate(range.end);
  };

  const handleLogPresetChange = (preset: 'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth') => {
    setActiveLogPreset(preset);
    const range = getPresetDateRange(preset);
    setLogStartDate(range.start);
    setLogEndDate(range.end);
  };

  // Extract all delivered & returned products with accurate plan dates, return dates, and status
  const allDeliveredProducts = useMemo(() => {
    if (!client) return [];

    interface DeliveredProductRow {
      id: string;
      planId?: string;
      planDate: string;
      isPlanClosed?: boolean;
      date: string;
      timestamp: string;
      author: string;
      productId?: string;
      warehouseId?: string;
      productName: string;
      unit: string;
      quantity: number;
      returnedQuantity: number;
      returnDates: string[];
      status: 'active' | 'partial_returned' | 'returned';
      unitPrice: number;
      totalPrice: number;
      paymentType: string;
      paymentLabel: string;
    }

    const list: DeliveredProductRow[] = [];
    const coveredProductIds = new Set<string>();
    const coveredWarehouseIds = new Set<string>();
    const coveredProductNames = new Set<string>();

    interface CollectedReturnEvent {
      id: string;
      planId: string;
      planDate: string;
      returnDate: string;
      returnTimestamp: string;
      author: string;
      productId?: string;
      warehouseId?: string;
      name: string;
      unit: string;
      quantity: number;
      unitPrice: number;
    }

    const returnEvents: CollectedReturnEvent[] = [];

    try {
      const allPlans = storageService.getDailyPlans();
      const rawClientPlans = allPlans.filter(
        (p) =>
          p &&
          (p.clientId === client.id ||
            ((p.clientName || '').trim().toLowerCase() === client.name.trim().toLowerCase() &&
              (p.clientPhone || '').replace(/\D/g, '') === (client.phone || '').replace(/\D/g, '')))
      );

      // Deduplicate plans by effective plan date so stale duplicate records on the same date never show outdated products
      const getEffectiveDate = (p: DailyPlanItem): string =>
        getClosedDateKey(p) ||
        (p as any).lastClosedDateKey ||
        getPlanDateKey(p) ||
        (p.planDate || p.createdAt || '').slice(0, 10);

      const getFreshnessScore = (p: DailyPlanItem): string =>
        p.lastExecutedAt ||
        (p as any).closedUpdatedAt ||
        p.reopenedAt ||
        p.closedAt ||
        p.completedAt ||
        p.createdAt ||
        '';

      const dedupByDate = new Map<string, DailyPlanItem>();
      const allReturnsByDate = new Map<string, any[]>();
      const allCancelledByDate = new Map<string, any[]>();

      rawClientPlans.forEach((plan) => {
        const dKey = getEffectiveDate(plan) || plan.id;
        // Collect returns from this plan record
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
        if (planRets.length > 0) {
          const prev = allReturnsByDate.get(dKey) || [];
          if (planRets.length >= prev.length) {
            allReturnsByDate.set(dKey, planRets);
          }
        }

        const planCancelled: any[] = Array.isArray((plan as any).cancelledProducts)
          ? (plan as any).cancelledProducts
          : [];
        if (planCancelled.length > 0) {
          const prevC = allCancelledByDate.get(dKey) || [];
          if (planCancelled.length >= prevC.length) {
            allCancelledByDate.set(dKey, planCancelled);
          }
        }

        const existing = dedupByDate.get(dKey);
        if (!existing || getFreshnessScore(plan) >= getFreshnessScore(existing)) {
          dedupByDate.set(dKey, plan);
        }
      });

      const clientPlans = Array.from(dedupByDate.values());

      clientPlans.forEach((plan) => {
        const planDateKey =
          getEffectiveDate(plan) || new Date().toISOString().slice(0, 10);
        const soldData = getPlanSoldProductsData(plan);
        const prods = (soldData.productsDelivered || []).filter(
          (p) => p && (p.name || '').trim() !== '' && (Number(p.quantity) || 0) > 0
        );

        const author =
          plan.lastExecutedBy ||
          plan.actionsHistory?.[0]?.author ||
          plan.agentUsername ||
          'agentp1';
        const rawTs =
          plan.actionsHistory?.[0]?.timestamp ||
          plan.closedAt ||
          plan.completedAt ||
          `${planDateKey}T12:00:00`;
        const timePart = rawTs.includes('T') ? rawTs.slice(10, 16) : 'T12:00';
        const displayTimestamp = `${planDateKey}${timePart}`;

        const dp = soldData.deliveryPayment || plan.deliveryPayment;
        const pType = dp?.paymentType || 'qarzga';
        const isCredit = pType === 'qarzga' || Boolean(dp?.debtAmount && dp.debtAmount > 0);
        const pLabel = isCredit ? 'Qarzga' : 'Naqdga';

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
              : qty * uPrice;
          const itemDate =
            ((p as any).date ? String((p as any).date).slice(0, 10) : '') || planDateKey;

          list.push({
            id: `${plan.id}_del_${pIdx}_${p.id || p.name}`,
            planId: plan.id,
            planDate: planDateKey,
            isPlanClosed: Boolean(plan.isClosed || plan.status === 'yopildi'),
            date: itemDate,
            timestamp: displayTimestamp,
            author,
            productId: p.id,
            warehouseId: p.warehouseId,
            productName: p.name,
            unit: u,
            quantity: qty,
            returnedQuantity: 0,
            returnDates: [],
            status: 'active',
            unitPrice: uPrice,
            totalPrice: tPrice,
            paymentType: pType,
            paymentLabel: pLabel,
          });
        });

        // Cancelled products when reopening and editing this plan
        const cancelledList =
          allCancelledByDate.get(planDateKey) || (plan as any).cancelledProducts || [];
        if (Array.isArray(cancelledList) && cancelledList.length > 0) {
          cancelledList.forEach((cp: any, cIdx: number) => {
            if (!cp || !(cp.name || '').trim()) return;
            const cNameNorm = cp.name.trim().toLowerCase();
            // Skip if currently still active with same quantity in prods
            const stillSameInActive = prods.some(
              (ap) =>
                ap.name.trim().toLowerCase() === cNameNorm &&
                Number(ap.quantity) >= Number(cp.quantity)
            );
            if (stillSameInActive) return;

            if (cp.id) coveredProductIds.add(cp.id);
            if (cp.warehouseId) coveredWarehouseIds.add(cp.warehouseId);
            coveredProductNames.add(cNameNorm);

            const u = !cp.unit || cp.unit.toLowerCase() === 'birlik' ? 'dona' : cp.unit;
            const qty = Number(cp.quantity) || 0;
            const uPrice = Number(cp.unitPrice) || 0;
            const tPrice =
              cp.totalPrice !== undefined ? Number(cp.totalPrice) : qty * uPrice;
            const cancelledDate = (cp.cancelledAt || planDateKey).slice(0, 10);

            list.push({
              id: `${plan.id}_canc_${cIdx}_${cp.id || cp.name}`,
              planId: plan.id,
              planDate: planDateKey,
              isPlanClosed: Boolean(plan.isClosed || plan.status === 'yopildi'),
              date: planDateKey,
              timestamp: displayTimestamp,
              author: cp.cancelledBy || author,
              productId: cp.id,
              warehouseId: cp.warehouseId,
              productName: cp.name,
              unit: u,
              quantity: qty,
              returnedQuantity: qty,
              returnDates: [cancelledDate],
              status: 'returned',
              unitPrice: uPrice,
              totalPrice: tPrice,
              paymentType: pType,
              paymentLabel: pLabel,
            });
          });
        }

        // Collect productsReturned from this plan
        const rets = allReturnsByDate.get(planDateKey) || plan.productsReturned || [];
        if (Array.isArray(rets) && rets.length > 0) {
          rets.forEach((r: any, rIdx: number) => {
            if (!r || !(r.name || '').trim() || (Number(r.quantity) || 0) <= 0) return;
            const retTs = r.returnedAt || rawTs;
            const retDate = (r.returnedAt || planDateKey).slice(0, 10);
            coveredProductNames.add(r.name.trim().toLowerCase());
            if (r.productId) coveredProductIds.add(r.productId);
            if (r.warehouseId) coveredWarehouseIds.add(r.warehouseId);

            returnEvents.push({
              id: `${plan.id}_ret_${rIdx}_${r.productId || r.name}`,
              planId: plan.id,
              planDate: planDateKey,
              returnDate: retDate,
              returnTimestamp: `${retDate}${retTs.includes('T') ? retTs.slice(10, 16) : 'T12:00'}`,
              author: r.author || author,
              productId: r.productId,
              warehouseId: r.warehouseId,
              name: r.name,
              unit: !r.unit || r.unit.toLowerCase() === 'birlik' ? 'dona' : r.unit,
              quantity: Number(r.quantity) || 0,
              unitPrice: Number(r.unitPrice) || 0,
            });
          });
        }
      });
    } catch (err) {
      console.error('Error fetching plans for delivered products:', err);
    }

    // Include initial client.products ONLY if not already covered by plans
    if (client.products && client.products.length > 0) {
      const fallbackDate = (client.createdAt || client.updatedAt || new Date().toISOString()).slice(
        0,
        10
      );
      const fallbackTs = (client.createdAt || client.updatedAt || new Date().toISOString()).slice(
        0,
        16
      );
      const fallbackAuthor = client.createdBy || 'adminc';
      const isCredit = (client.currentDebt || 0) > 0;
      const pLabel = isCredit ? 'Qarzga' : 'Naqdga';

      client.products.forEach((p, pIdx) => {
        if (!p || !(p.name || '').trim()) return;
        const normName = p.name.trim().toLowerCase();
        if (p.id && coveredProductIds.has(p.id)) return;
        if (p.warehouseId && coveredWarehouseIds.has(p.warehouseId)) return;
        if (coveredProductNames.has(normName)) return;

        const u = !p.unit || p.unit.toLowerCase() === 'birlik' ? 'dona' : p.unit;
        const qty = Number(p.quantity) || 0;
        if (qty <= 0) return;
        const uPrice = Number(p.unitPrice) || 0;
        const tPrice = Number(p.totalPrice) || qty * uPrice;
        const itemDate = ((p as any).date ? String((p as any).date).slice(0, 10) : '') || fallbackDate;

        list.push({
          id: `cp_${p.id || pIdx}_${p.name}`,
          planDate: itemDate,
          date: itemDate,
          timestamp: fallbackTs,
          author: fallbackAuthor,
          productId: p.id,
          warehouseId: p.warehouseId,
          productName: p.name,
          unit: u,
          quantity: qty,
          returnedQuantity: 0,
          returnDates: [],
          status: 'active',
          unitPrice: uPrice,
          totalPrice: tPrice,
          paymentType: isCredit ? 'qarzga' : 'naqd',
          paymentLabel: pLabel,
        });
      });
    }

    // Sort delivered rows chronologically (oldest first) to match returns against delivered rows accurately
    const activeChronological = list
      .filter((row) => row.status !== 'returned')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Match each return event against delivered rows
    returnEvents.forEach((ret) => {
      let remToMatch = ret.quantity;
      const retNameClean = ret.name.trim().toLowerCase();

      const candidates = activeChronological.filter((row) => {
        if (row.returnedQuantity >= row.quantity) return false;
        if (ret.productId && row.productId && ret.productId === row.productId) return true;
        if (ret.warehouseId && row.warehouseId && ret.warehouseId === row.warehouseId) return true;
        return row.productName.trim().toLowerCase() === retNameClean;
      });

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
          targetRow.status = 'returned';
        } else if (targetRow.returnedQuantity > 0) {
          targetRow.status = 'partial_returned';
        }
      }

      // If there's still unmatched return quantity (e.g., returned from an older initial stock or 4.2 extra return), add it as a returned row
      if (remToMatch > 0) {
        list.push({
          id: ret.id,
          planId: ret.planId,
          planDate: ret.planDate,
          date: ret.returnDate,
          timestamp: ret.returnTimestamp,
          author: ret.author,
          productId: ret.productId,
          warehouseId: ret.warehouseId,
          productName: ret.name,
          unit: ret.unit,
          quantity: remToMatch,
          returnedQuantity: remToMatch,
          returnDates: [ret.returnDate],
          status: 'returned',
          unitPrice: ret.unitPrice,
          totalPrice: Math.round(remToMatch * ret.unitPrice * 100) / 100,
          paymentType: 'qaytarilgan',
          paymentLabel: 'Qaytarilgan',
        });
      }
    });

    list.sort((a, b) => (b.timestamp || b.date).localeCompare(a.timestamp || a.date));
    return list;
  }, [client, dailyPlans, isOpen]);

  // Filtered delivered products based on product date filter
  const filteredDeliveredProducts = useMemo(() => {
    return allDeliveredProducts.filter((p) => {
      const matchesDeliveryDate =
        (!productStartDate || p.date >= productStartDate) &&
        (!productEndDate || p.date <= productEndDate);
      const matchesReturnDate =
        p.returnDates.length > 0 &&
        p.returnDates.some(
          (rd) => (!productStartDate || rd >= productStartDate) && (!productEndDate || rd <= productEndDate)
        );
      return matchesDeliveryDate || matchesReturnDate;
    });
  }, [allDeliveredProducts, productStartDate, productEndDate]);

  const totalFilteredProductsValue = useMemo(() => {
    return filteredDeliveredProducts.reduce((sum, p) => {
      if (p.status === 'returned') return sum;
      if (p.status === 'partial_returned') {
        const activeQty = Math.max(0, p.quantity - p.returnedQuantity);
        return sum + Math.round(activeQty * p.unitPrice * 100) / 100;
      }
      return sum + p.totalPrice;
    }, 0);
  }, [filteredDeliveredProducts]);

  const totalFilteredProductsQty = useMemo(() => {
    return filteredDeliveredProducts.reduce((sum, p) => {
      if (p.status === 'returned') return sum;
      if (p.status === 'partial_returned') {
        return sum + Math.max(0, p.quantity - p.returnedQuantity);
      }
      return sum + p.quantity;
    }, 0);
  }, [filteredDeliveredProducts]);

  const totalReturnedProductsQty = useMemo(() => {
    return filteredDeliveredProducts.reduce((sum, p) => sum + (p.returnedQuantity || 0), 0);
  }, [filteredDeliveredProducts]);

  // Filtered audit logs based on log date filter
  const filteredLogs = useMemo(() => {
    const rawLogs = client?.logs || [];
    return rawLogs.filter((log) => {
      const logDate = (log.timestamp || '').slice(0, 10);
      if (logStartDate && logDate < logStartDate) return false;
      if (logEndDate && logDate > logEndDate) return false;
      return true;
    });
  }, [client?.logs, logStartDate, logEndDate]);

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-rose-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="no-print px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50/90 via-white to-rose-50/50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-700 text-white font-bold font-display flex items-center justify-center text-base shadow-xs">
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold font-display text-neutral-900 leading-tight">
                  {client.name}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    client.createdBy === 'agentp1'
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : 'bg-rose-100 text-rose-900 border border-rose-200'
                  }`}
                >
                  Qo'shgan: {client.createdBy || 'adminc'}
                </span>
              </div>
              <div className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5 font-mono">
                <span>ID: {client.id.slice(0, 10)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDate(client.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable & Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Printable Invoice Header (visible when printing) */}
          <div className="hidden print-only mb-6 pb-4 border-b border-neutral-300">
            <div className="text-xl font-bold">SAVDONAZORAT - MIJOZ HISOB-KITOB VARAQASI</div>
            <div className="text-xs text-neutral-600">Sana: {formatDate(new Date().toISOString())}</div>
          </div>

          {/* Contact & Location Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-rose-50/40 border border-rose-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800 shrink-0 mt-0.5">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-neutral-500 uppercase">
                  Telefon {client.phones && client.phones.length > 1 ? `(${client.phones.length} ta)` : ''}
                </div>
                {client.phones && client.phones.length > 0 ? (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {client.phones.map((ph, idx) => (
                      <a
                        key={idx}
                        href={`tel:${ph}`}
                        className="text-sm font-semibold text-neutral-900 hover:text-rose-700 underline font-mono tabular-nums"
                      >
                        {ph}
                      </a>
                    ))}
                  </div>
                ) : (
                  <a
                    href={`tel:${client.phone}`}
                    className="text-sm font-semibold text-neutral-900 hover:text-rose-700 underline font-mono tabular-nums"
                  >
                    {client.phone || "Kiritilmagan"}
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800 shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-neutral-500 uppercase">
                  Joylashuv (Manzil)
                </div>
                <div className="text-sm font-bold text-neutral-900 mt-0.5">
                  {[client.region, client.district].filter(Boolean).join(', ') || client.address || "Manzil ko'rsatilmagan"}
                </div>
                {client.landmark && (
                  <div className="text-xs text-neutral-600 mt-0.5">
                    <span className="font-semibold text-neutral-700">Mo'ljal:</span> {client.landmark}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Debt & Advance Balances (Only for Admin, or visible as general summary) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Joriy qarzdorlik */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                  Joriy qarzdorlik
                </div>
                {getInitialDebtForClient(client) > 0 && (
                  <div className="text-[11px] font-bold text-amber-800 font-mono bg-amber-100/90 px-2 py-0.5 rounded border border-amber-200">
                    Dastlabki: {formatMoney(getInitialDebtForClient(client))}
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold font-display text-neutral-900 font-mono tabular-nums mt-1">
                {formatMoney(client.currentDebt)}
              </div>
              <div className="text-[11px] text-rose-700 mt-1">
                {client.currentDebt > 0
                  ? "Mijozdan to'lanishi kutilayotgan qarz miqdori"
                  : "Qarzdorlik yo'q (hisob yopilgan)"}
              </div>
            </div>

            {/* Joriy haqdorlik */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                Joriy haqdorlik (Avans)
              </div>
              <div className="text-2xl font-bold font-display text-neutral-900 font-mono tabular-nums mt-1">
                {formatMoney(client.currentAdvance)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">
                {client.currentAdvance > 0
                  ? "Mijoz tomonidan ortiqcha to'langan summa"
                  : "Avans to'lovi mavjud emas"}
              </div>
            </div>
          </div>

          {/* Oxirgi reja yakunlanishi va yopilish sababi */}
          {client.lastPlanCloseReason && (
            <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-rose-950">
                <Lock className="w-4 h-4 text-rose-700 shrink-0" />
                <span className="text-xs uppercase tracking-wide">Oxirgi kunlik reja yopilish sababi</span>
              </div>
              <div className="text-neutral-900 font-semibold pl-6 text-sm">
                "{client.lastPlanCloseReason}"
              </div>
              <div className="text-[11px] text-neutral-500 font-mono pl-6 flex items-center gap-3">
                {client.lastPlanClosedBy && (
                  <span className="font-semibold text-rose-900">Mas'ul: @{client.lastPlanClosedBy}</span>
                )}
                {client.lastPlanClosedAt && (
                  <span>Sana: {formatDate(client.lastPlanClosedAt)}</span>
                )}
              </div>
            </div>
          )}

          {/* Mijoz bo'yicha eslatmalar (Agar mavjud bo'lsa) */}
          {client.reminders && client.reminders.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-amber-100">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                  Eslatmalar ({client.reminders.length})
                </h3>
              </div>
              <div className="overflow-hidden rounded-2xl border border-neutral-200">
                <StickyTableWrapper maxHeightClassName="max-h-60">
                  <table className="w-full min-w-[540px] text-left text-xs">
                    <thead className="bg-neutral-900 text-white text-[10.5px] uppercase font-bold sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3">Eslatma sanasi</th>
                        <th className="py-2 px-3">Mijoz ismi</th>
                        <th className="py-2 px-3">Eslatma izohi</th>
                        <th className="py-2 px-3">Qo'shgan agent</th>
                        <th className="py-2 px-3 text-center">Bajarildi (Tick)</th>
                        {onDeleteReminder && <th className="py-2 px-3 text-center">O'chirish</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {client.reminders.map((rem) => {
                        const isDone = rem.status === 'bajarildi';
                        return (
                          <tr key={rem.id} className={isDone ? 'bg-emerald-50/30' : 'bg-white'}>
                            <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 whitespace-nowrap">
                              {rem.reminderDate}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-neutral-900">
                              {client.name}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-xs whitespace-pre-wrap ${
                                  isDone ? 'text-neutral-500 line-through' : 'text-neutral-900'
                                }`}
                              >
                                {rem.note}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-neutral-800 whitespace-nowrap">
                              {getAgentDisplayName(rem.agentUsername)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="inline-flex flex-col items-center gap-1">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isDone}
                                    onChange={() =>
                                      onToggleReminderStatus &&
                                      onToggleReminderStatus(rem.id, client.id)
                                    }
                                    className="sr-only"
                                  />
                                  <span
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                                      isDone
                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                        : 'bg-white border-neutral-300 hover:border-emerald-500 text-transparent'
                                    }`}
                                  >
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </span>
                                  <span
                                    className={`text-[11px] font-bold ${
                                      isDone ? 'text-emerald-700' : 'text-neutral-600'
                                    }`}
                                  >
                                    {isDone ? 'Bajarildi' : 'Bajarildi'}
                                  </span>
                                </label>
                                {isDone && (
                                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                                    Tick qildi: {getAgentDisplayName(rem.completedBy || rem.agentUsername)}
                                  </span>
                                )}
                              </div>
                            </td>
                            {onDeleteReminder && (
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => onDeleteReminder(rem.id, client.id)}
                                  className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                  title="Eslatmani o'chirish"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </StickyTableWrapper>
              </div>
            </div>
          )}

          {/* Products Table with Date Filtering */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Package className="w-4 h-4 text-rose-700" />
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                  Topshirilgan mahsulotlar ({filteredDeliveredProducts.length} ta yozuv)
                </h3>
                {onNavigateToPlanDate && filteredDeliveredProducts.length > 0 && (
                  <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                    Mahsulot ustiga bossangiz o&apos;sha kungi rejaga olib boradi
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {totalReturnedProductsQty > 0 && (
                  <span className="text-xs font-bold font-mono text-rose-800 bg-rose-100/80 px-2.5 py-1 rounded-lg border border-rose-300">
                    Qaytarilgan: {formatNumber(totalReturnedProductsQty)} dona
                  </span>
                )}
                <span className="text-xs font-bold font-mono text-neutral-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                  Jami faol summa: {formatMoney(totalFilteredProductsValue)}
                </span>
              </div>
            </div>

            {/* Date filter bar for products */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-neutral-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-rose-700" />
                  <span>Sana bo'yicha:</span>
                </span>
                {(['all', 'today', 'yesterday', 'last7', 'thisMonth'] as const).map((preset) => {
                  const labels = {
                    all: 'Barchasi',
                    today: 'Bugun',
                    yesterday: 'Kecha',
                    last7: 'Oxirgi 7 kun',
                    thisMonth: 'Bu oy',
                  };
                  const isActive = activeProductPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleProductPresetChange(preset)}
                      className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                        isActive
                          ? 'bg-rose-700 text-white shadow-2xs'
                          : 'bg-white text-neutral-700 hover:bg-rose-100/60 border border-neutral-200'
                      }`}
                    >
                      {labels[preset]}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="date"
                  value={productStartDate}
                  onChange={(e) => {
                    setProductStartDate(e.target.value);
                    setActiveProductPreset('custom');
                  }}
                  className="px-2 py-1 rounded-lg text-xs border border-neutral-300 bg-white font-mono"
                  title="Boshlanish sanasi"
                />
                <span className="text-neutral-400 font-bold">-</span>
                <input
                  type="date"
                  value={productEndDate}
                  onChange={(e) => {
                    setProductEndDate(e.target.value);
                    setActiveProductPreset('custom');
                  }}
                  className="px-2 py-1 rounded-lg text-xs border border-neutral-300 bg-white font-mono"
                  title="Tugash sanasi"
                />
                {(productStartDate || productEndDate) && (
                  <button
                    type="button"
                    onClick={() => handleProductPresetChange('all')}
                    className="text-[10.5px] text-rose-700 hover:text-rose-900 font-bold underline cursor-pointer px-1"
                  >
                    Tozalash
                  </button>
                )}
              </div>
            </div>

            {filteredDeliveredProducts.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-500">
                {allDeliveredProducts.length === 0
                  ? "Ushbu mijozga topshirilgan mahsulotlar mavjud emas."
                  : "Tanlangan sana yoki muddat oralig'ida topshirilgan mahsulotlar topilmadi."}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-rose-150 shadow-2xs">
                <StickyTableWrapper maxHeightClassName="max-h-96">
                  <table className="w-full min-w-[880px] text-left text-xs whitespace-nowrap">
                    <thead className="bg-rose-50 text-neutral-800 border-b border-rose-200 sticky top-0 z-20 font-bold uppercase tracking-wider text-[10.5px]">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[125px]">Berilgan Sana</th>
                        <th className="py-2.5 px-3 min-w-[115px]">Kim bergan</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Mahsulot nomi va holati</th>
                        <th className="py-2.5 px-3 w-16">O'lchov</th>
                        <th className="py-2.5 px-3 text-right">Miqdori</th>
                        <th className="py-2.5 px-3 text-right">Birlik narxi</th>
                        <th className="py-2.5 px-3 text-right">Jami summa</th>
                        <th className="py-2.5 px-3 text-center min-w-[105px]">To'lov turi</th>
                        {onNavigateToPlanDate && (
                          <th className="py-2.5 px-3 text-center min-w-[175px]">
                            O&apos;sha kungi reja / Tahrirlash
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredDeliveredProducts.map((p, idx) => {
                        const isFullyReturned = p.status === 'returned';
                        const isPartialReturned = p.status === 'partial_returned';
                        const activeQty = Math.max(0, p.quantity - (p.returnedQuantity || 0));
                        const activeSum = Math.round(activeQty * p.unitPrice * 100) / 100;
                        const returnDateFormatted =
                          p.returnDates && p.returnDates.length > 0
                            ? p.returnDates.map(formatDateDMY).join(', ')
                            : '';

                        return (
                          <tr
                            key={p.id || idx}
                            onClick={() => {
                              if (onNavigateToPlanDate && p.planDate) {
                                onNavigateToPlanDate({
                                  clientId: client.id,
                                  clientName: client.name,
                                  planId: p.planId,
                                  planDate: p.planDate,
                                  openEditModal: false,
                                });
                              }
                            }}
                            title={
                              onNavigateToPlanDate
                                ? `${formatDateDMY(p.planDate)} kungi rejaga o'tish uchun bosing`
                                : undefined
                            }
                            className={`transition-colors ${
                              onNavigateToPlanDate ? 'cursor-pointer' : ''
                            } ${
                              isFullyReturned
                                ? 'bg-rose-50/40 hover:bg-rose-50/80'
                                : isPartialReturned
                                ? 'bg-amber-50/40 hover:bg-amber-50/80'
                                : 'hover:bg-rose-50/30'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-neutral-400 font-mono text-center">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-neutral-700 text-[11px]">
                              <div className="font-bold text-neutral-900">
                                {formatDateDMY(p.planDate || p.date)}
                              </div>
                              {p.timestamp && p.timestamp.includes('T') && (
                                <div className="text-[10px] text-neutral-400">
                                  {p.timestamp.slice(11, 16)}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-neutral-800">
                              {getAgentDisplayName(p.author)}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`font-bold ${
                                    isFullyReturned
                                      ? 'line-through text-neutral-400 decoration-rose-600 decoration-2'
                                      : 'text-neutral-900'
                                  }`}
                                >
                                  {p.productName}
                                </span>
                                {isFullyReturned && (
                                  <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                    <RotateCcw className="w-3 h-3 text-rose-700 shrink-0" />
                                    <span>
                                      Qaytarilgan
                                      {returnDateFormatted ? ` (${returnDateFormatted})` : ''}
                                    </span>
                                  </span>
                                )}
                                {isPartialReturned && (
                                  <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    <RotateCcw className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span>
                                      <span className="line-through mr-1">
                                        {formatNumber(p.returnedQuantity)} {p.unit}
                                      </span>
                                      qaytarilgan
                                      {returnDateFormatted ? ` (${returnDateFormatted})` : ''}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-neutral-700">{p.unit}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {isFullyReturned ? (
                                <span className="line-through text-neutral-400 decoration-rose-600 decoration-2 font-bold">
                                  {formatNumber(p.quantity)}
                                </span>
                              ) : isPartialReturned ? (
                                <div className="flex flex-col items-end">
                                  <span className="line-through text-neutral-400 decoration-rose-500 text-[10.5px]">
                                    {formatNumber(p.quantity)}
                                  </span>
                                  <span className="font-bold text-emerald-800">
                                    Qoldi: {formatNumber(activeQty)}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-medium text-neutral-900">
                                  {formatNumber(p.quantity)}
                                </span>
                              )}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                                isFullyReturned ? 'line-through text-neutral-400' : 'text-neutral-700'
                              }`}
                            >
                              {formatMoney(p.unitPrice)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {isFullyReturned ? (
                                <span className="line-through text-neutral-400 decoration-rose-600 decoration-2 font-bold">
                                  {formatMoney(p.totalPrice)}
                                </span>
                              ) : isPartialReturned ? (
                                <div className="flex flex-col items-end">
                                  <span className="line-through text-neutral-400 text-[10.5px]">
                                    {formatMoney(p.totalPrice)}
                                  </span>
                                  <span className="font-bold text-neutral-900">
                                    {formatMoney(activeSum)}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-bold text-neutral-900">
                                  {formatMoney(p.totalPrice)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isFullyReturned ? (
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  Qaytarilgan
                                </span>
                              ) : p.paymentLabel === 'Qarzga' ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                  Qarzga
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  Naqdga
                                </span>
                              )}
                            </td>
                            {onNavigateToPlanDate && (
                              <td
                                className="py-2.5 px-3 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onNavigateToPlanDate({
                                        clientId: client.id,
                                        clientName: client.name,
                                        planId: p.planId,
                                        planDate: p.planDate,
                                        openEditModal: false,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10.5px] font-bold transition cursor-pointer"
                                    title={`${formatDateDMY(p.planDate)} kungi rejaga o'tish`}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Rejaga o&apos;tish</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onNavigateToPlanDate({
                                        clientId: client.id,
                                        clientName: client.name,
                                        planId: p.planId,
                                        planDate: p.planDate,
                                        openEditModal: true,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] font-bold transition cursor-pointer shadow-2xs"
                                    title={`${formatDateDMY(p.planDate)} kungi rejani ochib o'zgartirish`}
                                  >
                                    <Edit className="w-3 h-3" />
                                    <span>O&apos;zgartirish</span>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-rose-50/90 font-bold border-t-2 border-rose-200 sticky bottom-0 z-10 text-[11px]">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 text-neutral-900 uppercase">
                          JAMI FAOL: {formatNumber(totalFilteredProductsQty)} dona
                          {totalReturnedProductsQty > 0
                            ? ` (Qaytarilgan: ${formatNumber(totalReturnedProductsQty)} dona)`
                            : ''}
                        </td>
                        <td colSpan={2} />
                        <td className="py-2.5 px-3 text-right font-mono text-rose-950 tabular-nums text-xs sm:text-sm font-extrabold">
                          {formatMoney(totalFilteredProductsValue)}
                        </td>
                        <td colSpan={onNavigateToPlanDate ? 2 : 1} />
                      </tr>
                    </tfoot>
                  </table>
                </StickyTableWrapper>
              </div>
            )}
          </div>

          {/* AUDIT LOGS & O'ZGARISHLAR TARIXI with Date Filtering */}
          <div className="space-y-3 pt-3 border-t border-rose-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-rose-700" />
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                  O'zgarishlar tarixi va Loglar ({filteredLogs.length} ta)
                </h3>
              </div>
            </div>

            {/* Date filter bar for audit logs */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-neutral-100/70 border border-neutral-200 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-neutral-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Sana bo'yicha:</span>
                </span>
                {(['all', 'today', 'yesterday', 'last7', 'thisMonth'] as const).map((preset) => {
                  const labels = {
                    all: 'Barchasi',
                    today: 'Bugun',
                    yesterday: 'Kecha',
                    last7: 'Oxirgi 7 kun',
                    thisMonth: 'Bu oy',
                  };
                  const isActive = activeLogPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleLogPresetChange(preset)}
                      className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                        isActive
                          ? 'bg-neutral-900 text-white shadow-2xs'
                          : 'bg-white text-neutral-700 hover:bg-neutral-200 border border-neutral-300'
                      }`}
                    >
                      {labels[preset]}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="date"
                  value={logStartDate}
                  onChange={(e) => {
                    setLogStartDate(e.target.value);
                    setActiveLogPreset('custom');
                  }}
                  className="px-2 py-1 rounded-lg text-xs border border-neutral-300 bg-white font-mono"
                  title="Log boshlanish sanasi"
                />
                <span className="text-neutral-400 font-bold">-</span>
                <input
                  type="date"
                  value={logEndDate}
                  onChange={(e) => {
                    setLogEndDate(e.target.value);
                    setActiveLogPreset('custom');
                  }}
                  className="px-2 py-1 rounded-lg text-xs border border-neutral-300 bg-white font-mono"
                  title="Log tugash sanasi"
                />
                {(logStartDate || logEndDate) && (
                  <button
                    type="button"
                    onClick={() => handleLogPresetChange('all')}
                    className="text-[10.5px] text-neutral-700 hover:text-neutral-900 font-bold underline cursor-pointer px-1"
                  >
                    Tozalash
                  </button>
                )}
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-neutral-50 text-xs text-neutral-500">
                {(client.logs || []).length === 0
                  ? "Loglar mavjud emas."
                  : "Tanlangan sana yoki muddat oralig'ida loglar topilmadi."}
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            log.author === 'agentp1'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-rose-100 text-rose-900 border border-rose-200'
                          }`}
                        >
                          {getAgentDisplayName(log.author)}
                        </span>
                        <span className="font-bold text-neutral-900">{log.title}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-700 leading-relaxed pl-1">
                      {log.details}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* OXIRGI IZOH: Agent ko'rganda nomi "Oxirgi izoh" bo'ladi, sana va kim kiritgani ko'rinadi */}
          {/* ========================================================= */}
          {isAgent ? (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs text-neutral-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                <span className="font-bold text-amber-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-700" />
                  Oxirgi izoh
                </span>
                {latestAgentNote && (
                  <div className="text-[11px] font-mono text-neutral-600 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      Kiritdi: {getAgentDisplayName(latestAgentNote.author)}
                    </span>
                    <span>Sana: {formatDate(latestAgentNote.date)}</span>
                  </div>
                )}
              </div>

              <p className="whitespace-pre-line leading-relaxed text-neutral-900 text-xs sm:text-sm font-medium">
                {latestAgentNote?.text || client.notes || "Ushbu mijoz bo'yicha hali izoh kiritilmagan."}
              </p>
            </div>
          ) : (
            (latestAgentNote || client.notes) && (
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/80 pb-2">
                  <span className="font-bold text-neutral-900 block">
                    {latestAgentNote ? 'Oxirgi izoh' : "Qo'shimcha izoh / Kelishuv"}
                  </span>
                  {latestAgentNote && (
                    <span className="text-[11px] font-mono text-neutral-500">
                      Kiritdi: {getAgentDisplayName(latestAgentNote.author)} · {formatDate(latestAgentNote.date)}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-line leading-relaxed">
                  {latestAgentNote?.text || client.notes}
                </p>
              </div>
            )
          )}

          <div className="text-[11px] text-neutral-500 flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Qo'shilgan: {formatDate(client.createdAt)} ({getAgentDisplayName(client.createdBy || 'adminc')})
            </span>
            <span>Yangilangan: {formatDate(client.updatedAt)}</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL ACTION FOOTER: Agentda Chop etish / Chek va To'lov / Qarz o'zgartirish YO'Q */}
        {/* ========================================================= */}
        <div className="no-print px-5 sm:px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* O'chirish: Faqat adminc va adminc1 uchun */}
            {canDelete && !isConfirmingDelete && (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-100/80 transition min-h-[40px] cursor-pointer"
                title="Mijoz va unga oid ma'lumotlarni o'chirish"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>O'chirish</span>
              </button>
            )}

            {canDelete && isConfirmingDelete && (
              <div className="flex items-center gap-1.5 p-1 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[11px] font-bold text-rose-900 px-1.5">O'chirilsinmi?</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingDelete(false);
                    onDelete(client.id);
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 transition cursor-pointer shadow-xs"
                >
                  Ha, o'chirish
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-2 py-1.5 rounded-lg bg-neutral-200 text-neutral-800 text-xs font-semibold hover:bg-neutral-300 transition cursor-pointer"
                >
                  Bekor
                </button>
              </div>
            )}

          </div>

          <div className="flex items-center gap-2">
            {!isAgent && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(client);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition min-h-[40px] cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Tahrirlash</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 transition min-h-[40px] cursor-pointer"
            >
              Yopish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
