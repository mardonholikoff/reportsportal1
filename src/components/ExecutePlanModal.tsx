import React, { useState, useMemo, useEffect } from 'react';
import {
  DailyPlanItem,
  PlanActionType,
  FinancialMethodType,
  FinancialPaymentSplit,
  ProductItem,
  Client,
  WarehouseProduct,
  DeliveryPaymentInfo,
  DeliveryPaymentType,
} from '../types';
import { formatMoney } from '../utils/format';
import { storageService } from '../services/storage';
import { NakladnoyModal, NakladnoyData } from './NakladnoyModal';
import {
  X,
  MapPin,
  CheckCircle,
  CreditCard,
  Package,
  Plus,
  Trash2,
  FileCheck,
  DollarSign,
  Lock,
  Undo2,
  Check,
  AlertCircle,
  Coins,
  Printer,
  Percent,
  Search,
  RotateCcw,
  ChevronDown,
  Calculator,
  BellRing,
  Calendar,
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
        amountUzs?: number;
        exchangeRate?: number;
        currency?: string;
        note?: string;
        splits?: FinancialPaymentSplit[];
      };
      productsDelivered?: ProductItem[];
      deliveryPayment?: DeliveryPaymentInfo;
      productsReturned?: Array<{
        productId: string;
        name: string;
        unit: string;
        quantity: number;
        unitPrice?: number;
        warehouseId?: string;
      }>;
      reportNote?: string;
    },
    closeAfterSave?: boolean
  ) => void;
  onCloseWithoutAction?: (planItemId: string, reason: string) => void;
  onSaveReminder?: (data: {
    clientId: string;
    planId?: string;
    reminderDate: string;
    note: string;
  }) => void;
  client?: Client | null;
  warehouseProducts?: WarehouseProduct[];
}

const ACTION_OPTIONS: { id: PlanActionType; label: string }[] = [
  { id: 'telefon qilindi', label: 'Telefon qilindi' },
  { id: 'joyiga borildi', label: 'Joyiga borildi' },
  { id: 'telefon qilindi + joyiga borildi', label: 'Telefon qilindi + joyiga borildi' },
];

const FINANCIAL_PAYMENT_METHODS: { id: FinancialMethodType; label: string }[] = [
  { id: 'naqd', label: 'Naqd pul' },
  { id: 'bank_otkazma', label: "Bank o'tkazmasi" },
  { id: 'karta_otkazma', label: "Karta o'tkazmasi" },
  { id: 'qr_otkazma', label: "QR to'lov" },
];

const DELIVERY_PAYMENT_OPTIONS: { id: DeliveryPaymentType; label: string }[] = [
  { id: 'naqd', label: 'Naqd pul' },
  { id: 'bank', label: "Bank o'tkazmasi" },
  { id: 'karta', label: "Karta o'tkazmasi" },
  { id: 'qr', label: "QR to'lov" },
  { id: 'qarzga', label: 'Qarzga (Nasiya)' },
];

