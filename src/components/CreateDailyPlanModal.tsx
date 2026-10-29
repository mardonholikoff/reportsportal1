import React, { useState, useMemo } from 'react';
import { Client } from '../types';
import { formatMoney } from '../utils/format';
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
} from 'lucide-react';

export interface PlanSelectionItem {
  clientId: string;
  planNote?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onConfirmPlan: (selections: PlanSelectionItem[]) => void;
}

type DebtFilterType = 'all' | 'debtors' | 'no_debt';
type AdvanceFilterType = 'all' | 'creditors' | 'no_advance';

export const CreateDailyPlanModal: React.FC<Props> = ({
  isOpen,
  onClose,
  clients,
  onConfirmPlan,
}) => {
  // Search & Filter States
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [debtFilter, setDebtFilter] = useState<DebtFilterType>('all');
  const [advanceFilter, setAdvanceFilter] = useState<AdvanceFilterType>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(true);

  // Selected Clients and their respective notes: { [clientId]: note }
  const [selectedClientsMap, setSelectedClientsMap] = useState<Record<string, string>>({});

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

  if (!isOpen) return null;

  const isFilterActive =
    search.trim() !== '' ||
    selectedRegion !== 'all' ||
    selectedDistrict !== 'all' ||
    debtFilter !== 'all' ||
    advanceFilter !== 'all' ||
    selectedProduct !== 'all';

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
    setSelectedClientsMap((prev) => {
      const copy = { ...prev };
      if (id in copy) {
        delete copy[id];
      } else {
        copy[id] = '';
      }
      return copy;
    });
  };

  const selectAllFiltered = () => {
    setSelectedClientsMap((prev) => {
      const copy = { ...prev };
      filteredClients.forEach((c) => {
        if (!(c.id in copy)) {
          copy[c.id] = '';
        }
      });
      return copy;
    });
  };

  const clearAllSelected = () => {
    setSelectedClientsMap({});
  };

  const handleUpdateNote = (id: string, note: string) => {
    setSelectedClientsMap((prev) => ({
      ...prev,
      [id]: note,
    }));
  };

  const handleConfirm = () => {
    const entries = Object.entries(selectedClientsMap);
    if (entries.length === 0) return;

    const payload: PlanSelectionItem[] = entries.map(([clientId, planNote]) => ({
      clientId,
      planNote: planNote.trim() || undefined,
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
            <div className="w-10 h-10 rounded-2xl bg-rose-700 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900">
                  Bugungi kunlik reja tuzish
                </h2>
                <span className="text-[11px] font-bold text-rose-800 bg-rose-100/70 px-2 py-0.5 rounded-md">
                  24 soatlik
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Joylashuv, qarz, haqdorlik va mahsulotlar bo'yicha saralab reja tuzing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="p-4 sm:p-5 border-b border-neutral-100 space-y-3 bg-neutral-50/80 shrink-0">
          {/* Main Search Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Mijoz ismi, telefon, manzil yoki tovar bo'yicha tezkor qidirish..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-200 text-xs sm:text-sm text-neutral-900 outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-neutral-400 hover:text-neutral-700"
                >
                  Tozalash
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition min-h-[42px] cursor-pointer ${
                showFiltersPanel
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-rose-700" />
              <span className="hidden sm:inline">Filtrlar</span>
            </button>
          </div>

          {/* Expanded Multi-dimensional Filters */}
          {showFiltersPanel && (
            <div className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-xs space-y-3 text-xs animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {/* 1. Viloyat yoki shahar */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-600" />
                    <span>Viloyat / Shahar</span>
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => {
                      setSelectedRegion(e.target.value);
                      setSelectedDistrict('all');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 font-medium outline-none focus:border-rose-400"
                  >
                    <option value="all">Barcha viloyatlar</option>
                    {uniqueRegions.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Tuman */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-neutral-500" />
                    <span>Tuman</span>
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 font-medium outline-none focus:border-rose-400"
                  >
                    <option value="all">Barcha tumanlar</option>
                    {uniqueDistricts.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Qarzdorlik (Debt) */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-rose-600" />
                    <span>Qarzdorlik</span>
                  </label>
                  <select
                    value={debtFilter}
                    onChange={(e) => setDebtFilter(e.target.value as DebtFilterType)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 font-medium outline-none focus:border-rose-400"
                  >
                    <option value="all">Barchasi</option>
                    <option value="debtors">Faqat qarzdorlar</option>
                    <option value="no_debt">Qarzi yo'qlar</option>
                  </select>
                </div>

                {/* 4. Haqdorlik (Advance) */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-emerald-600" />
                    <span>Haqdorlik</span>
                  </label>
                  <select
                    value={advanceFilter}
                    onChange={(e) => setAdvanceFilter(e.target.value as AdvanceFilterType)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 font-medium outline-none focus:border-rose-400"
                  >
                    <option value="all">Barchasi</option>
                    <option value="creditors">Faqat haqdorlar</option>
                    <option value="no_advance">Haqdorligi yo'qlar</option>
                  </select>
                </div>

                {/* 5. Mahsulotlar (Product) */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                    <Package className="w-3 h-3 text-rose-600" />
                    <span>Mahsulot turi</span>
                  </label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 font-medium outline-none focus:border-rose-400"
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

              {/* Active filters status & clear */}
              {isFilterActive && (
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[11px]">
                  <span className="text-neutral-500 font-medium">
                    Filtr natijasi: <strong className="text-neutral-900">{filteredClients.length}</strong> ta mijoz mos keldi
                  </span>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="flex items-center gap-1 text-rose-700 hover:text-rose-900 font-bold transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Filtrlarni tozalash</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bulk Selection and Counter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllFiltered}
                disabled={filteredClients.length === 0}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 font-semibold disabled:opacity-40 cursor-pointer"
              >
                Topilganlarni belgilash ({filteredClients.length})
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllSelected}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-600 cursor-pointer"
                >
                  Tanlovni bekor qilish
                </button>
              )}
            </div>

            <div className="font-bold text-rose-900 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200 text-xs">
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
              const isSelected = client.id in selectedClientsMap;
              const currentNote = selectedClientsMap[client.id] || '';

              return (
                <div
                  key={client.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-rose-50/70 border-rose-300 shadow-xs ring-1 ring-rose-200'
                      : 'bg-white border-neutral-200 hover:border-rose-200'
                  }`}
                >
                  <div
                    onClick={() => toggleSelect(client.id)}
                    className="flex items-start justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-rose-700 mt-0.5 shrink-0">
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 fill-rose-100" />
                        ) : (
                          <Square className="w-5 h-5 text-neutral-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-neutral-900">
                          {client.name}
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

                        {/* Given Products badges preview */}
                        {client.products && client.products.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {client.products.slice(0, 3).map((p) => (
                              <span
                                key={p.id}
                                className="px-1.5 py-0.5 bg-neutral-100 text-neutral-700 rounded text-[10px] font-medium"
                              >
                                {p.name}: {p.quantity} {p.unit}
                              </span>
                            ))}
                            {client.products.length > 3 && (
                              <span className="text-[10px] text-neutral-400">
                                +{client.products.length - 3} ta
                              </span>
                            )}
                          </div>
                        )}
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

                  {/* Note / Izoh Input for this Selected Client */}
                  {isSelected && (
                    <div className="mt-2.5 pt-2 border-t border-rose-200/60 flex items-center gap-2 animate-in fade-in duration-100">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-rose-900 shrink-0">
                        <FileText className="w-3.5 h-3.5 text-rose-700" />
                        <span>Reja izohi:</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Ushbu mijoz bo'yicha izoh (masalan: qarzni undirish, 10 qop sement yetkazish...)"
                        value={currentNote}
                        onChange={(e) => handleUpdateNote(client.id, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white rounded-lg border border-rose-200 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-rose-500 font-medium"
                      />
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
            Rejaga kiritilgan mijozlar 24 soat davomida ro'yxatda faol turadi.
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
