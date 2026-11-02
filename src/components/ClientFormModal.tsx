import React, { useState, useEffect, useMemo } from 'react';
import { Client, ProductItem, WarehouseProduct } from '../types';
import { formatMoney } from '../utils/format';
import { UZBEKISTAN_REGIONS, formatAddress, parseLegacyAddress } from '../utils/location';
import { storageService } from '../services/storage';
import { UsdConverterPanel } from './UsdConverterPanel';
import { NakladnoyModal, NakladnoyData } from './NakladnoyModal';
import { ExcelClientImporter, ImportedClientPayload } from './ExcelClientImporter';
import {
  X,
  Plus,
  Trash2,
  Package,
  AlertCircle,
  Check,
  CreditCard,
  Phone,
  Printer,
  Percent,
  DollarSign,
  FileSpreadsheet,
  UserPlus,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  onBulkImport?: (clientsData: ImportedClientPayload[]) => void;
  editingClient?: Client | null;
  currentUserUsername?: string;
  userRole?: 'admin' | 'agent';
  initialMode?: 'single' | 'excel';
}

const emptyProduct = (): ProductItem => ({
  id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
  name: '',
  unit: 'dona',
  quantity: 1,
  unitPrice: 0,
  originalUnitPrice: 0,
  discountPercent: 0,
  discountAmount: 0,
  totalPrice: 0,
  warehouseId: '',
});

