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
  Edit3,
  TrendingUp,
  AlertTriangle,
  Eye,
  EyeOff,
  History,
} from 'lucide-react';
import { WarehouseProduct } from '../types';
import { formatWarehouseStock, calculateProfitMargin, formatNumber, formatMoney } from '../utils/format';
import { ProductDeliveryHistoryModal } from './ProductDeliveryHistoryModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: WarehouseProduct[];
  onEditProduct: (product: WarehouseProduct) => void;
  onDeleteProduct: (id: string) => void;
  onOpenIntakeModal: () => void;
}

export const WarehouseInventoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  products,
  onEditProduct,
  onDeleteProduct,
  onOpenIntakeModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<WarehouseProduct | null>(null);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<WarehouseProduct | null>(null);
  const [showAllPrices, setShowAllPrices] = useState(false);
  const [revealedPriceIds, setRevealedPriceIds] = useState<Record<string, boolean>>({});

  const toggleProductPriceVisibility = (id: string) => {
    setRevealedPriceIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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

          <div className="flex items-center gap-2.5 flex-wrap shrink-0 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setShowAllPrices((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold transition cursor-pointer shadow-2xs ${
                showAllPrices
                  ? 'bg-indigo-700 text-white border-indigo-700'
                  : 'bg-white hover:bg-indigo-50 text-indigo-900 border-indigo-200'
              }`}
              title={
                showAllPrices
                  ? 'Kirim va minimal sotilish narxlarini yashirish'
                  : "Kirim va minimal sotilish narxlarini ko'rsatish"
              }
            >
              {showAllPrices ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showAllPrices ? 'Narxlarni yashirish' : "Narxlarni ko'rish"}</span>
            </button>

            <div className="px-3 py-1.5 rounded-xl bg-white border border-neutral-200 shadow-2xs">
              <span className="text-neutral-500 mr-1.5">Jami dona:</span>
              <span className="text-neutral-900 font-bold">{totalInventoryPieces.toLocaleString()}</span>
            </div>
            {showAllPrices && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-2xs">
                <span className="text-emerald-700 mr-1.5">Jami qiymat:</span>
                <span className="font-bold font-mono">{totalInventorySum.toLocaleString()} USD</span>
              </div>
            )}
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
                      <div
                        className="flex items-center gap-2 flex-wrap cursor-pointer group"
                        onClick={() => setSelectedProductForHistory(p)}
                        title="Topshirish tarixini ko'rish uchun bosing"
                      >
                        <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 uppercase tracking-wider">
                          {p.brand}
                        </span>
                        <h4 className="text-base font-bold text-neutral-900 font-display group-hover:text-rose-700 transition flex items-center gap-1.5">
                          <span>{p.name}</span>
                          <History className="w-4 h-4 text-rose-600 opacity-70 group-hover:opacity-100 transition shrink-0" />
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

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                      {(() => {
                        const isPriceVisible = showAllPrices || Boolean(revealedPriceIds[p.id]);
                        return (
                          <>
                            <div className="text-right mr-1">
                              {isPriceVisible ? (
                                p.price > 0 ? (
                                  <div className="text-sm font-bold font-mono text-neutral-900">
                                    {p.totalSum.toLocaleString()} USD
                                  </div>
                                ) : (
                                  <div className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Narx belgilanmagan
                                  </div>
                                )
                              ) : null}
                              <div className="text-[11px] text-neutral-500 mt-0.5">
                                {p.intakeQuantity}{' '}
                                {p.intakeUnitType === 'package' ? p.packageUnitName : p.pieceUnitName}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleProductPriceVisibility(p.id)}
                              className={`flex items-center gap-1 px-2.5 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                                isPriceVisible
                                  ? 'bg-neutral-800 text-white border-neutral-800'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                              }`}
                              title="Kirim va eng kam sotilish narxini ko'rish / yashirish"
                            >
                              {isPriceVisible ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => setSelectedProductForHistory(p)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
                        title="Mahsulot topshirilish tarixini ko'rish"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Topshirilish tarixi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditProduct(p)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition cursor-pointer"
                        title="Mahsulotni tahrirlash"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Tahrirlash</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteProduct(p)}
                        className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Ombordan o'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Details grid with all dimensions & profit margin */}
                  {(() => {
                    const stockInfo = formatWarehouseStock(p);
                    const marginInfo = calculateProfitMargin(p);
                    const isPriceVisible = showAllPrices || Boolean(revealedPriceIds[p.id]);

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-3 text-xs">
                        {/* 1. Birlamchi o'lcham */}
                        <div>
                          <span className="text-neutral-500 block text-[11px]">Birlamchi o'lcham:</span>
                          <span className="font-semibold text-neutral-800">
                            1 ta {p.pieceUnitName} = {p.volumePerPiece} {p.baseUnit}
                          </span>
                        </div>

                        {/* 2. Katta o'lcham */}
                        <div>
                          <span className="text-neutral-500 block text-[11px]">Katta o'lcham:</span>
                          <span className="font-semibold text-neutral-800">
                            {p.packageUnitName
                              ? `1 ${p.packageUnitName} = ${p.piecesPerPackage} dona`
                              : "Donalab"}
                          </span>
                        </div>

                        {/* 3. Ombordagi qoldiq (Barcha o'lchamlarda: korobka va dona, hajm) */}
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-neutral-500 block text-[11px] font-bold">
                            Ombordagi qoldiq:
                          </span>
                          <span className="font-extrabold text-emerald-800 text-xs sm:text-sm block">
                            {stockInfo.primary}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-medium block">
                            {stockInfo.secondary}
                          </span>
                        </div>

                        {/* 4. Sotib olish (kirim) narxi */}
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-neutral-500 block text-[11px]">
                              Sotib olish (kirim):
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleProductPriceVisibility(p.id)}
                              className="text-neutral-400 hover:text-neutral-800 p-0.5 rounded cursor-pointer"
                              title="Ko'rish / Yashirish"
                            >
                              {isPriceVisible ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          {isPriceVisible ? (
                            p.price > 0 ? (
                              <div>
                                <span className="font-bold font-mono text-neutral-900">
                                  {p.price.toLocaleString()} USD
                                </span>
                                <span className="text-[10px] text-neutral-500 block">
                                  (1{' '}
                                  {p.pricingUnitType === 'package' && p.packageUnitName
                                    ? p.packageUnitName
                                    : p.pieceUnitName || 'dona'}
                                  )
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                                Narxsiz (o'tkazilgan)
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleProductPriceVisibility(p.id)}
                              className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-[11px] border border-neutral-200 cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-neutral-600" />
                              <span>Ko'rish</span>
                            </button>
                          )}
                        </div>

                        {/* 5. Eng kam sotilish narxi */}
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-indigo-700 font-semibold block text-[11px]">
                              Eng kam sotilish:
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleProductPriceVisibility(p.id)}
                              className="text-indigo-400 hover:text-indigo-800 p-0.5 rounded cursor-pointer"
                              title="Ko'rish / Yashirish"
                            >
                              {isPriceVisible ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          {isPriceVisible ? (
                            <>
                              <span className="font-bold font-mono text-indigo-900">
                                {(p.minSellingPrice !== undefined
                                  ? p.minSellingPrice
                                  : p.price || 0
                                ).toLocaleString()}{' '}
                                USD
                              </span>
                              <span className="text-[10px] text-neutral-500 block">
                                (1{' '}
                                {(p.minSellingPricingUnitType || p.pricingUnitType) === 'package' &&
                                p.packageUnitName
                                  ? p.packageUnitName
                                  : p.pieceUnitName || 'dona'}
                                )
                              </span>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleProductPriceVisibility(p.id)}
                              className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-[11px] border border-indigo-200 cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-indigo-700" />
                              <span>Ko'rish</span>
                            </button>
                          )}
                        </div>

                        {/* 6. Foyda marjasi */}
                        <div>
                          <span className="text-neutral-500 block text-[11px]">Foyda marjasi:</span>
                          {isPriceVisible ? (
                            marginInfo.hasCost ? (
                              <div className="mt-0.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-bold text-[10.5px] border ${
                                    marginInfo.marginPercent >= 0
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : 'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}
                                >
                                  <TrendingUp className="w-3 h-3" />
                                  <span>
                                    {marginInfo.marginPercent >= 0 ? `+` : ``}
                                    {marginInfo.marginPercent.toFixed(1)}%
                                  </span>
                                </span>
                                <span className="text-[10px] font-mono text-emerald-800 block mt-0.5">
                                  {marginInfo.profitPerPiece >= 0 ? `+` : ``}
                                  {marginInfo.profitPerPiece.toFixed(2)} USD/dona
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10.5px] text-neutral-400 italic">
                                Tannarxsiz
                              </span>
                            )
                          ) : (
                            <span className="text-[11px] text-neutral-400 font-mono">•••</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

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

        {/* Tasdiqlash modali: Mahsulotni ombordan o'chirish */}
        {confirmDeleteProduct && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
              <div className="flex items-center gap-3 text-rose-700">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-200 shrink-0">
                  <Trash2 className="w-6 h-6 text-rose-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-display text-neutral-900">
                    Mahsulotni o'chirish
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Ombor zaxirasi va butun tizimdan o'chirish
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-950 space-y-2">
                <p className="font-semibold text-neutral-900 text-sm">
                  Ushbu mahsulotni ombordan o'chirib yuborishga ishonchingiz komilmi?
                </p>
                <div className="p-2.5 rounded-xl bg-white border border-rose-200/80 space-y-1">
                  <div className="font-bold text-neutral-900">
                    {confirmDeleteProduct.brand} — {confirmDeleteProduct.name}
                  </div>
                  <div className="text-neutral-600 flex items-center gap-2">
                    <span>Ombor qoldig'i:</span>
                    <strong className="text-emerald-800 font-mono">
                      {confirmDeleteProduct.totalPieces.toLocaleString()} dona
                    </strong>
                    {confirmDeleteProduct.packageUnitName && (confirmDeleteProduct.piecesPerPackage || 1) > 1 && (
                      <span className="text-neutral-500">
                        ({Math.floor(confirmDeleteProduct.totalPieces / (confirmDeleteProduct.piecesPerPackage || 1))} {confirmDeleteProduct.packageUnitName})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-rose-800 font-bold pt-1">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Ushbu amal qaytarilmaydi va mahsulot butun bazadan to'liq o'chiriladi.</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteProduct(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 min-h-[42px] cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = confirmDeleteProduct.id;
                    setConfirmDeleteProduct(null);
                    onDeleteProduct(id);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs min-h-[42px] flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ha, o'chirilsin</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Topshirilish tarixi modali */}
        <ProductDeliveryHistoryModal
          isOpen={Boolean(selectedProductForHistory)}
          onClose={() => setSelectedProductForHistory(null)}
          product={selectedProductForHistory}
        />
      </div>
    </div>
  );
};
