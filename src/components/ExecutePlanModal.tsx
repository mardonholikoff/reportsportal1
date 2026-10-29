import React, { useState } from 'react';
import { DailyPlanItem, PlanActionType, FinancialMethodType, ProductItem } from '../types';
import { formatMoney } from '../utils/format';
import {
  X,
  Phone,
  MapPin,
  CheckCircle,
  CreditCard,
  Package,
  Plus,
  Trash2,
  FileCheck,
  DollarSign,
} from 'lucide-react';

interface Props {
  planItem: DailyPlanItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveReport: (
    planItemId: string,
    report: {
      actionDone: PlanActionType;
      financialAction?: {
        method: FinancialMethodType;
        methodLabel: string;
        amount: number;
        currency?: string;
        note?: string;
      };
      productsDelivered?: ProductItem[];
      reportNote?: string;
    }
  ) => void;
}

const ACTION_OPTIONS: { id: PlanActionType; label: string }[] = [
  { id: 'telefon qilindi', label: 'Telefon qilindi' },
  { id: 'joyiga borildi', label: 'Joyiga borildi' },
  { id: 'telefon qilindi + joyiga borildi', label: 'Telefon qilindi + joyiga borildi' },
];

const FINANCIAL_METHODS: { id: FinancialMethodType; label: string; currency: string }[] = [
  { id: 'naqd_som', label: 'Naqd pul berdi (so\'m)', currency: 'so\'m' },
  { id: 'naqd_valyuta', label: 'Naqd pul berdi (valyuta / USD)', currency: 'USD' },
  { id: 'bank_otkazma', label: 'Bank o\'tkazmasi qildi', currency: 'so\'m' },
  { id: 'karta_otkazma', label: 'Karta o\'tkazmasi qildi', currency: 'so\'m' },
  { id: 'qr_otkazma', label: 'QR o\'tkazmasi qildi', currency: 'so\'m' },
];

const COMMON_UNITS = ['dona', 'kg', 'metr', 'litr', 'qop', 'tonna', 'pachka'];

