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

  // Extract currencies that adminc used when entering products into the warehouse
  const warehouseCurrencies = useMemo(() => {
    const set = new Set<string>();
    actualWarehouseProducts.forEach((p) => {
      if (p.currency && p.currency.trim()) {
        set.add(p.currency.trim());
      }
    });
    if (set.size === 0) {
      set.add("so'm");
      set.add('USD');
    }
    return Array.from(set);
  }, [actualWarehouseProducts]);

  // Section 1: Action done
  const [actionDone, setActionDone] = useState<PlanActionType>('joyiga borildi');

  // Section 2: Financial payment
  const [hasPayment, setHasPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<FinancialMethodType>('naqd');
  const [cashCurrency, setCashCurrency] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');

  // Section 3: Products delivered
  const [hasProducts, setHasProducts] = useState(false);
  const [products, setProducts] = useState<ProductItem[]>([
    {
      id: 'prod_' + Math.random().toString(36).substring(2, 6),
      name: '',
      unit: 'dona',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      warehouseId: '',
    },
  ]);
  const [deliveryPaymentType, setDeliveryPaymentType] = useState<DeliveryPaymentType>('naqd');
  const [deliveryCashCurrency, setDeliveryCashCurrency] = useState<string>('');
  const [deliveryPaidAmount, setDeliveryPaidAmount] = useState<number | ''>('');

  // Section 4: Products returned state: { [productId]: returnedQuantity }
  const [returnsMap, setReturnsMap] = useState<Record<string, number | ''>>({});

  // Section 5: General report note
  const [reportNote, setReportNote] = useState('');

  // Reset or initialize currencies on open
  useEffect(() => {
    if (isOpen) {
      if (warehouseCurrencies.length > 0) {
        setCashCurrency((prev) => prev || warehouseCurrencies[0]);
        setDeliveryCashCurrency((prev) => prev || warehouseCurrencies[0]);
      }
    }
  }, [isOpen, warehouseCurrencies]);

  // Product return is automatically active when visit occurs
  const showReturnSection =
    actionDone === 'joyiga borildi' || actionDone === 'telefon qilindi + joyiga borildi';

  const clientProducts = client?.products || [];

  // Calculate total delivery value
  const totalDeliveredSum = useMemo(() => {
    return products
      .filter((p) => p.name.trim() !== '')
      .reduce((sum, p) => sum + (p.totalPrice || (p.quantity || 0) * (p.unitPrice || 0)), 0);
  }, [products]);

  // Sync delivery paid amount when total delivery price changes (if not in qarzga mode)
  useEffect(() => {
    if (deliveryPaymentType === 'qarzga') {
      setDeliveryPaidAmount(0);
    } else if (deliveryPaidAmount === '' || typeof deliveryPaidAmount === 'number') {
      setDeliveryPaidAmount(totalDeliveredSum);
    }
  }, [totalDeliveredSum, deliveryPaymentType]);

  const activeCashCurrency = cashCurrency || warehouseCurrencies[0] || "so'm";
  const activeDeliveryCashCurrency = deliveryCashCurrency || warehouseCurrencies[0] || "so'm";

  // Section 3: Add new product row
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
        warehouseId: '',
      },
    ]);
  };

  const handleRemoveProductRow = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  // Select warehouse product for row
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
          totalPrice: 0,
        };
        return copy;
      });
      return;
    }

    const defaultUnit = wh.packageUnitName || wh.pieceUnitName || 'dona';
    let unitPrice = wh.price;
    if (defaultUnit === wh.packageUnitName) {
      unitPrice =
        wh.pricingUnitType === 'package'
          ? wh.price
          : wh.price * (wh.piecesPerPackage || 1);
    } else if (defaultUnit === wh.pieceUnitName) {
      unitPrice =
        wh.pricingUnitType === 'piece'
          ? wh.price
          : Math.round(wh.price / (wh.piecesPerPackage || 1));
    }

    const currentQty = products[index]?.quantity || 1;
    const fullName = `${wh.brand} - ${wh.name} ${wh.mark1 ? `[${wh.mark1}]` : ''}`.trim();

    setProducts((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        warehouseId: wh.id,
        name: fullName,
        unit: defaultUnit,
        unitPrice,
        quantity: currentQty,
        totalPrice: Math.round(currentQty * unitPrice),
      };
      return copy;
    });
  };

  // Change unit for warehouse product in row
  const handleUnitChange = (index: number, newUnit: string) => {
    const item = products[index];
    const wh = actualWarehouseProducts.find((w) => w.id === item.warehouseId);
    let unitPrice = item.unitPrice;
    if (wh) {
      if (newUnit === wh.packageUnitName) {
        unitPrice =
          wh.pricingUnitType === 'package'
            ? wh.price
            : wh.price * (wh.piecesPerPackage || 1);
      } else if (newUnit === wh.pieceUnitName) {
        unitPrice =
          wh.pricingUnitType === 'piece'
            ? wh.price
            : Math.round(wh.price / (wh.piecesPerPackage || 1));
      } else {
        unitPrice = wh.price;
      }
    }

    const qty = item.quantity || 1;
    setProducts((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        unit: newUnit,
        unitPrice,
        totalPrice: Math.round(qty * unitPrice),
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
      item.totalPrice = Math.round(item.quantity * (item.unitPrice || 0));
      copy[index] = item;
      return copy;
    });
  };

  const handleProductPriceChange = (index: number, priceVal: number) => {
    setProducts((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      item.unitPrice = Math.max(0, priceVal);
      item.totalPrice = Math.round((item.quantity || 0) * item.unitPrice);
      copy[index] = item;
      return copy;
    });
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

  const totalReturnValue = Object.entries(returnsMap).reduce((sum, [pId, qty]) => {
    const numQty = typeof qty === 'number' ? qty : Number(qty) || 0;
    if (numQty <= 0) return sum;
    const prod = clientProducts.find((p) => p.id === pId);
    return sum + numQty * (prod?.unitPrice || 0);
  }, 0);

  const totalReturnCount = Object.entries(returnsMap).reduce((sum, [_, qty]) => {
    const numQty = typeof qty === 'number' ? qty : Number(qty) || 0;
    return sum + (numQty > 0 ? numQty : 0);
  }, 0);

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planItem) return;
    const isClosed = planItem.isClosed || planItem.status === 'yopildi';
    if (isClosed) return;

    // 1. Financial data (Section 2)
    const selectedFinancialMethodObj = FINANCIAL_PAYMENT_METHODS.find(
      (m) => m.id === paymentMethod
    );
    const numPaymentAmount =
      typeof paymentAmount === 'number' ? paymentAmount : Number(paymentAmount) || 0;

    const financialData =
      hasPayment && numPaymentAmount > 0
        ? {
            method: paymentMethod,
            methodLabel:
              paymentMethod === 'naqd'
                ? `Naqd pul (${activeCashCurrency})`
                : selectedFinancialMethodObj?.label || "To'lov",
            amount: numPaymentAmount,
            currency: paymentMethod === 'naqd' ? activeCashCurrency : "so'm",
            note: paymentNote.trim(),
          }
        : undefined;

    // 2. Delivered products & delivery payment (Section 3)
    const validProducts = hasProducts
      ? products.filter((p) => p.name.trim() !== '')
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
            currency:
              deliveryPaymentType === 'naqd' ? activeDeliveryCashCurrency : "so'm",
            paidAmount: effectivePaid,
            totalAmount: totalDeliveredSum,
            debtAmount:
              deliveryPaymentType === 'qarzga'
                ? totalDeliveredSum
                : Math.max(0, totalDeliveredSum - effectivePaid),
          }
        : undefined;

    // 3. Products returned (Section 4)
    const productsReturned = showReturnSection
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

  // Safe early exit AFTER all hooks
  if (!isOpen || !planItem) return null;

  const isClosed = planItem.isClosed || planItem.status === 'yopildi';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-rose-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/40 border-b border-rose-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-800 bg-rose-100/70 px-2 py-0.5 rounded-md">
                Reja hisoboti
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
          {/* Closed Plan Banner */}
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

          {/* Plan Note Display if present */}
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
                  disabled={isClosed}
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

          {/* ========================================================= */}
          {/* SECTION 2: MOLIYAVIY AMALIYOT */}
          {/* To'lov usulida naqd pul tanlansa avtomatik ravishda ombor valyutalari ochiladi */}
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
                {/* To'lov usuli tanlash */}
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
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
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

                {/* NAQD PUL TANLANSA: AVTOMATIK RAVISHDA OMBORDAGI VALYUTALARNI TANLASH JOYI OCHILADI */}
                {paymentMethod === 'naqd' && (
                  <div className="p-3 bg-white rounded-xl border border-rose-200 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                        <Coins className="w-4 h-4 text-rose-600" />
                        <span>Ombordagi to'lov valyutasini tanlang:</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 italic">
                        (Admin omborga kiritgan valyutalar)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {warehouseCurrencies.map((curr) => (
                        <button
                          key={curr}
                          type="button"
                          disabled={isClosed}
                          onClick={() => setCashCurrency(curr)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                            activeCashCurrency === curr
                              ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                              : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          {curr}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* To'langan summa va izoh */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      To'langan summa ({paymentMethod === 'naqd' ? activeCashCurrency : "so'm"}){' '}
                      <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      disabled={isClosed}
                      required={hasPayment}
                      min="1"
                      placeholder="Masalan: 450000"
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
                        Kiritildi: {formatMoney(paymentAmount)}{' '}
                        {paymentMethod === 'naqd' ? activeCashCurrency : "so'm"}
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
                      placeholder="Chek raqami yoki eslatma"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-900 outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-neutral-600 italic">
                  * Ushbu to'lov mijozning bazadagi qarzdorligini mutanosib ravishda kamaytiradi (ortiqcha to'lov avansga o'tadi) va audit loglarga yoziladi.
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* SECTION 3: YANGI MAHSULOT TOPSHIRILDIMI? */}
          {/* Mavjud ombordagi mahsulotlardan tanlash va oxirida to'lov shakli */}
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
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-neutral-800 block">
                      Topshiriladigan mahsulotlar (Ombordagi zaxiradan tanlanadi)
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Faqat omborda mavjud mahsulotlar tanlanishi mumkin
                    </span>
                  </div>
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

                {/* Omborda mahsulot yo'q bo'lsa ogohlantirish */}
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
                      const selectedWh = actualWarehouseProducts.find((w) => w.id === p.warehouseId);

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

                          {/* Ombordagi mahsulotni tanlash */}
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                              Ombordagi mahsulot <span className="text-rose-600">*</span>
                            </label>
                            <select
                              value={p.warehouseId || ''}
                              disabled={isClosed}
                              onChange={(e) => handleSelectWarehouseProduct(idx, e.target.value)}
                              className="w-full px-3 py-2 bg-neutral-50 focus:bg-white rounded-xl border border-neutral-200 focus:border-rose-500 text-xs font-semibold text-neutral-900 outline-none"
                            >
                              <option value="">-- Ombordagi mahsulotni tanlang --</option>
                              {actualWarehouseProducts.map((wh) => (
                                <option key={wh.id} value={wh.id}>
                                  {wh.brand} - {wh.name} {wh.mark1 ? `[${wh.mark1}]` : ''} (Zaxira: {wh.totalPieces} dona / {Math.floor(wh.totalPieces / (wh.piecesPerPackage || 1))} {wh.packageUnitName})
                                </option>
                              ))}
                            </select>
                            {selectedWh && (
                              <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-500 font-medium">
                                <span>
                                  Zaxirada: <strong className="text-neutral-800">{selectedWh.totalPieces} dona</strong> ({Math.floor(selectedWh.totalPieces / (selectedWh.piecesPerPackage || 1))} {selectedWh.packageUnitName})
                                </span>
                                <span>Valyuta: {selectedWh.currency || "so'm"}</span>
                              </div>
                            )}
                          </div>

                          {/* O'lchov birligi, Miqdori, Narxi, Jami */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {/* O'lchov birligi */}
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
                                  <option value={selectedWh.packageUnitName}>
                                    {selectedWh.packageUnitName} ({selectedWh.piecesPerPackage} dona)
                                  </option>
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

                            {/* Miqdori */}
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

                            {/* Birlik narxi */}
                            <div>
                              <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                Birlik narxi
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

                            {/* Jami summa */}
                            <div>
                              <label className="block text-[10px] font-semibold text-neutral-600 mb-1">
                                Jami qiymat
                              </label>
                              <div className="px-2.5 py-1.5 bg-neutral-100 rounded-lg text-xs font-mono font-bold text-neutral-900 flex items-center h-[36px] truncate">
                                {formatMoney((p.quantity || 0) * (p.unitPrice || 0))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3-BLOK OXIRIDA: MAHSULOT UCHUN TO'LOV SHAKLI VA MUTANOSIB QARZDORLIK/HAQDORLIK */}
                {totalDeliveredSum > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-3.5">
                    {/* Umumiy qiymat */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100">
                      <span className="text-xs font-bold text-neutral-800">
                        Topshirilgan mahsulotlar umumiy qiymati:
                      </span>
                      <span className="text-base font-extrabold font-mono text-rose-800">
                        {formatMoney(totalDeliveredSum)} so'm
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

                    {/* NAQD PUL TANLANSA: OMBORDAGI VALYUTALARNI TANLASH JOYI OCHILADI */}
                    {deliveryPaymentType === 'naqd' && (
                      <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                            <Coins className="w-4 h-4 text-rose-600" />
                            <span>Ombordagi to'lov valyutasini tanlang:</span>
                          </div>
                          <span className="text-[10px] text-neutral-500 italic">
                            (Admin omborga kiritgan valyutalar)
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {warehouseCurrencies.map((curr) => (
                            <button
                              key={curr}
                              type="button"
                              disabled={isClosed}
                              onClick={() => setDeliveryCashCurrency(curr)}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                                activeDeliveryCashCurrency === curr
                                  ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                              }`}
                            >
                              {curr}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Agar to'lov usuli naqd, bank, karta yoki qr bo'lsa: to'lanadigan summa */}
                    {deliveryPaymentType !== 'qarzga' && (
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="text-xs font-bold text-neutral-800">
                            Hozir to'lanayotgan summa ({deliveryPaymentType === 'naqd' ? activeDeliveryCashCurrency : "so'm"}):
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              disabled={isClosed}
                              min="0"
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
                              To'liq
                            </button>
                          </div>
                        </div>

                        {/* Mutanosib hisob-kitob ko'rsatkichi */}
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
                                Qoldiq to'lanmagan summa (+{formatMoney(totalDeliveredSum - deliveryPaidAmount)} so'm) mijozning qarzdorligiga qo'shiladi.
                              </span>
                            )}
                            {deliveryPaidAmount > totalDeliveredSum && (
                              <span className="text-blue-700 font-bold flex items-center gap-1">
                                <Coins className="w-3.5 h-3.5" />
                                Ortiqcha to'lov (+{formatMoney(deliveryPaidAmount - totalDeliveredSum)} so'm) mijozning avansiga o'tadi yoki eski qarzini yopadi.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Agar Qarzga (Nasiya) tanlansa */}
                    {deliveryPaymentType === 'qarzga' && (
                      <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <strong>Nasiyaga berildi:</strong> To'lov amalga oshirilmadi. Barcha{' '}
                          <strong className="font-mono">{formatMoney(totalDeliveredSum)} so'm</strong> mijozning joriy qarzdorligiga to'liq qo'shiladi.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* SECTION 4: MAHSULOTLARNI OMBORGA QAYTARISH */}
          {/* Joyiga borilganda avtomatik ochiladi */}
          {/* ========================================================= */}
          {showReturnSection && (
            <div className="space-y-3 pt-3 border-t border-rose-100 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                    <Undo2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-900 uppercase tracking-wide block">
                      4. Mijozga berilgan mahsulotlarni omborga qaytarish
                    </label>
                    <span className="text-[10px] text-neutral-500">
                      Joyiga borilganda mijoz qaytargan tovarlarni kiritish (majburiy emas)
                    </span>
                  </div>
                </div>

                {totalReturnCount > 0 && (
                  <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 font-mono">
                    {totalReturnCount} dona qaytarilmoqda
                  </span>
                )}
              </div>

              {clientProducts.length === 0 ? (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-500 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span>Ushbu mijozda hozircha qaytarish uchun berilgan mahsulotlar yo'q.</span>
                </div>
              ) : (
                <div className="p-3.5 bg-rose-50/30 rounded-2xl border border-rose-200/80 space-y-3">
                  <div className="text-[11px] text-neutral-600 font-medium">
                    Mijozdagi mavjud tovarlar ro'yxatidan qaytariladigan miqdorni kiriting:
                  </div>

                  <div className="space-y-2">
                    {clientProducts.map((p) => {
                      const curVal = returnsMap[p.id];

                      return (
                        <div
                          key={p.id}
                          className="p-3 bg-white rounded-xl border border-neutral-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="flex-1">
                            <div className="font-bold text-xs text-neutral-900">{p.name}</div>
                            <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2">
                              <span>
                                Mijozda mavjud:{' '}
                                <strong className="text-neutral-800 font-mono">
                                  {p.quantity} {p.unit}
                                </strong>
                              </span>
                              {p.unitPrice > 0 && (
                                <span>• Birlik narxi: {formatMoney(p.unitPrice)}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] font-semibold text-neutral-600">
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
                              <span className="text-[11px] text-neutral-500 font-medium">
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

                  {/* Summary of Return Action */}
                  {totalReturnCount > 0 && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between flex-wrap gap-2 animate-in fade-in">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>
                          <strong>{totalReturnCount} dona</strong> tovar to'g'ridan-to'g'ri omborga qo'shiladi.
                        </span>
                      </div>
                      {totalReturnValue > 0 && (
                        <div className="font-bold text-emerald-950 font-mono">
                          Mijoz qarzi {formatMoney(totalReturnValue)} ga kamayadi
                        </div>
                      )}
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
              placeholder="Mijoz bilan suhbat natijasi, kelishilgan sana, qaytarilgan tovarlar yoki keyingi qadamlar..."
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs text-neutral-900 outline-none focus:border-rose-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-rose-100 flex items-center justify-between gap-3">
            <div className="text-[11px] text-neutral-500">
              * Hisobot saqlangach, mijoz balansi va ombor zaxirasi avtomatik yangilanadi
            </div>

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
  );
};
