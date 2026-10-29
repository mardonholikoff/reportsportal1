import React from 'react';
import { SummaryStats } from '../types';
import { formatMoney } from '../utils/format';
import { Users, TrendingDown, TrendingUp } from 'lucide-react';

interface Props {
  stats: SummaryStats;
  userRole?: 'admin' | 'agent';
}

export const StatsCards: React.FC<Props> = ({ stats, userRole = 'admin' }) => {
  const isAgent = userRole === 'agent';

  if (isAgent) {
    return (
      <div className="grid grid-cols-1 mb-6">
        {/* Faqat Jami mijozlar soni ko'rinadi (qarz va haqdorlik balansi agentda ko'rinmaydi) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-rose-100/80 shadow-xs transition hover:border-rose-200 max-w-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-neutral-600 truncate">
              Umumiy mijozlar soni
            </span>
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-display text-neutral-900 tracking-tight tabular-nums">
            {stats.totalClients}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500 truncate">
            Faol mijozlar ro'yxati
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
      {/* 1. Jami Mijozlar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-rose-100/80 shadow-xs transition hover:border-rose-200">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-neutral-600 truncate">
            Jami mijozlar
          </span>
          <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 shrink-0">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold font-display text-neutral-900 tracking-tight tabular-nums">
          {stats.totalClients}
        </div>
        <div className="mt-1 text-[11px] text-neutral-500 truncate">
          Faol xaridorlar ro'yxati
        </div>
      </div>

      {/* 2. Joriy Qarzdorlik (Och qizil rangli urg'u bilan) */}
      <div className="bg-rose-50/70 rounded-2xl p-4 sm:p-5 border border-rose-200/90 shadow-xs transition hover:border-rose-300">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-rose-900 truncate">
            Joriy qarzdorlik
          </span>
          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-800 shrink-0">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 tracking-tight tabular-nums truncate">
          {formatMoney(stats.totalDebt)}
        </div>
        <div className="mt-1 text-[11px] font-medium text-rose-700 truncate">
          {stats.debtorsCount} ta mijoz qarzda
        </div>
      </div>

      {/* 3. Joriy Haqdorlik (Oldindan to'lov) */}
      <div className="bg-emerald-50/70 rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-xs transition hover:border-emerald-300">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-emerald-900 truncate">
            Joriy haqdorlik
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 tracking-tight tabular-nums truncate">
          {formatMoney(stats.totalAdvance)}
        </div>
        <div className="mt-1 text-[11px] font-medium text-emerald-700 truncate">
          {stats.creditorsCount} ta mijoz avans bergan
        </div>
      </div>
    </div>
  );
};