export const ClientFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  onBulkImport,
  editingClient,
  currentUserUsername = 'adminc',
  userRole,
  initialMode = 'single',
}) => {
  const isAdminUser =
    userRole === 'admin' ||
    currentUserUsername === 'adminc' ||
    currentUserUsername === 'adminc1';

  const [entryMode, setEntryMode] = useState<'single' | 'excel'>('single');
  const [name, setName] = useState('');
  const [phones, setPhones] = useState<string[]>(['']);
  // 3 ta joylashuv formasi: Viloyat/shahar, Tuman, Mo'ljal
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [landmark, setLandmark] = useState('');

  const [products, setProducts] = useState<ProductItem[]>([]);

  // Order-level bidirectional discount (optional convenience alongside per-product discount)
  const [orderDiscountPercent, setOrderDiscountPercent] = useState<number | ''>('');
  const [orderDiscountAmount, setOrderDiscountAmount] = useState<number | ''>('');

  // Mahsulotlar qarzga (nasiya) yoki naqdga berilganini belgilash
  const [isGivenOnCredit, setIsGivenOnCredit] = useState<boolean>(true);
  const [creditDebtAmount, setCreditDebtAmount] = useState<number | ''>('');
  const [hasManuallyEditedDebt, setHasManuallyEditedDebt] = useState<boolean>(false);

  const [currentAdvance, setCurrentAdvance] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Nakladnoy preview modal state
  const [nakladnoyData, setNakladnoyData] = useState<NakladnoyData | null>(null);

  // Load warehouse products so user can select from existing stock
  const warehouseProducts = useMemo<WarehouseProduct[]>(() => {
    if (!isOpen) return [];
    return storageService.getWarehouseProducts();
  }, [isOpen]);

  // Aktual jami (chegirmalardan oldin)
  const rawProductsBaseSum = useMemo(() => {
    return products.reduce((sum, p) => {
      const baseP = p.originalUnitPrice ?? p.unitPrice ?? 0;
      return sum + (p.quantity || 0) * baseP;
    }, 0);
  }, [products]);

  // Qatorlardagi chegirmalardan keyingi summa
  const rowDiscountedSum = useMemo(() => {
    return products.reduce((sum, p) => {
      const rowTotal =
        p.totalPrice !== undefined ? p.totalPrice : (p.quantity || 0) * (p.unitPrice || 0);
      return sum + rowTotal;
    }, 0);
  }, [products]);

  // Oxirgi yakuniy mahsulotlar summasi (USD)
  const totalProductsSum = useMemo(() => {
    const extraDisc = typeof orderDiscountAmount === 'number' ? orderDiscountAmount : 0;
    return Math.max(0, Math.round((rowDiscountedSum - extraDisc) * 100) / 100);
  }, [rowDiscountedSum, orderDiscountAmount]);

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name);
      const existingPhones =
        editingClient.phones && editingClient.phones.length > 0
          ? editingClient.phones
          : editingClient.phone
          ? editingClient.phone
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [''];
      setPhones(existingPhones.length > 0 ? existingPhones : ['']);

      if (editingClient.region || editingClient.district || editingClient.landmark) {
        setRegion(editingClient.region || '');
        setDistrict(editingClient.district || '');
        setLandmark(editingClient.landmark || '');
      } else {
        const parsed = parseLegacyAddress(editingClient.address);
        setRegion(parsed.region);
        setDistrict(parsed.district);
        setLandmark(parsed.landmark);
      }

      setProducts(
        editingClient.products.length > 0
          ? editingClient.products.map((p) => ({
              ...p,
              originalUnitPrice: p.originalUnitPrice ?? p.unitPrice,
              discountPercent: p.discountPercent ?? 0,
              discountAmount: p.discountAmount ?? 0,
            }))
          : [emptyProduct()]
      );
      setOrderDiscountPercent('');
      setOrderDiscountAmount('');

      const hasDebt = editingClient.currentDebt > 0;
      setIsGivenOnCredit(hasDebt);
      setCreditDebtAmount(editingClient.currentDebt || 0);
      setHasManuallyEditedDebt(true);

      setCurrentAdvance(editingClient.currentAdvance || '');
      setNotes(editingClient.notes || '');
    } else {
      setName('');
      setPhones(['']);
      setRegion('');
      setDistrict('');
      setLandmark('');
      setProducts([emptyProduct()]);
      setOrderDiscountPercent('');
      setOrderDiscountAmount('');
      setIsGivenOnCredit(true);
      setCreditDebtAmount('');
      setHasManuallyEditedDebt(false);
      setCurrentAdvance('');
      setNotes('');
      setEntryMode(isAdminUser && initialMode === 'excel' ? 'excel' : 'single');
    }
    if (editingClient) {
      setEntryMode('single');
    }
    setValidationError(null);
  }, [editingClient, isOpen, isAdminUser, initialMode]);

  // Keep creditDebtAmount synced with totalProductsSum when user hasn't manually overridden it
  useEffect(() => {
    if (!editingClient && isGivenOnCredit && !hasManuallyEditedDebt) {
      setCreditDebtAmount(totalProductsSum > 0 ? totalProductsSum : '');
    }
  }, [totalProductsSum, isGivenOnCredit, hasManuallyEditedDebt, editingClient]);

  // Multiple phone handlers
  const handleAddPhone = () => {
    setPhones((prev) => [...prev, '']);
  };

  const handlePhoneChange = (idx: number, val: string) => {
    setPhones((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const handleRemovePhone = (idx: number) => {
    setPhones((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const handleAddProduct = () => {
    setProducts((prev) => [...prev, emptyProduct()]);
  };

  const handleRemoveProduct = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper: 5-blokdagi eng kam sotilish narxini tanlangan birlik (korobka yoki dona) bo'yicha hisoblash
  const getWarehouseSellingPriceForUnit = (wh: WarehouseProduct, targetUnit: string): number => {
    const baseMinPrice =
      wh.minSellingPrice !== undefined ? wh.minSellingPrice : wh.price || 0;
    const minUnitType = wh.minSellingPricingUnitType || wh.pricingUnitType || 'piece';
    const pkgCount = Math.max(1, wh.piecesPerPackage || 1);

    if (wh.packageUnitName && targetUnit === wh.packageUnitName) {
      return minUnitType === 'package'
        ? baseMinPrice
        : Math.round(baseMinPrice * pkgCount * 100) / 100;
    }
    if (targetUnit === wh.pieceUnitName || !wh.packageUnitName) {
      return minUnitType === 'piece'
        ? baseMinPrice
        : Math.round((baseMinPrice / pkgCount) * 100) / 100;
    }
    return baseMinPrice;
  };

  // Select warehouse product and auto-populate name, units, and 5-blok eng kam sotilish narxi (USD)
  const handleSelectWarehouseProduct = (index: number, warehouseId: string) => {
    const wh = warehouseProducts.find((w) => w.id === warehouseId);
    if (!wh) {
      setProducts((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          warehouseId: '',
          name: '',
          unitPrice: 0,
          originalUnitPrice: 0,
          discountPercent: 0,
          discountAmount: 0,
          totalPrice: 0,
        };
        return updated;
      });
      return;
    }

    const defaultUnit = wh.packageUnitName || wh.pieceUnitName || 'dona';
    const unitPrice = getWarehouseSellingPriceForUnit(wh, defaultUnit);

    const currentQty = products[index]?.quantity || 1;
    const fullName = `${wh.brand} - ${wh.name} ${wh.mark1 ? `[${wh.mark1}]` : ''}`.trim();
    const baseTotal = Math.round(currentQty * unitPrice * 100) / 100;

    setProducts((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        warehouseId: wh.id,
        name: fullName,
        unit: defaultUnit,
        unitPrice,
        originalUnitPrice: unitPrice,
        discountPercent: 0,
        discountAmount: 0,
        quantity: currentQty,
        totalPrice: baseTotal,
      };
      return updated;
    });
  };

  // Handle unit change for a selected warehouse product (uses 5-blok minSellingPrice)
  const handleUnitChange = (index: number, newUnit: string) => {
    const item = products[index];
    const wh = warehouseProducts.find((w) => w.id === item.warehouseId);

    let unitPrice = item.originalUnitPrice ?? item.unitPrice;
    if (wh) {
      unitPrice = getWarehouseSellingPriceForUnit(wh, newUnit);
    }

    const qty = item.quantity || 1;
    const baseTotal = qty * unitPrice;
    const discPct = item.discountPercent || 0;
    const discAmt = Math.round(((baseTotal * discPct) / 100) * 100) / 100;
    const finalTotal = Math.max(0, Math.round((baseTotal - discAmt) * 100) / 100);

    setProducts((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        unit: newUnit,
        unitPrice,
        originalUnitPrice: unitPrice,
        discountAmount: discAmt,
        totalPrice: finalTotal,
      };
      return updated;
    });
  };

  const handleProductChange = (
    index: number,
    field: keyof ProductItem,
    value: string | number
  ) => {
    setProducts((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      const qty = Number(item.quantity) || 0;
      const uPrice = Number(item.unitPrice) || 0;
      item.originalUnitPrice = uPrice;

      const baseTotal = qty * uPrice;
      const pct = Number(item.discountPercent) || 0;
      const discAmt = Math.round(((baseTotal * pct) / 100) * 100) / 100;
      item.discountAmount = discAmt;
      item.totalPrice = Math.max(0, Math.round((baseTotal - discAmt) * 100) / 100);

      updated[index] = item;
      return updated;
    });
  };

  // Bidirectional Discount Handler per product row: Foiz (%) -> Summa (USD)
  const handleRowDiscountPercentChange = (index: number, pctVal: string) => {
    setProducts((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const qty = Number(item.quantity) || 0;
      const uPrice = Number(item.originalUnitPrice ?? item.unitPrice) || 0;
      const baseTotal = qty * uPrice;

      if (pctVal === '') {
        item.discountPercent = 0;
        item.discountAmount = 0;
        item.totalPrice = Math.round(baseTotal * 100) / 100;
      } else {
        const pct = Math.max(0, Math.min(100, parseFloat(pctVal) || 0));
        const discAmt = Math.round(((baseTotal * pct) / 100) * 100) / 100;
        item.discountPercent = pct;
        item.discountAmount = discAmt;
        item.totalPrice = Math.max(0, Math.round((baseTotal - discAmt) * 100) / 100);
      }

      updated[index] = item;
      return updated;
    });
  };

  // Bidirectional Discount Handler per product row: Summa (USD) -> Foiz (%)
  const handleRowDiscountAmountChange = (index: number, amtVal: string) => {
    setProducts((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const qty = Number(item.quantity) || 0;
      const uPrice = Number(item.originalUnitPrice ?? item.unitPrice) || 0;
      const baseTotal = qty * uPrice;

      if (amtVal === '') {
        item.discountAmount = 0;
        item.discountPercent = 0;
        item.totalPrice = Math.round(baseTotal * 100) / 100;
      } else {
        const amt = Math.max(0, Math.min(baseTotal, parseFloat(amtVal) || 0));
        const pct = baseTotal > 0 ? Math.round(((amt / baseTotal) * 100) * 100) / 100 : 0;
        item.discountAmount = amt;
        item.discountPercent = pct;
        item.totalPrice = Math.max(0, Math.round((baseTotal - amt) * 100) / 100);
      }

      updated[index] = item;
      return updated;
    });
  };

  // Order-level bidirectional discount handlers
  const handleOrderDiscountPercentChange = (val: string) => {
    if (val === '') {
      setOrderDiscountPercent('');
      setOrderDiscountAmount('');
      return;
    }
    const pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
    const amt = Math.round(((rowDiscountedSum * pct) / 100) * 100) / 100;
    setOrderDiscountPercent(pct);
    setOrderDiscountAmount(amt);
  };

  const handleOrderDiscountAmountChange = (val: string) => {
    if (val === '') {
      setOrderDiscountAmount('');
      setOrderDiscountPercent('');
      return;
    }
    const amt = Math.max(0, Math.min(rowDiscountedSum, parseFloat(val) || 0));
    const pct = rowDiscountedSum > 0 ? Math.round(((amt / rowDiscountedSum) * 100) * 100) / 100 : 0;
    setOrderDiscountAmount(amt);
    setOrderDiscountPercent(pct);
  };

  // Effective debt derived from Section 2
  const effectiveDebt = useMemo(() => {
    if (!isGivenOnCredit) return 0;
    if (creditDebtAmount === '') return totalProductsSum;
    return Math.max(0, Number(creditDebtAmount) || 0);
  }, [isGivenOnCredit, creditDebtAmount, totalProductsSum]);

  // Build Nakladnoy data for preview/PDF print
  const handleOpenNakladnoy = () => {
    const cleanPhones = phones.map((p) => p.trim()).filter(Boolean);
    const fullAddress = formatAddress(region, district, landmark);
    const validProducts = products.filter((p) => p.name.trim() !== '');
    const paidPortion = Math.max(0, Math.round((totalProductsSum - effectiveDebt) * 100) / 100);

    setNakladnoyData({
      clientName: name.trim() || 'Yangi mijoz',
      clientPhones: cleanPhones,
      clientAddress: fullAddress,
      authorUsername: currentUserUsername,
      operationTitle: editingClient
        ? "Mijoz ma'lumotlari va topshirilgan mahsulotlar yuk xati"
        : 'Yangi mijozga mahsulot topshirish yuk xati (Nakladnoy)',
      productsDelivered: validProducts,
      paymentInfo: {
        paymentLabel: isGivenOnCredit
          ? paidPortion > 0
            ? 'Qisman naqd + Nasiya (Qarzga)'
            : 'Nasiya (Qarzga)'
          : "To'liq to'landi (Naqd / O'tkazma)",
        paidAmount: paidPortion,
        debtAmount: effectiveDebt,
        totalClientDebt: effectiveDebt,
      },
      note: notes.trim() || undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('Mijoz ismini kiritish majburiy!');
      return;
    }

    const validProducts = products.filter((p) => p.name.trim() !== '');
    const cleanPhones = phones.map((p) => p.trim()).filter(Boolean);
    const primaryPhoneStr = cleanPhones.join(', ');
    const fullAddress = formatAddress(region, district, landmark);

    // Deduct delivered products from warehouse if new client
    if (!editingClient && validProducts.length > 0) {
      validProducts.forEach((vp) => {
        if (vp.warehouseId) {
          storageService.deductProductFromWarehouse(vp.warehouseId, vp.quantity, vp.unit);
        }
      });
    }

    onSave({
      name: name.trim(),
      phone: primaryPhoneStr,
      phones: cleanPhones,
      region: region.trim(),
      district: district.trim(),
      landmark: landmark.trim(),
      address: fullAddress,
      products: validProducts,
      currentDebt: effectiveDebt,
      currentAdvance: Number(currentAdvance) || 0,
      notes: notes.trim(),
      createdBy: editingClient ? editingClient.createdBy : currentUserUsername,
    });
  };

  if (!isOpen) return null;

  const totalDiscountAll = Math.max(
    0,
    Math.round((rawProductsBaseSum - totalProductsSum) * 100) / 100
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <div
          className={`relative w-full ${
            isAdminUser && !editingClient && entryMode === 'excel' ? 'max-w-4xl' : 'max-w-2xl'
          } bg-white rounded-3xl shadow-2xl border border-rose-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-all`}
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/40 border-b border-rose-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-display text-neutral-900">
                {editingClient
                  ? "Mijoz ma'lumotlarini tahrirlash"
                  : entryMode === 'excel'
                  ? "Excel (.xlsx) fayldan mijozlarni yuklash"
                  : "Yangi mijoz qo'shish"}
              </h2>
              <p className="text-xs text-neutral-600 mt-0.5">
                {entryMode === 'excel'
                  ? "Faqat adminlar uchun: .xlsx fayldan qator/ustunlarni maydonlarga biriktirib mijozlarni ommaviy qo'shish"
                  : "Mijoz rekvizitlari, telefon raqamlari, mahsulotlar (USD) va hisob-kitob"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px] cursor-pointer shrink-0"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Admin Mode Switcher: Single Client Form vs Excel (.xlsx) Bulk Import */}
          {isAdminUser && !editingClient && (
            <div className="px-5 sm:px-6 pt-4 pb-1 bg-white">
              <div className="p-1 rounded-2xl bg-neutral-100 border border-neutral-200/80 grid grid-cols-1 sm:grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setEntryMode('single')}
                  className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    entryMode === 'single'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'text-neutral-700 hover:bg-white/60'
                  }`}
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>Bitta mijoz kiritish (Forma)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('excel')}
                  className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    entryMode === 'excel'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-900 hover:bg-emerald-50/80'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>Excel (.xlsx) fayldan yuklash (Admin)</span>
                </button>
              </div>
            </div>
          )}

          {isAdminUser && !editingClient && entryMode === 'excel' ? (
            <div className="p-5 sm:p-6 max-h-[82vh] overflow-y-auto">
              <ExcelClientImporter
                currentUserUsername={currentUserUsername}
                onCancel={onClose}
                onImportClients={(importedList) => {
                  if (onBulkImport) {
                    onBulkImport(importedList);
                  } else {
                    importedList.forEach((item) => onSave(item));
                  }
                }}
              />
            </div>
          ) : (
            /* Form Body */
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              {validationError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

            {/* ========================================================= */}
            {/* Section 1: Mijoz ma'lumotlari va bir nechta telefon raqamlar */}
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

                {/* Multiple Phone Numbers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-neutral-800">
                      Telefon raqamlari
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPhone}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Raqam qo'shish</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {phones.map((ph, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            placeholder={`+998 90 123 45 67 ${phones.length > 1 ? `(#${idx + 1})` : ''}`}
                            value={ph}
                            onChange={(e) => handlePhoneChange(idx, e.target.value)}
                            className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition font-mono tabular-nums"
                          />
                        </div>
                        {phones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePhone(idx)}
                            className="p-2 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 border border-neutral-200 transition cursor-pointer"
                            title="Raqamni o'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Joylashuv 3 ta forma: Viloyat yoki shahar, Tuman, Mo'ljal */}
              <div className="pt-1 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            {/* Section 2: Ombordagi mahsulotlardan tanlab berish + Chegirma (% / USD) */}
            {/* ========================================================= */}
            <div className="space-y-3 pt-2 border-t border-rose-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-bold text-neutral-800 tracking-wide uppercase flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-rose-700" />
                    <span>2. Ombordagi mahsulotlardan tanlab berish (USD)</span>
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Aktual narxga foiz (%) yoki summa (USD) orqali chegirma qo'shish mumkin
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenNakladnoy}
                    className="flex items-center gap-1 text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1.5 rounded-lg transition-colors border border-neutral-300 min-h-[36px] cursor-pointer"
                    title="Tayyor nakladnoyni qora borderlar bilan PDF ko'rinishida ekranga chiqarish"
                  >
                    <Printer className="w-3.5 h-3.5 text-neutral-700" />
                    <span>Print / Nakladnoy (PDF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1.5 rounded-lg transition-colors border border-rose-200 min-h-[36px] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Qator qo'shish</span>
                  </button>
                </div>
              </div>

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
                  const baseRowTotal =
                    (prod.quantity || 0) * (prod.originalUnitPrice ?? prod.unitPrice ?? 0);

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
                          className="p-1 rounded-md text-neutral-400 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
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
                          {warehouseProducts.map((wh) => {
                            const minSellPrice =
                              wh.minSellingPrice !== undefined ? wh.minSellingPrice : wh.price || 0;
                            const minUnitLabel =
                              (wh.minSellingPricingUnitType || wh.pricingUnitType) === 'package' &&
                              wh.packageUnitName
                                ? wh.packageUnitName
                                : wh.pieceUnitName || 'dona';
                            const unitsLabel = wh.packageUnitName
                              ? `${wh.packageUnitName} / ${wh.pieceUnitName}`
                              : wh.pieceUnitName || 'dona';
                            return (
                              <option key={wh.id} value={wh.id}>
                                {wh.brand} - {wh.name} {wh.mark1 ? `[${wh.mark1}]` : ''} ({unitsLabel}) — Eng kam sotilish narxi: {minSellPrice} USD (1 {minUnitLabel})
                              </option>
                            );
                          })}
                        </select>
                        {selectedWh && (
                          <div className="mt-1.5 p-2 rounded-lg bg-indigo-50/70 border border-indigo-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium">
                            <span className="text-neutral-700">
                              Zaxirada:{' '}
                              <strong className="text-neutral-900">
                                {selectedWh.totalPieces} {selectedWh.pieceUnitName || 'dona'}
                              </strong>
                              {selectedWh.packageUnitName
                                ? ` (${Math.floor(selectedWh.totalPieces / (selectedWh.piecesPerPackage || 1))} ${selectedWh.packageUnitName})`
                                : ''}
                            </span>
                            <span className="text-indigo-900 font-bold font-mono">
                              Eng kam sotilish narxi: {getWarehouseSellingPriceForUnit(selectedWh, prod.unit)} USD (1 {prod.unit})
                            </span>
                          </div>
                        )}
                        {prod.name && !prod.warehouseId && (
                          <div className="mt-1 text-[11px] text-neutral-500 italic">
                            Avval kiritilgan: {prod.name}
                          </div>
                        )}
                      </div>

                      {/* 2. O'lchov birligi, Soni, Aktual narx (USD), Aktual jami */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                              {selectedWh.packageUnitName && (
                                <option value={selectedWh.packageUnitName}>
                                  {selectedWh.packageUnitName} ({selectedWh.piecesPerPackage} dona)
                                </option>
                              )}
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

                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            Aktual birlik narxi (USD)
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

                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            Aktual summa (USD)
                          </label>
                          <div className="px-3 py-2 bg-neutral-100 rounded-xl text-xs font-bold text-neutral-700 font-mono tabular-nums truncate flex items-center h-[38px]">
                            {formatMoney(baseRowTotal)}
                          </div>
                        </div>
                      </div>

                      {/* 3. Bidirectional Chegirma: Foiz (%) yoki Summa (USD) -> Oxirgi summa */}
                      <div className="p-2.5 rounded-xl bg-white border border-rose-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-rose-800 mb-1 flex items-center gap-1">
                            <Percent className="w-3 h-3 text-rose-600" />
                            <span>Foiz chegirma (%)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            placeholder="0%"
                            value={prod.discountPercent ? prod.discountPercent : ''}
                            onChange={(e) => handleRowDiscountPercentChange(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 focus:border-rose-500 text-xs font-mono font-bold text-neutral-900 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-rose-800 mb-1 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-rose-600" />
                            <span>Summa chegirma (USD)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0 USD"
                            value={prod.discountAmount ? prod.discountAmount : ''}
                            onChange={(e) => handleRowDiscountAmountChange(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 focus:border-rose-500 text-xs font-mono font-bold text-neutral-900 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-emerald-800 mb-1">
                            Oxirgi summa (USD)
                          </label>
                          <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs sm:text-sm font-extrabold text-emerald-900 font-mono tabular-nums flex items-center h-[32px]">
                            {formatMoney(prod.totalPrice)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 2-blok oxirida: Oxirgi summa, Konvertatsiya va Nasiya/Naqd */}
              <div className="p-4 rounded-2xl bg-white border border-rose-200/90 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100">
                  <div>
                    <span className="text-xs font-bold text-neutral-800 block">
                      Topshirilgan mahsulotlar oxirgi summasi (USD):
                    </span>
                    {totalDiscountAll > 0 && (
                      <span className="text-[11px] text-neutral-500 font-mono">
                        Narx: {formatMoney(rawProductsBaseSum)} | Chegirma: -{formatMoney(totalDiscountAll)}
                      </span>
                    )}
                  </div>
                  <span className="text-base sm:text-lg font-extrabold font-mono text-rose-900 tabular-nums">
                    {formatMoney(totalProductsSum)}
                  </span>
                </div>

                {/* Qarzga (Nasiyaga) yoki Naqdga berish */}
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

                  {/* So'mdan USDga konvertatsiya (Nasiyaga yoki Naqdga berishda) */}
                  <UsdConverterPanel
                    label="Nasiya yoki naqd to'lovni so'mdan (UZS) USDga konvertatsiya qilish"
                    onApplyUsd={(usdVal, convNote) => {
                      if (isGivenOnCredit) {
                        setHasManuallyEditedDebt(true);
                        setCreditDebtAmount(usdVal);
                      }
                      setNotes((prev) => (prev ? `${prev} | ${convNote}` : convNote));
                    }}
                  />

                  {/* Mahsulot qiymatidan qanchasi qarz ekanligini kiritish */}
                  {isGivenOnCredit && (
                    <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2 animate-in fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-bold text-rose-900">
                          Mahsulot qiymatidan qanchasi qarz (USD):
                        </label>
                        <span className="text-[11px] text-neutral-500">
                          Oxirgi summadan qarz miqdorini belgilang
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
            {/* Section 3: Qarz va haqdorlik hisob-kitobi (USD) */}
            {/* ========================================================= */}
            <div className="space-y-3 pt-2 border-t border-rose-100">
              <h3 className="text-xs font-bold text-neutral-800 tracking-wide uppercase">
                3. Qarz va haqdorlik hisob-kitobi (USD)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/90 shadow-2xs">
                  <span className="block text-xs font-bold text-rose-900 mb-1">
                    Joriy qarzdorlik summasi (USD)
                  </span>
                  <div className="text-base sm:text-lg font-extrabold font-mono text-rose-900 tabular-nums">
                    {formatMoney(effectiveDebt)}
                  </div>
                  <p className="mt-1 text-[11px] text-rose-700">
                    2-blokdagi mahsulotlar qarziga mos ravishda avtomatik olindi
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 shadow-2xs">
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Joriy haqdorlik / Avans (USD)
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

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Qo'shimcha izoh yoki kelishuv shartlari
                </label>
                <textarea
                  rows={2}
                  placeholder="To'lov muddati, konvertatsiya kursi yoki boshqa eslatmalar..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-rose-500 text-sm text-neutral-900 outline-none"
                />
              </div>
            </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-rose-100 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleOpenNakladnoy}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold transition min-h-[44px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Yuk xati (PDF)</span>
                </button>

                <div className="flex items-center gap-2.5">
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
                    <span>{editingClient ? 'Saqlash' : "Mijozni qo'shish"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Black-bordered Printable / PDF Nakladnoy Modal */}
      <NakladnoyModal
        isOpen={!!nakladnoyData}
        onClose={() => setNakladnoyData(null)}
        data={nakladnoyData}
      />
    </>
  );
};
