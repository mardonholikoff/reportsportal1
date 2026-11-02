import React, { useMemo, useState } from 'react';
import {
  Package,
  Calendar,
  TrendingUp,
  Edit3,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  User,
  ChevronDown,
  ChevronUp,
  Lock,
  Users,
  Percent,
  Tag,
  Info,
} from 'lucide-react';
import { MonthlyPlan } from '../types';
import { storageService } from '../services/storage';

interface MonthlyProductPlanProgressCardProps {
  plan: MonthlyPlan | null;
  onOpenModal?: () => void;
  onOpenCreatePlan?: () => void;
  canEdit?: boolean;
  userRole?: 'admin' | 'agent';
  currentUsername?: string;
  agentLabel?: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  qarzga: 'Qarzga',
  naqd: 'Naqd',
  karta: 'Karta',
  bank: 'Bank',
  qr: 'QR kod',
};

export const MonthlyProductPlanProgressCard: React.FC<MonthlyProductPlanProgressCardProps> = ({
  plan,
  onOpenModal,
  onOpenCreatePlan,
  canEdit = true,
  agentLabel,
}) => {
  const handleOpen = onOpenCreatePlan || onOpenModal || (() => {});
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showClientsBreakdown, setShowClientsBreakdown] = useState(true);

  const progress = useMemo(() => {
    if (!plan) return null;
    return storageService.calculateMonthlyProductPlanProgress(plan);
  }, [plan, storageService.getDailyPlans(), storageService.getClients()]);

  if (!plan || !progress) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 border border-indigo-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              1 Oylik (30 Kunlik) Mahsulot Berish Rejasi Hali Tuzilmagan
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Mijozlarni tanlab, ularga ombordagi mavjud mahsulotlardan (foiz yoki son chegirmasi
              bilan) 30 kunlik mahsulot berish rejasini tuzing — umumiy 30 kunlik summa va foizlar
              (%) avtomatik hisoblanadi.
            </p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={handleOpen}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
          >
            <Package className="w-4 h-4" />1 Oylik Mahsulot Rejasi Tuzish
          </button>
        )}
      </div>
    );
  }

  const formatNum = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n * 100) / 100);
  const editCount = plan.editHistory?.length || 0;
  const mainStat = progress.targetResults[0] || {
    currency: 'USD',
    targetAmount: 0,
    deliveredAmount: 0,
    percentage: 0,
    remainingAmount: 0,
  };
  const clientResults = progress.clientPlanResults || [];

  return (
    <div className="bg-white border border-indigo-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top Row: Title, Summary & Expand/Edit Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div
          onClick={() => setIsCardExpanded((prev) => !prev)}
          className="flex items-start sm:items-center gap-3 cursor-pointer select-none group flex-1"
        >
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0 ${
              progress.overallPercentage >= 100
                ? 'bg-emerald-600'
                : progress.isExpired
                  ? 'bg-rose-600'
                  : 'bg-indigo-600'
            }`}
          >
            {progress.overallPercentage >= 100 ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : progress.isExpired ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <Package className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-indigo-700 transition-colors">
                1 Oylik (30 Kunlik) Mahsulot Berish Rejasi
              </h3>
              {agentLabel && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Agent: @{agentLabel}
                </span>
              )}
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                  progress.overallPercentage >= 100
                    ? 'bg-emerald-100 text-emerald-800'
                    : progress.overallPercentage >= 50
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                30 kunlik: {progress.overallPercentage}% bajarildi
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                {formatNum(mainStat.deliveredAmount)} / {formatNum(mainStat.targetAmount)}
              </span>
              {!progress.isExpired && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-50 text-violet-800 border border-violet-200">
                  <Lock className="w-3 h-3" />
                  Yangi reja yopiq (faqat tahrir)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {plan.startDate} — {plan.endDate} ({progress.totalDays} kunlik)
              </span>
              <span
                className={`inline-flex items-center gap-1 font-bold ${
                  progress.isExpired ? 'text-rose-600' : 'text-indigo-600'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {progress.isExpired ? 'Muddat tugagan' : `${progress.daysLeft} kun qoldi`}
              </span>
              {clientResults.length > 0 && (
                <span className="inline-flex items-center gap-1 font-bold text-indigo-700">
                  <Users className="w-3.5 h-3.5" />
                  Rejadagi mijozlar: {clientResults.length} ta
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          <button
            type="button"
            onClick={() => setIsCardExpanded((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-800 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isCardExpanded ? (
              <>
                Yopish
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                Ochish
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>

          {isCardExpanded && editCount > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              Tarix ({editCount})
              {showHistory ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleOpen}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {progress.isExpired ? 'Yangi Mahsulot Rejasi' : 'Rejani Tahrirlash'}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      {isCardExpanded && (
        <div className="space-y-4 pt-1 animate-fadeIn">
          {/* Reminder Banner */}
          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-start gap-2 text-xs text-indigo-950">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              <span className="font-extrabold">Eslatma:</span> Reja uchun tanlangan mahsulotlar
              ombordan ketmaydi (zaxiradan kamaymaydi). Mijozga 30 kunlik reja doirasida mahsulot
              berilganda (xoh qarzga, xoh naqd/karta/bank/QR to'lov usuli bilan bo'lsin) mijozning
              30 kunlik foizi (%) va umumiy 30 kunlik reja foizi (%) avtomatik yangilanadi.
            </span>
          </div>

          {/* Overall 30-Day Progress Bar */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/60 border border-indigo-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-700 text-white text-xs font-extrabold tracking-wide">
                  UMUMIY 30 KUNLIK MAHSULOT REJASI
                </span>
                <span className="text-xs font-bold text-slate-600">
                  Jami reja:{' '}
                  <strong className="text-slate-900">{formatNum(mainStat.targetAmount)}</strong>
                </span>
              </div>
              <div className="text-right flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Bajarilish ko'rsatkichi:</span>
                <span
                  className={`text-base font-black ${
                    mainStat.percentage >= 100
                      ? 'text-emerald-600'
                      : mainStat.percentage >= 50
                        ? 'text-indigo-600'
                        : 'text-amber-600'
                  }`}
                >
                  {mainStat.percentage}%
                </span>
              </div>
            </div>

            <div className="w-full h-3.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  mainStat.percentage >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : mainStat.percentage >= 50
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}
                style={{ width: `${Math.min(100, mainStat.percentage)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5 flex-wrap gap-2">
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Berilgan mahsulotlar (barcha to'lov usullarida):{' '}
                {formatNum(mainStat.deliveredAmount)}
              </span>
              <span className="text-slate-600 font-semibold">
                Qolgan reja: <strong>{formatNum(mainStat.remainingAmount)}</strong>
              </span>
            </div>
          </div>

          {/* Per-Client 30-Day Product Delivery Table (No 10-day columns) */}
          {clientResults.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Mijozlar bo'yicha 30 kunlik mahsulot rejasi va foizlar ({clientResults.length} ta
                  mijoz)
                </div>
                <button
                  type="button"
                  onClick={() => setShowClientsBreakdown((prev) => !prev)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  {showClientsBreakdown ? (
                    <>
                      Jadvalni yashirish <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      Jadvalni ko'rish <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {showClientsBreakdown && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="max-h-96 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[780px]">
                      <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase">
                        <tr>
                          <th className="py-2.5 px-3 min-w-[180px]">Mijoz</th>
                          <th className="py-2.5 px-3 min-w-[340px] bg-indigo-50/60 text-indigo-900">
                            30 Kunlik Reja Uchun Tanlangan Ombor Mahsulotlari
                          </th>
                          <th className="py-2.5 px-3 w-64 bg-emerald-50/70 text-emerald-950">
                            30 Kunlik Reja / Berildi / Foiz (%)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {clientResults.map((cr) => {
                          const paymentMethodsEntries = Object.entries(
                            cr.byPaymentMethod || {}
                          ).filter(([, amt]) => amt > 0);

                          return (
                            <tr
                              key={cr.clientId}
                              className="hover:bg-slate-50/90 transition-colors align-top"
                            >
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800">{cr.clientName}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  {cr.clientCode && <span>Kod: {cr.clientCode}</span>}
                                  {cr.clientPhone && <span>• {cr.clientPhone}</span>}
                                </div>
                              </td>

                              <td className="py-2.5 px-3">
                                {cr.plannedProducts && cr.plannedProducts.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {cr.plannedProducts.map((p) => (
                                      <div
                                        key={p.id}
                                        className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px]"
                                      >
                                        <div className="font-bold text-slate-800 flex items-center gap-1">
                                          <Tag className="w-3 h-3 text-indigo-500 shrink-0" />
                                          <span className="truncate">{p.productName}</span>
                                        </div>
                                        <div className="text-slate-600 font-semibold mt-0.5">
                                          {p.quantity} {p.unit} × {formatNum(p.unitPrice)} ={' '}
                                          <strong className="text-indigo-800">
                                            {formatNum(p.totalPrice)}
                                          </strong>
                                        </div>
                                        {(p.discountPercent > 0 ||
                                          (p.discountAmount && p.discountAmount > 0)) && (
                                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                            {p.discountPercent > 0 && (
                                              <span className="inline-block px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-extrabold text-[9px]">
                                                Foiz chegirma: -{p.discountPercent}%
                                              </span>
                                            )}
                                            {p.discountAmount && p.discountAmount > 0 ? (
                                              <span className="inline-block px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-extrabold text-[9px]">
                                                Son chegirma: -{formatNum(p.discountAmount)}
                                              </span>
                                            ) : null}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">—</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 bg-emerald-50/20">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="font-extrabold text-slate-900">
                                      Reja: {formatNum(cr.targetAmount)}
                                    </div>
                                    <div className="text-[11px] font-bold text-emerald-700">
                                      Berildi: {formatNum(cr.deliveredAmount)}
                                    </div>
                                  </div>
                                  <span
                                    className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full font-black text-xs ${
                                      cr.percentage >= 100
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : cr.percentage > 0
                                          ? 'bg-indigo-100 text-indigo-800'
                                          : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    <Percent className="w-3 h-3" />
                                    {cr.percentage}%
                                  </span>
                                </div>
                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                                  <div
                                    className={`h-full rounded-full ${
                                      cr.percentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                                    }`}
                                    style={{ width: `${Math.min(100, cr.percentage)}%` }}
                                  />
                                </div>
                                {paymentMethodsEntries.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap mt-1.5">
                                    {paymentMethodsEntries.map(([mKey, mVal]) => (
                                      <span
                                        key={mKey}
                                        className="inline-block px-1.5 py-0.5 rounded bg-white border border-emerald-200 text-emerald-800 font-bold text-[10px]"
                                      >
                                        {PAYMENT_METHOD_LABELS[mKey] || mKey}: {formatNum(mVal)}
                                      </span>
                                    ))}
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
              )}
            </div>
          )}

          {/* Chronological Edit History Section */}
          {showHistory && plan.editHistory && plan.editHistory.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-600" />
                  Tahrirlar xronologiyasi (Kim, qachon va nima sababdan tahrirlagan)
                </h4>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {plan.editHistory.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex flex-col gap-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 font-extrabold text-indigo-700">
                        <User className="w-3.5 h-3.5" />@{item.editedBy}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {new Date(item.editedAt).toLocaleString('uz-UZ')}
                      </span>
                    </div>
                    <p className="font-bold text-slate-800">
                      Tahrir izohi: <span className="text-indigo-900">"{item.reason}"</span>
                    </p>
                    {item.changesSummary && (
                      <p className="text-[11px] text-slate-500 font-medium">
                        {item.changesSummary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.notes && (
            <div className="text-xs text-slate-600 bg-amber-50/70 border border-amber-200/70 rounded-xl px-3.5 py-2 font-medium">
              <strong className="text-amber-900">Eslatma:</strong> {plan.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
