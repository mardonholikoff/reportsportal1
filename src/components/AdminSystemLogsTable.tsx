import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Calendar,
  Globe,
  User,
  Activity,
  CheckCircle2,
  Clock,
  RotateCcw,
  Copy,
  Check,
} from 'lucide-react';
import { SystemLog } from '../types';
import { exportSystemLogsToExcel } from '../utils/exportSystemLogsExcel';

interface Props {
  logs: SystemLog[];
  currentUsername: string;
}

export const AdminSystemLogsTable: React.FC<Props> = ({ logs, currentUsername }) => {
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedIp, setSelectedIp] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

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

  // Filtered logs
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
        if (selectedActionType === 'mahsulot' && !['mahsulot_topshirish', 'mahsulot_qaytishi'].includes(log.actionType)) {
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

  // Export to Excel
  const handleExport = () => {
    const filterDesc = [
      selectedUser !== 'all' ? `Foydalanuvchi: ${selectedUser}` : null,
      selectedActionType !== 'all' ? `Amal: ${selectedActionType}` : null,
      selectedIp !== 'all' ? `IP: ${selectedIp}` : null,
      startDate || endDate ? `Muddat: ${startDate || 'boshi'} dan ${endDate || 'hozirgacha'}` : null,
    ]
      .filter(Boolean)
      .join(', ') || 'Barcha tizim loglari';

    exportSystemLogsToExcel(filteredLogs, filterDesc);
  };

  // Action Badge Color
  const getActionBadge = (type: string) => {
    switch (type) {
      case 'kirish':
      case 'chiqish':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'reja_tuzish':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
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
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display">
                  Tizim Foydalanuvchilari Audit Loglari
                </h3>
                {currentUsername === 'adminc1' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/30 text-rose-200 border border-rose-400/30">
                    adminc1 nazorati
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Barcha turdagi foydalanuvchilar (agentlar, adminlar) qilgan ishlari va IP manzillari
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
            className="self-start sm:self-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer min-h-[38px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel (.xlsx) ga yuklash</span>
          </button>
        </div>

        {/* 4 Mini metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <div className="text-[11px] text-slate-400">Jami qaydlar</div>
            <div className="text-base sm:text-lg font-bold font-mono text-white">
              {stats.total} <span className="text-xs font-normal text-slate-400">ta</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <div className="text-[11px] text-slate-400">Agentlar amallari</div>
            <div className="text-base sm:text-lg font-bold font-mono text-emerald-400">
              {stats.agentCount} <span className="text-xs font-normal text-slate-400">ta</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <div className="text-[11px] text-slate-400">Admin harakatlari</div>
            <div className="text-base sm:text-lg font-bold font-mono text-indigo-400">
              {stats.adminCount} <span className="text-xs font-normal text-slate-400">ta</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <div className="text-[11px] text-slate-400">Noyob IP manzillar</div>
            <div className="text-base sm:text-lg font-bold font-mono text-amber-400">
              {stats.ipsCount} <span className="text-xs font-normal text-slate-400">ta IP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-500" />
            <span className="text-xs font-bold text-neutral-800">Filtrlash parametrlari</span>
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
            placeholder="Loglar ichidan qidirish (foydalanuvchi, IP manzil, amal sarlavhasi, mijoz, summa...)"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/40 text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-rose-500 outline-none transition"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Activity className="w-10 h-10 text-neutral-300 mx-auto" />
            <h4 className="text-sm font-bold text-neutral-800">
              Hech qanday tizim loglari topilmadi
            </h4>
            <p className="text-xs text-neutral-500">
              Filtrlarni o'zgartirib yoki tozalab ko'ring
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
    </div>
  );
};
