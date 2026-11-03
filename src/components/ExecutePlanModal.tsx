import React, { useState, useMemo, useEffect } from 'react';
import {
  DailyPlanItem,
  PlanActionType,
  FinancialMethodType,
  ProductItem,
  Client,
  WarehouseProduct,
  DeliveryPaymentInfo,
  DeliveryPaymentType,
} from '../types';
import { formatMoney } from '../utils/format';
import { storageService } from '../services/storage';
import { UsdConverterPanel } from './UsdConverterPanel';
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
    }
  ) => void;
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

interface WarehouseProductSearchSelectProps {
  products: WarehouseProduct[];
  selectedId: string;
  onSelect: (warehouseId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const WarehouseProductSearchSelect: React.FC<WarehouseProductSearchSelectProps> = ({
  products,
  selectedId,
  onSelect,
  disabled,
  placeholder = "Ombordagi mahsulotni qidiring (3 ta so'z orqali: brend, nom, marka)...",
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId]
  );

  // So'z yozib 3 ta so'z orqali qidirish imkoniyati (multi-word search)
  const filteredProducts = useMemo(() => {
    const rawWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) {
      return products.slice(0, 35);
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
              Eng kam narx: <strong className="text-emerald-800">{minSellPrice} USD</strong> / 1 {minUnitLabel}
            </span>
          </div>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setQuery('');
            }}
            className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-white hover:bg-rose-100 rounded-lg border border-rose-200 transition shrink-0 cursor-pointer shadow-2xs"
          >
            O'zgartirish
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative space-y-1">
      <div className="relative">
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
          className="w-full pl-8.5 pr-8 py-2 bg-neutral-50 focus:bg-white rounded-xl border border-neutral-200 focus:border-rose-500 text-xs text-neutral-900 outline-none transition"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl border border-neutral-200 shadow-xl divide-y divide-neutral-100 text-xs">
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
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-neutral-900 text-[11px] block">
                      {minSellPrice} USD
                    </span>
                    <span className="text-[9px] text-neutral-400 block">1 {minUnitLabel}</span>
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

  // Section 2: Financial payment (All in USD, with UZS->USD converter)
  const [hasPayment, setHasPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<FinancialMethodType>('naqd');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');

  // Section 3: Products delivered (with bidirectional discount % / USD)
  const [hasProducts, setHasProducts] = useState(false);
  const [products, setProducts] = useState<ProductItem[]>([createEmptyProductRow()]);
  const [orderDiscountPercent, setOrderDiscountPercent] = useState<number | ''>('');
  const [orderDiscountAmount, setOrderDiscountAmount] = useState<number | ''>('');
  const [deliveryPaymentType, setDeliveryPaymentType] = useState<DeliveryPaymentType>('naqd');
  const [deliveryPaidAmount, setDeliveryPaidAmount] = useState<number | ''>('');

  // Section 4: Products returned state: { [productId]: returnedQuantity }
  const [returnsMap, setReturnsMap] = useState<Record<string, number | ''>>({});

  // Section 4.2: Berilmagan mahsulot qaytarish (Ombordagi tovarlardan qaytarish)
  const [hasExtraReturns, setHasExtraReturns] = useState(false);
  const [extraReturns, setExtraReturns] = useState<ExtraReturnItem[]>([]);

  // Section 5: General report note
  const [reportNote, setReportNote] = useState('');

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
      setPaymentMethod('naqd');
      setPaymentAmount(planItem.plannedAmount && planItem.plannedAmount > 0 ? planItem.plannedAmount : '');
      setPaymentNote('');
      setHasProducts(false);
      setProducts([createEmptyProductRow()]);
      setOrderDiscountPercent('');
      setOrderDiscountAmount('');
      setDeliveryPaymentType('naqd');
      setDeliveryPaidAmount('');
      setReturnsMap({});
      setHasExtraReturns(false);
      setExtraReturns([]);
      setReportNote('');
    }
  }, [isOpen, planItem?.id]);

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

  // Final total delivery value (USD)
  const totalDeliveredSum = useMemo(() => {
    const extraDisc = typeof orderDiscountAmount === 'number' ? orderDiscountAmount : 0;
    return Math.max(0, Math.round((rowDiscountedDeliveredSum - extraDisc) * 100) / 100);
  }, [rowDiscountedDeliveredSum, orderDiscountAmount]);

  // Sync delivery paid amount when total delivery price changes (if not in qarzga mode)
  useEffect(() => {
    if (deliveryPaymentType === 'qarzga') {
      setDeliveryPaidAmount(0);
    } else {
      setDeliveryPaidAmount(totalDeliveredSum);
    }
  }, [totalDeliveredSum, deliveryPaymentType]);

  // Section 3: Add / remove product row
  const handleAddProductRow = () => {
    setProducts((prev) => [...prev, createEmptyProductRow()]);
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

  // Section 4.2: Berilmagan mahsulot qaytarish handlers
  const handleAddExtraReturnRow = () => {
    setExtraReturns((prev) => [
      ...prev,
      {
        id: `ext_ret_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        warehouseId: '',
        name: '',
        unit: 'dona',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
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

    const effectivePaid =
      deliveryPaymentType === 'qarzga'
        ? 0
        : deliveryPaidAmount === ''
        ? totalDeliveredSum
        : Number(deliveryPaidAmount) || 0;

    const debtAdded =
      deliveryPaymentType === 'qarzga'
        ? totalDeliveredSum
        : Math.max(0, Math.round((totalDeliveredSum - effectivePaid) * 100) / 100);

    const numFinPay = typeof paymentAmount === 'number' ? paymentAmount : Number(paymentAmount) || 0;
    const selectedFinMethod = FINANCIAL_PAYMENT_METHODS.find((m) => m.id === paymentMethod);

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
              paymentLabel:
                DELIVERY_PAYMENT_OPTIONS.find((o) => o.id === deliveryPaymentType)?.label ||
                deliveryPaymentType,
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
              methodLabel: selectedFinMethod?.label || "To'lov",
              amount: numFinPay,
              note: paymentNote.trim() || undefined,
            }
          : undefined,
      note: reportNote.trim() || paymentNote.trim() || undefined,
    });
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planItem) return;
    const isClosed = planItem.isClosed || planItem.status === 'yopildi';
    if (isClosed) return;

    // 1. Financial data (Section 2 - strictly USD)
    const selectedFinancialMethodObj = FINANCIAL_PAYMENT_METHODS.find(
      (m) => m.id === paymentMethod
    );
    const numPaymentAmount =
      typeof paymentAmount === 'number' ? paymentAmount : Number(paymentAmount) || 0;

    const financialData =
      hasPayment && numPaymentAmount > 0
        ? {
            method: paymentMethod,
            methodLabel: `${selectedFinancialMethodObj?.label || "To'lov"} (USD)`,
            amount: numPaymentAmount,
            currency: 'USD',
            note: paymentNote.trim(),
          }
        : undefined;

    // 2. Delivered products & delivery payment (Section 3 - strictly USD)
    const extraOrderDisc = typeof orderDiscountAmount === 'number' ? orderDiscountAmount : 0;
    const validProducts = hasProducts
      ? products
          .filter((p) => p.name.trim() !== '')
          .map((p, idx, arr) => {
            if (extraOrderDisc > 0 && idx === 0 && arr.length > 0) {
              const adjustedTotal = Math.max(0, Math.round((p.totalPrice - extraOrderDisc) * 100) / 100);
              return {
                ...p,
                discountAmount: Math.round(((p.discountAmount || 0) + extraOrderDisc) * 100) / 100,
                totalPrice: adjustedTotal,
              };
            }
            return p;
          })
      : [];

    const effectivePaid =
      deliveryPaymentType === 'qarzga'
        ? 0
        : deliveryPaidAmount === ''
        ? totalDeliveredSum
        : Number(deliveryPaidAmount) || 0;

    const deliveryPayData: DeliveryPaymentInfo | undefined =
      hasProducts && validProducts.length > 0
        ? {
            paymentType: deliveryPaymentType,
            paymentLabel:
              DELIVERY_PAYMENT_OPTIONS.find((o) => o.id === deliveryPaymentType)?.label ||
              deliveryPaymentType,
            currency: 'USD',
            paidAmount: effectivePaid,
            totalAmount: totalDeliveredSum,
            debtAmount:
              deliveryPaymentType === 'qarzga'
                ? totalDeliveredSum
                : Math.max(0, Math.round((totalDeliveredSum - effectivePaid) * 100) / 100),
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

    onSaveReport(planItem.id, {
      actionDone,
      financialAction: financialData,
      productsDelivered: validProducts,
      deliveryPayment: deliveryPayData,
      productsReturned: productsReturned.length > 0 ? productsReturned : undefined,
      reportNote: reportNote.trim(),
    });

    onClose();
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
                      setPaymentAmount(planItem.plannedAmount || '');
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
                <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-3 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-bold text-rose-900">
                      To'lov tafsilotlari (USD)
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenNakladnoy}
                      className="flex items-center gap-1 text-xs font-bold text-neutral-800 bg-white px-2.5 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Print / Yuk xati (PDF)</span>
                    </button>
                  </div>
                  {/* To'lov usuli tanlash: Naqd pul, Bank, Karta, QR */}
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1.5">
                      To'lov usuli
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {FINANCIAL_PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          disabled={isClosed}
                          onClick={() => setPaymentMethod(m.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            paymentMethod === m.id
                              ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:bg-rose-50/50'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Avtomatik Konvertatsiya (Naqd pul, Bank, Karta yoki QR tanlanganda) */}
                  <UsdConverterPanel
                    disabled={isClosed}
                    label={`${
                      FINANCIAL_PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label ||
                      "To'lov"
                    } bo'yicha so'mdan (UZS) USDga konvertatsiya`}
                    onApplyUsd={(usdVal, convNote) => {
                      setPaymentAmount(usdVal);
                      setPaymentNote((prev) => (prev ? `${prev} | ${convNote}` : convNote));
                    }}
                  />

                  {/* To'langan summa (USD) va izoh */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        To'langan summa (USD) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        disabled={isClosed}
                        required={hasPayment}
                        min="0.01"
                        step="any"
                        placeholder="Masalan: 150"
                        value={paymentAmount}
                        onChange={(e) =>
                          setPaymentAmount(
                            e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white font-mono font-bold text-sm text-neutral-900 outline-none focus:border-rose-500"
                      />
                      {typeof paymentAmount === 'number' && paymentAmount > 0 && (
                        <div className="text-[11px] font-mono text-rose-800 mt-1">
                          Hisobotga qo'shiladi: {formatMoney(paymentAmount)}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        To'lov bo'yicha izoh
                      </label>
                      <input
                        type="text"
                        disabled={isClosed}
                        placeholder="Chek raqami, konvertatsiya kursi yoki eslatma"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-900 outline-none focus:border-rose-500"
                      />
                    </div>
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
                              <span className="text-xs font-bold text-neutral-700">
                                Mahsulot #{idx + 1}
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
                                  <span className="text-indigo-900 font-bold font-mono">
                                    Eng kam sotilish narxi: {getWarehouseSellingPriceForUnit(selectedWh, p.unit)} USD (1 {p.unit})
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

                  {/* 3-BLOK OXIRIDA: OXIRGI SUMMA, TO'LOV SHAKLI VA KONVERTATSIYA */}
                  {(totalDeliveredSum > 0 || rawBaseDeliveredSum > 0) && (
                    <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-3.5">
                      {/* Oxirgi umumiy summa */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100">
                        <div>
                          <span className="text-xs font-bold text-neutral-800 block">
                            Topshirilgan mahsulotlar oxirgi summasi:
                          </span>
                          {totalDiscountAll > 0 && (
                            <span className="text-[11px] text-neutral-500 font-mono">
                              Narx: {formatMoney(rawBaseDeliveredSum)} | Chegirma: -{formatMoney(totalDiscountAll)}
                            </span>
                          )}
                        </div>
                        <span className="text-base font-extrabold font-mono text-rose-800">
                          {formatMoney(totalDeliveredSum)}
                        </span>
                      </div>

                      {/* Mahsulot uchun to'lov shakli */}
                      <div>
                        <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wide mb-2">
                          Mahsulot uchun to'lov shakli <span className="text-rose-600">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          {DELIVERY_PAYMENT_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={isClosed}
                              onClick={() => {
                                setDeliveryPaymentType(opt.id);
                                if (opt.id === 'qarzga') {
                                  setDeliveryPaidAmount(0);
                                } else {
                                  setDeliveryPaidAmount(totalDeliveredSum);
                                }
                              }}
                              className={`p-2 rounded-xl text-xs font-bold border text-center transition cursor-pointer min-h-[40px] flex items-center justify-center ${
                                deliveryPaymentType === opt.id
                                  ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-rose-50/50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* So'mdan USDga konvertatsiya (Mahsulotni naqdga yoki nasiyaga berishda) */}
                      <UsdConverterPanel
                        disabled={isClosed}
                        label="Mahsulot to'lovi yoki nasiya summasini so'mdan (UZS) USDga konvertatsiya qilish"
                        onApplyUsd={(usdVal, convNote) => {
                          if (deliveryPaymentType === 'qarzga') {
                            // If in nasiya mode and user converts a partial UZS payment or nasiya amount
                            const paidFromConv = Math.max(
                              0,
                              Math.round((totalDeliveredSum - usdVal) * 100) / 100
                            );
                            if (usdVal < totalDeliveredSum) {
                              setDeliveryPaymentType('naqd');
                              setDeliveryPaidAmount(usdVal);
                            } else {
                              setDeliveryPaidAmount(0);
                            }
                            void paidFromConv;
                          } else {
                            setDeliveryPaidAmount(usdVal);
                          }
                          setReportNote((prev) => (prev ? `${prev} | ${convNote}` : convNote));
                        }}
                      />

                      {/* Agar to'lov usuli naqd, bank, karta yoki qr bo'lsa: to'lanadigan summa (USD) */}
                      {deliveryPaymentType !== 'qarzga' && (
                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="text-xs font-bold text-neutral-800">
                              Hozir to'lanayotgan summa (USD):
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                disabled={isClosed}
                                min="0"
                                step="any"
                                placeholder="0"
                                value={deliveryPaidAmount}
                                onChange={(e) =>
                                  setDeliveryPaidAmount(
                                    e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-36 px-3 py-1.5 bg-white rounded-lg border border-neutral-300 font-mono font-bold text-sm text-neutral-900 outline-none focus:border-rose-500"
                              />
                              <button
                                type="button"
                                disabled={isClosed}
                                onClick={() => setDeliveryPaidAmount(totalDeliveredSum)}
                                className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1.5 rounded-lg border border-rose-200 cursor-pointer"
                              >
                                To'liq ({formatMoney(totalDeliveredSum)})
                              </button>
                            </div>
                          </div>

                          {typeof deliveryPaidAmount === 'number' && (
                            <div className="text-xs font-medium pt-1 border-t border-neutral-200/80">
                              {deliveryPaidAmount === totalDeliveredSum && (
                                <span className="text-emerald-700 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  Mahsulot qiymati to'liq to'landi (Mijozga yangi qarz qo'shilmaydi).
                                </span>
                              )}
                              {deliveryPaidAmount < totalDeliveredSum && (
                                <span className="text-rose-700 font-bold flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Qoldiq to'lanmagan summa (+{formatMoney(totalDeliveredSum - deliveryPaidAmount)}) mijozning qarzdorligiga qo'shiladi.
                                </span>
                              )}
                              {deliveryPaidAmount > totalDeliveredSum && (
                                <span className="text-blue-700 font-bold flex items-center gap-1">
                                  <Coins className="w-3.5 h-3.5" />
                                  Ortiqcha to'lov (+{formatMoney(deliveryPaidAmount - totalDeliveredSum)}) mijozning eski qarzini yopadi yoki avansiga o'tadi.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {deliveryPaymentType === 'qarzga' && (
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <div>
                            <strong>Nasiyaga berildi:</strong> Barcha{' '}
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

            {/* Modal Actions: Print Yuk xati ONLY shown when 2, 3, or 4 is active */}
            <div className="pt-3 border-t border-rose-100 flex flex-wrap items-center justify-between gap-3">
              {hasPayment || hasProducts || totalReturnCount > 0 ? (
                <button
                  type="button"
                  onClick={handleOpenNakladnoy}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer min-h-[40px] flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Yuk xati (PDF)</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer min-h-[40px]"
                >
                  Yopish
                </button>

                {!isClosed && (
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-xs font-bold shadow-xs transition cursor-pointer min-h-[40px] flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Hisobotni saqlash</span>
                  </button>
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
