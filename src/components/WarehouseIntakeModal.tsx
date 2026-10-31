import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { WarehouseProduct } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<WarehouseProduct, 'id' | 'createdAt'>) => void;
  currentUsername: string;
}

export const WarehouseIntakeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  currentUsername,
}) => {
  // Helper for today's date in YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
  // 2.2:
  const [packageUnitName, setPackageUnitName] = useState('korobka'); // korobka, qop, blok, yashik...
  const [piecesPerPackage, setPiecesPerPackage] = useState<string>('4'); // e.g. 4

  // 3-BLOK: Narx
  const [pricingUnitType, setPricingUnitType] = useState<'piece' | 'package'>('piece');
  const [currency, setCurrency] = useState<string>("so'm");
  const [price, setPrice] = useState<string>('380000');

  // 4-BLOK: Omborga kirim
  const [intakeDate, setIntakeDate] = useState<string>(todayStr);
  const [intakeUnitType, setIntakeUnitType] = useState<'package' | 'piece'>('package');
  const [intakeQuantity, setIntakeQuantity] = useState<string>('10');
  const [notes, setNotes] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);

  // =========================================================
  // Progressive Unlocking Chain:
  // 1-blok to'lmaguncha 2-blok, 2-blok to'lmaguncha 3-blok, 3-blok to'lmaguncha 4-blok yonmaydi
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

  // 2.2: faqat 2.1 to'lsa ochiladi
  const isBlock22Valid = useMemo(() => {
    if (!isBlock21Valid) return false;
    const count = parseInt(piecesPerPackage, 10);
    return packageUnitName.trim().length > 0 && !isNaN(count) && count > 0;
  }, [isBlock21Valid, packageUnitName, piecesPerPackage]);

  // Butun 2-blok to'liq to'ldirilganligi
  const isBlock2Valid = isBlock2Unlocked && isBlock21Valid && isBlock22Valid;

  // 3-blok faqat 2-blok to'lsa ochiladi
  const isBlock3Unlocked = isBlock2Valid;

  // 3-blok validligi: narx musbat va valyuta kiritilgan
  const isBlock3Valid = useMemo(() => {
    if (!isBlock3Unlocked) return false;
    const pr = parseFloat(price);
    return !isNaN(pr) && pr > 0 && currency.trim().length > 0;
  }, [isBlock3Unlocked, price, currency]);

  // 4-blok faqat 3-blok to'lsa ochiladi
  const isBlock4Unlocked = isBlock3Valid;

  // Real-time Calculations for Block 4
  const parsedIntakeQty = parseFloat(intakeQuantity) || 0;
  const parsedPrice = parseFloat(price) || 0;
  const parsedPiecesPerPkg = parseInt(piecesPerPackage, 10) || 1;
  const parsedVolumePerPiece = parseFloat(volumePerPiece) || 0;

  // Total Pieces and Total Volume
  const calculatedTotalPieces = useMemo(() => {
    if (intakeUnitType === 'package') {
      return parsedIntakeQty * parsedPiecesPerPkg;
    }
    return parsedIntakeQty;
  }, [intakeUnitType, parsedIntakeQty, parsedPiecesPerPkg]);

  const calculatedTotalVolume = useMemo(() => {
    return calculatedTotalPieces * parsedVolumePerPiece;
  }, [calculatedTotalPieces, parsedVolumePerPiece]);

  // Total Sum
  const calculatedTotalSum = useMemo(() => {
    if (pricingUnitType === 'package') {
      if (intakeUnitType === 'package') {
        return parsedIntakeQty * parsedPrice;
      } else {
        return (parsedIntakeQty * parsedPrice) / parsedPiecesPerPkg;
      }
    } else {
      if (intakeUnitType === 'package') {
        return parsedIntakeQty * parsedPiecesPerPkg * parsedPrice;
      } else {
        return parsedIntakeQty * parsedPrice;
      }
    }
  }, [pricingUnitType, intakeUnitType, parsedIntakeQty, parsedPrice, parsedPiecesPerPkg]);

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
      setFormError("2-blokda katta o'lcham (korobka/qop) va undagi dona sonini to'ldiring!");
      return;
    }
    if (!isBlock3Valid) {
      setFormError('3-blokda narx summasi va valyutani kiriting!');
      return;
    }
    if (parsedIntakeQty <= 0) {
      setFormError('4-blokda qabul qilinayotgan mahsulot sonini musbat kiriting!');
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
      packageUnitName: packageUnitName.trim(),
      piecesPerPackage: parsedPiecesPerPkg,
      pricingUnitType,
      currency: currency.trim() || "so'm",
      price: parsedPrice,
      intakeDate: intakeDate || todayStr,
      intakeUnitType,
      intakeQuantity: parsedIntakeQty,
      totalSum: Math.round(calculatedTotalSum),
      totalPieces: calculatedTotalPieces,
      totalVolume: calculatedTotalVolume,
      createdBy: currentUsername || 'adminc',
      notes: notes.trim() || undefined,
    };

    onSave(payload);
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
              <PackagePlus className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white">
                Omborga mahsulotlar kiritish
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

        {/* Modal Body with 4 strictly conditioned blocks */}
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

            {/* 2.2-Kichik blok: Ochilish sharti: 2.1 to'lgandan keyin ochiladi */}
            <div
              className={`rounded-xl p-3.5 border transition ${
                isBlock21Valid
                  ? 'bg-white border-neutral-200/80 shadow-xs'
                  : 'bg-neutral-100/70 border-neutral-200 text-neutral-400 opacity-60 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  {!isBlock21Valid && <Lock className="w-3.5 h-3.5 text-neutral-400" />}
                  <span>2.2-kichik blok: Katta o'lcham (korobka / qop / blok)</span>
                </span>
                {!isBlock21Valid && (
                  <span className="text-[10px] text-neutral-500 font-medium">
                    2.1 to'ldirilgach ochiladi
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1-qator: O'lcham (korobka, qop va hk) */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    1-qator: O'lcham nomi <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isBlock21Valid}
                    value={packageUnitName}
                    onChange={(e) => setPackageUnitName(e.target.value)}
                    placeholder="Masalan: korobka, qop, blok, yashik"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-rose-600 bg-white disabled:bg-neutral-100"
                  />
                  <div className="flex gap-1 mt-1 text-[10px] text-neutral-500">
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
                  </div>
                </div>

                {/* 2-qator: Dona soni */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    2-qator: Dona soni <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    disabled={!isBlock21Valid}
                    min="1"
                    step="1"
                    value={piecesPerPackage}
                    onChange={(e) => setPiecesPerPackage(e.target.value)}
                    placeholder="Masalan: 4 yoki 5 dona"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-rose-600 bg-white disabled:bg-neutral-100"
                  />
                </div>
              </div>

              {/* 2.2 Nisbat ko'rsatkichi (Xulosa va tayyor chiqariladi so'zlarisiz) */}
              {isBlock22Valid && (
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
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3-BLOK: NARX */}
          {/* Shart: 2-blok to'ldirilmaguncha yonmaydi */}
          {/* ========================================================= */}
          <div
            className={`rounded-2xl border transition p-4 sm:p-5 ${
              isBlock3Unlocked
                ? 'border-neutral-200 bg-white shadow-xs'
                : 'border-neutral-200 bg-neutral-100/70 opacity-60 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-3.5 border-b border-neutral-200">
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
                  <span>3-BLOK: Narx</span>
                  {!isBlock3Unlocked && <Lock className="w-3.5 h-3.5 text-neutral-400" />}
                </h3>
              </div>
              {isBlock3Valid ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  To'ldirildi
                </span>
              ) : (
                <span className="text-[10px] text-neutral-500 font-medium">
                  2-blok to'ldirilmaguncha yonmaydi
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* 1-qator: 2-blok ichidagi birlik tanlanadi (dona yoki korobka) */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  1-qator: Narx birligi <span className="text-rose-600">*</span>
                </label>
                <select
                  disabled={!isBlock3Unlocked}
                  value={pricingUnitType}
                  onChange={(e) => setPricingUnitType(e.target.value as 'piece' | 'package')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-rose-600 bg-white"
                >
                  <option value="piece">
                    1 {pieceUnitName || 'dona'} uchun narx
                  </option>
                  <option value="package">
                    1 {packageUnitName || 'korobka'} uchun narx
                  </option>
                </select>
              </div>

              {/* 2-qator: Valyutani qo'lda kiritish va tez tanlash imkoniyati */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  2-qator: Valyuta <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={!isBlock3Unlocked}
                    list="currency_suggestions_list"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    placeholder="so'm, USD, EUR..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-rose-600 bg-white font-medium"
                  />
                  <datalist id="currency_suggestions_list">
                    <option value="so'm" />
                    <option value="USD" />
                    <option value="EUR" />
                    <option value="RUB" />
                  </datalist>
                </div>
                <div className="flex gap-1.5 mt-1 text-[10px] text-neutral-500">
                  <span
                    onClick={() => setCurrency("so'm")}
                    className="cursor-pointer underline hover:text-rose-700"
                  >
                    so'm
                  </span>
                  <span>•</span>
                  <span
                    onClick={() => setCurrency("USD")}
                    className="cursor-pointer underline hover:text-rose-700"
                  >
                    USD
                  </span>
                  <span>•</span>
                  <span
                    onClick={() => setCurrency("EUR")}
                    className="cursor-pointer underline hover:text-rose-700"
                  >
                    EUR
                  </span>
                  <span>•</span>
                  <span
                    onClick={() => setCurrency("RUB")}
                    className="cursor-pointer underline hover:text-rose-700"
                  >
                    RUB
                  </span>
                </div>
              </div>

              {/* 3-qator: Summasi yoziladi */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  3-qator: Summasi (narx) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  disabled={!isBlock3Unlocked}
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Masalan: 380000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-rose-600 bg-white"
                />
              </div>
            </div>

            {/* Dynamic Calculation breakdown */}
            {isBlock3Valid && (
              <div className="mt-3 p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs text-neutral-700 flex flex-wrap items-center justify-between gap-2">
                <div>
                  Tanlangan:{' '}
                  <strong>
                    {pricingUnitType === 'piece'
                      ? `1 ${pieceUnitName || 'dona'}`
                      : `1 ${packageUnitName || 'korobka'}`}
                  </strong>{' '}
                  ={' '}
                  <span className="font-bold text-neutral-900">
                    {parsedPrice.toLocaleString()} {currency}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500">
                  {pricingUnitType === 'piece'
                    ? `(1 ${packageUnitName || 'korobka'} = ${(parsedPrice * parsedPiecesPerPkg).toLocaleString()} ${currency})`
                    : `(1 ${pieceUnitName || 'dona'} = ${Math.round(parsedPrice / parsedPiecesPerPkg).toLocaleString()} ${currency})`}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 4-BLOK: OMBORGA KIRIM BLOKI */}
          {/* Shart: 3-blok to'ldirilmaguncha yonmaydi */}
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
                  3-blok to'ldirilmaguncha yonmaydi
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
                  value={intakeUnitType}
                  onChange={(e) => setIntakeUnitType(e.target.value as 'package' | 'piece')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-emerald-600 bg-white font-medium"
                >
                  <option value="package">
                    {packageUnitName || 'korobka'} (avtomatik tanlangan)
                  </option>
                  <option value="piece">{pieceUnitName || 'dona'}</option>
                </select>
              </div>

              {/* 3-qator: Soni tanlanadi */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  3-qator: Kirim soni <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  disabled={!isBlock4Unlocked}
                  min="1"
                  step="any"
                  value={intakeQuantity}
                  onChange={(e) => setIntakeQuantity(e.target.value)}
                  placeholder="Masalan: 10"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs sm:text-sm focus:outline-emerald-600 bg-white font-semibold"
                />
              </div>
            </div>

            {/* 4 va 5-qatorlar: Avtomatik hisoblangan umumiy summa va umumiy dona */}
            <div className="mt-4 pt-3 border-t border-emerald-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 4-qator: Avtomatik umumiy summa */}
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs">
                <div className="text-[11px] font-bold text-emerald-800 mb-1 uppercase tracking-wide">
                  4-qator: Avtomatik umumiy summa
                </div>
                <div className="text-lg sm:text-xl font-bold font-display text-neutral-900">
                  {Math.round(calculatedTotalSum).toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-neutral-600">
                    {currency}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  Formula: {parsedIntakeQty}{' '}
                  {intakeUnitType === 'package' ? packageUnitName : pieceUnitName} × narx
                </div>
              </div>

              {/* 5-qator: Avtomatik umumiy dona va hajm */}
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs">
                <div className="text-[11px] font-bold text-emerald-800 mb-1 uppercase tracking-wide">
                  5-qator: Avtomatik umumiy dona
                </div>
                <div className="text-lg sm:text-xl font-bold font-display text-neutral-900">
                  {calculatedTotalPieces.toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-neutral-600">
                    dona ({calculatedTotalVolume.toLocaleString()} {baseUnit})
                  </span>
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  1 {packageUnitName} = {piecesPerPackage} dona × {volumePerPiece} {baseUnit}
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

          {/* Modal Footer */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-neutral-200 shrink-0">
            <div className="text-xs text-neutral-500 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Kiritilgan mahsulot ombor bazasiga saqlanadi</span>
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
                disabled={!isBlock4Unlocked || parsedIntakeQty <= 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[42px] cursor-pointer"
              >
                <PackagePlus className="w-4 h-4 stroke-[2.5]" />
                <span>Kiritish</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
