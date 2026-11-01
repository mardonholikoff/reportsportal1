import React, { useState, useEffect, useMemo } from 'react';
import { Client, WarehouseProduct } from '../types';
import { formatMoney } from '../utils/format';
import { X, Warehouse, DollarSign, AlertCircle, CheckCircle2, UserCheck, ShieldAlert } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  initialClient?: Client | null;
  warehouseProducts: WarehouseProduct[];
  currentUsername: string;
  onSaveWarehouseDebt: (
    clientId: string,
    amount: number,
    currency: string,
    note?: string
  ) => void;
}

export const AddWarehouseDebtModal: React.FC<Props> = ({
  isOpen,
  onClose,
  clients,
  initialClient,
  warehouseProducts,
  currentUsername,
  onSaveWarehouseDebt,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [currency, setCurrency] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');

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

  useEffect(() => {
    if (isOpen) {
      if (initialClient) {
        setSelectedClientId(initialClient.id);
      } else if (clients.length > 0) {
        setSelectedClientId(clients[0].id);
      }
      // Initialize currency to first warehouse currency
      if (warehouseCurrencies.length > 0) {
        setCurrency(warehouseCurrencies[0]);
      } else {
        setCurrency('USD');
      }
      setAmount('');
      setNote('');
      setClientSearch('');
    }
  }, [isOpen, initialClient, clients, warehouseCurrencies]);

  if (!isOpen) return null;

  const selectedClient = clients.find((c) => c.id === selectedClientId) || initialClient || null;
  const numAmount = typeof amount === 'number' ? amount : Number(amount) || 0;

  // Filter clients for dropdown
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.phone.includes(clientSearch) ||
      (c.address || '').toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;
    if (!currency || currency.trim().length === 0) return;
    if (numAmount <= 0) return;

    onSaveWarehouseDebt(selectedClientId, numAmount, currency.trim(), note.trim());
    onClose();
  };

  const oldDebt = selectedClient?.currentDebt || 0;
  const newDebt = oldDebt + numAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-900 via-rose-800 to-neutral-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-rose-300 border border-white/10">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display leading-tight">
                Ombordagi qarzdorlikni qo'shish
              </h2>
              <p className="text-[11px] text-rose-200/90 font-medium">
                Ombordagi narxlar valyutasida mijoz hisobiga qarz kiritish ({currentUsername})
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Client Selection */}
          <div>
            <label className="block text-xs font-bold text-neutral-800 mb-1">
              Mijozni tanlang <span className="text-rose-600">*</span>
            </label>
            {initialClient ? (
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-rose-700" />
                    <span>{initialClient.name}</span>
                  </div>
                  <div className="text-xs text-neutral-600 mt-0.5 font-mono">
                    {initialClient.phone} | {[initialClient.region, initialClient.district].filter(Boolean).join(', ') || initialClient.address}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Joriy qarz</span>
                  <span className="text-xs font-bold font-mono text-rose-800">{formatMoney(initialClient.currentDebt)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Mijoz ismi yoki telefon raqami bo'yicha qidirish..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-rose-600 bg-white"
                />
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-semibold focus:outline-rose-600 bg-white"
                  required
                >
                  <option value="">-- Mijozni tanlang --</option>
                  {filteredClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) - Qarz: {formatMoney(c.currentDebt)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 1-QATOR: VALYUTA TURI (Ombordagi mahsulot narxlaridagi valyutalardan biri) */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-700" />
                <span>1-qator: Valyuta turi <span className="text-rose-600">*</span></span>
              </label>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                Ombor narxlari bo'yicha
              </span>
            </div>

            <p className="text-[11px] text-amber-800/90 leading-tight">
              Birinchi navbatda ombordagi mahsulotlarga kiritilgan narxlardagi valyutalar qiymatidan birini tanlang:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {warehouseCurrencies.map((curr) => {
                const isSelected = currency === curr;
                return (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrency(curr)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                        : 'bg-white text-neutral-800 border-neutral-200 hover:bg-amber-100/50'
                    }`}
                  >
                    <span>{curr}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>

            {/* Select dropdown in case of custom or large currency set */}
            <div className="pt-1">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-amber-300 text-neutral-900 text-xs font-bold bg-white focus:outline-amber-600"
                required
              >
                {warehouseCurrencies.map((c) => (
                  <option key={c} value={c}>
                    Valyuta: {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2-QATOR: SUMMA */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
            <label className="block text-xs font-bold text-neutral-900 uppercase tracking-wide">
              2-qator: Summa <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  setAmount(val === '' ? '' : Math.max(0, parseFloat(val)));
                }}
                placeholder="Qo'shiladigan qarz summasini kiriting..."
                className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 text-neutral-900 text-base sm:text-lg font-bold font-mono focus:outline-rose-600 bg-white tabular-nums pr-16"
                required
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md uppercase font-mono">
                {currency || 'VALYUTA'}
              </span>
            </div>

            {numAmount > 0 && (
              <div className="text-xs text-neutral-600 font-medium font-mono">
                Kiritilgan summa: <strong className="text-neutral-900">{formatMoney(numAmount)} {currency}</strong>
              </div>
            )}
          </div>

          {/* Qo'shimcha Izoh */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Qayd / Asos izohi (Ixtiyoriy)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masalan: Ombordan tovar berildi, nakladnoy №..., va h.k."
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 text-neutral-900 focus:outline-rose-600 bg-white"
            />
          </div>

          {/* Real-time Calculation Summary */}
          {selectedClient && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-2">
              <div className="flex items-center justify-between text-neutral-600">
                <span>Oldingi qarzdorlik:</span>
                <span className="font-mono font-bold text-neutral-800">{formatMoney(oldDebt)}</span>
              </div>
              <div className="flex items-center justify-between text-rose-700 font-bold">
                <span>Ombordagi qarzdorlik qo'shilishi:</span>
                <span className="font-mono">+{formatMoney(numAmount)} {currency}</span>
              </div>
              <div className="pt-2 border-t border-rose-200/80 flex items-center justify-between font-bold text-neutral-900 text-sm">
                <span>Yangi qarzdorlik miqdori:</span>
                <span className="font-mono text-rose-900">{formatMoney(newDebt)} {currency}</span>
              </div>
            </div>
          )}

          {/* Submit and Cancel Buttons */}
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
              disabled={numAmount <= 0 || !currency || !selectedClientId}
              className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer min-h-[42px] flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Qarzdorlikni qo'shish va saqlash</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
