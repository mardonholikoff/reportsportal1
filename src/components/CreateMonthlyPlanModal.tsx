import React, { useState, useEffect, useMemo } from 'react';
import { WarehouseProduct, MonthlyPlan, MonthlyPlanTarget } from '../types';
import { formatMoney } from '../utils/format';
import { X, Target, Plus, Trash2, Calendar, CheckCircle2, DollarSign } from 'lucide-react';

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

interface TargetRow {
  id: string;
  currency: string;
  amount: number | '';
}

export const CreateMonthlyPlanModal: React.FC<Props> = ({
  isOpen,
  onClose,
  warehouseProducts,
  currentUsername,
  existingPlan,
  onSavePlan,
}) => {
  // Extract unique currencies from warehouse products
  const warehouseCurrencies = useMemo(() => {
    const set = new Set<string>();
    warehouseProducts.forEach((p) => {
      if (p.currency && p.currency.trim()) {
        set.add(p.currency.trim());
      }
    });
    if (set.size === 0) {
      set.add('USD');
      set.add("so'm");
    }
    return Array.from(set);
  }, [warehouseProducts]);

  const [rows, setRows] = useState<TargetRow[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const defaultCurr = warehouseCurrencies[0] || 'USD';
      const now = new Date();
      const startStr = now.toISOString().slice(0, 10);
      const endMonth = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

      if (existingPlan && existingPlan.targets && existingPlan.targets.length > 0) {
        setRows(
          existingPlan.targets.map((t, idx) => ({
            id: `row_${idx}_${Date.now()}`,
            currency: t.currency || defaultCurr,
            amount: t.targetAmount,
          }))
        );
        setStartDate(existingPlan.startDate || startStr);
        setEndDate(existingPlan.endDate || endMonth);
        setNotes(existingPlan.notes || '');
      } else {
        // Initial 1st row with currency & amount
        setRows([
          {
            id: `row_init_${Date.now()}`,
            currency: defaultCurr,
            amount: 100000,
          },
        ]);
        setStartDate(startStr);
        setEndDate(endMonth);
        setNotes('Mijozlardan qarzdorlik to\'lovlarini undirish bo\'yicha 1 oylik maqsad');
      }
    }
  }, [isOpen, existingPlan, warehouseCurrencies]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    const nextCurr = warehouseCurrencies.find((c) => !rows.some((r) => r.currency === c)) || warehouseCurrencies[0] || 'USD';
    setRows((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        currency: nextCurr,
        amount: '',
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: 'currency' | 'amount', value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === 'currency') {
          return { ...r, currency: value };
        } else {
          const num = value === '' ? '' : Math.max(0, parseFloat(value));
          return { ...r, amount: num };
        }
      })
    );
  };

  // Quick Date Presets
  const handleSetPreset30Days = () => {
    const now = new Date();
    setStartDate(now.toISOString().slice(0, 10));
    const nextMonth = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    setEndDate(nextMonth);
  };

  const handleSetPresetCurrentMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

  const isFormValid =
    rows.length > 0 &&
    rows.every((r) => r.currency.trim().length > 0 && typeof r.amount === 'number' && r.amount > 0) &&
    startDate.length > 0 &&
    endDate.length > 0 &&
    startDate <= endDate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const targets: MonthlyPlanTarget[] = rows.map((r) => ({
      currency: r.currency.trim(),
      targetAmount: typeof r.amount === 'number' ? r.amount : Number(r.amount) || 0,
    }));

    onSavePlan(targets, startDate, endDate, notes.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-800 via-rose-700 to-amber-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 border border-white/10">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display leading-tight">
                1 oylik reja tuzish (Qarz undirish)
              </h2>
              <p className="text-[11px] text-rose-100 font-medium">
                Ombor mahsulotlari valyutalarida qarz undirish maqsadlarini belgilash ({currentUsername})
              </p>
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-rose-700" />
                <span>Reja valyutalari va summalari</span>
              </label>
              <span className="text-[11px] font-semibold text-neutral-500">
                Ombordagi narxlar valyutasi bo'yicha
              </span>
            </div>

            {/* Target Rows (1-qator: Valyuta, keyingi qator: Summa, + qo'shish imkoni) */}
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border border-neutral-200/90 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900 bg-rose-100/80 px-2 py-0.5 rounded-md">
                      {index + 1}-maqsadli valyuta
                    </span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-neutral-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="Ushbu qatorni o'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1-qator: Valyuta (ombordagi mahsulot narxlaridagi valyutalardan biri) */}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        1-qator: Valyuta <span className="text-rose-600">*</span>
                      </label>
                      <select
                        value={row.currency}
                        onChange={(e) => handleUpdateRow(row.id, 'currency', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-rose-600 bg-white"
                        required
                      >
                        {warehouseCurrencies.map((c) => (
                          <option key={c} value={c}>
                            {c} (Ombor valyutasi)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Keyingi qator: Summa */}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        Keyingi qator: Summa <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={row.amount}
                          onChange={(e) => handleUpdateRow(row.id, 'amount', e.target.value)}
                          placeholder="Reja summasi (masalan: 100000)"
                          className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-bold font-mono text-neutral-900 focus:outline-rose-600 bg-white tabular-nums pr-12"
                          required
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-neutral-500 font-mono">
                          {row.currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {typeof row.amount === 'number' && row.amount > 0 && (
                    <div className="text-[11px] text-neutral-600 font-mono">
                      Qarz undirish rejasi: <strong className="text-neutral-900">{formatMoney(row.amount)} {row.currency}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* "+ Yana qo'shish" tugmasi */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAddRow}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-rose-300 hover:border-rose-500 bg-rose-50/50 hover:bg-rose-50 text-rose-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Yana valyuta va summa qo'shish</span>
              </button>
            </div>
          </div>

          {/* Muddat tanlash imkoni */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-700" />
                <span>Muddat tanlash <span className="text-rose-600">*</span></span>
              </label>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSetPreset30Days}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/70 hover:bg-amber-200 text-amber-900 transition cursor-pointer"
                >
                  1 oy (30 kun)
                </button>
                <button
                  type="button"
                  onClick={handleSetPresetCurrentMonth}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/70 hover:bg-amber-200 text-amber-900 transition cursor-pointer"
                >
                  Joriy oy
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Boshlanish sanasi
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm font-semibold focus:outline-rose-600 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Tugash sanasi
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm font-semibold focus:outline-rose-600 bg-white"
                  required
                />
              </div>
            </div>

            <div className="text-[11px] text-neutral-600">
              Tanlangan muddat: <strong className="text-neutral-900 font-mono">{startDate}</strong> dan <strong className="text-neutral-900 font-mono">{endDate}</strong> gacha
            </div>
          </div>

          {/* Izoh */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Reja izohi (Ixtiyoriy)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Masalan: Ushbu oylik reja doirasida eng yirik qarzdorlar qoplanadi"
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 text-neutral-900 focus:outline-rose-600 bg-white"
            />
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 text-xs sm:text-sm font-semibold hover:bg-neutral-100 transition cursor-pointer min-h-[42px]"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer min-h-[42px] flex items-center gap-1.5"
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
