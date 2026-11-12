import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  Search,
  Users,
  Package,
  Receipt,
  UserCheck,
  Clock,
  Filter,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  MapPin,
  Phone,
  Coins,
} from 'lucide-react';
import { WarehouseProduct, DailyPlanItem, Client, ProductItem } from '../types';
import { storageService } from '../services/storage';
import { formatMoney, formatDateDMY, getAgentDisplayName } from '../utils/format';
import { StickyTableWrapper } from './StickyTableWrapper';

export interface ProductDeliveryRecord {
  id: string;
  timestamp: string; // ISO string or YYYY-MM-DD
  dateStr: string; // YYYY-MM-DD format for filtering
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  clientRegion?: string;
  clientDistrict?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  author: string; // Username of agent or admin
  paymentType?: string; // Naqd, Qarz, Bank, Karta, QR, Split
  paidAmount?: number;
  debtAmount?: number;
  reportNote?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: WarehouseProduct | null;
  dailyPlans?: DailyPlanItem[];
  clients?: Client[];
}

export const ProductDeliveryHistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  product,
  dailyPlans: propDailyPlans,
  clients: propClients,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Date filter: 'all' | 'today' | 'yesterday' | 'this_month' | 'custom'
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'this_month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Resolved plans & clients from props or storageService
  const resolvedPlans = useMemo(() => {
    return propDailyPlans && propDailyPlans.length > 0
      ? propDailyPlans
      : storageService.getDailyPlans();
  }, [propDailyPlans, isOpen]);

  const resolvedClients = useMemo(() => {
    return propClients && propClients.length > 0
      ? propClients
      : storageService.getClients();
  }, [propClients, isOpen]);

  // Today & Yesterday YYYY-MM-DD
  const formatYMD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayYmd = useMemo(() => formatYMD(new Date()), []);
  const yesterdayYmd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatYMD(d);
  }, []);
  const firstDayOfMonthYmd = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  // Matching helper: Check if a delivered product matches the target WarehouseProduct
  const isMatchingProduct = (p: WarehouseProduct, prod: ProductItem): boolean => {
    if (!prod || !p) return false;

    // 1. Strict ID Check: If prod has a warehouseId, IT MUST MATCH p.id EXACTLY!
    // If prod.warehouseId exists and points to a different product, return false immediately.
    if (prod.warehouseId) {
      return prod.warehouseId === p.id;
    }

    // 2. If prod has an id matching p.id
    if ((prod as any).id && (prod as any).id === p.id) {
      return true;
    }

    // 3. Fallback for legacy records without warehouseId
    if (!prod.name) return false;

    const cleanStr = (s?: string) => (s || '').toLowerCase().trim();

    const prodNameClean = cleanStr(prod.name);
    const pNameClean = cleanStr(p.name);
    const pBrandClean = cleanStr(p.brand);
    const prodBrandClean = cleanStr((prod as any).brand);
    const pMark1Clean = cleanStr(p.mark1);
    const prodMark1Clean = cleanStr((prod as any).mark1);
    const pMark2Clean = cleanStr(p.mark2);
    const prodMark2Clean = cleanStr((prod as any).mark2);

    // Build combined full strings
    const fullP = [pBrandClean, pNameClean, pMark1Clean, pMark2Clean, ...(p.extraMarks || []).map(cleanStr)]
      .filter(Boolean)
      .join(' ');

    const fullProd = [prodBrandClean, prodNameClean, prodMark1Clean, prodMark2Clean]
      .filter(Boolean)
      .join(' ');

    // Extract volume/liter/weight specifiers (e.g., '1l', '2l', '4l', '5l', '10l', '20l', '200l', '1 litr', '4 litr', '0.5l', '1kg', '5kg', '5w30')
    const extractVolumeTokens = (str: string): string[] => {
      const tokens: string[] = [];
      const regex = /\b(\d+(?:\.\d+)?)\s*(l|lt|litr|liter|kg|g|ml|w\d+)?\b/gi;
      let match;
      while ((match = regex.exec(str)) !== null) {
        const num = match[1];
        const unit = (match[2] || '').toLowerCase();
        if (unit.startsWith('l') || unit.startsWith('lit')) {
          tokens.push(`${num}l`);
        } else if (unit) {
          tokens.push(`${num}${unit}`);
        } else {
          tokens.push(num);
        }
      }
      return tokens;
    };

    const pVolTokens = extractVolumeTokens(fullP);
    const prodVolTokens = extractVolumeTokens(fullProd);

    // Check Liter/Volume specifier mismatch (e.g., 1L vs 4L or 2L)
    const pLiters = pVolTokens.filter((t) => t.endsWith('l'));
    const prodLiters = prodVolTokens.filter((t) => t.endsWith('l'));

    if (pLiters.length > 0 && prodLiters.length > 0) {
      const isLiterMatch = pLiters.some((pl) => prodLiters.includes(pl));
      if (!isLiterMatch) {
        return false; // Different sizes (e.g. 1L vs 4L or 2L)!
      }
    }

    // Check numeric specifiers if no explicit 'l' suffix
    const pNums = pVolTokens.filter((t) => !t.endsWith('l') && !isNaN(Number(t)));
    const prodNums = prodVolTokens.filter((t) => !t.endsWith('l') && !isNaN(Number(t)));

    if (pLiters.length === 0 && prodLiters.length === 0 && pNums.length > 0 && prodNums.length > 0) {
      const hasMatchingNum = pNums.some((pn) => prodNums.includes(pn));
      if (!hasMatchingNum && (pNums.length === 1 || prodNums.length === 1)) {
        return false;
      }
    }

    // Compare brands if both specified
    if (pBrandClean && prodBrandClean && pBrandClean !== prodBrandClean) {
      return false;
    }

    // Compare mark1 if both specified
    if (pMark1Clean && prodMark1Clean && pMark1Clean !== prodMark1Clean) {
      return false;
    }

    // Compare normalized alphanumerics of full strings
    const normPFull = fullP.replace(/[^a-z0-9]/g, '');
    const normProdFull = fullProd.replace(/[^a-z0-9]/g, '');

    if (normPFull === normProdFull) return true;

    // Exact name match
    const normPName = pNameClean.replace(/[^a-z0-9]/g, '');
    const normProdName = prodNameClean.replace(/[^a-z0-9]/g, '');

    if (normPName === normProdName) {
      if (pMark1Clean && !fullProd.includes(pMark1Clean)) return false;
      if (pMark2Clean && !fullProd.includes(pMark2Clean)) return false;
      return true;
    }

    return false;
  };

  // Helper to format payment type label
  const formatPaymentLabel = (type?: string, paid?: number, debt?: number) => {
    const t = (type || '').toLowerCase();
    let badgeColor = 'bg-neutral-100 text-neutral-800 border-neutral-200';
    let label = 'Qarzga';

    if (t.includes('naqd')) {
      label = 'Naqd pul';
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (t.includes('bank')) {
      label = "Bank o'tkazma";
      badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
    } else if (t.includes('karta')) {
      label = "Karta o'tkazma";
      badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';
    } else if (t.includes('qr')) {
      label = "QR to'lov";
      badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (t.includes('split')) {
      label = "Bo'lib to'lash";
      badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200';
    } else if (paid && paid > 0 && debt && debt > 0) {
      label = `Qisman naqd (${formatMoney(paid)}) + Qarz (${formatMoney(debt)})`;
      badgeColor = 'bg-teal-50 text-teal-800 border-teal-200';
    } else if (paid && paid > 0) {
      label = 'To\'langan';
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }

    return { label, badgeColor };
  };

  // Build all delivery records for this product across all daily plans & clients
  const allDeliveryRecords = useMemo<ProductDeliveryRecord[]>(() => {
    if (!product) return [];
    const list: ProductDeliveryRecord[] = [];
    const clientsMap = new Map<string, Client>();
    resolvedClients.forEach((c) => clientsMap.set(c.id, c));

    // 1. Daily plans deliveries
    resolvedPlans.forEach((dp) => {
      if (!dp) return;
      const clientObj = clientsMap.get(dp.clientId);
      const cName = dp.clientName || clientObj?.name || 'Mijoz';
      const cPhone = dp.clientPhone || clientObj?.phone || '';
      const cAddr = dp.clientAddress || clientObj?.address || '';
      const cReg = dp.clientRegion || clientObj?.region;
      const cDist = dp.clientDistrict || clientObj?.district;

      if (dp.actionsHistory && dp.actionsHistory.length > 0) {
        dp.actionsHistory.forEach((act, actIdx) => {
          if (act && act.productsDelivered && act.productsDelivered.length > 0) {
            act.productsDelivered.forEach((prod, pIdx) => {
              if (isMatchingProduct(product, prod)) {
                const timeStr = act.timestamp || dp.completedAt || dp.createdAt;
                const dStr = timeStr ? timeStr.slice(0, 10) : todayYmd;
                const author = act.author || dp.lastExecutedBy || dp.agentUsername || 'adminc';

                list.push({
                  id: `act_${dp.id}_${actIdx}_${pIdx}`,
                  timestamp: timeStr,
                  dateStr: dStr,
                  clientId: dp.clientId,
                  clientName: cName,
                  clientPhone: cPhone,
                  clientAddress: cAddr,
                  clientRegion: cReg,
                  clientDistrict: cDist,
                  quantity: prod.quantity || 0,
                  unit: prod.unit || product.pieceUnitName || 'dona',
                  unitPrice: prod.unitPrice || product.minSellingPrice || product.price || 0,
                  totalPrice: prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0),
                  author,
                  paymentType: act.deliveryPayment?.paymentType || dp.deliveryPayment?.paymentType || 'qarz',
                  paidAmount: act.deliveryPayment?.paidAmount || dp.deliveryPayment?.paidAmount,
                  debtAmount: act.deliveryPayment?.debtAmount || dp.deliveryPayment?.debtAmount,
                  reportNote: act.reportNote || dp.reportNote || dp.planNote,
                });
              }
            });
          }
        });
      } else if (dp.productsDelivered && dp.productsDelivered.length > 0) {
        dp.productsDelivered.forEach((prod, pIdx) => {
          if (isMatchingProduct(product, prod)) {
            const timeStr = dp.completedAt || dp.createdAt;
            const dStr = timeStr ? timeStr.slice(0, 10) : todayYmd;
            const author = dp.lastExecutedBy || dp.agentUsername || 'adminc';

            list.push({
              id: `plan_${dp.id}_${pIdx}`,
              timestamp: timeStr,
              dateStr: dStr,
              clientId: dp.clientId,
              clientName: cName,
              clientPhone: cPhone,
              clientAddress: cAddr,
              clientRegion: cReg,
              clientDistrict: cDist,
              quantity: prod.quantity || 0,
              unit: prod.unit || product.pieceUnitName || 'dona',
              unitPrice: prod.unitPrice || product.minSellingPrice || product.price || 0,
              totalPrice: prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0),
              author,
              paymentType: dp.deliveryPayment?.paymentType || 'qarz',
              paidAmount: dp.deliveryPayment?.paidAmount,
              debtAmount: dp.deliveryPayment?.debtAmount,
              reportNote: dp.reportNote || dp.planNote,
            });
          }
        });
      }
    });

    // Sort by timestamp descending
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [product, resolvedPlans, resolvedClients, todayYmd]);

  // Filter records by date range and search query
  const filteredRecords = useMemo(() => {
    return allDeliveryRecords.filter((rec) => {
      // 1. Text Search (Client name, phone, agent name, region, address, report note)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesClient = rec.clientName.toLowerCase().includes(q);
        const matchesPhone = rec.clientPhone.toLowerCase().includes(q);
        const matchesAddress = rec.clientAddress.toLowerCase().includes(q);
        const matchesAgent =
          rec.author.toLowerCase().includes(q) ||
          getAgentDisplayName(rec.author).toLowerCase().includes(q);
        const matchesNote = (rec.reportNote || '').toLowerCase().includes(q);

        if (!matchesClient && !matchesPhone && !matchesAddress && !matchesAgent && !matchesNote) {
          return false;
        }
      }

      // 2. Date Filter
      if (dateFilter === 'today') {
        if (rec.dateStr !== todayYmd) return false;
      } else if (dateFilter === 'yesterday') {
        if (rec.dateStr !== yesterdayYmd) return false;
      } else if (dateFilter === 'this_month') {
        if (rec.dateStr < firstDayOfMonthYmd || rec.dateStr > todayYmd) return false;
      } else if (dateFilter === 'custom') {
        if (startDate && rec.dateStr < startDate) return false;
        if (endDate && rec.dateStr > endDate) return false;
      }

      return true;
    });
  }, [allDeliveryRecords, searchQuery, dateFilter, todayYmd, yesterdayYmd, firstDayOfMonthYmd, startDate, endDate]);

  // Aggregated Summary Stats for filtered range
  const summary = useMemo(() => {
    let totalPieces = 0;
    let totalSumUsd = 0;
    const clientIdsSet = new Set<string>();

    filteredRecords.forEach((r) => {
      totalPieces += r.quantity;
      totalSumUsd += r.totalPrice;
      if (r.clientId) clientIdsSet.add(r.clientId);
    });

    return {
      totalPieces,
      totalSumUsd,
      deliveryCount: filteredRecords.length,
      clientsCount: clientIdsSet.size,
    };
  }, [filteredRecords]);

  if (!isOpen || !product) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-60 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-rose-100 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-neutral-900 via-neutral-800 to-rose-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 shadow-xs">
              <Package className="w-5 h-5 stroke-[2.2] text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-rose-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10 uppercase tracking-wider">
                  {product.brand}
                </span>
                <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white">
                  {product.name}
                </h2>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Topshirilgan mahsulotlar tarixi, narxlari va biriktirilgan xodimlar hisoboti
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-3.5 rounded-2xl bg-white border border-neutral-200 shadow-2xs">
            <div className="text-[11px] text-neutral-500 font-medium">Jami topshirilgan:</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-neutral-900 mt-0.5 tabular-nums">
              {summary.totalPieces.toLocaleString()}{' '}
              <span className="text-xs text-neutral-500 font-normal">
                {product.pieceUnitName || 'dona'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-2xs">
            <div className="text-[11px] text-emerald-700 font-medium">Jami qiymati / tushum:</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-900 mt-0.5 tabular-nums">
              {formatMoney(summary.totalSumUsd)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-neutral-200 shadow-2xs">
            <div className="text-[11px] text-neutral-500 font-medium">Topshirishlar soni:</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-neutral-900 mt-0.5 tabular-nums">
              {summary.deliveryCount} marta
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 shadow-2xs">
            <div className="text-[11px] text-purple-700 font-medium">Topshirilgan mijozlar:</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-purple-900 mt-0.5 tabular-nums">
              {summary.clientsCount} ta mijoz
            </div>
          </div>
        </div>

        {/* Filters and Date Range Picker Bar */}
        <div className="p-4 bg-white border-b border-neutral-200 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mijoz nomi, telefon, manzil yoki xodim bo'yicha qidirish..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 focus:bg-white rounded-xl border border-neutral-200 focus:border-rose-500 outline-none transition"
              />
            </div>

            {/* Quick Date Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="font-bold text-neutral-700 flex items-center gap-1 mr-1">
                <Calendar className="w-3.5 h-3.5 text-rose-600" />
                <span>Sana filtri:</span>
              </span>
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  dateFilter === 'all'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Barchasi
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('today')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  dateFilter === 'today'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Bugun
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('yesterday')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  dateFilter === 'yesterday'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Kecha
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('this_month')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  dateFilter === 'this_month'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Shu oy
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('custom')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  dateFilter === 'custom'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Maxsus muddat
              </button>
            </div>
          </div>

          {/* Custom Date Range Picker Inputs (Start Date -> End Date) */}
          {dateFilter === 'custom' && (
            <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-150">
              <span className="font-bold text-rose-900 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-rose-700" />
                <span>Maxsus kunlar oralig'i:</span>
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-600 font-medium">Dan:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2.5 py-1 rounded-xl border border-neutral-300 bg-white font-mono font-bold text-neutral-900 outline-none focus:border-rose-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-600 font-medium">Gacha:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2.5 py-1 rounded-xl border border-neutral-300 bg-white font-mono font-bold text-neutral-900 outline-none focus:border-rose-500"
                  />
                </div>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="px-2 py-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                  >
                    Sanani tozalash
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content Table / Mobile Cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 space-y-3">
              <Package className="w-12 h-12 text-neutral-300 mx-auto" />
              <div className="text-sm font-bold text-neutral-800">
                Topshirilgan mahsulotlar ma'lumoti topilmadi
              </div>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                {dateFilter !== 'all' || searchQuery.trim()
                  ? "Tanlangan sana yoki qidiruv bo'yicha hech qanday topshirilish qayd etilmagan. Filtrlarni o'zgartirib ko'ring."
                  : "Ushbu mahsulot bo'yicha hali hech qanday topshirilish amaliyoti bajarilmagan."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View (>= 768px) */}
              <div className="hidden md:block rounded-2xl border border-neutral-200 overflow-hidden shadow-2xs bg-white">
                <StickyTableWrapper>
                  <table className="w-full text-left text-xs text-neutral-900 border-collapse">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-rose-50/80 border-b border-neutral-200 text-neutral-700 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3.5 w-10 text-center">#</th>
                        <th className="py-3 px-3.5">Qachon (Sana va vaqt)</th>
                        <th className="py-3 px-3.5">Kimga (Mijoz & Manzil)</th>
                        <th className="py-3 px-3.5 text-center">Qanchadan (Miqdor & Narx)</th>
                        <th className="py-3 px-3.5 text-right">Jami Summa</th>
                        <th className="py-3 px-3.5 text-center">To'lov holati</th>
                        <th className="py-3 px-3.5 text-center">Kim tomonidan (Xodim)</th>
                        <th className="py-3 px-3.5">Izoh / Hisobot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredRecords.map((rec, idx) => {
                        const { label: payLabel, badgeColor } = formatPaymentLabel(
                          rec.paymentType,
                          rec.paidAmount,
                          rec.debtAmount
                        );

                        return (
                          <tr key={rec.id} className="hover:bg-rose-50/20 transition-colors">
                            <td className="py-3 px-3.5 text-center text-neutral-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            {/* Qachon */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-bold text-neutral-900 font-mono flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>{formatDateDMY(rec.timestamp)}</span>
                              </div>
                              <div className="text-[10px] text-neutral-400 font-mono ml-5">
                                {rec.timestamp.length > 10 ? rec.timestamp.slice(11, 16) : ''}
                              </div>
                            </td>

                            {/* Kimga */}
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-neutral-900 text-xs sm:text-sm">
                                {rec.clientName}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5 flex-wrap">
                                {rec.clientPhone && (
                                  <span className="flex items-center gap-1 font-mono">
                                    <Phone className="w-3 h-3 text-neutral-400" />
                                    <span>{rec.clientPhone}</span>
                                  </span>
                                )}
                                {(rec.clientRegion || rec.clientDistrict) && (
                                  <span className="flex items-center gap-1 text-neutral-600">
                                    <MapPin className="w-3 h-3 text-neutral-400" />
                                    <span>
                                      {[rec.clientRegion, rec.clientDistrict].filter(Boolean).join(', ')}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Qanchadan (Quantity & Unit Price) */}
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <div className="font-extrabold text-neutral-900 font-mono text-sm">
                                {rec.quantity.toLocaleString()} {rec.unit}
                              </div>
                              <div className="text-[11px] text-neutral-500 font-mono">
                                {rec.unitPrice.toLocaleString()} USD / {rec.unit}
                              </div>
                            </td>

                            {/* Jami Summa */}
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="font-extrabold font-mono text-emerald-800 text-sm">
                                {formatMoney(rec.totalPrice)}
                              </div>
                            </td>

                            {/* To'lov holati */}
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-lg text-[10.5px] font-bold border ${badgeColor}`}
                              >
                                {payLabel}
                              </span>
                            </td>

                            {/* Kim tomonidan */}
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 border border-neutral-200 font-bold text-neutral-900 text-xs">
                                <UserCheck className="w-3.5 h-3.5 text-rose-700" />
                                <span>{getAgentDisplayName(rec.author)}</span>
                              </div>
                            </td>

                            {/* Izoh */}
                            <td className="py-3 px-3.5 max-w-xs text-neutral-600 text-[11px]">
                              {rec.reportNote ? (
                                <span className="italic">{rec.reportNote}</span>
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </StickyTableWrapper>
              </div>

              {/* Mobile Cards View (< 768px) */}
              <div className="block md:hidden space-y-3">
                {filteredRecords.map((rec, idx) => {
                  const { label: payLabel, badgeColor } = formatPaymentLabel(
                    rec.paymentType,
                    rec.paidAmount,
                    rec.debtAmount
                  );

                  return (
                    <div
                      key={rec.id}
                      className="p-4 rounded-2xl border border-neutral-200 bg-white shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-2">
                        <div>
                          <div className="text-[10px] text-neutral-400 font-mono font-bold">
                            #{idx + 1} · {formatDateDMY(rec.timestamp)}{' '}
                            {rec.timestamp.length > 10 ? rec.timestamp.slice(11, 16) : ''}
                          </div>
                          <div className="font-bold text-neutral-900 text-sm mt-0.5">
                            {rec.clientName}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${badgeColor}`}
                        >
                          {payLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-neutral-500 text-[10px] block">Miqdori va Narxi:</span>
                          <span className="font-extrabold text-neutral-900 font-mono">
                            {rec.quantity} {rec.unit}
                          </span>
                          <span className="text-[10px] text-neutral-500 block">
                            @{rec.unitPrice.toLocaleString()} USD
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-neutral-500 text-[10px] block">Jami Summa:</span>
                          <span className="font-extrabold font-mono text-emerald-800 text-sm">
                            {formatMoney(rec.totalPrice)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs text-neutral-600">
                        <div className="flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-rose-700" />
                          <span className="font-bold text-neutral-900">
                            {getAgentDisplayName(rec.author)}
                          </span>
                        </div>

                        {rec.clientPhone && (
                          <span className="font-mono text-[11px] text-neutral-500">
                            {rec.clientPhone}
                          </span>
                        )}
                      </div>

                      {rec.reportNote && (
                        <div className="text-[11px] text-neutral-500 italic bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                          {rec.reportNote}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-neutral-500 font-medium">
            Jami: <strong className="text-neutral-900">{filteredRecords.length} ta</strong> topshirilish yozuvi
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
