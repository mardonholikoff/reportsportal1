import React, { useState, useMemo } from 'react';
import { Client, DailyPlanItem, ProductItem } from '../types';
import { formatMoney, formatNumber, formatDate, formatShortDate } from '../utils/format';
import { UZBEKISTAN_REGIONS } from '../utils/location';
import {
  Package,
  TrendingDown,
  TrendingUp,
  MapPin,
  Users,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
  PhoneCall,
  Navigation,
  DollarSign,
  Layers,
  Sparkles,
  PieChart,
  Eye,
  X,
  CreditCard,
  QrCode,
  Building2,
  Coins,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

interface Props {
  clients: Client[];
  dailyPlans: DailyPlanItem[];
}

export const AdminDashboardAnalytics: React.FC<Props> = ({ clients, dailyPlans }) => {
  // Expand/collapse states for 6 analytical modules
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isDebtOpen, setIsDebtOpen] = useState(false);
  const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);
  const [isVisitsOpen, setIsVisitsOpen] = useState(false);
  const [isRegionalOpen, setIsRegionalOpen] = useState(false);
  const [isClientsDeepOpen, setIsClientsDeepOpen] = useState(false);

  // Selected product drilldown modal state
  const [inspectedProduct, setInspectedProduct] = useState<{
    name: string;
    unit: string;
    clients: { clientName: string; phone: string; address: string; quantity: number; unitPrice: number; totalPrice: number }[];
  } | null>(null);

  // =========================================================================
  // 1. MAHSULOTLAR TAHLILI (Aggregated Products & Internal Filters)
  // =========================================================================
  const [prodSearch, setProdSearch] = useState('');
  const [prodUnitFilter, setProdUnitFilter] = useState('all');
  const [prodSortBy, setProdSortBy] = useState<'totalValue_desc' | 'totalValue_asc' | 'qty_desc' | 'name_asc'>('totalValue_desc');
  const [prodMinSum, setProdMinSum] = useState<'all' | '1m' | '5m'>('all');
  const [prodChartMetric, setProdChartMetric] = useState<'value' | 'quantity'>('value');

  const aggregatedProducts = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        unit: string;
        totalQuantity: number;
        totalValue: number;
        clientCount: number;
        clients: { clientName: string; phone: string; address: string; quantity: number; unitPrice: number; totalPrice: number }[];
      }
    >();

    clients.forEach((c) => {
      c.products.forEach((p) => {
        const key = `${p.name.trim().toLowerCase()}___${p.unit.trim().toLowerCase()}`;
        const itemVal = p.totalPrice || p.quantity * p.unitPrice;
        if (!map.has(key)) {
          map.set(key, {
            name: p.name.trim(),
            unit: p.unit.trim(),
            totalQuantity: p.quantity,
            totalValue: itemVal,
            clientCount: 1,
            clients: [
              {
                clientName: c.name,
                phone: c.phone,
                address: c.address,
                quantity: p.quantity,
                unitPrice: p.unitPrice,
                totalPrice: itemVal,
              },
            ],
          });
        } else {
          const existing = map.get(key)!;
          existing.totalQuantity += p.quantity;
          existing.totalValue += itemVal;
          existing.clientCount += 1;
          existing.clients.push({
            clientName: c.name,
            phone: c.phone,
            address: c.address,
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            totalPrice: itemVal,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [clients]);

  // Total products summary
  const totalProductsValue = useMemo(
    () => aggregatedProducts.reduce((sum, p) => sum + p.totalValue, 0),
    [aggregatedProducts]
  );
  const totalProductsCount = aggregatedProducts.length;
  const totalUnitsQuantity = useMemo(
    () => aggregatedProducts.reduce((sum, p) => sum + p.totalQuantity, 0),
    [aggregatedProducts]
  );

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return aggregatedProducts
      .filter((p) => {
        if (prodSearch.trim() && !p.name.toLowerCase().includes(prodSearch.toLowerCase())) {
          return false;
        }
        if (prodUnitFilter !== 'all' && p.unit.toLowerCase() !== prodUnitFilter.toLowerCase()) {
          return false;
        }
        if (prodMinSum === '1m' && p.totalValue < 1_000_000) return false;
        if (prodMinSum === '5m' && p.totalValue < 5_000_000) return false;
        return true;
      })
      .sort((a, b) => {
        if (prodSortBy === 'totalValue_desc') return b.totalValue - a.totalValue;
        if (prodSortBy === 'totalValue_asc') return a.totalValue - b.totalValue;
        if (prodSortBy === 'qty_desc') return b.totalQuantity - a.totalQuantity;
        return a.name.localeCompare(b.name);
      });
  }, [aggregatedProducts, prodSearch, prodUnitFilter, prodSortBy, prodMinSum]);

  // Product Units list for filter dropdown
  const availableUnits = useMemo(() => {
    const set = new Set<string>();
    aggregatedProducts.forEach((p) => set.add(p.unit));
    return Array.from(set);
  }, [aggregatedProducts]);

  // =========================================================================
  // 2. UMUMIY QARZDORLIK TAHLILI
  // =========================================================================
  const [debtSearch, setDebtSearch] = useState('');
  const [debtRegionFilter, setDebtRegionFilter] = useState('all');
  const [debtDistrictFilter, setDebtDistrictFilter] = useState('all');
  const [debtTierFilter, setDebtTierFilter] = useState<'all' | 'lt_1m' | '1m_5m' | '5m_15m' | 'gt_15m'>('all');
  const [debtSortBy, setDebtSortBy] = useState<'debt_desc' | 'debt_asc' | 'name_asc'>('debt_desc');

  // Total debt metrics
  const debtors = useMemo(() => clients.filter((c) => c.currentDebt > 0), [clients]);
  const totalDebtSum = useMemo(() => debtors.reduce((sum, c) => sum + c.currentDebt, 0), [debtors]);
  const avgDebt = debtors.length > 0 ? totalDebtSum / debtors.length : 0;

  // Debt tiers for chart
  const debtTiers = useMemo(() => {
    let lt_1m = 0, lt_1m_sum = 0;
    let t_1m_5m = 0, t_1m_5m_sum = 0;
    let t_5m_15m = 0, t_5m_15m_sum = 0;
    let gt_15m = 0, gt_15m_sum = 0;

    debtors.forEach((c) => {
      const d = c.currentDebt;
      if (d < 1_000_000) {
        lt_1m++;
        lt_1m_sum += d;
      } else if (d <= 5_000_000) {
        t_1m_5m++;
        t_1m_5m_sum += d;
      } else if (d <= 15_000_000) {
        t_5m_15m++;
        t_5m_15m_sum += d;
      } else {
        gt_15m++;
        gt_15m_sum += d;
      }
    });

    return [
      { label: "1 mln gacha", count: lt_1m, sum: lt_1m_sum, color: 'bg-amber-400', key: 'lt_1m' },
      { label: "1 - 5 mln", count: t_1m_5m, sum: t_1m_5m_sum, color: 'bg-rose-400', key: '1m_5m' },
      { label: "5 - 15 mln", count: t_5m_15m, sum: t_5m_15m_sum, color: 'bg-rose-600', key: '5m_15m' },
      { label: "15 mln dan yuqori", count: gt_15m, sum: gt_15m_sum, color: 'bg-rose-800', key: 'gt_15m' },
    ];
  }, [debtors]);

  // Debt available districts
  const debtAvailableDistricts = useMemo(() => {
    const list = debtors
      .filter((c) => debtRegionFilter === 'all' || c.region === debtRegionFilter)
      .map((c) => c.district)
      .filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [debtors, debtRegionFilter]);

  // Filtered Debtors
  const filteredDebtors = useMemo(() => {
    return debtors
      .filter((c) => {
        if (debtSearch.trim() && !c.name.toLowerCase().includes(debtSearch.toLowerCase()) && !c.phone.includes(debtSearch)) {
          return false;
        }
        if (debtRegionFilter !== 'all' && c.region !== debtRegionFilter) {
          return false;
        }
        if (debtDistrictFilter !== 'all' && c.district !== debtDistrictFilter) {
          return false;
        }
        const d = c.currentDebt;
        if (debtTierFilter === 'lt_1m' && d >= 1_000_000) return false;
        if (debtTierFilter === '1m_5m' && (d < 1_000_000 || d > 5_000_000)) return false;
        if (debtTierFilter === '5m_15m' && (d <= 5_000_000 || d > 15_000_000)) return false;
        if (debtTierFilter === 'gt_15m' && d <= 15_000_000) return false;
        return true;
      })
      .sort((a, b) => {
        if (debtSortBy === 'debt_desc') return b.currentDebt - a.currentDebt;
        if (debtSortBy === 'debt_asc') return a.currentDebt - b.currentDebt;
        return a.name.localeCompare(b.name);
      });
  }, [debtors, debtSearch, debtRegionFilter, debtDistrictFilter, debtTierFilter, debtSortBy]);

  // =========================================================================
  // 3. UMUMIY HAQDORLIK TAHLILI
  // =========================================================================
  const [advSearch, setAdvSearch] = useState('');
  const [advRegionFilter, setAdvRegionFilter] = useState('all');
  const [advDistrictFilter, setAdvDistrictFilter] = useState('all');
  const [advMinFilter, setAdvMinFilter] = useState<'all' | '500k' | '1m' | '3m'>('all');
  const [advSortBy, setAdvSortBy] = useState<'adv_desc' | 'adv_asc' | 'name_asc'>('adv_desc');

  const creditors = useMemo(() => clients.filter((c) => c.currentAdvance > 0), [clients]);
  const totalAdvanceSum = useMemo(() => creditors.reduce((sum, c) => sum + c.currentAdvance, 0), [creditors]);
  const avgAdvance = creditors.length > 0 ? totalAdvanceSum / creditors.length : 0;

  const advAvailableDistricts = useMemo(() => {
    const list = creditors
      .filter((c) => advRegionFilter === 'all' || c.region === advRegionFilter)
      .map((c) => c.district)
      .filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [creditors, advRegionFilter]);

  const filteredCreditors = useMemo(() => {
    return creditors
      .filter((c) => {
        if (advSearch.trim() && !c.name.toLowerCase().includes(advSearch.toLowerCase()) && !c.phone.includes(advSearch)) {
          return false;
        }
        if (advRegionFilter !== 'all' && c.region !== advRegionFilter) return false;
        if (advDistrictFilter !== 'all' && c.district !== advDistrictFilter) return false;
        const adv = c.currentAdvance;
        if (advMinFilter === '500k' && adv < 500_000) return false;
        if (advMinFilter === '1m' && adv < 1_000_000) return false;
        if (advMinFilter === '3m' && adv < 3_000_000) return false;
        return true;
      })
      .sort((a, b) => {
        if (advSortBy === 'adv_desc') return b.currentAdvance - a.currentAdvance;
        if (advSortBy === 'adv_asc') return a.currentAdvance - b.currentAdvance;
        return a.name.localeCompare(b.name);
      });
  }, [creditors, advSearch, advRegionFilter, advDistrictFilter, advMinFilter, advSortBy]);

  // =========================================================================
  // 4. UMUMIY TASHRIFLAR SONI VA AMALLAR TAHLILI
  // =========================================================================
  const [visitAgentFilter, setVisitAgentFilter] = useState('all');
  const [visitActionFilter, setVisitActionFilter] = useState('all');
  const [visitStatusFilter, setVisitStatusFilter] = useState('all');
  const [visitTimeFilter, setVisitTimeFilter] = useState<'all' | 'today' | '3days' | '7days'>('all');
  const [visitSearch, setVisitSearch] = useState('');

  // Combine DailyPlans and Client Logs for visit intelligence
  const visitStats = useMemo(() => {
    const totalPlans = dailyPlans.length;
    const completedPlans = dailyPlans.filter((p) => p.status === 'bajarildi').length;
    const plannedOnly = dailyPlans.filter((p) => p.status === 'rejalashtirilgan').length;

    let phoneCount = 0;
    let visitCount = 0;
    let phoneAndVisitCount = 0;

    dailyPlans.forEach((p) => {
      if (p.actionDone === 'telefon qilindi') phoneCount++;
      else if (p.actionDone === 'joyiga borildi') visitCount++;
      else if (p.actionDone === 'telefon qilindi + joyiga borildi') phoneAndVisitCount++;
    });

    // Also check client logs for visits recorded directly
    clients.forEach((c) => {
      c.logs?.forEach((l) => {
        if (l.type === 'visit_action') {
          if (l.title.includes('joyiga borildi') && l.title.includes('telefon')) phoneAndVisitCount++;
          else if (l.title.includes('joyiga borildi')) visitCount++;
          else if (l.title.includes('telefon qilindi')) phoneCount++;
        }
      });
    });

    const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

    return {
      totalPlans,
      completedPlans,
      plannedOnly,
      phoneCount,
      visitCount,
      phoneAndVisitCount,
      totalInteractions: completedPlans + visitCount + phoneCount + phoneAndVisitCount,
      completionRate,
    };
  }, [dailyPlans, clients]);

  // Filtered Daily Plans & visits list
  const filteredDailyPlans = useMemo(() => {
    const now = Date.now();
    return dailyPlans.filter((p) => {
      if (visitAgentFilter !== 'all' && p.agentUsername !== visitAgentFilter) return false;
      if (visitStatusFilter !== 'all' && p.status !== visitStatusFilter) return false;
      if (visitActionFilter !== 'all' && p.actionDone !== visitActionFilter) return false;
      if (visitSearch.trim()) {
        const query = visitSearch.toLowerCase();
        const matchesClient = p.clientName.toLowerCase().includes(query) || p.clientPhone.includes(query);
        const matchesReport = p.reportNote?.toLowerCase().includes(query) || p.planNote?.toLowerCase().includes(query);
        if (!matchesClient && !matchesReport) return false;
      }
      if (visitTimeFilter !== 'all') {
        const itemTime = new Date(p.completedAt || p.createdAt).getTime();
        const diffHours = (now - itemTime) / (1000 * 3600);
        if (visitTimeFilter === 'today' && diffHours > 24) return false;
        if (visitTimeFilter === '3days' && diffHours > 72) return false;
        if (visitTimeFilter === '7days' && diffHours > 168) return false;
      }
      return true;
    });
  }, [dailyPlans, visitAgentFilter, visitStatusFilter, visitActionFilter, visitSearch, visitTimeFilter]);

  // =========================================================================
  // 5. VILOYAT VA TUMANLAR KESIMIDA TAHLIL
  // =========================================================================
  const [regSelectedRegion, setRegSelectedRegion] = useState('all');
  const [regDistrictSearch, setRegDistrictSearch] = useState('');
  const [regMetric, setRegMetric] = useState<'debt' | 'advance' | 'products' | 'clients'>('debt');
  const [regSortOrder, setRegSortOrder] = useState<'desc' | 'asc'>('desc');

  // Aggregate by Region & District
  const regionalBreakdown = useMemo(() => {
    const regMap = new Map<
      string,
      {
        region: string;
        clientsCount: number;
        totalDebt: number;
        totalAdvance: number;
        totalProductsSum: number;
        districts: Map<
          string,
          {
            district: string;
            clientsCount: number;
            totalDebt: number;
            totalAdvance: number;
            totalProductsSum: number;
          }
        >;
      }
    >();

    clients.forEach((c) => {
      const reg = c.region || "Hudud ko'rsatilmagan";
      const dist = c.district || "Tuman ko'rsatilmagan";
      const prodSum = c.products.reduce((s, p) => s + (p.totalPrice || p.quantity * p.unitPrice), 0);

      if (!regMap.has(reg)) {
        regMap.set(reg, {
          region: reg,
          clientsCount: 0,
          totalDebt: 0,
          totalAdvance: 0,
          totalProductsSum: 0,
          districts: new Map(),
        });
      }

      const rObj = regMap.get(reg)!;
      rObj.clientsCount += 1;
      rObj.totalDebt += c.currentDebt || 0;
      rObj.totalAdvance += c.currentAdvance || 0;
      rObj.totalProductsSum += prodSum;

      if (!rObj.districts.has(dist)) {
        rObj.districts.set(dist, {
          district: dist,
          clientsCount: 0,
          totalDebt: 0,
          totalAdvance: 0,
          totalProductsSum: 0,
        });
      }

      const dObj = rObj.districts.get(dist)!;
      dObj.clientsCount += 1;
      dObj.totalDebt += c.currentDebt || 0;
      dObj.totalAdvance += c.currentAdvance || 0;
      dObj.totalProductsSum += prodSum;
    });

    const list: {
      region: string;
      clientsCount: number;
      totalDebt: number;
      totalAdvance: number;
      totalProductsSum: number;
      districts: {
        district: string;
        clientsCount: number;
        totalDebt: number;
        totalAdvance: number;
        totalProductsSum: number;
      }[];
    }[] = [];

    regMap.forEach((v) => {
      list.push({
        ...v,
        districts: Array.from(v.districts.values()),
      });
    });

    return list;
  }, [clients]);

  // Flattened District rows for analytical table
  const flattenedDistricts = useMemo(() => {
    const rows: {
      region: string;
      district: string;
      clientsCount: number;
      totalDebt: number;
      totalAdvance: number;
      totalProductsSum: number;
      netBalance: number;
    }[] = [];

    regionalBreakdown.forEach((r) => {
      if (regSelectedRegion !== 'all' && r.region !== regSelectedRegion) return;
      r.districts.forEach((d) => {
        if (regDistrictSearch.trim() && !d.district.toLowerCase().includes(regDistrictSearch.toLowerCase())) {
          return;
        }
        rows.push({
          region: r.region,
          district: d.district,
          clientsCount: d.clientsCount,
          totalDebt: d.totalDebt,
          totalAdvance: d.totalAdvance,
          totalProductsSum: d.totalProductsSum,
          netBalance: d.totalDebt - d.totalAdvance,
        });
      });
    });

    return rows.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (regMetric === 'debt') {
        valA = a.totalDebt;
        valB = b.totalDebt;
      } else if (regMetric === 'advance') {
        valA = a.totalAdvance;
        valB = b.totalAdvance;
      } else if (regMetric === 'products') {
        valA = a.totalProductsSum;
        valB = b.totalProductsSum;
      } else {
        valA = a.clientsCount;
        valB = b.clientsCount;
      }
      return regSortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [regionalBreakdown, regSelectedRegion, regDistrictSearch, regMetric, regSortOrder]);

  // Active regions count
  const activeRegionsCount = regionalBreakdown.length;
  const activeDistrictsCount = useMemo(
    () => regionalBreakdown.reduce((sum, r) => sum + r.districts.length, 0),
    [regionalBreakdown]
  );
  const topRegionByTurnover = useMemo(() => {
    if (regionalBreakdown.length === 0) return 'Mavjud emas';
    const sorted = [...regionalBreakdown].sort((a, b) => b.totalProductsSum - a.totalProductsSum);
    return sorted[0].region;
  }, [regionalBreakdown]);

  // =========================================================================
  // 6. MIJOZLAR KESIMIDA CHUQUR TAHLIL
  // =========================================================================
  const [cliDeepSearch, setCliDeepSearch] = useState('');
  const [cliStatusFilter, setCliStatusFilter] = useState<'all' | 'debtor' | 'creditor' | 'zero' | 'top_buyer'>('all');
  const [cliAuthorFilter, setCliAuthorFilter] = useState('all');
  const [cliRegionFilter, setCliRegionFilter] = useState('all');
  const [cliDistrictFilter, setCliDistrictFilter] = useState('all');
  const [cliSortBy, setCliSortBy] = useState<'turnover_desc' | 'debt_desc' | 'advance_desc' | 'logs_desc' | 'name_asc'>('turnover_desc');

  // Enriched clients
  const enrichedClients = useMemo(() => {
    return clients.map((c) => {
      const prodSum = c.products.reduce((s, p) => s + (p.totalPrice || p.quantity * p.unitPrice), 0);
      const totalUnits = c.products.reduce((s, p) => s + p.quantity, 0);
      const logsCount = c.logs?.length || 0;
      const net = (c.currentDebt || 0) - (c.currentAdvance || 0);

      let segment = 'Oddiy xaridor';
      if (c.currentDebt > 5_000_000) {
        segment = 'Yuqori qarz xavfi';
      } else if (c.currentDebt > 0) {
        segment = "Qarzdor mijoz";
      } else if (c.currentAdvance > 0) {
        segment = "Oldindan to'lovchi";
      } else if (prodSum > 10_000_000) {
        segment = "Yirik xaridor";
      }

      return {
        ...c,
        totalProductsSum: prodSum,
        totalUnits,
        logsCount,
        net,
        segment,
      };
    });
  }, [clients]);

  // Available districts for client analysis filter
  const cliAvailableDistricts = useMemo(() => {
    const list = clients
      .filter((c) => cliRegionFilter === 'all' || c.region === cliRegionFilter)
      .map((c) => c.district)
      .filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [clients, cliRegionFilter]);

  // Filtered enriched clients
  const filteredClientsDeep = useMemo(() => {
    return enrichedClients
      .filter((c) => {
        if (cliDeepSearch.trim()) {
          const q = cliDeepSearch.toLowerCase();
          const matches =
            c.name.toLowerCase().includes(q) ||
            c.phone.includes(q) ||
            (c.landmark && c.landmark.toLowerCase().includes(q));
          if (!matches) return false;
        }
        if (cliAuthorFilter !== 'all' && c.createdBy !== cliAuthorFilter) return false;
        if (cliRegionFilter !== 'all' && c.region !== cliRegionFilter) return false;
        if (cliDistrictFilter !== 'all' && c.district !== cliDistrictFilter) return false;

        if (cliStatusFilter === 'debtor' && c.currentDebt <= 0) return false;
        if (cliStatusFilter === 'creditor' && c.currentAdvance <= 0) return false;
        if (cliStatusFilter === 'zero' && (c.currentDebt > 0 || c.currentAdvance > 0)) return false;
        if (cliStatusFilter === 'top_buyer' && c.totalProductsSum < 5_000_000) return false;

        return true;
      })
      .sort((a, b) => {
        if (cliSortBy === 'turnover_desc') return b.totalProductsSum - a.totalProductsSum;
        if (cliSortBy === 'debt_desc') return b.currentDebt - a.currentDebt;
        if (cliSortBy === 'advance_desc') return b.currentAdvance - a.currentAdvance;
        if (cliSortBy === 'logs_desc') return b.logsCount - a.logsCount;
        return a.name.localeCompare(b.name);
      });
  }, [enrichedClients, cliDeepSearch, cliAuthorFilter, cliRegionFilter, cliDistrictFilter, cliStatusFilter, cliSortBy]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1-MODUL: UMUMIY MAHSULOTLAR HAQIDA CHART VA CHART TARKIBIDAGI MAHSULOTLAR */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-rose-100/90 shadow-xs overflow-hidden transition-all duration-200">
        <div
          onClick={() => setIsProductsOpen(!isProductsOpen)}
          className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/20 transition select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-800 font-bold flex items-center justify-center text-sm border border-rose-200 shrink-0">
              <Package className="w-5 h-5 text-rose-700" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                  1. Umumiy mahsulotlar charti va tarkibi
                </h3>
                <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  {totalProductsCount} xil tovar
                </span>
                <span className="text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md hidden sm:inline-block">
                  Jami: {formatMoney(totalProductsValue)}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Barcha mijozlarga berilgan tovarlar aylanmasi, miqdorlar diagrammasi va to'liq jadvali
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsProductsOpen(!isProductsOpen);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer ${
              isProductsOpen
                ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                : 'bg-rose-700 text-white hover:bg-rose-800 shadow-xs'
            }`}
          >
            {isProductsOpen ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Yopish</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Ochish</span>
              </>
            )}
          </button>
        </div>

        {isProductsOpen && (
          <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 space-y-6 animate-in fade-in duration-150">
            {/* Top KPI chips */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">Jami aylanma qiymati</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {formatMoney(totalProductsValue)}
                </div>
                <span className="text-xs text-neutral-500">{totalProductsCount} xil tovar turi hisobida</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">Jami mahsulotlar hajmi</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {formatNumber(totalUnitsQuantity)} birlik
                </div>
                <span className="text-xs text-neutral-500">kg, dona, litr, qop va metr bo'yicha</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">Eng ommabop mahsulot</span>
                <div className="text-base sm:text-lg font-bold font-display text-neutral-900 mt-1 truncate">
                  {aggregatedProducts[0]?.name || 'Mavjud emas'}
                </div>
                <span className="text-xs text-neutral-500">
                  {aggregatedProducts[0] ? `${formatMoney(aggregatedProducts[0].totalValue)} aylanma` : ''}
                </span>
              </div>
            </div>

            {/* CHART SECTION: Visual Bar Chart of Top Products */}
            <div className="bg-[#FAF7F7] p-5 rounded-2xl border border-rose-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-sm font-bold font-display text-neutral-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-rose-700" />
                    <span>Mahsulotlar taqsimoti diagrammasi</span>
                  </h4>
                  <p className="text-xs text-neutral-500">Top tovarlar ulushi va jami qiymati</p>
                </div>
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-rose-100 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setProdChartMetric('value')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      prodChartMetric === 'value'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Summa bo'yicha (so'm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProdChartMetric('quantity')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      prodChartMetric === 'quantity'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Miqdor bo'yicha
                  </button>
                </div>
              </div>

              {/* Responsive SVG / CSS Bar Chart */}
              {aggregatedProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">Mahsulotlar ma'lumoti mavjud emas</div>
              ) : (
                <div className="space-y-3">
                  {aggregatedProducts.slice(0, 7).map((prod, idx) => {
                    const maxVal = Math.max(...aggregatedProducts.map((p) => (prodChartMetric === 'value' ? p.totalValue : p.totalQuantity)), 1);
                    const currentVal = prodChartMetric === 'value' ? prod.totalValue : prod.totalQuantity;
                    const percent = Math.min(Math.round((currentVal / maxVal) * 100), 100);
                    const shareOfTotal = totalProductsValue > 0 ? Math.round((prod.totalValue / totalProductsValue) * 100) : 0;

                    return (
                      <div key={idx} className="group">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-neutral-800 flex items-center gap-2 truncate max-w-[240px] sm:max-w-md">
                            <span className="w-5 h-5 rounded-md bg-white border border-rose-200 text-rose-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="truncate">{prod.name}</span>
                            <span className="text-[10px] font-normal text-neutral-500">({prod.unit})</span>
                          </span>
                          <span className="font-bold text-neutral-900 tabular-nums shrink-0 ml-2">
                            {prodChartMetric === 'value' ? formatMoney(prod.totalValue) : `${formatNumber(prod.totalQuantity)} ${prod.unit}`}
                            {prodChartMetric === 'value' && (
                              <span className="text-[10px] font-normal text-neutral-400 ml-1.5">({shareOfTotal}%)</span>
                            )}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-neutral-200/80 rounded-full overflow-hidden flex items-center">
                          <div
                            className="h-full bg-gradient-to-r from-rose-500 to-rose-700 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* INTERNAL FILTERS FOR PRODUCTS */}
            <div className="bg-white p-4 rounded-2xl border border-rose-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                <Filter className="w-3.5 h-3.5 text-rose-700" />
                <span>Mahsulotlar tarkibi ichki filtrlari:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tovar nomini qidirish..."
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-rose-500 text-neutral-900 placeholder:text-neutral-400"
                  />
                </div>

                {/* Unit filter */}
                <div>
                  <select
                    value={prodUnitFilter}
                    onChange={(e) => setProdUnitFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha o'lchov birliklari</option>
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Min Sum filter */}
                <div>
                  <select
                    value={prodMinSum}
                    onChange={(e) => setProdMinSum(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha summalar</option>
                    <option value="1m">1 mln so'mdan yuqori</option>
                    <option value="5m">5 mln so'mdan yuqori</option>
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <select
                    value={prodSortBy}
                    onChange={(e) => setProdSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="totalValue_desc">Summa: Kattadan kichikka</option>
                    <option value="totalValue_asc">Summa: Kichikdan kattaga</option>
                    <option value="qty_desc">Miqdor: Ko'pdan kamga</option>
                    <option value="name_asc">Nomi: A-Z bo'yicha</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CHART TARKIBIDAGI MAHSULOTLAR JADVALI */}
            <div className="overflow-x-auto rounded-2xl border border-rose-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-rose-50/60 text-neutral-900 border-b border-rose-100">
                    <th className="py-3 px-3.5 font-bold text-center w-10">#</th>
                    <th className="py-3 px-3.5 font-bold">Mahsulot nomi</th>
                    <th className="py-3 px-3.5 font-bold">O'lchov birligi</th>
                    <th className="py-3 px-3.5 font-bold text-right">Jami miqdor</th>
                    <th className="py-3 px-3.5 font-bold text-right">O'rtacha narx</th>
                    <th className="py-3 px-3.5 font-bold text-right">Jami summa</th>
                    <th className="py-3 px-3.5 font-bold text-center">Mijozlar soni</th>
                    <th className="py-3 px-3.5 font-bold text-center">Batafsil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-neutral-500">
                        Filtr bo'yicha mahsulot topilmadi
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, i) => {
                      const avgPrice = p.totalQuantity > 0 ? Math.round(p.totalValue / p.totalQuantity) : 0;
                      return (
                        <tr key={i} className="hover:bg-rose-50/25 transition">
                          <td className="py-3 px-3.5 text-center font-bold text-neutral-500">{i + 1}</td>
                          <td className="py-3 px-3.5 font-bold text-neutral-900">{p.name}</td>
                          <td className="py-3 px-3.5">
                            <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 font-medium text-[11px]">
                              {p.unit}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right font-bold text-neutral-900 tabular-nums">
                            {formatNumber(p.totalQuantity)} {p.unit}
                          </td>
                          <td className="py-3 px-3.5 text-right text-neutral-700 tabular-nums">
                            {formatMoney(avgPrice)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-bold text-rose-800 tabular-nums">
                            {formatMoney(p.totalValue)}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-100">
                              {p.clientCount} ta mijoz
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => setInspectedProduct(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-rose-100 text-neutral-700 hover:text-rose-900 text-[11px] font-bold transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ko'rish</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2-MODUL: UMUMIY QARZDORLIK TAHLILI */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-rose-100/90 shadow-xs overflow-hidden transition-all duration-200">
        <div
          onClick={() => setIsDebtOpen(!isDebtOpen)}
          className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/20 transition select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-900 font-bold flex items-center justify-center text-sm border border-rose-200 shrink-0">
              <TrendingDown className="w-5 h-5 text-rose-800" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                  2. Umumiy qarzdorlik tahlili
                </h3>
                <span className="text-[11px] font-bold text-rose-900 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                  {debtors.length} ta qarzdor
                </span>
                <span className="text-[11px] font-semibold text-rose-900 bg-rose-50 px-2 py-0.5 rounded-md">
                  Jami: {formatMoney(totalDebtSum)}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Kompaniya oldidagi umumiy qarzlar, qarz toifalari taqsimoti va qarzdorlar reytingi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsDebtOpen(!isDebtOpen);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer ${
              isDebtOpen
                ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                : 'bg-rose-700 text-white hover:bg-rose-800 shadow-xs'
            }`}
          >
            {isDebtOpen ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Yopish</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Ochish</span>
              </>
            )}
          </button>
        </div>

        {isDebtOpen && (
          <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 space-y-6 animate-in fade-in duration-150">
            {/* Quick KPI stats */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/80">
                <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider">Jami qarzdorlik</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {formatMoney(totalDebtSum)}
                </div>
                <span className="text-xs text-rose-700 font-medium">{debtors.length} ta faol qarzdor hisobida</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">O'rtacha qarz miqdori</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {formatMoney(avgDebt)}
                </div>
                <span className="text-xs text-neutral-500">Bir mijozga to'g'ri keluvchi o'rtacha</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">Eng katta qarz egasi</span>
                <div className="text-base sm:text-lg font-bold font-display text-neutral-900 mt-1 truncate">
                  {debtors.sort((a, b) => b.currentDebt - a.currentDebt)[0]?.name || 'Mavjud emas'}
                </div>
                <span className="text-xs text-rose-700 font-bold">
                  {debtors[0] ? formatMoney(debtors[0].currentDebt) : ''}
                </span>
              </div>
            </div>

            {/* CHART: Debt Tiers Breakdown */}
            <div className="bg-[#FAF7F7] p-5 rounded-2xl border border-rose-100">
              <h4 className="text-sm font-bold font-display text-neutral-900 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-rose-700" />
                <span>Qarzdorlik toifalari taqsimoti</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {debtTiers.map((tier) => {
                  const share = totalDebtSum > 0 ? Math.round((tier.sum / totalDebtSum) * 100) : 0;
                  return (
                    <div key={tier.key} className="bg-white p-3.5 rounded-xl border border-rose-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-neutral-800">{tier.label}</span>
                        <span className="text-[11px] font-semibold text-rose-800">{tier.count} mijoz</span>
                      </div>
                      <div className="text-sm font-bold text-neutral-900 tabular-nums">
                        {formatMoney(tier.sum)}
                      </div>
                      <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden mt-2">
                        <div className={`h-full ${tier.color} rounded-full`} style={{ width: `${share}%` }} />
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-1 text-right">{share}% jami qarzdan</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* INTERNAL FILTERS */}
            <div className="bg-white p-4 rounded-2xl border border-rose-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                <Filter className="w-3.5 h-3.5 text-rose-700" />
                <span>Qarzdorlik filtrlari:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Mijoz ismi / telefon..."
                    value={debtSearch}
                    onChange={(e) => setDebtSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-rose-500 text-neutral-900 placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <select
                    value={debtRegionFilter}
                    onChange={(e) => {
                      setDebtRegionFilter(e.target.value);
                      setDebtDistrictFilter('all');
                    }}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha viloyatlar</option>
                    {UZBEKISTAN_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={debtDistrictFilter}
                    onChange={(e) => setDebtDistrictFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha tumanlar</option>
                    {debtAvailableDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={debtTierFilter}
                    onChange={(e) => setDebtTierFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha qarz miqdorlari</option>
                    <option value="lt_1m">1 mln gacha</option>
                    <option value="1m_5m">1 - 5 mln</option>
                    <option value="5m_15m">5 - 15 mln</option>
                    <option value="gt_15m">15 mln dan yuqori</option>
                  </select>
                </div>
                <div>
                  <select
                    value={debtSortBy}
                    onChange={(e) => setDebtSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="debt_desc">Qarz: Kattadan kichikka</option>
                    <option value="debt_asc">Qarz: Kichikdan kattaga</option>
                    <option value="name_asc">Mijoz: A-Z bo'yicha</option>
                  </select>
                </div>
              </div>
            </div>

            {/* QARZDORLAR JADVALI */}
            <div className="overflow-x-auto rounded-2xl border border-rose-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-rose-50/60 text-neutral-900 border-b border-rose-100">
                    <th className="py-3 px-3.5 font-bold text-center w-10">#</th>
                    <th className="py-3 px-3.5 font-bold">Mijoz ismi</th>
                    <th className="py-3 px-3.5 font-bold">Telefon</th>
                    <th className="py-3 px-3.5 font-bold">Hudud (Viloyat / Tuman)</th>
                    <th className="py-3 px-3.5 font-bold text-right">Qarzdorlik summasi</th>
                    <th className="py-3 px-3.5 font-bold text-center">Xavf darajasi</th>
                    <th className="py-3 px-3.5 font-bold text-center">Mas'ul login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {filteredDebtors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-neutral-500">
                        Tanlangan filtrlarga mos qarzdor mijoz topilmadi
                      </td>
                    </tr>
                  ) : (
                    filteredDebtors.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-rose-50/25 transition">
                        <td className="py-3 px-3.5 text-center font-bold text-neutral-500">{idx + 1}</td>
                        <td className="py-3 px-3.5 font-bold text-neutral-900">{c.name}</td>
                        <td className="py-3 px-3.5 font-medium text-neutral-700">{c.phone}</td>
                        <td className="py-3 px-3.5 text-neutral-600">
                          {c.region || "Ko'rsatilmagan"}
                          {c.district ? `, ${c.district}` : ''}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-rose-800 tabular-nums">
                          {formatMoney(c.currentDebt)}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {c.currentDebt > 10_000_000 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                              Yuqori xavf
                            </span>
                          ) : c.currentDebt > 3_000_000 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              O'rta xavf
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
                              Me'yorda
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-mono text-[11px]">
                            {c.createdBy || 'adminc'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3-MODUL: UMUMIY HAQDORLIK (OLDINDAN TO'LOVLAR) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-rose-100/90 shadow-xs overflow-hidden transition-all duration-200">
        <div
          onClick={() => setIsAdvanceOpen(!isAdvanceOpen)}
          className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/20 transition select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 font-bold flex items-center justify-center text-sm border border-emerald-200 shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                  3. Umumiy haqdorlik (Oldindan to'lovlar)
                </h3>
                <span className="text-[11px] font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                  {creditors.length} ta haqdor mijoz
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Jami: {formatMoney(totalAdvanceSum)}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Mijozlar tomonidan oldindan to'langan avanslar, depozitlar va ortiqcha to'lovlar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsAdvanceOpen(!isAdvanceOpen);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer ${
              isAdvanceOpen
                ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                : 'bg-rose-700 text-white hover:bg-rose-800 shadow-xs'
            }`}
          >
            {isAdvanceOpen ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Yopish</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Ochish</span>
              </>
            )}
          </button>
        </div>

        {isAdvanceOpen && (
          <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 space-y-6 animate-in fade-in duration-150">
            {/* Quick KPI stats */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">Jami haqdorlik summasi</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {formatMoney(totalAdvanceSum)}
                </div>
                <span className="text-xs text-emerald-700 font-medium">{creditors.length} ta mijoz hisobida</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">O'rtacha avans balansi</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {formatMoney(avgAdvance)}
                </div>
                <span className="text-xs text-neutral-500">Haqdor mijozlar o'rtacha ko'rsatkichi</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">Eng katta avans</span>
                <div className="text-base sm:text-lg font-bold font-display text-neutral-900 mt-1 truncate">
                  {creditors.sort((a, b) => b.currentAdvance - a.currentAdvance)[0]?.name || 'Mavjud emas'}
                </div>
                <span className="text-xs text-emerald-700 font-bold">
                  {creditors[0] ? formatMoney(creditors[0].currentAdvance) : ''}
                </span>
              </div>
            </div>

            {/* INTERNAL FILTERS */}
            <div className="bg-white p-4 rounded-2xl border border-rose-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                <Filter className="w-3.5 h-3.5 text-rose-700" />
                <span>Haqdorlik filtrlari:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Mijoz ismi / telefon..."
                    value={advSearch}
                    onChange={(e) => setAdvSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-rose-500 text-neutral-900 placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <select
                    value={advRegionFilter}
                    onChange={(e) => {
                      setAdvRegionFilter(e.target.value);
                      setAdvDistrictFilter('all');
                    }}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha viloyatlar</option>
                    {UZBEKISTAN_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={advDistrictFilter}
                    onChange={(e) => setAdvDistrictFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha tumanlar</option>
                    {advAvailableDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={advMinFilter}
                    onChange={(e) => setAdvMinFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha avanslar</option>
                    <option value="500k">500 mingdan yuqori</option>
                    <option value="1m">1 mln so'mdan yuqori</option>
                    <option value="3m">3 mln so'mdan yuqori</option>
                  </select>
                </div>
                <div>
                  <select
                    value={advSortBy}
                    onChange={(e) => setAdvSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="adv_desc">Avans: Kattadan kichikka</option>
                    <option value="adv_asc">Avans: Kichikdan kattaga</option>
                    <option value="name_asc">Mijoz: A-Z bo'yicha</option>
                  </select>
                </div>
              </div>
            </div>

            {/* HAQDORLAR JADVALI */}
            <div className="overflow-x-auto rounded-2xl border border-rose-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-50/50 text-neutral-900 border-b border-emerald-100">
                    <th className="py-3 px-3.5 font-bold text-center w-10">#</th>
                    <th className="py-3 px-3.5 font-bold">Mijoz ismi</th>
                    <th className="py-3 px-3.5 font-bold">Telefon</th>
                    <th className="py-3 px-3.5 font-bold">Hudud (Viloyat / Tuman)</th>
                    <th className="py-3 px-3.5 font-bold text-right">Oldindan to'lov (Haqdorlik)</th>
                    <th className="py-3 px-3.5 font-bold text-center">Status</th>
                    <th className="py-3 px-3.5 font-bold text-center">Kiritgan login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {filteredCreditors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-neutral-500">
                        Tanlangan filtrlarga mos haqdor mijoz topilmadi
                      </td>
                    </tr>
                  ) : (
                    filteredCreditors.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-emerald-50/25 transition">
                        <td className="py-3 px-3.5 text-center font-bold text-neutral-500">{idx + 1}</td>
                        <td className="py-3 px-3.5 font-bold text-neutral-900">{c.name}</td>
                        <td className="py-3 px-3.5 font-medium text-neutral-700">{c.phone}</td>
                        <td className="py-3 px-3.5 text-neutral-600">
                          {c.region || "Ko'rsatilmagan"}
                          {c.district ? `, ${c.district}` : ''}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-emerald-800 tabular-nums">
                          {formatMoney(c.currentAdvance)}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>Avans to'langan</span>
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-mono text-[11px]">
                            {c.createdBy || 'adminc'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4-MODUL: UMUMIY TASHRIFLAR SONI VA AMALLAR TAHLILI */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-rose-100/90 shadow-xs overflow-hidden transition-all duration-200">
        <div
          onClick={() => setIsVisitsOpen(!isVisitsOpen)}
          className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/20 transition select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-900 font-bold flex items-center justify-center text-sm border border-amber-200 shrink-0">
              <CalendarCheck className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                  4. Umumiy tashriflar va amallar tahlili
                </h3>
                <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                  {visitStats.totalPlans} ta reja
                </span>
                <span className="text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md">
                  {visitStats.completedPlans} ta bajarildi ({visitStats.completionRate}%)
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Kunlik rejalar, telefon qo'ng'iroqlari, joyiga borilgan tashriflar va qabul qilingan hisobotlar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsVisitsOpen(!isVisitsOpen);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer ${
              isVisitsOpen
                ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                : 'bg-rose-700 text-white hover:bg-rose-800 shadow-xs'
            }`}
          >
            {isVisitsOpen ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Yopish</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Ochish</span>
              </>
            )}
          </button>
        </div>

        {isVisitsOpen && (
          <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 space-y-6 animate-in fade-in duration-150">
            {/* Quick KPI stats */}
            <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Joyiga borildi</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {visitStats.visitCount} marta
                </div>
                <span className="text-xs text-neutral-500">Mijoz do'koni/omborida</span>
              </div>
              <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-200">
                <span className="text-[11px] font-bold text-sky-900 uppercase tracking-wider">Telefon qilindi</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {visitStats.phoneCount} marta
                </div>
                <span className="text-xs text-neutral-500">Qo'ng'iroq orqali suhbat</span>
              </div>
              <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200">
                <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">Telefon + Tashrif</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {visitStats.phoneAndVisitCount} marta
                </div>
                <span className="text-xs text-neutral-500">Kompleks aloqa</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
                <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider">Bajarilish darajasi</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {visitStats.completionRate}%
                </div>
                <span className="text-xs text-neutral-500">Rejalashtirilgan amallardan</span>
              </div>
            </div>

            {/* INTERNAL FILTERS */}
            <div className="bg-white p-4 rounded-2xl border border-rose-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                <Filter className="w-3.5 h-3.5 text-rose-700" />
                <span>Tashriflar filtrlari:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Mijoz / izoh qidirish..."
                    value={visitSearch}
                    onChange={(e) => setVisitSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-rose-500 text-neutral-900 placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <select
                    value={visitAgentFilter}
                    onChange={(e) => setVisitAgentFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha loginlar</option>
                    <option value="agentp1">agentp1</option>
                    <option value="adminc">adminc</option>
                  </select>
                </div>
                <div>
                  <select
                    value={visitStatusFilter}
                    onChange={(e) => setVisitStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha holatlar</option>
                    <option value="bajarildi">Bajarildi</option>
                    <option value="rejalashtirilgan">Rejalashtirilgan</option>
                  </select>
                </div>
                <div>
                  <select
                    value={visitActionFilter}
                    onChange={(e) => setVisitActionFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha amallar</option>
                    <option value="joyiga borildi">Joyiga borildi</option>
                    <option value="telefon qilindi">Telefon qilindi</option>
                    <option value="telefon qilindi + joyiga borildi">Telefon + Joyiga</option>
                  </select>
                </div>
                <div>
                  <select
                    value={visitTimeFilter}
                    onChange={(e) => setVisitTimeFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha vaqtlar</option>
                    <option value="today">Bugungi (24 soat)</option>
                    <option value="3days">Oxirgi 3 kun</option>
                    <option value="7days">Oxirgi 7 kun</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TASHRIFLAR VA AMALLAR RO'YXATI */}
            <div className="overflow-x-auto rounded-2xl border border-rose-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-amber-50/50 text-neutral-900 border-b border-amber-100">
                    <th className="py-3 px-3.5 font-bold text-center w-10">#</th>
                    <th className="py-3 px-3.5 font-bold">Vaqt / Sana</th>
                    <th className="py-3 px-3.5 font-bold">Mas'ul xodim</th>
                    <th className="py-3 px-3.5 font-bold">Mijoz va hudud</th>
                    <th className="py-3 px-3.5 font-bold">Qilingan amal</th>
                    <th className="py-3 px-3.5 font-bold text-right">To'lov / Moliyaviy natija</th>
                    <th className="py-3 px-3.5 font-bold">Izoh va hisobot</th>
                    <th className="py-3 px-3.5 font-bold text-center">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-50">
                  {filteredDailyPlans.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-neutral-500">
                        Tanlangan filtrlarga mos tashrif qaydlari topilmadi
                      </td>
                    </tr>
                  ) : (
                    filteredDailyPlans.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-amber-50/25 transition">
                        <td className="py-3 px-3.5 text-center font-bold text-neutral-500">{idx + 1}</td>
                        <td className="py-3 px-3.5 text-neutral-600 font-mono text-[11px] whitespace-nowrap">
                          {formatShortDate(p.completedAt || p.createdAt)}
                        </td>
                        <td className="py-3 px-3.5 font-bold text-neutral-800">
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-mono text-[11px]">
                            {p.agentUsername}
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-neutral-900">{p.clientName}</div>
                          <div className="text-[11px] text-neutral-500 truncate max-w-[200px]">
                            {p.clientRegion ? `${p.clientRegion}, ${p.clientDistrict || ''}` : p.clientAddress}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 font-medium text-neutral-800">
                          {p.actionDone ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                              {p.actionDone}
                            </span>
                          ) : (
                            <span className="text-neutral-400 italic">Hali bajarilmadi</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold tabular-nums">
                          {p.financialAction && p.financialAction.amount > 0 ? (
                            <span className="text-emerald-700">
                              +{formatMoney(p.financialAction.amount)}
                              <span className="block text-[10px] text-neutral-500 font-normal">
                                {p.financialAction.methodLabel}
                              </span>
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-neutral-700 max-w-[220px]">
                          {p.reportNote || p.planNote ? (
                            <span className="line-clamp-2">{p.reportNote || p.planNote}</span>
                          ) : (
                            <span className="text-neutral-400 italic">Izohsiz</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {p.status === 'bajarildi' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>Bajarildi</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
                              <Clock className="w-3 h-3 text-neutral-500" />
                              <span>Kutilmoqda</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5-MODUL: VILOYAT VA TUMANLAR KESIMIDA TAHLIL */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-rose-100/90 shadow-xs overflow-hidden transition-all duration-200">
        <div
          onClick={() => setIsRegionalOpen(!isRegionalOpen)}
          className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/20 transition select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-800 font-bold flex items-center justify-center text-sm border border-rose-200 shrink-0">
              <MapPin className="w-5 h-5 text-rose-700" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                  5. Viloyat va tumanlar kesimida tahlil
                </h3>
                <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  {activeRegionsCount} ta viloyat
                </span>
                <span className="text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">
                  {activeDistrictsCount} ta tuman
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Hududiy savdo aylanmasi, qarzdorlik va mijozlar zichligi tahlili
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsRegionalOpen(!isRegionalOpen);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer ${
              isRegionalOpen
                ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                : 'bg-rose-700 text-white hover:bg-rose-800 shadow-xs'
            }`}
          >
            {isRegionalOpen ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Yopish</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Ochish</span>
              </>
            )}
          </button>
        </div>

        {isRegionalOpen && (
          <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 space-y-6 animate-in fade-in duration-150">
            {/* Quick KPI stats */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">Faol viloyatlar soni</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {activeRegionsCount} ta viloyat
                </div>
                <span className="text-xs text-neutral-500">{activeDistrictsCount} ta faol tumanda mijozlar bor</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">Eng faol savdo viloyati</span>
                <div className="text-base sm:text-lg font-bold font-display text-neutral-900 mt-1 truncate">
                  {topRegionByTurnover}
                </div>
                <span className="text-xs text-neutral-500">Mijozlar va tovar aylanmasi bo'yicha</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">Hududlar bo'yicha saldo</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {formatMoney(totalDebtSum - totalAdvanceSum)}
                </div>
                <span className="text-xs text-rose-700 font-semibold">Sof kutilayotgan mablag'</span>
              </div>
            </div>

            {/* CHART: Regional Comparison Bar Chart */}
            <div className="bg-[#FAF7F7] p-5 rounded-2xl border border-rose-100">
              <h4 className="text-sm font-bold font-display text-neutral-900 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-rose-700" />
                <span>Viloyatlar bo'yicha qiyosiy taqqoslash</span>
              </h4>
              <div className="space-y-3">
                {regionalBreakdown.map((r, idx) => {
                  const maxMetric = Math.max(
                    ...regionalBreakdown.map((item) =>
                      regMetric === 'debt'
                        ? item.totalDebt
                        : regMetric === 'advance'
                        ? item.totalAdvance
                        : regMetric === 'products'
                        ? item.totalProductsSum
                        : item.clientsCount
                    ),
                    1
                  );
                  const currentVal =
                    regMetric === 'debt'
                      ? r.totalDebt
                      : regMetric === 'advance'
                      ? r.totalAdvance
                      : regMetric === 'products'
                      ? r.totalProductsSum
                      : r.clientsCount;
                  const percent = Math.min(Math.round((currentVal / maxMetric) * 100), 100);

                  return (
                    <div key={idx} className="group">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-neutral-800 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-white border border-rose-200 text-rose-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span>{r.region}</span>
                          <span className="text-[11px] font-normal text-neutral-500">
                            ({r.clientsCount} mijoz, {r.districts.length} tuman)
                          </span>
                        </span>
                        <span className="font-bold text-neutral-900 tabular-nums">
                          {regMetric === 'clients' ? `${r.clientsCount} ta` : formatMoney(currentVal)}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-neutral-200/80 rounded-full overflow-hidden flex items-center">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-rose-700 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* INTERNAL FILTERS */}
            <div className="bg-white p-4 rounded-2xl border border-rose-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                <Filter className="w-3.5 h-3.5 text-rose-700" />
                <span>Hududlar kesimi filtrlari:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <select
                    value={regSelectedRegion}
                    onChange={(e) => setRegSelectedRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha viloyatlar</option>
                    {UZBEKISTAN_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tuman nomini qidirish..."
                    value={regDistrictSearch}
                    onChange={(e) => setRegDistrictSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-rose-500 text-neutral-900 placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <select
                    value={regMetric}
                    onChange={(e) => setRegMetric(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="debt">Qarzdorlik bo'yicha</option>
                    <option value="advance">Haqdorlik bo'yicha</option>
                    <option value="products">Mahsulotlar summasi bo'yicha</option>
                    <option value="clients">Mijozlar soni bo'yicha</option>
                  </select>
                </div>
                <div>
                  <select
                    value={regSortOrder}
                    onChange={(e) => setRegSortOrder(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="desc">Ko'rsatkich kamayishi bo'yicha</option>
                    <option value="asc">Ko'rsatkich o'sishi bo'yicha</option>
                  </select>
                </div>
              </div>
            </div>

            {/* VILOYAT VA TUMANLAR JADVALI */}
            <div className="overflow-x-auto rounded-2xl border border-rose-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-rose-50/60 text-neutral-900 border-b border-rose-100">
                    <th className="py-3 px-3.5 font-bold text-center w-10">#</th>
                    <th className="py-3 px-3.5 font-bold">Viloyat / Shahar</th>
                    <th className="py-3 px-3.5 font-bold">Tuman</th>
                    <th className="py-3 px-3.5 font-bold text-center">Mijozlar soni</th>
                    <th className="py-3 px-3.5 font-bold text-right">Mahsulotlar summasi</th>
                    <th className="py-3 px-3.5 font-bold text-right">Qarzdorlik</th>
                    <th className="py-3 px-3.5 font-bold text-right">Haqdorlik</th>
                    <th className="py-3 px-3.5 font-bold text-right">Saldo (Net)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {flattenedDistricts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-neutral-500">
                        Tanlangan filtrlarga mos hudud ma'lumoti topilmadi
                      </td>
                    </tr>
                  ) : (
                    flattenedDistricts.map((row, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/25 transition">
                        <td className="py-3 px-3.5 text-center font-bold text-neutral-500">{idx + 1}</td>
                        <td className="py-3 px-3.5 font-bold text-neutral-900">{row.region}</td>
                        <td className="py-3 px-3.5 font-medium text-neutral-800">{row.district}</td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 font-bold text-neutral-800 text-[11px]">
                            {row.clientsCount} ta
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-medium text-neutral-700 tabular-nums">
                          {formatMoney(row.totalProductsSum)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-rose-800 tabular-nums">
                          {formatMoney(row.totalDebt)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-emerald-800 tabular-nums">
                          {formatMoney(row.totalAdvance)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold tabular-nums">
                          {row.netBalance > 0 ? (
                            <span className="text-rose-700">+{formatMoney(row.netBalance)} (Qarz)</span>
                          ) : row.netBalance < 0 ? (
                            <span className="text-emerald-700">
                              {formatMoney(Math.abs(row.netBalance))} (Haq)
                            </span>
                          ) : (
                            <span className="text-neutral-400">0 so'm</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6-MODUL: MIJOZLAR KESIMIDA CHUQUR TAHLILLAR */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-rose-100/90 shadow-xs overflow-hidden transition-all duration-200">
        <div
          onClick={() => setIsClientsDeepOpen(!isClientsDeepOpen)}
          className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/20 transition select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-700 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                  6. Mijozlar kesimida chuqur tahlillar
                </h3>
                <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  {clients.length} ta umumiy mijoz
                </span>
                <span className="text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">
                  {debtors.length} qarzdor / {creditors.length} haqdor
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Har bir mijoz aylanmasi, amallar chastotasi, biriktirgan login va segmentatsiyasi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsClientsDeepOpen(!isClientsDeepOpen);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer ${
              isClientsDeepOpen
                ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                : 'bg-rose-700 text-white hover:bg-rose-800 shadow-xs'
            }`}
          >
            {isClientsDeepOpen ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Yopish</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Ochish</span>
              </>
            )}
          </button>
        </div>

        {isClientsDeepOpen && (
          <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 space-y-6 animate-in fade-in duration-150">
            {/* Quick KPI stats */}
            <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Jami mijozlar</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {clients.length} ta
                </div>
                <span className="text-xs text-neutral-500">Baza hisobida</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">Yirik xaridorlar</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {enrichedClients.filter((c) => c.totalProductsSum >= 5_000_000).length} ta
                </div>
                <span className="text-xs text-neutral-500">5 mln dan ortiq xarid</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">Yuqori qarz xavfi</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1 text-rose-700">
                  {enrichedClients.filter((c) => c.currentDebt >= 5_000_000).length} ta
                </div>
                <span className="text-xs text-neutral-500">5 mln dan ortiq qarz</span>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">Balansi toza (0 qarz)</span>
                <div className="text-xl sm:text-2xl font-bold font-display text-neutral-900 mt-1">
                  {enrichedClients.filter((c) => c.currentDebt === 0 && c.currentAdvance === 0).length} ta
                </div>
                <span className="text-xs text-neutral-500">Qarzi ham, haqi ham yo'q</span>
              </div>
            </div>

            {/* INTERNAL FILTERS */}
            <div className="bg-white p-4 rounded-2xl border border-rose-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                <Filter className="w-3.5 h-3.5 text-rose-700" />
                <span>Mijozlar chuqur tahlili filtrlari:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Mijoz ismi / telefon / mo'ljal..."
                    value={cliDeepSearch}
                    onChange={(e) => setCliDeepSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-rose-500 text-neutral-900 placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <select
                    value={cliStatusFilter}
                    onChange={(e) => setCliStatusFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha mijoz holatlari</option>
                    <option value="debtor">Faqat qarzdorlar</option>
                    <option value="creditor">Faqat haqdorlar</option>
                    <option value="zero">Balansi toza (0 / 0)</option>
                    <option value="top_buyer">Yirik xaridorlar (&gt; 5 mln)</option>
                  </select>
                </div>
                <div>
                  <select
                    value={cliAuthorFilter}
                    onChange={(e) => setCliAuthorFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Qo'shgan login: Barchasi</option>
                    <option value="adminc">adminc</option>
                    <option value="agentp1">agentp1</option>
                  </select>
                </div>
                <div>
                  <select
                    value={cliRegionFilter}
                    onChange={(e) => {
                      setCliRegionFilter(e.target.value);
                      setCliDistrictFilter('all');
                    }}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha viloyatlar</option>
                    {UZBEKISTAN_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={cliDistrictFilter}
                    onChange={(e) => setCliDistrictFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="all">Barcha tumanlar</option>
                    {cliAvailableDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={cliSortBy}
                    onChange={(e) => setCliSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-rose-500"
                  >
                    <option value="turnover_desc">Savdo: Ko'pdan kamga</option>
                    <option value="debt_desc">Qarz: Kattadan kichikka</option>
                    <option value="advance_desc">Haq: Kattadan kichikka</option>
                    <option value="logs_desc">Amallar soni: Ko'pdan kamga</option>
                    <option value="name_asc">Mijoz: A-Z bo'yicha</option>
                  </select>
                </div>
              </div>
            </div>

            {/* MIJOZLAR KESIMIDAGI CHUQUR JADVAL */}
            <div className="overflow-x-auto rounded-2xl border border-rose-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-rose-50/60 text-neutral-900 border-b border-rose-100">
                    <th className="py-3 px-3.5 font-bold text-center w-10">#</th>
                    <th className="py-3 px-3.5 font-bold">Mijoz ismi</th>
                    <th className="py-3 px-3.5 font-bold">Telefon</th>
                    <th className="py-3 px-3.5 font-bold">Hudud (Viloyat / Tuman)</th>
                    <th className="py-3 px-3.5 font-bold text-center">Biriktirgan login</th>
                    <th className="py-3 px-3.5 font-bold text-right">Tovar summasi</th>
                    <th className="py-3 px-3.5 font-bold text-right">Joriy qarz</th>
                    <th className="py-3 px-3.5 font-bold text-right">Joriy haq</th>
                    <th className="py-3 px-3.5 font-bold text-center">Amallar soni</th>
                    <th className="py-3 px-3.5 font-bold text-center">Segment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {filteredClientsDeep.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-xs text-neutral-500">
                        Tanlangan filtrlarga mos mijoz topilmadi
                      </td>
                    </tr>
                  ) : (
                    filteredClientsDeep.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-rose-50/25 transition">
                        <td className="py-3 px-3.5 text-center font-bold text-neutral-500">{idx + 1}</td>
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-neutral-900">{c.name}</div>
                          {c.landmark && (
                            <div className="text-[10px] text-neutral-400 truncate max-w-[150px]">
                              Mo'ljal: {c.landmark}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-neutral-700 whitespace-nowrap">{c.phone}</td>
                        <td className="py-3 px-3.5 text-neutral-600">
                          {c.region || "Ko'rsatilmagan"}
                          {c.district ? `, ${c.district}` : ''}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-mono text-[11px]">
                            {c.createdBy || 'adminc'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-medium text-neutral-900 tabular-nums">
                          {formatMoney(c.totalProductsSum)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold tabular-nums">
                          {c.currentDebt > 0 ? (
                            <span className="text-rose-800">{formatMoney(c.currentDebt)}</span>
                          ) : (
                            <span className="text-neutral-400">0 so'm</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold tabular-nums">
                          {c.currentAdvance > 0 ? (
                            <span className="text-emerald-800">{formatMoney(c.currentAdvance)}</span>
                          ) : (
                            <span className="text-neutral-400">0 so'm</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 font-bold text-[11px] border border-rose-100">
                            {c.logsCount} ta amal
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {c.currentDebt > 5_000_000 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                              Xavfli qarz
                            </span>
                          ) : c.currentDebt > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              Qarzdor
                            </span>
                          ) : c.currentAdvance > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              Haqdor
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-100 text-neutral-600">
                              Toza balans
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PRODUCT INSPECTION DRILLDOWN MODAL */}
      {/* ========================================================================= */}
      {inspectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-rose-100 overflow-hidden">
            <div className="p-5 border-b border-rose-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-800 font-bold flex items-center justify-center border border-rose-200">
                  <Package className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-display text-neutral-900">
                    {inspectedProduct.name} ({inspectedProduct.unit})
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Ushbu tovar biriktirilgan mijozlar ro'yxati va taqsimoti
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedProduct(null)}
                className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-rose-50/40 p-3 rounded-2xl border border-rose-100">
                <div>
                  <span className="text-neutral-500">Jami biriktirilgan mijozlar:</span>
                  <div className="font-bold text-neutral-900 text-sm">{inspectedProduct.clients.length} ta mijoz</div>
                </div>
                <div>
                  <span className="text-neutral-500">Jami tovar hajmi:</span>
                  <div className="font-bold text-neutral-900 text-sm">
                    {formatNumber(inspectedProduct.clients.reduce((s, c) => s + c.quantity, 0))} {inspectedProduct.unit}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-rose-100">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-900 border-b border-neutral-200">
                      <th className="py-2.5 px-3 font-bold">Mijoz</th>
                      <th className="py-2.5 px-3 font-bold">Telefon</th>
                      <th className="py-2.5 px-3 font-bold text-right">Miqdor</th>
                      <th className="py-2.5 px-3 font-bold text-right">Narx</th>
                      <th className="py-2.5 px-3 font-bold text-right">Summa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {inspectedProduct.clients.map((c, i) => (
                      <tr key={i} className="hover:bg-rose-50/20">
                        <td className="py-2.5 px-3 font-bold text-neutral-900">{c.clientName}</td>
                        <td className="py-2.5 px-3 text-neutral-600">{c.phone}</td>
                        <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                          {formatNumber(c.quantity)} {inspectedProduct.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-neutral-700">
                          {formatMoney(c.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-800 tabular-nums">
                          {formatMoney(c.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-rose-100 bg-neutral-50 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedProduct(null)}
                className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
