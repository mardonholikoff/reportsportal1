import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Calendar,
  Globe,
  Activity,
  CheckCircle2,
  Clock,
  RotateCcw,
  Copy,
  Check,
  FileSpreadsheet,
  Archive,
  AlertTriangle,
  History,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  SystemLog,
  SystemLogPeriodArchive,
  SystemLogMonthlyArchiveRecord,
} from '../types';
import { exportSystemLogsToExcel } from '../utils/exportSystemLogsExcel';
import { getPeriodArchives } from '../services/firebase';

interface Props {
  logs: SystemLog[];
  currentUsername: string;
  onPurgeLogs?: (
    logIds: string[],
    archiveRecord: SystemLogPeriodArchive | SystemLogMonthlyArchiveRecord
  ) => Promise<void> | void;
}

const UZBEK_MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentyabr',
  'Oktyabr',
  'Noyabr',
  'Dekabr',
];

interface PeriodGroup {
  periodKey: string; // e.g. "2026-01-P1", "2026-01-P2"
  periodLabel: string; // e.g. "2026-yil 1-15 Yanvar (15 kunlik)"
  year: number;
  monthIndex: number;
  periodNum: 1 | 2;
  startDate: string;
  endDate: string;
  logs: SystemLog[];
  count: number;
  isCompleted: boolean; // Over 15 days or past 15-day window
}

