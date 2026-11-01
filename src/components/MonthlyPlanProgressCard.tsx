import React, { useMemo } from 'react';
import { MonthlyPlan } from '../types';
import { formatMoney } from '../utils/format';
import { storageService } from '../services/storage';
import { Target, TrendingUp, Calendar, Clock, Plus, Award, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  plan: MonthlyPlan | null;
  userRole: 'admin' | 'agent';
  currentUsername: string;
  onOpenCreatePlan?: () => void;
  className?: string;
}

export const MonthlyPlanProgressCard: React.FC<Props> = ({
  plan,
  userRole,
  currentUsername,
  onOpenCreatePlan,
  className = '',
}) => {
  const isAgent = userRole === 'agent';
  const isAdmin = userRole === 'admin';

  // Compute live progress
  const progress = useMemo(() => {
    if (!plan) return null;
    return storageService.calculateMonthlyPlanProgress(plan);
  }, [plan]);

  if (!plan || !progress) {
    return (
      <div
        className={`bg-gradient-to-r from-rose-900 via-rose-800 to-neutral-900 rounded-3xl p-5 sm:p-6 text-white shadow-md border border-rose-800/40 ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-rose-300 border border-white/10 shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display tracking-tight">
                  1 oylik qarz undirish rejasi
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950">
                  Hozircha reja kiritilmagan
                </span>
              </div>
              <p className="text-xs text-rose-100/80 mt-0.5">
                Ombordagi mahsulotlar narxlari valyutasida qarz undirish foizi ko'rsatkichini boshlash uchun 1 oylik reja tuzing
              </p>
            </div>
          </div>

          {onOpenCreatePlan && (
            <button
              type="button"
              onClick={onOpenCreatePlan}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-900 font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer min-h-[42px] shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>1 oylik reja tuzish</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const { targetResults, overallPercentage, daysLeft, isExpired } = progress;

  return (
    <div
      className={`bg-gradient-to-br from-neutral-900 via-rose-950 to-neutral-900 rounded-3xl p-5 sm:p-6 text-white shadow-lg border border-rose-800/50 space-y-4 animate-in fade-in duration-200 ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-700 to-amber-600 flex items-center justify-center text-white shadow-inner shrink-0">
            <Target className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold font-display tracking-tight text-white flex items-center gap-1.5">
                <span>1 oylik qarz undirish rejasi</span>
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/10 text-rose-200 border border-white/10">
                {plan.agentUsername}
              </span>
              {isExpired ? (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40">
                  Muddat tugagan
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Qolgan muddat: {daysLeft} kun</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-rose-200/80 mt-1 font-mono">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-rose-300" />
                <span>{plan.startDate} &rarr; {plan.endDate}</span>
              </span>
              {plan.notes && (
                <span className="text-[11px] text-neutral-300 truncate max-w-[260px] hidden md:inline">
                  &bull; {plan.notes}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button: 1 oylik reja tuzish / yangilash */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenCreatePlan && (
            <button
              type="button"
              onClick={onOpenCreatePlan}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold text-xs border border-white/20 transition cursor-pointer min-h-[38px]"
              title="1 oylik reja parametrlarini yangilash yoki qayta tuzish"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAgent ? '1 oylik reja tuzish' : "Rejani o'zgartirish"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Currencies and Real-time Progress Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {targetResults.map((tgt, idx) => {
          const isFinished = tgt.percentage >= 100;
          return (
            <div
              key={idx}
              className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold font-mono bg-amber-400 text-amber-950 uppercase shadow-xs">
                    {tgt.currency}
                  </span>
                  <span className="text-xs text-neutral-300 font-medium">
                    Qarz undirish maqsadi
                  </span>
                </div>

                {/* Foiz ko'rsatkich (Katta va diqqat markazida) */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                      isFinished
                        ? 'text-emerald-400'
                        : tgt.percentage >= 50
                        ? 'text-amber-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {tgt.percentage}%
                  </span>
                  {isFinished && <Award className="w-5 h-5 text-emerald-400 shrink-0" />}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-black/40 rounded-full h-3.5 overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isFinished
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : tgt.percentage >= 50
                      ? 'bg-gradient-to-r from-amber-500 to-emerald-400'
                      : 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, tgt.percentage))}%` }}
                />
              </div>

              {/* Financial Metrics Summary */}
              <div className="grid grid-cols-3 gap-2 text-xs pt-1 font-mono">
                <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                  <span className="text-[10px] text-neutral-400 block">Maqsad</span>
                  <span className="font-bold text-white tabular-nums">
                    {formatMoney(tgt.targetAmount)}
                  </span>
                </div>

                <div className="bg-emerald-500/10 rounded-xl p-2 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-300 block">Undirilgan qarz</span>
                  <span className="font-bold text-emerald-300 tabular-nums">
                    {formatMoney(tgt.collectedAmount)}
                  </span>
                </div>

                <div className="bg-rose-500/10 rounded-xl p-2 border border-rose-500/20">
                  <span className="text-[10px] text-rose-300 block">Qolgan qarz</span>
                  <span className="font-bold text-rose-200 tabular-nums">
                    {formatMoney(tgt.remainingAmount)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanatory summary footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-neutral-300/80 pt-1">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Belgilangan muddat davomida mijozlar qarzlaridan tushgan to'lovlar avtomatik tarzda foizga hisoblanadi.
          </span>
        </div>
        <div className="text-neutral-400 font-mono">
          Holat: {isExpired ? 'Tugagan' : 'Faol kuzatuvda'}
        </div>
      </div>
    </div>
  );
};
