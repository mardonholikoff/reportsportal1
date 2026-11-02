import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Save,
  Package,
  AlertCircle,
  CheckCircle2,
  Edit3,
  History,
  User,
  Clock,
  Lock,
  Users,
  Search,
  CheckSquare,
  Square,
  Percent,
  Plus,
  Trash2,
  Tag,
  Info,
} from 'lucide-react';
import {
  MonthlyPlan,
  MonthlyPlanTarget,
  MonthlyPlanDecadeTargets,
  MonthlyProductPlanClientItem,
  PlannedProductDeliveryItem,
  Client,
  WarehouseProduct,
} from '../types';
import { storageService } from '../services/storage';

interface CreateMonthlyProductPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPlan?: MonthlyPlan | null;
  clients?: Client[];
  warehouseProducts: WarehouseProduct[];
  currentUsername?: string;
  onSave?: (
    targets: MonthlyPlanTarget[],
    decadeTargets: MonthlyPlanDecadeTargets,
    productClientPlans: MonthlyProductPlanClientItem[],
    startDate: string,
    endDate: string,
    notes?: string,
    editReason?: string
  ) => void;
  onSavePlan?: (
    targets: MonthlyPlanTarget[],
    decadeTargets: MonthlyPlanDecadeTargets,
    productClientPlans: MonthlyProductPlanClientItem[],
    startDate: string,
    endDate: string,
    notes?: string,
    editReason?: string
  ) => void;
}

interface ClientProductRowDraft {
  selected: boolean;
  plannedProducts: PlannedProductDeliveryItem[];
}

