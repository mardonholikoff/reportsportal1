import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import { formatMoney } from '../utils/format';
import { X, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';

interface Props {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onSavePayment: (
    clientId: string,
    newDebt: number,
    newAdvance: number,
    noteAddition: string
  ) => void;
}

export const QuickPaymentModal: React.FC<Props> = ({
  client,
  isOpen,
  onClose,
  onSavePayment,
}) => {
  const [mode, setMode] = useState<'pay_debt' | 'add_debt' | 'advance'>('pay_debt');
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setAmount('');
    setNote('');
    if (client && client.currentDebt > 0) {
      setMode('pay_debt');
    } else {
      setMode('advance');
    }
  }, [client, isOpen]);

  if (!isOpen || !client) return null;

  const currentDebt = client.currentDebt;
  const currentAdvance = client.currentAdvance;
  const numAmount = typeof amount === 'number' ? amount : Number(amount) || 0;

  let calculatedNewDebt = currentDebt;
  let calculatedNewAdvance = currentAdvance;

  if (mode === 'pay_debt') {
    if (numAmount <= currentDebt) {
      calculatedNewDebt = currentDebt - numAmount;
    } else {
      calculatedNewDebt = 0;
      calculatedNewAdvance = currentAdvance + (numAmount - currentDebt);
    }
  } else if (mode === 'add_debt') {
    calculatedNewDebt = currentDebt + numAmount;
  } else if (mode === 'advance') {
    calculatedNewAdvance = currentAdvance + numAmount;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) return;

    let actionLabel = '';
    if (mode === 'pay_debt') {
      actionLabel = `Qarz to'landi: ${formatMoney(numAmount)}`;
    } else if (mode === 'add_debt') {
      actionLabel = `Yangi qarz qo'shildi: ${formatMoney(numAmount)}`;
    } else {
      actionLabel = `Avans to'landi: ${formatMoney(numAmount)}`;
    }

    const fullNote = note ? `${actionLabel} (${note})` : actionLabel;
    onSavePayment(client.id, calculatedNewDebt, calculatedNewAdvance, fullNote);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-50 to-white border-b border-rose-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold font-display text-neutral-900">
              Hisob-kitob amaliyati
            </h3>
            <p className="text-xs text-neutral-600 truncate max-w-[260px]">
              Mijoz: <span className="font-semibold text-neutral-900">{client.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border border-neutral-200 text-neutral-600 hover:text-neutral-900 flex items-center justify-center min-h-[36px] min-w-[36px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Balances preview */}
        <div className="grid grid-cols-2 gap-2 p-4 bg-rose-50/40 border-b border-rose-100 text-xs">
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('pay_debt')}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors min-h-[36px] ${
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
              className={`py-2 text-xs font-semibold rounded-lg transition-colors min-h-[36px] ${
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
              className={`py-2 text-xs font-semibold rounded-lg transition-colors min-h-[36px] ${
                mode === 'add_debt'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Qarz qo'shish
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-800 mb-1">
              Summa (so'm) <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              min="1"
              required
              placeholder="Masalan: 500000"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-rose-500 text-base font-bold font-mono text-neutral-900 outline-none tabular-nums"
              autoFocus
            />
            {numAmount > 0 && (
              <div className="mt-1 text-xs text-neutral-600 font-mono">
                Kiritildi: {formatMoney(numAmount)}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-800 mb-1">
              Izoh (ixtiyoriy)
            </label>
            <input
              type="text"
              placeholder="Masalan: Naqd pul / Karta orqali o'tkazildi"
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
              className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition min-h-[44px]"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={numAmount <= 0}
              className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 min-h-[44px]"
            >
              Tasdiqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
