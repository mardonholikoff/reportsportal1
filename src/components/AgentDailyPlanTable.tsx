import React, { useState } from 'react';
import { DailyPlanItem } from '../types';
import { formatMoney, formatDate } from '../utils/format';
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
  AlertTriangle,
  Package,
  RotateCcw,
  Target,
  Printer,
} from 'lucide-react';
import { NakladnoyModal, NakladnoyData } from './NakladnoyModal';

interface Props {
  plans: DailyPlanItem[];
  onOpenCreatePlan: () => void;
  onOpenMonthlyPlan?: () => void;
  onOpenExecuteModal: (item: DailyPlanItem) => void;
  onMarkPlannedActionDone?: (item: DailyPlanItem) => void;
  onUpdatePlanNote?: (planItemId: string, note: string) => void;
  onClosePlanItem?: (planItemId: string, closeReason?: string) => void;
}

const PRESET_CLOSE_REASONS = [
  "Hisob-kitob va amallar to'liq yakunlandi",
  "To'lov qabul qilindi, qarz to'liq yopildi",
  "Tovarlar muvaffaqiyatli topshirildi",
  "Do'kon yopiq / Mijoz joyida yo'q",
  "Keyingi kunga qoldirildi",
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

export const AgentDailyPlanTable: React.FC<Props> = ({
  plans,
  onOpenCreatePlan,
  onOpenMonthlyPlan,
  onOpenExecuteModal,
  onMarkPlannedActionDone,
  onUpdatePlanNote,
  onClosePlanItem,
}) => {
  // State for editing plan note inline
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  // Filter tabs: 'active' (default) -> closed plans disappear from active view!
  const [planViewFilter, setPlanViewFilter] = useState<'active' | 'closed' | 'all'>('active');

  // State for confirming closing of plan item (Oxirgi marta yopish)
  const [confirmCloseItem, setConfirmCloseItem] = useState<DailyPlanItem | null>(null);
  const [closeReason, setCloseReason] = useState<string>('');
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>('');
  const [nakladnoyData, setNakladnoyData] = useState<NakladnoyData | null>(null);
  const [isPlanPdfModalOpen, setIsPlanPdfModalOpen] = useState<boolean>(false);

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

  const activePlans = plans.filter((p) => !p.isClosed && p.status !== 'yopildi');
  const closedPlans = plans.filter((p) => p.isClosed || p.status === 'yopildi');
  const displayedPlans =
    planViewFilter === 'active'
      ? activePlans
      : planViewFilter === 'closed'
      ? closedPlans
      : plans;

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
    const defaultReason = "Hisob-kitob va amallar to'liq yakunlandi";
    setCloseReason(defaultReason);
    setSelectedPresetReason(defaultReason);
  };

  const handleExecuteClose = () => {
    if (confirmCloseItem && onClosePlanItem) {
      const finalReason = closeReason.trim() || selectedPresetReason || "Amallar yakunlandi";
      onClosePlanItem(confirmCloseItem.id, finalReason);
      setConfirmCloseItem(null);
      setCloseReason('');
      setSelectedPresetReason('');
    }
  };

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
                {plans.length}
              </span>
            </button>
          </div>

          {displayedPlans.length > 0 && (
            <button
              type="button"
              onClick={() => setIsPlanPdfModalOpen(true)}
              className="flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[38px] cursor-pointer"
              title="Rejadagi mijozlar ro'yxatini qora borderli PDF formatda chiqarish"
            >
              <Printer className="w-4 h-4" />
              <span>Rejani PDF (Print)</span>
            </button>
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
                  <span>Yopilganlarni ko'rish ({closedPlans.length})</span>
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
            {/* Desktop / Tablet Compact Table: NO horizontal scroll */}
            <div className="hidden md:block rounded-2xl border border-rose-100 overflow-hidden bg-white">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-rose-50/70 border-b border-rose-100 text-neutral-800 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-2.5 w-[4%] text-center">#</th>
                    <th className="py-2.5 px-2.5 w-[24%]">Mijoz va Manzil</th>
                    <th className="py-2.5 px-2.5 w-[18%]">Reja izohi</th>
                    <th className="py-2.5 px-2.5 w-[11%]">Holati</th>
                    <th className="py-2.5 px-2.5 w-[21%]">Qilingan amal va Mahsulot</th>
                    <th className="py-2.5 px-2.5 w-[11%] text-right">To'lov / Qarz</th>
                    <th className="py-2.5 px-2.5 w-[11%] text-center">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100/60">
                  {displayedPlans.map((item, idx) => {
                    const isClosed = item.isClosed || item.status === 'yopildi';
                    const isDone = item.status === 'bajarildi';
                    const isEditingThisNote = editingNoteId === item.id;
                    const { paidAmount, debtAmount } = calcPlanFinancials(item);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          if (!isClosed) onOpenExecuteModal(item);
                        }}
                        className={`transition-colors ${
                          isClosed
                            ? 'bg-neutral-50/70 opacity-75 cursor-default'
                            : 'hover:bg-rose-50/30 cursor-pointer'
                        }`}
                      >
                        {/* 1. Index */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-neutral-400 text-[11px]">
                          {idx + 1}
                        </td>

                        {/* 2. Client & Address */}
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
                          <div className="flex items-center gap-1 text-neutral-500 text-[10px] font-mono mt-0.5">
                            <Calendar className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                            <span>Qo'shilgan: {formatDate(item.createdAt)}</span>
                          </div>
                        </td>

                        {/* 3. Plan Note */}
                        <td
                          className="py-2.5 px-2.5"
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

                        {/* 4. Status */}
                        <td className="py-2.5 px-2.5">
                          {isClosed ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-200 text-neutral-800 border border-neutral-300">
                                <Lock className="w-2.5 h-2.5 text-neutral-600" />
                                <span>Yopildi</span>
                              </span>
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
                                {item.productsDelivered && item.productsDelivered.length > 0 && (
                                  <div
                                    className="text-[11px] text-neutral-800 font-medium truncate flex items-center gap-1"
                                    title={item.productsDelivered.map((p) => `${p.name}: ${p.quantity} ${p.unit}`).join(', ')}
                                  >
                                    <Package className="w-3 h-3 text-rose-700 shrink-0" />
                                    <span className="truncate">
                                      {item.productsDelivered.map((p) => `${p.quantity} ${p.unit} ${p.name}`).join(', ')}
                                    </span>
                                  </div>
                                )}

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

                        {/* 7. Actions & Close (Yuk xati Print only when 2, 3, or 4 exists) */}
                        <td
                          className="py-2.5 px-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(() => {
                            const has234 =
                              paidAmount > 0 ||
                              debtAmount > 0 ||
                              (item.productsDelivered && item.productsDelivered.length > 0) ||
                              (item.productsReturned && item.productsReturned.length > 0);

                            if (isClosed) {
                              return (
                                <div className="flex items-center justify-center gap-1">
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
                                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-100 text-neutral-500 text-[11px] font-semibold border border-neutral-200">
                                    <Lock className="w-3 h-3 text-neutral-500" />
                                    <span>Yopilgan</span>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                {!isDone && onMarkPlannedActionDone && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMarkPlannedActionDone(item);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                    title="Tanlangan reja amalini Bajarildi deb belgilash"
                                  >
                                    <Check className="w-3 h-3 stroke-[2.5]" />
                                    <span>Bajarildi</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onOpenExecuteModal(item)}
                                  className="px-2 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                  title="Amal tafsilotlari yoki qo'shimcha amal qo'shish"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{isDone ? "+ Amal" : "Amal / Hisobot"}</span>
                                </button>
                                {has234 && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenNakladnoy(item, e)}
                                    className="px-1.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-bold transition flex items-center justify-center gap-0.5 cursor-pointer"
                                    title="Yuk xati (PDF) qora borderlar bilan chiqarish"
                                  >
                                    <Printer className="w-3 h-3" />
                                    <span>Yuk xati</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenConfirmClose(item)}
                                  className="px-1.5 py-1 rounded-lg border border-rose-300 hover:bg-rose-50 text-rose-800 text-[11px] font-bold transition flex items-center justify-center gap-0.5 cursor-pointer"
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
            </div>

            {/* Mobile Compact Cards View: Fits 100% of mobile screen with zero horizontal scroll */}
            <div className="block md:hidden space-y-2.5">
              {displayedPlans.map((item, idx) => {
                const isClosed = item.isClosed || item.status === 'yopildi';
                const isDone = item.status === 'bajarildi';
                const { paidAmount, debtAmount } = calcPlanFinancials(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isClosed) onOpenExecuteModal(item);
                    }}
                    className={`p-3 rounded-2xl border transition-colors ${
                      isClosed
                        ? 'bg-neutral-50 border-neutral-200 opacity-80'
                        : 'bg-white border-rose-100 hover:border-rose-300 cursor-pointer shadow-xs'
                    }`}
                  >
                    {/* Top Row: #, Client Name, Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
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
                      </div>

                      <div className="shrink-0">
                        {isClosed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-200 text-neutral-700">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Yopildi</span>
                          </span>
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

                    {/* Added Date */}
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                      <Calendar className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                      <span>Qo'shilgan: {formatDate(item.createdAt)}</span>
                    </div>

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

                        {item.productsDelivered && item.productsDelivered.length > 0 && (
                          <div className="text-neutral-800 font-medium flex items-center gap-1 truncate text-[10px]">
                            <Package className="w-3 h-3 text-rose-700 shrink-0" />
                            <span className="truncate">
                              Berildi: {item.productsDelivered.map((p) => `${p.quantity} ${p.unit} ${p.name}`).join(', ')}
                            </span>
                          </div>
                        )}

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
                        {(paidAmount > 0 ||
                          debtAmount > 0 ||
                          (item.productsDelivered && item.productsDelivered.length > 0) ||
                          (item.productsReturned && item.productsReturned.length > 0)) && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenNakladnoy(item, e)}
                            className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Yuk xati (PDF)</span>
                          </button>
                        )}
                        {!isClosed ? (
                          <>
                            {!isDone && onMarkPlannedActionDone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkPlannedActionDone(item);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1"
                              >
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                <span>Bajarildi</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenExecuteModal(item)}
                              className="px-3 py-1.5 rounded-xl bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{isDone ? "Qo'shimcha amal" : "Amal / Hisobot"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmClose(item)}
                              className="px-2.5 py-1.5 rounded-xl border border-rose-300 text-rose-800 text-xs font-bold cursor-pointer hover:bg-rose-50"
                            >
                              <Lock className="w-3 h-3 inline mr-1" />
                              <span>Yopish</span>
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] text-neutral-500 font-semibold flex items-center gap-1">
                              <Lock className="w-3 h-3 text-neutral-400" /> Yopilgan
                            </span>
                            {item.closeReason && (
                              <span className="text-[10px] text-rose-800 font-medium italic max-w-[150px] truncate" title={item.closeReason}>
                                "{item.closeReason}"
                              </span>
                            )}
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
              <p className="font-semibold">
                Mijoz: <span className="font-bold underline">{confirmCloseItem.clientName}</span>
              </p>
              <p className="text-neutral-600 leading-relaxed">
                Yopilgandan so'ng bu mijoz <strong>faol rejalar ro'yxatidan chiqariladi</strong> ("Yopilganlar" bo'limida saqlanadi) va kiritilgan yopilish sababi butun tizimda (admin boshqaruvi, mijoz audit logi) aks etadi.
              </p>
              <div className="flex items-center gap-1.5 text-rose-800 font-bold pt-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Yopilgandan so'ng bugungi reja bo'yicha yangi amal qo'shib bo'lmaydi!</span>
              </div>
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
                <span>Ha, yakunlash va yopish</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Black-Bordered Printable PDF Modal for Selected Clients in Reja */}
      {isPlanPdfModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #reja-printable-sheet,
              #reja-printable-sheet * {
                visibility: visible !important;
              }
              #reja-printable-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 12px !important;
                box-shadow: none !important;
              }
              .no-print-reja-controls {
                display: none !important;
              }
            }
          `}</style>
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-neutral-300 my-4 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Top Controls */}
            <div className="no-print-reja-controls px-5 py-3.5 bg-neutral-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold leading-tight">
                    Rejadagi mijozlar ro'yxati (PDF / Chop etish)
                  </h3>
                  <p className="text-[11px] text-neutral-300">
                    Qora borderli tayyor jadval ({displayedPlans.length} ta mijoz)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / PDF saqlash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlanPdfModalOpen(false)}
                  className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
                  aria-label="Yopish"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Black-Bordered Sheet */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-neutral-100 flex-1">
              <div
                id="reja-printable-sheet"
                className="bg-white text-black p-5 sm:p-7 border-2 border-black mx-auto max-w-4xl space-y-4 font-sans"
              >
                <div className="border-b-2 border-black pb-3 flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-wide text-black">
                      REJADAGI MIJOZLAR RO'YXATI
                    </h1>
                    <p className="text-xs font-semibold text-black mt-0.5">
                      Sana: {formatDate(new Date().toISOString())} | Jami mijozlar: {displayedPlans.length} ta
                    </p>
                  </div>
                  <div className="text-right text-xs font-mono font-bold border border-black px-3 py-1.5">
                    <div>
                      Undirish rejasi jami:{' '}
                      {formatMoney(
                        displayedPlans.reduce((acc, p) => acc + (p.plannedAmount || 0), 0)
                      )}
                    </div>
                  </div>
                </div>

                <table className="w-full border-collapse border-2 border-black text-xs text-black">
                  <thead>
                    <tr className="bg-neutral-100 font-bold uppercase text-[11px]">
                      <th className="border border-black py-2 px-2 text-center w-9">№</th>
                      <th className="border border-black py-2 px-2.5 text-left">Mijoz F.I.Sh</th>
                      <th className="border border-black py-2 px-2.5 text-left">Telefon</th>
                      <th className="border border-black py-2 px-2.5 text-left">Manzil</th>
                      <th className="border border-black py-2 px-2.5 text-left">
                        Tanlangan amal
                      </th>
                      <th className="border border-black py-2 px-2.5 text-right">
                        Undirish rejasi (USD)
                      </th>
                      <th className="border border-black py-2 px-2.5 text-left">
                        Holati / Izoh
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPlans.map((item, index) => {
                      const plannedLabel = formatPlannedActionLabel(
                        item.plannedAction || item.actionDone
                      );
                      return (
                        <tr key={item.id}>
                          <td className="border border-black py-2 px-2 text-center font-mono font-bold">
                            {index + 1}
                          </td>
                          <td className="border border-black py-2 px-2.5 font-bold">
                            {item.clientName}
                          </td>
                          <td className="border border-black py-2 px-2.5 font-mono">
                            {item.clientPhone}
                          </td>
                          <td className="border border-black py-2 px-2.5">
                            {[item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') ||
                              item.clientAddress ||
                              '-'}
                            {item.clientLandmark ? ` (${item.clientLandmark})` : ''}
                          </td>
                          <td className="border border-black py-2 px-2.5 font-semibold">
                            {plannedLabel || '-'}
                          </td>
                          <td className="border border-black py-2 px-2.5 text-right font-mono font-bold">
                            {item.plannedAmount && item.plannedAmount > 0
                              ? formatMoney(item.plannedAmount)
                              : '-'}
                          </td>
                          <td className="border border-black py-2 px-2.5">
                            <div className="font-bold">
                              {item.status === 'bajarildi'
                                ? `Bajardi (${formatPlannedActionLabel(item.actionDone)})`
                                : item.isClosed || item.status === 'yopildi'
                                ? 'Yopilgan'
                                : 'Rejada'}
                            </div>
                            {(item.planNote || item.reportNote) && (
                              <div className="text-[11px]">
                                {item.planNote || item.reportNote}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

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
