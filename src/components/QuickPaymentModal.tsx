import React, { useState, useEffect, useMemo } from 'react';
import { Client, FinancialMethodType } from '../types';
import { formatMoney } from '../utils/format';
import { X, Calculator } from 'lucide-react';

const PAYMENT_METHODS: { id: FinancialMethodType; label: string }[] = [
  { id: 'naqd', label: 'Naqd pul' },
  { id: 'karta_otkazma', label: "Karta o'tkazmasi" },
  { id: 'bank_otkazma', label: "Bank o'tkazmasi" },
  { id: 'qr_otkazma', label: "QR to'lov" },
];

export interface QuickPaymentConversionMeta {
  amountUzs?: number;
  exchangeRate?: number;
  purpose?: 'payment' | 'product';
  paymentMethodLabel?: string;
  usdAmount?: number;
}

interface Props {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onSavePayment: (
    clientId: string,
    newDebt: number,
    newAdvance: number,
    noteAddition: string,
    conversionMeta?: QuickPaymentConversionMeta
  ) => void;
}

export const QuickPaymentModal: React.FC<Props> = ({
  client,
  isOpen,
  onClose,
  onSavePayment,
}) => {
  const [mode, setMode] = useState<'pay_debt' | 'add_debt' | 'advance'>('pay_debt');
  const [paymentMethod, setPaymentMethod] = useState<FinancialMethodType>('naqd');
  const [isUzsMode, setIsUzsMode] = useState<boolean>(false);
  const [amountUzs, setAmountUzs] = useState<number | ''>('');
  const [exchangeRate, setExchangeRate] = useState<string>(() => {
    try {
      return localStorage.getItem('savdo_usd_uzs_rate_v1') || '12800';
    } catch {
      return '12800';
    }
  });
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setAmount('');
    setAmountUzs('');
    setIsUzsMode(false);
    setPaymentMethod('naqd');
    setNote('');
    if (client && client.currentDebt > 0) {
      setMode('pay_debt');
    } else {
      setMode('advance');
    }
  }, [client, isOpen]);

  const numRate = useMemo(() => {
    const r = parseFloat(exchangeRate);
    return r > 0 ? r : 12800;
  }, [exchangeRate]);

  if (!isOpen || !client) return null;

  const currentDebt = client.currentDebt;
  const currentAdvance = client.currentAdvance;
  const numAmount = typeof amount === 'number' ? amount : Number(amount) || 0;
  const numAmountUzs = typeof amountUzs === 'number' ? amountUzs : Number(amountUzs) || 0;

  let calculatedNewDebt = currentDebt;
  let calculatedNewAdvance = currentAdvance;

  if (mode === 'pay_debt') {
    if (numAmount <= currentDebt) {
      calculatedNewDebt = Math.round((currentDebt - numAmount) * 100) / 100;
    } else {
      calculatedNewDebt = 0;
      calculatedNewAdvance = Math.round((currentAdvance + (numAmount - currentDebt)) * 100) / 100;
    }
  } else if (mode === 'add_debt') {
    calculatedNewDebt = Math.round((currentDebt + numAmount) * 100) / 100;
  } else if (mode === 'advance') {
    calculatedNewAdvance = Math.round((currentAdvance + numAmount) * 100) / 100;
  }

  const selectedMethodLabel =
    PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label || 'Naqd pul';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) return;

    const effectiveUzs =
      isUzsMode
        ? numAmountUzs > 0
          ? Math.round(numAmountUzs)
          : Math.round(numAmount * numRate)
        : 0;

    const uzsConvStr =
      isUzsMode && effectiveUzs > 0
        ? ` [${new Intl.NumberFormat('uz-UZ').format(effectiveUzs)} so'm, kurs: 1$ = ${new Intl.NumberFormat('uz-UZ').format(numRate)} so'm]`
        : '';

    let actionLabel = '';
    if (mode === 'pay_debt') {
      actionLabel = `Qarz to'landi (${selectedMethodLabel}): ${formatMoney(numAmount)}${uzsConvStr}`;
    } else if (mode === 'add_debt') {
      actionLabel = `Yangi qarz qo'shildi: ${formatMoney(numAmount)}${uzsConvStr}`;
    } else {
      actionLabel = `Avans to'landi (${selectedMethodLabel}): ${formatMoney(numAmount)}${uzsConvStr}`;
    }

    const fullNote = note.trim() ? `${actionLabel} (${note.trim()})` : actionLabel;

    const conversionMeta: QuickPaymentConversionMeta | undefined =
      isUzsMode && effectiveUzs > 0
        ? {
            amountUzs: effectiveUzs,
            exchangeRate: numRate,
            purpose: 'payment',
            paymentMethodLabel: mode === 'add_debt' ? "Qarz qo'shish" : selectedMethodLabel,
            usdAmount: numAmount,
          }
        : undefined;

    onSavePayment(client.id, calculatedNewDebt, calculatedNewAdvance, fullNote, conversionMeta);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-50 to-white border-b border-rose-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold font-display text-neutral-900">
              Hisob-kitob amaliyoti (USD)
            </h3>
            <p className="text-xs text-neutral-600 truncate max-w-[260px]">
              Mijoz: <span className="font-semibold text-neutral-900">{client.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border border-neutral-200 text-neutral-600 hover:text-neutral-900 flex items-center justify-center min-h-[36px] min-w-[36px] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Balances preview */}
        <div className="grid grid-cols-2 gap-2 p-4 bg-rose-50/40 border-b border-rose-100 text-xs shrink-0">
          <div>
            <span className="text-neutral-500 block text-[11px]">Hozirgi qarz:</span>
            <span className="font-bold font-mono text-rose-800 text-sm">
              {formatMoney(currentDebt)}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[11px]">Hozirgi avans:</span>
            <span className="font-bold font-mono text-emerald-800 text-sm">
              {formatMoney(currentAdvance)}
            </span>
          </div>
        </div>

        {/* Action Type Tabs */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('pay_debt')}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors min-h-[36px] cursor-pointer ${
                mode === 'pay_debt'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Qarz to'lash
            </button>
            <button
              type="button"
              onClick={() => setMode('advance')}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors min-h-[36px] cursor-pointer ${
                mode === 'advance'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Avans olish
            </button>
            <button
              type="button"
              onClick={() => setMode('add_debt')}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors min-h-[36px] cursor-pointer ${
                mode === 'add_debt'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Qarz qo'shish
            </button>
          </div>

          {/* To'lov turi (Qarz to'lash yoki Avans olishda) */}
          {mode !== 'add_debt' && (
            <div>
              <label className="block text-[11px] font-bold text-neutral-700 mb-1.5">
                To'lov turi:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                      paymentMethod === pm.id
                        ? 'bg-rose-700 text-white border-rose-700 shadow-2xs'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-rose-50/50'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* So'mda (UZS) bo'lsa kurs kiritib dollarga ($) o'tkazish opsiyasi */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              isUzsMode
                ? 'bg-amber-50/90 border-amber-300 shadow-2xs'
                : 'bg-neutral-50/70 border-neutral-200'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label
                htmlFor="quickPayIsUzsMode"
                className="flex items-center gap-2.5 cursor-pointer select-none"
              >
                <input
                  id="quickPayIsUzsMode"
                  type="checkbox"
                  checked={isUzsMode}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsUzsMode(checked);
                    if (checked && numRate > 0 && numAmount > 0 && numAmountUzs <= 0) {
                      setAmountUzs(Math.round(numAmount * numRate));
                    }
                  }}
                  className="w-4 h-4 text-amber-600 rounded border-neutral-300 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-extrabold text-neutral-900 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-amber-700" />
                    <span>So'mda (UZS) bo'lsa, kursni kiritib dollarga ($) o'tkazish</span>
                  </span>
                  <span className="block text-[10px] text-neutral-500">
                    {isUzsMode
                      ? "So'mda summa va kursni kiriting — tizim avtomatik dollarga ($) o'giradi"
                      : "Tanlanmagan: summa avtomatik ravishda dollarda ($) kiritiladi"}
                  </span>
                </div>
              </label>
            </div>

            {isUzsMode && (
              <div className="mt-3 pt-2.5 border-t border-amber-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    So'mdagi summa (UZS) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Masalan: 1280000"
                    value={amountUzs}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setAmountUzs('');
                        setAmount('');
                      } else {
                        const uzsVal = parseFloat(raw) || 0;
                        setAmountUzs(uzsVal);
                        if (numRate > 0) {
                          setAmount(Math.round((uzsVal / numRate) * 100) / 100);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-mono font-bold text-sm text-neutral-900 outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    1$ kursi (so'm) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={exchangeRate}
                    onChange={(e) => {
                      const rawRate = e.target.value;
                      setExchangeRate(rawRate);
                      const parsed = parseFloat(rawRate);
                      if (parsed > 0) {
                        try {
                          localStorage.setItem('savdo_usd_uzs_rate_v1', rawRate);
                        } catch {
                          // ignore
                        }
                        if (numAmountUzs > 0) {
                          setAmount(Math.round((numAmountUzs / parsed) * 100) / 100);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-mono font-bold text-sm text-neutral-900 outline-none focus:border-amber-600"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-800 mb-1">
              {isUzsMode ? 'Dollarda ($) hisoblangan summa (USD)' : 'Summa (USD)'}{' '}
              <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              required
              placeholder="Masalan: 100"
              value={amount}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setAmount('');
                  if (isUzsMode) setAmountUzs('');
                } else {
                  const usdVal = parseFloat(raw) || 0;
                  setAmount(usdVal);
                  if (isUzsMode && numRate > 0) {
                    setAmountUzs(Math.round(usdVal * numRate));
                  }
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-rose-500 text-base font-bold font-mono text-neutral-900 outline-none tabular-nums"
            />
            {numAmount > 0 && (
              <div className="mt-1 text-xs text-neutral-600 font-mono">
                {isUzsMode && numAmountUzs > 0
                  ? `${new Intl.NumberFormat('uz-UZ').format(numAmountUzs)} so'm ÷ ${new Intl.NumberFormat('uz-UZ').format(numRate)} = ${formatMoney(numAmount)}`
                  : `Kiritildi: ${formatMoney(numAmount)}`}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-800 mb-1">
              Izoh (ixtiyoriy)
            </label>
            <input
              type="text"
              placeholder="Masalan: Chek raqami yoki qo'shimcha ma'lumot"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 focus:border-rose-500 text-xs text-neutral-900 outline-none"
            />
          </div>

          {/* Result preview */}
          {numAmount > 0 && (
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1">
              <div className="text-[11px] font-bold text-neutral-600 uppercase">
                Amaliyotdan keyingi holat:
              </div>
              <div className="flex justify-between">
                <span>Yangi qarzdorlik:</span>
                <span className="font-bold font-mono text-rose-800">
                  {formatMoney(calculatedNewDebt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Yangi avans:</span>
                <span className="font-bold font-mono text-emerald-800">
                  {formatMoney(calculatedNewAdvance)}
                </span>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition min-h-[44px] cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={numAmount <= 0}
              className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              Tasdiqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

