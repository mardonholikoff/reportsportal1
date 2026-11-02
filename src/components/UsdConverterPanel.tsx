import React, { useState } from 'react';
import { ArrowRightLeft, Check, Calculator } from 'lucide-react';
import { formatMoney } from '../utils/format';

interface Props {
  onApplyUsd: (usdAmount: number, detailsNote: string) => void;
  label?: string;
  defaultOpen?: boolean;
  disabled?: boolean;
}

const RATE_STORAGE_KEY = 'savdo_usd_uzs_rate_v1';

export const UsdConverterPanel: React.FC<Props> = ({
  onApplyUsd,
  label = "So'mdan (UZS) USDga konvertatsiya",
  defaultOpen = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [uzsAmount, setUzsAmount] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>(() => {
    try {
      return localStorage.getItem(RATE_STORAGE_KEY) || '12800';
    } catch {
      return '12800';
    }
  });
  const [appliedFlash, setAppliedFlash] = useState(false);

  const numUzs = parseFloat(uzsAmount) || 0;
  const numRate = parseFloat(exchangeRate) || 0;
  const calculatedUsd =
    numUzs > 0 && numRate > 0 ? Math.round((numUzs / numRate) * 100) / 100 : 0;

  const handleConvertClick = () => {
    if (calculatedUsd <= 0) return;
    try {
      if (numRate > 0) {
        localStorage.setItem(RATE_STORAGE_KEY, exchangeRate);
      }
    } catch {
      // ignore storage error
    }
    const formattedUzs = new Intl.NumberFormat('uz-UZ').format(numUzs);
    const formattedRate = new Intl.NumberFormat('uz-UZ').format(numRate);
    const note = `Konvertatsiya: ${formattedUzs} so'm (1$ = ${formattedRate} so'm) = ${calculatedUsd} USD`;
    onApplyUsd(calculatedUsd, note);
    setAppliedFlash(true);
    setTimeout(() => setAppliedFlash(false), 2000);
  };

  return (
    <div className="rounded-xl border border-amber-300/90 bg-amber-50/60 p-2.5 sm:p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={disabled}
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
            className="w-4 h-4 text-amber-600 rounded border-amber-400 focus:ring-amber-500 cursor-pointer"
          />
          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
            <span>{label}</span>
          </span>
        </label>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-white px-2.5 py-1 rounded-lg border border-amber-200 transition cursor-pointer"
        >
          {isOpen ? 'Yopish' : 'Konvertatsiya ochish'}
        </button>
      </div>

      {isOpen && (
        <div className="pt-2 border-t border-amber-200/80 space-y-2.5 animate-in fade-in duration-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-neutral-800 mb-1">
                So'mdagi summa (UZS) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                disabled={disabled}
                min="0"
                step="any"
                value={uzsAmount}
                onChange={(e) => setUzsAmount(e.target.value)}
                placeholder="Masalan: 1280000"
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-mono font-bold text-xs sm:text-sm text-neutral-900 outline-none focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-800 mb-1">
                1 dollar ($) necha so'm (Kurs) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                disabled={disabled}
                min="1"
                step="any"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="Masalan: 12800"
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-mono font-bold text-xs sm:text-sm text-neutral-900 outline-none focus:border-amber-600"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-amber-200">
            <div className="text-xs font-mono">
              <span className="text-neutral-500">Natija (USD): </span>
              <strong className="text-sm font-extrabold text-emerald-700">
                {formatMoney(calculatedUsd)}
              </strong>
              {numUzs > 0 && numRate > 0 && (
                <span className="text-[10px] text-neutral-500 block sm:inline sm:ml-2">
                  ({new Intl.NumberFormat('uz-UZ').format(numUzs)} so'm ÷{' '}
                  {new Intl.NumberFormat('uz-UZ').format(numRate)})
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={disabled || calculatedUsd <= 0}
              onClick={handleConvertClick}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                appliedFlash
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {appliedFlash ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>USDga o'tkazildi!</span>
                </>
              ) : (
                <>
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Konvertatsiya</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
