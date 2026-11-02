import React, { useState, useMemo } from 'react';
import { Client, DailyPlanItem, PlanActionType } from '../types';
import { formatMoney, formatDate, formatShortDate } from '../utils/format';
import { parseLegacyAddress } from '../utils/location';
import {
  X,
  Search,
  Check,
  Calendar,
  CheckSquare,
  Square,
  MapPin,
  CreditCard,
  Package,
  FileText,
  RotateCcw,
  SlidersHorizontal,
  Clock,
  History,
  Lock,
  Phone,
  DollarSign,
} from 'lucide-react';

export interface PlanSelectionItem {
  clientId: string;
  plannedAction?: PlanActionType;
  plannedAmount?: number;
  planNote?: string;
}

interface SelectedClientDraft {
  plannedAction: PlanActionType;
  plannedAmount: number | '';
  planNote: string;
}

const PLANNED_ACTION_OPTIONS: { id: PlanActionType; label: string }[] = [
  { id: 'telefon qilindi', label: 'Telefon qilish' },
  { id: 'joyiga borildi', label: 'Joyiga borish' },
  { id: 'telefon qilindi + joyiga borildi', label: 'Telefon qilish va joyiga borish' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  existingPlans?: DailyPlanItem[];
  onConfirmPlan: (selections: PlanSelectionItem[]) => void;
}

type DebtFilterType = 'all' | 'debtors' | 'no_debt';
type AdvanceFilterType = 'all' | 'creditors' | 'no_advance';

export const CreateDailyPlanModal: React.FC<Props> = ({
  isOpen,
  onClose,
  clients,
  existingPlans = [],
  onConfirmPlan,
}) => {
  // Search & Filter States
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [debtFilter, setDebtFilter] = useState<DebtFilterType>('all');
  const [advanceFilter, setAdvanceFilter] = useState<AdvanceFilterType>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(false);

  // Selected Clients and their respective plannedAction, plannedAmount, and planNote
  const [selectedClientsMap, setSelectedClientsMap] = useState<Record<string, SelectedClientDraft>>(
    {}
  );

  // Extract unique regions
  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      const reg = c.region?.trim() || parseLegacyAddress(c.address).region;
      if (reg) set.add(reg);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [clients]);

  // Extract unique districts (if region selected, only for that region)
  const uniqueDistricts = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      const reg = c.region?.trim() || parseLegacyAddress(c.address).region;
      const dist = c.district?.trim() || parseLegacyAddress(c.address).district;
      if (dist) {
        if (selectedRegion === 'all' || reg.toLowerCase() === selectedRegion.toLowerCase()) {
          set.add(dist);
        }
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [clients, selectedRegion]);

  // Extract unique product names
  const uniqueProducts = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      c.products.forEach((p) => {
        const pName = p.name?.trim();
        if (pName) set.add(pName);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [clients]);

  // Filter clients based on search, region, district, debt, advance, products
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // 1. Text search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone.toLowerCase().includes(q);
        const matchesAddress = (c.address || '').toLowerCase().includes(q);
        const matchesRegion = (c.region || '').toLowerCase().includes(q);
        const matchesDistrict = (c.district || '').toLowerCase().includes(q);
        const matchesLandmark = (c.landmark || '').toLowerCase().includes(q);
        const matchesProduct = c.products.some((p) => p.name.toLowerCase().includes(q));
        if (
          !matchesName &&
          !matchesPhone &&
          !matchesAddress &&
          !matchesRegion &&
          !matchesDistrict &&
          !matchesLandmark &&
          !matchesProduct
        ) {
          return false;
        }
      }

      // 2. Viloyat yoki shahar bo'yicha filtr
      if (selectedRegion !== 'all') {
        const targetReg = selectedRegion.toLowerCase();
        const clientReg = (c.region || parseLegacyAddress(c.address).region).toLowerCase();
        if (clientReg !== targetReg && !(c.address || '').toLowerCase().includes(targetReg)) {
          return false;
        }
      }

      // 3. Tuman bo'yicha filtr
      if (selectedDistrict !== 'all') {
        const targetDist = selectedDistrict.toLowerCase();
        const clientDist = (c.district || parseLegacyAddress(c.address).district).toLowerCase();
        if (clientDist !== targetDist && !(c.address || '').toLowerCase().includes(targetDist)) {
          return false;
        }
      }

      // 4. Qarzdorlik (Debt) filter
      if (debtFilter === 'debtors' && c.currentDebt <= 0) return false;
      if (debtFilter === 'no_debt' && c.currentDebt > 0) return false;

      // 5. Haqdorlik (Advance) filter
      if (advanceFilter === 'creditors' && c.currentAdvance <= 0) return false;
      if (advanceFilter === 'no_advance' && c.currentAdvance > 0) return false;

      // 6. Mahsulotlar (Product) filter
      if (selectedProduct !== 'all') {
        const hasProd = c.products.some(
          (p) => p.name.toLowerCase() === selectedProduct.toLowerCase()
        );
        if (!hasProd) return false;
      }

      return true;
    });
  }, [clients, search, selectedRegion, selectedDistrict, debtFilter, advanceFilter, selectedProduct]);

  // Active filters counter hook - MUST be called unconditionally before any early returns
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedRegion !== 'all') count++;
    if (selectedDistrict !== 'all') count++;
    if (debtFilter !== 'all') count++;
    if (advanceFilter !== 'all') count++;
    if (selectedProduct !== 'all') count++;
    return count;
  }, [selectedRegion, selectedDistrict, debtFilter, advanceFilter, selectedProduct]);

  // Allaqachon rejada bor bo'lgan mijozlar ID lari (faqat 1 marta tanlash mumkin)
  const alreadyPlannedClientIds = useMemo(() => {
    return new Set(existingPlans.map((p) => p.clientId));
  }, [existingPlans]);

  // Safe early exit AFTER all hooks have executed
  if (!isOpen) return null;

  const isFilterActive = search.trim() !== '' || activeFiltersCount > 0;

  const resetAllFilters = () => {
    setSearch('');
    setSelectedRegion('all');
    setSelectedDistrict('all');
    setDebtFilter('all');
    setAdvanceFilter('all');
    setSelectedProduct('all');
  };

  const selectedCount = Object.keys(selectedClientsMap).length;

  const toggleSelect = (id: string) => {
    if (alreadyPlannedClientIds.has(id)) return;
    const clientObj = clients.find((c) => c.id === id);
    setSelectedClientsMap((prev) => {
      const copy = { ...prev };
      if (id in copy) {
        delete copy[id];
      } else {
        copy[id] = {
          plannedAction: 'joyiga borildi',
          plannedAmount: clientObj && clientObj.currentDebt > 0 ? clientObj.currentDebt : '',
          planNote: '',
        };
      }
      return copy;
    });
  };

  const selectAllFiltered = () => {
    setSelectedClientsMap((prev) => {
      const copy = { ...prev };
      filteredClients.forEach((c) => {
        if (!alreadyPlannedClientIds.has(c.id) && !(c.id in copy)) {
          copy[c.id] = {
            plannedAction: 'joyiga borildi',
            plannedAmount: c.currentDebt > 0 ? c.currentDebt : '',
            planNote: '',
          };
        }
      });
      return copy;
    });
  };

  const clearAllSelected = () => {
    setSelectedClientsMap({});
  };

  const handleUpdateAction = (id: string, plannedAction: PlanActionType) => {
    setSelectedClientsMap((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { plannedAction: 'joyiga borildi', plannedAmount: '', planNote: '' }),
        plannedAction,
      },
    }));
  };

  const handleUpdateAmount = (id: string, val: string) => {
    const parsed = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setSelectedClientsMap((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { plannedAction: 'joyiga borildi', plannedAmount: '', planNote: '' }),
        plannedAmount: parsed,
      },
    }));
  };

  const handleUpdateNote = (id: string, note: string) => {
    setSelectedClientsMap((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { plannedAction: 'joyiga borildi', plannedAmount: '', planNote: '' }),
        planNote: note,
      },
    }));
  };

  const handleConfirm = () => {
    const entries = Object.entries(selectedClientsMap);
    if (entries.length === 0) return;

    const payload: PlanSelectionItem[] = entries.map(([clientId, draft]) => ({
      clientId,
      plannedAction: draft.plannedAction,
      plannedAmount:
        typeof draft.plannedAmount === 'number' && draft.plannedAmount > 0
          ? draft.plannedAmount
          : undefined,
      planNote: draft.planNote.trim() || undefined,
    }));

    onConfirmPlan(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-rose-100 my-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/50 border-b border-rose-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 leading-tight">
                Reja tuzish
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px] cursor-pointer"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="p-3 sm:p-4 border-b border-neutral-100 space-y-2.5 bg-neutral-50/80 shrink-0">
          {/* Main Search Input & Filter Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Mijoz ismi, telefon, manzil yoki tovar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-200 text-xs sm:text-sm text-neutral-900 outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Toggle Button: Always visible with text & active badge */}
            <button
              type="button"
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition min-h-[40px] cursor-pointer shrink-0 shadow-xs ${
                showFiltersPanel
                  ? 'bg-rose-700 border-rose-700 text-white'
                  : activeFiltersCount > 0
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <SlidersHorizontal className={`w-3.5 h-3.5 ${showFiltersPanel ? 'text-white' : 'text-rose-700'}`} />
              <span>Filtrlar</span>
              {activeFiltersCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    showFiltersPanel ? 'bg-white text-rose-800' : 'bg-rose-700 text-white'
                  }`}
                >
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Quick Active Filter Chips: lets user see/remove applied filters without opening the panel */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
              <span className="text-neutral-500 font-medium mr-0.5">Filtrlar:</span>

              {selectedRegion !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 font-medium">
                  <span>Viloyat: {selectedRegion}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRegion('all');
                      setSelectedDistrict('all');
                    }}
                    className="hover:text-rose-950 font-bold ml-0.5 cursor-pointer"
                    title="Olib tashlash"
                  >
                    ✕
                  </button>
                </span>
              )}

              {selectedDistrict !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 font-medium">
                  <span>Tuman: {selectedDistrict}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDistrict('all')}
                    className="hover:text-rose-950 font-bold ml-0.5 cursor-pointer"
                    title="Olib tashlash"
                  >
                    ✕
                  </button>
                </span>
              )}

              {debtFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 font-medium">
                  <span>{debtFilter === 'debtors' ? 'Qarzdorlar' : "Qarzi yo'qlar"}</span>
                  <button
                    type="button"
                    onClick={() => setDebtFilter('all')}
                    className="hover:text-rose-950 font-bold ml-0.5 cursor-pointer"
                    title="Olib tashlash"
                  >
                    ✕
                  </button>
                </span>
              )}

              {advanceFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-200 font-medium">
                  <span>{advanceFilter === 'creditors' ? 'Haqdorlar' : "Haqdorligi yo'qlar"}</span>
                  <button
                    type="button"
                    onClick={() => setAdvanceFilter('all')}
                    className="hover:text-emerald-950 font-bold ml-0.5 cursor-pointer"
                    title="Olib tashlash"
                  >
                    ✕
                  </button>
                </span>
              )}

              {selectedProduct !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 font-medium">
                  <span>Tovar: {selectedProduct}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct('all')}
                    className="hover:text-rose-950 font-bold ml-0.5 cursor-pointer"
                    title="Olib tashlash"
                  >
                    ✕
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={resetAllFilters}
                className="text-neutral-500 hover:text-rose-700 underline text-[10px] ml-1 font-semibold cursor-pointer"
              >
                Barchasini tozalash
              </button>
            </div>
          )}

          {/* Collapsible Filter Panel: Compact, max-height limited, doesn't block clients */}
          {showFiltersPanel && (
            <div className="p-3 bg-white rounded-2xl border border-rose-200 shadow-sm space-y-2.5 text-xs animate-in fade-in duration-150 max-h-52 sm:max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-100">
                <span className="font-bold text-neutral-900 text-[11px] flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3 text-rose-700" />
                  <span>Filtr parametrlarini tanlang</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowFiltersPanel(false)}
                  className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3 h-3 text-rose-700" />
                  <span>Yopish va Mijozlarni ko'rish</span>
                </button>
              </div>

              {/* Responsive 2-col on mobile, 5-col on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {/* 1. Viloyat yoki shahar */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-0.5 flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-rose-600" />
                    <span>Viloyat / Shahar</span>
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => {
                      setSelectedRegion(e.target.value);
                      setSelectedDistrict('all');
                    }}
                    className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 text-xs font-medium outline-none focus:border-rose-400"
                  >
                    <option value="all">Barchasi</option>
                    {uniqueRegions.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Tuman */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-0.5 flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-neutral-500" />
                    <span>Tuman</span>
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 text-xs font-medium outline-none focus:border-rose-400"
                  >
                    <option value="all">Barchasi</option>
                    {uniqueDistricts.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Qarzdorlik (Debt) */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-0.5 flex items-center gap-1">
                    <CreditCard className="w-2.5 h-2.5 text-rose-600" />
                    <span>Qarzdorlik</span>
                  </label>
                  <select
                    value={debtFilter}
                    onChange={(e) => setDebtFilter(e.target.value as DebtFilterType)}
                    className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 text-xs font-medium outline-none focus:border-rose-400"
                  >
                    <option value="all">Barchasi</option>
                    <option value="debtors">Faqat qarzdorlar</option>
                    <option value="no_debt">Qarzi yo'qlar</option>
                  </select>
                </div>

                {/* 4. Haqdorlik (Advance) */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-0.5 flex items-center gap-1">
                    <CreditCard className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Haqdorlik</span>
                  </label>
                  <select
                    value={advanceFilter}
                    onChange={(e) => setAdvanceFilter(e.target.value as AdvanceFilterType)}
                    className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 text-xs font-medium outline-none focus:border-rose-400"
                  >
                    <option value="all">Barchasi</option>
                    <option value="creditors">Faqat haqdorlar</option>
                    <option value="no_advance">Haqdorligi yo'qlar</option>
                  </select>
                </div>

                {/* 5. Mahsulotlar (Product) */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-neutral-700 mb-0.5 flex items-center gap-1">
                    <Package className="w-2.5 h-2.5 text-rose-600" />
                    <span>Mahsulot turi</span>
                  </label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 text-xs font-medium outline-none focus:border-rose-400"
                  >
                    <option value="all">Barcha mahsulotlar</option>
                    {uniqueProducts.map((pName) => (
                      <option key={pName} value={pName}>
                        {pName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status and Action Buttons inside panel */}
              <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100 text-[11px]">
                <span className="text-neutral-500 font-medium">
                  Natija: <strong className="text-neutral-900">{filteredClients.length}</strong> ta mijoz
                </span>
                <div className="flex items-center gap-2">
                  {isFilterActive && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="flex items-center gap-1 text-rose-700 hover:text-rose-900 font-bold transition cursor-pointer text-[10px]"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Tozalash</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowFiltersPanel(false)}
                    className="px-2.5 py-1 rounded-lg bg-rose-700 text-white font-bold text-[11px] cursor-pointer shadow-xs"
                  >
                    Mijozlarni ko'rish
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Selection and Counter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={selectAllFiltered}
                disabled={filteredClients.length === 0}
                className="px-2.5 py-1.5 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Topilganlarni belgilash ({filteredClients.length})
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllSelected}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-600 text-xs cursor-pointer shadow-2xs"
                >
                  Bekor qilish
                </button>
              )}
            </div>

            <div className="font-bold text-rose-900 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200 text-xs shrink-0">
              Tanlandi: {selectedCount} ta mijoz
            </div>
          </div>
        </div>

        {/* Client Selection List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
          {filteredClients.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
              <Package className="w-8 h-8 text-neutral-400 mx-auto" />
              <div className="text-xs font-bold text-neutral-800">
                Tanlangan filtrlar bo'yicha mijozlar topilmadi
              </div>
              <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                Joylashuv, qarzdorlik yoki mahsulot filtrlarini o'zgartirib ko'ring yoki tozalang.
              </p>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer"
                >
                  Filtrlarni tozalash
                </button>
              )}
            </div>
          ) : (
            filteredClients.map((client) => {
              const isAlreadyInPlan = alreadyPlannedClientIds.has(client.id);
              const isSelected = !isAlreadyInPlan && client.id in selectedClientsMap;
              const currentDraft = selectedClientsMap[client.id] || {
                plannedAction: 'joyiga borildi' as PlanActionType,
                plannedAmount: '',
                planNote: '',
              };

              return (
                <div
                  key={client.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isAlreadyInPlan
                      ? 'bg-neutral-50 border-neutral-200 opacity-80'
                      : isSelected
                      ? 'bg-rose-50/70 border-rose-300 shadow-xs ring-1 ring-rose-200'
                      : 'bg-white border-neutral-200 hover:border-rose-200'
                  }`}
                >
                  <div
                    onClick={() => {
                      if (!isAlreadyInPlan) toggleSelect(client.id);
                    }}
                    className={`flex items-start justify-between gap-3 ${
                      isAlreadyInPlan ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-rose-700 mt-0.5 shrink-0">
                        {isAlreadyInPlan ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </span>
                        ) : isSelected ? (
                          <CheckSquare className="w-5 h-5 fill-rose-100" />
                        ) : (
                          <Square className="w-5 h-5 text-neutral-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-neutral-900 flex items-center gap-2 flex-wrap">
                          <span>{client.name}</span>
                          {isAlreadyInPlan && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Rejada bor (1 marta tanlangan)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-600 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="font-mono font-medium">{client.phone}</span>
                          {([client.region, client.district].filter(Boolean).join(', ') || client.address) && (
                            <>
                              <span aria-hidden="true" className="text-neutral-300">·</span>
                              <span className="flex items-center gap-0.5 text-neutral-700">
                                <MapPin className="w-3 h-3 text-rose-600 shrink-0" />
                                <span className="truncate max-w-[220px]">
                                  {[client.region, client.district].filter(Boolean).join(', ') || client.address}
                                  {client.landmark ? ` (${client.landmark})` : ''}
                                </span>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Oxirgi reja yopilish sababi */}
                        {client.lastPlanCloseReason && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-rose-900 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                            <Lock className="w-2.5 h-2.5 text-rose-700 shrink-0" />
                            <span className="truncate">
                              Oxirgi reja yopilgan: "{client.lastPlanCloseReason}"
                            </span>
                          </div>
                        )}

                        {/* Given Products with Delivery Dates */}
                        {client.products && client.products.length > 0 ? (
                          <div className="mt-2 p-2 rounded-xl bg-neutral-50 border border-neutral-200/80 text-[11px] space-y-1">
                            <div className="flex items-center justify-between text-neutral-600 font-semibold text-[10px]">
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3 text-rose-700" />
                                <span>Berilgan mahsulotlar ({client.products.length} ta):</span>
                              </span>
                              <span className="text-neutral-500 font-normal">
                                Berilgan sana: {formatShortDate(client.updatedAt || client.createdAt)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {client.products.map((p) => (
                                <span
                                  key={p.id}
                                  className="px-2 py-0.5 bg-white border border-neutral-200 text-neutral-800 rounded-md text-[10px] font-medium"
                                >
                                  <strong>{p.name}</strong>: {p.quantity} {p.unit}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-neutral-400 italic">
                            Hozircha berilgan mahsulotlar yo'q
                          </div>
                        )}

                        {/* Oxirgi qilingan amal haqida ma'lumot */}
                        {(() => {
                          const lastLog = client.logs && client.logs.length > 0 ? client.logs[0] : null;
                          if (!lastLog) {
                            return (
                              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-neutral-400">
                                <Clock className="w-3 h-3 text-neutral-400" />
                                <span>Oxirgi amal: Hali amal bajarilmagan (yangi mijoz)</span>
                              </div>
                            );
                          }
                          return (
                            <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-neutral-700 bg-rose-50/50 p-2 rounded-xl border border-rose-100/90">
                              <History className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className="font-bold text-neutral-900 text-[11px]">
                                    Oxirgi amal: {lastLog.title}
                                  </span>
                                  <span className="text-[10px] text-neutral-500 font-mono">
                                    {formatDate(lastLog.timestamp)} ({lastLog.author})
                                  </span>
                                </div>
                                {lastLog.details && (
                                  <div className="text-[10px] text-neutral-600 line-clamp-1 mt-0.5">
                                    {lastLog.details}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {client.currentDebt > 0 && (
                        <div className="text-xs font-mono font-bold text-rose-800">
                          Qarz: {formatMoney(client.currentDebt)}
                        </div>
                      )}
                      {client.currentAdvance > 0 && (
                        <div className="text-xs font-mono font-bold text-emerald-800">
                          Avans: {formatMoney(client.currentAdvance)}
                        </div>
                      )}
                      <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">
                        Qo'shgan: {client.createdBy || 'adminc'}
                      </span>
                    </div>
                  </div>

                  {/* Planned Action, Planned Collection Amount & Note for Selected Client */}
                  {isSelected && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 pt-3 border-t border-rose-200/80 space-y-2.5 animate-in fade-in duration-100"
                    >
                      {/* 1. Amal turini avval tanlash */}
                      <div>
                        <label className="block text-[11px] font-bold text-rose-950 mb-1.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-rose-700" />
                          <span>1. Rejadagi amal turini tanlang: *</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          {PLANNED_ACTION_OPTIONS.map((opt) => {
                            const active = currentDraft.plannedAction === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleUpdateAction(client.id, opt.id)}
                                className={`px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                  active
                                    ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                                    : 'bg-white text-neutral-700 border-rose-200 hover:bg-rose-100/50'
                                }`}
                              >
                                {active && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                                <span>{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Undirish rejadagi summa (USD) va 3. Izoh */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-rose-950 flex items-center gap-1">
                              <DollarSign className="w-3 h-3 text-rose-700" />
                              <span>2. Undirish rejadagi summa (USD):</span>
                            </label>
                            {client.currentDebt > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateAmount(client.id, String(client.currentDebt))
                                }
                                className="text-[10px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                              >
                                Joriy qarz ({formatMoney(client.currentDebt)})
                              </button>
                            )}
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Masalan: 500 USD"
                            value={currentDraft.plannedAmount}
                            onChange={(e) => handleUpdateAmount(client.id, e.target.value)}
                            className="w-full px-3 py-1.5 bg-white rounded-lg border border-rose-200 text-xs font-mono font-bold text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-rose-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-rose-950 mb-1 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-rose-700" />
                            <span>3. Reja izohi (ixtiyoriy):</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ushbu mijoz bo'yicha izoh..."
                            value={currentDraft.planNote}
                            onChange={(e) => handleUpdateNote(client.id, e.target.value)}
                            className="w-full px-3 py-1.5 bg-white rounded-lg border border-rose-200 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-rose-500 font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-neutral-500 text-center sm:text-left">
            Tanlangan mijozlar bugungi kunlik reja ro'yxatiga kiritiladi.
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-white transition min-h-[44px] cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="px-6 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Tayyor ({selectedCount} ta mijoz)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
