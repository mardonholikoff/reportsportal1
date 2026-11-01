import React, { useState, useEffect, useMemo } from 'react';
import { Client, ProductItem, WarehouseProduct } from '../types';
import { formatMoney } from '../utils/format';
import { UZBEKISTAN_REGIONS, formatAddress, parseLegacyAddress } from '../utils/location';
import { storageService } from '../services/storage';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Package,
  Layers,
  DollarSign,
  HelpCircle,
  CreditCard,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  editingClient?: Client | null;
  currentUserUsername?: string;
}

export const ClientFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  editingClient,
  currentUserUsername,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [landmark, setLandmark] = useState('');
  const [currentAdvance, setCurrentAdvance] = useState<number | ''>(0);
  const [notes, setNotes] = useState('');

  // Warehouse products list
  const [warehouseProducts, setWarehouseProducts] = useState<WarehouseProduct[]>([]);

  // Products dynamic list
  const [products, setProducts] = useState<ProductItem[]>([
    {
      id: 'prod_' + Math.random().toString(36).substring(2, 7),
      name: '',
      unit: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      warehouseId: '',
    },
  ]);

  // Credit / Debt selection state in Block 2
  const [isGivenOnCredit, setIsGivenOnCredit] = useState<boolean>(true);
  const [creditDebtAmount, setCreditDebtAmount] = useState<number | ''>('');
  const [hasManuallyEditedDebt, setHasManuallyEditedDebt] = useState<boolean>(false);

  const [validationError, setValidationError] = useState<string | null>(null);

  // Load warehouse products on open
  useEffect(() => {
    if (isOpen) {
      const items = storageService.getWarehouseProducts();
      setWarehouseProducts(items);
    }
  }, [isOpen]);

  // Total products amount calculation
  const totalProductsSum = useMemo(() => {
    return products.reduce((sum, p) => {
      const val = p.totalPrice || (p.quantity || 0) * (p.unitPrice || 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [products]);

  // Effective debt calculated from 2-blok (must be at top before any early return)
  const effectiveDebt = useMemo(() => {
    if (!isGivenOnCredit) return 0;
    if (creditDebtAmount === '') return totalProductsSum;
    return Math.max(0, Number(creditDebtAmount) || 0);
  }, [isGivenOnCredit, creditDebtAmount, totalProductsSum]);

  // Auto-update debt amount when totalProductsSum changes if user hasn't explicitly set custom debt
  useEffect(() => {
    if (!editingClient && !hasManuallyEditedDebt) {
      if (isGivenOnCredit) {
        setCreditDebtAmount(totalProductsSum);
      } else {
        setCreditDebtAmount(0);
      }
    }
  }, [totalProductsSum, isGivenOnCredit, hasManuallyEditedDebt, editingClient]);

  // Load editing client if provided
  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name);
      setPhone(editingClient.phone || '+998 ');

      if (editingClient.region || editingClient.district) {
        setRegion(editingClient.region || '');
        setDistrict(editingClient.district || '');
        setLandmark(editingClient.landmark || '');
      } else if (editingClient.address) {
        const parsed = parseLegacyAddress(editingClient.address);
        setRegion(parsed.region);
        setDistrict(parsed.district);
        setLandmark(parsed.landmark);
      } else {
        setRegion('');
        setDistrict('');
        setLandmark('');
      }

      const initialDebt = editingClient.currentDebt || 0;
      setIsGivenOnCredit(initialDebt > 0);
      setCreditDebtAmount(initialDebt);
      setHasManuallyEditedDebt(true);

      setCurrentAdvance(editingClient.currentAdvance || 0);
      setNotes(editingClient.notes || '');

      if (editingClient.products && editingClient.products.length > 0) {
        setProducts(
          editingClient.products.map((p) => ({
            ...p,
            totalPrice: p.totalPrice || p.quantity * p.unitPrice,
          }))
        );
      } else {
        setProducts([
          {
            id: 'prod_' + Math.random().toString(36).substring(2, 7),
            name: '',
            unit: '',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            warehouseId: '',
          },
        ]);
      }
    } else {
      // Reset form
      setName('');
      setPhone('+998 ');
      setRegion('');
      setDistrict('');
      setLandmark('');
      setIsGivenOnCredit(true);
      setCreditDebtAmount('');
      setHasManuallyEditedDebt(false);
      setCurrentAdvance(0);
      setNotes('');
      setProducts([
        {
          id: 'prod_' + Math.random().toString(36).substring(2, 7),
          name: '',
          unit: '',
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
          warehouseId: '',
        },
      ]);
    }
    setValidationError(null);
  }, [editingClient, isOpen]);

  // Add new product row
  const handleAddProduct = () => {
    setProducts((prev) => [
      ...prev,
      {
        id: 'prod_' + Math.random().toString(36).substring(2, 7),
        name: '',
        unit: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        warehouseId: '',
      },
    ]);
  };

  // Remove product row
  const handleRemoveProduct = (index: number) => {
    if (products.length === 1) {
      setProducts([
        {
          id: 'prod_' + Math.random().toString(36).substring(2, 7),
          name: '',
          unit: '',
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
          warehouseId: '',
        },
      ]);
      return;
    }
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  // Select a warehouse product for row index
  const handleSelectWarehouseProduct = (index: number, warehouseId: string) => {
    const wh = warehouseProducts.find((p) => p.id === warehouseId);
    if (!wh) {
      // Reset this row
      setProducts((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          warehouseId: '',
          name: '',
          unit: '',
          unitPrice: 0,
          totalPrice: 0,
        };
        return updated;
      });
      return;
    }

    // Default to package unit, or piece unit
    const defaultUnit = wh.packageUnitName || wh.pieceUnitName || wh.baseUnit || 'dona';
    let unitPrice = wh.price;
    if (wh.pricingUnitType === 'piece' && defaultUnit === wh.packageUnitName) {
      unitPrice = wh.price * (wh.piecesPerPackage || 1);
    } else if (wh.pricingUnitType === 'package' && defaultUnit === wh.pieceUnitName) {
      unitPrice = Math.round(wh.price / (wh.piecesPerPackage || 1));
    }

    const marksStr = [wh.mark1, wh.mark2].filter(Boolean).join(', ');
    const formattedName = `${wh.brand} - ${wh.name}${marksStr ? ` (${marksStr})` : ''}`;

    setProducts((prev) => {
      const updated = [...prev];
      const qty = updated[index].quantity || 1;
      updated[index] = {
        ...updated[index],
        warehouseId: wh.id,
        name: formattedName,
        unit: defaultUnit,
        unitPrice,
        quantity: qty,
        totalPrice: Math.round(qty * unitPrice),
      };
      return updated;
    });
  };

  // Change unit between package and piece for warehouse product
  const handleUnitChange = (index: number, newUnit: string) => {
    const item = products[index];
    const wh = warehouseProducts.find((p) => p.id === item.warehouseId);

    let unitPrice = item.unitPrice;
    if (wh) {
      if (newUnit === wh.packageUnitName) {
        unitPrice =
          wh.pricingUnitType === 'package'
            ? wh.price
            : wh.price * (wh.piecesPerPackage || 1);
      } else if (newUnit === wh.pieceUnitName) {
        unitPrice =
          wh.pricingUnitType === 'piece'
            ? wh.price
            : Math.round(wh.price / (wh.piecesPerPackage || 1));
      } else {
        unitPrice = wh.price;
      }
    }

    setProducts((prev) => {
      const updated = [...prev];
      const qty = updated[index].quantity || 1;
      updated[index] = {
        ...updated[index],
        unit: newUnit,
        unitPrice,
        totalPrice: Math.round(qty * unitPrice),
      };
      return updated;
    });
  };

  // Update specific product field (quantity or price)
  const handleProductChange = (
    index: number,
    field: keyof ProductItem,
    value: any
  ) => {
    setProducts((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) || 0 : item.quantity;
        const price = field === 'unitPrice' ? Number(value) || 0 : item.unitPrice;
        item.totalPrice = Math.round(Math.max(0, qty * price));
      }

      updated[index] = item;
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient && (currentUserUsername === 'agentp1' || currentUserUsername === 'agentc1')) {
      setValidationError("Agentlar mijoz ma'lumotlarini tahrirlash huquqiga ega emas!");
      return;
    }
    if (!name.trim()) {
      setValidationError("Iltimos, mijozning ismini kiriting!");
      return;
    }

    // Filter valid products (where name is filled)
    const validProducts = products.filter((p) => p.name.trim() !== '');

    const parsedAdvance =
      typeof currentAdvance === 'number' ? currentAdvance : Number(currentAdvance) || 0;
    const combinedAddress = formatAddress(region, district, landmark);

    onSave({
      name: name.trim(),
      phone: phone.trim(),
      address: combinedAddress,
      region: region.trim(),
      district: district.trim(),
      landmark: landmark.trim(),
      products: validProducts,
      currentDebt: Math.round(effectiveDebt),
      currentAdvance: Math.max(0, parsedAdvance),
      notes: notes.trim(),
      createdBy: editingClient
        ? editingClient.createdBy || 'adminc'
        : currentUserUsername || 'adminc',
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-rose-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/40 border-b border-rose-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-display text-neutral-900">
              {editingClient ? "Mijoz ma'lumotlarini tahrirlash" : "Yangi mijoz qo'shish"}
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Mijoz rekvizitlari, joylashuvi, ombordagi tovarlar va hisob-kitob
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {validationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* Section 1: Mijoz ma'lumotlari */}
          {/* ========================================================= */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-neutral-800 tracking-wide uppercase">
              1. Mijoz shaxsiy ma'lumotlari va joylashuvi
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Mijoz ismi / Tashkilot nomi <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Sardor Rustamov"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Telefon raqami
                </label>
                <input
                  type="tel"
                  placeholder="+998 90 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition font-mono tabular-nums"
                />
              </div>
            </div>

            {/* Joylashuv 3 ta forma: Viloyat yoki shahar, Tuman, Mo'ljal */}
            <div className="pt-1 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Viloyat yoki shahar */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Viloyat yoki shahar
                  </label>
                  <input
                    type="text"
                    list="uzb_regions_list_client"
                    placeholder="Masalan: Toshkent shahri"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition"
                  />
                  <datalist id="uzb_regions_list_client">
                    {UZBEKISTAN_REGIONS.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>

                {/* 2. Tuman */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Tuman
                  </label>
                  <input
                    type="text"
                    placeholder="Masalan: Chilonzor tumani"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition"
                  />
                </div>
              </div>

              {/* 3. Mo'ljal */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Mo'ljal
                </label>
                <input
                  type="text"
                  placeholder="Masalan: 19-mavze, Korzinka ro'parasi, 45-uy"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* Section 2: Joriy berilgan mahsulotlar (Faqat ombordagi mahsulotlardan tanlanadi) */}
          {/* ========================================================= */}
          <div className="space-y-3 pt-2 border-t border-rose-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-neutral-800 tracking-wide uppercase flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-rose-700" />
                  <span>2. Ombordagi mahsulotlardan tanlab berish</span>
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Ombordan mahsulotni tanlang, o'lchov birligi va berilayotgan sonini belgilang
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddProduct}
                className="flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1.5 rounded-lg transition-colors border border-rose-200 min-h-[36px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Qator qo'shish</span>
              </button>
            </div>

            {/* Warehouse notice if empty */}
            {warehouseProducts.length === 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Omborda hozircha mahsulotlar yo'q. Avval 'Omborga mahsulotlar kiritish' orqali mahsulot qo'shing.
                </span>
              </div>
            )}

            {/* Products rows */}
            <div className="space-y-3">
              {products.map((prod, idx) => {
                const selectedWh = warehouseProducts.find((w) => w.id === prod.warehouseId);

                return (
                  <div
                    key={prod.id || idx}
                    className="p-3 sm:p-4 rounded-2xl bg-rose-50/40 border border-rose-100 space-y-3 relative transition hover:border-rose-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-800">
                        Mahsulot #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(idx)}
                        className="p-1 rounded-md text-neutral-400 hover:text-rose-600 hover:bg-rose-100 transition-colors"
                        title="Qatorni o'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 1. Ombordagi mahsulotni tanlash */}
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        Ombordagi mahsulot <span className="text-rose-600">*</span>
                      </label>
                      <select
                        value={prod.warehouseId || ''}
                        onChange={(e) => handleSelectWarehouseProduct(idx, e.target.value)}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-neutral-200 focus:border-rose-500 text-xs sm:text-sm text-neutral-900 outline-none font-medium"
                      >
                        <option value="">-- Ombordagi mahsulotni tanlang --</option>
                        {warehouseProducts.map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.brand} - {wh.name} {wh.mark1 ? `[${wh.mark1}]` : ''} ({wh.packageUnitName} / {wh.pieceUnitName})
                          </option>
                        ))}
                      </select>
                      {prod.name && !prod.warehouseId && (
                        <div className="mt-1 text-[11px] text-neutral-500 italic">
                          Avval kiritilgan: {prod.name}
                        </div>
                      )}
                    </div>

                    {/* 2. O'lchov birligi, Soni, Birlik narxi, Jami */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* O'lchov birligi */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                          O'lchov birligi
                        </label>
                        {selectedWh ? (
                          <select
                            value={prod.unit}
                            onChange={(e) => handleUnitChange(idx, e.target.value)}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-neutral-200 focus:border-rose-500 text-xs font-medium text-neutral-900 outline-none h-[38px]"
                          >
                            <option value={selectedWh.packageUnitName}>
                              {selectedWh.packageUnitName} ({selectedWh.piecesPerPackage} dona)
                            </option>
                            <option value={selectedWh.pieceUnitName}>
                              {selectedWh.pieceUnitName}
                            </option>
                            {selectedWh.baseUnit &&
                              selectedWh.baseUnit !== selectedWh.packageUnitName &&
                              selectedWh.baseUnit !== selectedWh.pieceUnitName && (
                                <option value={selectedWh.baseUnit}>
                                  {selectedWh.baseUnit}
                                </option>
                              )}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="dona, kg..."
                            value={prod.unit}
                            onChange={(e) => handleProductChange(idx, 'unit', e.target.value)}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-neutral-200 focus:border-rose-500 text-xs text-neutral-900 outline-none h-[38px]"
                          />
                        )}
                      </div>

                      {/* Soni / Miqdori */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                          Miqdori / Soni
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="1"
                          value={prod.quantity || ''}
                          onChange={(e) =>
                            handleProductChange(idx, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 bg-white rounded-xl border border-neutral-200 focus:border-rose-500 text-xs sm:text-sm text-neutral-900 font-mono tabular-nums outline-none h-[38px] font-semibold"
                        />
                      </div>

                      {/* Birlik narxi */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                          Birlik narxi (so'm)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={prod.unitPrice || ''}
                          onChange={(e) =>
                            handleProductChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 bg-white rounded-xl border border-neutral-200 focus:border-rose-500 text-xs sm:text-sm text-neutral-900 font-mono tabular-nums outline-none h-[38px]"
                        />
                      </div>

                      {/* Jami hisoblangan summa */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                          Jami summa
                        </label>
                        <div className="px-3 py-2 bg-neutral-100 rounded-xl text-xs sm:text-sm font-bold text-neutral-900 font-mono tabular-nums truncate flex items-center h-[38px]">
                          {formatMoney((prod.quantity || 0) * (prod.unitPrice || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2-blok oxirida: Mahsulotlar jami summasi va Qarzga belgilash qismi */}
            <div className="p-4 rounded-2xl bg-white border border-rose-200/90 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100">
                <span className="text-xs font-bold text-neutral-800">
                  Topshirilgan mahsulotlar umumiy qiymati:
                </span>
                <span className="text-base sm:text-lg font-extrabold font-mono text-rose-900 tabular-nums">
                  {formatMoney(totalProductsSum)}
                </span>
              </div>

              {/* Qarzga deb belgilash imkoniyati */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="credit_toggle"
                    className="flex items-center gap-2 cursor-pointer select-none"
                  >
                    <input
                      id="credit_toggle"
                      type="checkbox"
                      checked={isGivenOnCredit}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsGivenOnCredit(checked);
                        if (!checked) {
                          setCreditDebtAmount(0);
                        } else {
                          setCreditDebtAmount(totalProductsSum);
                        }
                      }}
                      className="w-4 h-4 text-rose-600 rounded-md border-neutral-300 focus:ring-rose-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                      <span>Mahsulotlar qarzga berildi (Nasiya)</span>
                    </span>
                  </label>

                  {isGivenOnCredit && (
                    <button
                      type="button"
                      onClick={() => {
                        setCreditDebtAmount(totalProductsSum);
                        setHasManuallyEditedDebt(false);
                      }}
                      className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                    >
                      To'liq qarzga (100%)
                    </button>
                  )}
                </div>

                {/* Mahsulot qiymatidan qanchasi qarz ekanligini kiritish */}
                {isGivenOnCredit && (
                  <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-rose-900">
                        Mahsulot qiymatidan qanchasi qarz (so'm):
                      </label>
                      <span className="text-[11px] text-neutral-500">
                        Umumiy qiymatdan qarz miqdorini belgilang
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={creditDebtAmount === '' ? '' : creditDebtAmount}
                        onChange={(e) => {
                          setHasManuallyEditedDebt(true);
                          setCreditDebtAmount(
                            e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                          );
                        }}
                        placeholder={totalProductsSum.toString()}
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-rose-300 focus:border-rose-600 focus:ring-1 focus:ring-rose-300 text-sm font-bold text-neutral-900 font-mono tabular-nums outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-rose-800">
                      <span>Belgilangan qarz: {formatMoney(effectiveDebt)}</span>
                      {totalProductsSum > effectiveDebt && (
                        <span className="text-emerald-700 font-sans font-semibold">
                          (Naqd to'langan qismi: {formatMoney(totalProductsSum - effectiveDebt)})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* Section 3: Qarz va haqdorlik hisob-kitobi */}
          {/* Joriy qarzdorlik avtomatik 2-blokdan olinadi, joriy haqdorlik esa kiritiladi */}
          {/* ========================================================= */}
          <div className="space-y-3 pt-2 border-t border-rose-100">
            <h3 className="text-xs font-bold text-neutral-800 tracking-wide uppercase">
              3. Qarz va haqdorlik hisob-kitobi
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Joriy qarzdorlik: Avtomatik 2-blokdan shakllanadi */}
              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/90 shadow-2xs">
                <span className="block text-xs font-bold text-rose-900 mb-1">
                  Joriy qarzdorlik summasi (2-blokdan avtomatik)
                </span>
                <div className="text-base sm:text-lg font-extrabold font-mono text-rose-900 tabular-nums">
                  {formatMoney(effectiveDebt)}
                </div>
                <p className="mt-1 text-[11px] text-rose-700">
                  2-blokdagi mahsulotlar qarziga mos ravishda avtomatik olindi
                </p>
              </div>

              {/* Joriy haqdorlik (Mijozning oldindan bergan to'lovi/avans) */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 shadow-2xs">
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Joriy haqdorlik / Avans (so'm)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={currentAdvance === '' ? '' : currentAdvance}
                  onChange={(e) =>
                    setCurrentAdvance(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 focus:border-emerald-500 text-sm font-bold text-neutral-900 font-mono tabular-nums outline-none"
                />
                <div className="mt-1 text-[11px] text-emerald-700 font-mono">
                  {formatMoney(typeof currentAdvance === 'number' ? currentAdvance : 0)}
                </div>
              </div>
            </div>

            {/* Qo'shimcha izoh */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Qo'shimcha izoh yoki kelishuv shartlari
              </label>
              <textarea
                rows={2}
                placeholder="To'lov muddati, mahsulot yetkazib berish holati yoki boshqa eslatmalar..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-rose-500 text-sm text-neutral-900 outline-none"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-rose-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition min-h-[44px] cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-xs sm:text-sm font-bold shadow-sm transition min-h-[44px] flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{editingClient ? "Saqlash" : "Mijozni qo'shish"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
