import React, { useState, useMemo } from 'react';
import { Client, DailyPlanItem } from '../types';
import { formatMoney, formatDateDMY, getAgentDisplayName } from '../utils/format';
import { storageService, isClosedPlanExpired7Days, getPlanSoldProductsData } from '../services/storage';
import { getClientLastOperations } from '../utils/clientActivityDates';
import {
  CalendarCheck,
  Calendar,
  Plus,
  CheckCircle2,
  Phone,
  MapPin,
  Edit3,
  Check,
  X,
  Lock,
  Unlock,
  AlertTriangle,
  Package,
  RotateCcw,
  Target,
  Printer,
  Clock,
  Trash2,
  User,
  FileSpreadsheet,
} from 'lucide-react';
import { NakladnoyModal, NakladnoyData } from './NakladnoyModal';
import { RejaPrintModal } from './RejaPrintModal';
import { StickyTableWrapper } from './StickyTableWrapper';
import { exportPlansDetailedToExcel } from '../utils/exportPlansDetailedExcel';

interface Props {
  plans: DailyPlanItem[];
  clients?: Client[];
  onOpenCreatePlan: () => void;
  onOpenMonthlyPlan?: () => void;
  onOpenExecuteModal: (item: DailyPlanItem, editSoldProducts?: boolean) => void;
  onMarkPlannedActionDone?: (item: DailyPlanItem) => void;
  onUpdatePlanNote?: (planItemId: string, note: string) => void;
  onClosePlanItem?: (
    planItemId: string,
    closeReason?: string,
    closedWithoutActionOverride?: boolean,
    closeDate?: string
  ) => void;
  onReopenPlanItems?: (planItemIds: string[], reopenReason: string) => void;
  onRemovePlanItems?: (planItemIds: string[], reason: string) => void;
}

const PRESET_CLOSE_REASONS = [
  "Hisob-kitob va amallar to'liq yakunlandi",
  "To'lov qabul qilindi, qarz to'liq yopildi",
  "Tovarlar muvaffaqiyatli topshirildi",
  "Do'kon yopiq / Mijoz joyida yo'q",
  "Keyingi kunga qoldirildi",
];

const PRESET_REOPEN_REASONS = [
  "Qo'shimcha to'lov qabul qilish uchun",
  "Yangi mahsulot topshirish uchun",
  "Hisob-kitobga tuzatish kiritish uchun",
  "Mijoz qayta aloqaga chiqdi",
];

const PRESET_REMOVE_REASONS = [
  "Mijoz buyurtmani bekor qildi",
  "Reja xato kiritilgan",
  "Mijoz vaqtincha faoliyatini to'xtatgan",
  "Reja boshqa kunga ko'chirildi",
  "Mijoz bilan aloqa o'rnatib bo'lmadi",
];

// Calculate paid and debt amounts for a plan item (including historical actions)
const calcPlanFinancials = (item: DailyPlanItem) => {
  let paidAmount = 0;
  let debtAmount = 0;

  if (item.actionsHistory && item.actionsHistory.length > 0) {
    item.actionsHistory.forEach((act) => {
      if (act.financialAction?.amount) {
        paidAmount += act.financialAction.amount;
      }
      if (act.deliveryPayment) {
        if (act.deliveryPayment.paidAmount) {
          paidAmount += act.deliveryPayment.paidAmount;
        }
        if (act.deliveryPayment.debtAmount) {
          debtAmount += act.deliveryPayment.debtAmount;
        }
      }
    });
  } else {
    if (item.financialAction?.amount) {
      paidAmount += item.financialAction.amount;
    }
    if (item.deliveryPayment) {
      if (item.deliveryPayment.paidAmount) {
        paidAmount += item.deliveryPayment.paidAmount;
      }
      if (item.deliveryPayment.debtAmount) {
        debtAmount += item.deliveryPayment.debtAmount;
      }
    }
  }

  return { paidAmount, debtAmount };
};

const isPlanClosedWithoutAction = (item: DailyPlanItem): boolean => {
  if (item.closedWithoutAction !== undefined) return item.closedWithoutAction;
  const hasAnyAction =
    Boolean(item.actionDone) || Boolean(item.actionsHistory && item.actionsHistory.length > 0);
  return !hasAnyAction;
};

