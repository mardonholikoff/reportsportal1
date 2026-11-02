import React, { useState, useEffect, useMemo } from 'react';
import { WarehouseProduct, MonthlyPlanTarget, MonthlyPlan } from '../types';
import { formatMoney } from '../utils/format';
import { storageService } from '../services/storage';
import { X, Calendar, Target, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  warehouseProducts: WarehouseProduct[];
  currentUsername: string;
  existingPlan?: MonthlyPlan | null;
  onSavePlan: (
    targets: MonthlyPlanTarget[],
    startDate: string,
    endDate: string,
    notes?: string
  ) => void;
}

export const CreateMonthlyPlanModal: React.FC<Props> = ({
  isOpen,
  onClose,
  existingPlan,
  onSavePlan,
}) => {
  // Default start date (today) and end date (+30 days / 1 month)
  const defaultDates = useMemo(() => {
    const now = new Date();
    const start = now.toISOString().slice(0, 10);
    const nextMonth = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const end = nextMonth.toISOString().slice(0, 10);
    return { start, end };
  }, []);

  // Calculate existing clients' current total debt at this moment
  const currentExistingTotalDebt = useMemo(() => {
    if (!isOpen) return 0;
    const allClients = storageService.getClients();
    const total = allClients.reduce((sum, c) => sum + (c.currentDebt > 0 ? c.currentDebt : 0), 0);
    return Math.round(total * 100) / 100;
  }, [isOpen]);

  const [targetAmount, setTargetAmount] = useState<number | ''>('');
  const [startDate, setStartDate] = useState<string>(defaultDates.start);
  const [endDate, setEndDate] = useState<string>(defaultDates.end);
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (existingPlan && existingPlan.targets.length > 0) {
        setTargetAmount(
          existingPlan.targets[0].targetAmount > 0
            ? existingPlan.targets[0].targetAmount
            : currentExistingTotalDebt || ''
        );
        setStartDate(existingPlan.startDate || defaultDates.start);
        setEndDate(existingPlan.endDate || defaultDates.end);
        setNotes(existingPlan.notes || '');
      } else {
        setTargetAmount(currentExistingTotalDebt > 0 ? currentExistingTotalDebt : '');
        setStartDate(defaultDates.start);
        setEndDate(defaultDates.end);
        setNotes('');
      }
    }
  }, [isOpen, existingPlan, defaultDates, currentExistingTotalDebt]);

  if (!isOpen) return null;

  const setPresetDuration = (days: number) => {
    const startObj = startDate ? new Date(startDate) : new Date();
    const endObj = new Date(startObj.getTime() + days * 24 * 3600 * 1000);
    setEndDate(endObj.toISOString().slice(0, 10));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numAmt = typeof targetAmount === 'number' ? targetAmount : Number(targetAmount) || 0;
    const finalTargetAmount = numAmt > 0 ? numAmt : currentExistingTotalDebt;

    if (finalTargetAmount <= 0) {
      setErrorMsg('Iltimos, reja summasini (USD) kiriting!');
      return;
    }

    if (!startDate || !endDate) {
      setErrorMsg('Reja amal qilish muddatini (boshlanish va tugash sanasini) tanlang!');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg("Tugash sanasi boshlanish sanasidan keyin bo'lishi kerak!");
      return;
    }

    onSavePlan(
      [{ currency: 'USD', targetAmount: finalTargetAmount }],
      startDate,
      endDate,
      notes.trim() || undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-800 via-rose-700 to-rose-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white border border-white/20">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display leading-tight">
                1 oylik qarz undirish rejasini tuzish
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer min-h-[36px] min-w-[36px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mavjud eski qarzdorlik ma'lumoti va USD Summa */}
          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-700">
                Hozirgi mavjud mijozlar umumiy qarzi:
              </span>
              <span className="font-bold font-mono text-rose-900 text-sm">
                {formatMoney(currentExistingTotalDebt)}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Summa (USD) <span className="text-rose-600">*</span>
                </label>
                {currentExistingTotalDebt > 0 && (
                  <button
                    type="button"
                    onClick={() => setTargetAmount(currentExistingTotalDebt)}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                  >
                    Joriy umumiy qarzni qo'yish ({formatMoney(currentExistingTotalDebt)})
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={targetAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTargetAmount(val === '' ? '' : Math.max(0, parseFloat(val)));
                  }}
                  placeholder="Masalan: 10000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-sm sm:text-base font-bold font-mono focus:outline-rose-600 bg-white tabular-nums pr-16"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                  USD
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
                * Reja foizi faqat hozirgi mavjud (eski) qarzdorliklar yopilganda ko'payadi. Reja tuzilgandan keyin qo'shilgan yangi qarzlar ushbu foizga ta'sir qilmaydi.
              </p>
            </div>
          </div>

          {/* Muddat tanlash */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-700" />
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 uppercase tracking-wide">
                  Reja muddati (Sana oralig'i)
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPresetDuration(15)}
                  className="px-2 py-1 rounded-lg bg-white border border-neutral-200 hover:border-rose-300 text-[11px] font-semibold text-neutral-700 cursor-pointer"
                >
                  15 kun
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDuration(30)}
                  className="px-2 py-1 rounded-lg bg-rose-100 border border-rose-300 text-[11px] font-bold text-rose-900 cursor-pointer"
                >
                  1 oy (30 kun)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Boshlanish sanasi <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-mono font-semibold text-neutral-900 bg-white focus:outline-rose-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Tugash sanasi <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-mono font-semibold text-neutral-900 bg-white focus:outline-rose-600"
                  required
                />
              </div>
            </div>
          </div>

          {/* Ixtiyoriy izoh */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Qo'shimcha izoh (Ixtiyoriy)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Masalan: Oylik qarz undirish maqsadi..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white focus:outline-rose-600"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 text-xs sm:text-sm font-semibold hover:bg-neutral-100 transition cursor-pointer min-h-[42px]"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer min-h-[42px] flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Saqlash</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