export const AdminSystemLogsTable: React.FC<Props> = ({
  logs,
  currentUsername,
  onPurgeLogs,
}) => {
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedIp, setSelectedIp] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // Ready Excel 15-day period archives list
  const [readyArchives, setReadyArchives] = useState<SystemLogPeriodArchive[]>(() =>
    getPeriodArchives()
  );

  // Manual transition modal state
  const [manualTargetPeriod, setManualTargetPeriod] = useState<PeriodGroup | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Guard to prevent multiple simultaneous auto-purge runs
  const autoPurgeExecutedRef = useRef<boolean>(false);

  // Distinct list of users and IP addresses
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.userId) set.add(l.userId);
    });
    return Array.from(set).sort();
  }, [logs]);

  const uniqueIps = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.ipAddress) set.add(l.ipAddress);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Group active logs into 15-day periods:
  // Period 1: Days 1-15 of the month
  // Period 2: Days 16-end of the month
  const periodGroups: PeriodGroup[] = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    const currentDay = now.getDate();
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;

    const map = new Map<string, SystemLog[]>();

    logs.forEach((log) => {
      let d = new Date();
      if (log.timestamp) {
        const parsed = new Date(log.timestamp);
        if (!isNaN(parsed.getTime())) {
          d = parsed;
        }
      }

      const y = d.getFullYear();
      const mIdx = d.getMonth();
      const day = d.getDate();
      const pNum: 1 | 2 = day <= 15 ? 1 : 2;
      const key = `${y}-${String(mIdx + 1).padStart(2, '0')}-P${pNum}`;

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(log);
    });

    const groups: PeriodGroup[] = [];

    map.forEach((pLogs, key) => {
      const parts = key.split('-');
      const y = parseInt(parts[0], 10) || currentYear;
      const mIdx = (parseInt(parts[1], 10) || 1) - 1;
      const pNum = parts[2] === 'P1' ? 1 : 2;
      const monthName = UZBEK_MONTHS[mIdx] || 'Oy';
      const lastDayOfMonth = new Date(y, mIdx + 1, 0).getDate();

      const label =
        pNum === 1
          ? `${y}-yil 1-15 ${monthName} (15 kunlik)`
          : `${y}-yil 16-${lastDayOfMonth} ${monthName} (15 kunlik)`;

      const sDate = `${y}-${String(mIdx + 1).padStart(2, '0')}-${pNum === 1 ? '01' : '16'}`;
      const eDate = `${y}-${String(mIdx + 1).padStart(2, '0')}-${
        pNum === 1 ? '15' : String(lastDayOfMonth).padStart(2, '0')
      }`;

      // Check if this 15-day period has elapsed:
      // 1. Year/Month is in the past, OR
      // 2. In current month: if period 1 and currentDay > 15, OR
      // 3. Any log in this group is >= 15 days old
      const isPastMonth =
        y < currentYear || (y === currentYear && mIdx < currentMonthIndex);
      const isPastPeriodInCurrentMonth =
        y === currentYear && mIdx === currentMonthIndex && pNum === 1 && currentDay > 15;
      const hasLogsOlderThan15Days = pLogs.some((l) => {
        const t = new Date(l.timestamp).getTime();
        return !isNaN(t) && t <= fifteenDaysAgo;
      });

      const isCompleted =
        isPastMonth || isPastPeriodInCurrentMonth || hasLogsOlderThan15Days;

      groups.push({
        periodKey: key,
        periodLabel: label,
        year: y,
        monthIndex: mIdx,
        periodNum: pNum,
        startDate: sDate,
        endDate: eDate,
        logs: pLogs,
        count: pLogs.length,
        isCompleted,
      });
    });

    // Sort descending: newest period first
    groups.sort((a, b) => b.periodKey.localeCompare(a.periodKey));
    return groups;
  }, [logs]);

  // =========================================================================
  // AUTOMATIC 15-DAY TRANSITION:
  // Har 15 kunda loglar avtomatik tarzda excelga o'tadi va bazadan o'chiriladi.
  // =========================================================================
  useEffect(() => {
    if (autoPurgeExecutedRef.current || !onPurgeLogs) return;

    const completed = periodGroups.filter((g) => g.isCompleted && g.count > 0);
    if (completed.length === 0) return;

    autoPurgeExecutedRef.current = true;

    // Process all completed 15-day periods
    const runAutoArchive = async () => {
      for (const group of completed) {
        const fileName = `Tizim_Audit_15kunlik_${group.periodKey}_Arxiv.xlsx`;
        const archive: SystemLogPeriodArchive = {
          id: `arch_15d_${group.periodKey}_${Date.now()}`,
          periodKey: group.periodKey,
          periodLabel: group.periodLabel,
          startDate: group.startDate,
          endDate: group.endDate,
          logsCount: group.count,
          archivedAt: new Date().toISOString(),
          exportedBy: 'adminc1 (Avtomatik 15 kunlik)',
          fileName,
          logs: [...group.logs],
        };

        const ids = group.logs.map((l) => l.id);
        await onPurgeLogs(ids, archive);
      }

      setReadyArchives(getPeriodArchives());
      setNoticeMessage(
        `⚡ Har 15 kunda loglar avtomatik tarzda Excelga o'tkazildi va bazadan tozalandi! Tayyor Excel (.xlsx borderli) arxivlar quyida saqlanmoqda.`
      );
      setTimeout(() => setNoticeMessage(null), 7000);
    };

    runAutoArchive();
  }, [periodGroups, onPurgeLogs]);

  // Synchronize ready archives whenever storage changes
  useEffect(() => {
    setReadyArchives(getPeriodArchives());
  }, [logs]);

  // Filtered active logs (< 15 days old)
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // User filter
      if (selectedUser !== 'all' && log.userId !== selectedUser) {
        return false;
      }

      // Action type filter
      if (selectedActionType !== 'all') {
        if (selectedActionType === 'auth' && !['kirish', 'chiqish'].includes(log.actionType)) {
          return false;
        }
        if (selectedActionType === 'reja' && log.actionType !== 'reja_tuzish') {
          return false;
        }
        if (selectedActionType === 'amal' && log.actionType !== 'amal_bajarish') {
          return false;
        }
        if (selectedActionType === 'tushum' && log.actionType !== 'tushum_qabul') {
          return false;
        }
        if (
          selectedActionType === 'mahsulot' &&
          !['mahsulot_topshirish', 'mahsulot_qaytishi'].includes(log.actionType)
        ) {
          return false;
        }
        if (selectedActionType === 'mijoz' && !log.actionType.startsWith('mijoz_')) {
          return false;
        }
        if (selectedActionType === 'ombor' && !log.actionType.startsWith('ombor_')) {
          return false;
        }
      }

      // IP filter
      if (selectedIp !== 'all' && log.ipAddress !== selectedIp) {
        return false;
      }

      // Date range filter
      if (startDate) {
        const logDate = log.timestamp.slice(0, 10);
        if (logDate < startDate) return false;
      }
      if (endDate) {
        const logDate = log.timestamp.slice(0, 10);
        if (logDate > endDate) return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUser = log.userId?.toLowerCase().includes(q);
        const matchTitle = log.actionTitle?.toLowerCase().includes(q);
        const matchDetails = log.details?.toLowerCase().includes(q);
        const matchIp = log.ipAddress?.toLowerCase().includes(q);
        if (!matchUser && !matchTitle && !matchDetails && !matchIp) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedUser, selectedActionType, selectedIp, startDate, endDate, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const agentCount = filteredLogs.filter((l) => l.userRole === 'agent').length;
    const adminCount = filteredLogs.filter((l) => l.userRole === 'admin').length;
    const ipsCount = new Set(filteredLogs.map((l) => l.ipAddress)).size;
    return { total, agentCount, adminCount, ipsCount };
  }, [filteredLogs]);

  // Copy IP helper
  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSelectedUser('all');
    setSelectedActionType('all');
    setSelectedIp('all');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  // Download ready 15-day Excel archive with full borders
  const handleDownloadArchiveExcel = async (archive: SystemLogPeriodArchive) => {
    await exportSystemLogsToExcel(
      archive.logs,
      `${archive.periodLabel} (15 kunlik arxiv - Faqat Excel faylda)`,
      archive.fileName
    );
  };

  // Manual transition of a period to Excel & purge from DB
  const handleExecuteManualTransition = async (group: PeriodGroup) => {
    setIsProcessing(true);
    try {
      const fileName = `Tizim_Audit_15kunlik_${group.periodKey}_Arxiv.xlsx`;
      const archive: SystemLogPeriodArchive = {
        id: `arch_15d_${group.periodKey}_${Date.now()}`,
        periodKey: group.periodKey,
        periodLabel: group.periodLabel,
        startDate: group.startDate,
        endDate: group.endDate,
        logsCount: group.count,
        archivedAt: new Date().toISOString(),
        exportedBy: currentUsername || 'adminc1',
        fileName,
        logs: [...group.logs],
      };

      // 1. Download bordered Excel immediately
      await exportSystemLogsToExcel(
        group.logs,
        `${group.periodLabel} (15 kunlik arxiv - Faqat Excel faylda)`,
        fileName
      );

      // 2. Purge from Firestore DB and interface
      const ids = group.logs.map((l) => l.id);
      if (onPurgeLogs) {
        await onPurgeLogs(ids, archive);
      }

      setManualTargetPeriod(null);
      setReadyArchives(getPeriodArchives());
      setNoticeMessage(
        `«${group.periodLabel}» bo'yicha ${group.count} ta audit logi Excel (.xlsx) ga o'tkazildi va bazadan tozalandi! Faqat Excel faylda saqlandi.`
      );
      setTimeout(() => setNoticeMessage(null), 6000);
    } catch (err) {
      console.error('Manual archive transition error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Regular export of currently filtered active logs
  const handleExportFiltered = async () => {
    const filterDesc =
      [
        selectedUser !== 'all' ? `Foydalanuvchi: ${selectedUser}` : null,
        selectedActionType !== 'all' ? `Amal: ${selectedActionType}` : null,
        selectedIp !== 'all' ? `IP: ${selectedIp}` : null,
        startDate || endDate ? `Muddat: ${startDate || 'boshi'} dan ${endDate || 'hozirgacha'}` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'Faol tizim loglari';

    await exportSystemLogsToExcel(
      filteredLogs,
      filterDesc,
      `Tizim_Audit_Faol_Loglar_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Action Badge Color
  const getActionBadge = (type: string) => {
    switch (type) {
      case 'kirish':
      case 'chiqish':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'reja_tuzish':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'reja_yopish':
        return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
      case 'amal_bajarish':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'tushum_qabul':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'mahsulot_topshirish':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'mahsulot_qaytishi':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'ombor_kirimi':
      case 'ombor_ochirish':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* ============================================================== */}
      {/* 1. TOP HEADER & METRIC BANNER */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-sm border border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 shadow-xs">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold font-display tracking-tight">
                  Tizim Foydalanuvchilari Audit Loglari
                </h3>
                {currentUsername === 'adminc1' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500/25 text-rose-200 border border-rose-400/30">
                    adminc1 nazorati
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Har 15 kunda avtomatik Excel (.xlsx borderli)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Loglar har 15 kunda avtomatik Excelga o'tadi, bazadan o'chiriladi va yuklash uchun tayyor turadi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportFiltered}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 disabled:opacity-50 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition border border-white/10 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Faol loglarni Excelga yuklash</span>
            </button>
          </div>
        </div>

        {/* 4 Metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[11px] text-slate-400 font-medium">Faol loglar (&lt; 15 kun)</div>
            <div className="text-base sm:text-xl font-bold font-mono text-white mt-0.5">
              {stats.total} <span className="text-xs font-normal text-slate-400">ta</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[11px] text-slate-400 font-medium">Tayyor 15 kunlik arxivlar</div>
            <div className="text-base sm:text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {readyArchives.length} <span className="text-xs font-normal text-slate-400">ta davr</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[11px] text-slate-400 font-medium">Agentlar amallari</div>
            <div className="text-base sm:text-xl font-bold font-mono text-indigo-400 mt-0.5">
              {stats.agentCount} <span className="text-xs font-normal text-slate-400">ta</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[11px] text-slate-400 font-medium">Noyob IP manzillar</div>
            <div className="text-base sm:text-xl font-bold font-mono text-amber-400 mt-0.5">
              {stats.ipsCount} <span className="text-xs font-normal text-slate-400">ta IP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-transition Alert / Toast */}
      {noticeMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex items-center gap-3 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs font-bold leading-relaxed">{noticeMessage}</p>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. READY EXCEL ARCHIVES SECTION: HAR 15 KUNDA AVTOMATIK        */}
      {/* ============================================================== */}
      <div className="bg-white rounded-3xl border border-emerald-200/90 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-neutral-900 font-display">
                  15 Kunlik Yuklashga Tayyor Excel (.xlsx) Arxivlar
                </h4>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                  Faqat Excelda
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Loglar har 15 kunda avtomatik tarzda Excelga o'tadi va bazadan o'chiriladi. Ular to'liq borderli holatda yuklashga tayyor turadi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              {readyArchives.length} ta tayyor arxiv
            </span>
          </div>
        </div>

        {/* Ready 15-day Archive Cards */}
        {readyArchives.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-emerald-200 rounded-2xl bg-emerald-50/30 space-y-2">
            <Clock className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="text-xs font-bold text-neutral-800">
              Hozircha 15 kunlik muddat to'liq yakunlangan yangi arxiv mavjud emas
            </p>
            <p className="text-[11px] text-neutral-500 max-w-md mx-auto">
              Kunlar 15 kunga yetishi bilan tizim avtomatik ravishda barcha loglarni borderli Excel (.xlsx) ga o'tkazadi va bazadan tozalaydi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {readyArchives.map((archive) => (
              <div
                key={archive.id}
                className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-bold text-neutral-900">
                        {archive.periodLabel}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Tayyor
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-neutral-600 mb-3.5">
                    <div className="flex justify-between items-center py-0.5 border-b border-emerald-100">
                      <span className="text-neutral-500 text-[11px]">Audit yozuvlari:</span>
                      <span className="font-bold font-mono text-emerald-800">
                        {archive.logsCount} ta yozuv
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-b border-emerald-100">
                      <span className="text-neutral-500 text-[11px]">Format & Holat:</span>
                      <span className="font-bold text-emerald-700 text-[11px]">
                        .xlsx (barcha kataklar borderli)
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-b border-emerald-100">
                      <span className="text-neutral-500 text-[11px]">Bazadagi holati:</span>
                      <span className="font-semibold text-rose-700 text-[11px]">
                        Bazadan o'chirilgan (tozalangan)
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-neutral-500 text-[11px]">O'tgan sana:</span>
                      <span className="font-mono text-neutral-700 text-[11px]">
                        {new Date(archive.archivedAt).toLocaleDateString('uz-UZ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Download Button */}
                <button
                  type="button"
                  onClick={() => handleDownloadArchiveExcel(archive)}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white py-2 px-3 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer min-h-[38px]"
                >
                  <Download className="w-4 h-4 text-emerald-200" />
                  <span>Excel (.xlsx) faylini yuklab olish</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Current Active Period Overview and Early Manual Archive Option */}
        {periodGroups.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-neutral-600" />
              <h5 className="text-xs font-bold text-neutral-800">
                Joriy faol 15 kunlik davr (Bazadagi yangi yozuvlar)
              </h5>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {periodGroups
                .filter((g) => !g.isCompleted)
                .map((activeGroup) => (
                  <div
                    key={activeGroup.periodKey}
                    className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-900">
                          {activeGroup.periodLabel}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200">
                          Hozir faol
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {activeGroup.count} ta yangi qayd to'plandi. 15 kun to'lgach, avtomatik ravishda Excelga o'tadi va bazadan tozalanadi.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setManualTargetPeriod(activeGroup)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold transition cursor-pointer shadow-xs"
                    >
                      <Archive className="w-3.5 h-3.5 text-amber-400" />
                      <span>Hozir Excelga o'tkazish & Tozalash</span>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 3. ACTIVE LOGS FILTER TOOLBAR                                  */}
      {/* ============================================================== */}
      <div className="bg-white rounded-3xl border border-neutral-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-500" />
            <span className="text-xs font-bold text-neutral-800">
              Faol loglarni filtrlash (&lt; 15 kun)
            </span>
          </div>

          {(selectedUser !== 'all' ||
            selectedActionType !== 'all' ||
            selectedIp !== 'all' ||
            startDate ||
            endDate ||
            searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-[11px] text-rose-700 hover:text-rose-800 font-bold transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Filtrni tozalash</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          {/* User selector */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">
              Foydalanuvchi:
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full py-2 px-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-neutral-800 font-medium focus:bg-white focus:border-rose-500 outline-none transition"
            >
              <option value="all">Barcha foydalanuvchilar</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u} {u.startsWith('admin') ? '(Admin)' : '(Agent)'}
                </option>
              ))}
            </select>
          </div>

          {/* Action Type selector */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">
              Amal turi:
            </label>
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="w-full py-2 px-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-neutral-800 font-medium focus:bg-white focus:border-rose-500 outline-none transition"
            >
              <option value="all">Barcha harakat turlari</option>
              <option value="auth">Tizimga kirish / Chiqish</option>
              <option value="reja">Reja tuzish va tasdiqlash</option>
              <option value="amal">Mijoz bilan bajarilgan amal</option>
              <option value="tushum">Mablag' tushumi (to'lovlar)</option>
              <option value="mahsulot">Mahsulot berish / qaytishi</option>
              <option value="mijoz">Mijozlar bazasi amallari</option>
              <option value="ombor">Ombor zaxirasi amallari</option>
            </select>
          </div>

          {/* IP Address selector */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">
              IP Manzil bo'yicha:
            </label>
            <select
              value={selectedIp}
              onChange={(e) => setSelectedIp(e.target.value)}
              className="w-full py-2 px-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-neutral-800 font-mono text-[11px] focus:bg-white focus:border-rose-500 outline-none transition"
            >
              <option value="all">Barcha IP manzillar</option>
              {uniqueIps.map((ip) => (
                <option key={ip} value={ip}>
                  {ip}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">
              Boshlanish sanasi:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-1.5 px-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-neutral-800 focus:bg-white focus:border-rose-500 outline-none transition"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">
              Tugash sanasi:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-1.5 px-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-neutral-800 focus:bg-white focus:border-rose-500 outline-none transition"
            />
          </div>
        </div>

        {/* Search input */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 mt-0.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Faol loglar ichidan qidirish (foydalanuvchi, IP manzil, amal sarlavhasi, mijoz, summa...)"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/40 text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-rose-500 outline-none transition"
          />
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. ACTIVE LOGS TABLE (< 15 DAYS)                               */}
      {/* ============================================================== */}
      <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-2xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Activity className="w-10 h-10 text-neutral-300 mx-auto" />
            <h4 className="text-sm font-bold text-neutral-800">
              Faol bazada loglar mavjud emas
            </h4>
            <p className="text-xs text-neutral-500">
              15 kundan oshgan barcha loglar Excelga o'tkazilib, bazadan avtomatik tozalangan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-neutral-700 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">№</th>
                  <th className="py-3 px-3 min-w-[140px]">Sana va Vaqt</th>
                  <th className="py-3 px-3 min-w-[120px]">Foydalanuvchi</th>
                  <th className="py-3 px-3 min-w-[160px]">IP Manzil</th>
                  <th className="py-3 px-3 min-w-[140px]">Amal turi</th>
                  <th className="py-3 px-3 min-w-[180px]">Sarlavha</th>
                  <th className="py-3 px-4 min-w-[300px]">Batafsil Tafsilotlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredLogs.map((log, index) => {
                  const formattedDate = new Date(log.timestamp).toLocaleString('uz-UZ', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-rose-50/30 transition-colors group"
                    >
                      {/* # */}
                      <td className="py-2.5 px-3 text-center font-mono text-neutral-400 text-[11px]">
                        {index + 1}
                      </td>

                      {/* Timestamp */}
                      <td className="py-2.5 px-3 font-mono text-neutral-700 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.userRole === 'admin' ? 'bg-indigo-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="font-bold text-neutral-900">{log.userId}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                              log.userRole === 'admin'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {log.userRole === 'admin' ? 'Admin' : 'Agent'}
                          </span>
                        </div>
                      </td>

                      {/* IP Address with Copy */}
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-800">
                          <Globe className="w-3 h-3 text-neutral-500 shrink-0" />
                          <span>{log.ipAddress || '192.168.1.104'}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyIp(log.ipAddress || '192.168.1.104')}
                            title="IP manzilini nusxalash"
                            className="text-neutral-400 hover:text-neutral-700 transition cursor-pointer ml-0.5"
                          >
                            {copiedIp === (log.ipAddress || '192.168.1.104') ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Action Type */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getActionBadge(
                            log.actionType
                          )}`}
                        >
                          {log.actionType}
                        </span>
                      </td>

                      {/* Action Title */}
                      <td className="py-2.5 px-3 font-semibold text-neutral-900">
                        {log.actionTitle}
                      </td>

                      {/* Details */}
                      <td className="py-2.5 px-4 text-neutral-700 whitespace-normal text-[11px] leading-relaxed max-w-md">
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 5. MANUAL TRANSITION MODAL (15-KUNLIK DAVR)                    */}
      {/* ============================================================== */}
      {manualTargetPeriod && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-emerald-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-neutral-900 font-display">
                  15 Kunlik Loglarni Excelga O'tkazish Va Tozalash
                </h4>
                <p className="text-xs text-neutral-500 font-medium">
                  {manualTargetPeriod.periodLabel} ({manualTargetPeriod.count} ta yozuv)
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200/80 text-emerald-900 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Excelga o'tadi va bazadan o'chiriladi:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-emerald-800 text-[11px]">
                  <li>
                    <strong>{manualTargetPeriod.periodLabel}</strong> bo'yicha jami{' '}
                    <strong>{manualTargetPeriod.count} ta</strong> audit qaydi to'liq borderli .xlsx Excel faylida yuklab olinadi.
                  </li>
                  <li>
                    Ushbu qaydlar Firestore bazasidan va faol jadvaldan <strong>to'liq o'chirib yuboriladi</strong>.
                  </li>
                  <li>
                    Ma'lumotlar <strong>faqat Excel faylda saqlanadi</strong> va istalgan vaqt yuklab olinadigan arxivga joylanadi.
                  </li>
                </ul>
              </div>

              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 text-xs space-y-1">
                <div className="flex justify-between text-neutral-600">
                  <span>Excel fayl nomi:</span>
                  <span className="font-mono font-bold text-neutral-800">
                    Tizim_Audit_15kunlik_{manualTargetPeriod.periodKey}_Arxiv.xlsx
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Mas'ul:</span>
                  <span className="font-bold text-emerald-700">{currentUsername || 'adminc1'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setManualTargetPeriod(null)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition cursor-pointer min-h-[40px]"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                onClick={() => handleExecuteManualTransition(manualTargetPeriod)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-50 min-h-[40px]"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Excelga o'tmoqda va bazadan tozalanmoqda...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Ha, Excelga o'tkazish va bazani tozalash</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