export const AgentDailyPlanTable: React.FC<Props> = ({
  plans,
  clients,
  onOpenCreatePlan,
  onOpenMonthlyPlan,
  onOpenExecuteModal,
  onMarkPlannedActionDone,
  onUpdatePlanNote,
  onClosePlanItem,
  onReopenPlanItems,
  onRemovePlanItems,
}) => {
  // State for editing plan note inline
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  // Filter tabs: 'active' (default) -> closed plans disappear from active view!
  const [planViewFilter, setPlanViewFilter] = useState<'active' | 'closed' | 'all'>('active');

  // Date filter state: 'all' | 'today' | 'yesterday' | 'custom'
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');

  // Closure type sub-filter: 'all' | 'done_closed' (Bajarib yopilgan) | 'undone_closed' (Bajarilmasdan yopilgan)
  const [closureTypeFilter, setClosureTypeFilter] = useState<'all' | 'done_closed' | 'undone_closed'>('all');

  // Payment filter & sort: 'all' | 'paid_only' | 'last_paid' | 'most_paid'
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid_only' | 'last_paid' | 'most_paid'>('all');

  // State for confirming closing of plan item (Oxirgi marta yopish)
  const [confirmCloseItem, setConfirmCloseItem] = useState<DailyPlanItem | null>(null);
  const [closeReason, setCloseReason] = useState<string>('');
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>('');
  const [closeWithoutActionFlag, setCloseWithoutActionFlag] = useState<boolean>(false);

  const getTodayDateStr = (): string => new Date().toISOString().slice(0, 10);
  const getYesterdayDateStr = (): string => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const getDayBeforeYesterdayDateStr = (): string => new Date(Date.now() - 172800000).toISOString().slice(0, 10);
  const [confirmCloseDate, setConfirmCloseDate] = useState<string>(() => getTodayDateStr());

  // General selection of plan items (can be active or closed)
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

  // Reopen modal state
  const [reopenModalTargetIds, setReopenModalTargetIds] = useState<string[] | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');

  // Removal from plan modal state (mandatory reason)
  const [removeModalTargetIds, setRemoveModalTargetIds] = useState<string[] | null>(null);
  const [removeReason, setRemoveReason] = useState<string>('');
  const [selectedRemovePreset, setSelectedRemovePreset] = useState<string>('');

  const [nakladnoyData, setNakladnoyData] = useState<NakladnoyData | null>(null);
  const [isPlanPdfModalOpen, setIsPlanPdfModalOpen] = useState<boolean>(false);

  const resolvedClients = useMemo(
    () => (clients && clients.length > 0 ? clients : storageService.getClients()),
    [clients]
  );
  const allSystemPlans = useMemo(() => {
    const stored = storageService.getDailyPlans();
    return stored.length >= plans.length ? stored : plans;
  }, [plans]);

  const formatPlannedActionLabel = (action?: string) => {
    if (action === 'telefon qilindi') return 'Telefon qilish';
    if (action === 'joyiga borildi') return 'Joyiga borish';
    if (action === 'telefon qilindi + joyiga borildi') return 'Telefon qilish va joyiga borish';
    return action || '';
  };

  const handleOpenNakladnoy = (item: DailyPlanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const { paidAmount, debtAmount } = calcPlanFinancials(item);
    const hasDelivered = item.productsDelivered && item.productsDelivered.length > 0;
    const hasReturned = item.productsReturned && item.productsReturned.length > 0;

    setNakladnoyData({
      docNumber: `NK-${item.id.slice(-6).toUpperCase()}`,
      date: item.completedAt || item.createdAt,
      operationTitle: hasReturned && !hasDelivered ? 'Mahsulot qaytarish' : 'Mahsulot topshirish / Hisob-kitob',
      clientName: item.clientName,
      clientPhones: item.clientPhone ? [item.clientPhone] : [],
      clientAddress: [item.clientRegion, item.clientDistrict, item.clientLandmark]
        .filter(Boolean)
        .join(', ') || item.clientAddress,
      authorUsername: item.agentUsername || 'agentp1',
      productsDelivered: item.productsDelivered || [],
      productsReturned: item.productsReturned || [],
      paymentInfo: {
        paymentLabel:
          item.deliveryPayment?.paymentLabel ||
          item.financialAction?.methodLabel ||
          (debtAmount > 0 ? 'Nasiya (Qarzga)' : 'Naqd pul'),
        paidAmount,
        debtAmount,
      },
      financialPayment: item.financialAction
        ? {
            methodLabel: item.financialAction.methodLabel,
            amount: item.financialAction.amount,
            note: item.financialAction.note,
          }
        : undefined,
      note: item.reportNote || item.planNote,
    });
  };

  // Yopilgan rejalar 7 kundan keyin avtomatik tozalanadi va barchada ko'rinmaydi
  const validPlans = useMemo(
    () => plans.filter((p) => p && !isClosedPlanExpired7Days(p)),
    [plans]
  );

  // Date filtering applied first
  const dateFilteredPlans = useMemo(() => {
    if (dateFilter === 'all') return validPlans;
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    return validPlans.filter((p) => {
      const pDate = (p.planDate || p.createdAt || '').slice(0, 10);
      if (dateFilter === 'today') return pDate === todayStr;
      if (dateFilter === 'yesterday') return pDate === yesterdayStr;
      if (dateFilter === 'custom' && customDate) return pDate === customDate;
      return true;
    });
  }, [validPlans, dateFilter, customDate]);

  const activePlans = useMemo(
    () => dateFilteredPlans.filter((p) => !p.isClosed && p.status !== 'yopildi'),
    [dateFilteredPlans]
  );
  const closedPlans = useMemo(
    () => dateFilteredPlans.filter((p) => p.isClosed || p.status === 'yopildi'),
    [dateFilteredPlans]
  );
  const displayedPlans = useMemo(() => {
    const baseList =
      planViewFilter === 'active'
        ? activePlans
        : planViewFilter === 'closed'
        ? closedPlans
        : dateFilteredPlans;

    const afterClosureFilter = baseList.filter((p) => {
      if (closureTypeFilter === 'all') return true;
      const isClosed = Boolean(p.isClosed || p.status === 'yopildi');
      if (!isClosed) return false;
      const withoutAction = isPlanClosedWithoutAction(p);
      if (closureTypeFilter === 'done_closed') return !withoutAction;
      if (closureTypeFilter === 'undone_closed') return withoutAction;
      return true;
    });

    const afterPaymentFilter = afterClosureFilter.filter((p) => {
      if (paymentFilter === 'all') return true;
      const { paidAmount } = calcPlanFinancials(p);
      const lastOps = getClientLastOperations(p.clientId, resolvedClients, allSystemPlans);
      const hasAnyPayment =
        paidAmount > 0 || Boolean(lastOps.lastPaymentAmount && lastOps.lastPaymentAmount > 0);
      if (paymentFilter === 'paid_only' || paymentFilter === 'last_paid' || paymentFilter === 'most_paid') {
        return hasAnyPayment;
      }
      return true;
    });

    if (paymentFilter === 'last_paid') {
      return [...afterPaymentFilter].sort((a, b) => {
        const opsA = getClientLastOperations(a.clientId, resolvedClients, allSystemPlans);
        const opsB = getClientLastOperations(b.clientId, resolvedClients, allSystemPlans);
        const tA = opsA.lastPaymentTimestamp ? new Date(opsA.lastPaymentTimestamp).getTime() : 0;
        const tB = opsB.lastPaymentTimestamp ? new Date(opsB.lastPaymentTimestamp).getTime() : 0;
        return tB - tA;
      });
    }

    if (paymentFilter === 'most_paid') {
      return [...afterPaymentFilter].sort((a, b) => {
        const paidA = calcPlanFinancials(a).paidAmount;
        const paidB = calcPlanFinancials(b).paidAmount;
        const opsA = getClientLastOperations(a.clientId, resolvedClients, allSystemPlans);
        const opsB = getClientLastOperations(b.clientId, resolvedClients, allSystemPlans);
        const valA = paidA > 0 ? paidA : opsA.lastPaymentAmount || 0;
        const valB = paidB > 0 ? paidB : opsB.lastPaymentAmount || 0;
        return valB - valA;
      });
    }

    return afterPaymentFilter;
  }, [
    planViewFilter,
    activePlans,
    closedPlans,
    dateFilteredPlans,
    closureTypeFilter,
    paymentFilter,
    resolvedClients,
    allSystemPlans,
  ]);

  const displayedClosedPlans = useMemo(
    () => displayedPlans.filter((p) => p.isClosed || p.status === 'yopildi'),
    [displayedPlans]
  );

  // Toggle selection for any plan item
  const toggleSelectPlanItem = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e) e.stopPropagation();
    setSelectedPlanIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllDisplayed = () => {
    const allIds = displayedPlans.map((p) => p.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedPlanIds.includes(id));
    if (allSelected) {
      setSelectedPlanIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedPlanIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  // Reopen single / bulk handlers
  const handleOpenReopenSingle = (item: DailyPlanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setReopenModalTargetIds([item.id]);
    setReopenReason('');
  };

  const handleOpenReopenBulk = () => {
    const validClosedSelected = selectedPlanIds.filter((id) =>
      closedPlans.some((p) => p.id === id)
    );
    if (validClosedSelected.length === 0) return;
    setReopenModalTargetIds(validClosedSelected);
    setReopenReason('');
  };

  const handleExecuteReopen = () => {
    if (!reopenModalTargetIds || reopenModalTargetIds.length === 0) return;
    const trimmed = reopenReason.trim();
    if (!trimmed) return;
    if (onReopenPlanItems) {
      onReopenPlanItems(reopenModalTargetIds, trimmed);
    }
    setSelectedPlanIds((prev) => prev.filter((id) => !reopenModalTargetIds.includes(id)));
    setReopenModalTargetIds(null);
    setReopenReason('');
    setPlanViewFilter('active');
  };

  // Remove plan items single / bulk handlers (mandatory reason)
  const handleOpenRemoveSingle = (item: DailyPlanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoveModalTargetIds([item.id]);
    setRemoveReason('');
    setSelectedRemovePreset('');
  };

  const handleOpenRemoveBulk = () => {
    const validSelected = selectedPlanIds.filter((id) =>
      displayedPlans.some((p) => p.id === id)
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

  const handleStartEditNote = (item: DailyPlanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(item.id);
    setTempNote(item.planNote || '');
  };

  const handleSaveNote = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdatePlanNote) {
      onUpdatePlanNote(itemId, tempNote);
    }
    setEditingNoteId(null);
  };

  const handleCancelEditNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(null);
    setTempNote('');
  };

  const handleOpenConfirmClose = (item: DailyPlanItem) => {
    setConfirmCloseItem(item);
    setConfirmCloseDate(getTodayDateStr());
    const hasActions =
      Boolean(item.actionDone) || Boolean(item.actionsHistory && item.actionsHistory.length > 0);
    setCloseWithoutActionFlag(!hasActions);
    const defaultReason = hasActions
      ? "Hisob-kitob va amallar to'liq yakunlandi"
      : "Do'kon yopiq / Mijoz joyida yo'q";
    setCloseReason(defaultReason);
    setSelectedPresetReason(defaultReason);
  };

  const handleExecuteClose = () => {
    if (confirmCloseItem && onClosePlanItem) {
      const finalReason =
        closeReason.trim() ||
        selectedPresetReason ||
        (closeWithoutActionFlag ? 'Bajarilmasdan yopildi' : 'Amallar yakunlandi');
      onClosePlanItem(confirmCloseItem.id, finalReason, closeWithoutActionFlag, confirmCloseDate);
      setConfirmCloseItem(null);
      setCloseReason('');
      setSelectedPresetReason('');
      setCloseWithoutActionFlag(false);
    }
  };

  const reopenModalClients = useMemo(() => {
    if (!reopenModalTargetIds) return [];
    return validPlans.filter((p) => reopenModalTargetIds.includes(p.id));
  }, [reopenModalTargetIds, validPlans]);

  return (
    <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-50/70 via-white to-rose-50/40 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                Reja
              </h2>
              <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                {activePlans.length} ta faol reja
              </span>
            </div>
          </div>
        </div>

        {/* View Filter Tabs & Create Plan Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-neutral-100/90 rounded-xl border border-neutral-200/80">
            <button
              type="button"
              onClick={() => setPlanViewFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                planViewFilter === 'active'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-neutral-700 hover:bg-white'
              }`}
              title="Faqat hozirda amallar bajarilishi kutilayotgan faol rejalar"
            >
              <span>Faol rejalar</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  planViewFilter === 'active' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-800'
                }`}
              >
                {activePlans.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPlanViewFilter('closed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                planViewFilter === 'closed'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-700 hover:bg-white'
              }`}
              title="Yopilgan va amallari yakunlangan mijozlar"
            >
              <Lock className="w-3 h-3" />
              <span>Yopilganlar</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  planViewFilter === 'closed' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-800'
                }`}
              >
                {closedPlans.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPlanViewFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                planViewFilter === 'all'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-700 hover:bg-white'
              }`}
            >
              <span>Barchasi</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  planViewFilter === 'all' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-800'
                }`}
              >
                {validPlans.length}
              </span>
            </button>
          </div>

          {(displayedPlans.length > 0 || validPlans.length > 0) && (
            <>
              <button
                type="button"
                onClick={() =>
                  exportPlansDetailedToExcel(
                    displayedPlans.length > 0 ? displayedPlans : validPlans,
                    resolvedClients,
                    allSystemPlans,
                    "Kunlik Reja va Bajarilgan Amallar Jadvali (Batafsil)",
                    `Ko'rinish: ${
                      planViewFilter === 'active'
                        ? 'Faol (Yopilmagan) rejalar'
                        : planViewFilter === 'closed'
                        ? 'Yopilgan rejalar'
                        : 'Barcha (Yopilgan va Yopilmagan) rejalar'
                    }`,
                    'Agent_Reja_va_Amallar'
                  )
                }
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[38px] cursor-pointer"
                title="Yopilgan va yopilmagan amallar jadvalini to'liq va batafsil Excel (.xlsx) formatda yuklab olish"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPlanPdfModalOpen(true)}
                className="flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[38px] cursor-pointer"
                title="Yopilgan va yopilmagan amallar jadvalini batafsil PDF / Print / Excel formatda yuklab olish"
              >
                <Printer className="w-4 h-4" />
                <span>PDF / Print</span>
              </button>
            </>
          )}

          {onOpenMonthlyPlan && (
            <button
              type="button"
              onClick={onOpenMonthlyPlan}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[38px] cursor-pointer"
              title="1 oylik qarz undirish rejasi tuzish"
            >
              <Target className="w-4 h-4" />
              <span>1 oylik reja tuzish</span>
            </button>
          )}

          <button
            onClick={onOpenCreatePlan}
            className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[38px] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Reja tuzish</span>
          </button>
        </div>
      </div>

      {/* Date Filtering Bar */}
      <div className="px-4 py-2.5 bg-rose-50/40 border-b border-rose-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
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
          Ko'rsatilmoqda: <strong className="text-neutral-800">{displayedPlans.length} ta</strong> rejadagi mijoz
        </div>
      </div>

      {/* Closure Type & Payment Filter/Sort Bar */}
      <div className="px-4 py-2.5 bg-white border-b border-rose-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Bajarib yopilgan / Bajarilmasdan yopilgan filtri */}
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
              if (planViewFilter === 'active') setPlanViewFilter('closed');
              setClosureTypeFilter('done_closed');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              closureTypeFilter === 'done_closed'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Bajarib yopilgan ({closedPlans.filter((p) => !isPlanClosedWithoutAction(p)).length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (planViewFilter === 'active') setPlanViewFilter('closed');
              setClosureTypeFilter('undone_closed');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              closureTypeFilter === 'undone_closed'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Bajarilmasdan yopilgan ({closedPlans.filter((p) => isPlanClosedWithoutAction(p)).length})
          </button>
        </div>

        {/* Pul berilgani / Oxirgi pul bergani / Ko'p pul bergan asosida filtr va saralash */}
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
      {displayedPlans.length > 0 && (
        <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <label className="inline-flex items-center gap-2 font-bold text-neutral-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={
                displayedPlans.length > 0 &&
                displayedPlans.every((p) => selectedPlanIds.includes(p.id))
              }
              onChange={toggleSelectAllDisplayed}
              className="w-4 h-4 rounded border-neutral-300 text-rose-700 focus:ring-rose-500 cursor-pointer"
            />
            <span>
              Mijozlarni tanlash ({selectedPlanIds.filter((id) => displayedPlans.some((p) => p.id === id)).length} / {displayedPlans.length} ta tanlandi)
            </span>
          </label>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Reopen button if any closed items are selected */}
            {selectedPlanIds.some((id) => closedPlans.some((p) => p.id === id)) && (
              <button
                type="button"
                onClick={handleOpenReopenBulk}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>
                  Yopilganlarni qayta ochish ({selectedPlanIds.filter((id) => closedPlans.some((p) => p.id === id)).length} ta)
                </span>
              </button>
            )}

            {/* Remove from plan button if any items are selected */}
            {selectedPlanIds.filter((id) => displayedPlans.some((p) => p.id === id)).length > 0 && (
              <button
                type="button"
                onClick={handleOpenRemoveBulk}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  Rejadan olib tashlash ({selectedPlanIds.filter((id) => displayedPlans.some((p) => p.id === id)).length} ta)
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plan List */}
      <div className="p-3 sm:p-4">
        {displayedPlans.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
            <CalendarCheck className="w-8 h-8 text-neutral-400 mx-auto" />
            <h3 className="text-sm font-bold text-neutral-800">
              {planViewFilter === 'active'
                ? closedPlans.length > 0
                  ? `Barcha rejadagi mijozlar yopildi (${closedPlans.length} ta yopilgan)`
                  : "Faol rejalashtirilgan mijozlar yo'q"
                : planViewFilter === 'closed'
                ? "Yopilgan mijozlar mavjud emas"
                : "Rejalashtirilgan mijozlar yo'q"}
            </h3>
            {planViewFilter === 'active' && closedPlans.length > 0 ? (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlanViewFilter('closed')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Yopilganlarni ko'rish va qayta ochish ({closedPlans.length})</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenCreatePlan}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Yangi reja tuzish</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenCreatePlan}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Mijozlarni tanlash</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Compact Table with Sticky Swipe Controls & Sticky Headers */}
            <div className="hidden md:block rounded-2xl border border-rose-100 overflow-hidden bg-white">
              <StickyTableWrapper>
                <table className="w-full min-w-[1040px] table-fixed text-left text-xs">
                  <thead className="bg-rose-50 border-b border-rose-100 text-neutral-800 font-bold uppercase text-[11px] sticky top-0 z-20">
                    <tr>
                    <th className="py-2.5 px-2 w-[4%] text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="checkbox"
                          checked={
                            displayedPlans.length > 0 &&
                            displayedPlans.every((p) => selectedPlanIds.includes(p.id))
                          }
                          onChange={toggleSelectAllDisplayed}
                          className="w-3.5 h-3.5 rounded border-neutral-300 text-rose-700 focus:ring-rose-500 cursor-pointer"
                          title="Barchasini tanlash"
                        />
                      </div>
                    </th>
                    <th className="py-2.5 px-2 w-[16%]">Mijoz va Manzil</th>
                    <th className="py-2.5 px-2 w-[12%]">Joriy qarz / Haqdorlik</th>
                    <th className="py-2.5 px-2 w-[16%]">Oxirgi pul bergan va mahsulot sanasi</th>
                    <th className="py-2.5 px-2 w-[11%]">Reja izohi</th>
                    <th className="py-2.5 px-2 w-[8%]">Holati</th>
                    <th className="py-2.5 px-2 w-[15%]">Qilingan amal va Mahsulot</th>
                    <th className="py-2.5 px-2 w-[8%] text-right">To'lov / Qarz</th>
                    <th className="py-2.5 px-2 w-[10%] text-center">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100/60">
                  {displayedPlans.map((item, idx) => {
                    const isClosed = item.isClosed || item.status === 'yopildi';
                    const isDone = item.status === 'bajarildi';
                    const isEditingThisNote = editingNoteId === item.id;
                    const isSelected = selectedPlanIds.includes(item.id);
                    const { paidAmount, debtAmount } = calcPlanFinancials(item);
                    const lastOps = getClientLastOperations(
                      item.clientId,
                      resolvedClients,
                      allSystemPlans
                    );

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          if (!isClosed) onOpenExecuteModal(item);
                        }}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-rose-50/60'
                            : isClosed
                            ? 'bg-neutral-50/70 opacity-85 cursor-default'
                            : 'hover:bg-rose-50/30 cursor-pointer'
                        }`}
                      >
                        {/* 1. Index + Selection Checkbox */}
                        <td
                          className="py-2.5 px-2 text-center font-mono text-neutral-400 text-[11px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleSelectPlanItem(item.id, e)}
                              className="w-3.5 h-3.5 rounded border-neutral-300 text-rose-700 focus:ring-rose-500 cursor-pointer"
                              title="Tanlash"
                            />
                            <span>{idx + 1}</span>
                          </div>
                        </td>

                        {/* 2. Client & Address + Creator badge */}
                        <td className="py-2.5 px-2.5">
                          <div className="font-bold text-neutral-900 flex items-center gap-1.5 leading-tight truncate">
                            <span className="truncate">{item.clientName}</span>
                            {isClosed && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-neutral-200 text-neutral-700 shrink-0">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Yopiq</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-neutral-500 text-[11px] font-mono mt-0.5">
                            <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span>{item.clientPhone}</span>
                          </div>
                          <div className="flex items-center gap-1 text-neutral-600 text-[10px] mt-0.5 truncate">
                            <MapPin className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                            <span className="truncate" title={item.clientAddress}>
                              {[item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') || item.clientAddress || "Manzil yo'q"}
                              {item.clientLandmark ? ` (${item.clientLandmark})` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1 text-neutral-500 text-[10px] font-mono">
                              <Calendar className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                              <span>{formatDateDMY(item.planDate || item.createdAt)}</span>
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <User className="w-2.5 h-2.5 text-indigo-600" />
                              <span>Reja tuzdi: {getAgentDisplayName(item.agentUsername)}</span>
                            </span>
                            {(() => {
                              const executor =
                                item.lastExecutedBy ||
                                (item.actionsHistory && item.actionsHistory.length > 0
                                  ? item.actionsHistory[0].author
                                  : undefined);
                              if (!executor) return null;
                              return (
                                <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Amal bajardi: {getAgentDisplayName(executor)}</span>
                                </span>
                              );
                            })()}
                            {isClosed && item.closedBy && (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700 border border-neutral-300">
                                <Lock className="w-2.5 h-2.5 text-neutral-600" />
                                <span>Yopdi: {getAgentDisplayName(item.closedBy)}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2.2. Joriy qarz / Haqdorlik (Alohida ustun) */}
                        <td className="py-2.5 px-2">
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

                        {/* 2.5. Last Payment & Product Operation Dates (d/m/y without hours) */}
                        <td className="py-2.5 px-2">
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

                        {/* 3. Plan Note */}
                        <td
                          className="py-2.5 px-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isEditingThisNote && !isClosed ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={tempNote}
                                onChange={(e) => setTempNote(e.target.value)}
                                placeholder="Izoh..."
                                className="px-2 py-1 text-[11px] border border-rose-300 rounded-lg outline-none bg-white w-full"
                                autoFocus
                              />
                              <button
                                onClick={(e) => handleSaveNote(item.id, e)}
                                className="p-1 rounded bg-rose-700 text-white hover:bg-rose-800 shrink-0"
                                title="Saqlash"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={handleCancelEditNote}
                                className="p-1 rounded bg-neutral-200 text-neutral-700 hover:bg-neutral-300 shrink-0"
                                title="Bekor qilish"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-1 group">
                              <span
                                className="text-[11px] text-neutral-700 truncate"
                                title={item.planNote || "Izoh qo'shish"}
                              >
                                {item.planNote ? (
                                  <span className="font-medium text-neutral-900">{item.planNote}</span>
                                ) : (
                                  <span className="text-neutral-400 italic">Izoh yo'q</span>
                                )}
                              </span>
                              {!isClosed && (
                                <button
                                  onClick={(e) => handleStartEditNote(item, e)}
                                  className="opacity-50 hover:opacity-100 p-1 rounded hover:bg-rose-50 text-rose-700 transition shrink-0"
                                  title="Izohni tahrirlash"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 4. Status (NOTE: reopenReason is NEVER shown to agents, only to admins!) */}
                        <td className="py-2.5 px-2.5">
                          {isClosed ? (
                            <div className="space-y-0.5">
                              {isPlanClosedWithoutAction(item) ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <Lock className="w-2.5 h-2.5 text-amber-700" />
                                  <span>Bajarilmasdan yopilgan</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                                  <span>Bajarib yopilgan</span>
                                </span>
                              )}
                              {item.closeReason && (
                                <div
                                  className="text-[10px] font-bold text-rose-900 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 max-w-[150px] truncate"
                                  title={`Yopilish sababi: ${item.closeReason}`}
                                >
                                  Sabab: {item.closeReason}
                                </div>
                              )}
                            </div>
                          ) : isDone ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                              <span>
                                Bajarildi {item.actionsCount && item.actionsCount > 1 ? `(${item.actionsCount})` : ''}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <span>Jarayonda</span>
                            </span>
                          )}
                        </td>

                        {/* 5. Action done & Planned Action / Planned Amount & Products */}
                        <td className="py-2.5 px-2.5">
                          <div className="space-y-1">
                            {/* Tanlangan reja amali va undirish summasi */}
                            {(item.plannedAction || (item.plannedAmount && item.plannedAmount > 0)) && (
                              <div className="flex flex-wrap items-center gap-1">
                                {item.plannedAction && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                    Reja: {formatPlannedActionLabel(item.plannedAction)}
                                  </span>
                                )}
                                {item.plannedAmount !== undefined && item.plannedAmount > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                                    Undirish: {formatMoney(item.plannedAmount)}
                                  </span>
                                )}
                              </div>
                            )}

                            {item.actionDone ? (
                              <div className="space-y-1">
                                {/* Visit / Call badge */}
                                <div className="flex flex-wrap items-center gap-1">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      item.actionDone === 'joyiga borildi'
                                        ? 'bg-rose-100 text-rose-900 border border-rose-200'
                                        : item.actionDone === 'telefon qilindi'
                                        ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                        : 'bg-neutral-100 text-neutral-800 border border-neutral-200'
                                    }`}
                                  >
                                    Bajardi:{' '}
                                    {item.actionDone === 'joyiga borildi'
                                      ? 'Joyiga borildi'
                                      : item.actionDone === 'telefon qilindi'
                                      ? 'Telefon qilindi'
                                      : item.actionDone === 'telefon qilindi + joyiga borildi'
                                      ? 'Telefon + Joyiga borildi'
                                      : item.actionDone}
                                  </span>

                                  {/* Payment / Credit type badge */}
                                  {item.deliveryPayment && (
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        item.deliveryPayment.paymentType === 'qarzga'
                                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      }`}
                                    >
                                      {item.deliveryPayment.paymentType === 'qarzga'
                                        ? 'Qarzga (Nasiya)'
                                        : `${item.deliveryPayment.paymentLabel || item.deliveryPayment.paymentType}`}
                                    </span>
                                  )}
                                </div>

                                {/* Delivered Products info */}
                                {(() => {
                                  const soldData = getPlanSoldProductsData(item);
                                  if (soldData.productsDelivered.length === 0) return null;
                                  return (
                                    <div className="space-y-1">
                                      <div
                                        className="text-[11px] text-neutral-800 font-medium truncate flex items-center gap-1"
                                        title={soldData.productsDelivered.map((p) => `${p.name}: ${p.quantity} ${p.unit}`).join(', ')}
                                      >
                                        <Package className="w-3 h-3 text-rose-700 shrink-0" />
                                        <span className="truncate">
                                          {soldData.productsDelivered.map((p) => `${p.quantity} ${p.unit} ${p.name}`).join(', ')}
                                        </span>
                                      </div>
                                      {!isClosed && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenExecuteModal(item, true);
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-bold transition cursor-pointer shadow-2xs"
                                          title="Sotilgan mahsulotlarga va to'lov turiga o'zgartirish kiritish"
                                        >
                                          <Edit3 className="w-2.5 h-2.5" />
                                          <span>Mahsulotga o'zgartirish kiritish</span>
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Returned Products info */}
                                {item.productsReturned && item.productsReturned.length > 0 && (
                                  <div
                                    className="text-[10px] text-amber-800 font-medium truncate flex items-center gap-1"
                                    title={item.productsReturned.map((p) => `${p.name}: ${p.quantity} ${p.unit}`).join(', ')}
                                  >
                                    <RotateCcw className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                    <span className="truncate">
                                      Qaytdi: {item.productsReturned.map((p) => `${p.quantity} ${p.unit} ${p.name}`).join(', ')}
                                    </span>
                                  </div>
                                )}

                                {/* Who executed actions on this plan */}
                                {(() => {
                                  const authors = Array.from(
                                    new Set(
                                      (item.actionsHistory || [])
                                        .map((a) => a.author)
                                        .filter(Boolean)
                                    )
                                  );
                                  const primaryExec = item.lastExecutedBy || authors[0];
                                  if (!primaryExec) return null;
                                  return (
                                    <div className="text-[9.5px] font-bold text-indigo-900 bg-indigo-50/80 border border-indigo-200/80 rounded px-1.5 py-0.5 inline-flex items-center gap-1 flex-wrap">
                                      <User className="w-2.5 h-2.5 text-indigo-700 shrink-0" />
                                      <span>
                                        Bajargan:{' '}
                                        {authors.length > 1
                                          ? authors.map((a) => getAgentDisplayName(a)).join(', ')
                                          : getAgentDisplayName(primaryExec)}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <span className="text-neutral-400 italic text-[11px] block">
                                Bajarilishi kutilmoqda
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 6. Financial: To'lov / Qarz alohida */}
                        <td className="py-2.5 px-2.5 text-right">
                          {paidAmount > 0 && debtAmount > 0 ? (
                            <div className="space-y-0.5">
                              <div
                                className="font-mono font-bold text-emerald-700 text-[11px] leading-tight"
                                title="To'lov summasi"
                              >
                                To'lov: +{formatMoney(paidAmount)}
                              </div>
                              <div
                                className="font-mono font-bold text-rose-700 text-[11px] leading-tight"
                                title="Qarzga yozilgan summa"
                              >
                                Qarz: +{formatMoney(debtAmount)}
                              </div>
                            </div>
                          ) : paidAmount > 0 ? (
                            <div
                              className="font-mono font-bold text-emerald-700 text-[11px]"
                              title="To'lov summasi"
                            >
                              To'lov: +{formatMoney(paidAmount)}
                            </div>
                          ) : debtAmount > 0 ? (
                            <div
                              className="font-mono font-bold text-rose-700 text-[11px]"
                              title="Qarzga yozilgan summa"
                            >
                              Qarz: +{formatMoney(debtAmount)}
                            </div>
                          ) : item.plannedAmount && item.plannedAmount > 0 ? (
                            <div
                              className="font-mono font-semibold text-neutral-600 text-[10px]"
                              title="Rejadagi undirish summasi"
                            >
                              Reja: {formatMoney(item.plannedAmount)}
                            </div>
                          ) : (
                            <span className="text-neutral-400 text-xs">-</span>
                          )}
                        </td>

                        {/* 7. Actions & Close / Reopen */}
                        <td
                          className="py-2.5 px-2 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(() => {
                            const soldData = getPlanSoldProductsData(item);
                            const hasSoldProducts = soldData.productsDelivered.length > 0;
                            const has234 =
                              paidAmount > 0 ||
                              debtAmount > 0 ||
                              hasSoldProducts ||
                              (item.productsReturned && item.productsReturned.length > 0);

                            if (isClosed) {
                              return (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    {has234 && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleOpenNakladnoy(item, e)}
                                        className="px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                        title="Yuk xati (PDF) chiqarish"
                                      >
                                        <Printer className="w-3 h-3" />
                                        <span>Yuk xati</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenReopenSingle(item, e)}
                                      className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Yopilgan mijozni izoh bilan qayta ochish"
                                    >
                                      <Unlock className="w-3 h-3" />
                                      <span>Qayta ochish</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenRemoveSingle(item, e)}
                                      className="px-1.5 py-1 rounded-lg border border-neutral-300 hover:border-rose-300 hover:bg-rose-50 text-neutral-600 hover:text-rose-700 text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer shadow-2xs"
                                      title="Rejadan olib tashlash"
                                    >
                                      <Trash2 className="w-3 h-3 text-rose-600" />
                                      <span>Olib tashlash</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenConfirmClose(item)}
                                  className="px-2.5 py-1 rounded-lg border border-rose-300 hover:bg-rose-50 text-rose-800 text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                  title="Oxirgi marta yopish"
                                >
                                  <Lock className="w-3 h-3 text-rose-700" />
                                  <span>Yopish</span>
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </StickyTableWrapper>
            </div>

            {/* Mobile Compact Cards View: Fits 100% of mobile screen with zero horizontal scroll */}
            <div className="block md:hidden space-y-2.5">
              {displayedPlans.map((item, idx) => {
                const isClosed = item.isClosed || item.status === 'yopildi';
                const isDone = item.status === 'bajarildi';
                const isSelected = selectedPlanIds.includes(item.id);
                const { paidAmount, debtAmount } = calcPlanFinancials(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isClosed) onOpenExecuteModal(item);
                    }}
                    className={`p-3 rounded-2xl border transition-colors ${
                      isSelected
                        ? 'bg-rose-50/70 border-rose-300 shadow-xs'
                        : isClosed
                        ? 'bg-neutral-50 border-neutral-200 opacity-90'
                        : 'bg-white border-rose-100 hover:border-rose-300 cursor-pointer shadow-xs'
                    }`}
                  >
                    {/* Top Row: #, Checkbox, Client Name, Creator, Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => toggleSelectPlanItem(item.id, e)}
                          className="w-4 h-4 rounded border-neutral-300 text-rose-700 focus:ring-rose-500 cursor-pointer shrink-0"
                          title="Tanlash"
                        />
                        <span className="font-mono text-[11px] text-neutral-400 font-bold shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-neutral-900 text-xs truncate">
                          {item.clientName}
                        </span>
                        {isClosed && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-neutral-200 text-neutral-700 shrink-0">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Yopiq</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          <User className="w-2.5 h-2.5 text-indigo-600" />
                          <span>Reja tuzdi: {getAgentDisplayName(item.agentUsername)}</span>
                        </span>
                        {(() => {
                          const executor =
                            item.lastExecutedBy ||
                            (item.actionsHistory && item.actionsHistory.length > 0
                              ? item.actionsHistory[0].author
                              : undefined);
                          if (!executor) return null;
                          return (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Amal bajardi: {getAgentDisplayName(executor)}</span>
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
                        ) : isDone ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Bajarildi</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                            Jarayonda
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Phone & Address */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-neutral-400" />
                        {item.clientPhone}
                      </span>
                      {([item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') || item.clientAddress) && (
                        <span className="flex items-center gap-1 text-neutral-600 truncate max-w-[200px]">
                          <MapPin className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                          <span className="truncate">
                            {[item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') || item.clientAddress}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Added Date & Last Payment / Product Dates */}
                    {(() => {
                      const mobileLastOps = getClientLastOperations(
                        item.clientId,
                        resolvedClients,
                        allSystemPlans
                      );
                      return (
                        <div className="mt-1.5 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                            <Calendar className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                            <span>Reja sanasi: {formatDateDMY(item.planDate || item.createdAt)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {mobileLastOps.currentDebt > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 font-mono font-bold text-rose-700">
                                Joriy qarz: {formatMoney(mobileLastOps.currentDebt)}
                              </span>
                            )}
                            {mobileLastOps.currentAdvance > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-mono font-bold text-emerald-700">
                                Haqdorlik: {formatMoney(mobileLastOps.currentAdvance)}
                              </span>
                            )}
                            {mobileLastOps.currentDebt <= 0 && mobileLastOps.currentAdvance <= 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 font-mono text-neutral-600">
                                Joriy qarz / Haqdorlik: 0 USD
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] bg-neutral-50 border border-neutral-200 rounded-lg p-1.5">
                            <div>
                              <span className="font-bold text-emerald-900">Oxirgi pul bergan: </span>
                              <span className="font-mono text-neutral-800">
                                {mobileLastOps.lastPaymentFormatted || "To'lov yo'q"}
                              </span>
                            </div>
                            <div>
                              <span className="font-bold text-amber-900">
                                {mobileLastOps.lastProductType === 'qaytarilgan'
                                  ? 'Mahsulot qaytarilgan: '
                                  : 'Mahsulot berilgan: '}
                              </span>
                              <span className="font-mono text-neutral-800">
                                {mobileLastOps.lastProductFormatted || "Amaliyot yo'q"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Planned Action & Planned Collection Amount (Mobile) */}
                    {(item.plannedAction || (item.plannedAmount && item.plannedAmount > 0)) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {item.plannedAction && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            Rejadagi amal: {formatPlannedActionLabel(item.plannedAction)}
                          </span>
                        )}
                        {item.plannedAmount !== undefined && item.plannedAmount > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                            Undirish rejasi: {formatMoney(item.plannedAmount)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Plan Note if any */}
                    {item.planNote && (
                      <div className="mt-1.5 text-[11px] text-neutral-700 bg-rose-50/60 px-2 py-1 rounded-lg border border-rose-100/80">
                        <span className="font-semibold text-rose-950">Izoh: </span>
                        <span>{item.planNote}</span>
                      </div>
                    )}

                    {/* Action & Products info */}
                    {item.actionDone && (
                      <div className="mt-2 p-2 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-1 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-neutral-900 bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-[10px]">
                            Bajardi:{' '}
                            {item.actionDone === 'joyiga borildi'
                              ? 'Joyiga borildi'
                              : item.actionDone === 'telefon qilindi'
                              ? 'Telefon qilindi'
                              : item.actionDone === 'telefon qilindi + joyiga borildi'
                              ? 'Telefon + Joyiga borildi'
                              : item.actionDone}
                          </span>
                          {item.deliveryPayment && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.deliveryPayment.paymentType === 'qarzga'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {item.deliveryPayment.paymentType === 'qarzga'
                                ? 'Qarzga (Nasiya)'
                                : `To'lov: ${item.deliveryPayment.paymentLabel || item.deliveryPayment.paymentType}`}
                            </span>
                          )}
                        </div>

                        {(() => {
                          const soldData = getPlanSoldProductsData(item);
                          if (soldData.productsDelivered.length === 0) return null;
                          return (
                            <div className="space-y-1">
                              <div className="text-neutral-800 font-medium flex items-center gap-1 truncate text-[10px]">
                                <Package className="w-3 h-3 text-rose-700 shrink-0" />
                                <span className="truncate">
                                  Berildi: {soldData.productsDelivered.map((p) => `${p.quantity} ${p.unit} ${p.name}`).join(', ')}
                                </span>
                              </div>
                              {!isClosed && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenExecuteModal(item, true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-bold transition cursor-pointer shadow-2xs"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                  <span>Mahsulotga o&apos;zgartirish kiritish</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        {item.productsReturned && item.productsReturned.length > 0 && (
                          <div className="text-amber-800 font-medium flex items-center gap-1 truncate text-[10px]">
                            <RotateCcw className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                            <span className="truncate">
                              Qaytdi: {item.productsReturned.map((p) => `${p.quantity} ${p.unit} ${p.name}`).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom Row: Payments / Debts & Buttons */}
                    <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                      <div>
                        {paidAmount > 0 && debtAmount > 0 ? (
                          <div className="flex flex-col text-[11px] font-mono font-bold leading-tight">
                            <span className="text-emerald-700">To'lov: +{formatMoney(paidAmount)}</span>
                            <span className="text-rose-700">Qarz: +{formatMoney(debtAmount)}</span>
                          </div>
                        ) : paidAmount > 0 ? (
                          <span className="text-emerald-700 font-mono font-bold text-[11px]">
                            To'lov: +{formatMoney(paidAmount)}
                          </span>
                        ) : debtAmount > 0 ? (
                          <span className="text-rose-700 font-mono font-bold text-[11px]">
                            Qarz: +{formatMoney(debtAmount)}
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-xs">-</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {!isClosed ? (
                          <button
                            type="button"
                            onClick={() => handleOpenConfirmClose(item)}
                            className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-800 text-xs font-bold cursor-pointer hover:bg-rose-50 flex items-center gap-1 shadow-2xs"
                          >
                            <Lock className="w-3 h-3 text-rose-700" />
                            <span>Yopish</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleOpenReopenSingle(item, e)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Qayta ochish</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenRemoveSingle(item, e)}
                              className="px-2.5 py-1.5 rounded-xl border border-neutral-300 hover:border-rose-300 text-neutral-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold cursor-pointer flex items-center gap-1"
                              title="Rejadan olib tashlash"
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>Olib tashlash</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Reopen Modal: Yopilgan rejadagi mijozlarni qayta ochish (Bittalab yoki Ko'plab) */}
      {reopenModalTargetIds && reopenModalTargetIds.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-200 shrink-0">
                <Unlock className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-neutral-900">
                  Yopilgan mijozlarni qayta ochish ({reopenModalTargetIds.length} ta)
                </h3>
                <p className="text-xs text-neutral-500">
                  Qayta ochish uchun sabab / izoh kiritish majburiy
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
              <div className="font-bold">Tanlangan mijozlar:</div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {reopenModalClients.map((c) => (
                  <span
                    key={c.id}
                    className="px-2 py-0.5 rounded-lg bg-white border border-emerald-200 font-semibold text-neutral-800 text-[11px]"
                  >
                    {c.clientName}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700">
                Qayta ochish izohi (majburiy): <span className="text-rose-600">*</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_REOPEN_REASONS.map((preset) => {
                  const isSelected = reopenReason === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReopenReason(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all text-left font-medium cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs font-semibold'
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
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Nima sababdan qayta ochilayotganini yozing..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReopenModalTargetIds(null);
                  setReopenReason('');
                }}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 min-h-[42px] cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={!reopenReason.trim()}
                onClick={handleExecuteReopen}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs min-h-[42px] flex items-center gap-1.5 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>Qayta ochish ({reopenModalTargetIds.length} ta)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal: Rejadagi mijozlarni olib tashlash (Aniqmi + Izoh majburiy) */}
      {removeModalTargetIds && removeModalTargetIds.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-200 shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-700" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-neutral-900">
                  Aniqmi? Rejadan olib tashlashni tasdiqlaysizmi?
                </h3>
                <p className="text-xs text-rose-700 font-semibold">
                  Haqiqatan ham ushbu mijoz ({removeModalTargetIds.length} ta) ni rejadan olib tashlamoqchimisiz?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-950 space-y-1.5">
              <div className="font-bold">Olib tashlanayotgan mijozlar:</div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {validPlans
                  .filter((p) => removeModalTargetIds.includes(p.id))
                  .map((c) => (
                    <span
                      key={c.id}
                      className="px-2 py-0.5 rounded-lg bg-white border border-rose-200 font-semibold text-neutral-800 text-[11px]"
                    >
                      {c.clientName}
                    </span>
                  ))}
              </div>
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

      {/* Confirmation Modal: Oxirgi marta yopish & Sabab kiritish */}
      {confirmCloseItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-200 shrink-0">
                <Lock className="w-6 h-6 text-rose-700" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-neutral-900">
                  Rejani yakunlash va yopish
                </h3>
                <p className="text-xs text-neutral-500">
                  Ushbu mijoz bo'yicha amallarni yakunlab yopish sababini ko'rsating
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-950 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-rose-200/80">
                <p className="font-semibold">
                  Mijoz: <span className="font-bold underline">{confirmCloseItem.clientName}</span>
                </p>
                <div className="flex items-center gap-1.5 text-neutral-700 bg-white px-2.5 py-1 rounded-lg border border-neutral-200 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-rose-700" />
                  <span className="text-[11px] font-bold">
                    Reja tuzilgan sana: <strong className="font-mono text-neutral-900">{formatDateDMY(confirmCloseItem.planDate || confirmCloseItem.createdAt)}</strong>
                  </span>
                </div>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                Yopilgandan so'ng bu mijoz <strong>faol rejalar ro'yxatidan chiqariladi</strong> ("Yopilganlar" bo'limida saqlanadi) va kiritilgan yopilish sababi butun tizimda (admin boshqaruvi, mijoz audit logi) aks etadi.
              </p>
              <div className="flex items-center gap-1.5 text-rose-800 font-bold pt-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Yopilgandan so'ng kerak bo'lsa "Yopilganlar" bo'limidan izoh kiritib qayta ochishingiz mumkin.</span>
              </div>
            </div>

            {/* Rejani yopish sanasi tanlash */}
            <div className="p-3 rounded-xl border bg-white border-neutral-200 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-700" />
                  <span>Rejani yopish sanasi:</span>
                </span>
                <span className="text-[11px] text-neutral-500 font-mono font-medium">
                  Tanlangan sana: {formatDateDMY(confirmCloseDate)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setConfirmCloseDate(getTodayDateStr())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    confirmCloseDate === getTodayDateStr()
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  Bugun
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCloseDate(getYesterdayDateStr())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    confirmCloseDate === getYesterdayDateStr()
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  Kecha
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCloseDate(getDayBeforeYesterdayDateStr())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    confirmCloseDate === getDayBeforeYesterdayDateStr()
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  Kechadan oldin
                </button>

                <div className="flex items-center gap-1 bg-neutral-50 px-2.5 py-1 rounded-xl border border-neutral-200">
                  <span className="text-[11px] font-semibold text-neutral-500">Sana:</span>
                  <input
                    type="date"
                    value={confirmCloseDate}
                    onChange={(e) => {
                      if (e.target.value) setConfirmCloseDate(e.target.value);
                    }}
                    className="text-xs font-bold font-mono text-neutral-900 bg-transparent focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Avtomatik aniqlangan yopilish holati */}
            <div className="p-3 rounded-xl border bg-neutral-50 border-neutral-200 flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-neutral-700">Yopilish holati:</span>
              {closeWithoutActionFlag ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Bajarilmasdan yopilgan (amal bajarilmagan)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Bajarib yopilgan</span>
                </span>
              )}
            </div>

            {/* Sabab tanlash va yozish */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700">
                Yopilish sababi: <span className="text-rose-600">*</span>
              </label>
              
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CLOSE_REASONS.map((reason) => {
                  const isSelected = selectedPresetReason === reason && closeReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => {
                        setSelectedPresetReason(reason);
                        setCloseReason(reason);
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all text-left font-medium cursor-pointer ${
                        isSelected
                          ? 'bg-rose-700 border-rose-700 text-white shadow-xs font-semibold'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:border-neutral-300'
                      }`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={closeReason}
                onChange={(e) => {
                  setCloseReason(e.target.value);
                  setSelectedPresetReason(e.target.value);
                }}
                placeholder="Yopilish sababini kiriting yoki yuqoridagilardan tanlang..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCloseItem(null)}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 min-h-[42px] cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={!closeReason.trim()}
                onClick={handleExecuteClose}
                className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs min-h-[42px] flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Yopish</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Black-Bordered Printable PDF Modal for Selected Clients in Reja */}
      <RejaPrintModal
        isOpen={isPlanPdfModalOpen}
        onClose={() => setIsPlanPdfModalOpen(false)}
        title="REJADAGI MIJOZLAR RO'YXATI"
        plans={displayedPlans}
        clients={resolvedClients}
        allSystemPlans={allSystemPlans}
      />

      {/* Yuk Xati Modal */}
      {nakladnoyData && (
        <NakladnoyModal
          isOpen={!!nakladnoyData}
          onClose={() => setNakladnoyData(null)}
          data={nakladnoyData}
        />
      )}
    </div>
  );
};

