import React, { useState, useMemo } from 'react';
import { Client, DailyPlanItem } from '../types';
import { formatMoney, formatDateDMY, getAgentDisplayName } from '../utils/format';
import { storageService, isClosedPlanExpired7Days } from '../services/storage';
import { getClientLastOperations } from '../utils/clientActivityDates';
import { RejaPrintModal } from './RejaPrintModal';
import { StickyTableWrapper } from './StickyTableWrapper';
import {
  Users,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  CreditCard,
  Package,
  Activity,
  Search,
  Filter,
  Coins,
  Undo2,
  Lock,
  Unlock,
  MinusCircle,
  Eye,
  X,
  FileText,
  TrendingUp,
  Receipt,
  PackageCheck,
  PackageMinus,
  Calendar,
  Printer,
  Trash2,
} from 'lucide-react';

interface Props {
  plans: DailyPlanItem[];
  clients?: Client[];
  onRemovePlanItems?: (planItemIds: string[], reason: string) => void;
}

const PRESET_REMOVE_REASONS = [
  "Mijoz buyurtmani bekor qildi",
  "Reja xato kiritilgan",
  "Mijoz vaqtincha faoliyatini to'xtatgan",
  "Reja boshqa kunga ko'chirildi",
  "Mijoz bilan aloqa o'rnatib bo'lmadi",
];

