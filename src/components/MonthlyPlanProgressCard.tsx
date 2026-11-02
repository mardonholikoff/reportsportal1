import React, { useState, useMemo } from 'react';
import { MonthlyPlan } from '../types';
import { storageService } from '../services/storage';
import { formatMoney, formatDate } from '../utils/format';
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
  History,
  User,
  Lock,
  Layers,
  Users,
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
              Hozircha 1 oylik qarz undirish rejasi kiritilmagan (Eng kami 30 kunlik muddat va 3 ta
              10 kunlik reja).
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

  const editLogs = plan.editHistory || [];

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
              {!progress.isExpired && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" />
                  <span>Yangi reja bloklangan (Faqat tahrirlash)</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-rose-100/90 mt-1 flex-wrap font-mono">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-rose-300" />
                <span>
                  Muddat: <strong>{plan.startDate}</strong> — <strong>{plan.endDate}</strong> (
                  {progress.totalDays} kun)
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
              {editLogs.length > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-200">
                    <History className="w-3.5 h-3.5" />
                    <span>{editLogs.length} marta tahrirlangan</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Toggle Ochish/Yopish + 4 Percentage Summary Badges (only if open) + Action Button */}
        <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
          {isDetailsOpen && (
            <div className="flex items-center gap-1.5 flex-wrap animate-in fade-in duration-150">
              <div className="px-3 py-1.5 rounded-2xl bg-white/15 border border-white/25 text-right">
                <span className="text-[9px] uppercase tracking-wider text-rose-200 block font-bold">
                  Umumiy 30 kunlik
                </span>
                <span className="text-base sm:text-lg font-extrabold font-mono text-white">
                  {progress.overallPercentage}%
                </span>
              </div>
              {progress.decadeResults.map((dec) => (
                <div
                  key={dec.decadeNumber}
                  className="px-2.5 py-1.5 rounded-2xl bg-indigo-500/25 border border-indigo-300/30 text-right hidden md:block"
                >
                  <span className="text-[9px] uppercase tracking-wider text-indigo-100 block font-bold">
                    {dec.decadeNumber}-chi 10 kunlik
                  </span>
                  <span className="text-sm font-extrabold font-mono text-white">
                    {dec.percentage}%
                  </span>
                </div>
              ))}
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
              <span>
                {progress.isExpired ? 'Yangi 1 oylik reja tuzish' : 'Mavjud rejani tahrirlash'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Breakdown Body — Faqat "Ochish" bosilganda (isDetailsOpen === true) ko'rinadi */}
      {isDetailsOpen && (
        <div className="p-4 sm:p-5 bg-gradient-to-b from-rose-50/30 to-white space-y-4 animate-in fade-in duration-150">
          {/* 1. UMUMIY 30 KUNLIK REJA KO'RSATKICHI */}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 font-mono font-bold text-xs border border-rose-200">
                      1-FOIZ: UMUMIY {progress.totalDays} KUNLIK REJA
                    </span>
                    <span className="text-xs font-semibold text-neutral-700">
                      Umumiy maqsad:{' '}
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
                        <span>Umumiy: {t.percentage}%</span>
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
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                    <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                      Yopilgan eski qarz (Jami tushgan pul):
                    </span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {formatMoney(t.collectedAmount)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                    <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                      Qolgan eski qarz:
                    </span>
                    <span className="font-mono font-bold text-rose-800 text-sm">
                      {formatMoney(t.remainingAmount)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
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

          {/* 2. 10 KUNLIKLAR BO'YICHA 3 TA ALOHIDA FOIZ KO'RSATKICHLARI */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2 px-1">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-700" />
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 uppercase tracking-wide">
                  10 kunlik davrlar bo'yicha bajarilish foizlari (1-chi, 2-chi va 3-chi 10 kunlik)
                </h3>
              </div>
              <span className="text-[11px] text-neutral-500">
                Har bir 10 kunlikda yopilgan qarzga qarab o'z foizi ko'tarilib boradi
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {progress.decadeResults.map((dec) => {
                const decBarWidth = Math.min(100, Math.max(0, dec.percentage));
                const decCompleted = dec.percentage >= 100;

                return (
                  <div
                    key={dec.decadeNumber}
                    className={`p-3.5 rounded-2xl border transition flex flex-col justify-between ${
                      decCompleted
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : dec.isCurrent
                          ? 'bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-200 shadow-2xs'
                          : 'bg-white border-neutral-200 shadow-2xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 font-mono font-extrabold text-[11px] border border-indigo-200">
                            {dec.label}
                          </span>
                          {dec.isCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-300">
                              Joriy davr
                            </span>
                          )}
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 text-xs font-extrabold px-2 py-0.5 rounded-full border font-mono ${
                            decCompleted
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                          }`}
                        >
                          {decCompleted ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <TrendingUp className="w-3 h-3 text-indigo-600" />
                          )}
                          <span>{dec.percentage}%</span>
                        </span>
                      </div>

                      <p className="text-[11px] font-mono text-neutral-500 mb-2">
                        Muddat: <strong>{dec.startDate}</strong> — <strong>{dec.endDate}</strong>
                      </p>

                      {/* Decade Progress Bar */}
                      <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/80 my-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            decCompleted
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                              : 'bg-gradient-to-r from-indigo-600 to-sky-500'
                          }`}
                          style={{ width: `${decBarWidth}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-neutral-100 text-[11px]">
                      <div>
                        <span className="text-neutral-500 block text-[9px] uppercase font-bold">
                          Reja:
                        </span>
                        <span className="font-mono font-bold text-neutral-900">
                          {formatMoney(dec.targetAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[9px] uppercase font-bold">
                          Tushgan:
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          {formatMoney(dec.collectedAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[9px] uppercase font-bold">
                          Qoldiq:
                        </span>
                        <span className="font-mono font-bold text-rose-700">
                          {formatMoney(dec.remainingAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. MIJOZLAR KESIMIDA UMUMIY VA 10 KUNLIKLAR UNDIRUV REJASI VA BAJARILISHI */}
          <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200/90 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Users className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 uppercase tracking-wide">
                  Mijozlar kesimida 1 oylik va 10 kunliklar undiruv rejasi va 4 ta foiz ko'rsatkichi ({progress.clientPlanResults.length} ta tanlangan mijoz)
                </h3>
              </div>

              {onOpenCreatePlan && (
                <button
                  type="button"
                  onClick={onOpenCreatePlan}
                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer transition"
                >
                  Mijozlar rejasini tahrirlash / qo'shish
                </button>
              )}
            </div>

            {progress.clientPlanResults.length > 0 && (() => {
              const overallTargetAmount = progress.targetResults[0]?.targetAmount || 0;
              const sumClientTarget = progress.clientPlanResults.reduce((s, c) => s + c.targetAmount, 0);
              const sumClientD1 = progress.clientPlanResults.reduce((s, c) => s + c.decade1.target, 0);
              const sumClientD2 = progress.clientPlanResults.reduce((s, c) => s + c.decade2.target, 0);
              const sumClientD3 = progress.clientPlanResults.reduce((s, c) => s + c.decade3.target, 0);
              const isValidRule = overallTargetAmount <= sumClientTarget;
              return (
                <div className={`p-2.5 rounded-xl border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                  isValidRule
                    ? 'bg-emerald-100/60 border-emerald-300 text-emerald-950'
                    : 'bg-amber-100/70 border-amber-300 text-amber-950'
                }`}>
                  <div>
                    <span className="font-bold">Reja va mijozlar yig'indisi nisbati: </span>
                    Rejaga undirish muddat oralig'idagi summa (<strong className="font-mono">{formatMoney(overallTargetAmount)} so'm</strong>) pastda tanlangan mijozlar yig'indisidan (<strong className="font-mono">{formatMoney(sumClientTarget)} so'm</strong>){' '}
                    <span className="underline font-bold">
                      {overallTargetAmount === sumClientTarget ? 'teng (=)' : overallTargetAmount < sumClientTarget ? 'pastroq (<)' : 'yuqori (!)'}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-neutral-700">
                    Mijozlar 10 kunliklar yig'indisi: 1-dek: <b>{formatMoney(sumClientD1)}</b> | 2-dek: <b>{formatMoney(sumClientD2)}</b> | 3-dek: <b>{formatMoney(sumClientD3)}</b>
                  </div>
                </div>
              );
            })()}

            {progress.clientPlanResults.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-neutral-600">
                <span>
                  Hozircha ushbu 1 oylik rejada mijozlar kesimida alohida undiruv summalari belgilanmagan. «Mavjud rejani tahrirlash» tugmasi orqali mijozlarni bittada tanlab kiritishingiz mumkin.
                </span>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
                <div className="max-h-96 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="bg-neutral-100 text-neutral-700 text-[11px] font-bold uppercase sticky top-0 z-10 border-b border-neutral-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10">#</th>
                        <th className="py-2.5 px-3">Tanlangan mijoz</th>
                        <th className="py-2.5 px-3 text-right">Hozirgi qarzi</th>
                        <th className="py-2.5 px-3 text-right bg-rose-50/80">
                          1) Umumiy reja va Foiz (%)
                        </th>
                        <th className="py-2.5 px-3 text-right bg-indigo-50/70">
                          2) 1-chi 10 kunlik va Foiz (%)
                        </th>
                        <th className="py-2.5 px-3 text-right bg-indigo-50/70">
                          3) 2-chi 10 kunlik va Foiz (%)
                        </th>
                        <th className="py-2.5 px-3 text-right bg-indigo-50/70">
                          4) 3-chi 10 kunlik va Foiz (%)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-xs">
                      {progress.clientPlanResults.map((cp, idx) => (
                        <tr key={cp.clientId} className="hover:bg-neutral-50/80 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-neutral-900">{cp.clientName}</div>
                            <div className="text-[10px] text-neutral-500 font-mono">
                              {cp.clientCode ? `${cp.clientCode} • ` : ''}
                              {cp.clientPhone || ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-800">
                            {formatMoney(cp.currentDebt)}
                          </td>
                          {/* 1) Umumiy reja foizi */}
                          <td className="py-2.5 px-3 text-right bg-rose-50/30 font-mono">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-bold text-neutral-900">
                                Reja: {formatMoney(cp.targetAmount)}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-extrabold text-[11px] ${
                                  cp.percentage >= 100
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-rose-800 text-white'
                                }`}
                              >
                                {cp.percentage}%
                              </span>
                            </div>
                            <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                              Tushgan: {formatMoney(cp.collectedAmount)}
                            </div>
                            <div className="w-full h-1.5 bg-rose-100 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${
                                  cp.percentage >= 100 ? 'bg-emerald-600' : 'bg-rose-700'
                                }`}
                                style={{ width: `${Math.min(100, cp.percentage)}%` }}
                              />
                            </div>
                          </td>
                          {/* 2) 1-chi 10 kunlik foizi */}
                          <td className="py-2.5 px-3 text-right bg-indigo-50/20 font-mono">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-bold text-indigo-950">
                                Reja: {formatMoney(cp.decade1.target)}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-extrabold text-[11px] ${
                                  cp.decade1.percentage >= 100
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-700 text-white'
                                }`}
                              >
                                {cp.decade1.percentage}%
                              </span>
                            </div>
                            <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                              Tushgan: {formatMoney(cp.decade1.collected)}
                            </div>
                            <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${
                                  cp.decade1.percentage >= 100 ? 'bg-emerald-600' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${Math.min(100, cp.decade1.percentage)}%` }}
                              />
                            </div>
                          </td>
                          {/* 3) 2-chi 10 kunlik foizi */}
                          <td className="py-2.5 px-3 text-right bg-indigo-50/20 font-mono">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-bold text-indigo-950">
                                Reja: {formatMoney(cp.decade2.target)}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-extrabold text-[11px] ${
                                  cp.decade2.percentage >= 100
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-700 text-white'
                                }`}
                              >
                                {cp.decade2.percentage}%
                              </span>
                            </div>
                            <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                              Tushgan: {formatMoney(cp.decade2.collected)}
                            </div>
                            <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${
                                  cp.decade2.percentage >= 100 ? 'bg-emerald-600' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${Math.min(100, cp.decade2.percentage)}%` }}
                              />
                            </div>
                          </td>
                          {/* 4) 3-chi 10 kunlik foizi */}
                          <td className="py-2.5 px-3 text-right bg-indigo-50/20 font-mono">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-bold text-indigo-950">
                                Reja: {formatMoney(cp.decade3.target)}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-extrabold text-[11px] ${
                                  cp.decade3.percentage >= 100
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-700 text-white'
                                }`}
                              >
                                {cp.decade3.percentage}%
                              </span>
                            </div>
                            <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                              Tushgan: {formatMoney(cp.decade3.collected)}
                            </div>
                            <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${
                                  cp.decade3.percentage >= 100 ? 'bg-emerald-600' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${Math.min(100, cp.decade3.percentage)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {plan.notes && (
            <div className="text-xs text-neutral-600 italic px-1">
              Reja eslatmasi: "{plan.notes}"
            </div>
          )}

          {/* 4. TAHRIRLAR XRONOLOGIYASI (Kim tahrir qilgani, qachon va izohi) */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/90 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-rose-700" />
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 uppercase tracking-wide">
                  Reja tahrirlari xronologiyasi ({editLogs.length} ta)
                </h3>
              </div>
              <span className="text-[11px] text-neutral-500">
                Kim tahrir qilgani, sanasi va majburiy izohi
              </span>
            </div>

            {editLogs.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-1">
                Ushbu reja yaratilganidan beri hali tahrirlanmagan (Dastlabki yaratuvchi: @
                {plan.createdBy}, {formatDate(plan.createdAt)}).
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {editLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-3 rounded-xl bg-white border border-neutral-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-bold text-[11px]">
                          <User className="w-3 h-3" />@{log.editedBy}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-500">
                          <Clock className="w-3 h-3 text-neutral-400" />
                          {formatDate(log.editedAt)}
                        </span>
                      </div>
                      <p className="text-neutral-900 font-semibold">
                        Tahrir izohi: <span className="text-rose-900">"{log.reason}"</span>
                      </p>
                      {log.changesSummary && (
                        <p className="text-[11px] font-mono text-neutral-500">
                          O'zgarishlar: {log.changesSummary}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


