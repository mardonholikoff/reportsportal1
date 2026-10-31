import React, { useState, useMemo } from 'react';
import {
  X,
  Warehouse,
  Search,
  Package,
  Calendar,
  Layers,
  Scale,
  DollarSign,
  Trash2,
  PackagePlus,
} from 'lucide-react';
import { WarehouseProduct } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: WarehouseProduct[];
  onDeleteProduct: (id: string) => void;
  onOpenIntakeModal: () => void;
}

export const WarehouseInventoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  products,
  onDeleteProduct,
  onOpenIntakeModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.mark1.toLowerCase().includes(q) ||
        (p.mark2 && p.mark2.toLowerCase().includes(q));

      const matchesBrand = selectedBrand === 'all' || p.brand === selectedBrand;
      return matchesSearch && matchesBrand;
    });
  }, [products, searchQuery, selectedBrand]);

  const totalInventorySum = useMemo(() => {
    return filteredProducts.reduce((acc, p) => acc + (p.totalSum || 0), 0);
  }, [filteredProducts]);

  const totalInventoryPieces = useMemo(() => {
    return filteredProducts.reduce((acc, p) => acc + (p.totalPieces || 0), 0);
  }, [filteredProducts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-rose-100 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 shadow-xs">
              <Warehouse className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white flex items-center gap-2">
                <span>Ombordagi mahsulotlar zaxirasi</span>
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-mono">
                  {products.length} ta
                </span>
              </h2>
              <p className="text-xs text-neutral-300">
                Omborga kiritilgan barcha mahsulotlar va ularning hisob-kitoblari
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenIntakeModal();
              }}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>Yangi kirim</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter and KPI bar */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mahsulot nomi yoki brend bo'yicha qidirish..."
                className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-neutral-300 text-xs sm:text-sm focus:outline-neutral-800"
              />
            </div>

            {uniqueBrands.length > 0 && (
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="px-3 py-2 bg-white rounded-xl border border-neutral-300 text-xs font-medium focus:outline-neutral-800"
              >
                <option value="all">Barcha brendlar ({uniqueBrands.length})</option>
                {uniqueBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 text-xs font-semibold">
            <div className="px-3 py-1.5 rounded-xl bg-white border border-neutral-200 shadow-2xs">
              <span className="text-neutral-500 mr-1.5">Jami dona:</span>
              <span className="text-neutral-900 font-bold">{totalInventoryPieces.toLocaleString()}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-2xs">
              <span className="text-emerald-700 mr-1.5">Jami qiymat:</span>
              <span className="font-bold">{totalInventorySum.toLocaleString()} so'm</span>
            </div>
          </div>
        </div>

        {/* Content Table / Cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 space-y-3">
              <Package className="w-12 h-12 text-neutral-300 mx-auto" />
              <div className="text-sm font-semibold">Mahsulot topilmadi</div>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Omborga yangi mahsulot kiritish uchun "Yangi kirim" tugmasini bosing.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-neutral-200/90 p-4 shadow-2xs hover:border-neutral-300 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 uppercase tracking-wider">
                          {p.brand}
                        </span>
                        <h4 className="text-base font-bold text-neutral-900 font-display">
                          {p.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-xs text-neutral-600">
                        <span className="font-medium bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-800">
                          Marka 1: {p.mark1}
                        </span>
                        {p.mark2 && (
                          <span className="font-medium bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-800">
                            Marka 2: {p.mark2}
                          </span>
                        )}
                        {p.extraMarks &&
                          p.extraMarks.map((em, idx) => (
                            <span
                              key={idx}
                              className="font-medium bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-800"
                            >
                              {em}
                            </span>
                          ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <div className="text-right">
                        <div className="text-sm font-bold text-neutral-900">
                          {p.totalSum.toLocaleString()} {p.currency === 'UZS' ? "so'm" : '$'}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {p.intakeQuantity} {p.intakeUnitType === 'package' ? p.packageUnitName : p.pieceUnitName}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteProduct(p.id)}
                        className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                    <div>
                      <span className="text-neutral-500 block text-[11px]">Birlamchi o'lcham:</span>
                      <span className="font-semibold text-neutral-800">
                        1 ta {p.pieceUnitName} = {p.volumePerPiece} {p.baseUnit}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[11px]">Katta o'lcham:</span>
                      <span className="font-semibold text-neutral-800">
                        1 {p.packageUnitName} = {p.piecesPerPackage} dona
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[11px]">Ombordagi qoldiq:</span>
                      <span className="font-bold text-emerald-800">
                        {p.totalPieces.toLocaleString()} dona ({p.totalVolume.toLocaleString()} {p.baseUnit})
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[11px]">Kirim sanasi:</span>
                      <span className="font-mono text-neutral-700 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-400" />
                        {p.intakeDate}
                      </span>
                    </div>
                  </div>

                  {p.notes && (
                    <div className="mt-2.5 pt-2 border-t border-neutral-100 text-[11px] text-neutral-500 italic">
                      Izoh: {p.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-bold transition cursor-pointer"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
