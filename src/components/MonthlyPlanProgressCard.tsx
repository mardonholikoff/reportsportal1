import React, { useState, useMemo } from 'react';
import { MonthlyPlan } from '../types';
import { storageService } from '../services/storage';
import { formatMoney } from '../utils/format';
import {
  Target,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Props {
  plan: MonthlyPlan | null;
  userRole: 'admin' | 'agent';
  currentUsername: string;
  onOpenCreatePlan?: () => void;
}

export const MonthlyPlanProgressCard: React.FC<Props> = ({
  plan,
  userRole,
  onOpenCreatePlan,
}) => {
  const isAgent = userRole === 'agent';
  // Agentlar kirganda 1 oylik rejani necha foizi bo'lgani va qancha pul tushgani faqat "Ochish"ni bossa ko'rinadi
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(() => !isAgent);

  const progress = useMemo(() => {
    if (!plan) return null;
    return storageService.calculateMonthlyPlanProgress(plan);
  }, [plan]);

  if (!plan || !progress) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold font-display text-neutral-900">
              1 oylik qarz undirish rejasi
            </h3>
            <p className="text-xs text-neutral-500">
              Hozircha 1 oylik qarz undirish rejasi kiritilmagan.
            </p>
          </div>
        </div>

        {onOpenCreatePlan && (
          <button
            type="button"
            onClick={onOpenCreatePlan}
            className="flex items-center gap-2 bg-rose-700 hover:bg-rose-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer min-h-[42px] shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>1 oylik reja tuzish</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-rose-200/90 shadow-xs overflow-hidden">
      {/* Top Banner */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-rose-900 via-rose-800 to-neutral-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Target className="w-6 h-6 text-rose-200" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white">
                1 oylik qarz undirish rejasi ko'rsatkichi
              </h2>
              <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                Faol reja (@{plan.agentUsername})
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-rose-100/90 mt-1 flex-wrap font-mono">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-rose-300" />
                <span>
                  Muddat: <strong>{plan.startDate}</strong> — <strong>{plan.endDate}</strong>
                </span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  {progress.isExpired
                    ? 'Muddati yakunlangan'
                    : `${progress.daysLeft} kun qoldi`}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Toggle Ochish/Yopish + Overall Percentage Badge (only if open) + Action Button */}
        <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
          {isDetailsOpen && (
            <div className="px-3.5 py-1.5 rounded-2xl bg-white/10 border border-white/20 text-right animate-in fade-in duration-150">
              <span className="text-[10px] uppercase tracking-wider text-rose-200 block font-bold">
                Bajarilish foizi
              </span>
              <span className="text-lg sm:text-xl font-extrabold font-mono text-white">
                {progress.overallPercentage}%
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsDetailsOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer min-h-[42px] border ${
              isDetailsOpen
                ? 'bg-white/15 hover:bg-white/25 text-white border-white/25'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400'
            }`}
            title={
              isDetailsOpen
                ? "1 oylik reja foizi va tushgan pul ma'lumotlarini yashirish"
                : "1 oylik reja necha foiz bo'lgani va qancha pul tushganini ochib ko'rish"
            }
          >
            {isDetailsOpen ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Yopish</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Ochish</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>

          {onOpenCreatePlan && (
            <button
              type="button"
              onClick={onOpenCreatePlan}
              className="flex items-center gap-1.5 bg-white text-rose-900 hover:bg-rose-50 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer min-h-[42px]"
            >
              <Edit3 className="w-4 h-4 text-rose-700" />
              <span>{isAgent ? '1 oylik reja tuzish' : 'Rejani yangilash'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Breakdown Body — Faqat "Ochish" bosilganda (isDetailsOpen === true) ko'rinadi */}
      {isDetailsOpen && (
        <div className="p-4 sm:p-5 bg-gradient-to-b from-rose-50/30 to-white animate-in fade-in duration-150">
          {progress.targetResults.map((t, index) => {
            const barWidth = Math.min(100, Math.max(0, t.percentage));
            const isCompleted = t.percentage >= 100;

            return (
              <div
                key={`${t.currency}_${index}`}
                className={`p-4 rounded-2xl border transition ${
                  isCompleted
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-white border-rose-100 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 font-mono font-bold text-xs border border-rose-200">
                      USD
                    </span>
                    <span className="text-xs font-semibold text-neutral-700">
                      Reja maqsadi:{' '}
                      <strong className="text-neutral-900 font-mono">
                        {formatMoney(t.targetAmount)}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t.percentage}% Bajarildi!</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm font-extrabold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 font-mono">
                        <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
                        <span>{t.percentage}%</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/80 my-2.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCompleted
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                        : 'bg-gradient-to-r from-rose-600 to-amber-500'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Collected vs Remaining Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
                    <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                      Yopilgan eski qarz (Tushgan pul):
                    </span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {formatMoney(t.collectedAmount)}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-rose-50/60 border border-rose-100">
                    <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                      Qolgan eski qarz:
                    </span>
                    <span className="font-mono font-bold text-rose-800 text-sm">
                      {formatMoney(t.remainingAmount)}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-200/80">
                    <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                      Reja tuzilgandagi eski qarzlar:
                    </span>
                    <span className="font-mono font-bold text-neutral-800 text-sm">
                      {formatMoney(progress.initialTotalDebt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {plan.notes && (
            <div className="mt-3 text-xs text-neutral-600 italic px-1">
              Reja izohi: "{plan.notes}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

