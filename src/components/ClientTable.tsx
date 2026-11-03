import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { Client } from '../types';
import { formatMoney, formatNumber, formatDate, getAgentDisplayName } from '../utils/format';
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
  Lock,
  Warehouse,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Props {
  clients: Client[];
  onOpenAddModal: () => void;
  onViewClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onQuickPayment: (client: Client) => void;
  onOpenWarehouseDebtModal?: (client?: Client) => void;
  userRole?: 'admin' | 'agent';
  currentUsername?: string;
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
  onOpenWarehouseDebtModal,
  userRole = 'admin',
  currentUsername,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedCreator, setSelectedCreator] = useState<string>('all');
  // Mahsulotlar asosida filtr va tanlangan mahsulotlarni ko'p yoki kam asosida filtr/saralash
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productPresenceFilter, setProductPresenceFilter] = useState<'all' | 'has_products' | 'no_products'>('all');
  const [productOrderMode, setProductOrderMode] = useState<'none' | 'qty_desc' | 'qty_asc' | 'sum_desc' | 'sum_asc'>('none');
  const [minProductQty, setMinProductQty] = useState<string>('');
  const [maxProductQty, setMaxProductQty] = useState<string>('');

  const [isExporting, setIsExporting] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  // Faqat adminc va adminc1 o'chirish va ombordagi qarzdorlik qo'shish huquqiga ega
  const canDelete = currentUsername === 'adminc' || currentUsername === 'adminc1';
  const canAddWarehouseDebt = currentUsername === 'adminc' || currentUsername === 'adminc1';

  // Pre-compute global tab counts in a single O(N) pass
  const globalTabCounts = useMemo(() => {
    let debtors = 0;
    let creditors = 0;
    let settled = 0;
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      if (c.currentDebt > 0) debtors++;
      if (c.currentAdvance > 0) creditors++;
      if (c.currentDebt === 0 && c.currentAdvance === 0) settled++;
    }
    return { debtors, creditors, settled };
  }, [clients]);

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

  // Extract unique creators
  const uniqueCreators = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      set.add((c.createdBy || 'adminc').trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [clients]);

  // Extract all unique products across clients (with client count and total qty)
  const uniqueProductCatalog = useMemo(() => {
    const map = new Map<
      string,
      { name: string; unit: string; clientsSet: Set<string>; totalQty: number; totalSum: number }
    >();
    clients.forEach((c) => {
      (c.products || []).forEach((p) => {
        const cleanName = (p.name || '').trim();
        if (!cleanName) return;
        const key = cleanName.toLowerCase();
        const existing = map.get(key) || {
          name: cleanName,
          unit: p.unit || 'dona',
          clientsSet: new Set<string>(),
          totalQty: 0,
          totalSum: 0,
        };
        existing.clientsSet.add(c.id);
        existing.totalQty += Number(p.quantity) || 0;
        existing.totalSum += Number(p.totalPrice) || (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0);
        map.set(key, existing);
      });
    });
    return Array.from(map.values())
      .map((item) => ({
        name: item.name,
        key: item.name.toLowerCase(),
        unit: item.unit,
        clientsCount: item.clientsSet.size,
        totalQty: Math.round(item.totalQty * 100) / 100,
        totalSum: Math.round(item.totalSum * 100) / 100,
      }))
      .sort((a, b) => b.clientsCount - a.clientsCount || a.name.localeCompare(b.name, 'uz'));
  }, [clients]);

  // Helper: get client's quantity and sum for the currently selected product(s) (or all products if none selected)
  const getClientProductMetrics = (client: Client) => {
    const prods = client.products || [];
    const selectedSet = new Set(selectedProducts.map((s) => s.toLowerCase()));
    let matchedQty = 0;
    let matchedSum = 0;
    let matchedCount = 0;

    prods.forEach((p) => {
      const pKey = (p.name || '').trim().toLowerCase();
      if (!pKey) return;
      if (selectedSet.size === 0 || selectedSet.has(pKey)) {
        const q = Number(p.quantity) || 0;
        const val = Number(p.totalPrice) || q * (Number(p.unitPrice) || 0);
        matchedQty += q;
        matchedSum += val;
        matchedCount++;
      }
    });

    return {
      matchedQty: Math.round(matchedQty * 100) / 100,
      matchedSum: Math.round(matchedSum * 100) / 100,
      matchedCount,
    };
  };

  const toggleProductSelection = (prodName: string) => {
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.toLowerCase() === prodName.toLowerCase());
      const next = exists
        ? prev.filter((p) => p.toLowerCase() !== prodName.toLowerCase())
        : [...prev, prodName];
      if (next.length > 0 && productOrderMode === 'none') {
        setProductOrderMode('qty_desc');
      }
      return next;
    });
  };

  const isAnyFilterActive =
    searchQuery.trim() !== '' ||
    filterType !== 'all' ||
    selectedRegion !== 'all' ||
    selectedDistrict !== 'all' ||
    selectedCreator !== 'all' ||
    selectedProducts.length > 0 ||
    productPresenceFilter !== 'all' ||
    productOrderMode !== 'none' ||
    minProductQty.trim() !== '' ||
    maxProductQty.trim() !== '';

  const resetAllFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setSelectedRegion('all');
    setSelectedDistrict('all');
    setSelectedCreator('all');
    setSelectedProducts([]);
    setProductPresenceFilter('all');
    setProductOrderMode('none');
    setMinProductQty('');
    setMaxProductQty('');
    setSortType('newest');
  };

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

  // Filter and sort clients (using deferredSearchQuery for non-blocking typing)
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Search query
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase().trim();
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

    // Kiritgan xodim/agent bo'yicha filtr
    if (selectedCreator !== 'all') {
      const targetCr = selectedCreator.toLowerCase();
      result = result.filter(
        (c) => (c.createdBy || 'adminc').toLowerCase() === targetCr
      );
    }

    // Mahsulot bor/yo'qligi bo'yicha filtr
    if (productPresenceFilter === 'has_products') {
      result = result.filter((c) => c.products && c.products.length > 0);
    } else if (productPresenceFilter === 'no_products') {
      result = result.filter((c) => !c.products || c.products.length === 0);
    }

    // Tanlangan mahsulot(lar) asosida filtr (kimda qanday mahsulot borligi)
    if (selectedProducts.length > 0) {
      const selSet = new Set(selectedProducts.map((s) => s.toLowerCase()));
      result = result.filter((c) =>
        (c.products || []).some((p) => selSet.has((p.name || '').trim().toLowerCase()))
      );
    }

    // Tanlangan mahsulot(lar) miqdori (ko'p yoki kam / min-max) bo'yicha filtr
    const minQ = minProductQty.trim() !== '' ? Number(minProductQty) : null;
    const maxQ = maxProductQty.trim() !== '' ? Number(maxProductQty) : null;
    if ((minQ !== null && !isNaN(minQ)) || (maxQ !== null && !isNaN(maxQ))) {
      result = result.filter((c) => {
        const { matchedQty } = getClientProductMetrics(c);
        if (minQ !== null && !isNaN(minQ) && matchedQty < minQ) return false;
        if (maxQ !== null && !isNaN(maxQ) && matchedQty > maxQ) return false;
        return matchedQty > 0 || minQ === 0;
      });
    }

    // Sorting (agar mahsulotni ko'p yoki kam asosida tartiblash tanlangan bo'lsa, birinchi navbatda u ishlaydi)
    result.sort((a, b) => {
      if (productOrderMode !== 'none') {
        const aM = getClientProductMetrics(a);
        const bM = getClientProductMetrics(b);
        if (productOrderMode === 'qty_desc') {
          if (bM.matchedQty !== aM.matchedQty) return bM.matchedQty - aM.matchedQty;
          return bM.matchedSum - aM.matchedSum;
        }
        if (productOrderMode === 'qty_asc') {
          if (aM.matchedQty !== bM.matchedQty) return aM.matchedQty - bM.matchedQty;
          return aM.matchedSum - bM.matchedSum;
        }
        if (productOrderMode === 'sum_desc') {
          if (bM.matchedSum !== aM.matchedSum) return bM.matchedSum - aM.matchedSum;
          return bM.matchedQty - aM.matchedQty;
        }
        if (productOrderMode === 'sum_asc') {
          if (aM.matchedSum !== bM.matchedSum) return aM.matchedSum - bM.matchedSum;
          return aM.matchedQty - bM.matchedQty;
        }
      }

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
  }, [
    clients,
    deferredSearchQuery,
    filterType,
    sortType,
    selectedRegion,
    selectedDistrict,
    selectedCreator,
    selectedProducts,
    productPresenceFilter,
    productOrderMode,
    minProductQty,
    maxProductQty,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    deferredSearchQuery,
    filterType,
    sortType,
    selectedRegion,
    selectedDistrict,
    selectedCreator,
    selectedProducts,
    productPresenceFilter,
    productOrderMode,
    minProductQty,
    maxProductQty,
    pageSize,
  ]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(filteredClients.length / pageSize));
  }, [filteredClients.length, pageSize]);

  const safeCurrentPage = Math.min(currentPage, totalPages);

  // Paginated slice for fast DOM rendering
  const visibleClients = useMemo(() => {
    if (pageSize === 'all') return filteredClients;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, pageSize, safeCurrentPage]);

  // Xulosaviy qiymatlar jadval (filtrlangan ro'yxat) bo'yicha
  const filteredSummary = useMemo(() => {
    let totalDebt = 0;
    let totalAdvance = 0;
    let totalProductsValue = 0;
    let totalProductsCount = 0;
    let debtorsCount = 0;
    let creditorsCount = 0;
    let settledCount = 0;
    let maxDebtor: Client | null = null;

    filteredClients.forEach((c) => {
      const d = c.currentDebt || 0;
      const a = c.currentAdvance || 0;
      const prodSum = c.products.reduce(
        (s, p) => s + (p.totalPrice || p.quantity * p.unitPrice),
        0
      );

      totalDebt += d;
      totalAdvance += a;
      totalProductsValue += prodSum;
      totalProductsCount += c.products.length;

      if (d > 0) {
        debtorsCount++;
        if (!maxDebtor || d > (maxDebtor.currentDebt || 0)) {
          maxDebtor = c;
        }
      }
      if (a > 0) {
        creditorsCount++;
      }
      if (d === 0 && a === 0) {
        settledCount++;
      }
    });

    const avgDebtPerDebtor = debtorsCount > 0 ? totalDebt / debtorsCount : 0;
    const netBalance = totalDebt - totalAdvance;

    return {
      totalCount: filteredClients.length,
      allClientsCount: clients.length,
      totalDebt,
      totalAdvance,
      totalProductsValue,
      totalProductsCount,
      debtorsCount,
      creditorsCount,
      settledCount,
      avgDebtPerDebtor,
      netBalance,
      maxDebtor: maxDebtor as Client | null,
    };
  }, [filteredClients, clients.length]);

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

            {/* 3. Kiritgan xodim/agent bo'yicha filtr */}
            {uniqueCreators.length > 1 && (
              <div className="relative flex items-center">
                <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700">
                  <select
                    value={selectedCreator}
                    onChange={(e) => setSelectedCreator(e.target.value)}
                    className="bg-transparent outline-none cursor-pointer text-neutral-900 font-semibold max-w-[120px] truncate"
                    title="Kiritgan xodim bo'yicha filtr"
                  >
                    <option value="all">Barcha kirituvchilar</option>
                    {uniqueCreators.map((cr) => (
                      <option key={cr} value={cr}>
                        Kiritgan: {getAgentDisplayName(cr)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

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

            {/* Ombordagi qarzdorlik qo'shish: Faqat adminc va adminc1 */}
            {canAddWarehouseDebt && onOpenWarehouseDebtModal && (
              <button
                type="button"
                onClick={() => onOpenWarehouseDebtModal()}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition min-h-[38px] cursor-pointer"
                title="Ombordagi narxlar valyutasida mijozga qarzdorlik qo'shish"
              >
                <Warehouse className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Ombor qarzdorligi</span>
              </button>
            )}

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
            className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] cursor-pointer ${
              filterType === 'all'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Barchasi ({clients.length})
          </button>
          <button
            onClick={() => setFilterType('debtors')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] cursor-pointer ${
              filterType === 'debtors'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            Qarzdorlar ({globalTabCounts.debtors})
          </button>
          <button
            onClick={() => setFilterType('creditors')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] cursor-pointer ${
              filterType === 'creditors'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            Haqdorlar ({globalTabCounts.creditors})
          </button>
          <button
            onClick={() => setFilterType('settled')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] cursor-pointer ${
              filterType === 'settled'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Hisob yopilgan ({globalTabCounts.settled})
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
                className="p-0.5 hover:bg-rose-200 rounded text-rose-800 transition cursor-pointer"
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
                className="p-0.5 hover:bg-neutral-200 rounded text-neutral-800 transition cursor-pointer"
                title="Tuman filtrini tozalash"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {isAnyFilterActive && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs ml-auto transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Filtrlarni tozalash</span>
            </button>
          )}
        </div>

        {/* =================================================================== */}
        {/* MAHSULOTLARI ASOSIDA FILTR VA KO'P YOKI KAM ASOSIDA SARALASH BLOKI  */}
        {/* =================================================================== */}
        <div className="pt-2.5 border-t border-neutral-100 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 uppercase">
                <Package className="w-3.5 h-3.5 text-indigo-700" />
                <span>Mahsulotlar asosida filtr (Kimda qanday mahsulot bor va Ko'p / Kam):</span>
              </span>

              {/* Mahsulot bor/yo'q tezkor tugmalar */}
              <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setProductPresenceFilter('all')}
                  className={`px-2 py-1 rounded-md font-bold cursor-pointer transition ${
                    productPresenceFilter === 'all'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Barchasi
                </button>
                <button
                  type="button"
                  onClick={() => setProductPresenceFilter('has_products')}
                  className={`px-2 py-1 rounded-md font-bold cursor-pointer transition ${
                    productPresenceFilter === 'has_products'
                      ? 'bg-indigo-700 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Mahsuloti borlar
                </button>
                <button
                  type="button"
                  onClick={() => setProductPresenceFilter('no_products')}
                  className={`px-2 py-1 rounded-md font-bold cursor-pointer transition ${
                    productPresenceFilter === 'no_products'
                      ? 'bg-neutral-800 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Mahsulotsiz
                </button>
              </div>

              {/* Dropdown orqali mahsulot qo'shish/tanlash */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50/70 hover:bg-indigo-100/70 rounded-xl border border-indigo-200 text-xs">
                <Package className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (val === '__CLEAR__') {
                      setSelectedProducts([]);
                    } else {
                      toggleProductSelection(val);
                    }
                  }}
                  className="bg-transparent outline-none cursor-pointer text-indigo-950 font-bold max-w-[220px] truncate"
                >
                  <option value="">
                    {selectedProducts.length > 0
                      ? `+ Yana mahsulot tanlash (${selectedProducts.length} ta tanlangan)`
                      : 'Mahsulotni tanlang...'}
                  </option>
                  {selectedProducts.length > 0 && (
                    <option value="__CLEAR__">✕ Tanlangan mahsulotlarni tozalash</option>
                  )}
                  {uniqueProductCatalog.map((prod) => {
                    const isSel = selectedProducts.some(
                      (s) => s.toLowerCase() === prod.key
                    );
                    return (
                      <option key={prod.key} value={prod.name}>
                        {isSel ? '✓ ' : ''}
                        {prod.name} ({prod.clientsCount} mijozda, jami {formatNumber(prod.totalQty)} {prod.unit})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Tanlangan mahsulotlarni Ko'p yoki Kam asosida tartiblash va Min/Max miqdor */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-amber-50/90 px-2.5 py-1.5 rounded-xl border border-amber-200 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="text-[11px] font-bold text-amber-900">Ko'p / Kam:</span>
                <select
                  value={productOrderMode}
                  onChange={(e) =>
                    setProductOrderMode(
                      e.target.value as 'none' | 'qty_desc' | 'qty_asc' | 'sum_desc' | 'sum_asc'
                    )
                  }
                  className="bg-transparent outline-none cursor-pointer text-amber-950 font-bold"
                >
                  <option value="none">Oddiy tartib</option>
                  <option value="qty_desc">Ko'pdan kamga (Miqdori ko'plar avval ↓)</option>
                  <option value="qty_asc">Kamdan ko'pga (Miqdori kamlar avval ↑)</option>
                  <option value="sum_desc">Ko'pdan kamga (Summasi ko'plar avval ↓)</option>
                  <option value="sum_asc">Kamdan ko'pga (Summasi kamlar avval ↑)</option>
                </select>
              </div>

              {/* Min va Max miqdor filtri */}
              <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1 rounded-xl border border-neutral-200 text-xs">
                <span className="text-[10px] font-bold text-neutral-500 uppercase">Miqdor:</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Min (kamida)"
                  value={minProductQty}
                  onChange={(e) => setMinProductQty(e.target.value)}
                  className="w-24 px-2 py-1 rounded-lg bg-white border border-neutral-200 text-xs font-mono font-bold text-neutral-900 outline-none focus:border-indigo-500"
                />
                <span className="text-neutral-400">—</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Max (ko'pi)"
                  value={maxProductQty}
                  onChange={(e) => setMaxProductQty(e.target.value)}
                  className="w-24 px-2 py-1 rounded-lg bg-white border border-neutral-200 text-xs font-mono font-bold text-neutral-900 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Tezkor mahsulot tugmalari (bir bosishda mahsulotni tanlash) */}
          {uniqueProductCatalog.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-neutral-400 uppercase mr-1">
                Mavjud mahsulotlar:
              </span>
              {uniqueProductCatalog.slice(0, 14).map((prod) => {
                const isSelected = selectedProducts.some(
                  (s) => s.toLowerCase() === prod.key
                );
                return (
                  <button
                    key={prod.key}
                    type="button"
                    onClick={() => toggleProductSelection(prod.name)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-indigo-700 text-white border-indigo-800 shadow-2xs'
                        : 'bg-neutral-50 hover:bg-indigo-50 text-neutral-700 border-neutral-200'
                    }`}
                  >
                    <span>{prod.name}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-neutral-200/80 text-neutral-700'
                      }`}
                    >
                      {prod.clientsCount} mijoz • {formatNumber(prod.totalQty)} {prod.unit}
                    </span>
                  </button>
                );
              })}
              {selectedProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedProducts([])}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                >
                  ✕ Mahsulot tanlovini tozalash
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* JADVAL (FILTRLAR) BO'YICHA XULOSAVIY QIYMATLAR                        */}
      {/* ===================================================================== */}
      <div
        className={`rounded-2xl p-4 border shadow-xs transition ${
          isAnyFilterActive
            ? 'bg-gradient-to-r from-rose-50/90 via-white to-emerald-50/60 border-rose-300 ring-1 ring-rose-200/70'
            : 'bg-white border-rose-100'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-neutral-200/80">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider ${
                isAnyFilterActive
                  ? 'bg-rose-700 text-white'
                  : 'bg-neutral-800 text-white'
              }`}
            >
              {isAnyFilterActive ? "Filtr natijasi bo'yicha xulosa" : "Jadval bo'yicha xulosaviy qiymatlar"}
            </span>
            <span className="text-xs font-semibold text-neutral-600">
              Ko'rsatilmoqda:{' '}
              <strong className="text-neutral-900">{filteredSummary.totalCount} ta</strong> mijoz
              {isAnyFilterActive && (
                <span>
                  {' '}
                  (jami {filteredSummary.allClientsCount} tadan{' '}
                  {filteredSummary.allClientsCount > 0
                    ? Math.round((filteredSummary.totalCount / filteredSummary.allClientsCount) * 100)
                    : 0}
                  %)
                </span>
              )}
            </span>
          </div>

          {filteredSummary.maxDebtor && (
            <div className="text-[11px] text-rose-900 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 font-medium">
              Eng katta qarzdor:{' '}
              <strong className="font-bold">{filteredSummary.maxDebtor.name}</strong> (
              <span className="font-mono font-bold text-rose-700">
                {formatMoney(filteredSummary.maxDebtor.currentDebt)}
              </span>
              )
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* 1. Mijozlar soni va holati */}
          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/90">
            <div className="text-[10px] font-bold uppercase text-neutral-500">
              Jadvaldagi mijozlar
            </div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-neutral-900 mt-0.5">
              {filteredSummary.totalCount} ta
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              Qarzdor: {filteredSummary.debtorsCount} • Haqdor: {filteredSummary.creditorsCount} • Yopilgan: {filteredSummary.settledCount}
            </div>
          </div>

          {/* 2. Jami qarzdorlik */}
          <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-200">
            <div className="text-[10px] font-bold uppercase text-rose-800">
              Jami qarzdorlik (Jadval)
            </div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-rose-700 mt-0.5">
              {formatMoney(filteredSummary.totalDebt)}
            </div>
            <div className="text-[10px] text-rose-900/70 mt-0.5">
              {filteredSummary.debtorsCount} ta qarzdor (o'rtacha {formatMoney(Math.round(filteredSummary.avgDebtPerDebtor))})
            </div>
          </div>

          {/* 3. Jami haqdorlik */}
          <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200">
            <div className="text-[10px] font-bold uppercase text-emerald-800">
              Jami haqdorlik / avans
            </div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-700 mt-0.5">
              {formatMoney(filteredSummary.totalAdvance)}
            </div>
            <div className="text-[10px] text-emerald-900/70 mt-0.5">
              {filteredSummary.creditorsCount} ta haqdor mijozda
            </div>
          </div>

          {/* 4. Topshirilgan mahsulotlar qiymati */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="text-[10px] font-bold uppercase text-amber-900">
              Mahsulotlar jami qiymati
            </div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-neutral-900 mt-0.5">
              {formatMoney(filteredSummary.totalProductsValue)}
            </div>
            <div className="text-[10px] text-amber-900/80 mt-0.5">
              Jami {filteredSummary.totalProductsCount} ta tovar yozuvi
            </div>
          </div>

          {/* 5. Sof balans farqi */}
          <div className="p-3 rounded-xl bg-neutral-900 text-white border border-neutral-800 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold uppercase text-neutral-400">
              Sof balans (Qarz − Haq)
            </div>
            <div
              className={`text-base sm:text-lg font-extrabold font-mono mt-0.5 ${
                filteredSummary.netBalance >= 0 ? 'text-rose-300' : 'text-emerald-300'
              }`}
            >
              {formatMoney(Math.abs(filteredSummary.netBalance))}
            </div>
            <div className="text-[10px] text-neutral-300 mt-0.5">
              {filteredSummary.netBalance >= 0 ? 'Sof undiriladigan qarz' : 'Sof mijoz haqdorligi'}
            </div>
          </div>
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
                {visibleClients.map((client) => {
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
                        {client.lastPlanCloseReason && (
                          <div
                            className="mt-1 flex items-center gap-1 text-[10px] text-rose-800 font-semibold truncate max-w-[200px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                            title={`Reja yopilish sababi: ${client.lastPlanCloseReason}`}
                          >
                            <Lock className="w-2.5 h-2.5 text-rose-700 shrink-0" />
                            <span className="truncate">Yopilgan: "{client.lastPlanCloseReason}"</span>
                          </div>
                        )}
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
                            {getAgentDisplayName(client.createdBy || 'adminc')}
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
                            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                            title="Batafsil ko'rish"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {userRole !== 'agent' && (
                            <button
                              onClick={() => onQuickPayment(client)}
                              className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="To'lov / Qarz kiritish"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          )}
                          {canAddWarehouseDebt && onOpenWarehouseDebtModal && (
                            <button
                              onClick={() => onOpenWarehouseDebtModal(client)}
                              className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Ombordagi qarzdorlik qo'shish"
                            >
                              <Warehouse className="w-4 h-4" />
                            </button>
                          )}
                          {userRole !== 'agent' && (
                            <button
                              onClick={() => onEditClient(client)}
                              className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Tahrirlash"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setClientToDelete(client)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Mijoz va ma'lumotlarini o'chirish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-rose-50/90 border-t-2 border-rose-200 text-neutral-900 font-bold text-xs">
                <tr>
                  <td colSpan={2} className="py-3.5 px-4">
                    <div className="font-extrabold text-neutral-900 uppercase tracking-wide">
                      JAMI XULOSA ({filteredSummary.totalCount} ta mijoz)
                    </div>
                    <div className="text-[10px] font-semibold text-neutral-500 mt-0.5">
                      Qarzdor: {filteredSummary.debtorsCount} ta • Haqdor: {filteredSummary.creditorsCount} ta • Yopilgan: {filteredSummary.settledCount} ta
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-neutral-700 font-semibold">
                    Jami {filteredSummary.totalProductsCount} ta tovar yozuvi
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold text-neutral-900 tabular-nums">
                    {formatMoney(filteredSummary.totalProductsValue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold text-rose-800 bg-rose-100/80 tabular-nums">
                    {formatMoney(filteredSummary.totalDebt)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-800 bg-emerald-100/80 tabular-nums">
                    {formatMoney(filteredSummary.totalAdvance)}
                  </td>
                  <td colSpan={2} className="py-3.5 px-4 text-right text-[11px] font-mono">
                    <span className="text-neutral-500 mr-1">Sof balans:</span>
                    <span
                      className={`font-extrabold ${
                        filteredSummary.netBalance >= 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatMoney(Math.abs(filteredSummary.netBalance))}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Mobile Card List (< 768px) with 44px touch targets */}
      {filteredClients.length > 0 && (
        <div className="md:hidden space-y-3">
          {visibleClients.map((client) => {
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
                      {client.lastPlanCloseReason && (
                        <div
                          className="mt-1 flex items-center gap-1 text-[10px] text-rose-800 font-semibold truncate max-w-[200px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                          title={`Reja yopilish sababi: ${client.lastPlanCloseReason}`}
                        >
                          <Lock className="w-2.5 h-2.5 text-rose-700 shrink-0" />
                          <span className="truncate">Yopilgan: "{client.lastPlanCloseReason}"</span>
                        </div>
                      )}
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
                      {getAgentDisplayName(client.createdBy || 'adminc')}
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

                  {userRole !== 'agent' && (
                    <button
                      onClick={() => onQuickPayment(client)}
                      className="flex-1 py-2 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition min-h-[44px] flex items-center justify-center gap-1"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-rose-700" />
                      <span>To'lov</span>
                    </button>
                  )}

                  {canAddWarehouseDebt && onOpenWarehouseDebtModal && (
                    <button
                      onClick={() => onOpenWarehouseDebtModal(client)}
                      className="p-2 rounded-lg text-amber-700 hover:bg-amber-50 border border-amber-200 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                      title="Ombordagi qarzdorlik qo'shish"
                    >
                      <Warehouse className="w-4 h-4" />
                    </button>
                  )}

                  {userRole !== 'agent' && (
                    <button
                      onClick={() => onEditClient(client)}
                      className="p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                      title="Tahrirlash"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setClientToDelete(client)}
                      className="p-2 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                      title="Mijoz va ma'lumotlarini o'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Smart Pagination Bar */}
      {filteredClients.length > 25 && (
        <div className="bg-white rounded-2xl px-4 py-3 border border-rose-100 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-600">
            <span>
              Sahifada ko'rsatish:
            </span>
            <select
              value={pageSize}
              onChange={(e) =>
                setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-neutral-50 font-bold text-neutral-900 outline-none cursor-pointer"
            >
              <option value={50}>50 ta</option>
              <option value={100}>100 ta</option>
              <option value={250}>250 ta</option>
              <option value="all">Barchasi ({filteredClients.length} ta)</option>
            </select>
            <span className="text-neutral-500 hidden sm:inline">
              • Jami {filteredClients.length} tadan {visibleClients.length} tasi ekranda
            </span>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40 font-semibold text-neutral-800 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Oldingi</span>
              </button>
              <span className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-mono font-bold">
                {safeCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40 font-semibold text-neutral-800 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Keyingi</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Client (Adminc & Adminc1 only) */}
      {clientToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100"
          onClick={() => setClientToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 font-display">
                  Mijozni o'chirishni tasdiqlaysizmi?
                </h3>
                <p className="text-xs text-rose-700 font-semibold">
                  Faqat {currentUsername || 'Admin'} vakolatida
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200/80 text-xs text-neutral-700 space-y-1.5">
              <div className="font-bold text-neutral-900 text-sm">
                {clientToDelete.name}
              </div>
              <div className="text-neutral-600">
                Telefon: <span className="font-mono font-semibold">{clientToDelete.phone || "Yo'q"}</span>
              </div>
              {clientToDelete.address && (
                <div className="text-neutral-600 truncate">
                  Manzil: {clientToDelete.address}
                </div>
              )}
              <div className="text-rose-800 font-semibold pt-1 border-t border-rose-200/60 leading-relaxed">
                Ushbu mijoz va unga oid barcha rejalar, qarzdorlik/haqdorlik yozuvlari hamda hisobotlar tizimdan to'liq o'chiriladi. Bu amalni qaytarib bo'lmaydi!
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition min-h-[42px] cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = clientToDelete.id;
                  setClientToDelete(null);
                  onDeleteClient(id);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 min-h-[42px] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ha, to'liq o'chirilsin</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