export const AdminAgentPlansTable: React.FC<Props> = ({
  plans,
  clients,
  onRemovePlanItems,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Admin kirganda birinchi bo'lib hali bajarilib yopilmaganlar ('jarayonda') ko'rinadi, yopilganlar faqat 'bajarildi'da turadi
  const [statusFilter, setStatusFilter] = useState<'jarayonda' | 'bajarildi' | 'all'>('jarayonda');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  // Date filter state: 'all' | 'today' | 'yesterday' | 'custom'
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');

  // Closure type sub-filter: 'all' | 'done_closed' (Bajarib yopilgan) | 'undone_closed' (Bajarilmasdan yopilgan)
  const [closureTypeFilter, setClosureTypeFilter] = useState<'all' | 'done_closed' | 'undone_closed'>('all');

  // Payment filter & sort: 'all' | 'paid_only' | 'last_paid' | 'most_paid'
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid_only' | 'last_paid' | 'most_paid'>('all');

  // Selection & Removal from plan modal state (mandatory reason)
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [removeModalTargetIds, setRemoveModalTargetIds] = useState<string[] | null>(null);
  const [removeReason, setRemoveReason] = useState<string>('');
  const [selectedRemovePreset, setSelectedRemovePreset] = useState<string>('');

  const [inspectedPlan, setInspectedPlan] = useState<DailyPlanItem | null>(null);
  const [isAdminPdfModalOpen, setIsAdminPdfModalOpen] = useState<boolean>(false);

  const resolvedClients = useMemo(
    () => (clients && clients.length > 0 ? clients : storageService.getClients()),
    [clients]
  );
  const allSystemPlans = useMemo(() => {
    const stored = storageService.getDailyPlans();
    return stored.length >= plans.length ? stored : plans;
  }, [plans]);

  const formatActionLabel = (action?: string) => {
    if (action === 'telefon qilindi') return 'Telefon qilish / qilindi';
    if (action === 'joyiga borildi') return 'Joyiga borish / borildi';
    if (action === 'telefon qilindi + joyiga borildi') return 'Telefon + Joyiga borish';
    return action || '';
  };

  // Remaining 24h helper
  const getRemainingTimeStr = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const expires = created + 24 * 60 * 60 * 1000;
    const diffMs = expires - Date.now();
    if (diffMs <= 0) return 'Muddati: Faol';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} soat ${mins} daqiqa qoldi`;
  };

  // Helper to extract all action transactions for a plan item
  const getPlanActions = (p: DailyPlanItem) => {
    if (p.actionsHistory && p.actionsHistory.length > 0) {
      return p.actionsHistory;
    }
    if (
      p.actionDone ||
      p.financialAction ||
      p.productsDelivered ||
      p.deliveryPayment ||
      p.productsReturned
    ) {
      return [
        {
          timestamp: p.completedAt || p.createdAt,
          author: p.agentUsername,
          actionDone: p.actionDone || ('joyiga borildi' as const),
          financialAction: p.financialAction,
          deliveryPayment: p.deliveryPayment,
          productsDelivered: p.productsDelivered,
          productsReturned: p.productsReturned,
          reportNote: p.reportNote,
        },
      ];
    }
    return [];
  };

  // Har bir mijoz rejada faqat bir marta ko'rinishini kafolatlash (dublikatlarsiz) va 7 kundan oshgan yopilganlarni yashirish
  const uniquePlans = useMemo(() => {
    const byClient = new Map<string, DailyPlanItem>();
    for (const p of plans) {
      if (!p || !p.clientId || isClosedPlanExpired7Days(p)) continue;
      const existing = byClient.get(p.clientId);
      if (!existing) {
        byClient.set(p.clientId, p);
      } else {
        const eOpen = !existing.isClosed && existing.status !== 'yopildi';
        const cOpen = !p.isClosed && p.status !== 'yopildi';
        const eReopenFresh = Boolean(existing.reopenedAt && eOpen);
        const cReopenFresh = Boolean(p.reopenedAt && cOpen);
        const eTime = new Date(existing.reopenedAt || existing.closedAt || existing.completedAt || existing.createdAt || 0).getTime();
        const cTime = new Date(p.reopenedAt || p.closedAt || p.completedAt || p.createdAt || 0).getTime();

        if (cOpen && !eOpen) {
          // Ochiq reja har doim eski yopilgan rejadan ustun
          byClient.set(p.clientId, p);
        } else if (eOpen && !cOpen) {
          // Mavjud ochiq reja eski yopilgan reja bilan almashtirilmaydi
        } else if (cReopenFresh && !eReopenFresh) {
          byClient.set(p.clientId, p);
        } else if (eReopenFresh && !cReopenFresh) {
          // keep existing
        } else if (cTime >= eTime) {
          byClient.set(p.clientId, p);
        }
      }
    }
    return Array.from(byClient.values());
  }, [plans]);

  // Mijoz bo'yicha reja yopilganligini tekshirish (yopilganlar Bajarildi ichida, ochiqlari Jarayonda)
  const isPlanCompleted = (p: DailyPlanItem): boolean => {
    return Boolean(p.isClosed || p.status === 'yopildi');
  };

  // Yopilgan reja bajarilmasdan yopilganligini tekshirish
  const isPlanClosedWithoutAction = (p: DailyPlanItem): boolean => {
    if (p.closedWithoutAction !== undefined) return p.closedWithoutAction;
    const actions = getPlanActions(p);
    return !p.actionDone && actions.length === 0;
  };

  // Reja ichidagi jami tushumni hisoblash yordamchisi
  const getPlanPaidAmount = (p: DailyPlanItem): number => {
    let sum = 0;
    const actions = getPlanActions(p);
    actions.forEach((act) => {
      if (act.financialAction && act.financialAction.amount > 0) {
        sum += act.financialAction.amount;
      }
      if (act.deliveryPayment && act.deliveryPayment.paidAmount > 0) {
        sum += act.deliveryPayment.paidAmount;
      }
    });
    return sum;
  };

  // Unique agents list
  const uniqueAgents = useMemo(() => {
    const set = new Set<string>();
    uniquePlans.forEach((p) => {
      if (p.agentUsername) set.add(p.agentUsername);
    });
    return Array.from(set).sort();
  }, [uniquePlans]);

  // Reja sanasini aniqlash yordamchisi (YYYY-MM-DD)
  const getPlanDateKey = (p: DailyPlanItem): string => {
    if (p.planDate) return p.planDate.slice(0, 10);
    if (p.createdAt) {
      try {
        const d = new Date(p.createdAt);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-CA');
        }
      } catch {
        // fallback
      }
      return p.createdAt.slice(0, 10);
    }
    return '';
  };

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
  }, []);

  const dateScopeLabel = useMemo(() => {
    if (dateFilter === 'today') return 'Bugun';
    if (dateFilter === 'yesterday') return 'Kecha';
    if (dateFilter === 'custom' && customDate) return customDate;
    return 'Barcha sanalar';
  }, [dateFilter, customDate]);

  // 4 ta tahliliy bloklar hisobi: sana, tanlangan agent va holat bo'yicha dinamik moslashadi
  const analytics = useMemo(() => {
    // 1. Avval sana va tanlangan agent bo'yicha saralash
    const dateAndAgentPlans = uniquePlans.filter((p) => {
      if (selectedAgent !== 'all' && p.agentUsername !== selectedAgent) {
        return false;
      }
      if (dateFilter !== 'all') {
        const planDateStr = getPlanDateKey(p);
        if (dateFilter === 'today' && planDateStr !== todayStr) return false;
        if (dateFilter === 'yesterday' && planDateStr !== yesterdayStr) return false;
        if (dateFilter === 'custom' && customDate && planDateStr !== customDate) return false;
      }
      return true;
    });

    const totalClients = dateAndAgentPlans.length;
    let completedClients = 0; // Yopilganlar / Bajarilganlar
    let inProgressClients = 0; // Hali yopilmagan ochiq rejalar

    dateAndAgentPlans.forEach((p) => {
      if (isPlanCompleted(p)) {
        completedClients++;
      } else {
        inProgressClients++;
      }
    });

    // 2. Tushumlar va mahsulotlar (2, 3 va 4-bloklar) uchun nishon rejalar:
    // Standart holatda ('jarayonda') faqat HALI YOPILMAGANLAR hisoblanadi.
    // Agar yopilganlar ham qo'shilsa ('all'), barchasi (ochiq va yopilganlar) hisoblanadi.
    // Agar 'bajarildi' bo'lsa, faqat yopilganlar hisoblanadi.
    const metricTargetPlans = dateAndAgentPlans.filter((p) => {
      const isDone = isPlanCompleted(p);
      if (statusFilter === 'all') return true; // Yopilganlar ham qo'shilgan
      if (statusFilter === 'bajarildi') return isDone; // Faqat yopilganlar
      return !isDone; // Faqat yopilmagan ochiq rejalar ('jarayonda')
    });

    let totalReceipts = 0; // Jami tushumlar
    const receiptsByType = {
      naqd: { amount: 0, count: 0, label: 'Naqd pul' },
      bank: { amount: 0, count: 0, label: "Bank o'tkazmasi" },
      karta: { amount: 0, count: 0, label: "Karta o'tkazmasi" },
      qr: { amount: 0, count: 0, label: "QR to'lov" },
    };

    let totalDeliveredSum = 0; // Mahsulot berilishi jami summasi
    let totalDeliveredPieces = 0; // Mahsulot berilishi jami soni
    let totalReturnedSum = 0; // Mahsulot qaytishi jami summasi
    let totalReturnedPieces = 0; // Mahsulot qaytishi jami soni

    metricTargetPlans.forEach((p) => {
      const actions = getPlanActions(p);
      actions.forEach((act) => {
        // 1. Direct financial action from Section 2 (supports single or multi-method splits)
        if (act.financialAction && act.financialAction.amount > 0) {
          const splits = act.financialAction.splits;
          if (splits && splits.length > 0) {
            splits.forEach((sp) => {
              if (!sp || sp.amount <= 0) return;
              totalReceipts += sp.amount;
              const mStr = (sp.method || sp.methodLabel || '').toLowerCase();
              if (mStr.includes('bank')) {
                receiptsByType.bank.amount += sp.amount;
                receiptsByType.bank.count++;
              } else if (mStr.includes('karta')) {
                receiptsByType.karta.amount += sp.amount;
                receiptsByType.karta.count++;
              } else if (mStr.includes('qr')) {
                receiptsByType.qr.amount += sp.amount;
                receiptsByType.qr.count++;
              } else {
                receiptsByType.naqd.amount += sp.amount;
                receiptsByType.naqd.count++;
              }
            });
          } else {
            const amt = act.financialAction.amount;
            totalReceipts += amt;
            const methodStr = (act.financialAction.methodLabel || '').toLowerCase();

            if (methodStr.includes('bank')) {
              receiptsByType.bank.amount += amt;
              receiptsByType.bank.count++;
            } else if (methodStr.includes('karta')) {
              receiptsByType.karta.amount += amt;
              receiptsByType.karta.count++;
            } else if (methodStr.includes('qr')) {
              receiptsByType.qr.amount += amt;
              receiptsByType.qr.count++;
            } else {
              receiptsByType.naqd.amount += amt;
              receiptsByType.naqd.count++;
            }
          }
        }

        // 2. Delivery payment from Section 3
        if (act.deliveryPayment && act.deliveryPayment.paidAmount > 0) {
          const amt = act.deliveryPayment.paidAmount;
          totalReceipts += amt;
          const pt = act.deliveryPayment.paymentType;

          if (pt === 'bank') {
            receiptsByType.bank.amount += amt;
            receiptsByType.bank.count++;
          } else if (pt === 'karta') {
            receiptsByType.karta.amount += amt;
            receiptsByType.karta.count++;
          } else if (pt === 'qr') {
            receiptsByType.qr.amount += amt;
            receiptsByType.qr.count++;
          } else {
            receiptsByType.naqd.amount += amt;
            receiptsByType.naqd.count++;
          }
        }

        // 3. Delivered products sum and count
        if (act.productsDelivered && act.productsDelivered.length > 0) {
          act.productsDelivered.forEach((prod) => {
            const lineVal = prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0);
            totalDeliveredSum += lineVal;
            totalDeliveredPieces += prod.quantity || 0;
          });
        }

        // 4. Returned products sum and count
        if (act.productsReturned && act.productsReturned.length > 0) {
          act.productsReturned.forEach((ret) => {
            const lineVal = (ret.quantity || 0) * (ret.unitPrice || 0);
            totalReturnedSum += lineVal;
            totalReturnedPieces += ret.quantity || 0;
          });
        }
      });
    });

    const getPct = (amt: number) => {
      if (totalReceipts <= 0) return 0;
      return Math.round((amt / totalReceipts) * 100);
    };

    return {
      totalClients,
      completedClients,
      inProgressClients,
      metricTargetCount: metricTargetPlans.length,
      totalReceipts,
      receiptsByType: {
        naqd: { ...receiptsByType.naqd, percent: getPct(receiptsByType.naqd.amount) },
        bank: { ...receiptsByType.bank, percent: getPct(receiptsByType.bank.amount) },
        karta: { ...receiptsByType.karta, percent: getPct(receiptsByType.karta.amount) },
        qr: { ...receiptsByType.qr, percent: getPct(receiptsByType.qr.amount) },
      },
      totalDeliveredSum,
      totalDeliveredPieces,
      totalReturnedSum,
      totalReturnedPieces,
    };
  }, [uniquePlans, selectedAgent, dateFilter, customDate, statusFilter, todayStr, yesterdayStr]);

  // Filtered plans list
  const filteredPlans = useMemo(() => {
    const baseFiltered = uniquePlans.filter((p) => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesClient = p.clientName.toLowerCase().includes(q);
        const matchesPhone = p.clientPhone.toLowerCase().includes(q);
        const matchesAddress = (p.clientAddress || '').toLowerCase().includes(q);
        const matchesAgent =
          p.agentUsername.toLowerCase().includes(q) ||
          getAgentDisplayName(p.agentUsername).toLowerCase().includes(q);
        const matchesNote =
          (p.planNote || '').toLowerCase().includes(q) ||
          (p.reopenReason || '').toLowerCase().includes(q) ||
          (p.closeReason || '').toLowerCase().includes(q);
        if (!matchesClient && !matchesPhone && !matchesAddress && !matchesAgent && !matchesNote) {
          return false;
        }
      }

      // 2. Status filter: Yopilgan va bajarilganlar faqat 'bajarildi' tabida turadi, 'jarayonda'da faqat hali bajarilib yopilmaganlar ko'rinadi
      const completedOrClosed = isPlanCompleted(p);
      if (statusFilter === 'bajarildi' && !completedOrClosed) return false;
      if (statusFilter === 'jarayonda' && completedOrClosed) return false;

      // 2.5. Closure sub-filter: Bajarib yopilgan / Bajarilmasdan yopilgan
      if (closureTypeFilter !== 'all') {
        if (!completedOrClosed) return false;
        const withoutAction = isPlanClosedWithoutAction(p);
        if (closureTypeFilter === 'done_closed' && withoutAction) return false;
        if (closureTypeFilter === 'undone_closed' && !withoutAction) return false;
      }

      // 3. Date filter: 'all' | 'today' | 'yesterday' | 'custom'
      if (dateFilter !== 'all') {
        const planDateStr = getPlanDateKey(p);
        if (dateFilter === 'today' && planDateStr !== todayStr) return false;
        if (dateFilter === 'yesterday' && planDateStr !== yesterdayStr) return false;
        if (dateFilter === 'custom' && customDate && planDateStr !== customDate) return false;
      }

      // 4. Agent filter
      if (selectedAgent !== 'all' && p.agentUsername !== selectedAgent) {
        return false;
      }

      // 5. Payment filter
      if (paymentFilter !== 'all') {
        const planPaid = getPlanPaidAmount(p);
        const lastOps = getClientLastOperations(p.clientId, resolvedClients, allSystemPlans);
        const hasAnyPayment =
          planPaid > 0 || Boolean(lastOps.lastPaymentAmount && lastOps.lastPaymentAmount > 0);
        if (!hasAnyPayment) return false;
      }

      return true;
    });

    if (paymentFilter === 'last_paid') {
      return [...baseFiltered].sort((a, b) => {
        const opsA = getClientLastOperations(a.clientId, resolvedClients, allSystemPlans);
        const opsB = getClientLastOperations(b.clientId, resolvedClients, allSystemPlans);
        const tA = opsA.lastPaymentTimestamp ? new Date(opsA.lastPaymentTimestamp).getTime() : 0;
        const tB = opsB.lastPaymentTimestamp ? new Date(opsB.lastPaymentTimestamp).getTime() : 0;
        return tB - tA;
      });
    }

    if (paymentFilter === 'most_paid') {
      return [...baseFiltered].sort((a, b) => {
        const paidA = getPlanPaidAmount(a);
        const paidB = getPlanPaidAmount(b);
        const opsA = getClientLastOperations(a.clientId, resolvedClients, allSystemPlans);
        const opsB = getClientLastOperations(b.clientId, resolvedClients, allSystemPlans);
        const valA = paidA > 0 ? paidA : opsA.lastPaymentAmount || 0;
        const valB = paidB > 0 ? paidB : opsB.lastPaymentAmount || 0;
        return valB - valA;
      });
    }

    return baseFiltered.sort((a, b) => {
      // Hali bajarilib yopilmaganlar har doim birinchi turadi
      const aDone = isPlanCompleted(a) ? 1 : 0;
      const bDone = isPlanCompleted(b) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [
    uniquePlans,
    searchTerm,
    statusFilter,
    closureTypeFilter,
    paymentFilter,
    selectedAgent,
    dateFilter,
    customDate,
    todayStr,
    yesterdayStr,
    resolvedClients,
    allSystemPlans,
  ]);

  const toggleSelectPlanItem = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e) e.stopPropagation();
    setSelectedPlanIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    const allIds = filteredPlans.map((p) => p.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedPlanIds.includes(id));
    if (allSelected) {
      setSelectedPlanIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedPlanIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleOpenRemoveSingle = (item: DailyPlanItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRemoveModalTargetIds([item.id]);
    setRemoveReason('');
    setSelectedRemovePreset('');
  };

  const handleOpenRemoveBulk = () => {
    const validSelected = selectedPlanIds.filter((id) =>
      filteredPlans.some((p) => p.id === id)
    );
    if (validSelected.length === 0) return;
    setRemoveModalTargetIds(validSelected);
    setRemoveReason('');
    setSelectedRemovePreset('');
  };

  const handleExecuteRemove = () => {
    if (!removeModalTargetIds || removeModalTargetIds.length === 0) return;
    const finalReason = (removeReason.trim() || selectedRemovePreset).trim();
    if (!finalReason) return;
    if (onRemovePlanItems) {
      onRemovePlanItems(removeModalTargetIds, finalReason);
    }
    setSelectedPlanIds((prev) => prev.filter((id) => !removeModalTargetIds.includes(id)));
    setRemoveModalTargetIds(null);
    setRemoveReason('');
    setSelectedRemovePreset('');
  };

  return (
    <div className="space-y-5">
      {/* ========================================================= */}
      {/* 4 TA TAHLILIY STATISTIKA KARTALARI (Admin uchun) */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="font-bold text-neutral-800">
            📊 Tahliliy ko'rsatkichlar:
          </span>
          <span className="px-2 py-0.5 rounded-md bg-neutral-100 font-semibold text-neutral-700">
            Sana: {dateScopeLabel}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md font-semibold ${
              statusFilter === 'all'
                ? 'bg-purple-100 text-purple-800'
                : statusFilter === 'bajarildi'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {statusFilter === 'all'
              ? "Holat: Yopilganlar ham qo'shilgan"
              : statusFilter === 'bajarildi'
              ? 'Holat: Faqat yopilganlar'
              : 'Holat: Faqat yopilmaganlar'}
          </span>
        </div>

        {/* Tezkor almashtirish tugmasi */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'all' ? 'jarayonda' : 'all')}
          className="text-xs font-bold text-rose-700 hover:text-rose-800 underline flex items-center gap-1 cursor-pointer"
        >
          {statusFilter === 'all'
            ? "↩ Faqat yopilmaganlarni ko'rsatish"
            : "+ Yopilganlarni ham hisobga qo'shish"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KARTA 1: Yopilmagan rejadagi mijozlar */}
        <div
          onClick={() => {
            if (statusFilter === 'all') {
              setStatusFilter('jarayonda');
            } else if (statusFilter === 'jarayonda') {
              setStatusFilter('all');
            } else {
              setStatusFilter('jarayonda');
            }
          }}
          className="p-4 sm:p-5 rounded-3xl bg-neutral-900 text-white shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] cursor-pointer hover:bg-neutral-800 transition group"
          title={
            statusFilter === 'all'
              ? "Yopilganlar qo'shilgan. Bosib faqat yopilmaganlarni ko'rish"
              : "Yopilmaganlar ko'rsatilmoqda. Bosib yopilganlarni ham qo'shish"
          }
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wide truncate">
                {statusFilter === 'all'
                  ? 'Rejadagi mijozlar (Yopilganlar bilan)'
                  : statusFilter === 'bajarildi'
                  ? 'Yopilgan rejadagi mijozlar'
                  : 'Yopilmagan rejadagi mijozlar'}
              </span>
              <Users className="w-4 h-4 text-rose-400 shrink-0" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-display tabular-nums">
              {statusFilter === 'all'
                ? `${analytics.totalClients} ta mijoz`
                : statusFilter === 'bajarildi'
                ? `${analytics.completedClients} ta mijoz`
                : `${analytics.inProgressClients} ta mijoz`}
            </div>
          </div>
          <div className="text-[11px] text-neutral-400 flex items-center justify-between pt-2 border-t border-neutral-800">
            {statusFilter === 'all' ? (
              <span className="text-neutral-300 font-semibold flex items-center gap-1.5">
                <span>● {analytics.inProgressClients} ta ochiq</span>
                <span className="text-neutral-600">·</span>
                <span className="text-emerald-400">● {analytics.completedClients} ta yopilgan</span>
              </span>
            ) : statusFilter === 'bajarildi' ? (
              <span className="text-emerald-400 font-semibold">
                ● {analytics.completedClients} ta yopilgan reja
              </span>
            ) : (
              <span className="text-amber-300 font-semibold">
                ● {analytics.inProgressClients} ta ochiq reja (Hozirgi vaqtda)
              </span>
            )}
            <span className="text-[10px] text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-md font-mono">
              {dateScopeLabel}
            </span>
          </div>
        </div>

        {/* KARTA 2: Tushumlar va barcha turdagi to'lovlarning foizlari/summalari */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-rose-100 shadow-xs flex flex-col justify-between min-h-[140px] space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">
                  Tushumlar
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                    statusFilter === 'all'
                      ? 'bg-purple-100 text-purple-700'
                      : statusFilter === 'bajarildi'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {statusFilter === 'all'
                    ? 'Yopilganlar bilan'
                    : statusFilter === 'bajarildi'
                    ? 'Yopilganlar'
                    : 'Faqat yopilmaganlar'}
                </span>
              </div>
              <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-display font-mono text-emerald-800 tabular-nums">
              {formatMoney(analytics.totalReceipts)}
            </div>
          </div>

          {/* To'lov turlari bo'yicha summa va foizlar */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-100">
            {/* Visual multi-color stacked bar */}
            {analytics.totalReceipts > 0 ? (
              <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden flex">
                <div
                  style={{ width: `${analytics.receiptsByType.naqd.percent}%` }}
                  className="bg-emerald-500 h-full"
                  title={`Naqd: ${analytics.receiptsByType.naqd.percent}%`}
                />
                <div
                  style={{ width: `${analytics.receiptsByType.bank.percent}%` }}
                  className="bg-blue-500 h-full"
                  title={`Bank: ${analytics.receiptsByType.bank.percent}%`}
                />
                <div
                  style={{ width: `${analytics.receiptsByType.karta.percent}%` }}
                  className="bg-purple-500 h-full"
                  title={`Karta: ${analytics.receiptsByType.karta.percent}%`}
                />
                <div
                  style={{ width: `${analytics.receiptsByType.qr.percent}%` }}
                  className="bg-amber-500 h-full"
                  title={`QR: ${analytics.receiptsByType.qr.percent}%`}
                />
              </div>
            ) : null}

            {/* List of 4 types with sums & percentages */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
              <div className="flex items-center justify-between text-neutral-700">
                <span className="flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Naqd:
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {analytics.receiptsByType.naqd.percent}%
                </span>
              </div>

              <div className="flex items-center justify-between text-neutral-700">
                <span className="flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  Bank:
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {analytics.receiptsByType.bank.percent}%
                </span>
              </div>

              <div className="flex items-center justify-between text-neutral-700">
                <span className="flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  Karta:
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {analytics.receiptsByType.karta.percent}%
                </span>
              </div>

              <div className="flex items-center justify-between text-neutral-700">
                <span className="flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  QR:
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {analytics.receiptsByType.qr.percent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KARTA 3: Mahsulot berilishi (summasi bilan) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-rose-100 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">
                  Mahsulot berilishi
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                    statusFilter === 'all'
                      ? 'bg-purple-100 text-purple-700'
                      : statusFilter === 'bajarildi'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {statusFilter === 'all'
                    ? 'Yopilganlar bilan'
                    : statusFilter === 'bajarildi'
                    ? 'Yopilganlar'
                    : 'Faqat yopilmaganlar'}
                </span>
              </div>
              <PackageCheck className="w-4 h-4 text-rose-700 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-display font-mono text-rose-900 tabular-nums">
              {formatMoney(analytics.totalDeliveredSum)}
            </div>
          </div>
          <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
            <span>Topshirilgan tovarlar:</span>
            <span className="font-bold font-mono text-neutral-800">
              {analytics.totalDeliveredPieces} dona
            </span>
          </div>
        </div>

        {/* KARTA 4: Mahsulot qaytishi (summasi bilan) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-rose-100 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">
                  Mahsulot qaytishi
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                    statusFilter === 'all'
                      ? 'bg-purple-100 text-purple-700'
                      : statusFilter === 'bajarildi'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {statusFilter === 'all'
                    ? 'Yopilganlar bilan'
                    : statusFilter === 'bajarildi'
                    ? 'Yopilganlar'
                    : 'Faqat yopilmaganlar'}
                </span>
              </div>
              <PackageMinus className="w-4 h-4 text-amber-700 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-display font-mono text-amber-900 tabular-nums">
              {formatMoney(analytics.totalReturnedSum)}
            </div>
          </div>
          <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
            <span>Omborga qaytgan tovarlar:</span>
            <span className="font-bold font-mono text-neutral-800">
              {analytics.totalReturnedPieces} dona
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FILTRLAR VA QIDIRUV PANELI */}
      {/* ========================================================= */}
      <div className="p-4 rounded-2xl bg-white border border-rose-100/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Matn qidirish */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Mijoz, telefon, manzil yoki izoh bo'yicha qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 focus:bg-white rounded-xl border border-neutral-200 focus:border-rose-500 outline-none transition"
          />
        </div>

        {/* Agent va holat bo'yicha filtrlar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Agent tanlash */}
          {uniqueAgents.length > 1 && (
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-neutral-50 rounded-xl border border-neutral-200 outline-none cursor-pointer"
            >
              <option value="all">Barcha agentlar ({uniqueAgents.length})</option>
              {uniqueAgents.map((ag) => (
                <option key={ag} value={ag}>
                  Agent: {getAgentDisplayName(ag)}
                </option>
              ))}
            </select>
          )}

          {/* Holat filtri: adminc orqali kirganda birinchi bo'lib yopilmagan rejadagi mijozlar ko'rinadi */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('jarayonda')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                statusFilter === 'jarayonda'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Yopilmagan reja (Ochiq: {analytics.inProgressClients})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('bajarildi')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                statusFilter === 'bajarildi'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Yopilganlar ({analytics.completedClients})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Barchasi (Yopilganlar bilan: {analytics.totalClients})
            </button>
          </div>

          {/* Rejani PDF (Print) tugmasi (Admin uchun) */}
          {filteredPlans.length > 0 && (
            <button
              type="button"
              onClick={() => setIsAdminPdfModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Rejadagi tanlangan mijozlarni to'liq A4 listda PDF / Print qilish"
            >
              <Printer className="w-3.5 h-3.5 text-rose-400" />
              <span>Rejani PDF (Print)</span>
            </button>
          )}
        </div>
      </div>

      {/* Sana bo'yicha filtr paneli */}
      <div className="px-4 py-2.5 rounded-2xl bg-rose-50/40 border border-rose-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-neutral-700 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-rose-600" />
            <span>Sana bo'yicha filtr:</span>
          </span>
          <button
            type="button"
            onClick={() => setDateFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              dateFilter === 'all'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Barcha sanalar
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('today')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              dateFilter === 'today'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Bugun
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('yesterday')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              dateFilter === 'yesterday'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Kecha
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('custom')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              dateFilter === 'custom'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Maxsus sana
          </button>
          {dateFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-2 py-1 rounded-lg border border-neutral-300 text-xs font-mono font-medium outline-none focus:border-rose-500 bg-white"
            />
          )}
        </div>
        <div className="text-[11px] font-medium text-neutral-500">
          Ko'rsatilmoqda: <strong className="text-neutral-800">{filteredPlans.length} ta</strong> rejadagi mijoz
        </div>
      </div>

      {/* Yopilish holati (Bajarib / Bajarilmasdan yopilgan) va To'lov bo'yicha saralash / filtr paneli */}
      <div className="px-4 py-2.5 rounded-2xl bg-white border border-rose-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-neutral-700">Yopilish holati:</span>
          <button
            type="button"
            onClick={() => setClosureTypeFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              closureTypeFilter === 'all'
                ? 'bg-neutral-800 text-white shadow-2xs'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Barchasi
          </button>
          <button
            type="button"
            onClick={() => {
              if (statusFilter === 'jarayonda') setStatusFilter('bajarildi');
              setClosureTypeFilter('done_closed');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              closureTypeFilter === 'done_closed'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Bajarib yopilgan ({uniquePlans.filter((p) => isPlanCompleted(p) && !isPlanClosedWithoutAction(p)).length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (statusFilter === 'jarayonda') setStatusFilter('bajarildi');
              setClosureTypeFilter('undone_closed');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              closureTypeFilter === 'undone_closed'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Bajarilmasdan yopilgan ({uniquePlans.filter((p) => isPlanCompleted(p) && isPlanClosedWithoutAction(p)).length})
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-neutral-700">To'lov bo'yicha:</span>
          <button
            type="button"
            onClick={() => setPaymentFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              paymentFilter === 'all'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Barchasi
          </button>
          <button
            type="button"
            onClick={() => setPaymentFilter('paid_only')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              paymentFilter === 'paid_only'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Pul berganlar
          </button>
          <button
            type="button"
            onClick={() => setPaymentFilter('last_paid')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              paymentFilter === 'last_paid'
                ? 'bg-indigo-700 text-white shadow-2xs'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            Oxirgi pul bergani asosida
          </button>
          <button
            type="button"
            onClick={() => setPaymentFilter('most_paid')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              paymentFilter === 'most_paid'
                ? 'bg-purple-700 text-white shadow-2xs'
                : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            Ko'p pul bergan asosida
          </button>
        </div>
      </div>

      {/* Multi-Selection & Bulk Actions Bar */}
      {filteredPlans.length > 0 && (
        <div className="px-4 py-2.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <label className="inline-flex items-center gap-2 font-bold text-neutral-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={
                filteredPlans.length > 0 &&
                filteredPlans.every((p) => selectedPlanIds.includes(p.id))
              }
              onChange={toggleSelectAllFiltered}
              className="w-4 h-4 rounded border-neutral-300 text-rose-700 focus:ring-rose-500 cursor-pointer"
            />
            <span>
              Mijozlarni tanlash ({selectedPlanIds.filter((id) => filteredPlans.some((p) => p.id === id)).length} / {filteredPlans.length} ta tanlandi)
            </span>
          </label>

          <div className="flex items-center gap-2">
            {selectedPlanIds.filter((id) => filteredPlans.some((p) => p.id === id)).length > 0 && (
              <button
                type="button"
                onClick={handleOpenRemoveBulk}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  Rejadan olib tashlash ({selectedPlanIds.filter((id) => filteredPlans.some((p) => p.id === id)).length} ta)
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* JADVAL QISMI */}
      {/* ========================================================= */}
      {filteredPlans.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
          <Activity className="w-8 h-8 text-neutral-400 mx-auto" />
          <h4 className="text-sm font-bold text-neutral-800">
            {plans.length === 0
              ? 'Hozircha agentlar tomonidan faol kunlik reja tuzilmagan'
              : "Filtr bo'yicha rejalar topilmadi"}
          </h4>
          {plans.length > 0 && (
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Qidiruv mezonlarini o'zgartirib ko'ring.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Mobil qurilmalar uchun moslashuvchan ko'rinish (md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredPlans.map((item, idx) => {
              const isClosed = item.isClosed || item.status === 'yopildi';
              const isCompleted = isPlanCompleted(item);
              const actions = getPlanActions(item);
              const hasActions = actions.length > 0;

              let planReceipts = 0;
              let planReceiptMethods: string[] = [];
              let planDeliveredSum = 0;
              let planDeliveredCount = 0;
              let planReturnedSum = 0;
              let planReturnedCount = 0;
              let visitActionLabels: string[] = [];

              actions.forEach((act) => {
                if (act.actionDone && !visitActionLabels.includes(act.actionDone)) {
                  visitActionLabels.push(act.actionDone);
                }
                if (act.financialAction && act.financialAction.amount > 0) {
                  planReceipts += act.financialAction.amount;
                  const l = act.financialAction.methodLabel || "To'lov";
                  if (!planReceiptMethods.includes(l)) planReceiptMethods.push(l);
                }
                if (act.deliveryPayment && act.deliveryPayment.paidAmount > 0) {
                  planReceipts += act.deliveryPayment.paidAmount;
                  const l = act.deliveryPayment.paymentLabel || "Tovar to'lovi";
                  if (!planReceiptMethods.includes(l)) planReceiptMethods.push(l);
                }
                if (act.productsDelivered && act.productsDelivered.length > 0) {
                  act.productsDelivered.forEach((p) => {
                    const v = p.totalPrice || (p.quantity || 0) * (p.unitPrice || 0);
                    planDeliveredSum += v;
                    planDeliveredCount += p.quantity || 0;
                  });
                }
                if (act.productsReturned && act.productsReturned.length > 0) {
                  act.productsReturned.forEach((r) => {
                    const v = (r.quantity || 0) * (r.unitPrice || 0);
                    planReturnedSum += v;
                    planReturnedCount += r.quantity || 0;
                  });
                }
              });

              const lastOps = getClientLastOperations(item.clientId, resolvedClients, plans);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isClosed
                      ? 'bg-neutral-50/80 border-neutral-200'
                      : 'bg-white border-rose-100 shadow-xs hover:border-rose-300'
                  }`}
                >
                  {/* Top Bar: #, Agent, Status */}
                  <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedPlanIds.includes(item.id)}
                        onChange={(e) => toggleSelectPlanItem(item.id, e)}
                        className="w-4 h-4 rounded border-neutral-300 text-rose-700 focus:ring-rose-500 cursor-pointer"
                        title="Tanlash"
                      />
                      <span className="font-mono text-xs font-bold text-neutral-400">
                        #{idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 truncate">
                        Reja tuzdi: {getAgentDisplayName(item.agentUsername)}
                      </span>
                      {(() => {
                        const executor =
                          item.lastExecutedBy ||
                          (item.actionsHistory && item.actionsHistory.length > 0
                            ? item.actionsHistory[0].author
                            : undefined);
                        if (!executor) return null;
                        return (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 truncate">
                            Bajardi: {getAgentDisplayName(executor)}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="shrink-0">
                      {isClosed ? (
                        isPlanClosedWithoutAction(item) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Lock className="w-2.5 h-2.5 text-amber-700" />
                            <span>Bajarilmasdan yopilgan</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                            <span>Bajarib yopilgan</span>
                          </span>
                        )
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Bajarildi</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Amal kutilmoqda</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="mt-2.5">
                    <h5 className="font-extrabold text-neutral-900 text-sm">
                      {item.clientName}
                    </h5>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 mt-1">
                      <a
                        href={`tel:${item.clientPhone}`}
                        className="inline-flex items-center gap-1 text-rose-700 font-mono hover:underline"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{item.clientPhone}</span>
                      </a>
                      <div className="inline-flex items-center gap-1 text-neutral-500 truncate max-w-full">
                        <MapPin className="w-3 h-3 text-rose-600 shrink-0" />
                        <span className="truncate">
                          {[item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') || item.clientAddress || "Manzil yo'q"}
                          {item.clientLandmark ? ` (${item.clientLandmark})` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-neutral-500 text-[10.5px] font-mono mt-1">
                      <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span>Reja sanasi: {formatDateDMY(item.planDate || item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Financial Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-neutral-100 text-[11px]">
                    <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-2">
                      <div className="text-[10px] uppercase font-bold text-rose-700">
                        Joriy qarz / Haqdorlik:
                      </div>
                      <div className="mt-0.5 font-mono font-extrabold">
                        {lastOps.currentDebt > 0 ? (
                          <span className="text-rose-700">{formatMoney(lastOps.currentDebt)}</span>
                        ) : lastOps.currentAdvance > 0 ? (
                          <span className="text-emerald-700">+{formatMoney(lastOps.currentAdvance)} (Haqdor)</span>
                        ) : (
                          <span className="text-neutral-500">0 USD</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2">
                      <div className="text-[10px] uppercase font-bold text-emerald-800">
                        Oxirgi pul bergan:
                      </div>
                      <div className="mt-0.5 font-mono font-bold text-emerald-900 truncate">
                        {lastOps.lastPaymentFormatted || <span className="text-neutral-400 italic">To'lov yo'q</span>}
                      </div>
                    </div>
                  </div>

                  {/* Reja va Amal summary */}
                  <div className="mt-2.5 bg-neutral-50 rounded-xl p-2 space-y-1.5 text-xs">
                    {(item.plannedAction || (item.plannedAmount !== undefined && item.plannedAmount > 0)) && (
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        {item.plannedAction && (
                          <span className="font-bold text-amber-950 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-200">
                            Rejadagi amal: {formatActionLabel(item.plannedAction)}
                          </span>
                        )}
                        {item.plannedAmount !== undefined && item.plannedAmount > 0 && (
                          <span className="font-mono font-bold text-emerald-900 bg-emerald-100/70 px-1.5 py-0.5 rounded border border-emerald-200">
                            Undirish: {formatMoney(item.plannedAmount)}
                          </span>
                        )}
                      </div>
                    )}

                    {item.planNote && (
                      <p className="text-[11px] text-neutral-600 italic">
                        Izoh: {item.planNote}
                      </p>
                    )}

                    {hasActions ? (
                      <div className="space-y-1 pt-1 border-t border-neutral-200/60">
                        {visitActionLabels.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {visitActionLabels.map((vLabel, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[10px]"
                              >
                                Bajardi: {formatActionLabel(vLabel)}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                          {planReceipts > 0 && (
                            <span className="font-mono font-bold text-emerald-800">
                              Tushum: +{formatMoney(planReceipts)}
                            </span>
                          )}
                          {planDeliveredSum > 0 && (
                            <span className="font-mono font-semibold text-rose-800">
                              Berildi: {formatMoney(planDeliveredSum)} ({planDeliveredCount} dona)
                            </span>
                          )}
                          {planReturnedSum > 0 && (
                            <span className="font-mono font-semibold text-amber-700">
                              Qaytdi: {formatMoney(planReturnedSum)} ({planReturnedCount} dona)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-neutral-400 italic">
                        Hali amal bajarilmagan (Kutilmoqda)
                      </div>
                    )}
                  </div>

                  {/* Bottom Bar: Completed Date & Detail button */}
                  <div className="mt-2.5 pt-2 flex items-center justify-between text-xs border-t border-neutral-100">
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {item.completedAt ? `Bajarildi: ${formatDateDMY(item.completedAt)}` : 'Bajarilmagan'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleOpenRemoveSingle(item, e)}
                        className="px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-rose-100 text-rose-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer border border-neutral-200"
                        title="Rejadan olib tashlash"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>O'chirish</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectedPlan(item)}
                        className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs transition flex items-center gap-1 cursor-pointer border border-rose-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Batafsil</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop & Katta ekranlar uchun Jadval ko'rinishi (hidden md:block) */}
          <div className="hidden md:block overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-xs">
            <StickyTableWrapper>
              <table className="w-full min-w-[1280px] text-left text-xs">
              <thead className="bg-rose-50 border-b border-rose-100 text-neutral-800 font-bold uppercase tracking-wider sticky top-0 z-20">
                <tr>
                <th className="py-3 px-3 w-[4%] text-center">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredPlans.length > 0 &&
                        filteredPlans.every((p) => selectedPlanIds.includes(p.id))
                      }
                      onChange={toggleSelectAllFiltered}
                      className="w-4 h-4 rounded border-neutral-300 text-rose-700 focus:ring-rose-500 cursor-pointer"
                      title="Barchasini tanlash"
                    />
                  </div>
                </th>
                <th className="py-3 px-3">Qaysi agent orqali qo'shilgan</th>
                <th className="py-3 px-3">Mijoz & Telefon</th>
                <th className="py-3 px-3">Manzili</th>
                <th className="py-3 px-3">Joriy qarz / Haqdorlik</th>
                <th className="py-3 px-3">Oxirgi pul bergan va mahsulot sanasi</th>
                <th className="py-3 px-3">Reja izohi</th>
                <th className="py-3 px-3">Holati</th>
                <th className="py-3 px-3">Qilingan amallar</th>
                <th className="py-3 px-3 text-right">Tushumlar</th>
                <th className="py-3 px-3 text-right">Tovar berilishi / qaytishi</th>
                <th className="py-3 px-3">Bajarilgan vaqt</th>
                <th className="py-3 px-3 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100/60">
              {filteredPlans.map((item, idx) => {
                const isClosed = item.isClosed || item.status === 'yopildi';
                const isCompleted = isPlanCompleted(item);
                const isSelected = selectedPlanIds.includes(item.id);
                const actions = getPlanActions(item);
                const hasActions = actions.length > 0;

                // Sums for this specific plan
                let planReceipts = 0;
                let planReceiptMethods: string[] = [];
                let planDeliveredSum = 0;
                let planDeliveredCount = 0;
                let planReturnedSum = 0;
                let planReturnedCount = 0;
                let visitActionLabels: string[] = [];

                actions.forEach((act) => {
                  if (act.actionDone && !visitActionLabels.includes(act.actionDone)) {
                    visitActionLabels.push(act.actionDone);
                  }

                  if (act.financialAction && act.financialAction.amount > 0) {
                    planReceipts += act.financialAction.amount;
                    const l = act.financialAction.methodLabel || 'To\'lov';
                    if (!planReceiptMethods.includes(l)) planReceiptMethods.push(l);
                  }

                  if (act.deliveryPayment && act.deliveryPayment.paidAmount > 0) {
                    planReceipts += act.deliveryPayment.paidAmount;
                    const l = act.deliveryPayment.paymentLabel || 'Tovar to\'lovi';
                    if (!planReceiptMethods.includes(l)) planReceiptMethods.push(l);
                  }

                  if (act.productsDelivered && act.productsDelivered.length > 0) {
                    act.productsDelivered.forEach((p) => {
                      const v = p.totalPrice || (p.quantity || 0) * (p.unitPrice || 0);
                      planDeliveredSum += v;
                      planDeliveredCount += p.quantity || 0;
                    });
                  }

                  if (act.productsReturned && act.productsReturned.length > 0) {
                    act.productsReturned.forEach((r) => {
                      const v = (r.quantity || 0) * (r.unitPrice || 0);
                      planReturnedSum += v;
                      planReturnedCount += r.quantity || 0;
                    });
                  }
                });

                const lastOps = getClientLastOperations(
                  item.clientId,
                  resolvedClients,
                  allSystemPlans
                );

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-rose-50/60' : 'hover:bg-rose-50/30'
                    }`}
                  >
                    {/* Index + Selection Checkbox */}
                    <td className="py-3 px-3 font-mono text-neutral-400 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectPlanItem(item.id, e)}
                          className="w-4 h-4 rounded border-neutral-300 text-rose-700 focus:ring-rose-500 cursor-pointer"
                          title="Tanlash"
                        />
                        <span>{idx + 1}</span>
                      </div>
                    </td>

                    {/* Qaysi agent orqali qo'shilgan va kim bajargan (Alohida ustun) */}
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                          Tuzgan: {getAgentDisplayName(item.agentUsername)}
                        </span>
                        {(() => {
                          const executor =
                            item.lastExecutedBy ||
                            (item.actionsHistory && item.actionsHistory.length > 0
                              ? item.actionsHistory[0].author
                              : undefined);
                          if (!executor) return null;
                          return (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-[10.5px] bg-emerald-100 text-emerald-900 border border-emerald-300">
                                Bajargan: {getAgentDisplayName(executor)}
                              </span>
                            </div>
                          );
                        })()}
                        <div className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                          <span>Reja sanasi: {formatDateDMY(item.planDate || item.createdAt)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Mijoz & Telefon */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-neutral-900">{item.clientName}</div>
                      <div className="text-[11px] font-mono text-neutral-500">{item.clientPhone}</div>
                    </td>

                    {/* Manzili */}
                    <td className="py-3 px-3 max-w-[150px]">
                      <div className="text-neutral-700">
                        <span
                          className="font-semibold text-neutral-900 block truncate"
                          title={item.clientAddress}
                        >
                          {[item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') ||
                            item.clientAddress ||
                            "Ko'rsatilmagan"}
                        </span>
                        {item.clientLandmark && (
                          <span
                            className="text-[10px] text-neutral-500 block truncate"
                            title={`Mo'ljal: ${item.clientLandmark}`}
                          >
                            Mo'ljal: {item.clientLandmark}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Joriy qarz / Haqdorlik (Alohida ustun) */}
                    <td className="py-3 px-3 min-w-[140px]">
                      <div className="space-y-1 text-[10.5px]">
                        {lastOps.currentDebt > 0 && (
                          <div className="bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                            <div className="text-[9.5px] font-bold uppercase text-rose-800">
                              Qarzdorlik:
                            </div>
                            <div className="font-mono font-extrabold text-rose-700">
                              {formatMoney(lastOps.currentDebt)}
                            </div>
                          </div>
                        )}
                        {lastOps.currentAdvance > 0 && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
                            <div className="text-[9.5px] font-bold uppercase text-emerald-800">
                              Haqdorlik:
                            </div>
                            <div className="font-mono font-extrabold text-emerald-700">
                              {formatMoney(lastOps.currentAdvance)}
                            </div>
                          </div>
                        )}
                        {lastOps.currentDebt <= 0 && lastOps.currentAdvance <= 0 && (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-500 font-mono text-[10px] border border-neutral-200">
                            0 USD
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Oxirgi pul bergan va mahsulot amaliyoti sanasi (d/m/y soatlarsiz) */}
                    <td className="py-3 px-3 min-w-[190px]">
                      <div className="space-y-1.5 text-[10.5px]">
                        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg px-2 py-1">
                          <div className="font-bold text-emerald-950 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                            <span>Oxirgi pul bergan:</span>
                          </div>
                          {lastOps.lastPaymentFormatted ? (
                            <div className="font-mono font-semibold text-emerald-900 mt-0.5">
                              {lastOps.lastPaymentFormatted}
                            </div>
                          ) : (
                            <div className="text-neutral-400 italic mt-0.5">To'lov yo'q</div>
                          )}
                        </div>

                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg px-2 py-1">
                          <div className="font-bold text-amber-950 flex items-center gap-1">
                            <Package className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                            <span>
                              {lastOps.lastProductType === 'qaytarilgan'
                                ? 'Mahsulot qaytarilgan:'
                                : lastOps.lastProductType === 'berilgan'
                                ? 'Mahsulot berilgan:'
                                : 'Oxirgi mahsulot:'}
                            </span>
                          </div>
                          {lastOps.lastProductFormatted ? (
                            <div className="font-mono font-semibold text-amber-900 mt-0.5">
                              {lastOps.lastProductFormatted}
                            </div>
                          ) : (
                            <div className="text-neutral-400 italic mt-0.5">Amaliyot yo'q</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Reja izohi va Undirish maqsadi */}
                    <td className="py-3 px-3 max-w-[170px] text-[11px]" title={item.planNote}>
                      <div className="space-y-1">
                        {item.plannedAction && (
                          <span className="font-bold text-amber-950 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block truncate">
                            Tanlangan: {formatActionLabel(item.plannedAction)}
                          </span>
                        )}
                        {item.plannedAmount !== undefined && item.plannedAmount > 0 && (
                          <span className="font-mono font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 block truncate">
                            Undirish rejasi: {formatMoney(item.plannedAmount)}
                          </span>
                        )}
                        {item.planNote ? (
                          <span className="font-medium text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 block truncate">
                            Izoh: {item.planNote}
                          </span>
                        ) : (
                          !item.plannedAction &&
                          !(item.plannedAmount && item.plannedAmount > 0) && (
                            <span className="text-neutral-400 italic">-</span>
                          )
                        )}
                      </div>
                    </td>

                    {/* HOLATI + QAYTA OCHISH IZOHI (Faqat admin panelda ko'rinadi) */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {isCompleted ? (
                        <div className="space-y-1">
                          {isPlanClosedWithoutAction(item) ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Lock className="w-3.5 h-3.5 text-amber-700" />
                              <span>Bajarilmasdan yopilgan</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Bajarib yopilgan</span>
                            </span>
                          )}
                          <span className="text-[10px] text-emerald-800 block font-semibold">
                            {isClosed
                              ? isPlanClosedWithoutAction(item)
                                ? 'Amal bajarilmasdan yopilgan'
                                : `Amal bajarilib yopilgan (${actions.length} ta amal)`
                              : item.actionDone
                              ? `Amal: ${formatActionLabel(item.actionDone)}`
                              : `${actions.length} ta amal bajarilgan`}
                          </span>
                          {isClosed && item.closeReason && (
                            <span
                              className="text-[10px] text-rose-800 font-bold block max-w-[190px] truncate bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                              title={`Yopilish sababi: ${item.closeReason}`}
                            >
                              Sabab: {item.closeReason}
                            </span>
                          )}
                          {isClosed && item.closedBy && (
                            <span className="text-[9px] text-neutral-400 block font-mono">
                              {getAgentDisplayName(item.closedBy)} tomonidan
                            </span>
                          )}
                          {item.reopenReason && (
                            <div
                              className="mt-1 p-1.5 rounded-lg bg-purple-50 border border-purple-200 text-[10px] text-purple-950 max-w-[210px] whitespace-normal"
                              title={`Qayta ochish izohi: ${item.reopenReason}`}
                            >
                              <div className="font-bold flex items-center gap-1 text-purple-900">
                                <Unlock className="w-2.5 h-2.5 shrink-0" />
                                <span>Qayta ochilgan ({formatDateDMY(item.reopenedAt)})</span>
                              </div>
                              <div className="font-medium mt-0.5">
                                Izoh: "{item.reopenReason}"
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                            <span>Jarayonda</span>
                          </span>
                          {item.reopenReason && (
                            <div
                              className="p-1.5 rounded-lg bg-purple-50 border border-purple-200 text-[10px] text-purple-950 max-w-[210px] whitespace-normal"
                              title={`Qayta ochish izohi: ${item.reopenReason}`}
                            >
                              <div className="font-bold flex items-center gap-1 text-purple-900">
                                <Unlock className="w-2.5 h-2.5 shrink-0" />
                                <span>
                                  Qayta ochildi ({getAgentDisplayName(item.reopenedBy || item.agentUsername)})
                                </span>
                              </div>
                              <div className="font-semibold mt-0.5">
                                Izoh: "{item.reopenReason}"
                              </div>
                              {item.reopenedAt && (
                                <div className="text-[9px] font-mono text-purple-700 mt-0.5">
                                  Sana: {formatDateDMY(item.reopenedAt)}
                                </div>
                              )}
                            </div>
                          )}
                          <span className="text-[10px] text-neutral-500 block mt-0.5 font-medium">
                            {item.plannedAction
                              ? `Rejada: ${formatActionLabel(item.plannedAction)}`
                              : 'Amal kutilmoqda'}
                          </span>
                          <span className="text-[9px] text-neutral-400 font-mono block">
                            {getRemainingTimeStr(item.createdAt)}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* QILINGAN AMALLAR */}
                    <td className="py-3 px-3.5 max-w-[240px]">
                      {!hasActions ? (
                        <div className="space-y-1">
                          {item.plannedAction ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                              Rejadagi amal: {formatActionLabel(item.plannedAction)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 text-neutral-500 border border-neutral-200">
                              <MinusCircle className="w-3 h-3 text-neutral-400" />
                              <span>Amal yo'q</span>
                            </span>
                          )}
                          <span className="text-[10px] text-neutral-400 block italic">
                            Hali bajarilmagan (Rejada)
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {/* Tashrif turi */}
                          {visitActionLabels.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {visitActionLabels.map((vLabel, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-200 font-bold text-[10px]"
                                >
                                  Bajardi: {formatActionLabel(vLabel)}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* To'lov amali */}
                          {planReceipts > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold">
                              <Receipt className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>To'lov: +{formatMoney(planReceipts)}</span>
                            </div>
                          )}

                          {/* Mahsulot berish */}
                          {planDeliveredSum > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-rose-800 font-semibold">
                              <PackageCheck className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>
                                Berildi: {formatMoney(planDeliveredSum)} ({planDeliveredCount} dona)
                              </span>
                            </div>
                          )}

                          {/* Mahsulot qaytarish */}
                          {planReturnedSum > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-800 font-semibold">
                              <PackageMinus className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>
                                Qaytarildi: {formatMoney(planReturnedSum)} ({planReturnedCount} dona)
                              </span>
                            </div>
                          )}

                          {/* Rejadagi amallar soni */}
                          {actions.length > 1 && (
                            <span className="text-[10px] text-neutral-400 block italic">
                              (Jami {actions.length} marta amal bajarildi)
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* TUSHUMLAR */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      {planReceipts > 0 ? (
                        <div>
                          <span className="font-mono font-extrabold text-sm text-emerald-800">
                            +{formatMoney(planReceipts)}
                          </span>
                          <div className="text-[10px] text-neutral-500 font-medium truncate max-w-[140px]">
                            {planReceiptMethods.join(', ')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">0 USD</span>
                      )}
                    </td>

                    {/* TOVAR BERILISHI / QAYTISHI */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      {planDeliveredSum > 0 || planReturnedSum > 0 ? (
                        <div className="space-y-0.5">
                          {planDeliveredSum > 0 && (
                            <div className="text-[11px] font-mono font-bold text-rose-800">
                              Berildi: {formatMoney(planDeliveredSum)}
                            </div>
                          )}
                          {planReturnedSum > 0 && (
                            <div className="text-[10px] font-mono font-semibold text-amber-700">
                              Qaytdi: {formatMoney(planReturnedSum)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>

                    {/* Bajarilgan vaqt */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-[11px] text-neutral-600">
                      {item.completedAt ? (
                        formatDateDMY(item.completedAt)
                      ) : (
                        <span className="text-neutral-400 italic">Hali bajarilmadi</span>
                      )}
                    </td>

                    {/* Amallar: Batafsil ko'rish + Rejadan olib tashlash */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectedPlan(item)}
                          className="p-1.5 rounded-xl bg-neutral-100 hover:bg-rose-100 text-neutral-700 hover:text-rose-900 transition cursor-pointer"
                          title="Batafsil ma'lumotlarni ko'rish"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRemoveSingle(item)}
                          className="p-1.5 rounded-xl bg-neutral-100 hover:bg-rose-100 text-neutral-600 hover:text-rose-700 transition cursor-pointer"
                          title="Rejadan olib tashlash"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </StickyTableWrapper>
        </div>
      </>
    )}

      {/* ========================================================= */}
      {/* BATAFSIL MODAL: PLAN ITEM BO'YICHA TO'LIQ AMALLAR TARIXI */}
      {/* ========================================================= */}
      {inspectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-rose-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/40 border-b border-rose-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                    Agent rejasi tafsilotlari
                  </span>
                  <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                    Agent: {getAgentDisplayName(inspectedPlan.agentUsername)}
                  </span>
                </div>
                <h3 className="text-lg font-bold font-display text-neutral-900 mt-1">
                  {inspectedPlan.clientName}
                </h3>
                <div className="text-xs text-neutral-500 font-mono">{inspectedPlan.clientPhone}</div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedPlan(null)}
                className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  isPlanCompleted(inspectedPlan)
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isPlanCompleted(inspectedPlan) ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-700 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold text-xs block">
                      Holat:{' '}
                      {inspectedPlan.isClosed || inspectedPlan.status === 'yopildi'
                        ? isPlanClosedWithoutAction(inspectedPlan)
                          ? 'Bajarilmasdan yopilgan'
                          : "Bajarib yopilgan (To'liq yakunlangan)"
                        : isPlanCompleted(inspectedPlan)
                        ? 'Bajarildi (Amal bajarilgan)'
                        : 'Jarayonda (Hali bajarilmagan)'}
                    </span>
                    <span className="text-[11px] opacity-80">
                      Tuzilgan sana: {formatDateDMY(inspectedPlan.createdAt)} · {getRemainingTimeStr(inspectedPlan.createdAt)}
                    </span>
                  </div>
                </div>

                {inspectedPlan.closedAt && (
                  <span className="text-[10px] font-mono text-emerald-800 bg-white/70 px-2 py-1 rounded border border-emerald-200">
                    Yopildi: {formatDateDMY(inspectedPlan.closedAt)}
                  </span>
                )}
              </div>

              {/* Qayta ochilganlik izohi (Faqat admin uchun ko'rinadi) */}
              {inspectedPlan.reopenReason && (
                <div className="p-3.5 bg-purple-50/90 rounded-2xl border border-purple-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-purple-900">
                    <Unlock className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>Qayta ochilganlik izohi (Faqat admin uchun):</span>
                  </div>
                  <div className="text-neutral-900 font-semibold pl-5 text-[13px]">
                    "{inspectedPlan.reopenReason}"
                  </div>
                  <div className="text-[10px] text-purple-800 font-mono pl-5">
                    Qayta ochgan agent: {getAgentDisplayName(inspectedPlan.reopenedBy || inspectedPlan.agentUsername)}{' '}
                    {inspectedPlan.reopenedAt ? `(${formatDateDMY(inspectedPlan.reopenedAt)})` : ''}
                  </div>
                </div>
              )}

              {/* Yopilish sababi */}
              {inspectedPlan.closeReason && (
                <div className="p-3.5 bg-rose-50/80 rounded-2xl border border-rose-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-900">
                    <Lock className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>Reja yopilish sababi:</span>
                  </div>
                  <div className="text-neutral-900 font-semibold pl-5 text-[13px]">
                    "{inspectedPlan.closeReason}"
                  </div>
                  {inspectedPlan.closedBy && (
                    <div className="text-[10px] text-neutral-500 font-mono pl-5 pt-0.5">
                      Yopgan mas'ul: {getAgentDisplayName(inspectedPlan.closedBy)} {inspectedPlan.closedAt ? `(${formatDateDMY(inspectedPlan.closedAt)})` : ''}
                    </div>
                  )}
                </div>
              )}

              {/* Planned Action, Planned Amount & Plan Note */}
              {(inspectedPlan.plannedAction ||
                (inspectedPlan.plannedAmount && inspectedPlan.plannedAmount > 0) ||
                inspectedPlan.planNote) && (
                <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {inspectedPlan.plannedAction && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 border border-amber-200 font-bold">
                        Tanlangan reja amali: {formatActionLabel(inspectedPlan.plannedAction)}
                      </span>
                    )}
                    {inspectedPlan.plannedAmount !== undefined &&
                      inspectedPlan.plannedAmount > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-200 font-mono font-bold">
                          Undirish rejadagi summa: {formatMoney(inspectedPlan.plannedAmount)}
                        </span>
                      )}
                  </div>
                  {inspectedPlan.planNote && (
                    <div>
                      <span className="font-bold text-neutral-700 block mb-0.5">Rejadagi izoh:</span>
                      <span className="text-neutral-900">{inspectedPlan.planNote}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions History List */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide block">
                  Bajarilgan amallar xronologiyasi ({getPlanActions(inspectedPlan).length} ta)
                </span>

                {getPlanActions(inspectedPlan).length === 0 ? (
                  <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-500 text-xs text-center">
                    Ushbu mijoz ustida hali hech qanday amal bajarilmagan (Amal yo'q).
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {getPlanActions(inspectedPlan).map((act, actIdx) => (
                      <div
                        key={actIdx}
                        className="p-3.5 bg-white rounded-xl border border-rose-100 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-neutral-100">
                          <span className="font-bold text-rose-800">
                            Amal #{actIdx + 1}: {act.actionDone}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {formatDateDMY(act.timestamp)} ({getAgentDisplayName(act.author)})
                          </span>
                        </div>

                        {/* Financial operation */}
                        {act.financialAction && act.financialAction.amount > 0 && (
                          <div className="p-2 bg-emerald-50 rounded-lg text-xs text-emerald-900 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span>To'lov qabul qilindi:</span>
                              <span className="font-mono font-bold">
                                +{formatMoney(act.financialAction.amount)} ({act.financialAction.methodLabel})
                              </span>
                            </div>
                            {act.financialAction.note && (
                              <div className="text-[11px] text-emerald-800 font-mono">
                                {act.financialAction.note}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Delivery payment */}
                        {act.deliveryPayment && (
                          <div className="p-2 bg-rose-50 rounded-lg text-xs text-rose-950 flex items-center justify-between">
                            <span>Tovar to'lov shakli:</span>
                            <span className="font-bold">
                              {act.deliveryPayment.paymentLabel} ({formatMoney(act.deliveryPayment.paidAmount)})
                            </span>
                          </div>
                        )}

                        {/* Delivered products */}
                        {act.productsDelivered && act.productsDelivered.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-neutral-600 block">
                              Topshirilgan tovarlar:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {act.productsDelivered.map((p, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="px-2 py-0.5 bg-neutral-100 rounded text-[11px] text-neutral-800"
                                >
                                  <strong>{p.name}</strong>: {p.quantity} {p.unit} ({formatMoney(p.totalPrice || p.quantity * p.unitPrice)})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Returned products */}
                        {act.productsReturned && act.productsReturned.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-neutral-100">
                            <span className="text-[11px] font-semibold text-amber-800 block">
                              Omborga qaytarilgan tovarlar:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {act.productsReturned.map((r, rIdx) => (
                                <span
                                  key={rIdx}
                                  className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900"
                                >
                                  <strong>{r.name}</strong>: {r.quantity} {r.unit} ({formatMoney((r.quantity || 0) * (r.unitPrice || 0))})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Report note */}
                        {act.reportNote && (
                          <div className="text-[11px] text-neutral-600 italic bg-neutral-50 p-2 rounded">
                            "{act.reportNote}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedPlan(null)}
                className="px-5 py-2 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 transition"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* REJADAN OLIB TASHLASH MODALI (Aniqmi + Majburiy izoh bilan) */}
      {/* ========================================================= */}
      {removeModalTargetIds && removeModalTargetIds.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-200 shrink-0">
                <Trash2 className="w-6 h-6 text-rose-700" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-neutral-900">
                  Aniqmi? Rejadan olib tashlashni tasdiqlaysizmi?
                </h3>
                <p className="text-xs text-rose-700 font-semibold">
                  Haqiqatan ham ushbu mijoz ({removeModalTargetIds.length} ta) ni agent rejasidan olib tashlamoqchimisiz?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-950 space-y-2">
              <p className="font-semibold text-rose-900">
                Tanlangan mijozlar soni: <strong>{removeModalTargetIds.length} ta</strong>
              </p>
              <p className="text-neutral-600 leading-relaxed">
                Ushbu mijozlar kunlik rejadan butunlay olib tashlanadi va kiritilgan sabab tizim audit tarixida saqlanadi.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700">
                Olib tashlash sababi (majburiy): <span className="text-rose-600">*</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_REMOVE_REASONS.map((preset) => {
                  const isSelected = selectedRemovePreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setSelectedRemovePreset(preset);
                        setRemoveReason(preset);
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all text-left font-medium cursor-pointer ${
                        isSelected
                          ? 'bg-rose-700 border-rose-700 text-white shadow-xs font-semibold'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={3}
                value={removeReason}
                onChange={(e) => {
                  setRemoveReason(e.target.value);
                  setSelectedRemovePreset(e.target.value);
                }}
                placeholder="Nima sababdan rejadan olib tashlanayotganini yozing..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRemoveModalTargetIds(null);
                  setRemoveReason('');
                  setSelectedRemovePreset('');
                }}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 min-h-[42px] cursor-pointer"
              >
                Yo'q, bekor qilish
              </button>
              <button
                type="button"
                disabled={!removeReason.trim() && !selectedRemovePreset.trim()}
                onClick={handleExecuteRemove}
                className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs min-h-[42px] flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ha, aniq — olib tashlash ({removeModalTargetIds.length} ta)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADMIN UCHUN REJADAGI MIJOZLARNI TO'LIQ A4 PDF / PRINT QILISH */}
      {/* ========================================================= */}
      <RejaPrintModal
        isOpen={isAdminPdfModalOpen}
        onClose={() => setIsAdminPdfModalOpen(false)}
        title="AGENTLAR REJASIDAGI MIJOZLAR RO'YXATI"
        subtitle={`Agent filtri: ${selectedAgent === 'all' ? 'Barcha agentlar' : getAgentDisplayName(selectedAgent)}`}
        plans={filteredPlans}
        clients={resolvedClients}
        allSystemPlans={allSystemPlans}
      />
    </div>
  );
};