const createEmptyProductRow = (): ProductItem => ({
  id: 'prod_' + Math.random().toString(36).substring(2, 6),
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

export interface ExtraReturnItem {
  id: string;
  warehouseId: string;
  name: string;
  unit: string;
  quantity: number | '';
  unitPrice: number | '';
  totalPrice: number;
}

export interface WarehouseProductSearchSelectProps {
  products: WarehouseProduct[];
  selectedId: string;
  onSelect: (warehouseId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  allowClearManual?: boolean;
}

export const WarehouseProductSearchSelect: React.FC<WarehouseProductSearchSelectProps> = ({
  products,
  selectedId,
  onSelect,
  disabled,
  placeholder = "Ombordagi mahsulotni qidiring (3 ta so'z orqali: brend, nom, marka)...",
  allowClearManual = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSelectedPriceRevealed, setIsSelectedPriceRevealed] = useState(false);
  const [revealedDropdownPrices, setRevealedDropdownPrices] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsSelectedPriceRevealed(false);
  }, [selectedId]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId]
  );

  // So'z yozib 3 ta so'z orqali qidirish imkoniyati (multi-word search)
  const filteredProducts = useMemo(() => {
    const rawWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) {
      return products.slice(0, 60);
    }
    return products.filter((wh) => {
      const combined = [
        wh.brand,
        wh.name,
        wh.mark1,
        wh.mark2,
        ...(wh.extraMarks || []),
        wh.packageUnitName,
        wh.pieceUnitName,
        wh.baseUnit,
        wh.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return rawWords.every((word) => combined.includes(word));
    });
  }, [products, query]);

  if (selectedProduct && !isOpen) {
    const minSellPrice =
      selectedProduct.minSellingPrice !== undefined
        ? selectedProduct.minSellingPrice
        : selectedProduct.price || 0;
    const minUnitLabel =
      (selectedProduct.minSellingPricingUnitType || selectedProduct.pricingUnitType) === 'package' &&
      selectedProduct.packageUnitName
        ? selectedProduct.packageUnitName
        : selectedProduct.pieceUnitName || 'dona';

    return (
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-rose-200 bg-rose-50/50">
        <div className="min-w-0">
          <div className="font-bold text-xs text-neutral-900 truncate">
            <span className="text-rose-700 uppercase font-black mr-1">[{selectedProduct.brand}]</span>
            {selectedProduct.name} {selectedProduct.mark1 ? `(${selectedProduct.mark1})` : ''}
          </div>
          <div className="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5 font-mono">
            <span>
              Zaxirada: <strong className="text-neutral-800">{selectedProduct.totalPieces}</strong> {selectedProduct.pieceUnitName || 'dona'}
            </span>
            <span>•</span>
            <span>
              Eng kam narx:{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSelectedPriceRevealed((prev) => !prev);
                }}
                title="Ko'rish uchun ustiga bosing"
                className={`inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100/70 font-bold text-emerald-800 transition cursor-pointer ${
                  isSelectedPriceRevealed ? 'blur-none' : 'blur-xs select-none'
                }`}
              >
                {minSellPrice} USD / 1 {minUnitLabel}
              </button>
            </span>
          </div>
        </div>
        {!disabled && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setQuery('');
              }}
              className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-white hover:bg-rose-100 rounded-lg border border-rose-200 transition cursor-pointer shadow-2xs"
            >
              O'zgartirish
            </button>
            {allowClearManual && (
              <button
                type="button"
                onClick={() => {
                  onSelect('');
                  setIsOpen(false);
                  setQuery('');
                }}
                title="Tanlovni bekor qilish (Qo'lda yozish)"
                className="px-2 py-1 text-[11px] font-bold text-neutral-600 bg-white hover:bg-neutral-100 rounded-lg border border-neutral-200 transition cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative space-y-1">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-8.5 pr-14 py-2 bg-neutral-50 focus:bg-white rounded-xl border border-neutral-200 focus:border-rose-500 text-xs text-neutral-900 outline-none transition"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-neutral-400 hover:text-neutral-700 text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className="text-neutral-500 hover:text-neutral-800 p-0.5 rounded cursor-pointer"
            title="Ro'yxatni ochish / yopish"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white rounded-xl border border-neutral-200 shadow-xl divide-y divide-neutral-100 text-xs">
          {allowClearManual && (
            <button
              type="button"
              onClick={() => {
                onSelect('');
                setIsOpen(false);
                setQuery('');
              }}
              className="w-full text-left px-3 py-2 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50 flex items-center justify-between cursor-pointer"
            >
              <span>-- Boshqa (Qo'lda yozish) --</span>
              <span className="text-[10px] text-neutral-400">Tanlovsiz</span>
            </button>
          )}
          {filteredProducts.length === 0 ? (
            <div className="p-3 text-center text-neutral-400 text-xs">
              "{query}" bo'yicha mahsulot topilmadi
            </div>
          ) : (
            filteredProducts.map((wh) => {
              const minSellPrice =
                wh.minSellingPrice !== undefined ? wh.minSellingPrice : wh.price || 0;
              const minUnitLabel =
                (wh.minSellingPricingUnitType || wh.pricingUnitType) === 'package' && wh.packageUnitName
                  ? wh.packageUnitName
                  : wh.pieceUnitName || 'dona';

              return (
                <button
                  type="button"
                  key={wh.id}
                  onClick={() => {
                    onSelect(wh.id);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`w-full text-left p-2.5 hover:bg-rose-50/70 transition flex items-center justify-between gap-2 cursor-pointer ${
                    wh.id === selectedId ? 'bg-rose-50 font-semibold' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-neutral-900 truncate">
                      <span className="text-rose-700 font-extrabold mr-1">[{wh.brand}]</span>
                      {wh.name} {wh.mark1 ? `[${wh.mark1}]` : ''}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate font-mono">
                      Zaxira: {wh.totalPieces} {wh.pieceUnitName || 'dona'}
                      {wh.packageUnitName
                        ? ` (${Math.floor(wh.totalPieces / (wh.piecesPerPackage || 1))} ${wh.packageUnitName})`
                        : ''}
                    </div>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setRevealedDropdownPrices((prev) => ({
                        ...prev,
                        [wh.id]: !prev[wh.id],
                      }));
                    }}
                    title="Eng kam sotilish narxini ko'rish uchun ustiga bosing"
                    className={`text-right shrink-0 px-2 py-1 rounded-lg bg-indigo-50/70 border border-indigo-100 transition cursor-pointer ${
                      revealedDropdownPrices[wh.id] ? 'blur-none' : 'blur-xs select-none'
                    }`}
                  >
                    <span className="font-mono font-bold text-indigo-950 text-[11px] block">
                      {minSellPrice} USD
                    </span>
                    <span className="text-[9px] text-neutral-500 block">1 {minUnitLabel}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export const ExecutePlanModal: React.FC<Props> = ({
  planItem,
  isOpen,
  onClose,
  onSaveReport,
  onCloseWithoutAction,
  onSaveReminder,
  client,
  warehouseProducts,
}) => {
  // Load warehouse products
  const actualWarehouseProducts = useMemo(() => {
    return warehouseProducts && warehouseProducts.length > 0
      ? warehouseProducts
      : storageService.getWarehouseProducts();
  }, [warehouseProducts, isOpen]);

  // Section 1: Action done (initialized from plannedAction if set, but not marked confirmed until agent clicks or saves)
  const [actionDone, setActionDone] = useState<PlanActionType>('joyiga borildi');
  const [isPlannedActionConfirmed, setIsPlannedActionConfirmed] = useState<boolean>(false);
  const [showExtraActionSelector, setShowExtraActionSelector] = useState<boolean>(false);

  // Section 2: Financial payment (Supports single or multiple payment methods with optional UZS -> USD conversion)
  const [hasPayment, setHasPayment] = useState(false);
  const [isPaymentUzsMode, setIsPaymentUzsMode] = useState(false);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<FinancialMethodType[]>(['naqd']);
  const [methodAmountsUsd, setMethodAmountsUsd] = useState<Partial<Record<FinancialMethodType, number | ''>>>({
    naqd: '',
    bank_otkazma: '',
    karta_otkazma: '',
    qr_otkazma: '',
  });
  const [methodAmountsUzs, setMethodAmountsUzs] = useState<Partial<Record<FinancialMethodType, number | ''>>>({
    naqd: '',
    bank_otkazma: '',
    karta_otkazma: '',
    qr_otkazma: '',
  });
  const [splitExchangeRate, setSplitExchangeRate] = useState<string>(() => {
    try {
      return localStorage.getItem('savdo_usd_uzs_rate_v1') || '12800';
    } catch {
      return '12800';
    }
  });
  const [paymentNote, setPaymentNote] = useState('');

  // Section 3: Products delivered (with bidirectional discount % / USD + multi-method / partial credit + optional UZS -> USD conversion)
  const [hasProducts, setHasProducts] = useState(false);
  const [products, setProducts] = useState<ProductItem[]>([createEmptyProductRow()]);
  const [revealedRowMinPrices, setRevealedRowMinPrices] = useState<Record<string, boolean>>({});
  const [orderDiscountPercent, setOrderDiscountPercent] = useState<number | ''>('');
  const [orderDiscountAmount, setOrderDiscountAmount] = useState<number | ''>('');
  const [deliveryPayMode, setDeliveryPayMode] = useState<'full' | 'partial' | 'qarzga'>('full');
  const [selectedDeliveryMethods, setSelectedDeliveryMethods] = useState<FinancialMethodType[]>(['naqd']);
  const [deliveryAmountsUsd, setDeliveryAmountsUsd] = useState<Partial<Record<FinancialMethodType, number | ''>>>({
    naqd: '',
    bank_otkazma: '',
    karta_otkazma: '',
    qr_otkazma: '',
  });
  const [deliveryAmountsUzs, setDeliveryAmountsUzs] = useState<Partial<Record<FinancialMethodType, number | ''>>>({
    naqd: '',
    bank_otkazma: '',
    karta_otkazma: '',
    qr_otkazma: '',
  });
  const [isDeliveryUzsMode, setIsDeliveryUzsMode] = useState(false);

  // Section 4: Products returned state: { [productId]: returnedQuantity }
  const [returnsMap, setReturnsMap] = useState<Record<string, number | ''>>({});

  // Section 4.2: Berilmagan mahsulot qaytarish (Ombordagi tovarlardan qaytarish)
  const [hasExtraReturns, setHasExtraReturns] = useState(false);
  const [extraReturns, setExtraReturns] = useState<ExtraReturnItem[]>([]);

  // Section 5: General report note
  const [reportNote, setReportNote] = useState('');

  // Section 6: Reminder (Eslatma qo'yish — yopilmagan mijozlar uchun)
  const getDefaultReminderDate = (daysAhead: number = 1): string => {
    const dt = new Date();
    dt.setDate(dt.getDate() + daysAhead);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState<string>(() => getDefaultReminderDate(1));
  const [reminderNote, setReminderNote] = useState('');
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderSuccessMsg, setReminderSuccessMsg] = useState<string | null>(null);

  // Nakladnoy modal state
  const [nakladnoyData, setNakladnoyData] = useState<NakladnoyData | null>(null);

  // Reset form when modal opens for a planItem
  useEffect(() => {
    if (isOpen && planItem) {
      const alreadyDone = Boolean(planItem.status === 'bajarildi' || planItem.actionDone);
      setActionDone(planItem.actionDone || planItem.plannedAction || 'joyiga borildi');
      setIsPlannedActionConfirmed(alreadyDone);
      setShowExtraActionSelector(!planItem.plannedAction);
      setHasPayment(false);
      setIsPaymentUzsMode(false);
      setSelectedPaymentMethods(['naqd']);
      setMethodAmountsUsd({
        naqd: planItem.plannedAmount && planItem.plannedAmount > 0 ? planItem.plannedAmount : '',
        bank_otkazma: '',
        karta_otkazma: '',
        qr_otkazma: '',
      });
      setMethodAmountsUzs({
        naqd: '',
        bank_otkazma: '',
        karta_otkazma: '',
        qr_otkazma: '',
      });
      setPaymentNote('');
      setHasProducts(false);
      setProducts([createEmptyProductRow()]);
      setOrderDiscountPercent('');
      setOrderDiscountAmount('');
      setDeliveryPayMode('full');
      setSelectedDeliveryMethods(['naqd']);
      setDeliveryAmountsUsd({
        naqd: '',
        bank_otkazma: '',
        karta_otkazma: '',
        qr_otkazma: '',
      });
      setDeliveryAmountsUzs({
        naqd: '',
        bank_otkazma: '',
        karta_otkazma: '',
        qr_otkazma: '',
      });
      setIsDeliveryUzsMode(false);
      setReturnsMap({});
      setHasExtraReturns(false);
      setExtraReturns([]);
      setReportNote('');
      setHasReminder(false);
      setReminderDate(getDefaultReminderDate(1));
      setReminderNote('');
      setReminderError(null);
      setReminderSuccessMsg(null);
    }
  }, [isOpen, planItem?.id]);

  const numExchangeRate = useMemo(() => {
    const r = parseFloat(splitExchangeRate);
    return r > 0 ? r : 12800;
  }, [splitExchangeRate]);

  const handleTogglePaymentMethod = (methodId: FinancialMethodType) => {
    setSelectedPaymentMethods((prev) => {
      if (prev.includes(methodId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== methodId);
      }
      return [...prev, methodId];
    });
  };

  const handleMethodUzsChange = (methodId: FinancialMethodType, rawVal: string) => {
    const uzsVal = rawVal === '' ? '' : parseFloat(rawVal) || 0;
    setMethodAmountsUzs((prev) => ({ ...prev, [methodId]: uzsVal }));
    if (uzsVal === '' || uzsVal <= 0) {
      setMethodAmountsUsd((prev) => ({ ...prev, [methodId]: '' }));
    } else if (numExchangeRate > 0) {
      const calcUsd = Math.round((uzsVal / numExchangeRate) * 100) / 100;
      setMethodAmountsUsd((prev) => ({ ...prev, [methodId]: calcUsd }));
    }
  };

  const handleMethodUsdChange = (methodId: FinancialMethodType, rawVal: string) => {
    const usdVal = rawVal === '' ? '' : parseFloat(rawVal) || 0;
    setMethodAmountsUsd((prev) => ({ ...prev, [methodId]: usdVal }));
    if (usdVal === '' || usdVal <= 0) {
      setMethodAmountsUzs((prev) => ({ ...prev, [methodId]: '' }));
    } else if (numExchangeRate > 0) {
      setMethodAmountsUzs((prev) => ({
        ...prev,
        [methodId]: Math.round(usdVal * numExchangeRate),
      }));
    }
  };

  const handleExchangeRateChange = (newRateStr: string) => {
    setSplitExchangeRate(newRateStr);
    const parsedRate = parseFloat(newRateStr);
    if (parsedRate > 0) {
      try {
        localStorage.setItem('savdo_usd_uzs_rate_v1', newRateStr);
      } catch {
        // ignore storage error
      }
      setMethodAmountsUsd((prevUsd) => {
        const nextUsd = { ...prevUsd };
        selectedPaymentMethods.forEach((mId) => {
          const uzsVal = methodAmountsUzs[mId];
          if (typeof uzsVal === 'number' && uzsVal > 0) {
            nextUsd[mId] = Math.round((uzsVal / parsedRate) * 100) / 100;
          }
        });
        return nextUsd;
      });
      if (isDeliveryUzsMode) {
        setDeliveryAmountsUsd((prevUsd) => {
          const nextUsd = { ...prevUsd };
          selectedDeliveryMethods.forEach((mId) => {
            const uzsVal = deliveryAmountsUzs[mId];
            if (typeof uzsVal === 'number' && uzsVal > 0) {
              nextUsd[mId] = Math.round((uzsVal / parsedRate) * 100) / 100;
            }
          });
          return nextUsd;
        });
      }
    }
  };

  // Active splits with amounts > 0
  const activePaymentSplits = useMemo<FinancialPaymentSplit[]>(() => {
    return selectedPaymentMethods
      .map((mId) => {
        const meta = FINANCIAL_PAYMENT_METHODS.find((m) => m.id === mId);
        const usdAmt =
          typeof methodAmountsUsd[mId] === 'number'
            ? (methodAmountsUsd[mId] as number)
            : Number(methodAmountsUsd[mId]) || 0;
        const rawUzsAmt =
          typeof methodAmountsUzs[mId] === 'number'
            ? (methodAmountsUzs[mId] as number)
            : Number(methodAmountsUzs[mId]) || 0;
        const effectiveUzs =
          isPaymentUzsMode
            ? rawUzsAmt > 0
              ? Math.round(rawUzsAmt)
              : usdAmt > 0
              ? Math.round(usdAmt * numExchangeRate)
              : 0
            : 0;
        return {
          method: mId,
          methodLabel: meta?.label || "To'lov",
          amount: Math.round(usdAmt * 100) / 100,
          amountUzs: isPaymentUzsMode && effectiveUzs > 0 ? effectiveUzs : undefined,
          exchangeRate: isPaymentUzsMode && effectiveUzs > 0 && numExchangeRate > 0 ? numExchangeRate : undefined,
        };
      })
      .filter((s) => s.amount > 0);
  }, [selectedPaymentMethods, methodAmountsUsd, methodAmountsUzs, numExchangeRate, isPaymentUzsMode]);

  const totalPaymentUsd = useMemo(() => {
    const sum = activePaymentSplits.reduce((acc, s) => acc + s.amount, 0);
    return Math.round(sum * 100) / 100;
  }, [activePaymentSplits]);

  const totalPaymentUzs = useMemo(() => {
    if (!isPaymentUzsMode) return 0;
    return activePaymentSplits.reduce(
      (acc, s) => acc + (s.amountUzs !== undefined ? s.amountUzs : Math.round(s.amount * numExchangeRate)),
      0
    );
  }, [activePaymentSplits, numExchangeRate, isPaymentUzsMode]);

  const combinedPaymentSummary = useMemo(() => {
    if (activePaymentSplits.length === 0) {
      const firstMethod =
        FINANCIAL_PAYMENT_METHODS.find((m) => m.id === selectedPaymentMethods[0])?.label || 'Naqd pul';
      return {
        primaryMethod: selectedPaymentMethods[0] || ('naqd' as FinancialMethodType),
        methodLabel: `${firstMethod} (USD)`,
        autoBreakdownNote: '',
      };
    }

    if (activePaymentSplits.length === 1) {
      const sp = activePaymentSplits[0];
      const uzsText =
        sp.amountUzs && sp.amountUzs > 0
          ? `${new Intl.NumberFormat('uz-UZ').format(sp.amountUzs)} so'm (kurs: 1$ = ${new Intl.NumberFormat('uz-UZ').format(sp.exchangeRate || numExchangeRate)} so'm) = ${formatMoney(sp.amount)}`
          : '';
      return {
        primaryMethod: sp.method,
        methodLabel: `${sp.methodLabel} (USD)`,
        autoBreakdownNote: uzsText,
      };
    }

    const labelParts = activePaymentSplits.map((sp) => {
      if (sp.amountUzs && sp.amountUzs > 0) {
        return `${sp.methodLabel}: ${new Intl.NumberFormat('uz-UZ').format(sp.amountUzs)} so'm (${formatMoney(sp.amount)})`;
      }
      return `${sp.methodLabel}: ${formatMoney(sp.amount)}`;
    });

    const shortLabelParts = activePaymentSplits.map(
      (sp) => `${sp.methodLabel} (${formatMoney(sp.amount)})`
    );

    const breakdownText = isPaymentUzsMode && totalPaymentUzs > 0
      ? `${labelParts.join(' + ')} = Umumiy: ${new Intl.NumberFormat('uz-UZ').format(totalPaymentUzs)} so'm (kurs: 1$ = ${new Intl.NumberFormat('uz-UZ').format(numExchangeRate)} so'm | ${formatMoney(totalPaymentUsd)})`
      : `${labelParts.join(' + ')} = Umumiy: ${formatMoney(totalPaymentUsd)}`;

    return {
      primaryMethod: activePaymentSplits[0].method,
      methodLabel: shortLabelParts.join(' + '),
      autoBreakdownNote: breakdownText,
    };
  }, [activePaymentSplits, selectedPaymentMethods, totalPaymentUzs, totalPaymentUsd, isPaymentUzsMode, numExchangeRate]);

  // Product return is automatically active when visit occurs
  const showReturnSection =
    actionDone === 'joyiga borildi' || actionDone === 'telefon qilindi + joyiga borildi';

  const clientProducts = client?.products || [];

  // Calculate base sum (before discounts)
  const rawBaseDeliveredSum = useMemo(() => {
    return products
      .filter((p) => p.name.trim() !== '')
      .reduce((sum, p) => {
        const baseP = p.originalUnitPrice ?? p.unitPrice ?? 0;
        return sum + (p.quantity || 0) * baseP;
      }, 0);
  }, [products]);

  // Sum after row-level discounts
  const rowDiscountedDeliveredSum = useMemo(() => {
    return products
      .filter((p) => p.name.trim() !== '')
      .reduce(
        (sum, p) => sum + (p.totalPrice !== undefined ? p.totalPrice : (p.quantity || 0) * (p.unitPrice || 0)),
        0
      );
  }, [products]);

  // Keep orderDiscountAmount synced if orderDiscountPercent is set when rowDiscountedDeliveredSum changes
  useEffect(() => {
    if (typeof orderDiscountPercent === 'number' && orderDiscountPercent > 0) {
      const recalculatedAmt =
        Math.round(((rowDiscountedDeliveredSum * orderDiscountPercent) / 100) * 100) / 100;
      setOrderDiscountAmount(recalculatedAmt);
    } else if (
      typeof orderDiscountAmount === 'number' &&
      orderDiscountAmount > rowDiscountedDeliveredSum &&
      rowDiscountedDeliveredSum > 0
    ) {
      setOrderDiscountAmount(rowDiscountedDeliveredSum);
    }
  }, [rowDiscountedDeliveredSum]);

  // Final total delivery value (USD)
  const totalDeliveredSum = useMemo(() => {
    const extraDisc = typeof orderDiscountAmount === 'number' ? orderDiscountAmount : 0;
    return Math.max(0, Math.round((rowDiscountedDeliveredSum - extraDisc) * 100) / 100);
  }, [rowDiscountedDeliveredSum, orderDiscountAmount]);

  // Sync delivery paid amount when total delivery price changes in 'full' mode (with 1 selected method)
  useEffect(() => {
    if (deliveryPayMode === 'qarzga') {
      setDeliveryAmountsUsd({ naqd: '', bank_otkazma: '', karta_otkazma: '', qr_otkazma: '' });
      setDeliveryAmountsUzs({ naqd: '', bank_otkazma: '', karta_otkazma: '', qr_otkazma: '' });
    } else if (deliveryPayMode === 'full' && selectedDeliveryMethods.length === 1) {
      const mId = selectedDeliveryMethods[0];
      setDeliveryAmountsUsd({
        naqd: '',
        bank_otkazma: '',
        karta_otkazma: '',
        qr_otkazma: '',
        [mId]: totalDeliveredSum > 0 ? totalDeliveredSum : '',
      });
      if (isDeliveryUzsMode && numExchangeRate > 0) {
        setDeliveryAmountsUzs({
          naqd: '',
          bank_otkazma: '',
          karta_otkazma: '',
          qr_otkazma: '',
          [mId]: totalDeliveredSum > 0 ? Math.round(totalDeliveredSum * numExchangeRate) : '',
        });
      }
    }
  }, [totalDeliveredSum, deliveryPayMode, selectedDeliveryMethods.length]);

  const handleToggleDeliveryMethod = (methodId: FinancialMethodType) => {
    setSelectedDeliveryMethods((prev) => {
      if (prev.includes(methodId)) {
        if (prev.length <= 1) return prev;
        const next = prev.filter((id) => id !== methodId);
        setDeliveryAmountsUsd((old) => ({ ...old, [methodId]: '' }));
        setDeliveryAmountsUzs((old) => ({ ...old, [methodId]: '' }));
        return next;
      }
      // Adding a 2nd or 3rd method switches to partial/multi split mode so user can enter amounts per method
      if (prev.length >= 1 && deliveryPayMode === 'full') {
        setDeliveryPayMode('partial');
      }
      return [...prev, methodId];
    });
  };

  const handleDeliveryMethodUzsChange = (methodId: FinancialMethodType, rawVal: string) => {
    const uzsVal = rawVal === '' ? '' : parseFloat(rawVal) || 0;
    setDeliveryAmountsUzs((prev) => ({ ...prev, [methodId]: uzsVal }));
    if (uzsVal === '' || uzsVal <= 0) {
      setDeliveryAmountsUsd((prev) => ({ ...prev, [methodId]: '' }));
    } else if (numExchangeRate > 0) {
      const calcUsd = Math.round((uzsVal / numExchangeRate) * 100) / 100;
      setDeliveryAmountsUsd((prev) => ({ ...prev, [methodId]: calcUsd }));
      if (deliveryPayMode === 'full' && calcUsd < totalDeliveredSum) {
        setDeliveryPayMode('partial');
      }
    }
  };

  const handleDeliveryMethodUsdChange = (methodId: FinancialMethodType, rawVal: string) => {
    const usdVal = rawVal === '' ? '' : parseFloat(rawVal) || 0;
    setDeliveryAmountsUsd((prev) => ({ ...prev, [methodId]: usdVal }));
    if (usdVal === '' || usdVal <= 0) {
      setDeliveryAmountsUzs((prev) => ({ ...prev, [methodId]: '' }));
    } else {
      if (numExchangeRate > 0) {
        setDeliveryAmountsUzs((prev) => ({
          ...prev,
          [methodId]: Math.round(usdVal * numExchangeRate),
        }));
      }
      if (deliveryPayMode === 'full' && usdVal < totalDeliveredSum) {
        setDeliveryPayMode('partial');
      }
    }
  };

  const activeDeliverySplits = useMemo<FinancialPaymentSplit[]>(() => {
    if (deliveryPayMode === 'qarzga') return [];
    return selectedDeliveryMethods
      .map((mId) => {
        const meta = FINANCIAL_PAYMENT_METHODS.find((m) => m.id === mId);
        const usdAmt =
          typeof deliveryAmountsUsd[mId] === 'number'
            ? (deliveryAmountsUsd[mId] as number)
            : Number(deliveryAmountsUsd[mId]) || 0;
        const rawUzsAmt =
          typeof deliveryAmountsUzs[mId] === 'number'
            ? (deliveryAmountsUzs[mId] as number)
            : Number(deliveryAmountsUzs[mId]) || 0;
        const effectiveUzs =
          isDeliveryUzsMode
            ? rawUzsAmt > 0
              ? Math.round(rawUzsAmt)
              : usdAmt > 0
              ? Math.round(usdAmt * numExchangeRate)
              : 0
            : 0;
        return {
          method: mId,
          methodLabel: meta?.label || "To'lov",
          amount: Math.round(usdAmt * 100) / 100,
          amountUzs: isDeliveryUzsMode && effectiveUzs > 0 ? effectiveUzs : undefined,
          exchangeRate: isDeliveryUzsMode && effectiveUzs > 0 && numExchangeRate > 0 ? numExchangeRate : undefined,
        };
      })
      .filter((s) => s.amount > 0);
  }, [deliveryPayMode, selectedDeliveryMethods, deliveryAmountsUsd, deliveryAmountsUzs, isDeliveryUzsMode, numExchangeRate]);

  const totalDeliveryPaidUsd = useMemo(() => {
    if (deliveryPayMode === 'qarzga') return 0;
    const sum = activeDeliverySplits.reduce((acc, s) => acc + s.amount, 0);
    return Math.round(sum * 100) / 100;
  }, [deliveryPayMode, activeDeliverySplits]);

  const totalDeliveryPaidUzs = useMemo(() => {
    if (deliveryPayMode === 'qarzga' || !isDeliveryUzsMode) return 0;
    return activeDeliverySplits.reduce(
      (acc, s) => acc + (s.amountUzs !== undefined ? s.amountUzs : Math.round(s.amount * numExchangeRate)),
      0
    );
  }, [deliveryPayMode, isDeliveryUzsMode, activeDeliverySplits, numExchangeRate]);

  const remainingDeliveryDebtUsd = useMemo(() => {
    if (deliveryPayMode === 'qarzga') return totalDeliveredSum;
    return Math.max(0, Math.round((totalDeliveredSum - totalDeliveryPaidUsd) * 100) / 100);
  }, [deliveryPayMode, totalDeliveredSum, totalDeliveryPaidUsd]);

  const deliveryPaymentSummary = useMemo(() => {
    if (deliveryPayMode === 'qarzga' || totalDeliveryPaidUsd <= 0) {
      return {
        paymentType: 'qarzga' as DeliveryPaymentType,
        paymentLabel: 'Nasiyaga (Qarzga)',
      };
    }

    const firstMethod = activeDeliverySplits[0]?.method || selectedDeliveryMethods[0] || 'naqd';
    const mappedType: DeliveryPaymentType =
      firstMethod === 'bank_otkazma'
        ? 'bank'
        : firstMethod === 'karta_otkazma'
        ? 'karta'
        : firstMethod === 'qr_otkazma'
        ? 'qr'
        : 'naqd';

    const splitLabels = activeDeliverySplits.map((sp) => {
      if (sp.amountUzs && sp.amountUzs > 0) {
        return `${sp.methodLabel}: ${new Intl.NumberFormat('uz-UZ').format(sp.amountUzs)} so'm (${formatMoney(sp.amount)})`;
      }
      return activeDeliverySplits.length === 1 && remainingDeliveryDebtUsd === 0
        ? sp.methodLabel
        : `${sp.methodLabel}: ${formatMoney(sp.amount)}`;
    });

    const baseLabel = splitLabels.join(' + ');
    const finalLabel =
      remainingDeliveryDebtUsd > 0
        ? `Qisman to'lov (${baseLabel}) + Nasiya (${formatMoney(remainingDeliveryDebtUsd)})`
        : baseLabel;

    return {
      paymentType: mappedType,
      paymentLabel: finalLabel,
    };
  }, [deliveryPayMode, totalDeliveryPaidUsd, activeDeliverySplits, selectedDeliveryMethods, remainingDeliveryDebtUsd]);

  // Section 3: Add / remove product row (Yangi mahsulot tepada paydo bo'ladi, eskisi pastga suriladi)
  const handleAddProductRow = () => {
    setProducts((prev) => [createEmptyProductRow(), ...prev]);
  };

  const handleRemoveProductRow = (index: number) => {
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

  // Select warehouse product for row (uses 5-blok minSellingPrice)
  const handleSelectWarehouseProduct = (index: number, warehouseId: string) => {
    const wh = actualWarehouseProducts.find((w) => w.id === warehouseId);
    if (!wh) {
      setProducts((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          warehouseId: '',
          name: '',
          unit: 'dona',
          unitPrice: 0,
          originalUnitPrice: 0,
          discountPercent: 0,
          discountAmount: 0,
          totalPrice: 0,
        };
        return copy;
      });
      return;
    }

    const defaultUnit = wh.packageUnitName || wh.pieceUnitName || 'dona';
    const unitPrice = getWarehouseSellingPriceForUnit(wh, defaultUnit);

    const currentQty = products[index]?.quantity || 1;
    const fullName = `${wh.brand} - ${wh.name} ${wh.mark1 ? `[${wh.mark1}]` : ''}`.trim();
    const baseTotal = Math.round(currentQty * unitPrice * 100) / 100;

    setProducts((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
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
      return copy;
    });
  };

  // Change unit for warehouse product in row (uses 5-blok minSellingPrice)
  const handleUnitChange = (index: number, newUnit: string) => {
    const item = products[index];
    const wh = actualWarehouseProducts.find((w) => w.id === item.warehouseId);
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
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        unit: newUnit,
        unitPrice,
        originalUnitPrice: unitPrice,
        discountAmount: discAmt,
        totalPrice: finalTotal,
      };
      return copy;
    });
  };

  // Change quantity or unitPrice in row
  const handleProductQuantityChange = (index: number, qtyVal: number) => {
    setProducts((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      item.quantity = Math.max(0, qtyVal);
      const uPrice = item.originalUnitPrice ?? item.unitPrice ?? 0;
      const baseTotal = item.quantity * uPrice;
      const pct = item.discountPercent || 0;
      const discAmt = Math.round(((baseTotal * pct) / 100) * 100) / 100;
      item.discountAmount = discAmt;
      item.totalPrice = Math.max(0, Math.round((baseTotal - discAmt) * 100) / 100);
      copy[index] = item;
      return copy;
    });
  };

  const handleProductPriceChange = (index: number, priceVal: number) => {
    setProducts((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      const cleanPrice = Math.max(0, priceVal);
      item.unitPrice = cleanPrice;
      item.originalUnitPrice = cleanPrice;
      const baseTotal = (item.quantity || 0) * cleanPrice;
      const pct = item.discountPercent || 0;
      const discAmt = Math.round(((baseTotal * pct) / 100) * 100) / 100;
      item.discountAmount = discAmt;
      item.totalPrice = Math.max(0, Math.round((baseTotal - discAmt) * 100) / 100);
      copy[index] = item;
      return copy;
    });
  };

  // Bidirectional Discount per product row: Foiz (%) -> Summa (USD)
  const handleRowDiscountPercentChange = (index: number, pctVal: string) => {
    setProducts((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      const qty = item.quantity || 0;
      const uPrice = item.originalUnitPrice ?? item.unitPrice ?? 0;
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
      copy[index] = item;
      return copy;
    });
  };

  // Bidirectional Discount per product row: Summa (USD) -> Foiz (%)
  const handleRowDiscountAmountChange = (index: number, amtVal: string) => {
    setProducts((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      const qty = item.quantity || 0;
      const uPrice = item.originalUnitPrice ?? item.unitPrice ?? 0;
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
      copy[index] = item;
      return copy;
    });
  };

  // Order-level discount handlers
  const handleOrderDiscountPercentChange = (val: string) => {
    if (val === '') {
      setOrderDiscountPercent('');
      setOrderDiscountAmount('');
      return;
    }
    const pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
    const amt = Math.round(((rowDiscountedDeliveredSum * pct) / 100) * 100) / 100;
    setOrderDiscountPercent(pct);
    setOrderDiscountAmount(amt);
  };

  const handleOrderDiscountAmountChange = (val: string) => {
    if (val === '') {
      setOrderDiscountAmount('');
      setOrderDiscountPercent('');
      return;
    }
    const amt = Math.max(0, Math.min(rowDiscountedDeliveredSum, parseFloat(val) || 0));
    const pct =
      rowDiscountedDeliveredSum > 0
        ? Math.round(((amt / rowDiscountedDeliveredSum) * 100) * 100) / 100
        : 0;
    setOrderDiscountAmount(amt);
    setOrderDiscountPercent(pct);
  };

  // Returns handling
  const handleReturnQtyChange = (prodId: string, val: string, maxQty: number) => {
    if (val === '') {
      setReturnsMap((prev) => ({ ...prev, [prodId]: '' }));
      return;
    }
    const num = Math.max(0, Math.min(maxQty, parseFloat(val) || 0));
    setReturnsMap((prev) => ({ ...prev, [prodId]: num }));
  };

  const handleReturnAll = (prodId: string, maxQty: number) => {
    setReturnsMap((prev) => ({ ...prev, [prodId]: maxQty }));
  };

  // Section 4.2: Berilmagan mahsulot qaytarish handlers (Yangi qator tepada paydo bo'ladi)
  const handleAddExtraReturnRow = () => {
    setExtraReturns((prev) => [
      {
        id: `ext_ret_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        warehouseId: '',
        name: '',
        unit: 'dona',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
      ...prev,
    ]);
  };

  const handleRemoveExtraReturnRow = (id: string) => {
    setExtraReturns((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSelectExtraReturnProduct = (id: string, warehouseId: string) => {
    const wh = actualWarehouseProducts.find((w) => w.id === warehouseId);
    setExtraReturns((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (!wh) {
          return { ...r, warehouseId: '', name: '', unit: 'dona', unitPrice: 0, totalPrice: 0 };
        }
        const defaultUnit = wh.packageUnitName || wh.pieceUnitName || wh.baseUnit || 'dona';
        const uPrice = getWarehouseSellingPriceForUnit(wh, defaultUnit);
        const qty = typeof r.quantity === 'number' ? r.quantity : 1;
        return {
          ...r,
          warehouseId: wh.id,
          name: `${wh.brand} - ${wh.name} ${wh.mark1 ? `[${wh.mark1}]` : ''}`.trim(),
          unit: defaultUnit,
          quantity: qty,
          unitPrice: uPrice,
          totalPrice: Math.round(qty * uPrice * 100) / 100,
        };
      })
    );
  };

  const handleExtraReturnUnitChange = (id: string, newUnit: string) => {
    setExtraReturns((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const wh = actualWarehouseProducts.find((w) => w.id === r.warehouseId);
        const uPrice = wh
          ? getWarehouseSellingPriceForUnit(wh, newUnit)
          : typeof r.unitPrice === 'number'
          ? r.unitPrice
          : 0;
        const qty = typeof r.quantity === 'number' ? r.quantity : 0;
        return {
          ...r,
          unit: newUnit,
          unitPrice: uPrice,
          totalPrice: Math.round(qty * uPrice * 100) / 100,
        };
      })
    );
  };

  const handleExtraReturnQtyChange = (id: string, qtyVal: number | '') => {
    setExtraReturns((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const numQty = qtyVal === '' ? '' : Math.max(0, qtyVal);
        const uPrice = typeof r.unitPrice === 'number' ? r.unitPrice : 0;
        const tPrice = numQty === '' ? 0 : Math.round(numQty * uPrice * 100) / 100;
        return { ...r, quantity: numQty, totalPrice: tPrice };
      })
    );
  };

  const handleExtraReturnPriceChange = (id: string, priceVal: number | '') => {
    setExtraReturns((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const numPrice = priceVal === '' ? '' : Math.max(0, priceVal);
        const qty = typeof r.quantity === 'number' ? r.quantity : 0;
        const tPrice = numPrice === '' ? 0 : Math.round(qty * numPrice * 100) / 100;
        return { ...r, unitPrice: numPrice, totalPrice: tPrice };
      })
    );
  };

  const totalDirectReturnValue = Object.entries(returnsMap).reduce((sum, [pId, qty]) => {
    const numQty = typeof qty === 'number' ? qty : Number(qty) || 0;
    if (numQty <= 0) return sum;
    const prod = clientProducts.find((p) => p.id === pId);
    return sum + numQty * (prod?.unitPrice || 0);
  }, 0);

  const totalExtraReturnValue = hasExtraReturns
    ? extraReturns.reduce((sum, r) => sum + (r.totalPrice || 0), 0)
    : 0;

  const totalReturnValue = Math.round((totalDirectReturnValue + totalExtraReturnValue) * 100) / 100;

  const totalDirectReturnCount = Object.entries(returnsMap).reduce((sum, [_, qty]) => {
    const numQty = typeof qty === 'number' ? qty : Number(qty) || 0;
    return sum + (numQty > 0 ? numQty : 0);
  }, 0);

  const totalExtraReturnCount = hasExtraReturns
    ? extraReturns.reduce((sum, r) => {
        const q = typeof r.quantity === 'number' ? r.quantity : 0;
        return sum + (q > 0 ? q : 0);
      }, 0)
    : 0;

  const totalReturnCount = totalDirectReturnCount + totalExtraReturnCount;

  // Open Nakladnoy Modal for current state (Delivered or Returned products)
  const handleOpenNakladnoy = () => {
    if (!planItem) return;

    const validDelivered = hasProducts
      ? products.filter((p) => p.name.trim() !== '')
      : [];

    const directReturned = showReturnSection
      ? Object.entries(returnsMap)
          .filter(([_, qty]) => (typeof qty === 'number' ? qty > 0 : Number(qty) > 0))
          .map(([prodId, qty]) => {
            const numQty = typeof qty === 'number' ? qty : Number(qty);
            const original = clientProducts.find((p) => p.id === prodId);
            return {
              productId: prodId,
              name: original?.name || 'Mahsulot',
              unit: original?.unit || 'dona',
              quantity: numQty,
              unitPrice: original?.unitPrice || 0,
              warehouseId: original?.warehouseId,
            };
          })
      : [];

    const extraReturnedList =
      showReturnSection && hasExtraReturns
        ? extraReturns
            .filter(
              (r) =>
                r.name.trim() !== '' &&
                (typeof r.quantity === 'number' ? r.quantity > 0 : false)
            )
            .map((r) => ({
              productId: r.id,
              name: r.name,
              unit: r.unit,
              quantity: typeof r.quantity === 'number' ? r.quantity : 0,
              unitPrice: typeof r.unitPrice === 'number' ? r.unitPrice : 0,
              warehouseId: r.warehouseId || undefined,
            }))
        : [];

    const validReturned = [...directReturned, ...extraReturnedList];

    const effectivePaid = totalDeliveryPaidUsd;
    const debtAdded = remainingDeliveryDebtUsd;

    const numFinPay = totalPaymentUsd;
    const finNoteCombined = [combinedPaymentSummary.autoBreakdownNote, paymentNote.trim()]
      .filter(Boolean)
      .join(' | ');

    const phonesList =
      client?.phones && client.phones.length > 0
        ? client.phones
        : (planItem.clientPhone || '').split(',').map((s) => s.trim()).filter(Boolean);

    const addressStr =
      [planItem.clientRegion, planItem.clientDistrict].filter(Boolean).join(', ') ||
      planItem.clientAddress;

    setNakladnoyData({
      clientName: planItem.clientName,
      clientPhones: phonesList,
      clientAddress: addressStr
        ? `${addressStr}${planItem.clientLandmark ? ` (${planItem.clientLandmark})` : ''}`
        : undefined,
      authorUsername: planItem.agentUsername || 'agentp1',
      operationTitle:
        validDelivered.length > 0 && validReturned.length > 0
          ? 'Mahsulot topshirish va qaytarib olish yuk xati (Nakladnoy)'
          : validReturned.length > 0
          ? 'Mahsulotni mijozdan qaytarib olish yuk xati (Nakladnoy)'
          : 'Mijozga mahsulot topshirish yuk xati (Nakladnoy)',
      productsDelivered: validDelivered,
      productsReturned: validReturned,
      paymentInfo:
        validDelivered.length > 0
          ? {
              paymentLabel: deliveryPaymentSummary.paymentLabel,
              paidAmount: effectivePaid,
              debtAmount: debtAdded,
              previousDebt: client?.currentDebt || 0,
              totalClientDebt: Math.max(
                0,
                (client?.currentDebt || 0) + debtAdded - (hasPayment ? numFinPay : 0) - totalReturnValue
              ),
            }
          : undefined,
      financialPayment:
        hasPayment && numFinPay > 0
          ? {
              methodLabel: combinedPaymentSummary.methodLabel,
              amount: numFinPay,
              note: finNoteCombined || undefined,
            }
          : undefined,
      note: reportNote.trim() || finNoteCombined || undefined,
    });
  };

  const executeSaveReport = (closeAfterSave: boolean) => {
    if (!planItem) return;
    const isClosed = planItem.isClosed || planItem.status === 'yopildi';
    if (isClosed) return;

    // 1. Financial data (Section 2 - supports single or multiple payment methods)
    const numPaymentAmount = totalPaymentUsd;
    const finNoteCombined = [combinedPaymentSummary.autoBreakdownNote, paymentNote.trim()]
      .filter(Boolean)
      .join(' | ');

    const financialData =
      hasPayment && numPaymentAmount > 0
        ? {
            method: combinedPaymentSummary.primaryMethod,
            methodLabel: combinedPaymentSummary.methodLabel,
            amount: numPaymentAmount,
            amountUzs: isPaymentUzsMode && totalPaymentUzs > 0 ? totalPaymentUzs : undefined,
            exchangeRate: isPaymentUzsMode && totalPaymentUzs > 0 ? numExchangeRate : undefined,
            currency: 'USD',
            note: finNoteCombined,
            splits: activePaymentSplits,
          }
        : undefined;

    // 2. Delivered products & delivery payment (Section 3 - proportional order discount + multi-method / partial credit + UZS conversion)
    const extraOrderDisc = typeof orderDiscountAmount === 'number' ? orderDiscountAmount : 0;
    const rawValidProducts = hasProducts
      ? products.filter((p) => p.name.trim() !== '')
      : [];

    let remainingDiscToDistribute = extraOrderDisc;
    const validProducts = rawValidProducts.map((p, idx, arr) => {
      if (extraOrderDisc <= 0 || rowDiscountedDeliveredSum <= 0) return p;
      const rowVal = p.totalPrice !== undefined ? p.totalPrice : (p.quantity || 0) * (p.unitPrice || 0);
      const share =
        idx === arr.length - 1
          ? remainingDiscToDistribute
          : Math.min(rowVal, Math.round((extraOrderDisc * (rowVal / rowDiscountedDeliveredSum)) * 100) / 100);
      remainingDiscToDistribute = Math.max(0, Math.round((remainingDiscToDistribute - share) * 100) / 100);
      const adjustedTotal = Math.max(0, Math.round((rowVal - share) * 100) / 100);
      return {
        ...p,
        discountAmount: Math.round(((p.discountAmount || 0) + share) * 100) / 100,
        totalPrice: adjustedTotal,
      };
    });

    const effectivePaid = totalDeliveryPaidUsd;
    const effectiveDeliveryUzs =
      isDeliveryUzsMode && deliveryPayMode !== 'qarzga' && effectivePaid > 0 && totalDeliveryPaidUzs > 0
        ? Math.round(totalDeliveryPaidUzs)
        : undefined;

    const deliveryPayData: DeliveryPaymentInfo | undefined =
      hasProducts && validProducts.length > 0
        ? {
            paymentType: deliveryPaymentSummary.paymentType,
            paymentLabel: deliveryPaymentSummary.paymentLabel,
            currency: 'USD',
            paidAmount: effectivePaid,
            paidAmountUzs: effectiveDeliveryUzs,
            exchangeRate: effectiveDeliveryUzs ? numExchangeRate : undefined,
            totalAmount: totalDeliveredSum,
            debtAmount: remainingDeliveryDebtUsd,
            splits: activeDeliverySplits.length > 0 ? activeDeliverySplits : undefined,
            isPartialCredit: remainingDeliveryDebtUsd > 0 && effectivePaid > 0,
          }
        : undefined;

    // 3. Products returned (Section 4.1 + 4.2)
    const directReturned = showReturnSection
      ? Object.entries(returnsMap)
          .filter(([_, qty]) => (typeof qty === 'number' ? qty > 0 : Number(qty) > 0))
          .map(([prodId, qty]) => {
            const numQty = typeof qty === 'number' ? qty : Number(qty);
            const original = clientProducts.find((p) => p.id === prodId);
            return {
              productId: prodId,
              name: original?.name || 'Mahsulot',
              unit: original?.unit || 'dona',
              quantity: numQty,
              unitPrice: original?.unitPrice || 0,
              warehouseId: original?.warehouseId,
            };
          })
      : [];

    const extraReturnedList =
      showReturnSection && hasExtraReturns
        ? extraReturns
            .filter(
              (r) =>
                r.name.trim() !== '' &&
                (typeof r.quantity === 'number' ? r.quantity > 0 : false)
            )
            .map((r) => ({
              productId: r.id,
              name: r.name,
              unit: r.unit,
              quantity: typeof r.quantity === 'number' ? r.quantity : 0,
              unitPrice: typeof r.unitPrice === 'number' ? r.unitPrice : 0,
              warehouseId: r.warehouseId || undefined,
            }))
        : [];

    const productsReturned = [...directReturned, ...extraReturnedList];

    const hasAnyActionOrData =
      isPlannedActionConfirmed ||
      Boolean(financialData) ||
      validProducts.length > 0 ||
      productsReturned.length > 0;

    // Agar eslatma belgilangan bo'lsa, avval uni tekshiramiz va saqlaymiz
    if (hasReminder) {
      const effectiveRemNote = reminderNote.trim() || reportNote.trim();
      if (!reminderDate) {
        setReminderError('Eslatma uchun sanani tanlang!');
        return;
      }
      if (!effectiveRemNote) {
        setReminderError('Eslatma izohini kiriting!');
        return;
      }
      setReminderError(null);
      if (onSaveReminder) {
        onSaveReminder({
          clientId: planItem.clientId,
          planId: planItem.id,
          reminderDate,
          note: effectiveRemNote,
        });
      }
      // Agar agent faqat eslatma belgilab "Hisobotni saqlash" bosgan bo'lsa (va yopishni bosmagan bo'lsa),
      // rejani bajarilmasdan yopib yubormasdan, eslatmani saqlab oynani yopamiz
      if (!hasAnyActionOrData && !closeAfterSave) {
        onClose();
        return;
      }
    }

    // Agar amal bajarildi bosilmagan bo'lsa va moliyaviy/mahsulot amaliyoti kiritilmagan bo'lsa,
    // yopish tugmasi bosilganda avtomatik ravishda "Bajarilmasdan yopilgan" bo'lib yopiladi
    if (!hasAnyActionOrData) {
      if (closeAfterSave && onCloseWithoutAction) {
        const reason =
          reportNote.trim() ||
          (hasReminder && reminderNote.trim()
            ? `Eslatma (${reminderDate}): ${reminderNote.trim()}`
            : 'Bajarilmasdan yopildi');
        onCloseWithoutAction(planItem.id, reason);
        onClose();
        return;
      }
      if (!closeAfterSave && onCloseWithoutAction) {
        const reason = reportNote.trim() || 'Bajarilmasdan yopildi';
        onCloseWithoutAction(planItem.id, reason);
        onClose();
        return;
      }
    }

    onSaveReport(
      planItem.id,
      {
        actionDone,
        financialAction: financialData,
        productsDelivered: validProducts,
        deliveryPayment: deliveryPayData,
        productsReturned: productsReturned.length > 0 ? productsReturned : undefined,
        reportNote: reportNote.trim(),
      },
      closeAfterSave
    );

    onClose();
  };

  const handleSaveReminderOnly = () => {
    if (!planItem) return;
    const effectiveRemNote = reminderNote.trim() || reportNote.trim();
    if (!reminderDate) {
      setReminderError('Eslatma uchun sanani tanlang!');
      return;
    };
    if (!effectiveRemNote) {
      setReminderError('Eslatma izohini kiriting!');
      return;
    }
    setReminderError(null);
    if (onSaveReminder) {
      onSaveReminder({
        clientId: planItem.clientId,
        planId: planItem.id,
        reminderDate,
        note: effectiveRemNote,
      });
      setReminderSuccessMsg(`Eslatma ${reminderDate} sanasiga muvaffaqiyatli saqlandi!`);
      setTimeout(() => setReminderSuccessMsg(null), 3500);
    }
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSaveReport(false);
  };

  if (!isOpen || !planItem) return null;

  const isClosed = planItem.isClosed || planItem.status === 'yopildi';
  const totalDiscountAll = Math.max(
    0,
    Math.round((rawBaseDeliveredSum - totalDeliveredSum) * 100) / 100
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-rose-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/40 border-b border-rose-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-800 bg-rose-100/70 px-2 py-0.5 rounded-md">
                  Reja hisoboti (USD)
                </span>
                <h2 className="text-lg sm:text-xl font-bold font-display text-neutral-900">
                  {planItem.clientName}
                </h2>
              </div>
              <div className="text-xs text-neutral-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono font-medium">{planItem.clientPhone}</span>
                {(planItem.clientAddress ||
                  [planItem.clientRegion, planItem.clientDistrict].filter(Boolean).join(', ')) && (
                  <span className="flex items-center gap-1 text-neutral-500">
                    <MapPin className="w-3 h-3 text-rose-600" />
                    <span className="truncate max-w-[260px]">
                      {[planItem.clientRegion, planItem.clientDistrict].filter(Boolean).join(', ') ||
                        planItem.clientAddress}
                      {planItem.clientLandmark ? ` (${planItem.clientLandmark})` : ''}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
            {isClosed && (
              <div className="p-3.5 rounded-2xl bg-neutral-100 border border-neutral-300 flex items-center gap-2.5 text-neutral-800">
                <Lock className="w-5 h-5 text-neutral-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold block text-neutral-900">
                    Ushbu mijoz bo'yicha reja yakunlangan va yopilgan!
                  </span>
                  <span className="text-neutral-500">
                    Barcha amallar bajarib bo'lingan. Qaytib hech qanday amal bajarish mumkin emas.
                  </span>
                </div>
              </div>
            )}

            {planItem.planNote && (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide block">
                    Reja tuzishdagi izoh / vazifa:
                  </span>
                  <span className="text-xs text-amber-950 font-semibold">{planItem.planNote}</span>
                </div>
              </div>
            )}

            {/* Rejadagi undirish summasi haqida eslatma */}
            {planItem.plannedAmount !== undefined && planItem.plannedAmount > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wide block">
                      Rejadagi qarz undirish summasi:
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold font-mono text-emerald-950">
                      {formatMoney(planItem.plannedAmount)}
                    </span>
                  </div>
                </div>
                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => {
                      setHasPayment(true);
                      const firstMethod = selectedPaymentMethods[0] || 'naqd';
                      const amt = planItem.plannedAmount || 0;
                      setMethodAmountsUsd((prev) => ({
                        ...prev,
                        [firstMethod]: amt > 0 ? amt : '',
                      }));
                      if (amt > 0 && numExchangeRate > 0) {
                        setMethodAmountsUzs((prev) => ({
                          ...prev,
                          [firstMethod]: Math.round(amt * numExchangeRate),
                        }));
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition cursor-pointer shadow-2xs"
                  >
                    2-bo'limga to'lov sifatida qo'yish
                  </button>
                )}
              </div>
            )}

            {/* SECTION 1: Qilingan Amal (Tanlangan amalni bajardi qilish yoki qo'shimcha amal qo'shish) */}
            <div className="space-y-2.5 p-3.5 rounded-2xl bg-rose-50/40 border border-rose-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wide">
                  1. Qilingan amal turi <span className="text-rose-600">*</span>
                </label>
                {planItem.plannedAction && !isClosed && (
                  <button
                    type="button"
                    onClick={() => setShowExtraActionSelector((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold transition cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>
                      {showExtraActionSelector ? "Qo'shimcha amallarni yashirish" : "Qo'shimcha amal qo'shish"}
                    </span>
                  </button>
                )}
              </div>

              {planItem.plannedAction && (
                <div className="p-3 rounded-xl bg-white border border-rose-200 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">
                        Reja tuzishda tanlangan amal:
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isPlannedActionConfirmed && actionDone === planItem.plannedAction
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isPlannedActionConfirmed && actionDone === planItem.plannedAction
                          ? 'Holati: Bajarildi'
                          : 'Holati: Jarayonda'}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-neutral-900 mt-0.5 block">
                      {ACTION_OPTIONS.find((o) => o.id === planItem.plannedAction)?.label ||
                        planItem.plannedAction}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isClosed}
                    onClick={() => {
                      setActionDone(planItem.plannedAction!);
                      setIsPlannedActionConfirmed((prev) => !prev);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      isPlannedActionConfirmed && actionDone === planItem.plannedAction
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-amber-500 hover:bg-emerald-600 text-white shadow-xs'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>
                      {isPlannedActionConfirmed && actionDone === planItem.plannedAction
                        ? 'Bajarildi (Belgilandi)'
                        : 'Bajarildi deb belgilash'}
                    </span>
                  </button>
                </div>
              )}

              {(!planItem.plannedAction || showExtraActionSelector) && (
                <div className="space-y-1.5 pt-1">
                  {planItem.plannedAction && (
                    <span className="text-[11px] font-semibold text-neutral-600 block">
                      Yoki boshqa / qo'shimcha amal turini tanlang:
                    </span>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {ACTION_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isClosed}
                        onClick={() => {
                          setActionDone(opt.id);
                          setIsPlannedActionConfirmed(true);
                        }}
                        className={`p-3 rounded-xl border text-xs font-semibold text-center transition min-h-[44px] cursor-pointer ${
                          isPlannedActionConfirmed && actionDone === opt.id
                            ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                            : 'bg-white border-neutral-200 text-neutral-700 hover:border-rose-300 hover:bg-rose-50/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: MOLIYAVIY AMALIYOT (USD + AVTOMATIK KONVERTATSIYA) */}
            {/* ========================================================= */}
            <div className="space-y-3 pt-3 border-t border-rose-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-rose-700" />
                  <label
                    htmlFor="hasPaymentCheck"
                    className="text-xs font-bold text-neutral-800 uppercase tracking-wide cursor-pointer"
                  >
                    2. Moliyaviy amaliyot (To'lov qabul qilindimi?)
                  </label>
                </div>
                <input
                  type="checkbox"
                  id="hasPaymentCheck"
                  disabled={isClosed}
                  checked={hasPayment}
                  onChange={(e) => setHasPayment(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                />
              </div>

              {hasPayment && (
                <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-3.5 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-rose-900 block">
                        To'lov turlari va summalar (bir yoki bir nechta to'lov usulini tanlang)
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        Masalan: QR to'lovga 100,000 so'm va Naqd pulga 300,000 so'm kiritilsa, umumiy 400,000 so'm (USDda) hisoblanadi
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenNakladnoy}
                      className="flex items-center gap-1 text-xs font-bold text-neutral-800 bg-white px-2.5 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Print / Yuk xati (PDF)</span>
                    </button>
                  </div>

                  {/* To'lov usuli tanlash (Bir nechta tanlash mumkin): Naqd pul, Bank, Karta, QR */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="block text-[11px] font-semibold text-neutral-700">
                        To'lov turlarini tanlang (bir nechtasini bosib faollashtirish mumkin):
                      </label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {FINANCIAL_PAYMENT_METHODS.map((m) => {
                        const isSelected = selectedPaymentMethods.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            disabled={isClosed}
                            onClick={() => handleTogglePaymentMethod(m.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              isSelected
                                ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-rose-50/50'
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] ${
                                isSelected
                                  ? 'bg-white text-rose-700 border-white font-black'
                                  : 'border-neutral-300 bg-neutral-50 text-transparent'
                              }`}
                            >
                              ✓
                            </span>
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* So'mda (UZS) kurs kiritib dollarga ($) o'tkazish opsiyasi (Tanlanmasa avtomatik dollarda kiritiladi) */}
                    <div
                      className={`p-3 rounded-xl border transition-all ${
                        isPaymentUzsMode
                          ? 'bg-amber-50/90 border-amber-300 shadow-2xs'
                          : 'bg-white border-neutral-200'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label
                          htmlFor="isPaymentUzsModeCheck"
                          className="flex items-center gap-2.5 cursor-pointer select-none"
                        >
                          <input
                            id="isPaymentUzsModeCheck"
                            type="checkbox"
                            disabled={isClosed}
                            checked={isPaymentUzsMode}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsPaymentUzsMode(checked);
                              if (checked && numExchangeRate > 0) {
                                // Sync UZS from existing USD if UZS was empty
                                setMethodAmountsUzs((prevUzs) => {
                                  const nextUzs = { ...prevUzs };
                                  selectedPaymentMethods.forEach((mId) => {
                                    const usdVal = methodAmountsUsd[mId];
                                    const curUzs = prevUzs[mId];
                                    if (
                                      (curUzs === '' || curUzs === undefined || curUzs === 0) &&
                                      typeof usdVal === 'number' &&
                                      usdVal > 0
                                    ) {
                                      nextUzs[mId] = Math.round(usdVal * numExchangeRate);
                                    }
                                  });
                                  return nextUzs;
                                });
                              }
                            }}
                            className="w-4 h-4 text-amber-600 rounded border-neutral-300 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-extrabold text-neutral-900 flex items-center gap-1.5">
                              <Calculator className="w-3.5 h-3.5 text-amber-700" />
                              <span>To'lov so'mda (UZS) bo'lsa, kursni kiritib dollarga ($) o'tkazish</span>
                            </span>
                            <span className="block text-[10px] text-neutral-500">
                              {isPaymentUzsMode
                                ? "So'mda summa va kursni kiriting — tizim avtomatik dollarga ($) o'giradi"
                                : "Tanlanmagan: to'lov avtomatik ravishda to'g'ridan-to'g'ri dollarda ($) kiritiladi"}
                            </span>
                          </div>
                        </label>

                        {isPaymentUzsMode && (
                          <div className="flex items-center gap-1.5 bg-white border border-amber-300 px-2.5 py-1 rounded-xl shadow-2xs">
                            <span className="text-[11px] font-extrabold text-amber-900">1$ kursi (so'm):</span>
                            <input
                              type="number"
                              disabled={isClosed}
                              min="1"
                              step="any"
                              value={splitExchangeRate}
                              onChange={(e) => handleExchangeRateChange(e.target.value)}
                              className="w-24 px-2 py-0.5 rounded-lg border border-amber-300 bg-amber-50/40 focus:bg-white font-mono font-bold text-xs text-neutral-900 outline-none focus:border-amber-600"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Har bir tanlangan to'lov turi uchun alohida kiritish qatorlari */}
                  <div className="space-y-2.5">
                    {selectedPaymentMethods.map((methodId, idx) => {
                      const methodMeta = FINANCIAL_PAYMENT_METHODS.find((m) => m.id === methodId);
                      const uzsVal = methodAmountsUzs[methodId];
                      const usdVal = methodAmountsUsd[methodId];
                      return (
                        <div
                          key={methodId}
                          className="p-3 rounded-xl bg-white border border-rose-200/90 shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-800 flex items-center justify-center text-[11px] font-mono">
                                {idx + 1}
                              </span>
                              <span>{methodMeta?.label || "To'lov"}</span>
                            </span>
                            {selectedPaymentMethods.length > 1 && !isClosed && (
                              <button
                                type="button"
                                onClick={() => handleTogglePaymentMethod(methodId)}
                                className="text-[11px] font-semibold text-neutral-400 hover:text-rose-600 px-1.5 py-0.5 rounded cursor-pointer"
                                title="Ushbu to'lov turini olib tashlash"
                              >
                                Olib tashlash ✕
                              </button>
                            )}
                          </div>

                          {isPaymentUzsMode ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-1">
                                  {methodMeta?.label} — So'mda (UZS) kiritish <span className="text-rose-600">*</span>
                                </label>
                                <input
                                  type="number"
                                  disabled={isClosed}
                                  min="0"
                                  step="any"
                                  placeholder="Masalan: 1280000"
                                  value={uzsVal}
                                  onChange={(e) => handleMethodUzsChange(methodId, e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/40 focus:bg-white font-mono font-bold text-xs sm:text-sm text-neutral-900 outline-none focus:border-amber-600"
                                />
                                {typeof uzsVal === 'number' && uzsVal > 0 && (
                                  <div className="text-[10px] font-mono text-amber-800 mt-0.5">
                                    {new Intl.NumberFormat('uz-UZ').format(uzsVal)} so'm (kurs: 1$ ={' '}
                                    {new Intl.NumberFormat('uz-UZ').format(numExchangeRate)} so'm)
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-emerald-900 mb-1">
                                  {methodMeta?.label} — Dollarda ($) hisoblangan summa <span className="text-rose-600">*</span>
                                </label>
                                <input
                                  type="number"
                                  disabled={isClosed}
                                  required={hasPayment && idx === 0 && totalPaymentUsd <= 0}
                                  min="0"
                                  step="any"
                                  placeholder="Avtomatik ($)"
                                  value={usdVal}
                                  onChange={(e) => handleMethodUsdChange(methodId, e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50/30 focus:bg-white font-mono font-bold text-xs sm:text-sm text-neutral-900 outline-none focus:border-emerald-600"
                                />
                                {typeof usdVal === 'number' && usdVal > 0 && (
                                  <div className="text-[10px] font-mono text-emerald-800 mt-0.5">
                                    Hisobda (USD): {formatMoney(usdVal)}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] font-bold text-emerald-900 mb-1">
                                {methodMeta?.label} — Dollarda (USD $) summa <span className="text-rose-600">*</span>
                              </label>
                              <input
                                type="number"
                                disabled={isClosed}
                                required={hasPayment && idx === 0 && totalPaymentUsd <= 0}
                                min="0"
                                step="any"
                                placeholder="Masalan: 100"
                                value={usdVal}
                                onChange={(e) => handleMethodUsdChange(methodId, e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50/30 focus:bg-white font-mono font-bold text-xs sm:text-sm text-neutral-900 outline-none focus:border-emerald-600"
                              />
                              {typeof usdVal === 'number' && usdVal > 0 && (
                                <div className="text-[10px] font-mono text-emerald-800 mt-0.5">
                                  Hisobda (USD): {formatMoney(usdVal)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Umumiy jami to'lov (Barcha tanlangan to'lov turlari yig'indisi) */}
                  {activePaymentSplits.length > 0 && (
                    <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-300 space-y-1.5">
                      <div className="text-[11px] font-bold text-emerald-950 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {activePaymentSplits.map((sp, i) => (
                          <React.Fragment key={sp.method}>
                            {i > 0 && <span className="text-emerald-700 font-black">+</span>}
                            <span className="bg-white px-2 py-0.5 rounded-lg border border-emerald-200 font-mono text-[11px]">
                              <strong>{sp.methodLabel}:</strong>{' '}
                              {sp.amountUzs && sp.amountUzs > 0
                                ? `${new Intl.NumberFormat('uz-UZ').format(sp.amountUzs)} so'm (${formatMoney(sp.amount)})`
                                : formatMoney(sp.amount)}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="pt-1 border-t border-emerald-200/80 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-extrabold text-emerald-900 uppercase">
                          Umumiy jami to'lov:
                        </span>
                        <div className="text-right font-mono">
                          {isPaymentUzsMode && totalPaymentUzs > 0 && (
                            <span className="text-xs sm:text-sm font-black text-amber-900 mr-2">
                              {new Intl.NumberFormat('uz-UZ').format(totalPaymentUzs)} so'm
                            </span>
                          )}
                          <span className="text-xs sm:text-sm font-black text-emerald-800 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-300">
                            {formatMoney(totalPaymentUsd)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* To'lov bo'yicha izoh */}
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      To'lov bo'yicha qo'shimcha izoh
                    </label>
                    <input
                      type="text"
                      disabled={isClosed}
                      placeholder="Chek raqami yoki qo'shimcha eslatma"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-900 outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* SECTION 3: YANGI MAHSULOT TOPSHIRILDIMI? (CHEGIRMA + KONVERTATSIYA + NAKLADNOY) */}
            {/* ========================================================= */}
            <div className="space-y-3 pt-3 border-t border-rose-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-rose-700" />
                  <label
                    htmlFor="hasProductsCheck"
                    className="text-xs font-bold text-neutral-800 uppercase tracking-wide cursor-pointer"
                  >
                    3. Yangi mahsulot topshirildimi?
                  </label>
                </div>
                <input
                  type="checkbox"
                  id="hasProductsCheck"
                  disabled={isClosed}
                  checked={hasProducts}
                  onChange={(e) => setHasProducts(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                />
              </div>

              {hasProducts && (
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3.5 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-xs font-bold text-neutral-800 block">
                        Topshiriladigan mahsulotlar (USD)
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        Aktual narxga foiz (%) yoki summa (USD) chegirma qo'llash mumkin
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenNakladnoy}
                        className="flex items-center gap-1 text-xs font-bold text-neutral-800 bg-white px-2.5 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 cursor-pointer shadow-2xs"
                      >
                        <Printer className="w-3.5 h-3.5 text-neutral-700" />
                        <span>Print / Yuk xati (PDF)</span>
                      </button>
                      <button
                        type="button"
                        disabled={isClosed}
                        onClick={handleAddProductRow}
                        className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-white px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Mahsulot qo'shish</span>
                      </button>
                    </div>
                  </div>

                  {actualWarehouseProducts.length === 0 ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        Omborda hozircha hech qanday mahsulot mavjud emas. Mahsulot topshirish uchun avval omborga tovar kiritilishi lozim.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {products.map((p, idx) => {
                        const selectedWh = actualWarehouseProducts.find(
                          (w) => w.id === p.warehouseId
                        );
                        const baseRowTotal =
                          (p.quantity || 0) * (p.originalUnitPrice ?? p.unitPrice ?? 0);

                        return (
                          <div
                            key={p.id || idx}
                            className="p-3.5 bg-white rounded-xl border border-neutral-200 space-y-2.5 shadow-2xs transition hover:border-rose-200"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                                <span>Mahsulot #{products.length - idx}</span>
                                {idx === 0 && products.length > 1 && (
                                  <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-md">
                                    Yangi qo'shilgan
                                  </span>
                                )}
                              </span>
                              {products.length > 1 && (
                                <button
                                  type="button"
                                  disabled={isClosed}
                                  onClick={() => handleRemoveProductRow(idx)}
                                  className="p-1 text-neutral-400 hover:text-rose-600 cursor-pointer transition-colors"
                                  title="Qatorni o'chirish"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {/* Ombordagi mahsulotni tanlash (3 ta so'z orqali qidirish) */}
                            <div>
                              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                                Ombordagi mahsulot <span className="text-rose-600">*</span>
                              </label>
                              <WarehouseProductSearchSelect
                                products={actualWarehouseProducts}
                                selectedId={p.warehouseId || ''}
                                disabled={isClosed}
                                onSelect={(whId) => handleSelectWarehouseProduct(idx, whId)}
                              />
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
                                  <span className="text-indigo-900 font-bold font-mono flex items-center gap-1.5">
                                    <span>Eng kam sotilish narxi:</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const rKey = p.id || String(idx);
                                        setRevealedRowMinPrices((prev) => ({
                                          ...prev,
                                          [rKey]: !prev[rKey],
                                        }));
                                      }}
                                      title="Ko'rish uchun ustiga bosing"
                                      className={`px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-950 font-extrabold transition cursor-pointer ${
                                        revealedRowMinPrices[p.id || String(idx)]
                                          ? 'blur-none'
                                          : 'blur-xs select-none'
                                      }`}
                                    >
                                      {getWarehouseSellingPriceForUnit(selectedWh, p.unit)} USD (1 {p.unit})
                                    </button>
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* O'lchov birligi, Miqdori, Aktual narxi (USD), Aktual summa */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                  O'lchov birligi
                                </label>
                                {selectedWh ? (
                                  <select
                                    value={p.unit}
                                    disabled={isClosed}
                                    onChange={(e) => handleUnitChange(idx, e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-900 outline-none h-[36px]"
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
                                    disabled
                                    placeholder="dona"
                                    value={p.unit}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-100 text-xs text-neutral-600 h-[36px]"
                                  />
                                )}
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                  Miqdori
                                </label>
                                <input
                                  type="number"
                                  disabled={isClosed}
                                  min="1"
                                  step="any"
                                  placeholder="1"
                                  value={p.quantity || ''}
                                  onChange={(e) =>
                                    handleProductQuantityChange(idx, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-mono font-bold text-neutral-900 outline-none focus:border-rose-500 h-[36px]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                  Aktual narx (USD)
                                </label>
                                <input
                                  type="number"
                                  disabled={isClosed}
                                  min="0"
                                  step="any"
                                  placeholder="0"
                                  value={p.unitPrice || ''}
                                  onChange={(e) =>
                                    handleProductPriceChange(idx, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-mono text-neutral-900 outline-none focus:border-rose-500 h-[36px]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                  Aktual jami (USD)
                                </label>
                                <div className="px-2.5 py-1.5 bg-neutral-100 rounded-lg text-xs font-mono font-bold text-neutral-700 flex items-center h-[36px] truncate">
                                  {formatMoney(baseRowTotal)}
                                </div>
                              </div>
                            </div>

                            {/* Bidirectional Discount row: Foiz (%) <-> Summa (USD) -> Oxirgi summa */}
                            <div className="p-2.5 rounded-xl bg-rose-50/40 border border-rose-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-rose-800 mb-1 flex items-center gap-1">
                                  <Percent className="w-3 h-3 text-rose-600" />
                                  <span>Foiz chegirma (%)</span>
                                </label>
                                <input
                                  type="number"
                                  disabled={isClosed}
                                  min="0"
                                  max="100"
                                  step="any"
                                  placeholder="0%"
                                  value={p.discountPercent ? p.discountPercent : ''}
                                  onChange={(e) => handleRowDiscountPercentChange(idx, e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-neutral-200 focus:border-rose-500 text-xs font-mono font-bold text-neutral-900 outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-rose-800 mb-1 flex items-center gap-1">
                                  <DollarSign className="w-3 h-3 text-rose-600" />
                                  <span>Summa chegirma (USD)</span>
                                </label>
                                <input
                                  type="number"
                                  disabled={isClosed}
                                  min="0"
                                  step="any"
                                  placeholder="0 USD"
                                  value={p.discountAmount ? p.discountAmount : ''}
                                  onChange={(e) => handleRowDiscountAmountChange(idx, e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-neutral-200 focus:border-rose-500 text-xs font-mono font-bold text-neutral-900 outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-emerald-800 mb-1">
                                  Oxirgi summa (USD)
                                </label>
                                <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-mono font-extrabold text-emerald-900 flex items-center h-[32px]">
                                  {formatMoney(p.totalPrice)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 3-BLOK OXIRIDA: UMUMIY SUMMAGA CHEGIRMA, OXIRGI SUMMA, QISMAN TO'LOV / NASIYA VA KO'P USULLI TO'LOV */}
                  {(totalDeliveredSum > 0 || rawBaseDeliveredSum > 0) && (
                    <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-4">
                      {/* 1. UMUMIY SUMMAGA FOIZLI (%) VA RAQAMLI (USD) CHEGIRMA BLOKI */}
                      <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-extrabold text-rose-950 flex items-center gap-1.5">
                            <Percent className="w-3.5 h-3.5 text-rose-700" />
                            <span>Umumiy summaga qo'shimcha chegirma (Foiz % yoki Raqamli USD)</span>
                          </span>
                          <span className="text-[11px] font-mono font-bold text-neutral-700">
                            Qatorlar jami: {formatMoney(rowDiscountedDeliveredSum)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-rose-800 mb-1 flex items-center gap-1">
                              <Percent className="w-3 h-3 text-rose-600" />
                              <span>Umumiy foiz chegirma (%)</span>
                            </label>
                            <input
                              type="number"
                              disabled={isClosed}
                              min="0"
                              max="100"
                              step="any"
                              placeholder="0%"
                              value={orderDiscountPercent}
                              onChange={(e) => handleOrderDiscountPercentChange(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-rose-200 focus:border-rose-500 text-xs font-mono font-bold text-neutral-900 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-rose-800 mb-1 flex items-center gap-1">
                              <DollarSign className="w-3 h-3 text-rose-600" />
                              <span>Umumiy raqamli chegirma (USD)</span>
                            </label>
                            <input
                              type="number"
                              disabled={isClosed}
                              min="0"
                              max={rowDiscountedDeliveredSum}
                              step="any"
                              placeholder="0 USD"
                              value={orderDiscountAmount}
                              onChange={(e) => handleOrderDiscountAmountChange(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-rose-200 focus:border-rose-500 text-xs font-mono font-bold text-neutral-900 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-emerald-900 mb-1">
                              Chegirmadan keyingi umumiy summa
                            </label>
                            <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-mono font-extrabold text-emerald-950 flex items-center justify-between h-[32px]">
                              <span>Jami:</span>
                              <span>{formatMoney(totalDeliveredSum)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Oxirgi umumiy summa sarlavhasi */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100">
                        <div>
                          <span className="text-xs font-bold text-neutral-800 block">
                            Topshirilgan mahsulotlar yakuniy summasi:
                          </span>
                          {totalDiscountAll > 0 && (
                            <span className="text-[11px] text-neutral-500 font-mono">
                              Boshlang'ich narx: {formatMoney(rawBaseDeliveredSum)} | Jami chegirma: -{formatMoney(totalDiscountAll)}
                            </span>
                          )}
                        </div>
                        <span className="text-base font-extrabold font-mono text-rose-800">
                          {formatMoney(totalDeliveredSum)}
                        </span>
                      </div>

                      {/* 2. MAHSULOT UCHUN HISOB-KITOB REJIMI: TO'LIQ TO'LOV | QISMAN TO'LOV + QISMAN QARZ (NASIYA) | TO'LIQ NASIYA */}
                      <div className="space-y-2.5">
                        <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wide">
                          Mahsulot uchun to'lov va nasiya holati <span className="text-rose-600">*</span>
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={isClosed}
                            onClick={() => {
                              setDeliveryPayMode('full');
                              const firstMethod = selectedDeliveryMethods[0] || 'naqd';
                              setSelectedDeliveryMethods([firstMethod]);
                              setDeliveryAmountsUsd({
                                naqd: '',
                                bank_otkazma: '',
                                karta_otkazma: '',
                                qr_otkazma: '',
                                [firstMethod]: totalDeliveredSum,
                              });
                              if (isDeliveryUzsMode && numExchangeRate > 0) {
                                setDeliveryAmountsUzs({
                                  naqd: '',
                                  bank_otkazma: '',
                                  karta_otkazma: '',
                                  qr_otkazma: '',
                                  [firstMethod]: Math.round(totalDeliveredSum * numExchangeRate),
                                });
                              }
                            }}
                            className={`p-2.5 rounded-xl text-xs font-bold border text-center transition cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5 ${
                              deliveryPayMode === 'full'
                                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-emerald-50/50'
                            }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>To'liq to'lov</span>
                          </button>

                          <button
                            type="button"
                            disabled={isClosed}
                            onClick={() => {
                              setDeliveryPayMode('partial');
                            }}
                            className={`p-2.5 rounded-xl text-xs font-bold border text-center transition cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5 ${
                              deliveryPayMode === 'partial'
                                ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-rose-50/50'
                            }`}
                          >
                            <Coins className="w-3.5 h-3.5 shrink-0" />
                            <span>Qisman to'lov + Qisman qarz (Nasiya)</span>
                          </button>

                          <button
                            type="button"
                            disabled={isClosed}
                            onClick={() => {
                              setDeliveryPayMode('qarzga');
                              setIsDeliveryUzsMode(false);
                              setDeliveryAmountsUsd({
                                naqd: '',
                                bank_otkazma: '',
                                karta_otkazma: '',
                                qr_otkazma: '',
                              });
                              setDeliveryAmountsUzs({
                                naqd: '',
                                bank_otkazma: '',
                                karta_otkazma: '',
                                qr_otkazma: '',
                              });
                            }}
                            className={`p-2.5 rounded-xl text-xs font-bold border text-center transition cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5 ${
                              deliveryPayMode === 'qarzga'
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>To'liq nasiyaga (Qarzga)</span>
                          </button>
                        </div>

                        {/* Qisman to'lov va qisman qarz qilish belgilash qutisi (Checkbox) */}
                        {deliveryPayMode !== 'qarzga' && (
                          <div
                            className={`p-3 rounded-xl border transition-all ${
                              deliveryPayMode === 'partial'
                                ? 'bg-rose-50/90 border-rose-300 shadow-2xs'
                                : 'bg-neutral-50/70 border-neutral-200'
                            }`}
                          >
                            <label
                              htmlFor="isPartialDeliveryPayCheck"
                              className="flex items-center gap-2.5 cursor-pointer select-none"
                            >
                              <input
                                id="isPartialDeliveryPayCheck"
                                type="checkbox"
                                disabled={isClosed}
                                checked={deliveryPayMode === 'partial'}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDeliveryPayMode('partial');
                                  } else {
                                    setDeliveryPayMode('full');
                                    const firstMethod = selectedDeliveryMethods[0] || 'naqd';
                                    setSelectedDeliveryMethods([firstMethod]);
                                    setDeliveryAmountsUsd({
                                      naqd: '',
                                      bank_otkazma: '',
                                      karta_otkazma: '',
                                      qr_otkazma: '',
                                      [firstMethod]: totalDeliveredSum,
                                    });
                                    if (isDeliveryUzsMode && numExchangeRate > 0) {
                                      setDeliveryAmountsUzs({
                                        naqd: '',
                                        bank_otkazma: '',
                                        karta_otkazma: '',
                                        qr_otkazma: '',
                                        [firstMethod]: Math.round(totalDeliveredSum * numExchangeRate),
                                      });
                                    }
                                  }
                                }}
                                className="w-4 h-4 text-rose-600 rounded border-neutral-300 cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-extrabold text-neutral-900 block">
                                  Mahsulot uchun qisman pul berildi va qolgani qarz (nasiya) bo'lsin
                                </span>
                                <span className="block text-[10px] text-neutral-600">
                                  Belgilansa, kiritilgan to'lov(lar)dan ortib qolgan summa avtomatik ravishda mijozning qarziga (nasiyaga) qo'shiladi
                                </span>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* 3. TO'LOV TURLARINI TANLASH (BIR XIL, IKKITA YOKI UCHTASINI TANLASH + SO'MDA KURS BILAN YOKI DOLLARDA) */}
                      {deliveryPayMode !== 'qarzga' && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-700 mb-1.5">
                              To'lov turlarini tanlang (bir, ikki yoki bir nechtasini bosib faollashtirish mumkin):
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {FINANCIAL_PAYMENT_METHODS.map((m) => {
                                const isSelected = selectedDeliveryMethods.includes(m.id);
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    disabled={isClosed}
                                    onClick={() => handleToggleDeliveryMethod(m.id)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                      isSelected
                                        ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-rose-50/50'
                                    }`}
                                  >
                                    <span
                                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] ${
                                        isSelected
                                          ? 'bg-white text-rose-700 border-white font-black'
                                          : 'border-neutral-300 bg-neutral-50 text-transparent'
                                      }`}
                                    >
                                      ✓
                                    </span>
                                    <span>{m.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Mahsulot uchun to'lovni so'mda (UZS) kurs bilan kiritib dollarga ($) o'tkazish opsiyasi */}
                          <div
                            className={`p-3 rounded-xl border transition-all ${
                              isDeliveryUzsMode
                                ? 'bg-amber-50/90 border-amber-300 shadow-2xs'
                                : 'bg-neutral-50/70 border-neutral-200'
                            }`}
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <label
                                htmlFor="isDeliveryUzsModeCheck"
                                className="flex items-center gap-2.5 cursor-pointer select-none"
                              >
                                <input
                                  id="isDeliveryUzsModeCheck"
                                  type="checkbox"
                                  disabled={isClosed}
                                  checked={isDeliveryUzsMode}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setIsDeliveryUzsMode(checked);
                                    if (checked && numExchangeRate > 0) {
                                      setDeliveryAmountsUzs((prevUzs) => {
                                        const nextUzs = { ...prevUzs };
                                        selectedDeliveryMethods.forEach((mId) => {
                                          const usdVal = deliveryAmountsUsd[mId];
                                          const curUzs = prevUzs[mId];
                                          if (
                                            (curUzs === '' || curUzs === undefined || curUzs === 0) &&
                                            typeof usdVal === 'number' &&
                                            usdVal > 0
                                          ) {
                                            nextUzs[mId] = Math.round(usdVal * numExchangeRate);
                                          }
                                        });
                                        return nextUzs;
                                      });
                                    }
                                  }}
                                  className="w-4 h-4 text-amber-600 rounded border-neutral-300 cursor-pointer"
                                />
                                <div>
                                  <span className="text-xs font-extrabold text-neutral-900 flex items-center gap-1.5">
                                    <Calculator className="w-3.5 h-3.5 text-amber-700" />
                                    <span>
                                      Mahsulot to'lovi so'mda (UZS) bo'lsa, kursni kiritib dollarga ($) o'tkazish
                                    </span>
                                  </span>
                                  <span className="block text-[10px] text-neutral-500">
                                    {isDeliveryUzsMode
                                      ? "So'mda to'langan summa va kursni kiriting — avtomatik dollarga ($) o'tkaziladi"
                                      : "Tanlanmagan: mahsulot to'lovi avtomatik ravishda dollarda ($) kiritiladi"}
                                  </span>
                                </div>
                              </label>

                              {isDeliveryUzsMode && (
                                <div className="flex items-center gap-1.5 bg-white border border-amber-300 px-2.5 py-1 rounded-xl shadow-2xs">
                                  <span className="text-[11px] font-extrabold text-amber-900">1$ kursi (so'm):</span>
                                  <input
                                    type="number"
                                    disabled={isClosed}
                                    min="1"
                                    step="any"
                                    value={splitExchangeRate}
                                    onChange={(e) => handleExchangeRateChange(e.target.value)}
                                    className="w-24 px-2 py-0.5 rounded-lg border border-amber-300 bg-amber-50/40 focus:bg-white font-mono font-bold text-xs text-neutral-900 outline-none focus:border-amber-600"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Har bir tanlangan mahsulot to'lov turi uchun kiritish qatorlari */}
                          <div className="space-y-2.5">
                            {selectedDeliveryMethods.map((methodId, idx) => {
                              const methodMeta = FINANCIAL_PAYMENT_METHODS.find((m) => m.id === methodId);
                              const uzsVal = deliveryAmountsUzs[methodId];
                              const usdVal = deliveryAmountsUsd[methodId];
                              const otherMethodsUsdSum = selectedDeliveryMethods
                                .filter((id) => id !== methodId)
                                .reduce((acc, id) => acc + (Number(deliveryAmountsUsd[id]) || 0), 0);
                              const remainingForThisMethodUsd = Math.max(
                                0,
                                Math.round((totalDeliveredSum - otherMethodsUsdSum) * 100) / 100
                              );

                              return (
                                <div
                                  key={methodId}
                                  className="p-3 rounded-xl bg-neutral-50 border border-rose-200/90 shadow-2xs space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-800 flex items-center justify-center text-[11px] font-mono">
                                        {idx + 1}
                                      </span>
                                      <span>{methodMeta?.label || "To'lov"}</span>
                                    </span>

                                    <div className="flex items-center gap-2">
                                      {remainingForThisMethodUsd > 0 && !isClosed && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeliveryAmountsUsd((prev) => ({
                                              ...prev,
                                              [methodId]: remainingForThisMethodUsd,
                                            }));
                                            if (isDeliveryUzsMode && numExchangeRate > 0) {
                                              setDeliveryAmountsUzs((prev) => ({
                                                ...prev,
                                                [methodId]: Math.round(remainingForThisMethodUsd * numExchangeRate),
                                              }));
                                            }
                                          }}
                                          className="text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-md border border-emerald-300 cursor-pointer"
                                        >
                                          {selectedDeliveryMethods.length === 1
                                            ? `To'liq (${formatMoney(remainingForThisMethodUsd)})`
                                            : `Qolganini yozish (${formatMoney(remainingForThisMethodUsd)})`}
                                        </button>
                                      )}
                                      {selectedDeliveryMethods.length > 1 && !isClosed && (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleDeliveryMethod(methodId)}
                                          className="text-[11px] font-semibold text-neutral-400 hover:text-rose-600 px-1.5 py-0.5 rounded cursor-pointer"
                                          title="Ushbu to'lov turini olib tashlash"
                                        >
                                          Olib tashlash ✕
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {isDeliveryUzsMode ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      <div>
                                        <label className="block text-[10px] font-bold text-amber-900 mb-1">
                                          {methodMeta?.label} — So'mda (UZS) kiritish
                                        </label>
                                        <input
                                          type="number"
                                          disabled={isClosed}
                                          min="0"
                                          step="any"
                                          placeholder="Masalan: 300000"
                                          value={uzsVal}
                                          onChange={(e) => handleDeliveryMethodUzsChange(methodId, e.target.value)}
                                          className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-mono font-bold text-xs sm:text-sm text-neutral-900 outline-none focus:border-amber-600"
                                        />
                                        {typeof uzsVal === 'number' && uzsVal > 0 && (
                                          <div className="text-[10px] font-mono text-amber-800 mt-0.5">
                                            {new Intl.NumberFormat('uz-UZ').format(uzsVal)} so'm ÷{' '}
                                            {new Intl.NumberFormat('uz-UZ').format(numExchangeRate)} ={' '}
                                            {formatMoney(typeof usdVal === 'number' ? usdVal : 0)}
                                          </div>
                                        )}
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-emerald-900 mb-1">
                                          {methodMeta?.label} — Dollarda ($) hisoblangan summa
                                        </label>
                                        <input
                                          type="number"
                                          disabled={isClosed}
                                          min="0"
                                          step="any"
                                          placeholder="Avtomatik ($)"
                                          value={usdVal}
                                          onChange={(e) => handleDeliveryMethodUsdChange(methodId, e.target.value)}
                                          className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-mono font-bold text-xs sm:text-sm text-neutral-900 outline-none focus:border-emerald-600"
                                        />
                                        {typeof usdVal === 'number' && usdVal > 0 && (
                                          <div className="text-[10px] font-mono text-emerald-800 mt-0.5">
                                            Hisobda (USD): {formatMoney(usdVal)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="block text-[10px] font-bold text-emerald-900 mb-1">
                                        {methodMeta?.label} — Dollarda (USD $) summa
                                      </label>
                                      <input
                                        type="number"
                                        disabled={isClosed}
                                        min="0"
                                        step="any"
                                        placeholder="Masalan: 50"
                                        value={usdVal}
                                        onChange={(e) => handleDeliveryMethodUsdChange(methodId, e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-mono font-bold text-xs sm:text-sm text-neutral-900 outline-none focus:border-emerald-600"
                                      />
                                      {typeof usdVal === 'number' && usdVal > 0 && (
                                        <div className="text-[10px] font-mono text-emerald-800 mt-0.5">
                                          Hisobda (USD): {formatMoney(usdVal)}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Umumiy to'langan va Qolgan nasiya (qarz) xulosasi */}
                          <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-300 space-y-2">
                            {activeDeliverySplits.length > 0 && (
                              <div className="text-[11px] font-bold text-emerald-950 flex flex-wrap items-center gap-x-2 gap-y-1">
                                {activeDeliverySplits.map((sp, i) => (
                                  <React.Fragment key={sp.method}>
                                    {i > 0 && <span className="text-emerald-700 font-black">+</span>}
                                    <span className="bg-white px-2 py-0.5 rounded-lg border border-emerald-200 font-mono text-[11px]">
                                      <strong>{sp.methodLabel}:</strong>{' '}
                                      {sp.amountUzs && sp.amountUzs > 0
                                        ? `${new Intl.NumberFormat('uz-UZ').format(sp.amountUzs)} so'm (${formatMoney(sp.amount)})`
                                        : formatMoney(sp.amount)}
                                    </span>
                                  </React.Fragment>
                                ))}
                              </div>
                            )}

                            <div className="pt-1.5 border-t border-emerald-200/80 flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs font-extrabold text-emerald-900 uppercase">
                                Hozir to'langan jami:
                              </span>
                              <div className="text-right font-mono">
                                {isDeliveryUzsMode && totalDeliveryPaidUzs > 0 && (
                                  <span className="text-xs sm:text-sm font-black text-amber-900 mr-2">
                                    {new Intl.NumberFormat('uz-UZ').format(totalDeliveryPaidUzs)} so'm
                                  </span>
                                )}
                                <span className="text-xs sm:text-sm font-black text-emerald-800 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-300">
                                  {formatMoney(totalDeliveryPaidUsd)}
                                </span>
                              </div>
                            </div>

                            <div className="pt-1.5 border-t border-emerald-200/80 text-xs font-medium">
                              {totalDeliveryPaidUsd === totalDeliveredSum && (
                                <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                                  <span>Mahsulot qiymati to'liq to'landi (Mijozga yangi qarz qo'shilmaydi).</span>
                                </span>
                              )}
                              {totalDeliveryPaidUsd < totalDeliveredSum && (
                                <div className="p-2.5 rounded-lg bg-rose-100/90 border border-rose-300 text-rose-950 flex items-center justify-between flex-wrap gap-2">
                                  <span className="font-bold flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                                    <span>Qolgan qarzga (nasiyaga) qo'shiladigan summa:</span>
                                  </span>
                                  <span className="font-mono font-black text-sm text-rose-800 bg-white px-2.5 py-0.5 rounded-lg border border-rose-300">
                                    +{formatMoney(remainingDeliveryDebtUsd)}
                                  </span>
                                </div>
                              )}
                              {totalDeliveryPaidUsd > totalDeliveredSum && (
                                <span className="text-blue-800 font-bold flex items-center gap-1.5">
                                  <Coins className="w-4 h-4 text-blue-700 shrink-0" />
                                  <span>
                                    Ortiqcha to'lov (+{formatMoney(totalDeliveryPaidUsd - totalDeliveredSum)}) mijozning eski qarzini yopadi yoki avansiga o'tadi.
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {deliveryPayMode === 'qarzga' && (
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <div>
                            <strong>To'liq nasiyaga berildi:</strong> Barcha{' '}
                            <strong className="font-mono">{formatMoney(totalDeliveredSum)}</strong>{' '}
                            mijozning joriy qarzdorligiga qo'shiladi.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* SECTION 4: MAHSULOTLARNI OMBORGA QAYTARISH (4.1 va 4.2) */}
            {/* ========================================================= */}
            {showReturnSection && (
              <div className="space-y-3 pt-3 border-t border-rose-100 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                      <Undo2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-900 uppercase tracking-wide block">
                        4. Mahsulotlarni omborga qaytarish (4.1 va 4.2)
                      </label>
                      <span className="text-[10px] text-neutral-500">
                        Joyiga borilganda mijoz qaytargan tovarlarni ombor zaxirasiga qo'shish
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {totalReturnCount > 0 && (
                      <>
                        <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 font-mono">
                          {totalReturnCount} ta tovar qaytarilmoqda
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenNakladnoy}
                          className="flex items-center gap-1 text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded-lg border border-neutral-300 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print / Yuk xati (PDF)</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 4.1: Berilgan mahsulotlarni omborga qaytarish */}
                <div className="p-3.5 bg-rose-50/30 rounded-2xl border border-rose-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800">
                      4.1. Berilgan mahsulotlarni qaytarish
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Mijozdagi mavjud tovarlar ro'yxatidan
                    </span>
                  </div>

                  {clientProducts.length === 0 ? (
                    <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-500 text-xs flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>Ushbu mijozda hozircha oldin berilgan mahsulotlar mavjud emas.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientProducts.map((p) => {
                        const curVal = returnsMap[p.id];
                        return (
                          <div
                            key={p.id}
                            className="p-2.5 bg-white rounded-xl border border-neutral-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="flex-1">
                              <div className="font-bold text-xs text-neutral-900">{p.name}</div>
                              <div className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-2">
                                <span>
                                  Mijozda: <strong className="text-neutral-800 font-mono">{p.quantity} {p.unit}</strong>
                                </span>
                                {p.unitPrice > 0 && (
                                  <span>• Narx: {formatMoney(p.unitPrice)}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] font-semibold text-neutral-600">
                                  Qaytarish:
                                </label>
                                <input
                                  type="number"
                                  disabled={isClosed}
                                  min="0"
                                  max={p.quantity}
                                  step="any"
                                  placeholder="0"
                                  value={curVal === '' ? '' : curVal ?? ''}
                                  onChange={(e) =>
                                    handleReturnQtyChange(p.id, e.target.value, p.quantity)
                                  }
                                  className="w-20 px-2 py-1 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-900 text-center outline-none focus:bg-white focus:border-rose-500"
                                />
                                <span className="text-[10px] text-neutral-500 font-medium">
                                  {p.unit}
                                </span>
                              </div>

                              <button
                                type="button"
                                disabled={isClosed}
                                onClick={() => handleReturnAll(p.id, p.quantity)}
                                className="text-[10px] font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 px-2 py-1 rounded border border-rose-200 transition cursor-pointer"
                              >
                                Barchasi
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4.2: Berilmagan mahsulot qaytarish (Ombordagi tovarlardan qaytarish) */}
                <div className="p-3.5 bg-indigo-50/40 rounded-2xl border border-indigo-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasExtraReturnsCheck"
                        disabled={isClosed}
                        checked={hasExtraReturns}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setHasExtraReturns(checked);
                          if (checked && extraReturns.length === 0) {
                            handleAddExtraReturnRow();
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                      />
                      <label
                        htmlFor="hasExtraReturnsCheck"
                        className="text-xs font-bold text-indigo-950 uppercase tracking-wide cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-indigo-700" />
                        <span>4.2. Berilmagan mahsulot qaytarish</span>
                      </label>
                    </div>

                    {hasExtraReturns && (
                      <button
                        type="button"
                        disabled={isClosed}
                        onClick={handleAddExtraReturnRow}
                        className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 hover:bg-indigo-50 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tovar qo'shish</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-neutral-500">
                    Mijoz oldin o'ziga berilmagan boshqa mahsulotni qaytarganda ombordagi tovar nomlari bo'yicha qidirib kiritiladi va unga mos o'lcham turi (litr, dona, kanistr, korobka) belgilanadi.
                  </p>

                  {hasExtraReturns && (
                    <div className="space-y-3 pt-1">
                      {extraReturns.map((retItem, rIdx) => {
                        const whObj = actualWarehouseProducts.find((w) => w.id === retItem.warehouseId);
                        const availableUnits = Array.from(
                          new Set(
                            [
                              whObj?.packageUnitName,
                              whObj?.pieceUnitName,
                              whObj?.baseUnit,
                              'litr',
                              'dona',
                              'kanistr',
                              'korobka',
                              'kg',
                            ].filter(Boolean) as string[]
                          )
                        );

                        return (
                          <div
                            key={retItem.id}
                            className="p-3 bg-white rounded-xl border border-neutral-200 shadow-2xs space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-neutral-700">
                                Berilmagan qaytarish #{rIdx + 1}
                              </span>
                              <button
                                type="button"
                                disabled={isClosed}
                                onClick={() => handleRemoveExtraReturnRow(retItem.id)}
                                className="p-1 text-neutral-400 hover:text-rose-600 cursor-pointer"
                                title="O'chirish"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Ombordagi mahsulot qidirish va tanlash (multi-word search) */}
                            <div>
                              <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                Ombordagi mahsulot turi <span className="text-rose-600">*</span>
                              </label>
                              <WarehouseProductSearchSelect
                                products={actualWarehouseProducts}
                                selectedId={retItem.warehouseId}
                                disabled={isClosed}
                                placeholder="Ombordagi tovar nomini qidiring (3 ta so'z orqali)..."
                                onSelect={(whId) => handleSelectExtraReturnProduct(retItem.id, whId)}
                              />
                            </div>

                            {/* O'lcham turi (litr, dona, kanistr, korobka), Miqdor, Birlik narx, Jami */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                  O'lcham turi <span className="text-rose-600">*</span>
                                </label>
                                <select
                                  disabled={isClosed}
                                  value={retItem.unit}
                                  onChange={(e) => handleExtraReturnUnitChange(retItem.id, e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-900 outline-none h-[34px]"
                                >
                                  {availableUnits.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                  Qaytarish miqdori <span className="text-rose-600">*</span>
                                </label>
                                <input
                                  type="number"
                                  disabled={isClosed}
                                  min="0.01"
                                  step="any"
                                  placeholder="1"
                                  value={retItem.quantity}
                                  onChange={(e) =>
                                    handleExtraReturnQtyChange(
                                      retItem.id,
                                      e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-mono font-bold text-neutral-900 outline-none focus:border-indigo-500 h-[34px]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                  Birlik narxi (USD)
                                </label>
                                <input
                                  type="number"
                                  disabled={isClosed}
                                  min="0"
                                  step="any"
                                  placeholder="0"
                                  value={retItem.unitPrice}
                                  onChange={(e) =>
                                    handleExtraReturnPriceChange(
                                      retItem.id,
                                      e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-mono text-neutral-900 outline-none focus:border-indigo-500 h-[34px]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                  Qaytarish summasi
                                </label>
                                <div className="px-2 py-1.5 bg-neutral-100 rounded-lg text-xs font-mono font-bold text-neutral-800 flex items-center h-[34px] truncate">
                                  {formatMoney(retItem.totalPrice || 0)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Jami qaytarish xabarnomasi */}
                {totalReturnCount > 0 && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between flex-wrap gap-2 animate-in fade-in">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        Jami <strong>{totalReturnCount} ta</strong> tovar (4.1 va 4.2 bo'yicha) to'g'ridan-to'g'ri ombor zaxirasiga qo'shiladi.
                      </span>
                    </div>
                    {totalReturnValue > 0 && (
                      <div className="font-bold text-emerald-950 font-mono">
                        Mijoz qarzi {formatMoney(totalReturnValue)} ga kamaytiriladi
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 5: Hisobot Izohi */}
            <div className="space-y-1.5 pt-3 border-t border-rose-100">
              <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wide">
                {showReturnSection ? '5. Umumiy hisobot izohi' : '4. Umumiy hisobot izohi'}
              </label>
              <textarea
                rows={2}
                disabled={isClosed}
                placeholder="Mijoz bilan suhbat natijasi, konvertatsiya kursi, qaytarilgan tovarlar yoki keyingi qadamlar..."
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs text-neutral-900 outline-none focus:border-rose-500"
              />
            </div>

            {/* SECTION 6: Eslatma qo'yish (Yopilmagan mijoz bilan amaliyot bajarishda) */}
            {!isClosed && (
              <div className="space-y-3 pt-3 border-t border-amber-200">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasReminder}
                      onChange={(e) => {
                        setHasReminder(e.target.checked);
                        setReminderError(null);
                      }}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                      <BellRing className="w-4 h-4 text-amber-600" />
                      {showReturnSection
                        ? "6. Eslatma qo'yish (Tanlangan sanaga eslatma)"
                        : "5. Eslatma qo'yish (Tanlangan sanaga eslatma)"}
                    </span>
                  </label>
                  {hasReminder && (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                      Kalendar va eslatmalar jadvalida ko&apos;rinadi
                    </span>
                  )}
                </div>

                {hasReminder && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-950 mb-1">
                          Eslatma sanasi <span className="text-rose-600">*</span>
                        </label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 text-amber-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="date"
                            value={reminderDate}
                            onChange={(e) => {
                              setReminderDate(e.target.value);
                              setReminderError(null);
                            }}
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-mono font-bold text-neutral-900 outline-none focus:border-amber-600"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {[
                            { label: 'Bugun', days: 0 },
                            { label: 'Ertaga', days: 1 },
                            { label: '3 kundan keyin', days: 3 },
                            { label: '1 haftadan keyin', days: 7 },
                          ].map((preset) => {
                            const targetYmd = getDefaultReminderDate(preset.days);
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setReminderDate(targetYmd)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                  reminderDate === targetYmd
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100'
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-amber-950 mb-1">
                          Eslatma izohi <span className="text-rose-600">*</span>
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Masalan: Shu sanada to'lov qiladi yoki mahsulot bo'yicha qayta bog'lanish kerak..."
                          value={reminderNote}
                          onChange={(e) => {
                            setReminderNote(e.target.value);
                            setReminderError(null);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs text-neutral-900 outline-none focus:border-amber-600"
                        />
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {[
                            "To'lov qilishga va'da berdi",
                            "Qayta qo'ng'iroq qilish kerak",
                            'Yangi mahsulot buyurtma beradi',
                            'Hisob-kitobni tekshirish',
                          ].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() =>
                                setReminderNote((prev) =>
                                  prev ? `${prev}, ${chip.toLowerCase()}` : chip
                                )
                              }
                              className="px-2 py-0.5 rounded-md bg-white border border-amber-200 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                            >
                              + {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {reminderError && (
                      <div className="p-2 rounded-xl bg-rose-100 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{reminderError}</span>
                      </div>
                    )}

                    {reminderSuccessMsg && (
                      <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>{reminderSuccessMsg}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                      <span className="text-[11px] text-amber-900">
                        * &quot;Hisobotni saqlash&quot; bosilganda ham ushbu eslatma avtomatik saqlanadi.
                      </span>
                      <button
                        type="button"
                        onClick={handleSaveReminderOnly}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Eslatmani hoziroq saqlash</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions: Print Yuk xati ONLY shown when 2, 3, or 4 is active */}
            <div className="pt-3 border-t border-rose-100 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                {hasPayment || hasProducts || totalReturnCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleOpenNakladnoy}
                    className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer min-h-[40px] flex items-center gap-1.5 shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print / Yuk xati (PDF)</span>
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer min-h-[40px]"
                >
                  Bekor qilish
                </button>

                {!isClosed && (
                  <>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-xs font-bold shadow-xs transition cursor-pointer min-h-[40px] flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Hisobotni saqlash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => executeSaveReport(true)}
                      className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold shadow-xs transition cursor-pointer min-h-[40px] flex items-center gap-1.5"
                      title="Hisobotni saqlash va ushbu mijoz rejasini bir vaqtda yakunlab yopish (agar amal bajarildi belgilanmagan bo'lsa, bajarilmasdan yopiladi)"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Hisobotni saqlash va yopish</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
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
