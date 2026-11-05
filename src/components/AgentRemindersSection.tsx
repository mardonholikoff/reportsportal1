import React, { useMemo, useState } from 'react';
import { Client, ClientReminder, DailyPlanItem } from '../types';
import { StickyTableWrapper } from './StickyTableWrapper';
import { formatDate, formatMoney, getAgentDisplayName } from '../utils/format';
import { formatPhoneList } from '../utils/exportPlansDetailedExcel';
import {
  BellRing,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  Search,
  Trash2,
  Play,
  RotateCcw,
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
  onExecuteClientFromReminder,
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
        const phoneMatch = (client?.phone || r.clientPhone || '').toLowerCase().includes(q);
        const noteMatch = (r.note || '').toLowerCase().includes(q);
        const addrMatch = (client?.address || r.clientAddress || '').toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !noteMatch && !addrMatch) return false;
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
              Kalendardan istalgan sanani tanlab shu kundagi eslatmalarni ko&apos;ring yoki pastdagi jadvaldan to&apos;g&apos;ridan-to&apos;g&apos;ri amal bajaring
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

      {/* Section 2: Reminders Filter Bar & Table Below Calendar */}
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
            placeholder="Mijoz, telefon yoki eslatma izohi..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-amber-500 outline-none"
          />
        </div>
      </div>

      {/* Reminders Table */}
      {filteredReminders.length === 0 ? (
        <div className="p-8 text-center">
          <BellRing className="w-10 h-10 text-amber-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-neutral-700">
            {selectedDate
              ? `${formatYMDToUz(selectedDate)} sanasi uchun eslatmalar topilmadi.`
              : "Hozircha eslatmalar mavjud emas."}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Yopilmagan mijoz ustida &quot;Amal bajarish&quot; oynasiga kirib, &quot;Eslatma qo&apos;yish&quot; bo&apos;limidan sana va izoh belgilashingiz mumkin.
          </p>
        </div>
      ) : (
        <StickyTableWrapper maxHeightClassName="max-h-[520px]">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-neutral-900 text-white text-[11px] uppercase tracking-wider font-bold">
                <th className="py-3 px-3 text-center w-12">№</th>
                <th className="py-3 px-3 w-36">Eslatma sanasi</th>
                <th className="py-3 px-3">Mijoz F.I.Sh va Telefon</th>
                <th className="py-3 px-3">Manzil</th>
                <th className="py-3 px-3 text-right">Joriy Qarz / Haqdorlik</th>
                <th className="py-3 px-3 w-72">Eslatma izohi</th>
                <th className="py-3 px-3">Qo&apos;ygan agent</th>
                <th className="py-3 px-3 text-center">Holati</th>
                <th className="py-3 px-3 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-xs">
              {filteredReminders.map((rem, idx) => {
                const client = clientsMap.get(rem.clientId);
                const phones =
                  client?.phones && client.phones.length > 0
                    ? client.phones
                    : [client?.phone || rem.clientPhone];
                const isDone = rem.status === 'bajarildi';
                const isToday = rem.reminderDate === todayYMD;
                const isOverdue = !isDone && rem.reminderDate < todayYMD;

                return (
                  <tr
                    key={rem.id}
                    className={`transition-colors ${
                      isDone
                        ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                        : isOverdue
                        ? 'bg-rose-50/40 hover:bg-rose-50/70'
                        : isToday
                        ? 'bg-amber-50/60 hover:bg-amber-50/90'
                        : 'bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <td className="py-3 px-3 text-center font-mono font-bold text-neutral-500">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-extrabold text-xs bg-amber-100 text-amber-900 border border-amber-300">
                        <CalendarIcon className="w-3.5 h-3.5 text-amber-700" />
                        <span>{formatYMDToUz(rem.reminderDate)}</span>
                      </div>
                      {isToday && !isDone && (
                        <div className="mt-1 text-[10px] font-extrabold text-amber-700">
                          ● Bugungi eslatma
                        </div>
                      )}
                      {isOverdue && (
                        <div className="mt-1 text-[10px] font-extrabold text-rose-600">
                          ▲ Muddati o&apos;tgan
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => client && onViewClientHistory && onViewClientHistory(client)}
                        className="font-extrabold text-neutral-900 hover:text-amber-700 text-left cursor-pointer"
                      >
                        {client?.name || rem.clientName}
                      </button>
                      <div className="flex items-center gap-1 text-neutral-500 font-mono text-[11px] mt-0.5">
                        <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span>{formatPhoneList(phones)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-neutral-600">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {client?.address || rem.clientAddress || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {client && client.currentDebt > 0 ? (
                        <span className="font-extrabold text-rose-600">
                          Qarz: {formatMoney(client.currentDebt)}
                        </span>
                      ) : client && client.currentAdvance > 0 ? (
                        <span className="font-extrabold text-emerald-600">
                          Haqdor: {formatMoney(client.currentAdvance)}
                        </span>
                      ) : (
                        <span className="text-neutral-400">0 USD</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="p-2 rounded-xl bg-amber-50/90 border border-amber-200 text-neutral-900 font-semibold leading-snug whitespace-pre-wrap">
                        {rem.note}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-neutral-800">
                        {getAgentDisplayName(rem.agentUsername)}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        {formatDate(rem.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Bajarildi</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-extrabold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Kutilmoqda</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {onExecuteClientFromReminder && (
                          <button
                            type="button"
                            onClick={() => onExecuteClientFromReminder(rem)}
                            className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            title="Shu mijoz bilan amal bajarish oynasini ochish"
                          >
                            <Play className="w-3 h-3" />
                            <span>Amal bajarish</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onToggleReminderStatus(rem.id, rem.clientId)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                            isDone
                              ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          title={
                            isDone
                              ? "Qayta kutilmoqda holatiga o'tkazish"
                              : "Eslatmani bajarildi deb belgilash"
                          }
                        >
                          {isDone ? (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              <span>Qaytarish</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Bajarildi</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteReminder(rem.id, rem.clientId)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title="Eslatmani o'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
