import React, { useState, useMemo } from 'react';
import { Client } from '../types';
import { formatMoney, formatNumber, formatDate } from '../utils/format';
import { parseLegacyAddress } from '../utils/location';
import { storageService } from '../services/storage';
import { exportClientsToXLSX } from '../utils/excelExport';
import {
  Search,
  Plus,
  Phone,
  MapPin,
  Eye,
  Edit,
  Trash2,
  CreditCard,
  FileSpreadsheet,
  ArrowUpDown,
  Package,
  X,
} from 'lucide-react';

interface Props {
  clients: Client[];
  onOpenAddModal: () => void;
  onViewClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onQuickPayment: (client: Client) => void;
}

type FilterType = 'all' | 'debtors' | 'creditors' | 'settled';
type SortType = 'newest' | 'name' | 'debt_desc' | 'prod_desc';

export const ClientTable: React.FC<Props> = ({
  clients,
  onOpenAddModal,
  onViewClient,
  onEditClient,
  onDeleteClient,
  onQuickPayment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Extract unique regions from clients
  const uniqueRegions = useMemo(() => {
    const regSet = new Set<string>();
    clients.forEach((c) => {
      const reg = c.region?.trim() || parseLegacyAddress(c.address).region;
      if (reg) regSet.add(reg);
    });
    return Array.from(regSet).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [clients]);

  // Extract unique districts from clients (if region selected, only for that region)
  const uniqueDistricts = useMemo(() => {
    const distSet = new Set<string>();
    clients.forEach((c) => {
      const reg = c.region?.trim() || parseLegacyAddress(c.address).region;
      const dist = c.district?.trim() || parseLegacyAddress(c.address).district;
      if (dist) {
        if (selectedRegion === 'all' || reg.toLowerCase() === selectedRegion.toLowerCase()) {
          distSet.add(dist);
        }
      }
    });
    return Array.from(distSet).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [clients, selectedRegion]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      await exportClientsToXLSX(filteredClients.length > 0 ? filteredClients : clients);
    } catch (err) {
      console.error('Failed to export excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone.toLowerCase().includes(q);
        const matchesAddress = (c.address || '').toLowerCase().includes(q);
        const matchesRegion = (c.region || '').toLowerCase().includes(q);
        const matchesDistrict = (c.district || '').toLowerCase().includes(q);
        const matchesLandmark = (c.landmark || '').toLowerCase().includes(q);
        const matchesProducts = c.products.some(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.unit.toLowerCase().includes(q)
        );
        return (
          matchesName ||
          matchesPhone ||
          matchesAddress ||
          matchesRegion ||
          matchesDistrict ||
          matchesLandmark ||
          matchesProducts
        );
      });
    }

    // Filter type
    if (filterType === 'debtors') {
      result = result.filter((c) => c.currentDebt > 0);
    } else if (filterType === 'creditors') {
      result = result.filter((c) => c.currentAdvance > 0);
    } else if (filterType === 'settled') {
      result = result.filter((c) => c.currentDebt === 0 && c.currentAdvance === 0);
    }

    // Viloyat yoki shahar bo'yicha filtr
    if (selectedRegion !== 'all') {
      const targetReg = selectedRegion.toLowerCase();
      result = result.filter((c) => {
        const cReg = (c.region || parseLegacyAddress(c.address).region).toLowerCase();
        return cReg === targetReg || (c.address || '').toLowerCase().includes(targetReg);
      });
    }

    // Tuman bo'yicha filtr
    if (selectedDistrict !== 'all') {
      const targetDist = selectedDistrict.toLowerCase();
      result = result.filter((c) => {
        const cDist = (c.district || parseLegacyAddress(c.address).district).toLowerCase();
        return cDist === targetDist || (c.address || '').toLowerCase().includes(targetDist);
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortType === 'name') {
        return a.name.localeCompare(b.name, 'uz');
      }
      if (sortType === 'debt_desc') {
        return b.currentDebt - a.currentDebt;
      }
      if (sortType === 'prod_desc') {
        const aSum = a.products.reduce((s, p) => s + (p.totalPrice || p.quantity * p.unitPrice), 0);
        const bSum = b.products.reduce((s, p) => s + (p.totalPrice || p.quantity * p.unitPrice), 0);
        return bSum - aSum;
      }
      // default newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [clients, searchQuery, filterType, sortType, selectedRegion, selectedDistrict]);

  return (
    <div className="space-y-4">
      {/* Search, Filter, Sort and Action Strip */}
      <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Mijoz ismi, telefon, manzil yoki tovar nomi bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 focus:bg-white rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-200 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-neutral-400 hover:text-neutral-700"
              >
                Tozalash
              </button>
            )}
          </div>

          {/* Quick action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* 1. Viloyat yoki shahar bo'yicha filtr */}
            <div className="relative flex items-center">
              <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700">
                <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <select
                  value={selectedRegion}
                  onChange={(e) => {
                    setSelectedRegion(e.target.value);
                    setSelectedDistrict('all');
                  }}
                  className="bg-transparent outline-none cursor-pointer text-neutral-900 font-semibold max-w-[125px] truncate"
                  title="Viloyat yoki shahar bo'yicha filtr"
                >
                  <option value="all">Barcha viloyatlar</option>
                  {uniqueRegions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Tuman bo'yicha filtr */}
            <div className="relative flex items-center">
              <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700">
                <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer text-neutral-900 font-semibold max-w-[115px] truncate"
                  title="Tuman bo'yicha filtr"
                >
                  <option value="all">Barcha tumanlar</option>
                  {uniqueDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sort selector */}
            <div className="relative flex items-center">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700">
                <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                <select
                  value={sortType}
                  onChange={(e) => setSortType(e.target.value as SortType)}
                  className="bg-transparent outline-none cursor-pointer text-neutral-900 font-semibold"
                >
                  <option value="newest">Yangi qo'shilganlar</option>
                  <option value="name">Ism bo'yicha (A-Z)</option>
                  <option value="debt_desc">Qarzdorlik (kamayish)</option>
                  <option value="prod_desc">Tovar qiymati (kamayish)</option>
                </select>
              </div>
            </div>

            {/* Export XLSX */}
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-800 hover:text-black transition min-h-[38px] disabled:opacity-50 cursor-pointer"
              title="Excel (.xlsx) formatida yuklab olish"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">
                {isExporting ? 'Yuklanmoqda...' : 'Excel (.xlsx)'}
              </span>
            </button>

            {/* Add client direct button */}
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-xs transition min-h-[38px]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="whitespace-nowrap">Qo'shish</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs (Segmented controls) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 text-xs">
          <span className="text-[11px] font-bold text-neutral-500 uppercase mr-1">Filtr:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] ${
              filterType === 'all'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Barchasi ({clients.length})
          </button>
          <button
            onClick={() => setFilterType('debtors')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] ${
              filterType === 'debtors'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            Qarzdorlar ({clients.filter((c) => c.currentDebt > 0).length})
          </button>
          <button
            onClick={() => setFilterType('creditors')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] ${
              filterType === 'creditors'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            Haqdorlar ({clients.filter((c) => c.currentAdvance > 0).length})
          </button>
          <button
            onClick={() => setFilterType('settled')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] ${
              filterType === 'settled'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Hisob yopilgan ({clients.filter((c) => c.currentDebt === 0 && c.currentAdvance === 0).length})
          </button>

          {selectedRegion !== 'all' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-900 border border-rose-300 font-bold text-xs ml-auto">
              <MapPin className="w-3.5 h-3.5 text-rose-700" />
              <span>Viloyat: {selectedRegion}</span>
              <button
                onClick={() => {
                  setSelectedRegion('all');
                  setSelectedDistrict('all');
                }}
                className="p-0.5 hover:bg-rose-200 rounded text-rose-800 transition"
                title="Viloyat filtrini tozalash"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {selectedDistrict !== 'all' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 border border-neutral-300 font-bold text-xs">
              <MapPin className="w-3.5 h-3.5 text-neutral-600" />
              <span>Tuman: {selectedDistrict}</span>
              <button
                onClick={() => setSelectedDistrict('all')}
                className="p-0.5 hover:bg-neutral-200 rounded text-neutral-800 transition"
                title="Tuman filtrini tozalash"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredClients.length === 0 && (
        <div className="bg-white rounded-3xl p-10 text-center border border-rose-100 shadow-xs space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold font-display text-neutral-900">
            Mijozlar topilmadi
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchQuery
              ? `"${searchQuery}" so'rovi bo'yicha hech qanday mijoz topilmadi. Qidiruv so'zini o'zgartirib ko'ring.`
              : "Hozircha hech qanday mijoz kiritilmagan. Birinchi mijozingizni qo'shing."}
          </p>
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Yangi mijoz qo'shish</span>
          </button>
        </div>
      )}

      {/* Desktop & Tablet Table (>= 768px) */}
      {filteredClients.length > 0 && (
        <div className="hidden md:block bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50/70 border-b border-rose-100 text-neutral-800 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">Mijoz ismi & Telefon</th>
                  <th className="py-3.5 px-4">Manzili</th>
                  <th className="py-3.5 px-4">Topshirilgan tovarlar</th>
                  <th className="py-3.5 px-4 text-right">Mahsulotlar qiymati</th>
                  <th className="py-3.5 px-4 text-right">Joriy qarzdorlik</th>
                  <th className="py-3.5 px-4 text-right">Joriy haqdorlik</th>
                  <th className="py-3.5 px-4">Qo'shgan & Sana</th>
                  <th className="py-3.5 px-4 text-center">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100/60">
                {filteredClients.map((client) => {
                  const totalProductsSum = client.products.reduce(
                    (s, p) => s + (p.totalPrice || p.quantity * p.unitPrice),
                    0
                  );

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-rose-50/30 transition-colors group cursor-pointer"
                      onClick={() => onViewClient(client)}
                    >
                      {/* Name & Phone */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-sm text-neutral-900 group-hover:text-rose-700 transition-colors">
                          {client.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-neutral-600 mt-0.5">
                          <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                          <span className="font-mono text-[11px] tabular-nums font-semibold">
                            {client.phone || "Telefon yo'q"}
                          </span>
                        </div>
                      </td>

                      {/* Address: Viloyat, Tuman, Mo'ljal */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="flex items-start gap-1.5 text-neutral-700">
                          <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div
                              className="font-semibold text-neutral-900 truncate"
                              title={[client.region, client.district].filter(Boolean).join(', ') || client.address}
                            >
                              {[client.region, client.district].filter(Boolean).join(', ') || client.address || "Ko'rsatilmagan"}
                            </div>
                            {client.landmark && (
                              <div className="text-[11px] text-neutral-500 truncate" title={`Mo'ljal: ${client.landmark}`}>
                                Mo'ljal: {client.landmark}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Products preview */}
                      <td className="py-3.5 px-4 max-w-[240px]">
                        {client.products.length === 0 ? (
                          <span className="text-neutral-400 italic">Mahsulot yo'q</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-medium text-neutral-900 truncate">
                              {client.products.slice(0, 2).map((p, idx) => (
                                <span key={idx}>
                                  {p.name} ({formatNumber(p.quantity)} {p.unit})
                                  {idx < Math.min(client.products.length, 2) - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                            {client.products.length > 2 && (
                              <div className="text-[10px] font-semibold text-rose-700">
                                + yana {client.products.length - 2} ta tovar
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Products total value */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-neutral-900 text-xs tabular-nums">
                          {formatMoney(totalProductsSum)}
                        </span>
                      </td>

                      {/* Current Debt (Och qizil blok bilan) */}
                      <td className="py-3.5 px-4 text-right">
                        {client.currentDebt > 0 ? (
                          <div className="inline-block px-2.5 py-1 rounded-lg bg-rose-100/90 text-rose-900 font-mono font-bold text-xs tabular-nums border border-rose-200">
                            {formatMoney(client.currentDebt)}
                          </div>
                        ) : (
                          <span className="text-neutral-400 font-mono">0 so'm</span>
                        )}
                      </td>

                      {/* Current Advance (Haqdorlik) */}
                      <td className="py-3.5 px-4 text-right">
                        {client.currentAdvance > 0 ? (
                          <div className="inline-block px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-900 font-mono font-bold text-xs tabular-nums border border-emerald-200">
                            {formatMoney(client.currentAdvance)}
                          </div>
                        ) : (
                          <span className="text-neutral-400 font-mono">0 so'm</span>
                        )}
                      </td>

                      {/* Author & Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                              client.createdBy === 'agentp1'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-rose-100 text-rose-900 border border-rose-200'
                            }`}
                          >
                            {client.createdBy || 'adminc'}
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          {formatDate(client.createdAt)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewClient(client)}
                            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Batafsil ko'rish"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onQuickPayment(client)}
                            className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="To'lov / Qarz kiritish"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEditClient(client)}
                            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Tahrirlash"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`${client.name} ni o'chirishni xohlaysizmi?`)) {
                                onDeleteClient(client.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="O'chirish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile Card List (< 768px) with 44px touch targets */}
      {filteredClients.length > 0 && (
        <div className="md:hidden space-y-3">
          {filteredClients.map((client) => {
            const totalProductsSum = client.products.reduce(
              (s, p) => s + (p.totalPrice || p.quantity * p.unitPrice),
              0
            );

            return (
              <div
                key={client.id}
                onClick={() => onViewClient(client)}
                className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs space-y-3 active:bg-rose-50/40 transition"
              >
                {/* Header: Name and Phone call button */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-700 text-white font-bold flex items-center justify-center text-xs shrink-0">
                      {client.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-neutral-900 leading-tight">
                        {client.name}
                      </h4>
                      <p className="text-[11px] text-neutral-500 truncate max-w-[200px]" title={client.address}>
                        {[client.region, client.district].filter(Boolean).join(', ') || client.address || "Manzil ko'rsatilmagan"}
                        {client.landmark ? ` (${client.landmark})` : ''}
                      </p>
                    </div>
                  </div>

                  <a
                    href={`tel:${client.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-rose-50 text-neutral-800 hover:text-rose-700 flex items-center justify-center border border-neutral-200 transition min-h-[44px] min-w-[44px]"
                    title="Qo'ng'iroq qilish"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>

                {/* Products summary badge */}
                <div className="p-2.5 rounded-xl bg-neutral-50 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-neutral-700 truncate max-w-[190px]">
                    <Package className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span className="truncate">
                      {client.products.length > 0
                        ? `${client.products.length} xil tovar: ${client.products[0].name}`
                        : "Tovar kiritilmagan"}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-neutral-900 tabular-nums">
                    {formatMoney(totalProductsSum)}
                  </span>
                </div>

                {/* Balances: Debt and Advance */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/80">
                    <span className="text-[10px] font-bold text-rose-900 uppercase block">
                      Qarzdorlik:
                    </span>
                    <span className="font-mono font-bold text-neutral-900 text-xs tabular-nums block mt-0.5">
                      {formatMoney(client.currentDebt)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
                    <span className="text-[10px] font-bold text-emerald-900 uppercase block">
                      Haqdorlik / Avans:
                    </span>
                    <span className="font-mono font-bold text-neutral-900 text-xs tabular-nums block mt-0.5">
                      {formatMoney(client.currentAdvance)}
                    </span>
                  </div>
                </div>

                {/* Author & Creation date on mobile */}
                <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                  <span className="flex items-center gap-1.5">
                    <span>Qo'shgan:</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                        client.createdBy === 'agentp1'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-rose-100 text-rose-900 border border-rose-200'
                      }`}
                    >
                      {client.createdBy || 'adminc'}
                    </span>
                  </span>
                  <span className="font-mono text-[10px]">{formatDate(client.createdAt)}</span>
                </div>

                {/* Quick actions for mobile */}
                <div
                  className="pt-1 flex items-center justify-between gap-2 border-t border-neutral-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onViewClient(client)}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition min-h-[44px] flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ko'rish</span>
                  </button>

                  <button
                    onClick={() => onQuickPayment(client)}
                    className="flex-1 py-2 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition min-h-[44px] flex items-center justify-center gap-1"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-rose-700" />
                    <span>To'lov</span>
                  </button>

                  <button
                    onClick={() => onEditClient(client)}
                    className="p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Tahrirlash"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm(`${client.name} ni o'chirishni xohlaysizmi?`)) {
                        onDeleteClient(client.id);
                      }
                    }}
                    className="p-2 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="O'chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