export const ExecutePlanModal: React.FC<Props> = ({
  planItem,
  isOpen,
  onClose,
  onSaveReport,
}) => {
  const [actionDone, setActionDone] = useState<PlanActionType>('joyiga borildi');
  
  // Financial operation toggle & fields
  const [hasPayment, setHasPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<FinancialMethodType>('naqd_som');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');

  // Products delivered toggle & fields
  const [hasProducts, setHasProducts] = useState(false);
  const [products, setProducts] = useState<ProductItem[]>([
    {
      id: 'prod_' + Math.random().toString(36).substring(2, 6),
      name: '',
      unit: 'dona',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    },
  ]);

  const [reportNote, setReportNote] = useState('');

  if (!isOpen || !planItem) return null;

  const handleAddProductRow = () => {
    setProducts((prev) => [
      ...prev,
      {
        id: 'prod_' + Math.random().toString(36).substring(2, 6),
        name: '',
        unit: 'dona',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
  };

  const handleRemoveProductRow = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, field: keyof ProductItem, value: any) => {
    setProducts((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) || 0 : item.quantity;
        const pr = field === 'unitPrice' ? Number(value) || 0 : item.unitPrice;
        item.totalPrice = Math.max(0, qty * pr);
      }
      copy[index] = item;
      return copy;
    });
  };

  const totalProductsValue = products.reduce(
    (sum, p) => sum + (p.totalPrice || p.quantity * p.unitPrice),
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedMethodObj = FINANCIAL_METHODS.find((m) => m.id === paymentMethod);
    const numAmount = typeof paymentAmount === 'number' ? paymentAmount : Number(paymentAmount) || 0;

    const financialData =
      hasPayment && numAmount > 0
        ? {
            method: paymentMethod,
            methodLabel: selectedMethodObj?.label || 'To\'lov',
            amount: numAmount,
            currency: selectedMethodObj?.currency || 'so\'m',
            note: paymentNote.trim(),
          }
        : undefined;

    const validProducts = hasProducts
      ? products.filter((p) => p.name.trim() !== '')
      : [];

    onSaveReport(planItem.id, {
      actionDone,
      financialAction: financialData,
      productsDelivered: validProducts,
      reportNote: reportNote.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-rose-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/50 border-b border-rose-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-rose-800 bg-rose-100/70 px-2 py-0.5 rounded-md uppercase">
                Kunlik Hisobot
              </span>
              <span className="text-xs text-neutral-500">24 soatlik reja ijrosi</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-display text-neutral-900 mt-1">
              {planItem.clientName}
            </h2>
            <div className="text-xs text-neutral-600 flex items-center gap-2 mt-0.5">
              <span>{planItem.clientPhone}</span>
              {planItem.clientAddress && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-[240px]">{planItem.clientAddress}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center min-h-[44px] min-w-[44px]"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Report Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Plan Note Display if present */}
          {planItem.planNote && (
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 flex items-start gap-2.5">
              <FileCheck className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide block">
                  Reja tuzishdagi izoh / vazifa:
                </span>
                <span className="text-xs text-amber-950 font-semibold">
                  {planItem.planNote}
                </span>
              </div>
            </div>
          )}

          {/* SECTION 1: Qilingan Amal */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wide">
              1. Qilingan amal turi <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setActionDone(opt.id)}
                  className={`p-3 rounded-xl border text-xs font-semibold text-center transition min-h-[44px] cursor-pointer ${
                    actionDone === opt.id
                      ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:border-rose-300 hover:bg-rose-50/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 2: Moliyaviy Amaliyot */}
          <div className="space-y-3 pt-3 border-t border-rose-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-rose-700" />
                <label className="text-xs font-bold text-neutral-800 uppercase tracking-wide cursor-pointer">
                  2. Moliyaviy amaliyot (To'lov qabul qilindimi?)
                </label>
              </div>
              <input
                type="checkbox"
                id="hasPaymentCheck"
                checked={hasPayment}
                onChange={(e) => setHasPayment(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded cursor-pointer"
              />
            </div>

            {hasPayment && (
              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-3 animate-in fade-in duration-100">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    To'lov usuli
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as FinancialMethodType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-900 outline-none"
                  >
                    {FINANCIAL_METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      To'langan summa ({FINANCIAL_METHODS.find((m) => m.id === paymentMethod)?.currency || 'so\'m'}) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      required={hasPayment}
                      min="1"
                      placeholder="Masalan: 450000"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white font-mono font-bold text-sm text-neutral-900 outline-none"
                    />
                    {typeof paymentAmount === 'number' && paymentAmount > 0 && (
                      <div className="text-[11px] font-mono text-rose-800 mt-1">
                        Kiritildi: {formatMoney(paymentAmount)}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      To'lov bo'yicha izoh
                    </label>
                    <input
                      type="text"
                      placeholder="Chek raqami yoki eslatma"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-900 outline-none"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-neutral-600 italic">
                  * Ushbu to'lov mijozning bazadagi joriy qarzdorligini avtomatik kamaytiradi va audit loglarga yoziladi.
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Mahsulot Berildi */}
          <div className="space-y-3 pt-3 border-t border-rose-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-rose-700" />
                <label className="text-xs font-bold text-neutral-800 uppercase tracking-wide cursor-pointer">
                  3. Yangi mahsulot topshirildimi?
                </label>
              </div>
              <input
                type="checkbox"
                id="hasProductsCheck"
                checked={hasProducts}
                onChange={(e) => setHasProducts(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded cursor-pointer"
              />
            </div>

            {hasProducts && (
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800">
                    Topshirilgan mahsulotlar ro'yxati
                  </span>
                  <button
                    type="button"
                    onClick={handleAddProductRow}
                    className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Qator qo'shish</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {products.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="p-3 bg-white rounded-xl border border-neutral-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-neutral-700">
                          Tovar #{idx + 1}
                        </span>
                        {products.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveProductRow(idx)}
                            className="p-1 text-neutral-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Mahsulot nomi (masalan: Sement, Bo'yoq...)"
                        value={p.name}
                        onChange={(e) => handleProductChange(idx, 'name', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-900 outline-none"
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-neutral-500">O'lchov</label>
                          <input
                            type="text"
                            list={`exec_units_${idx}`}
                            value={p.unit}
                            onChange={(e) => handleProductChange(idx, 'unit', e.target.value)}
                            className="w-full px-2 py-1 rounded-lg border border-neutral-200 text-xs"
                          />
                          <datalist id={`exec_units_${idx}`}>
                            {COMMON_UNITS.map((u) => (
                              <option key={u} value={u} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label className="block text-[10px] text-neutral-500">Miqdor</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={p.quantity || ''}
                            onChange={(e) => handleProductChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded-lg border border-neutral-200 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-neutral-500">Birlik narxi</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={p.unitPrice || ''}
                            onChange={(e) => handleProductChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded-lg border border-neutral-200 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="text-right text-[11px] font-mono font-bold text-neutral-900 pt-1">
                        Jami: {formatMoney((p.quantity || 0) * (p.unitPrice || 0))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-200 font-bold text-xs">
                  <span>Mahsulotlar umumiy summasi:</span>
                  <span className="font-mono text-rose-900">{formatMoney(totalProductsValue)}</span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: Umumiy izoh / hisobot qaydi */}
          <div className="space-y-1.5 pt-2 border-t border-rose-100">
            <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wide">
              4. Qo'shimcha hisobot qaydi / xulosa
            </label>
            <textarea
              rows={2}
              placeholder="Mijoz bilan nima kelishildi, keyingi tashrif sanasi yoki boshqa qaydlar..."
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs text-neutral-900 outline-none"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition min-h-[44px]"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs transition min-h-[44px] flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4 stroke-[2.5]" />
              <span>Hisobotni saqlash va yangilash</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
