import React, { useMemo, useState } from 'react';
import { Client, ClientReminder, DailyPlanItem } from '../types';
import { StickyTableWrapper } from './StickyTableWrapper';
import { formatDate, getAgentDisplayName } from '../utils/format';
import {
  BellRing,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
  Trash2,
  AlertCircle,
  Filter,
} from 'lucide-react';

interface AgentRemindersSectionProps {
  reminders: ClientReminder[];
  clients: Client[];
  allPlans: DailyPlanItem[];
  currentAgent: string;
  onToggleReminderStatus: (reminderId: string, clientId: string) => void;
  onDeleteReminder: (reminderId: string, clientId: string) => void;
  onExecuteClientFromReminder?: (reminder: ClientReminder) => void;
  onViewClientHistory?: (client: Client) => void;
}

const UZ_MONTH_NAMES = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

const UZ_WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

function getLocalTodayYMD(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatYMDToUz(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '—';
  const [y, m, d] = ymd.split('-');
  return `${d}.${m}.${y}`;
}

export const AgentRemindersSection: React.FC<AgentRemindersSectionProps> = ({
  reminders,
  clients,
  currentAgent: _currentAgent,
  onToggleReminderStatus,
  onDeleteReminder,
  onViewClientHistory,
}) => {
  const todayYMD = useMemo(() => getLocalTodayYMD(), []);
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'kutilmoqda' | 'bajarildi'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const clientsMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  // Group reminders by YYYY-MM-DD for calendar badges
  const remindersByDate = useMemo(() => {
    const map = new Map<string, ClientReminder[]>();
    reminders.forEach((r) => {
      if (!r.reminderDate) return;
      const list = map.get(r.reminderDate) || [];
      list.push(r);
      map.set(r.reminderDate, list);
    });
    return map;
  }, [reminders]);

  const calendarCells = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Monday = 0 ... Sunday = 6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const cells: Array<{
      dateStr: string | null;
      dayNumber: number | null;
      isToday: boolean;
      reminders: ClientReminder[];
    }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateStr: null, dayNumber: null, isToday: false, reminders: [] });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(
        2,
        '0'
      )}`;
      const dayReminders = remindersByDate.get(dateStr) || [];
      cells.push({
        dateStr,
        dayNumber: day,
        isToday: dateStr === todayYMD,
        reminders: dayReminders,
      });
    }

    return cells;
  }, [currentMonthDate, remindersByDate, todayYMD]);

  const filteredReminders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reminders.filter((r) => {
      if (selectedDate && r.reminderDate !== selectedDate) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q) {
        const client = clientsMap.get(r.clientId);
        const nameMatch = (client?.name || r.clientName || '').toLowerCase().includes(q);
        const noteMatch = (r.note || '').toLowerCase().includes(q);
        const agentMatch = (r.agentUsername || '').toLowerCase().includes(q);
        const completedByMatch = (r.completedBy || '').toLowerCase().includes(q);
        if (!nameMatch && !noteMatch && !agentMatch && !completedByMatch) return false;
      }
      return true;
    });
  }, [reminders, selectedDate, statusFilter, searchQuery, clientsMap]);

  const totalPendingCount = useMemo(
    () => reminders.filter((r) => r.status === 'kutilmoqda').length,
    [reminders]
  );
  const todayPendingCount = useMemo(
    () =>
      reminders.filter((r) => r.reminderDate === todayYMD && r.status === 'kutilmoqda').length,
    [reminders, todayYMD]
  );
  const overduePendingCount = useMemo(
    () =>
      reminders.filter((r) => r.reminderDate < todayYMD && r.status === 'kutilmoqda').length,
    [reminders, todayYMD]
  );

  const handlePrevMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToday = () => {
    const now = new Date();
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate((prev) => (prev === todayYMD ? null : todayYMD));
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden mb-5">
      {/* Top Banner Header */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Mijozlar Bo&apos;yicha Eslatmalar Kalendari va Jadvali
              </h2>
              <span className="px-2.5 py-0.5 rounded-md bg-white/20 text-white text-xs font-extrabold">
                Jami: {reminders.length} ta
              </span>
            </div>
            <p className="text-xs text-amber-100 mt-0.5">
              Eslatmalarni kalendar bo&apos;yicha ko&apos;rish va bajarilganligini tick (✓) orqali belgilash
            </p>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedDate(todayYMD);
              const now = new Date();
              setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedDate === todayYMD
                ? 'bg-white text-amber-700 shadow-sm'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/25'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Bugungi eslatmalar: {todayPendingCount} ta</span>
          </button>

          {overduePendingCount > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Muddati o&apos;tgan: {overduePendingCount} ta</span>
            </span>
          )}

          <span className="px-3 py-1.5 rounded-xl bg-black/20 text-white text-xs font-bold">
            Kutilmoqda: {totalPendingCount} ta
          </span>
        </div>
      </div>

      {/* Section 1: Interactive Calendar */}
      <div className="p-4 sm:p-5 bg-amber-50/40 border-b border-amber-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-extrabold text-neutral-900">
              Eslatmalar Kalendari — {UZ_MONTH_NAMES[currentMonthDate.getMonth()]}{' '}
              {currentMonthDate.getFullYear()}
            </h3>
            {selectedDate && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold">
                <span>Tanlangan sana: {formatYMDToUz(selectedDate)}</span>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="underline ml-1 hover:text-amber-100 cursor-pointer"
                >
                  Barchasini ko&apos;rsatish
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 cursor-pointer shadow-2xs"
              title="Oldingi oy"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleJumpToday}
              className="px-3 py-1.5 rounded-xl bg-white border border-neutral-200 hover:bg-amber-50 text-xs font-bold text-neutral-800 cursor-pointer shadow-2xs"
            >
              Bugun ({formatYMDToUz(todayYMD)})
            </button>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-white cursor-pointer shadow-2xs"
              >
                Barcha sanalar
              </button>
            )}
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 cursor-pointer shadow-2xs"
              title="Keyingi oy"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 7-Column Calendar Grid */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
          <div className="grid grid-cols-7 bg-neutral-900 text-white text-center text-[11px] font-bold uppercase tracking-wider">
            {UZ_WEEKDAYS.map((wd) => (
              <div key={wd} className="py-2 border-r border-neutral-800 last:border-r-0">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-neutral-200">
            {calendarCells.map((cell, idx) => {
              if (!cell.dateStr || cell.dayNumber === null) {
                return <div key={`empty_${idx}`} className="min-h-[68px] sm:min-h-[82px] bg-neutral-50/60" />;
              }

              const isSelected = selectedDate === cell.dateStr;
              const pendingForDay = cell.reminders.filter((r) => r.status === 'kutilmoqda');
              const doneForDay = cell.reminders.filter((r) => r.status === 'bajarildi');
              const hasAny = cell.reminders.length > 0;
              const isPastPending = cell.dateStr < todayYMD && pendingForDay.length > 0;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() =>
                    setSelectedDate((prev) => (prev === cell.dateStr ? null : cell.dateStr))
                  }
                  className={`min-h-[68px] sm:min-h-[82px] p-1.5 sm:p-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-100/90 ring-2 ring-inset ring-amber-600'
                      : cell.isToday
                      ? 'bg-amber-50/70 hover:bg-amber-100/60'
                      : hasAny
                      ? 'bg-white hover:bg-amber-50/50'
                      : 'bg-white hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-extrabold ${
                        isSelected
                          ? 'bg-amber-600 text-white'
                          : cell.isToday
                          ? 'bg-neutral-900 text-white'
                          : hasAny
                          ? 'text-neutral-900 font-extrabold'
                          : 'text-neutral-500'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {hasAny && (
                      <div className="flex items-center gap-1">
                        {pendingForDay.length > 0 && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold text-white ${
                              isPastPending ? 'bg-rose-600' : 'bg-amber-600'
                            }`}
                            title="Kutilayotgan eslatmalar soni"
                          >
                            {pendingForDay.length}
                          </span>
                        )}
                        {doneForDay.length > 0 && (
                          <span
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-600 text-white"
                            title="Bajarilgan eslatmalar soni"
                          >
                            ✓{doneForDay.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Preview of up to 2 client reminders on that date */}
                  {hasAny && (
                    <div className="mt-1 space-y-0.5 w-full overflow-hidden">
                      {cell.reminders.slice(0, 2).map((rem) => (
                        <div
                          key={rem.id}
                          title={
                            rem.status === 'bajarildi'
                              ? `${rem.clientName}: ${rem.note} (Bajarildi: ${getAgentDisplayName(rem.completedBy || rem.agentUsername)})`
                              : `${rem.clientName}: ${rem.note}`
                          }
                          className={`truncate text-[10px] font-semibold px-1 py-0.5 rounded ${
                            rem.status === 'bajarildi'
                              ? 'bg-emerald-50 text-emerald-800 line-through'
                              : isPastPending
                              ? 'bg-rose-50 text-rose-800'
                              : 'bg-amber-100/80 text-amber-950'
                          }`}
                        >
                          {rem.clientName}
                        </div>
                      ))}
                      {cell.reminders.length > 2 && (
                        <div className="text-[9.5px] font-bold text-neutral-500 pl-1">
                          +{cell.reminders.length - 2} ta eslatma
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 2: Reminders Filter Bar & Simplified Table Below Calendar */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 bg-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-neutral-700 mr-1">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <span>Eslatmalar jadvali:</span>
          </div>
          {(
            [
              { id: 'all', label: `Barchasi (${reminders.length})` },
              {
                id: 'kutilmoqda',
                label: `Kutilmoqda (${reminders.filter((r) => r.status === 'kutilmoqda').length})`,
              },
              {
                id: 'bajarildi',
                label: `Bajarilgan (${reminders.filter((r) => r.status === 'bajarildi').length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Mijoz ismi, eslatma matni yoki agent..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-amber-500 outline-none"
          />
        </div>
      </div>

      {/* Reminders Table: Eslatma sanasi | Mijoz ismi | Eslatma izohi (oddiy tekst) | Qo'shgan agent | Tick (Bajarildi + kim qilgani) | O'chirish */}
      {filteredReminders.length === 0 ? (
        <div className="p-8 text-center">
          <BellRing className="w-10 h-10 text-amber-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-neutral-700">
            {selectedDate
              ? `${formatYMDToUz(selectedDate)} sanasi uchun eslatmalar topilmadi.`
              : 'Hozircha eslatmalar mavjud emas.'}
          </p>
        </div>
      ) : (
        <StickyTableWrapper maxHeightClassName="max-h-[520px]">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="bg-neutral-900 text-white text-[11px] uppercase tracking-wider font-bold">
                <th className="py-3 px-3.5 w-36">Eslatma sanasi</th>
                <th className="py-3 px-3.5 w-48">Mijoz ismi</th>
                <th className="py-3 px-3.5">Eslatma izohi</th>
                <th className="py-3 px-3.5 w-40">Qo&apos;shgan agent</th>
                <th className="py-3 px-3.5 text-center w-52">Bajarildi (Tick)</th>
                <th className="py-3 px-3.5 text-center w-20">O&apos;chirish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-xs">
              {filteredReminders.map((rem) => {
                const client = clientsMap.get(rem.clientId);
                const isDone = rem.status === 'bajarildi';
                const isToday = rem.reminderDate === todayYMD;
                const isOverdue = !isDone && rem.reminderDate < todayYMD;

                return (
                  <tr
                    key={rem.id}
                    className={`transition-colors ${
                      isDone
                        ? 'bg-emerald-50/30 hover:bg-emerald-50/50'
                        : isOverdue
                        ? 'bg-rose-50/30 hover:bg-rose-50/50'
                        : isToday
                        ? 'bg-amber-50/40 hover:bg-amber-50/70'
                        : 'bg-white hover:bg-neutral-50'
                    }`}
                  >
                    {/* 1. Eslatma sanasi */}
                    <td className="py-3 px-3.5 font-mono font-bold text-neutral-900 whitespace-nowrap">
                      <span>{formatYMDToUz(rem.reminderDate)}</span>
                    </td>

                    {/* 2. Mijoz ismi */}
                    <td className="py-3 px-3.5">
                      {client && onViewClientHistory ? (
                        <button
                          type="button"
                          onClick={() => onViewClientHistory(client)}
                          className="font-bold text-neutral-900 hover:text-amber-700 text-left cursor-pointer"
                        >
                          {client.name || rem.clientName}
                        </button>
                      ) : (
                        <span className="font-bold text-neutral-900">
                          {client?.name || rem.clientName}
                        </span>
                      )}
                    </td>

                    {/* 3. Eslatma izohi (shunchaki oddiy tekst ko'rinishida) */}
                    <td className="py-3 px-3.5">
                      <span
                        className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                          isDone ? 'text-neutral-500 line-through' : 'text-neutral-900'
                        }`}
                      >
                        {rem.note}
                      </span>
                    </td>

                    {/* 4. Qo'shgan agent */}
                    <td className="py-3 px-3.5 font-semibold text-neutral-800 whitespace-nowrap">
                      {getAgentDisplayName(rem.agentUsername)}
                    </td>

                    {/* 5. Yangi Tick (Bajarildi deb belgilash va kim tick qilgani ko'rinishi) */}
                    <td className="py-3 px-3.5 text-center">
                      <div className="inline-flex flex-col items-center justify-center gap-1">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => onToggleReminderStatus(rem.id, rem.clientId)}
                            className="sr-only"
                          />
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              isDone
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                                : 'bg-white border-neutral-300 hover:border-emerald-500 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              isDone ? 'text-emerald-700' : 'text-neutral-600'
                            }`}
                          >
                            {isDone ? 'Bajarildi' : 'Bajarildi deb belgilash'}
                          </span>
                        </label>

                        {isDone && (
                          <div className="text-[10.5px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 whitespace-nowrap">
                            Tick qildi: {getAgentDisplayName(rem.completedBy || rem.agentUsername)}
                            {rem.completedAt ? ` (${formatDate(rem.completedAt)})` : ''}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 6. O'chirish */}
                    <td className="py-3 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => onDeleteReminder(rem.id, rem.clientId)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer inline-flex items-center justify-center"
                        title="Eslatmani o'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </StickyTableWrapper>
      )}
    </div>
  );
};
