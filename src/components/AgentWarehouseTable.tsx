import React, { useState, useMemo } from 'react';
import { WarehouseProduct } from '../types';
import { storageService } from '../services/storage';
import { buildWarehouseProductChronology, ProductChronologyResult } from '../utils/warehouseChronology';
import { StickyTableWrapper } from './StickyTableWrapper';
import {
  Search,
  Warehouse,
  Package,
  Layers,
  Scale,
  Calendar,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  History,
} from 'lucide-react';
import { ProductDeliveryHistoryModal } from './ProductDeliveryHistoryModal';

interface Props {
  products: WarehouseProduct[];
}

export const AgentWarehouseTable: React.FC<Props> = ({ products }) => {
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'pieces_desc' | 'pieces_asc' | 'date'>('pieces_desc');
  const [snapshotDate, setSnapshotDate] = useState<string>('');
  const [showAllMinPrices, setShowAllMinPrices] = useState(false);
  const [revealedMinPriceIds, setRevealedMinPriceIds] = useState<Record<string, boolean>>({});
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<WarehouseProduct | null>(null);

  const formatYMD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayYmd = useMemo(() => formatYMD(new Date()), []);
  const yesterdayYmd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatYMD(d);
  }, []);
  const firstDayOfMonthYmd = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  const toggleMinPriceVisibility = (id: string) => {
    setRevealedMinPriceIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const chronologyMap = useMemo(() => {
    const map = new Map<string, ProductChronologyResult>();
    const plans = storageService.getDailyPlans() || [];
    const clients = storageService.getClients() || [];
    products.forEach((p) => {
      map.set(p.id, buildWarehouseProductChronology(p, plans, clients, undefined, products));
    });
    return map;
  }, [products]);

  const getEffectivePieces = (p: WarehouseProduct): number => {
    if (!snapshotDate) return p.totalPieces || 0;
    const chron = chronologyMap.get(p.id);
    return chron ? chron.getStockAtDate(snapshotDate).pieces : p.totalPieces || 0;
  };

  // Unique Brands
  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand?.trim()) set.add(p.brand.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [products]);

  // Unique Units
  const uniqueUnits = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.packageUnitName?.trim()) set.add(p.packageUnitName.trim());
      if (p.pieceUnitName?.trim()) set.add(p.pieceUnitName.trim());
      if (p.baseUnit?.trim()) set.add(p.baseUnit.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // 1. Text search
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchesName = p.name.toLowerCase().includes(q);
          const matchesBrand = p.brand.toLowerCase().includes(q);
          const matchesMark1 = (p.mark1 || '').toLowerCase().includes(q);
          const matchesMark2 = (p.mark2 || '').toLowerCase().includes(q);
          const matchesExtra = (p.extraMarks || []).some((em) => em.toLowerCase().includes(q));

          if (!matchesName && !matchesBrand && !matchesMark1 && !matchesMark2 && !matchesExtra) {
            return false;
          }
        }

        // 2. Brand filter
        if (selectedBrand !== 'all') {
          if (p.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
        }

        // 3. Unit filter
        if (selectedUnit !== 'all') {
          const u = selectedUnit.toLowerCase();
          const hasUnit =
            (p.packageUnitName || '').toLowerCase() === u ||
            (p.pieceUnitName || '').toLowerCase() === u ||
            (p.baseUnit || '').toLowerCase() === u;
          if (!hasUnit) return false;
        }

        // 4. Stock filter
        const effPieces = getEffectivePieces(p);
        if (stockFilter === 'in_stock' && effPieces <= 0) return false;
        if (stockFilter === 'low_stock' && (effPieces <= 0 || effPieces > 10)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name, 'uz');
        }
        if (sortBy === 'pieces_desc') {
          return getEffectivePieces(b) - getEffectivePieces(a);
        }
        if (sortBy === 'pieces_asc') {
          return getEffectivePieces(a) - getEffectivePieces(b);
        }
        if (sortBy === 'date') {
          return new Date(b.intakeDate || b.createdAt).getTime() - new Date(a.intakeDate || a.createdAt).getTime();
        }
        return 0;
      });
  }, [products, search, selectedBrand, selectedUnit, stockFilter, sortBy, snapshotDate, chronologyMap]);

  // Summary counts (only physical quantities, NO MONEY)
  const totalPiecesCount = useMemo(() => {
    return filteredProducts.reduce((sum, p) => sum + getEffectivePieces(p), 0);
  }, [filteredProducts, snapshotDate, chronologyMap]);

  const totalInitialPiecesCount = useMemo(() => {
    return filteredProducts.reduce((sum, p) => {
      const chron = chronologyMap.get(p.id);
      return sum + (chron ? chron.initialPieces : p.initialTotalPieces || p.totalPieces || 0);
    }, 0);
  }, [filteredProducts, chronologyMap]);

  const isFilterActive =
    search.trim() !== '' ||
    selectedBrand !== 'all' ||
    selectedUnit !== 'all' ||
    stockFilter !== 'all' ||
    snapshotDate !== '' ||
    sortBy !== 'pieces_desc';

  const resetFilters = () => {
    setSearch('');
    setSelectedBrand('all');
    setSelectedUnit('all');
    setStockFilter('all');
    setSnapshotDate('');
    setSortBy('pieces_desc');
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="p-4 bg-rose-50/30 rounded-2xl border border-rose-100 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mahsulot nomi, brendi yoki markasi bo'yicha qidirish..."
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-neutral-200 text-xs sm:text-sm focus:border-rose-500 focus:outline-none"
            />
          </div>

          {/* Quick Summary Badges (Quantities only + Eye toggle for min selling price) */}
          <div className="flex items-center gap-2 text-xs font-semibold shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAllMinPrices((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold transition cursor-pointer shadow-2xs ${
                showAllMinPrices
                  ? 'bg-indigo-700 text-white border-indigo-700'
                  : 'bg-white hover:bg-indigo-50 text-indigo-900 border-indigo-200'
              }`}
              title="Eng kam sotilish narxlarini ko'rish / yashirish"
            >
              {showAllMinPrices ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showAllMinPrices ? 'Narxlarni yashirish' : "Eng kam narxni ko'rish"}</span>
            </button>
            <div className="px-3 py-1.5 rounded-xl bg-white border border-neutral-200 text-neutral-800 shadow-2xs">
              <span className="text-neutral-500 mr-1.5">Turlar:</span>
              <span className="font-bold">{filteredProducts.length} xil</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 shadow-2xs">
              <span className="text-indigo-700 mr-1.5">Dastlabki:</span>
              <span className="font-bold font-mono">{totalInitialPiecesCount.toLocaleString()} dona</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 shadow-2xs">
              <span className="text-rose-700 mr-1.5">
                {snapshotDate ? `${snapshotDate} dagi qoldiq:` : 'Joriy qoldiq:'}
              </span>
              <span className="font-bold font-mono">{totalPiecesCount.toLocaleString()} dona</span>
            </div>
          </div>
        </div>

        {/* Sana bo'yicha ombor qoldig'ini ko'rish paneli */}
        <div className="p-2.5 rounded-xl bg-teal-50/80 border border-teal-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-teal-950 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              <span>Sanadagi ombor qoldig'ini ko'rish:</span>
            </span>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-teal-300 bg-white font-mono font-bold text-teal-950 outline-none focus:border-teal-600"
            />
            <button
              type="button"
              onClick={() => setSnapshotDate('')}
              className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                !snapshotDate
                  ? 'bg-teal-800 text-white'
                  : 'bg-white text-teal-900 border border-teal-200 hover:bg-teal-100'
              }`}
            >
              Hozirgi (Joriy)
            </button>
            <button
              type="button"
              onClick={() => setSnapshotDate(yesterdayYmd)}
              className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                snapshotDate === yesterdayYmd
                  ? 'bg-teal-800 text-white'
                  : 'bg-white text-teal-900 border border-teal-200 hover:bg-teal-100'
              }`}
            >
              Kecha
            </button>
            <button
              type="button"
              onClick={() => setSnapshotDate(firstDayOfMonthYmd)}
              className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                snapshotDate === firstDayOfMonthYmd
                  ? 'bg-teal-800 text-white'
                  : 'bg-white text-teal-900 border border-teal-200 hover:bg-teal-100'
              }`}
            >
              Oy boshi ({firstDayOfMonthYmd})
            </button>
          </div>
          {snapshotDate && (
            <span className="text-[11px] font-bold text-teal-900 bg-white px-2.5 py-0.5 rounded-lg border border-teal-200">
              Sana: <strong className="font-mono">{snapshotDate}</strong> yakunidagi miqdor
            </span>
          )}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
          {/* Brand Filter */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
              Brend
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-900 outline-none focus:border-rose-400 font-medium"
            >
              <option value="all">Barcha brendlar</option>
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
              O'lchov birligi
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-900 outline-none focus:border-rose-400 font-medium"
            >
              <option value="all">Barcha o'lchovlar</option>
              {uniqueUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Filter */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
              Zaxira holati
            </label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-900 outline-none focus:border-rose-400 font-medium"
            >
              <option value="all">Barcha holatlar</option>
              <option value="in_stock">Mavjud (&gt; 0 dona)</option>
              <option value="low_stock">Kam qolgan (1 - 10 dona)</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
              Saralash
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-900 outline-none focus:border-rose-400 font-medium"
            >
              <option value="pieces_desc">Dona soni (ko'pdan kamga)</option>
              <option value="pieces_asc">Dona soni (kamdan ko'pga)</option>
              <option value="name">Nomi bo'yicha (A-Z)</option>
              <option value="date">Keltirilgan sana bo'yicha</option>
            </select>
          </div>
        </div>

        {/* Reset button if filter active */}
        {isFilterActive && (
          <div className="flex items-center justify-between pt-1 border-t border-rose-100 text-[11px]">
            <span className="text-neutral-500">
              Filtr bo'yicha <strong>{filteredProducts.length}</strong> ta mahsulot topildi
            </span>
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-rose-700 hover:text-rose-900 font-bold transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Filtrlarni tozalash</span>
            </button>
          </div>
        )}
      </div>

      {/* Warehouse Products Table */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-2xs">
        {filteredProducts.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Package className="w-9 h-9 text-neutral-300 mx-auto" />
            <div className="text-xs font-bold text-neutral-800">
              Mos mahsulotlar topilmadi
            </div>
            <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
              Qidiruv so'zini yoki filtrlarni o'zgartirib ko'ring.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block">
              <StickyTableWrapper>
                <table className="w-full min-w-[1040px] text-left text-xs text-neutral-900 border-collapse">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-rose-50 border-b border-neutral-200 text-neutral-700 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3.5 w-12 text-center">#</th>
                      <th className="py-3 px-3.5">Brend va Nomi</th>
                      <th className="py-3 px-3.5">Markasi</th>
                      <th className="py-3 px-3.5 text-center text-indigo-900">
                        Dastlabki qoldiq (Baza yaratilganda)
                      </th>
                      <th className="py-3 px-3.5 text-center">
                        {snapshotDate ? `${snapshotDate} dagi Qadoq` : "Katta o'lcham (Qadoq)"}
                      </th>
                      <th className="py-3 px-3.5 text-center">
                        {snapshotDate ? `${snapshotDate} dagi Dona` : 'Dona soni'}
                      </th>
                      <th className="py-3 px-3.5 text-center">Umumiy hajm</th>
                      <th className="py-3 px-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setShowAllMinPrices((prev) => !prev)}
                          className="inline-flex items-center justify-center gap-1.5 hover:text-indigo-800 transition cursor-pointer uppercase"
                          title="Eng kam sotilish narxini ko'rish / yashirish"
                        >
                          <span>Eng kam sotilish narxi</span>
                          {showAllMinPrices ? (
                            <EyeOff className="w-3.5 h-3.5 text-indigo-700" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-indigo-700" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-3.5 text-center">Kirim sanasi</th>
                      <th className="py-3 px-3.5 text-center">Holati</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredProducts.map((p, idx) => {
                      const chron = chronologyMap.get(p.id);
                      const snap = snapshotDate && chron ? chron.getStockAtDate(snapshotDate) : null;
                      const effPieces = snap ? snap.pieces : p.totalPieces || 0;
                      const effVolume = snap ? snap.volume : p.totalVolume || 0;
                      const isLow = effPieces > 0 && effPieces <= 10;
                      const isOutOfStock = effPieces <= 0;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-rose-50/20 transition-colors"
                        >
                          <td className="py-3 px-3.5 text-center text-neutral-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Brand and Name */}
                          <td className="py-3 px-3.5">
                            <div
                              className="font-bold text-neutral-900 text-xs sm:text-sm flex items-center gap-2 cursor-pointer group"
                              onClick={() => setSelectedProductForHistory(p)}
                              title="Topshirilish va dastlabki qoldiq xronologiyasini ko'rish uchun bosing"
                            >
                              <span className="font-semibold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[10px] uppercase">
                                {p.brand}
                              </span>
                              <span className="group-hover:text-rose-700 transition">{p.name}</span>
                              <History className="w-3.5 h-3.5 text-rose-600 opacity-60 group-hover:opacity-100 transition shrink-0" />
                            </div>
                            {p.notes && (
                              <div className="text-[10px] text-neutral-400 truncate max-w-xs mt-0.5">
                                {p.notes}
                              </div>
                            )}
                          </td>

                          {/* Markasi */}
                          <td className="py-3 px-3.5">
                            <div className="flex flex-wrap gap-1">
                              {p.mark1 && (
                                <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-800 rounded text-[10px] font-medium">
                                  {p.mark1}
                                </span>
                              )}
                              {p.mark2 && (
                                <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-800 rounded text-[10px] font-medium">
                                  {p.mark2}
                                </span>
                              )}
                              {p.extraMarks &&
                                p.extraMarks.map((em, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.5 bg-neutral-100 text-neutral-700 rounded text-[10px]"
                                  >
                                    {em}
                                  </span>
                                ))}
                            </div>
                          </td>

                          {/* Dastlabki qoldiq (Baza yaratilganda) */}
                          <td
                            className="py-3 px-3.5 text-center cursor-pointer"
                            onClick={() => setSelectedProductForHistory(p)}
                            title="Dastlabki qoldiq va o'zgarishlar xronologiyasini ko'rish"
                          >
                            <div className="font-bold font-mono text-indigo-950 text-xs">
                              {chron ? chron.initialFormatted.primary : `${p.initialTotalPieces || p.totalPieces} dona`}
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono">
                              {chron ? `${chron.initialPieces.toLocaleString()} ${p.pieceUnitName || 'dona'}` : ''}
                            </div>
                            {chron && chron.initialEditCount > 0 ? (
                              <span className="mt-0.5 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-bold">
                                <History className="w-2.5 h-2.5" />
                                <span>{chron.initialEditCount} marta o'zgargan</span>
                              </span>
                            ) : (
                              <span className="text-[9.5px] text-emerald-700 font-medium">
                                O'zgartirilmagan
                              </span>
                            )}
                          </td>

                          {/* Katta o'lcham (Qadoq) */}
                          <td className="py-3 px-3.5 text-center">
                            {p.packageUnitName && (p.piecesPerPackage || 1) > 1 ? (
                              <>
                                <span className="font-semibold text-neutral-800">
                                  {Math.floor(effPieces / (p.piecesPerPackage || 1))} {p.packageUnitName}
                                  {effPieces % (p.piecesPerPackage || 1) > 0 && (
                                    <span className="text-emerald-700 font-bold block text-[10.5px]">
                                      + {effPieces % (p.piecesPerPackage || 1)} dona
                                    </span>
                                  )}
                                </span>
                                <div className="text-[10px] text-neutral-400">
                                  (1 {p.packageUnitName} = {p.piecesPerPackage} dona)
                                </div>
                              </>
                            ) : (
                              <span className="text-[11px] text-neutral-400">—</span>
                            )}
                          </td>

                          {/* Dona soni */}
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`font-bold text-sm font-mono tabular-nums ${
                                snapshotDate ? 'text-teal-900' : 'text-neutral-900'
                              }`}
                            >
                              {effPieces.toLocaleString()}
                            </span>{' '}
                            <span className="text-[11px] text-neutral-500">
                              {p.pieceUnitName || 'dona'}
                            </span>
                            {snap && (
                              <div className="text-[10px] text-teal-800 font-semibold font-mono">
                                Sotilgan: -{snap.soldUpToDatePieces}
                              </div>
                            )}
                          </td>

                          {/* Umumiy hajm */}
                          <td className="py-3 px-3.5 text-center">
                            <span className="font-semibold text-neutral-700 font-mono">
                              {effVolume.toLocaleString()} {p.baseUnit}
                            </span>
                          </td>

                          {/* Eng kam sotilish narxi (Faqat ko'z bosilganda ko'rinadi) */}
                          <td className="py-3 px-3.5 text-center">
                            {showAllMinPrices || revealedMinPriceIds[p.id] ? (
                              <div className="inline-flex flex-col items-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 font-bold font-mono text-indigo-900 text-xs">
                                    {(p.minSellingPrice !== undefined ? p.minSellingPrice : p.price || 0).toLocaleString()} USD
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleMinPriceVisibility(p.id)}
                                    className="p-1 rounded-lg text-neutral-400 hover:text-indigo-800 hover:bg-indigo-50 transition cursor-pointer"
                                    title="Narxni yashirish"
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="text-[10px] text-neutral-500 mt-0.5">
                                  1 {(p.minSellingPricingUnitType || p.pricingUnitType) === 'package' && p.packageUnitName ? p.packageUnitName : p.pieceUnitName || 'dona'}
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleMinPriceVisibility(p.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs transition cursor-pointer"
                                title="Eng kam sotilish narxini ko'rish"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-700" />
                                <span>Ko'rish</span>
                              </button>
                            )}
                          </td>

                          {/* Kirim sanasi */}
                          <td className="py-3 px-3.5 text-center text-neutral-500 font-mono text-[11px]">
                            <div className="flex items-center justify-center gap-1">
                              <Calendar className="w-3 h-3 text-neutral-400" />
                              <span>{p.intakeDate}</span>
                            </div>
                          </td>

                          {/* Zaxira Holati */}
                          <td className="py-3 px-3.5 text-center">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                Qolmagan
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Kam qolgan ({effPieces})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Yetarli
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </StickyTableWrapper>
            </div>

            {/* Mobile Card View (< 768px): Full view, zero horizontal swiping needed */}
            <div className="block md:hidden divide-y divide-neutral-100">
              {filteredProducts.map((p, idx) => {
                const chron = chronologyMap.get(p.id);
                const snap = snapshotDate && chron ? chron.getStockAtDate(snapshotDate) : null;
                const effPieces = snap ? snap.pieces : p.totalPieces || 0;
                const effVolume = snap ? snap.volume : p.totalVolume || 0;
                const isLow = effPieces > 0 && effPieces <= 10;
                const isOutOfStock = effPieces <= 0;

                return (
                  <div key={p.id} className="p-3.5 space-y-2.5">
                    {/* Header: Brand, Name & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="min-w-0 cursor-pointer"
                        onClick={() => setSelectedProductForHistory(p)}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-neutral-400 font-bold">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-rose-800 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 text-[10px] uppercase">
                            {p.brand}
                          </span>
                          <span className="font-bold text-neutral-900 text-xs sm:text-sm">
                            {p.name}
                          </span>
                          <History className="w-3.5 h-3.5 text-rose-600" />
                        </div>
                        {p.notes && (
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            {p.notes}
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <div className="shrink-0">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Qolmagan
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Kam ({effPieces})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Yetarli</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Marks pills */}
                    {(p.mark1 || p.mark2 || (p.extraMarks && p.extraMarks.length > 0)) && (
                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        <span className="text-neutral-400 font-medium">Marka:</span>
                        {p.mark1 && (
                          <span className="px-1.5 py-0.2 bg-neutral-100 text-neutral-800 rounded font-medium">
                            {p.mark1}
                          </span>
                        )}
                        {p.mark2 && (
                          <span className="px-1.5 py-0.2 bg-neutral-100 text-neutral-800 rounded font-medium">
                            {p.mark2}
                          </span>
                        )}
                        {p.extraMarks &&
                          p.extraMarks.map((em, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.2 bg-neutral-100 text-neutral-700 rounded"
                            >
                              {em}
                            </span>
                          ))}
                      </div>
                    )}

                    {/* Compact stats grid: Dastlabki, Dona, Qadoq, Eng kam sotilish narxi */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-xl bg-neutral-50 border border-neutral-200/80 text-center">
                      <div
                        className="cursor-pointer"
                        onClick={() => setSelectedProductForHistory(p)}
                      >
                        <span className="text-[10px] text-indigo-700 font-bold block">
                          Dastlabki qoldiq
                        </span>
                        <span className="font-mono font-bold text-indigo-950 text-xs">
                          {chron ? chron.initialFormatted.primary : `${p.initialTotalPieces || p.totalPieces} dona`}
                        </span>
                        {chron && chron.initialEditCount > 0 && (
                          <span className="text-[9px] text-amber-800 font-bold block">
                            ({chron.initialEditCount} marta o'zgargan)
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-neutral-500 block">
                          {snapshotDate ? `${snapshotDate} dagi` : 'Dona soni'}
                        </span>
                        <span className="font-mono font-bold text-neutral-900 text-xs sm:text-sm tabular-nums">
                          {effPieces.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-neutral-500 ml-0.5">
                          {p.pieceUnitName || 'dona'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-neutral-500 block">Qadoq / Hajm</span>
                        {p.packageUnitName && (p.piecesPerPackage || 1) > 1 ? (
                          <>
                            <span className="font-semibold text-neutral-800 text-xs">
                              {Math.floor(effPieces / (p.piecesPerPackage || 1))} {p.packageUnitName}
                              {effPieces % (p.piecesPerPackage || 1) > 0 && (
                                <span className="text-emerald-700 font-bold">
                                  {' '}+{effPieces % (p.piecesPerPackage || 1)}
                                </span>
                              )}
                            </span>
                            <span className="text-[9px] text-neutral-400 block">
                              ({effVolume} {p.baseUnit})
                            </span>
                          </>
                        ) : (
                          <span className="font-mono font-semibold text-neutral-800 text-xs">
                            {effVolume.toLocaleString()} {p.baseUnit}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-indigo-700 font-semibold block">
                          Eng kam sotilish narxi
                        </span>
                        {showAllMinPrices || revealedMinPriceIds[p.id] ? (
                          <div className="flex flex-col items-center">
                            <button
                              type="button"
                              onClick={() => toggleMinPriceVisibility(p.id)}
                              className="inline-flex items-center gap-1 font-mono font-bold text-indigo-900 text-xs cursor-pointer"
                              title="Yashirish"
                            >
                              <span>
                                {(p.minSellingPrice !== undefined ? p.minSellingPrice : p.price || 0).toLocaleString()} USD
                              </span>
                              <EyeOff className="w-3 h-3 text-indigo-600" />
                            </button>
                            <span className="text-[9px] text-neutral-500 block">
                              1 {(p.minSellingPricingUnitType || p.pricingUnitType) === 'package' && p.packageUnitName ? p.packageUnitName : p.pieceUnitName || 'dona'}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleMinPriceVisibility(p.id)}
                            className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-[11px] cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-indigo-700" />
                            <span>Ko'rish</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-neutral-400" />
                        <span>Kirim: {p.intakeDate}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Product Delivery History Modal */}
      <ProductDeliveryHistoryModal
        isOpen={Boolean(selectedProductForHistory)}
        onClose={() => setSelectedProductForHistory(null)}
        product={selectedProductForHistory}
      />
    </div>
  );
};
