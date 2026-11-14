import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  PackagePlus,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  Layers,
  Scale,
  DollarSign,
  Warehouse,
  Calendar,
  AlertCircle,
  HelpCircle,
  Edit3,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';
import { WarehouseProduct } from '../types';
import { storageService } from '../services/storage';
import { buildWarehouseProductChronology } from '../utils/warehouseChronology';
import {
  ExcelWarehouseImporter,
  ImportedWarehouseProductPayload,
} from './ExcelWarehouseImporter';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<WarehouseProduct, 'id' | 'createdAt'>) => void;
  onBulkImport?: (products: ImportedWarehouseProductPayload[]) => void;
  onUpdate?: (id: string, product: Omit<WarehouseProduct, 'id' | 'createdAt'>) => void;
  editingProduct?: WarehouseProduct | null;
  currentUsername: string;
  initialMode?: 'single' | 'excel';
}

export const WarehouseIntakeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  onBulkImport,
  onUpdate,
  editingProduct,
  currentUsername,
  initialMode = 'single',
}) => {
  // Helper for today's date in YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [entryMode, setEntryMode] = useState<'single' | 'excel'>(initialMode);

  // 1-BLOK: Mahsulot
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [mark1, setMark1] = useState('');
  const [mark2, setMark2] = useState('');
  const [extraMarks, setExtraMarks] = useState<string[]>([]);

  // 2-BLOK: O'lcham
  // 2.1:
  const [baseUnit, setBaseUnit] = useState('litr'); // litr, kg, metr, metr kvadrat, dona, gramm
  const [pieceUnitName, setPieceUnitName] = useState('1 idish'); // 1 idish, 1 dona, 1 shisha...
  const [volumePerPiece, setVolumePerPiece] = useState<string>('5'); // e.g. 5
  // 2.2 (Ixtiyoriy — tashlab ketish / bo'sh qoldirish mumkin):
  const [packageUnitName, setPackageUnitName] = useState('korobka'); // korobka, qop, blok, yashik...
  const [piecesPerPackage, setPiecesPerPackage] = useState<string>('4'); // e.g. 4
  const [skipSubBlock22, setSkipSubBlock22] = useState<boolean>(false);

  // 3-BLOK: Narx (ixtiyoriy / o'tkazib yuborish mumkin)
  const [pricingUnitType, setPricingUnitType] = useState<'piece' | 'package'>('piece');
  const currency = 'USD';
  const [price, setPrice] = useState<string>('30');
  const [skipPricing, setSkipPricing] = useState<boolean>(false);

  // 4-BLOK: Omborga kirim
  const [intakeDate, setIntakeDate] = useState<string>(todayStr);
  const [intakeUnitType, setIntakeUnitType] = useState<'package' | 'piece'>('package');
  const [intakeQuantity, setIntakeQuantity] = useState<string>('10');
  const [customRemainingPieces, setCustomRemainingPieces] = useState<string>('');
  const [isRemainingManuallyEdited, setIsRemainingManuallyEdited] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  // 5-BLOK: Eng kam sotilish narxi (Agentlar mijozga sotayotganda ko'rinadigan narx)
  const [minSellingPricingUnitType, setMinSellingPricingUnitType] = useState<'piece' | 'package'>('piece');
  const [minSellingPrice, setMinSellingPrice] = useState<string>('35');

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    if (editingProduct) {
      setBrand(editingProduct.brand || '');
      setName(editingProduct.name || '');
      setMark1(editingProduct.mark1 || '');
      setMark2(editingProduct.mark2 || '');
      setExtraMarks(editingProduct.extraMarks ? [...editingProduct.extraMarks] : []);

      setBaseUnit(editingProduct.baseUnit || 'litr');
      setPieceUnitName(editingProduct.pieceUnitName || '1 idish');
      setVolumePerPiece(String(editingProduct.volumePerPiece || 1));

      const hasPkg = Boolean(editingProduct.packageUnitName && editingProduct.packageUnitName.trim());
      setSkipSubBlock22(!hasPkg);
      setPackageUnitName(hasPkg ? editingProduct.packageUnitName : '');
      setPiecesPerPackage(hasPkg ? String(editingProduct.piecesPerPackage || 1) : '');

      const hasPr = (editingProduct.price || 0) > 0;
      setSkipPricing(!hasPr);
      setPricingUnitType(editingProduct.pricingUnitType || 'piece');
      setPrice(hasPr ? String(editingProduct.price) : '');

      setIntakeDate(editingProduct.intakeDate || todayStr);
      const initUnit = hasPkg
        ? editingProduct.initialIntakeUnitType || editingProduct.intakeUnitType || 'package'
        : 'piece';
      setIntakeUnitType(initUnit);
      const initQty = editingProduct.initialIntakeQuantity || editingProduct.intakeQuantity || 1;
      setIntakeQuantity(String(initQty));
      setCustomRemainingPieces(String(editingProduct.totalPieces ?? 0));
      setIsRemainingManuallyEdited(true);
      setNotes(editingProduct.notes || '');

      setMinSellingPricingUnitType(
        editingProduct.minSellingPricingUnitType || editingProduct.pricingUnitType || 'piece'
      );
      setMinSellingPrice(
        String(
          editingProduct.minSellingPrice !== undefined && editingProduct.minSellingPrice > 0
            ? editingProduct.minSellingPrice
            : editingProduct.price && editingProduct.price > 0
            ? editingProduct.price
            : 35
        )
      );
    } else {
      setBrand('');
      setName('');
      setMark1('');
      setMark2('');
      setExtraMarks([]);
      setBaseUnit('litr');
      setPieceUnitName('1 idish');
      setVolumePerPiece('5');
      setPackageUnitName('korobka');
      setPiecesPerPackage('4');
      setSkipSubBlock22(false);
      setPricingUnitType('piece');
      setPrice('30');
      setSkipPricing(false);
      setIntakeDate(todayStr);
      setIntakeUnitType('package');
      setIntakeQuantity('10');
      setCustomRemainingPieces('');
      setIsRemainingManuallyEdited(false);
      setNotes('');
      setMinSellingPricingUnitType('piece');
      setMinSellingPrice('35');
      setEntryMode(initialMode);
    }
  }, [isOpen, editingProduct, todayStr, initialMode]);

  // =========================================================
  // Progressive Unlocking Chain:
  // 1-blok to'lmaguncha 2-blok, 2-blok (2.1) to'lmaguncha 3-blok va 4-blok yonmaydi.
  // 2.2-kichik blok (Katta o'lcham) va 3-blok (Narx) ni o'tkazib yuborish / bo'sh qoldirish mumkin.
  // =========================================================

  // 1-blok: Brand va Name to'ldirilsa bo'ldi (mark1 endi majburiy emas)
  const isBlock1Valid = useMemo(() => {
    return brand.trim().length > 0 && name.trim().length > 0;
  }, [brand, name]);

  // 2-blok faqat 1-blok to'lsa ochiladi
  const isBlock2Unlocked = isBlock1Valid;

  // 2.1: baseUnit, pieceUnitName, volumePerPiece > 0
  const isBlock21Valid = useMemo(() => {
    if (!isBlock2Unlocked) return false;
    const vol = parseFloat(volumePerPiece);
    return (
      baseUnit.trim().length > 0 &&
      pieceUnitName.trim().length > 0 &&
      !isNaN(vol) &&
      vol > 0
    );
  }, [isBlock2Unlocked, baseUnit, pieceUnitName, volumePerPiece]);

  // 2.2-kichik blok to'ldirilganmi yoki bo'sh tashlab ketilganmi?
  const hasPackageUnit = useMemo(() => {
    if (!isBlock21Valid || skipSubBlock22) return false;
    const count = parseInt(piecesPerPackage, 10);
    return packageUnitName.trim().length > 0 && !isNaN(count) && count > 0;
  }, [isBlock21Valid, skipSubBlock22, packageUnitName, piecesPerPackage]);

  const isBlock22SkippedOrEmpty = useMemo(() => {
    if (skipSubBlock22) return true;
    return packageUnitName.trim() === '' && piecesPerPackage.trim() === '';
  }, [skipSubBlock22, packageUnitName, piecesPerPackage]);

  // 2.2 validligi: to'liq to'ldirilgan YOKI o'tkazib yuborilgan / bo'sh qoldirilgan
  const isBlock22Valid = useMemo(() => {
    if (!isBlock21Valid) return false;
    return hasPackageUnit || isBlock22SkippedOrEmpty;
  }, [isBlock21Valid, hasPackageUnit, isBlock22SkippedOrEmpty]);

  // Butun 2-blok: 2.1 to'ldirilgan bo'lsa va 2.2 to'ldirilgan yoki bo'sh qoldirilgan bo'lsa
  const isBlock2Valid = isBlock2Unlocked && isBlock21Valid && isBlock22Valid;

  // 3-blok faqat 2-blok to'lsa ochiladi
  const isBlock3Unlocked = isBlock2Valid;

  // 3-blokda narx kiritilganligi
  const hasEnteredPrice = useMemo(() => {
    if (!isBlock3Unlocked || skipPricing) return false;
    const pr = parseFloat(price);
    return !isNaN(pr) && pr > 0 && currency.trim().length > 0;
  }, [isBlock3Unlocked, skipPricing, price, currency]);

  // 3-blok validligi: narx musbat kiritilgan YOKI o'tkazib yuborilgan (yoki bo'sh/0 qoldirilgan)
  const isBlock3Valid = useMemo(() => {
    if (!isBlock3Unlocked) return false;
    if (skipPricing) return true;
    if (price.trim() === '') return true;
    const pr = parseFloat(price);
    return !isNaN(pr) && pr >= 0;
  }, [isBlock3Unlocked, skipPricing, price]);

  // 4-blok 2-blok to'liq bo'lganda va 3-blok to'ldirilgan yoki o'tkazib yuborilganda ochiladi
  const isBlock4Unlocked = isBlock2Valid && isBlock3Valid;

  // Agar 2.2-kichik blok tashlab ketilgan bo'lsa, narx va kirim birligi avtomatik 'piece' (dona/idish) bo'ladi
  const effectivePricingUnitType: 'piece' | 'package' = hasPackageUnit ? pricingUnitType : 'piece';
  const effectiveIntakeUnitType: 'package' | 'piece' = hasPackageUnit ? intakeUnitType : 'piece';
  const effectiveMinSellingUnitType: 'piece' | 'package' = hasPackageUnit
    ? minSellingPricingUnitType
    : 'piece';

  // Real-time Calculations for Block 4 & Block 5
  const parsedIntakeQty = parseFloat(intakeQuantity) || 0;
  const parsedPrice = skipPricing ? 0 : Math.max(0, parseFloat(price) || 0);
  const parsedPiecesPerPkg = hasPackageUnit ? Math.max(1, parseInt(piecesPerPackage, 10) || 1) : 1;
  const parsedVolumePerPiece = parseFloat(volumePerPiece) || 0;
  const parsedMinSellingPrice = Math.max(0, parseFloat(minSellingPrice) || 0);

  // 5-blok 4-blok ochilganda va kirim soni kiritilganda ochiladi
  const isBlock5Unlocked = isBlock4Unlocked && parsedIntakeQty > 0;
  const isBlock5Valid = useMemo(() => {
    if (!isBlock5Unlocked) return false;
    const val = parseFloat(minSellingPrice);
    return minSellingPrice.trim() !== '' && !isNaN(val) && val > 0;
  }, [isBlock5Unlocked, minSellingPrice]);

  // Sotib olish va Sotish narxi bo'yicha birlik tannarxi hamda foyda marjasi hisobi
  const costPerPiece = useMemo(() => {
    if (skipPricing || parsedPrice <= 0) return 0;
    return effectivePricingUnitType === 'package'
      ? parsedPrice / parsedPiecesPerPkg
      : parsedPrice;
  }, [skipPricing, parsedPrice, effectivePricingUnitType, parsedPiecesPerPkg]);

  const sellingPerPiece = useMemo(() => {
    if (!isBlock5Valid) return 0;
    return effectiveMinSellingUnitType === 'package'
      ? parsedMinSellingPrice / parsedPiecesPerPkg
      : parsedMinSellingPrice;
  }, [isBlock5Valid, effectiveMinSellingUnitType, parsedMinSellingPrice, parsedPiecesPerPkg]);

  const profitPerPiece = sellingPerPiece - costPerPiece;
  const marginPercent = costPerPiece > 0 ? ((sellingPerPiece - costPerPiece) / costPerPiece) * 100 : 0;

  // Net sold pieces up to today for editingProduct so changing initial stock updates current stock relative to operations
  const editingNetSoldPieces = useMemo(() => {
    if (!editingProduct) return 0;
    try {
      const chron = buildWarehouseProductChronology(
        editingProduct,
        storageService.getDailyPlans(),
        storageService.getClients(),
        undefined,
        storageService.getWarehouseProducts()
      );
      return Math.max(0, (chron.totalSoldPieces || 0) - (chron.totalReturnedPieces || 0));
    } catch {
      return 0;
    }
  }, [editingProduct]);

  // Total Pieces and Total Volume
  const calculatedIntakePieces = useMemo(() => {
    if (effectiveIntakeUnitType === 'package') {
      return parsedIntakeQty * parsedPiecesPerPkg;
    }
    return parsedIntakeQty;
  }, [effectiveIntakeUnitType, parsedIntakeQty, parsedPiecesPerPkg]);

  const calculatedTotalPieces = useMemo(() => {
    if (editingProduct) {
      if (isRemainingManuallyEdited && customRemainingPieces.trim() !== '') {
        const parsedCustom = parseFloat(customRemainingPieces);
        if (!isNaN(parsedCustom) && parsedCustom >= 0) {
          return parsedCustom;
        }
      }
      return Math.max(0, Math.round((calculatedIntakePieces - editingNetSoldPieces) * 100) / 100);
    }
    return calculatedIntakePieces;
  }, [editingProduct, isRemainingManuallyEdited, customRemainingPieces, calculatedIntakePieces, editingNetSoldPieces]);

  const calculatedTotalVolume = useMemo(() => {
    return calculatedTotalPieces * parsedVolumePerPiece;
  }, [calculatedTotalPieces, parsedVolumePerPiece]);

  // Total Sum
  const calculatedTotalSum = useMemo(() => {
    if (skipPricing || parsedPrice <= 0) return 0;
    if (effectivePricingUnitType === 'package') {
      if (effectiveIntakeUnitType === 'package') {
        return parsedIntakeQty * parsedPrice;
      } else {
        return (parsedIntakeQty * parsedPrice) / parsedPiecesPerPkg;
      }
    } else {
      if (effectiveIntakeUnitType === 'package') {
        return parsedIntakeQty * parsedPiecesPerPkg * parsedPrice;
      } else {
        return parsedIntakeQty * parsedPrice;
      }
    }
  }, [
    skipPricing,
    effectivePricingUnitType,
    effectiveIntakeUnitType,
    parsedIntakeQty,
    parsedPrice,
    parsedPiecesPerPkg,
  ]);

  // Handlers for dynamic extra marks
  const handleAddExtraMark = () => {
    setExtraMarks([...extraMarks, '']);
  };

  const handleUpdateExtraMark = (index: number, val: string) => {
    const updated = [...extraMarks];
    updated[index] = val;
    setExtraMarks(updated);
  };

  const handleRemoveExtraMark = (index: number) => {
    const updated = extraMarks.filter((_, i) => i !== index);
    setExtraMarks(updated);
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!brand.trim()) {
      setFormError('1-blokda mahsulot brendini kiriting!');
      return;
    }
    if (!name.trim()) {
      setFormError('1-blokda mahsulot nomini kiriting!');
      return;
    }
    if (!isBlock21Valid) {
      setFormError("2-blokda o'lchov birligi va donadagi hajmni to'g'ri to'ldiring!");
      return;
    }
    if (!isBlock22Valid) {
      setFormError(
        "2.2-kichik blokda katta o'lcham va dona sonini to'liq kiriting yoki 2.2-kichik blokni bo'sh qoldiring (o'tkazib yuboring)!"
      );
      return;
    }
    if (!skipPricing && price.trim() !== '' && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
      setFormError("3-blokda narx summasini to'g'ri kiriting yoki 3-blokni o'tkazib yuboring!");
      return;
    }
    if (parsedIntakeQty <= 0) {
      setFormError('4-blokda qabul qilinayotgan mahsulot sonini musbat kiriting!');
      return;
    }
    if (!isBlock5Valid) {
      setFormError('5-blokda eng kam sotilish narxini (USD) musbat kiriting!');
      return;
    }

    const payload: Omit<WarehouseProduct, 'id' | 'createdAt'> = {
      brand: brand.trim(),
      name: name.trim(),
      mark1: mark1.trim(),
      mark2: mark2.trim(),
      extraMarks: extraMarks.map((m) => m.trim()).filter(Boolean),
      baseUnit: baseUnit.trim(),
      pieceUnitName: pieceUnitName.trim(),
      volumePerPiece: parsedVolumePerPiece,
      packageUnitName: hasPackageUnit ? packageUnitName.trim() : '',
      piecesPerPackage: hasPackageUnit ? parsedPiecesPerPkg : 1,
      pricingUnitType: effectivePricingUnitType,
      currency: 'USD',
      price: parsedPrice,
      intakeDate: intakeDate || todayStr,
      intakeUnitType: effectiveIntakeUnitType,
      intakeQuantity: parsedIntakeQty,
      totalSum: Math.round(calculatedTotalSum * 100) / 100,
      totalPieces: calculatedTotalPieces,
      totalVolume: calculatedTotalVolume,
      minSellingPricingUnitType: effectiveMinSellingUnitType,
      minSellingPrice: parsedMinSellingPrice,
      createdBy: editingProduct?.createdBy || currentUsername || 'adminc',
      notes: notes.trim() || undefined,
    };

    if (editingProduct && onUpdate) {
      onUpdate(editingProduct.id, payload);
    } else {
      onSave(payload);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-rose-100 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - clean with no unnecessary subtitle text */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-800 to-rose-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white border border-white/20 shadow-xs">
              {editingProduct ? (
                <Edit3 className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <PackagePlus className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white">
                {editingProduct
                  ? `Ombor mahsulotini tahrirlash: ${editingProduct.brand} — ${editingProduct.name}`
                  : 'Omborga mahsulotlar kiritish'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
            title="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher: Single 5-Block Intake vs Excel (.xlsx) Upload */}
        {!editingProduct && onBulkImport && (
          <div className="px-5 sm:px-6 pt-4 pb-1 bg-rose-50/40 border-b border-rose-100 shrink-0">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-neutral-100 border border-neutral-200">
              <button
                type="button"
                onClick={() => setEntryMode('single')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  entryMode === 'single'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-white/70'
                }`}
              >
                <PackagePlus className="w-4 h-4 shrink-0" />
                <span>Bittalab kiritish (5 blok)</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('excel')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  entryMode === 'excel'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-white/70'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Excel (.xlsx) fayldan yuklash</span>
              </button>
            </div>
          </div>
        )}

        {!editingProduct && entryMode === 'excel' && onBulkImport ? (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <ExcelWarehouseImporter
              currentUsername={currentUsername}
              onImportProducts={(importedProducts) => {
                onBulkImport(importedProducts);
                onClose();
              }}
              onCancel={onClose}
            />
          </div>
        ) : (
          /* Modal Body with 5 strictly conditioned blocks */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {formError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

          {/* ========================================================= */}
          {/* 1-BLOK: MAHSULOT */}
          {/* ========================================================= */}
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/20 p-4 sm:p-5 transition">
            <div className="flex items-center justify-between gap-2 mb-4 pb-2.5 border-b border-rose-100">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-rose-700 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  1
                </span>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-700" />
                  <span>1-BLOK: Mahsulot</span>
                </h3>
              </div>
              {isBlock1Valid && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  To'ldirildi
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 1-qator: Mahsulot brendi */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  1-qator: Mahsulot brendi <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Masalan: Knauf, Artel, Castrol, Ohangaron"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-rose-600 focus:border-rose-600 bg-white"
                />
              </div>

              {/* 2-qator: Mahsulot nomi */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  2-qator: Mahsulot nomi <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masalan: Gipsokarton, Sement, Motor moyi"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-rose-600 focus:border-rose-600 bg-white"
                />
              </div>

              {/* 3-qator: Mahsulot markasi 1 (majburiy emas) */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  3-qator: Mahsulot markasi 1
                </label>
                <input
                  type="text"
                  value={mark1}
                  onChange={(e) => setMark1(e.target.value)}
                  placeholder="Masalan: M500, 5W-40, 9.5mm, A-toifa"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-rose-600 focus:border-rose-600 bg-white"
                />
              </div>

              {/* 4-qator: Mahsulot markasi 2 */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  4-qator: Mahsulot markasi 2
                </label>
                <input
                  type="text"
                  value={mark2}
                  onChange={(e) => setMark2(e.target.value)}
                  placeholder="Masalan: Sintetika, Namlikka chidamli (yashil)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-rose-600 focus:border-rose-600 bg-white"
                />
              </div>
            </div>

            {/* Dynamic extra marks */}
            {extraMarks.length > 0 && (
              <div className="mt-3.5 pt-3 border-t border-rose-100/70 space-y-2.5">
                <div className="text-[11px] font-bold text-neutral-700">
                  Qo'shimcha mahsulot markalari:
                </div>
                {extraMarks.map((em, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500 font-mono w-20 shrink-0">
                      Marka {idx + 3}:
                    </span>
                    <input
                      type="text"
                      value={em}
                      onChange={(e) => handleUpdateExtraMark(idx, e.target.value)}
                      placeholder={`Mahsulot markasi ${idx + 3}`}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-rose-600 focus:border-rose-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExtraMark(idx)}
                      className="p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded-lg transition"
                      title="Markani o'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* + Yana mahsulot markasini qo'shish tugmasi */}
            <div className="mt-3">
              <button
                type="button"
                onClick={handleAddExtraMark}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 hover:bg-rose-100/60 px-3 py-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Yana mahsulot markasini qo'shish</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2-BLOK: O'LCHAM (2.1 va 2.2 kichik bloklar) */}
          {/* Shart: 1-blok to'lmaguncha 2-blok yonmaydi */}
          {/* ========================================================= */}
          <div
            className={`rounded-2xl border transition p-4 sm:p-5 space-y-4 ${
              isBlock2Unlocked
                ? 'border-neutral-200 bg-neutral-50/40'
                : 'border-neutral-200 bg-neutral-100/70 opacity-60 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-neutral-200">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center shadow-xs ${
                    isBlock2Unlocked ? 'bg-neutral-800' : 'bg-neutral-400'
                  }`}
                >
                  2
                </span>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-neutral-700" />
                  <span>2-BLOK: O'lcham</span>
                  {!isBlock2Unlocked && <Lock className="w-3.5 h-3.5 text-neutral-400" />}
                </h3>
              </div>
              {!isBlock2Unlocked ? (
                <span className="text-[10px] text-neutral-500 font-medium">
                  1-blok to'ldirilmaguncha yonmaydi
                </span>
              ) : isBlock2Valid ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  To'liq to'ldirildi
                </span>
              ) : isBlock21Valid ? (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  2.1 to'ldirildi, 2.2 kutilmoqda
                </span>
              ) : null}
            </div>

            {/* 2.1-Kichik blok: O'lchov birligi, Dona, Donadagi hajm */}
            <div className="bg-white rounded-xl p-3.5 border border-neutral-200/80 shadow-xs">
              <div className="text-xs font-bold text-rose-800 mb-2.5 flex items-center gap-1.5">
                <span>2.1-kichik blok: Birlamchi dona / idish parametrlari</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1-qator: O'lchov birligi */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    1-qator: O'lchov birligi <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isBlock2Unlocked}
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                    placeholder="Masalan: litr, kg, metr, m²"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-rose-600 bg-white disabled:bg-neutral-100"
                  />
                  <div className="flex gap-1 mt-1 text-[10px] text-neutral-500">
                    <span
                      onClick={() => setBaseUnit('litr')}
                      className="cursor-pointer underline hover:text-rose-700"
                    >
                      litr
                    </span>
                    <span>•</span>
                    <span
                      onClick={() => setBaseUnit('kg')}
                      className="cursor-pointer underline hover:text-rose-700"
                    >
                      kg
                    </span>
                    <span>•</span>
                    <span
                      onClick={() => setBaseUnit('metr')}
                      className="cursor-pointer underline hover:text-rose-700"
                    >
                      metr
                    </span>
                    <span>•</span>
                    <span
                      onClick={() => setBaseUnit('dona')}
                      className="cursor-pointer underline hover:text-rose-700"
                    >
                      dona
                    </span>
                  </div>
                </div>

                {/* 2-qator: Dona */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    2-qator: Dona (idish nomi) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isBlock2Unlocked}
                    value={pieceUnitName}
                    onChange={(e) => setPieceUnitName(e.target.value)}
                    placeholder="Masalan: 1 idish, 1 dona, 1 shisha"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-rose-600 bg-white disabled:bg-neutral-100"
                  />
                </div>

                {/* 3-qator: Donada hajm */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    3-qator: Donada hajm <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    disabled={!isBlock2Unlocked}
                    step="any"
                    min="0.001"
                    value={volumePerPiece}
                    onChange={(e) => setVolumePerPiece(e.target.value)}
                    placeholder="Masalan: 5"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-rose-600 bg-white disabled:bg-neutral-100"
                  />
                </div>
              </div>

              {/* 2.1 Nisbat ko'rsatkichi (Xulosa va bo'ladi so'zlarisiz) */}
              {isBlock21Valid && (
                <div className="mt-2.5 p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    <strong>
                      1 ta {pieceUnitName || 'dona'} = {volumePerPiece} {baseUnit}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* 2.2-Kichik blok: Ochilish sharti: 2.1 to'lgandan keyin ochiladi (Ixtiyoriy — bo'sh qoldirish mumkin) */}
            <div
              className={`rounded-xl p-3.5 border transition ${
                isBlock21Valid
                  ? skipSubBlock22 || isBlock22SkippedOrEmpty
                    ? 'bg-amber-50/30 border-amber-200/80 shadow-xs'
                    : 'bg-white border-neutral-200/80 shadow-xs'
                  : 'bg-neutral-100/70 border-neutral-200 text-neutral-400 opacity-60 pointer-events-none'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  {!isBlock21Valid && <Lock className="w-3.5 h-3.5 text-neutral-400" />}
                  <span>2.2-kichik blok: Katta o'lcham (korobka / qop / blok)</span>
                  <span className="text-[10px] font-medium text-neutral-500">
                    (ixtiyoriy — bo'sh qoldirish mumkin)
                  </span>
                </span>

                <div className="flex items-center gap-2">
                  {isBlock21Valid && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!skipSubBlock22 && !isBlock22SkippedOrEmpty) {
                          setSkipSubBlock22(true);
                          setPackageUnitName('');
                          setPiecesPerPackage('');
                          setPricingUnitType('piece');
                          setIntakeUnitType('piece');
                        } else {
                          setSkipSubBlock22(false);
                          if (!packageUnitName) setPackageUnitName('korobka');
                          if (!piecesPerPackage) setPiecesPerPackage('4');
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        skipSubBlock22 || isBlock22SkippedOrEmpty
                          ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      {skipSubBlock22 || isBlock22SkippedOrEmpty
                        ? "✓ 2.2-kichik blok tashlab ketildi (Katta o'lcham kiritish)"
                        : "2.2-kichik blokni tashlab ketish (bo'sh qoldirish)"}
                    </button>
                  )}

                  {!isBlock21Valid && (
                    <span className="text-[10px] text-neutral-500 font-medium">
                      2.1 to'ldirilgach ochiladi
                    </span>
                  )}
                </div>
              </div>

              {skipSubBlock22 ? (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
                  <div>
                    <span className="font-bold">2.2-kichik blok bo'sh qoldirildi (tashlab ketildi).</span>{' '}
                    Mahsulot faqat birlamchi birlikda (<strong>{pieceUnitName || 'dona'}</strong>) hisoblanadi.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSkipSubBlock22(false);
                      setPackageUnitName('korobka');
                      setPiecesPerPackage('4');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] shrink-0 cursor-pointer"
                  >
                    Katta o'lcham kiritish
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1-qator: O'lcham (korobka, qop va hk) */}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        1-qator: O'lcham nomi{' '}
                        <span className="text-neutral-400 font-normal">(bo'sh qoldirish mumkin)</span>
                      </label>
                      <input
                        type="text"
                        disabled={!isBlock21Valid}
                        value={packageUnitName}
                        onChange={(e) => setPackageUnitName(e.target.value)}
                        placeholder="Masalan: korobka, qop, blok (bo'sh qoldirish mumkin)"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-rose-600 bg-white disabled:bg-neutral-100"
                      />
                      <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-neutral-500">
                        <span
                          onClick={() => setPackageUnitName('korobka')}
                          className="cursor-pointer underline hover:text-rose-700"
                        >
                          korobka
                        </span>
                        <span>•</span>
                        <span
                          onClick={() => setPackageUnitName('qop')}
                          className="cursor-pointer underline hover:text-rose-700"
                        >
                          qop
                        </span>
                        <span>•</span>
                        <span
                          onClick={() => setPackageUnitName('blok')}
                          className="cursor-pointer underline hover:text-rose-700"
                        >
                          blok
                        </span>
                        <span>•</span>
                        <span
                          onClick={() => setPackageUnitName('yashik')}
                          className="cursor-pointer underline hover:text-rose-700"
                        >
                          yashik
                        </span>
                        <span>•</span>
                        <span
                          onClick={() => {
                            setPackageUnitName('');
                            setPiecesPerPackage('');
                            setPricingUnitType('piece');
                            setIntakeUnitType('piece');
                          }}
                          className="cursor-pointer underline text-amber-700 hover:text-amber-900 font-semibold"
                        >
                          bo'sh qoldirish
                        </span>
                      </div>
                    </div>

                    {/* 2-qator: Dona soni */}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        2-qator: Dona soni{' '}
                        <span className="text-neutral-400 font-normal">(bo'sh qoldirish mumkin)</span>
                      </label>
                      <input
                        type="number"
                        disabled={!isBlock21Valid}
                        min="1"
                        step="1"
                        value={piecesPerPackage}
                        onChange={(e) => setPiecesPerPackage(e.target.value)}
                        placeholder="Masalan: 4 yoki 5 dona (bo'sh qoldirish mumkin)"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-rose-600 bg-white disabled:bg-neutral-100"
                      />
                    </div>
                  </div>

                  {/* 2.2 Nisbat ko'rsatkichi */}
                  {hasPackageUnit ? (
                    <div className="mt-2.5 p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        <strong>
                          1 {packageUnitName || 'korobka'} = {piecesPerPackage} dona (jami{' '}
                          {(parseFloat(volumePerPiece) || 0) * (parseInt(piecesPerPackage, 10) || 0)}{' '}
                          {baseUnit})
                        </strong>
                      </span>
                    </div>
                  ) : isBlock22SkippedOrEmpty ? (
                    <div className="mt-2.5 p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        2.2-kichik blok bo'sh qoldirildi — mahsulot faqat{' '}
                        <strong>{pieceUnitName || 'dona'}</strong> bo'yicha kiritiladi.
                      </span>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3-BLOK: NARX (Ixtiyoriy - o'tkazib yuborish mumkin) */}
          {/* Shart: 2-blok to'ldirilmaguncha yonmaydi */}
          {/* ========================================================= */}
          <div
            className={`rounded-2xl border transition p-4 sm:p-5 ${
              isBlock3Unlocked
                ? skipPricing
                  ? 'border-amber-200 bg-amber-50/20 shadow-xs'
                  : 'border-neutral-200 bg-white shadow-xs'
                : 'border-neutral-200 bg-neutral-100/70 opacity-60 pointer-events-none'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3.5 border-b border-neutral-200">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shadow-xs ${
                    isBlock3Unlocked ? 'bg-amber-600 text-white' : 'bg-neutral-400 text-white'
                  }`}
                >
                  3
                </span>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  <span>3-BLOK: Sotib olish narxi (Kirim tannarxi)</span>
                  <span className="text-[11px] font-medium text-neutral-500">(ixtiyoriy)</span>
                  {!isBlock3Unlocked && <Lock className="w-3.5 h-3.5 text-neutral-400" />}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {isBlock3Unlocked && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!skipPricing) {
                        setSkipPricing(true);
                        setPrice('');
                      } else {
                        setSkipPricing(false);
                        if (!price) setPrice('30');
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      skipPricing
                        ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    {skipPricing
                      ? "✓ Narx qo'yish o'tkazib yuborildi (Narx kiritishga qaytish)"
                      : "Narx qo'yishni o'tkazib yuborish"}
                  </button>
                )}

                {!isBlock3Unlocked ? (
                  <span className="text-[10px] text-neutral-500 font-medium">
                    2-blok to'ldirilmaguncha yonmaydi
                  </span>
                ) : skipPricing || parsedPrice <= 0 ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    O'tkazib yuborildi (Narxsiz)
                  </span>
                ) : hasEnteredPrice ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    To'ldirildi
                  </span>
                ) : null}
              </div>
            </div>

            {skipPricing ? (
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
                <div>
                  <span className="font-bold">3-blok (Narx qo'yish) o'tkazib yuborildi.</span>{' '}
                  Mahsulot omborga narxsiz (0 USD) holatda kiritiladi. To'g'ridan-to'g'ri 4-blokni to'ldirib saqlashingiz mumkin.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSkipPricing(false);
                    if (!price) setPrice('30');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  Narx kiritish
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* 1-qator: 2-blok ichidagi birlik tanlanadi (dona yoki korobka) */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      1-qator: Narx birligi
                    </label>
                    <select
                      disabled={!isBlock3Unlocked}
                      value={effectivePricingUnitType}
                      onChange={(e) => setPricingUnitType(e.target.value as 'piece' | 'package')}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-rose-600 bg-white"
                    >
                      <option value="piece">
                        1 {pieceUnitName || 'dona'} uchun narx
                      </option>
                      {hasPackageUnit && (
                        <option value="package">
                          1 {packageUnitName || 'korobka'} uchun narx
                        </option>
                      )}
                    </select>
                  </div>

                  {/* 2-qator: Valyuta avtomatik USD */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      2-qator: Valyuta
                    </label>
                    <div className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm bg-neutral-100 font-bold font-mono flex items-center justify-between">
                      <span>USD ($)</span>
                      <span className="text-[10px] font-sans font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        Avtomatik
                      </span>
                    </div>
                  </div>

                  {/* 3-qator: Summasi yoziladi */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      3-qator: Summasi (USD) <span className="text-neutral-400 font-normal">(ixtiyoriy)</span>
                    </label>
                    <input
                      type="number"
                      disabled={!isBlock3Unlocked}
                      min="0"
                      step="any"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Narxsiz kiritish uchun bo'sh qoldiring"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-rose-600 bg-white font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Dynamic Calculation breakdown */}
                {hasEnteredPrice && (
                  <div className="mt-3 p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs text-neutral-700 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      Tanlangan:{' '}
                      <strong>
                        {effectivePricingUnitType === 'piece'
                          ? `1 ${pieceUnitName || 'dona'}`
                          : `1 ${packageUnitName || 'korobka'}`}
                      </strong>{' '}
                      ={' '}
                      <span className="font-bold text-neutral-900">
                        {parsedPrice.toLocaleString()} {currency}
                      </span>
                    </div>
                    {hasPackageUnit && (
                      <div className="text-[11px] text-neutral-500">
                        {effectivePricingUnitType === 'piece'
                          ? `(1 ${packageUnitName || 'korobka'} = ${(parsedPrice * parsedPiecesPerPkg).toLocaleString()} ${currency})`
                          : `(1 ${pieceUnitName || 'dona'} = ${Math.round(parsedPrice / parsedPiecesPerPkg).toLocaleString()} ${currency})`}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ========================================================= */}
          {/* 4-BLOK: OMBORGA KIRIM BLOKI */}
          {/* Shart: 2-blok to'ldirilmaguncha yonmaydi */}
          {/* ========================================================= */}
          <div
            className={`rounded-2xl border transition p-4 sm:p-5 ${
              isBlock4Unlocked
                ? 'border-emerald-200 bg-emerald-50/20 shadow-xs'
                : 'border-neutral-200 bg-neutral-100/70 opacity-60 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-3.5 border-b border-emerald-100">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shadow-xs ${
                    isBlock4Unlocked ? 'bg-emerald-700 text-white' : 'bg-neutral-400 text-white'
                  }`}
                >
                  4
                </span>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-emerald-700" />
                  <span>4-BLOK: Omborga kirim bloki</span>
                  {!isBlock4Unlocked && <Lock className="w-3.5 h-3.5 text-neutral-400" />}
                </h3>
              </div>
              {!isBlock4Unlocked && (
                <span className="text-[10px] text-neutral-500 font-medium">
                  2-blok to'ldirilmaguncha yonmaydi
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* 1-qator: Sana tanlash imkoni (default bugungi sana) */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  <span>1-qator: Kirim sanasi</span>
                </label>
                <input
                  type="date"
                  disabled={!isBlock4Unlocked}
                  value={intakeDate}
                  onChange={(e) => setIntakeDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-emerald-600 bg-white"
                />
                <span className="text-[10px] text-neutral-400 mt-0.5 block">
                  Standart: bugungi sana
                </span>
              </div>

              {/* 2-qator: Tepadagi mahsulotdan 2-blok 2 qatordagi qiymat avtomatik tanlanadi */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  2-qator: Kirim o'lchov birligi
                </label>
                <select
                  disabled={!isBlock4Unlocked}
                  value={effectiveIntakeUnitType}
                  onChange={(e) => {
                    const nextUnit = e.target.value as 'package' | 'piece';
                    setIntakeUnitType(nextUnit);
                    setIsRemainingManuallyEdited(false);
                    const qtyNum = parseFloat(intakeQuantity) || 0;
                    const nextPieces =
                      nextUnit === 'package' ? qtyNum * parsedPiecesPerPkg : qtyNum;
                    const remainingPieces = editingProduct
                      ? Math.max(0, Math.round((nextPieces - editingNetSoldPieces) * 100) / 100)
                      : nextPieces;
                    setCustomRemainingPieces(String(remainingPieces));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-emerald-600 bg-white font-medium"
                >
                  {hasPackageUnit && (
                    <option value="package">
                      {packageUnitName || 'korobka'} (avtomatik tanlangan)
                    </option>
                  )}
                  <option value="piece">{pieceUnitName || 'dona'}</option>
                </select>
              </div>

              {/* 3-qator: Soni tanlanadi */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  3-qator: {editingProduct ? 'Bazaga kiritilgandagi soni (Bosh qoldiq)' : 'Kirim soni'} <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  disabled={!isBlock4Unlocked}
                  min="1"
                  step="any"
                  value={intakeQuantity}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setIntakeQuantity(nextVal);
                    setIsRemainingManuallyEdited(false);
                    const qtyNum = parseFloat(nextVal) || 0;
                    const nextPieces =
                      effectiveIntakeUnitType === 'package'
                        ? qtyNum * parsedPiecesPerPkg
                        : qtyNum;
                    const remainingPieces = editingProduct
                      ? Math.max(0, Math.round((nextPieces - editingNetSoldPieces) * 100) / 100)
                      : nextPieces;
                    setCustomRemainingPieces(String(remainingPieces));
                  }}
                  placeholder="Masalan: 10"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-emerald-600 bg-white font-semibold"
                />
              </div>
            </div>

            {editingProduct && (
              <div className="mt-3.5 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-amber-950">
                      Ombordagi joriy qoldiq soni (dona) — bevosita tahrirlash:
                    </label>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Agar mahsulotning bir qismi sotilgan bo'lsa yoki ombordagi qoldiq donasini o'zgartirmoqchi bo'lsangiz, shu yerda yozing
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={
                        isRemainingManuallyEdited
                          ? customRemainingPieces
                          : String(calculatedIntakePieces)
                      }
                      onChange={(e) => {
                        setCustomRemainingPieces(e.target.value);
                        setIsRemainingManuallyEdited(true);
                      }}
                      className="w-32 px-3 py-2 rounded-xl border border-amber-400 text-neutral-900 text-xs sm:text-sm font-mono font-bold bg-white focus:outline-amber-600"
                    />
                    <span className="text-xs font-bold text-amber-950">dona</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4 va 5-qatorlar: Avtomatik hisoblangan umumiy summa va umumiy dona */}
            <div className="mt-4 pt-3 border-t border-emerald-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 4-qator: Avtomatik umumiy summa */}
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs">
                <div className="text-[11px] font-bold text-emerald-800 mb-1 uppercase tracking-wide">
                  4-qator: Avtomatik umumiy summa
                </div>
                {skipPricing || parsedPrice <= 0 ? (
                  <>
                    <div className="text-sm sm:text-base font-bold font-display text-amber-800">
                      Narx belgilanmagan (0 USD)
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      3-blok (Narx) o'tkazib yuborilgan
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-lg sm:text-xl font-bold font-display text-neutral-900">
                      {Math.round(calculatedTotalSum).toLocaleString()}{' '}
                      <span className="text-xs font-semibold text-neutral-600">
                        {currency}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      Formula: {parsedIntakeQty}{' '}
                      {effectiveIntakeUnitType === 'package' ? packageUnitName : pieceUnitName} × narx
                    </div>
                  </>
                )}
              </div>

              {/* 5-qator: Avtomatik umumiy dona va hajm */}
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs">
                <div className="text-[11px] font-bold text-emerald-800 mb-1 uppercase tracking-wide">
                  5-qator: Avtomatik umumiy dona (qoldiq)
                </div>
                <div className="text-lg sm:text-xl font-bold font-display text-neutral-900">
                  {calculatedTotalPieces.toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-neutral-600">
                    dona ({calculatedTotalVolume.toLocaleString()} {baseUnit})
                  </span>
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  {hasPackageUnit
                    ? `1 ${packageUnitName} = ${piecesPerPackage} dona × ${volumePerPiece} ${baseUnit}`
                    : `1 ${pieceUnitName || 'dona'} = ${volumePerPiece} ${baseUnit}`}
                </div>
              </div>
            </div>

            {/* Ixtiyoriy eslatma / izoh */}
            <div className="mt-3.5">
              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                Kirim haqida qo'shimcha izoh (ixtiyoriy)
              </label>
              <input
                type="text"
                disabled={!isBlock4Unlocked}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masalan: 1-partiya, A-omborga joylashtirildi"
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-emerald-600 bg-white"
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* 5-BLOK: ENG KAM SOTILISH NARXI */}
          {/* Agentlar mijozga sotayotganda omborda mahsulot tanlaganda ko'rinadigan narx */}
          {/* ========================================================= */}
          <div
            className={`rounded-2xl border transition p-4 sm:p-5 ${
              isBlock5Unlocked
                ? 'border-indigo-200 bg-indigo-50/20 shadow-xs'
                : 'border-neutral-200 bg-neutral-100/70 opacity-60 pointer-events-none'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3.5 border-b border-indigo-100">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shadow-xs ${
                    isBlock5Unlocked ? 'bg-indigo-700 text-white' : 'bg-neutral-400 text-white'
                  }`}
                >
                  5
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-indigo-700" />
                    <span>5-BLOK: Eng kam sotilish narxi</span>
                    {!isBlock5Unlocked && <Lock className="w-3.5 h-3.5 text-neutral-400" />}
                  </h3>
                  <p className="text-[11px] text-indigo-800 font-medium mt-0.5">
                    Agentlar mijozga mahsulot sotayotganda ombordan tanlaganda aynan shu narx ko'rinib turadi (4-blokdagi kirim narxi emas)
                  </p>
                </div>
              </div>

              {!isBlock5Unlocked ? (
                <span className="text-[10px] text-neutral-500 font-medium">
                  4-blok to'ldirilmaguncha yonmaydi
                </span>
              ) : isBlock5Valid ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  To'ldirildi
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* 1-qator: Eng kam sotilish narx birligi */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  1-qator: Sotilish narx birligi
                </label>
                <select
                  disabled={!isBlock5Unlocked}
                  value={effectiveMinSellingUnitType}
                  onChange={(e) =>
                    setMinSellingPricingUnitType(e.target.value as 'piece' | 'package')
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-indigo-600 bg-white font-medium"
                >
                  <option value="piece">
                    1 {pieceUnitName || 'dona'} uchun eng kam sotilish narxi
                  </option>
                  {hasPackageUnit && (
                    <option value="package">
                      1 {packageUnitName || 'korobka'} uchun eng kam sotilish narxi
                    </option>
                  )}
                </select>
              </div>

              {/* 2-qator: Valyuta avtomatik USD */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  2-qator: Valyuta
                </label>
                <div className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm bg-neutral-100 font-bold font-mono flex items-center justify-between">
                  <span>USD ($)</span>
                  <span className="text-[10px] font-sans font-semibold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                    Avtomatik
                  </span>
                </div>
              </div>

              {/* 3-qator: Eng kam sotilish narxi (USD) */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  3-qator: Eng kam sotilish narxi (USD) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  disabled={!isBlock5Unlocked}
                  min="0.01"
                  step="any"
                  required
                  value={minSellingPrice}
                  onChange={(e) => setMinSellingPrice(e.target.value)}
                  placeholder="Masalan: 35"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 text-neutral-900 text-xs sm:text-sm focus:outline-indigo-600 bg-white font-mono font-bold"
                />
              </div>
            </div>

            {/* Dynamic Calculation breakdown for Block 5 */}
            {isBlock5Valid && (
              <>
                <div className="mt-3 p-3 bg-white rounded-xl border border-indigo-200/90 text-xs text-indigo-950 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div>
                    Agentlarga ko'rinadigan eng kam sotilish narxi:{' '}
                    <strong>
                      {effectiveMinSellingUnitType === 'piece'
                        ? `1 ${pieceUnitName || 'dona'}`
                        : `1 ${packageUnitName || 'korobka'}`}
                    </strong>{' '}
                    ={' '}
                    <span className="font-extrabold font-mono text-indigo-800">
                      {parsedMinSellingPrice.toLocaleString()} {currency}
                    </span>
                  </div>
                  {hasPackageUnit && (
                    <div className="text-[11px] font-mono text-indigo-700 font-semibold">
                      {effectiveMinSellingUnitType === 'piece'
                        ? `(1 ${packageUnitName || 'korobka'} = ${(Math.round(parsedMinSellingPrice * parsedPiecesPerPkg * 100) / 100).toLocaleString()} ${currency})`
                        : `(1 ${pieceUnitName || 'dona'} = ${(Math.round((parsedMinSellingPrice / parsedPiecesPerPkg) * 100) / 100).toLocaleString()} ${currency})`}
                    </div>
                  )}
                </div>

                {/* Sotib olish va Sotish narxini taqqoslash hamda foyda marjasi */}
                <div className="mt-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50/70 via-white to-indigo-50/60 border border-emerald-200 text-xs space-y-2.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 pb-2">
                  <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-700" />
                    <span>Sotib olish va sotish narxini taqqoslash (Foyda marjasi)</span>
                  </span>
                  {costPerPiece > 0 ? (
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-mono font-extrabold text-[11px] border ${
                        marginPercent >= 0
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                    >
                      {marginPercent >= 0
                        ? `+${marginPercent.toFixed(1)}% foyda marjasi`
                        : `${marginPercent.toFixed(1)}% zarar`}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md font-semibold text-[10.5px] bg-amber-100 text-amber-900 border border-amber-200">
                      Kirim (sotib olish) narxi kiritilmagan
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5 text-[11.5px]">
                  <div className="p-2.5 rounded-xl bg-white border border-neutral-200 shadow-2xs">
                    <span className="text-neutral-500 block text-[10px] uppercase font-bold tracking-wide">
                      1. Sotib olish narxi:
                    </span>
                    <span className="font-mono font-bold text-neutral-900 text-xs sm:text-sm">
                      {costPerPiece > 0
                        ? `${costPerPiece.toFixed(2)} USD / dona`
                        : "O'tkazib yuborilgan (0 USD)"}
                    </span>
                    {hasPackageUnit && costPerPiece > 0 && (
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        ({(costPerPiece * parsedPiecesPerPkg).toFixed(2)} USD / {packageUnitName})
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-indigo-200 shadow-2xs">
                    <span className="text-indigo-800 block text-[10px] uppercase font-bold tracking-wide">
                      2. Minimal sotish narxi:
                    </span>
                    <span className="font-mono font-bold text-indigo-950 text-xs sm:text-sm">
                      {sellingPerPiece.toFixed(2)} USD / dona
                    </span>
                    {hasPackageUnit && (
                      <div className="text-[10px] text-indigo-700 font-mono mt-0.5">
                        ({(sellingPerPiece * parsedPiecesPerPkg).toFixed(2)} USD / {packageUnitName})
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-300 shadow-2xs">
                    <span className="text-emerald-900 block text-[10px] uppercase font-bold tracking-wide">
                      3. Sof foyda marjasi:
                    </span>
                    {costPerPiece > 0 ? (
                      <div>
                        <span
                          className={`font-mono font-extrabold text-xs sm:text-sm ${
                            profitPerPiece >= 0 ? 'text-emerald-800' : 'text-rose-700'
                          }`}
                        >
                          {profitPerPiece >= 0
                            ? `+${profitPerPiece.toFixed(2)}`
                            : profitPerPiece.toFixed(2)}{' '}
                          USD / dona
                        </span>
                        {hasPackageUnit && (
                          <div className="text-[10px] font-mono text-emerald-800 font-semibold mt-0.5">
                            ({(profitPerPiece * parsedPiecesPerPkg >= 0 ? '+' : '') +
                              (profitPerPiece * parsedPiecesPerPkg).toFixed(2)}{' '}
                            USD / {packageUnitName})
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono font-semibold text-neutral-600 text-xs">
                        Tannarxsiz (barchasi daromad)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          </div>

          {/* Modal Footer */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-neutral-200 shrink-0">
            <div className="text-xs text-neutral-500 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Kiritilgan mahsulot va eng kam sotilish narxi ombor bazasiga saqlanadi</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs sm:text-sm font-semibold transition min-h-[42px] cursor-pointer"
              >
                Bekor qilish
              </button>

              <button
                type="submit"
                disabled={!isBlock4Unlocked || parsedIntakeQty <= 0 || !isBlock5Valid}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[42px] cursor-pointer"
              >
                {editingProduct ? (
                  <>
                    <Edit3 className="w-4 h-4 stroke-[2.5]" />
                    <span>O'zgarishlarni saqlash</span>
                  </>
                ) : (
                  <>
                    <PackagePlus className="w-4 h-4 stroke-[2.5]" />
                    <span>Kiritish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