export const CreateMonthlyProductPlanModal: React.FC<CreateMonthlyProductPlanModalProps> = ({
  isOpen,
  onClose,
  existingPlan,
  clients: clientsProp,
  warehouseProducts,
  onSave,
  onSavePlan,
}) => {
  const clients = useMemo(
    () => (Array.isArray(clientsProp) ? clientsProp : storageService.getClients()),
    [clientsProp, isOpen]
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Multi-client state
  const [clientDrafts, setClientDrafts] = useState<Record<string, ClientProductRowDraft>>({});
  const [clientSearch, setClientSearch] = useState<string>('');
  const [showOnlySelected, setShowOnlySelected] = useState<boolean>(false);

  // Active client being edited in the warehouse product picker
  const [activePickerClientId, setActivePickerClientId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [pickerQuantity, setPickerQuantity] = useState<string>('1');
  const [pickerDiscountPercent, setPickerDiscountPercent] = useState<string>('0');
  const [pickerDiscountAmount, setPickerDiscountAmount] = useState<string>('0');
  const [pickerCustomUnitPrice, setPickerCustomUnitPrice] = useState<string>('');

  const isEditMode = useMemo(() => {
    if (!existingPlan) return false;
    const endMs = new Date(`${existingPlan.endDate}T23:59:59`).getTime();
    return existingPlan.status === 'active' && endMs >= Date.now();
  }, [existingPlan]);

  useEffect(() => {
    if (!isOpen) return;

    const initialDrafts: Record<string, ClientProductRowDraft> = {};
    clients.forEach((c) => {
      initialDrafts[c.id] = {
        selected: false,
        plannedProducts: [],
      };
    });

    if (existingPlan && isEditMode) {
      setStartDate(existingPlan.startDate);
      setEndDate(existingPlan.endDate);
      setNotes(existingPlan.notes || '');
      setEditReason('');

      if (
        Array.isArray(existingPlan.productClientPlans) &&
        existingPlan.productClientPlans.length > 0
      ) {
        existingPlan.productClientPlans.forEach((cp) => {
          const mergedProducts =
            Array.isArray(cp.plannedProducts) && cp.plannedProducts.length > 0
              ? cp.plannedProducts
              : [
                  ...(cp.decade1Products || []),
                  ...(cp.decade2Products || []),
                  ...(cp.decade3Products || []),
                ];
          initialDrafts[cp.clientId] = {
            selected: true,
            plannedProducts: mergedProducts,
          };
        });
      }
    } else {
      const today = new Date();
      const after30Days = new Date(today.getTime() + 30 * 24 * 3600 * 1000);
      setStartDate(today.toISOString().slice(0, 10));
      setEndDate(after30Days.toISOString().slice(0, 10));
      setNotes('');
      setEditReason('');
    }

    setClientDrafts(initialDrafts);
    setClientSearch('');
    setShowOnlySelected(false);
    setActivePickerClientId(null);
    setError('');
  }, [isOpen, existingPlan, isEditMode, clients]);

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    setError('');
    if (!newStart) return;
    const sMs = new Date(`${newStart}T00:00:00`).getTime();
    const minEndMs = sMs + 30 * 24 * 3600 * 1000;
    const curEndMs = endDate ? new Date(`${endDate}T00:00:00`).getTime() : 0;
    if (curEndMs < minEndMs) {
      setEndDate(new Date(minEndMs).toISOString().slice(0, 10));
    }
  };

  const selectedDaysCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(`${startDate}T00:00:00`).getTime();
    const e = new Date(`${endDate}T23:59:59`).getTime();
    return Math.round((e - s) / (24 * 3600 * 1000));
  }, [startDate, endDate]);

  // Live delivered product amounts per client in the selected 30-day window (all payment methods: debt, cash, card, bank, QR)
  const liveDeliveredByClientMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!startDate || !endDate) return map;
    const startObj = new Date(`${startDate}T00:00:00`);
    const endObj = new Date(`${endDate}T23:59:59`);
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) return map;

    const addVal = (clientId: string, val: number) => {
      if (val <= 0) return;
      const cur = map.get(clientId) || 0;
      map.set(clientId, Math.round((cur + val) * 100) / 100);
    };

    const dailyPlans = storageService.getDailyPlans();
    dailyPlans.forEach((dp) => {
      if (!dp.clientId) return;
      if (dp.actionsHistory && dp.actionsHistory.length > 0) {
        dp.actionsHistory.forEach((act) => {
          const actTime = new Date(act.timestamp || dp.completedAt || dp.createdAt);
          if (actTime >= startObj && actTime <= endObj) {
            if (act.productsDelivered && act.productsDelivered.length > 0) {
              const delivVal = act.productsDelivered.reduce(
                (s, p) => s + (p.totalPrice || (p.quantity || 0) * (p.unitPrice || 0)),
                0
              );
              addVal(dp.clientId, delivVal);
            }
          }
        });
      } else if (dp.completedAt && dp.productsDelivered && dp.productsDelivered.length > 0) {
        const compTime = new Date(dp.completedAt);
        if (compTime >= startObj && compTime <= endObj) {
          const delivVal = dp.productsDelivered.reduce(
            (s, p) => s + (p.totalPrice || (p.quantity || 0) * (p.unitPrice || 0)),
            0
          );
          addVal(dp.clientId, delivVal);
        }
      }
    });

    clients.forEach((client) => {
      if (!client.id || !Array.isArray(client.logs)) return;
      client.logs.forEach((log) => {
        if (log.type === 'product_added' && !String(log.id || '').endsWith('_prod')) {
          const logTime = new Date(log.timestamp);
          if (logTime >= startObj && logTime <= endObj) {
            addVal(client.id, Number(log.amountChanged) || 0);
          }
        }
      });
    });

    return map;
  }, [startDate, endDate, clients]);

  const toggleSelectClient = (clientId: string) => {
    setError('');
    setClientDrafts((prev) => {
      const cur = prev[clientId] || {
        selected: false,
        plannedProducts: [],
      };
      return {
        ...prev,
        [clientId]: { ...cur, selected: !cur.selected },
      };
    });
  };

  // Warehouse product picker helpers
  const activeWarehouseProduct = useMemo(() => {
    return warehouseProducts.find((w) => w.id === selectedWarehouseId) || null;
  }, [warehouseProducts, selectedWarehouseId]);

  const baseWarehousePrice = useMemo(() => {
    if (!activeWarehouseProduct) return 0;
    return activeWarehouseProduct.price || activeWarehouseProduct.minSellingPrice || 0;
  }, [activeWarehouseProduct]);

  const handleSelectWarehouseProduct = (wId: string) => {
    setSelectedWarehouseId(wId);
    const prod = warehouseProducts.find((w) => w.id === wId);
    const bPrice = prod ? prod.price || prod.minSellingPrice || 0 : 0;
    setPickerDiscountPercent('0');
    setPickerDiscountAmount('0');
    setPickerCustomUnitPrice(bPrice > 0 ? String(bPrice) : '');
    setPickerQuantity('1');
  };

  // 1) Foiz chegirma (%) o'zgarganda -> Son chegirmasi va Yakuniy narx avtomatik hisoblanadi
  const handleDiscountPercentChange = (pctStr: string) => {
    setPickerDiscountPercent(pctStr);
    const pct = Math.max(0, Math.min(100, Number(pctStr) || 0));
    if (baseWarehousePrice > 0) {
      const discAmt = Math.round(((baseWarehousePrice * pct) / 100) * 100) / 100;
      const finalUnit = Math.max(0, Math.round((baseWarehousePrice - discAmt) * 100) / 100);
      setPickerDiscountAmount(String(discAmt));
      setPickerCustomUnitPrice(String(finalUnit));
    }
  };

  // 2) Son chegirmasi (1 donadan chegirma summasi) o'zgarganda -> Foiz chegirma (%) va Yakuniy narx avtomatik hisoblanadi
  const handleDiscountAmountChange = (amtStr: string) => {
    setPickerDiscountAmount(amtStr);
    const discAmt = Math.max(0, Number(amtStr) || 0);
    if (baseWarehousePrice > 0) {
      const clampedAmt = Math.min(baseWarehousePrice, discAmt);
      const finalUnit = Math.max(0, Math.round((baseWarehousePrice - clampedAmt) * 100) / 100);
      const pct = Math.max(
        0,
        Math.min(100, Math.round(((clampedAmt / baseWarehousePrice) * 100) * 100) / 100)
      );
      setPickerDiscountPercent(String(pct));
      setPickerCustomUnitPrice(String(finalUnit));
    }
  };

  // 3) Yakuniy sotish narxi o'zgarganda -> Foiz chegirma (%) va Son chegirmasi avtomatik hisoblanadi
  const handleCustomUnitPriceChange = (priceStr: string) => {
    setPickerCustomUnitPrice(priceStr);
    const customPrice = Math.max(0, Number(priceStr) || 0);
    if (baseWarehousePrice > 0) {
      const discAmt = Math.max(0, Math.round((baseWarehousePrice - customPrice) * 100) / 100);
      const pct = Math.max(
        0,
        Math.min(100, Math.round(((discAmt / baseWarehousePrice) * 100) * 100) / 100)
      );
      setPickerDiscountAmount(String(discAmt));
      setPickerDiscountPercent(String(pct));
    } else {
      setPickerDiscountAmount('0');
      setPickerDiscountPercent('0');
    }
  };

  const pickerCalculatedTotal = useMemo(() => {
    const qty = Math.max(0, Number(pickerQuantity) || 0);
    const unitPrice = Math.max(0, Number(pickerCustomUnitPrice) || 0);
    return Math.round(qty * unitPrice * 100) / 100;
  }, [pickerQuantity, pickerCustomUnitPrice]);

  const openProductPicker = (clientId: string) => {
    setActivePickerClientId(clientId);
    if (warehouseProducts.length > 0 && !selectedWarehouseId) {
      handleSelectWarehouseProduct(warehouseProducts[0].id);
    }
  };

  const handleAddPlannedProductToClient = () => {
    if (!activePickerClientId || !activeWarehouseProduct) return;
    const qty = Number(pickerQuantity) || 0;
    const unitPrice = Number(pickerCustomUnitPrice) || 0;
    const discPct = Number(pickerDiscountPercent) || 0;
    const discAmt = Number(pickerDiscountAmount) || 0;

    if (qty <= 0) {
      setError('Mahsulot miqdorini 0 dan katta kiriting!');
      return;
    }

    const newItem: PlannedProductDeliveryItem = {
      id: `pp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      warehouseId: activeWarehouseProduct.id,
      productName: `${activeWarehouseProduct.brand} - ${activeWarehouseProduct.name}`,
      brand: activeWarehouseProduct.brand,
      unit: activeWarehouseProduct.pieceUnitName || activeWarehouseProduct.baseUnit || 'dona',
      quantity: qty,
      originalUnitPrice: baseWarehousePrice,
      discountPercent: Math.round(discPct * 100) / 100,
      discountAmount: Math.round(discAmt * 100) / 100,
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(qty * unitPrice * 100) / 100,
    };

    setClientDrafts((prev) => {
      const cur = prev[activePickerClientId] || {
        selected: true,
        plannedProducts: [],
      };
      return {
        ...prev,
        [activePickerClientId]: {
          ...cur,
          selected: true,
          plannedProducts: [...cur.plannedProducts, newItem],
        },
      };
    });

    setError('');
  };

  const handleRemovePlannedProduct = (clientId: string, itemId: string) => {
    setClientDrafts((prev) => {
      const cur = prev[clientId];
      if (!cur) return prev;
      return {
        ...prev,
        [clientId]: {
          ...cur,
          plannedProducts: cur.plannedProducts.filter((p) => p.id !== itemId),
        },
      };
    });
  };

  const getClientRowStats = (clientId: string) => {
    const draft = clientDrafts[clientId];
    if (!draft) {
      return {
        totalSum: 0,
        deliveredTotal: 0,
        pctTotal: 0,
      };
    }
    const totalSum =
      Math.round(draft.plannedProducts.reduce((s, p) => s + (p.totalPrice || 0), 0) * 100) / 100;
    const deliveredTotal = liveDeliveredByClientMap.get(clientId) || 0;
    const pctTotal =
      totalSum > 0 ? Math.min(100, Math.round(((deliveredTotal / totalSum) * 100) * 10) / 10) : 0;

    return {
      totalSum,
      deliveredTotal,
      pctTotal,
    };
  };

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return clients.filter((c) => {
      const draft = clientDrafts[c.id];
      if (showOnlySelected && !draft?.selected) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.region || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
      );
    });
  }, [clients, clientSearch, showOnlySelected, clientDrafts]);

  // Automatic 30-day totals calculated from selected clients' planned warehouse products
  const clientAggregates = useMemo(() => {
    let selectedCount = 0;
    let total30DayTarget = 0;
    let total30DayDelivered = 0;
    let totalProductsItemsCount = 0;

    Object.entries(clientDrafts).forEach(([cId, draft]) => {
      if (!draft.selected) return;
      const st = getClientRowStats(cId);
      if (st.totalSum > 0) {
        selectedCount++;
        total30DayTarget += st.totalSum;
        total30DayDelivered += st.deliveredTotal;
        totalProductsItemsCount += draft.plannedProducts.length;
      }
    });

    const roundedTarget = Math.round(total30DayTarget * 100) / 100;
    const roundedDelivered = Math.round(total30DayDelivered * 100) / 100;
    const overallPercentage =
      roundedTarget > 0
        ? Math.min(100, Math.round(((roundedDelivered / roundedTarget) * 100) * 10) / 10)
        : 0;

    return {
      selectedCount,
      total30DayTarget: roundedTarget,
      total30DayDelivered: roundedDelivered,
      overallPercentage,
      totalProductsItemsCount,
    };
  }, [clientDrafts, liveDeliveredByClientMap]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!startDate || !endDate) {
      setError('Boshlanish va tugash sanalarini kiriting!');
      return;
    }

    const sMs = new Date(`${startDate}T00:00:00`).getTime();
    const eMs = new Date(`${endDate}T23:59:59`).getTime();
    const diffDays = Math.round((eMs - sMs) / (24 * 3600 * 1000));

    if (diffDays < 30) {
      setError(
        `30 kunlik mahsulot rejasi uchun muddat eng kamida 30 kun bo'lishi shart! (Hozir tanlangan: ${diffDays} kun)`
      );
      return;
    }

    const builtProductClientPlans: MonthlyProductPlanClientItem[] = [];
    clients.forEach((c) => {
      const draft = clientDrafts[c.id];
      if (!draft || !draft.selected) return;
      const st = getClientRowStats(c.id);
      if (st.totalSum <= 0) return;

      builtProductClientPlans.push({
        clientId: c.id,
        clientName: c.name,
        clientCode: c.region || '',
        clientPhone: c.phone,
        targetAmount: st.totalSum,
        plannedProducts: draft.plannedProducts,
      });
    });

    if (builtProductClientPlans.length === 0 || clientAggregates.total30DayTarget <= 0) {
      setError(
        "Kamida bitta mijozni tanlab, unga 30 kunlik reja uchun ombordan mahsulot biriktiring! (30 kunlik summa avtomatik hisoblanadi)"
      );
      return;
    }

    if (isEditMode && !editReason.trim()) {
      setError(
        'Mavjud 30 kunlik mahsulot rejasini tahrirlash uchun tahrir izohini (sababini) yozish majburiy!'
      );
      return;
    }

    const autoTargetAmount = clientAggregates.total30DayTarget;
    const validTargets: MonthlyPlanTarget[] = [
      { currency: 'USD', targetAmount: autoTargetAmount },
    ];
    const decadeTargetsPayload: MonthlyPlanDecadeTargets = {
      decade1: autoTargetAmount,
      decade2: 0,
      decade3: 0,
    };

    const saveHandler = onSavePlan || onSave;
    if (saveHandler) {
      saveHandler(
        validTargets,
        decadeTargetsPayload,
        builtProductClientPlans,
        startDate,
        endDate,
        notes.trim() || undefined,
        isEditMode ? editReason.trim() : undefined
      );
    }
    onClose();
  };

  const activeClientObj = activePickerClientId
    ? clients.find((c) => c.id === activePickerClientId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-indigo-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between text-white shrink-0 ${
            isEditMode
              ? 'bg-gradient-to-r from-indigo-700 via-violet-700 to-purple-800'
              : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              {isEditMode ? <Edit3 className="w-5 h-5" /> : <Package className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold tracking-tight">
                  {isEditMode
                    ? 'Mavjud 30 Kunlik Mahsulot Rejasini Tahrirlash'
                    : 'Yangi 1 Oylik (30 Kunlik) Mahsulot Berish Rejasi'}
                </h2>
                {isEditMode && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-300 text-amber-950">
                    <Lock className="w-3 h-3" />
                    Faqat tahrirlash rejimi
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-100 font-medium">
                {isEditMode
                  ? "Muddat yakunlanmaguncha yangi mahsulot rejasi ochilmaydi — o'zgarishlar izoh bilan xronologiyaga yoziladi"
                  : 'Mijozlarni tanlab, ombordagi mahsulotlardan (foiz yoki son chegirmasi bilan) 30 kunlik reja tuzing — umumiy summa avtomatik hisoblanadi'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Important reminder that warehouse stock is NOT deducted during planning */}
          <div className="p-3.5 rounded-xl bg-indigo-50/90 border border-indigo-200 flex items-start gap-2.5 text-xs text-indigo-950">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold">Eslatma:</span> 30 kunlik reja uchun tanlangan
              mahsulotlar{' '}
              <span className="font-extrabold underline decoration-indigo-400">
                ombordan ketmaydi (zaxiradan kamaymaydi)
              </span>{' '}
              va shunchaki reja uchun ombor hisobida foydalaniladi. Mijozga haqiqiy mahsulot
              berilganda (xoh qarzga, xoh naqd/karta/bank/QR to'lov usuli bilan bo'lsin) mijozning
              30 kunlik foizi (%) hamda umumiy 30 kunlik reja foizi (%) avtomatik o'zgaradi.
            </div>
          </div>

          {isEditMode && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-amber-950">
                  Faol 30 kunlik mahsulot rejasi mavjud ({existingPlan?.startDate} —{' '}
                  {existingPlan?.endDate})
                </p>
                <p className="mt-0.5 text-amber-800">
                  Muddat tugamaguncha yangi reja tuzilmaydi. Mavjud rejani tahrirlashingiz mumkin va
                  har bir tahrir izohi xronologiyada saqlanadi.
                </p>
              </div>
            </div>
          )}

          {/* Step 1 & Step 2: Date Range (min 30 days) + Automatic 30-day Total Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Step 1: Date Range */}
            <div className="lg:col-span-6 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  1. Reja muddati (eng kamida 30 kun)
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                    selectedDaysCount >= 30
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Tanlangan: {selectedDaysCount} kun{' '}
                  {selectedDaysCount >= 30 ? '✓' : '(Kamida 30 kun)'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Boshlanish sanasi *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Tugash sanasi (kamida +30 kun) *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setError('');
                    }}
                    min={
                      startDate
                        ? new Date(
                            new Date(`${startDate}T00:00:00`).getTime() + 30 * 24 * 3600 * 1000
                          )
                            .toISOString()
                            .slice(0, 10)
                        : undefined
                    }
                    className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Automatic 30-day Total Summary & Progress */}
            <div className="lg:col-span-6 bg-gradient-to-br from-indigo-50 via-violet-50 to-blue-50 p-4 rounded-xl border border-indigo-200 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                  <Package className="w-4 h-4 text-indigo-600" />
                  2. 30 kunlik mahsulot rejasi (Avtomatik hisoblanadi)
                </label>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-600 text-white shadow-sm">
                  <Percent className="w-3 h-3" />
                  Umumiy 30 kunlik: {clientAggregates.overallPercentage}%
                </span>
              </div>

              <div className="my-2 grid grid-cols-3 gap-2.5">
                <div className="bg-white/90 rounded-lg p-2.5 border border-indigo-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    30 kunlik jami reja
                  </div>
                  <div className="text-base sm:text-lg font-black text-indigo-900 mt-0.5">
                    {clientAggregates.total30DayTarget.toLocaleString('uz-UZ')}
                  </div>
                </div>
                <div className="bg-white/90 rounded-lg p-2.5 border border-emerald-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Amalda berilgan
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
                    {clientAggregates.total30DayDelivered.toLocaleString('uz-UZ')}
                  </div>
                </div>
                <div className="bg-white/90 rounded-lg p-2.5 border border-violet-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Tanlangan mijozlar
                  </div>
                  <div className="text-base sm:text-lg font-black text-violet-900 mt-0.5">
                    {clientAggregates.selectedCount} ta ({clientAggregates.totalProductsItemsCount}{' '}
                    mahsulot)
                  </div>
                </div>
              </div>

              <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, clientAggregates.overallPercentage)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Warehouse Product Selector Panel (Opens when clicking + Ombordan qo'shish on any client row) */}
          {activePickerClientId && activeClientObj && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 border-2 border-indigo-300 shadow-md space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs">
                    <Tag className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-indigo-950">
                      Ombordan 30 kunlik reja uchun mahsulot biriktirish:{' '}
                      <span className="text-indigo-700 underline">{activeClientObj.name}</span>
                    </h4>
                    <p className="text-[11px] text-indigo-700 font-semibold">
                      30 kunlik reja uchun (Ombordan zaxira kamaymaydi) — Foiz (%) yoki Son
                      chegirmasi orqali tanlash mumkin
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePickerClientId(null)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Yopish ✕
                </button>
              </div>

              {warehouseProducts.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
                  Omborda hozircha mahsulotlar mavjud emas. Avval omborga mahsulot kiriting.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                      Ombordagi mahsulotni tanlang
                    </label>
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => handleSelectWarehouseProduct(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-indigo-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {warehouseProducts.map((wp) => (
                        <option key={wp.id} value={wp.id}>
                          {wp.brand} - {wp.name} (Ombor narxi:{' '}
                          {(wp.price || wp.minSellingPrice || 0).toLocaleString('uz-UZ')} | Qoldiq:{' '}
                          {wp.totalPieces} {wp.pieceUnitName || 'dona'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                      Miqdori ({activeWarehouseProduct?.pieceUnitName || 'dona'})
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={pickerQuantity}
                      onChange={(e) => setPickerQuantity(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-extrabold rounded-lg border border-indigo-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                      Foiz chegirma (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={pickerDiscountPercent}
                        onChange={(e) => handleDiscountPercentChange(e.target.value)}
                        className="w-full pl-2.5 pr-6 py-2 text-xs font-extrabold rounded-lg border border-indigo-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-amber-700"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-black text-amber-700">
                        %
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                      Son chegirmasi (1 donadan)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={pickerDiscountAmount}
                      onChange={(e) => handleDiscountAmountChange(e.target.value)}
                      placeholder="Chegirma soni"
                      className="w-full px-2.5 py-2 text-xs font-extrabold rounded-lg border border-indigo-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-rose-700"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                      Yakuniy narx
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={pickerCustomUnitPrice}
                      onChange={(e) => handleCustomUnitPriceChange(e.target.value)}
                      className="w-full px-2 py-2 text-xs font-extrabold rounded-lg border border-indigo-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-500">Avto-summa:</div>
                      <div className="text-sm font-black text-indigo-900">
                        {pickerCalculatedTotal.toLocaleString('uz-UZ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPlannedProductToClient}
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-sm transition-colors shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Qo'shish
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Multi-client 30-day product planning table */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                <Users className="w-4 h-4 text-indigo-600" />
                3. Mijozlar bo'yicha 30 kunlik mahsulot rejasini belgilash (Bittada tayyorlash)
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-extrabold">
                  Tanlangan mijozlar: {clientAggregates.selectedCount} ta
                </span>
                <span className="px-2.5 py-1 rounded-full border font-extrabold bg-emerald-100 text-emerald-800 border-emerald-300">
                  Jami 30 kunlik mahsulot rejasi:{' '}
                  {clientAggregates.total30DayTarget.toLocaleString('uz-UZ')} (
                  {clientAggregates.overallPercentage}%)
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 font-medium">
              Mijozni belgilab, <span className="font-bold text-indigo-700">+ Ombordan mahsulot tanlash</span>{' '}
              tugmasini bosing. Ombordagi mahsulotni foiz chegirma (%) yoki son chegirmasi bilan
              qo'shishingiz bilan mijozning 30 kunlik summasi va tepadagi umumiy 30 kunlik reja
              avtomatik hisoblanadi.
            </p>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Mijoz ismi, kodi, telefoni bo'yicha qidirish..."
                  className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowOnlySelected((prev) => !prev)}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                  showOnlySelected
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {showOnlySelected
                  ? `Faqat tanlanganlar (${clientAggregates.selectedCount})`
                  : 'Faqat tanlanganlarni ko‘rsatish'}
              </button>
            </div>

            {/* Clients Table (30-Day Only, No 10-Day Columns) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="max-h-96 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[780px]">
                  <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">Tanlash</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Mijoz va Joriy Balans</th>
                      <th className="py-2.5 px-3 min-w-[340px] bg-indigo-50/60 text-indigo-900">
                        30 Kunlik Reja Uchun Ombordan Tanlangan Mahsulotlar
                      </th>
                      <th className="py-2.5 px-3 w-48 bg-emerald-50/70 text-emerald-900 text-right">
                        30 Kunlik Avto-Summa va Bajarilish (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-semibold">
                          Mijozlar topilmadi
                        </td>
                      </tr>
                    ) : (
                      filteredClients.map((client) => {
                        const draft = clientDrafts[client.id] || {
                          selected: false,
                          plannedProducts: [],
                        };
                        const st = getClientRowStats(client.id);
                        const isPickerOpenForClient = activePickerClientId === client.id;

                        return (
                          <tr
                            key={client.id}
                            className={`transition-colors align-top ${
                              draft.selected ? 'bg-indigo-50/20' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleSelectClient(client.id)}
                                className="text-indigo-600 hover:text-indigo-700 focus:outline-none mt-1"
                              >
                                {draft.selected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            </td>

                            <td
                              className="py-2.5 px-3 cursor-pointer"
                              onClick={() => !draft.selected && toggleSelectClient(client.id)}
                            >
                              <div className="font-bold text-slate-800">{client.name}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                                {client.region && <span>Kod: {client.region}</span>}
                                {client.phone && <span>• {client.phone}</span>}
                              </div>
                              <div className="mt-1">
                                {(client.currentDebt || 0) > 0 ? (
                                  <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-[10px]">
                                    Qarzdorlik: {(client.currentDebt || 0).toLocaleString('uz-UZ')}
                                  </span>
                                ) : (client.currentAdvance || 0) > 0 ? (
                                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px]">
                                    Haqdorlik:{' '}
                                    {(client.currentAdvance || 0).toLocaleString('uz-UZ')}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px] font-semibold">
                                    0 (Balans nol)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 30-day planned products cell */}
                            <td className="py-2.5 px-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => openProductPicker(client.id)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border flex items-center gap-1.5 transition-colors ${
                                      isPickerOpenForClient
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'
                                    }`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Ombordan mahsulot tanlash
                                  </button>

                                  {draft.plannedProducts.length > 0 && (
                                    <span className="text-[11px] font-bold text-slate-500">
                                      {draft.plannedProducts.length} xil mahsulot tanlangan
                                    </span>
                                  )}
                                </div>

                                {draft.plannedProducts.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {draft.plannedProducts.map((prod) => (
                                      <div
                                        key={prod.id}
                                        className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-1.5 text-[11px]"
                                      >
                                        <div className="min-w-0">
                                          <div className="font-bold text-slate-800 truncate">
                                            {prod.productName}
                                          </div>
                                          <div className="text-slate-600 font-semibold">
                                            {prod.quantity} {prod.unit} ×{' '}
                                            {prod.unitPrice.toLocaleString('uz-UZ')} ={' '}
                                            <span className="font-black text-indigo-800">
                                              {prod.totalPrice.toLocaleString('uz-UZ')}
                                            </span>
                                          </div>
                                          {(prod.discountPercent > 0 ||
                                            (prod.discountAmount && prod.discountAmount > 0)) && (
                                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                              {prod.discountPercent > 0 && (
                                                <span className="inline-block px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-extrabold text-[9px]">
                                                  Foiz chegirma: -{prod.discountPercent}%
                                                </span>
                                              )}
                                              {prod.discountAmount && prod.discountAmount > 0 ? (
                                                <span className="inline-block px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-extrabold text-[9px]">
                                                  Son chegirma: -
                                                  {prod.discountAmount.toLocaleString('uz-UZ')}
                                                </span>
                                              ) : null}
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemovePlannedProduct(client.id, prod.id)
                                          }
                                          className="p-1 text-rose-500 hover:bg-rose-50 rounded shrink-0"
                                          title="O'chirish"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* 30-day automatic sum & live completion % */}
                            <td className="py-2.5 px-3 bg-emerald-50/30 text-right">
                              <div className="font-black text-indigo-900 text-sm">
                                {st.totalSum.toLocaleString('uz-UZ')}
                              </div>
                              <div className="mt-1 flex items-center justify-end gap-1.5">
                                <span className="text-[10px] font-bold text-slate-500">
                                  Berildi: {st.deliveredTotal.toLocaleString('uz-UZ')}
                                </span>
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-black text-[10px]">
                                  <Percent className="w-2.5 h-2.5" />
                                  {st.pctTotal}%
                                </span>
                              </div>
                              {st.totalSum > 0 && (
                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, st.pctTotal)}%` }}
                                  />
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mandatory Edit Reason when modifying an active plan */}
          {isEditMode && (
            <div className="bg-amber-50/90 p-4 rounded-xl border-2 border-amber-300 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                <Edit3 className="w-4 h-4 text-amber-700" />
                Tahrirlash sababi / Izohi (Majburiy) *
              </label>
              <textarea
                rows={2}
                value={editReason}
                onChange={(e) => {
                  setEditReason(e.target.value);
                  setError('');
                }}
                placeholder="30 kunlik mahsulot rejasiga nima uchun o'zgartirish kiritilayotganini yozing..."
                className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl border border-amber-300 focus:ring-2 focus:ring-amber-500 outline-none resize-none bg-white"
                required
              />
            </div>
          )}

          {/* General Note */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Qo'shimcha umumiy eslatma (ixtiyoriy)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="30 kunlik mahsulot berish rejasi bo'yicha umumiy eslatma..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Edit History Log */}
          {existingPlan?.editHistory && existingPlan.editHistory.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                <History className="w-4 h-4 text-indigo-600" />
                Tahrirlar xronologiyasi ({existingPlan.editHistory.length} marta tahrirlangan)
              </div>
              <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                {existingPlan.editHistory.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-extrabold text-indigo-700">
                        <User className="w-3.5 h-3.5" />@{log.editedBy}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {new Date(log.editedAt).toLocaleString('uz-UZ')}
                      </span>
                    </div>
                    <p className="font-bold text-slate-800">Izoh: "{log.reason}"</p>
                    {log.changesSummary && (
                      <p className="text-[11px] text-slate-500">{log.changesSummary}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold flex items-center gap-2 shadow-md transition-all bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            >
              {isEditMode ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Tahrirni Saqlash
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  30 Kunlik Mahsulot Rejasini Saqlash
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
