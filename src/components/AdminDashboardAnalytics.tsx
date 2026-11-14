import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { WarehouseProduct, Client, DailyPlanItem } from '../types';
import { storageService, getPlanDateKey, getClosedDateKey } from '../services/storage';
import {
  formatNumber,
  formatMoney,
  formatDate,
  getAgentDisplayName,
  formatWarehouseStock,
  calculateProfitMargin,
} from '../utils/format';
import { parseLegacyAddress } from '../utils/location';
import { exportWarehouseToExcel } from '../utils/exportWarehouseExcel';
import {
  exportClientsAnnualToExcel,
  ClientAnnualData,
  ClientMonthlyBalance,
} from '../utils/exportClientsAnnualExcel';
import {
  exportClientProductsAnnualToExcel,
  ClientProductAnnualItem,
  MonthlyProductDeliveryData,
} from '../utils/exportClientProductsAnnualExcel';
import {
  exportAgentActionsToExcel,
  ActionExportItem,
} from '../utils/exportAgentActionsExcel';
import {
  exportUzsConversionsToExcel,
  UzsConversionAnalyticsItem,
} from '../utils/exportUzsConversionsExcel';
import {
  exportClientDailyActionsMatrixToExcel,
  ClientDailyMatrixRow,
} from '../utils/exportClientDailyActionsMatrixExcel';
import { StickyTableWrapper } from './StickyTableWrapper';
import { ProductDeliveryHistoryModal } from './ProductDeliveryHistoryModal';
import { buildWarehouseProductChronology, ProductChronologyResult } from '../utils/warehouseChronology';
import {
  Package,
  History,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Users,
  Calendar,
  Layers,
  ShoppingBag,
  Phone,
  MapPin,
  CreditCard,
  Receipt,
  Activity,
  PhoneCall,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit3,
  TrendingUp,
  Calculator,
  Coins,
  Eye,
  EyeOff,
} from 'lucide-react';

interface Props {
  clients?: Client[];
  dailyPlans?: DailyPlanItem[];
  warehouseProducts?: WarehouseProduct[];
  onEditWarehouseProduct?: (product: WarehouseProduct) => void;
  onDeleteWarehouseProduct?: (id: string) => void;
}

type StockSortMode = 'none' | 'desc' | 'asc';
type StockStatusFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

type ClientSortMode = 'debt_desc' | 'debt_asc' | 'adv_desc' | 'adv_asc' | 'name_asc';
type ClientBalanceFilter = 'all' | 'debtors' | 'creditors' | 'zero';

type ProductDeliverySortMode =
  | 'qty_desc'
  | 'qty_asc'
  | 'sum_desc'
  | 'sum_asc'
  | 'credit_desc'
  | 'paid_desc'
  | 'name_asc';

type ActionFilterType = 'all' | 'telefon qilindi' | 'joyiga borildi' | 'telefon qilindi + joyiga borildi';

const MONTH_NAMES = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

export const AdminDashboardAnalytics: React.FC<Props> = ({
  clients: propClients,
  dailyPlans: propPlans,
  warehouseProducts: propProducts,
  onEditWarehouseProduct,
  onDeleteWarehouseProduct,
}) => {
  // Navigation between blocks: 'block1' | 'block2' | 'block3' | 'block4' | 'block5' | 'block6'
  const [activeBlockView, setActiveBlockView] = useState<
    'block1' | 'block2' | 'block3' | 'block4' | 'block5' | 'block6'
  >('block1');

  // =========================================================================
  // 1-BLOK DATA & STATES (Ombordagi mahsulotlar soni tahliliy jadvali)
  // =========================================================================
  const [internalProducts, setInternalProducts] = useState<WarehouseProduct[]>(() =>
    propProducts !== undefined ? propProducts : storageService.getWarehouseProducts()
  );

  React.useEffect(() => {
    if (propProducts !== undefined) {
      setInternalProducts(propProducts);
    } else {
      setInternalProducts(storageService.getWarehouseProducts());
    }
  }, [propProducts]);

  const [stockSearch, setStockSearch] = useState('');
  const deferredStockSearch = useDeferredValue(stockSearch);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [stockSortMode, setStockSortMode] = useState<StockSortMode>('desc');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('all');
  const [isExportingStock, setIsExportingStock] = useState(false);
  const [showBlock1Prices, setShowBlock1Prices] = useState(false);
  const [block1Page, setBlock1Page] = useState<number>(1);
  const [block1PageSize, setBlock1PageSize] = useState<number | 'all'>(50);
  const [confirmDeleteWarehouseProduct, setConfirmDeleteWarehouseProduct] = useState<WarehouseProduct | null>(null);
  const [historyProduct, setHistoryProduct] = useState<WarehouseProduct | null>(null);
  const [block1SnapshotDate, setBlock1SnapshotDate] = useState<string>('');

  const block1ChronologyMap = useMemo(() => {
    const map = new Map<string, ProductChronologyResult>();
    const plansForChron = propPlans !== undefined ? propPlans : storageService.getDailyPlans();
    const clientsForChron = propClients !== undefined ? propClients : storageService.getClients();
    internalProducts.forEach((p) => {
      map.set(
        p.id,
        buildWarehouseProductChronology(p, plansForChron, clientsForChron, undefined, internalProducts)
      );
    });
    return map;
  }, [internalProducts, propPlans, propClients]);

  const getBlock1EffectivePieces = (p: WarehouseProduct): number => {
    if (!block1SnapshotDate) return p.totalPieces || 0;
    const chron = block1ChronologyMap.get(p.id);
    return chron ? chron.getStockAtDate(block1SnapshotDate).pieces : p.totalPieces || 0;
  };

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    internalProducts.forEach((p) => {
      if (p.brand && p.brand.trim()) set.add(p.brand.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [internalProducts]);

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    internalProducts.forEach((p) => {
      if (p.packageUnitName && p.packageUnitName.trim()) set.add(p.packageUnitName.trim());
      if (p.baseUnit && p.baseUnit.trim()) set.add(p.baseUnit.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [internalProducts]);

  const filteredProducts = useMemo(() => {
    let list = internalProducts.filter((p) => {
      if (deferredStockSearch.trim()) {
        const q = deferredStockSearch.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesBrand = (p.brand || '').toLowerCase().includes(q);
        const matchesMarks = [p.mark1, p.mark2, ...(p.extraMarks || [])]
          .filter(Boolean)
          .some((m) => m.toLowerCase().includes(q));
        const matchesUnit = [p.baseUnit, p.packageUnitName, p.pieceUnitName]
          .filter(Boolean)
          .some((u) => u.toLowerCase().includes(q));

        if (!matchesName && !matchesBrand && !matchesMarks && !matchesUnit) {
          return false;
        }
      }

      if (selectedBrand !== 'all' && (p.brand || '').toLowerCase() !== selectedBrand.toLowerCase()) {
        return false;
      }

      if (selectedType !== 'all') {
        const target = selectedType.toLowerCase();
        const matchesType =
          (p.packageUnitName || '').toLowerCase() === target ||
          (p.baseUnit || '').toLowerCase() === target ||
          (p.pieceUnitName || '').toLowerCase() === target;
        if (!matchesType) return false;
      }

      const pieces = getBlock1EffectivePieces(p);
      if (stockStatusFilter === 'in_stock' && pieces <= 0) return false;
      if (stockStatusFilter === 'low_stock' && (pieces <= 0 || pieces > 10)) return false;
      if (stockStatusFilter === 'out_of_stock' && pieces > 0) return false;

      return true;
    });

    if (stockSortMode === 'desc') {
      list.sort((a, b) => getBlock1EffectivePieces(b) - getBlock1EffectivePieces(a));
    } else if (stockSortMode === 'asc') {
      list.sort((a, b) => getBlock1EffectivePieces(a) - getBlock1EffectivePieces(b));
    }

    return list;
  }, [
    internalProducts,
    deferredStockSearch,
    selectedBrand,
    selectedType,
    stockStatusFilter,
    stockSortMode,
    block1SnapshotDate,
    block1ChronologyMap,
  ]);

  useEffect(() => {
    setBlock1Page(1);
  }, [deferredStockSearch, selectedBrand, selectedType, stockStatusFilter, stockSortMode, block1PageSize, block1SnapshotDate]);

  const block1TotalPages = block1PageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredProducts.length / block1PageSize));
  const safeBlock1Page = Math.min(block1Page, block1TotalPages);
  const visibleBlock1Products = useMemo(() => {
    if (block1PageSize === 'all') return filteredProducts;
    const start = (safeBlock1Page - 1) * block1PageSize;
    return filteredProducts.slice(start, start + block1PageSize);
  }, [filteredProducts, block1PageSize, safeBlock1Page]);

  const stockStats = useMemo(() => {
    let totalPieces = 0;
    let totalInitialPieces = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    internalProducts.forEach((p) => {
      const pcs = getBlock1EffectivePieces(p);
      const chron = block1ChronologyMap.get(p.id);
      totalPieces += pcs;
      totalInitialPieces += chron ? chron.initialPieces : p.initialTotalPieces || p.totalPieces || 0;
      if (pcs <= 0) {
        outOfStockCount++;
      } else if (pcs <= 10) {
        lowStockCount++;
      }
    });

    return {
      totalProducts: internalProducts.length,
      totalPieces,
      totalInitialPieces,
      lowStockCount,
      outOfStockCount,
    };
  }, [internalProducts, block1SnapshotDate, block1ChronologyMap]);

  const handleExportStockExcel = async () => {
    try {
      setIsExportingStock(true);
      const filterLabel = [
        selectedBrand !== 'all' ? `Brend: ${selectedBrand}` : null,
        selectedType !== 'all' ? `Tur: ${selectedType}` : null,
      ]
        .filter(Boolean)
        .join(', ') || "Barcha mahsulotlar";

      await exportWarehouseToExcel(filteredProducts, filterLabel, showBlock1Prices);
    } catch (err) {
      console.error("Stock Excel export error:", err);
    } finally {
      setIsExportingStock(false);
    }
  };

  // =========================================================================
  // 2-BLOK DATA & STATES (Mijozlar 1 yillik oylik qarzdorlik va haqdorlik)
  // =========================================================================
  const [internalClients, setInternalClients] = useState<Client[]>(() =>
    propClients !== undefined ? propClients : storageService.getClients()
  );

  React.useEffect(() => {
    if (propClients !== undefined) {
      setInternalClients(propClients);
    } else {
      setInternalClients(storageService.getClients());
    }
  }, [propClients]);

  const [clientSearch, setClientSearch] = useState('');
  const deferredClientSearch = useDeferredValue(clientSearch);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedClientCreator, setSelectedClientCreator] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedClientMonth, setSelectedClientMonth] = useState<number | 'all'>('all');
  const [b2StartDate, setB2StartDate] = useState<string>('');
  const [b2EndDate, setB2EndDate] = useState<string>('');
  const [b2DateCalcMode, setB2DateCalcMode] = useState<'snapshot' | 'period_activity'>('snapshot');
  const [minDebtFilter, setMinDebtFilter] = useState<string>('');
  const [maxDebtFilter, setMaxDebtFilter] = useState<string>('');
  const [clientSortMode, setClientSortMode] = useState<ClientSortMode>('debt_desc');
  const [clientBalanceFilter, setClientBalanceFilter] = useState<ClientBalanceFilter>('all');
  const [isExportingClients, setIsExportingClients] = useState(false);
  const [block2Page, setBlock2Page] = useState<number>(1);
  const [block2PageSize, setBlock2PageSize] = useState<number | 'all'>(50);

  const isB2DateActive = Boolean(b2StartDate || b2EndDate);

  const applyB2QuickDate = (preset: 'all' | 'today' | 'yesterday' | 'thisMonth') => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === 'all') {
      setB2StartDate('');
      setB2EndDate('');
    } else if (preset === 'today') {
      setB2StartDate(todayStr);
      setB2EndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      setB2StartDate(yStr);
      setB2EndDate(yStr);
    } else if (preset === 'thisMonth') {
      const firstStr = `${todayStr.slice(0, 8)}01`;
      setB2StartDate(firstStr);
      setB2EndDate(todayStr);
    }
  };

  // Pre-compute per-client balance for Block 2 based on b2StartDate / b2EndDate
  const clientB2BalanceMap = useMemo(() => {
    const map = new Map<string, { debt: number; advance: number; hadActivityInPeriod: boolean }>();
    const startStr = b2StartDate || '';
    const endStr = b2EndDate || b2StartDate || '';

    for (let i = 0; i < internalClients.length; i++) {
      const c = internalClients[i];
      if (!isB2DateActive) {
        map.set(c.id, {
          debt: Math.max(0, Math.round((c.currentDebt || 0) * 100) / 100),
          advance: Math.max(0, Math.round((c.currentAdvance || 0) * 100) / 100),
          hadActivityInPeriod: true,
        });
        continue;
      }

      const logs = c.logs || [];
      let hadActivityInPeriod = false;

      if (b2DateCalcMode === 'period_activity') {
        let addedDebt = 0;
        let paidOrReduced = 0;
        for (let j = 0; j < logs.length; j++) {
          const log = logs[j];
          const logDate = (log.timestamp || '').slice(0, 10);
          if (!logDate) continue;
          if (startStr && logDate < startStr) continue;
          if (endStr && logDate > endStr) continue;
          hadActivityInPeriod = true;
          const amt = Number(log.amountChanged) || 0;
          if (log.type === 'product_added') {
            addedDebt += amt;
          } else if (log.type === 'payment') {
            paidOrReduced += amt;
          }
        }
        map.set(c.id, {
          debt: Math.max(0, Math.round(addedDebt * 100) / 100),
          advance: Math.max(0, Math.round(paidOrReduced * 100) / 100),
          hadActivityInPeriod,
        });
      } else {
        // 'snapshot': balance as of end of endStr
        const createdDate = (c.createdAt || '').slice(0, 10);
        if (endStr && createdDate && createdDate > endStr && logs.length === 0) {
          map.set(c.id, { debt: 0, advance: 0, hadActivityInPeriod: false });
          continue;
        }
        let netAtEnd = (c.currentDebt || 0) - (c.currentAdvance || 0);
        for (let j = 0; j < logs.length; j++) {
          const log = logs[j];
          const logDate = (log.timestamp || '').slice(0, 10);
          if (!logDate) continue;
          if ((!startStr || logDate >= startStr) && (!endStr || logDate <= endStr)) {
            hadActivityInPeriod = true;
          }
          if (endStr && logDate > endStr) {
            const amt = Number(log.amountChanged) || 0;
            if (log.type === 'product_added') {
              netAtEnd -= amt;
            } else if (log.type === 'payment') {
              netAtEnd += amt;
            }
          }
        }
        const debt = netAtEnd > 0.005 ? Math.round(netAtEnd * 100) / 100 : 0;
        const advance = netAtEnd < -0.005 ? Math.round(Math.abs(netAtEnd) * 100) / 100 : 0;
        map.set(c.id, { debt, advance, hadActivityInPeriod });
      }
    }
    return map;
  }, [internalClients, isB2DateActive, b2StartDate, b2EndDate, b2DateCalcMode]);

  // Pre-compute global balance counts for Block 2 filter buttons in a single O(N) pass
  const globalClientBalanceCounts = useMemo(() => {
    let debtors = 0;
    let creditors = 0;
    let zero = 0;
    for (let i = 0; i < internalClients.length; i++) {
      const c = internalClients[i];
      const bal = clientB2BalanceMap.get(c.id);
      const d = bal ? bal.debt : c.currentDebt || 0;
      const a = bal ? bal.advance : c.currentAdvance || 0;
      if (d > 0) debtors++;
      if (a > 0) creditors++;
      if (d === 0 && a === 0) zero++;
    }
    return { debtors, creditors, zero };
  }, [internalClients, clientB2BalanceMap]);

  // O(1) lookup map of internalClients by ID
  const internalClientsMap = useMemo(() => {
    const map = new Map<string, Client>();
    for (let i = 0; i < internalClients.length; i++) {
      map.set(internalClients[i].id, internalClients[i]);
    }
    return map;
  }, [internalClients]);

  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    internalClients.forEach((c) => {
      const reg = c.region?.trim() || parseLegacyAddress(c.address).region;
      if (reg) set.add(reg);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [internalClients]);

  const uniqueDistricts = useMemo(() => {
    const set = new Set<string>();
    internalClients.forEach((c) => {
      const reg = c.region?.trim() || parseLegacyAddress(c.address).region;
      const dist = c.district?.trim() || parseLegacyAddress(c.address).district;
      if (dist) {
        if (selectedRegion === 'all' || reg.toLowerCase() === selectedRegion.toLowerCase()) {
          set.add(dist);
        }
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [internalClients, selectedRegion]);

  const uniqueClientCreators = useMemo(() => {
    const set = new Set<string>();
    internalClients.forEach((c) => {
      set.add((c.createdBy || 'adminc').trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [internalClients]);

  const isBlock2FilterActive =
    clientSearch.trim() !== '' ||
    selectedRegion !== 'all' ||
    selectedDistrict !== 'all' ||
    selectedClientCreator !== 'all' ||
    clientBalanceFilter !== 'all' ||
    selectedClientMonth !== 'all' ||
    b2StartDate !== '' ||
    b2EndDate !== '' ||
    minDebtFilter.trim() !== '' ||
    maxDebtFilter.trim() !== '';

  const resetBlock2Filters = () => {
    setClientSearch('');
    setSelectedRegion('all');
    setSelectedDistrict('all');
    setSelectedClientCreator('all');
    setClientBalanceFilter('all');
    setSelectedClientMonth('all');
    setB2StartDate('');
    setB2EndDate('');
    setMinDebtFilter('');
    setMaxDebtFilter('');
    setClientSortMode('debt_desc');
  };

  const computeClientMonthlyBalances = (client: Client, year: number): ClientMonthlyBalance[] => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();

    const clientCreatedDate = new Date(client.createdAt || '2026-01-01');
    const clientCreatedYear = clientCreatedDate.getFullYear();
    const clientCreatedMonthIndex = clientCreatedDate.getMonth();

    const result: ClientMonthlyBalance[] = [];

    for (let m = 0; m < 12; m++) {
      const monthNum = m + 1;
      const monthName = MONTH_NAMES[m];

      if (year > currentYear || (year === currentYear && m > currentMonthIndex)) {
        result.push({ month: monthNum, monthName, debt: 0, advance: 0 });
        continue;
      }

      if (year < clientCreatedYear || (year === clientCreatedYear && m < clientCreatedMonthIndex)) {
        result.push({ month: monthNum, monthName, debt: 0, advance: 0 });
        continue;
      }

      result.push({
        month: monthNum,
        monthName,
        debt: client.currentDebt || 0,
        advance: client.currentAdvance || 0,
      });
    }

    return result;
  };

  const filteredAnnualClients = useMemo(() => {
    let list: ClientAnnualData[] = internalClients.map((c) => {
      const bal = clientB2BalanceMap.get(c.id);
      return {
        client: c,
        currentDebt: bal ? bal.debt : c.currentDebt || 0,
        currentAdvance: bal ? bal.advance : c.currentAdvance || 0,
        months: computeClientMonthlyBalances(c, selectedYear),
      };
    });

    if (isB2DateActive && b2DateCalcMode === 'period_activity') {
      list = list.filter((item) => {
        const bal = clientB2BalanceMap.get(item.client.id);
        return Boolean(bal?.hadActivityInPeriod);
      });
    }

    if (deferredClientSearch.trim()) {
      const q = deferredClientSearch.toLowerCase().trim();
      list = list.filter(({ client: c }) => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const phoneMatch = c.phone.toLowerCase().includes(q);
        const addrMatch = (c.address || '').toLowerCase().includes(q);
        const regMatch = (c.region || '').toLowerCase().includes(q);
        const distMatch = (c.district || '').toLowerCase().includes(q);
        const landmarkMatch = (c.landmark || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || addrMatch || regMatch || distMatch || landmarkMatch;
      });
    }

    if (selectedRegion !== 'all') {
      const targetReg = selectedRegion.toLowerCase();
      list = list.filter(({ client: c }) => {
        const reg = (c.region || parseLegacyAddress(c.address).region).toLowerCase();
        return reg === targetReg || (c.address || '').toLowerCase().includes(targetReg);
      });
    }

    if (selectedDistrict !== 'all') {
      const targetDist = selectedDistrict.toLowerCase();
      list = list.filter(({ client: c }) => {
        const dist = (c.district || parseLegacyAddress(c.address).district).toLowerCase();
        return dist === targetDist || (c.address || '').toLowerCase().includes(targetDist);
      });
    }

    if (selectedClientCreator !== 'all') {
      const targetCreator = selectedClientCreator.toLowerCase();
      list = list.filter(
        ({ client: c }) => (c.createdBy || 'adminc').toLowerCase() === targetCreator
      );
    }

    if (clientBalanceFilter === 'debtors') {
      list = list.filter((item) => item.currentDebt > 0);
    } else if (clientBalanceFilter === 'creditors') {
      list = list.filter((item) => item.currentAdvance > 0);
    } else if (clientBalanceFilter === 'zero') {
      list = list.filter((item) => item.currentDebt === 0 && item.currentAdvance === 0);
    }

    const parsedMinDebt = parseFloat(minDebtFilter);
    if (!isNaN(parsedMinDebt) && parsedMinDebt > 0) {
      list = list.filter((item) => item.currentDebt >= parsedMinDebt);
    }

    const parsedMaxDebt = parseFloat(maxDebtFilter);
    if (!isNaN(parsedMaxDebt) && parsedMaxDebt >= 0 && maxDebtFilter.trim() !== '') {
      list = list.filter((item) => item.currentDebt <= parsedMaxDebt);
    }

    if (selectedClientMonth !== 'all') {
      const mIdx = selectedClientMonth - 1;
      list = list.filter((item) => {
        const mData = item.months[mIdx];
        if (!mData) return true;
        const createdDate = new Date(item.client.createdAt || '2026-01-01');
        return (
          createdDate.getFullYear() < selectedYear ||
          (createdDate.getFullYear() === selectedYear && createdDate.getMonth() <= mIdx)
        );
      });
    }

    list.sort((a, b) => {
      if (clientSortMode === 'debt_desc') return b.currentDebt - a.currentDebt;
      if (clientSortMode === 'debt_asc') return a.currentDebt - b.currentDebt;
      if (clientSortMode === 'adv_desc') return b.currentAdvance - a.currentAdvance;
      if (clientSortMode === 'adv_asc') return a.currentAdvance - b.currentAdvance;
      if (clientSortMode === 'name_asc') return a.client.name.localeCompare(b.client.name, 'uz');
      return 0;
    });

    return list;
  }, [
    internalClients,
    deferredClientSearch,
    selectedRegion,
    selectedDistrict,
    selectedClientCreator,
    selectedYear,
    selectedClientMonth,
    minDebtFilter,
    maxDebtFilter,
    clientSortMode,
    clientBalanceFilter,
    clientB2BalanceMap,
    isB2DateActive,
    b2DateCalcMode,
  ]);

  useEffect(() => {
    setBlock2Page(1);
  }, [
    deferredClientSearch,
    selectedRegion,
    selectedDistrict,
    selectedClientCreator,
    selectedYear,
    selectedClientMonth,
    b2StartDate,
    b2EndDate,
    b2DateCalcMode,
    minDebtFilter,
    maxDebtFilter,
    clientSortMode,
    clientBalanceFilter,
    block2PageSize,
  ]);

  const block2TotalPages = block2PageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredAnnualClients.length / block2PageSize));
  const safeBlock2Page = Math.min(block2Page, block2TotalPages);
  const visibleBlock2Clients = useMemo(() => {
    if (block2PageSize === 'all') return filteredAnnualClients;
    const start = (safeBlock2Page - 1) * block2PageSize;
    return filteredAnnualClients.slice(start, start + block2PageSize);
  }, [filteredAnnualClients, block2PageSize, safeBlock2Page]);

  // 2-Blok Xulosaviy Tahlillari (Filtrlangan ma'lumotlar asosida)
  const clientStats = useMemo(() => {
    let totalDebt = 0;
    let totalAdvance = 0;
    let debtorsCount = 0;
    let creditorsCount = 0;
    let zeroCount = 0;
    let maxDebtor: ClientAnnualData | null = null;
    let maxCreditor: ClientAnnualData | null = null;

    const regionDebtMap = new Map<string, { debt: number; count: number }>();
    const monthlyTotals = MONTH_NAMES.map((monthName, idx) => ({
      month: idx + 1,
      monthName,
      debt: 0,
      advance: 0,
    }));

    filteredAnnualClients.forEach((item) => {
      const d = item.currentDebt || 0;
      const a = item.currentAdvance || 0;
      totalDebt += d;
      totalAdvance += a;

      if (d > 0) {
        debtorsCount++;
        if (!maxDebtor || d > maxDebtor.currentDebt) {
          maxDebtor = item;
        }
        const reg =
          item.client.region?.trim() ||
          parseLegacyAddress(item.client.address).region ||
          "Noma'lum hudud";
        const prev = regionDebtMap.get(reg) || { debt: 0, count: 0 };
        regionDebtMap.set(reg, { debt: prev.debt + d, count: prev.count + 1 });
      }
      if (a > 0) {
        creditorsCount++;
        if (!maxCreditor || a > maxCreditor.currentAdvance) {
          maxCreditor = item;
        }
      }
      if (d === 0 && a === 0) {
        zeroCount++;
      }

      item.months.forEach((m, idx) => {
        if (monthlyTotals[idx]) {
          monthlyTotals[idx].debt += m.debt || 0;
          monthlyTotals[idx].advance += m.advance || 0;
        }
      });
    });

    let topRegion: { region: string; debt: number; count: number } | null = null;
    regionDebtMap.forEach((val, key) => {
      if (!topRegion || val.debt > topRegion.debt) {
        topRegion = { region: key, debt: val.debt, count: val.count };
      }
    });

    const avgDebtPerDebtor = debtorsCount > 0 ? totalDebt / debtorsCount : 0;
    const avgAdvancePerCreditor = creditorsCount > 0 ? totalAdvance / creditorsCount : 0;
    const netBalance = totalDebt - totalAdvance;

    return {
      totalClients: internalClients.length,
      filteredClientsCount: filteredAnnualClients.length,
      totalDebt,
      totalAdvance,
      debtorsCount,
      creditorsCount,
      zeroCount,
      avgDebtPerDebtor,
      avgAdvancePerCreditor,
      netBalance,
      maxDebtor: maxDebtor as ClientAnnualData | null,
      maxCreditor: maxCreditor as ClientAnnualData | null,
      topRegion: topRegion as { region: string; debt: number; count: number } | null,
      monthlyTotals,
    };
  }, [filteredAnnualClients, internalClients.length]);

  const handleExportClientsExcel = async () => {
    try {
      setIsExportingClients(true);
      const filterLabel = [
        selectedRegion !== 'all' ? `Viloyat: ${selectedRegion}` : null,
        selectedDistrict !== 'all' ? `Tuman: ${selectedDistrict}` : null,
        selectedClientCreator !== 'all' ? `Kiritgan: ${selectedClientCreator}` : null,
        clientBalanceFilter !== 'all' ? `Holat: ${clientBalanceFilter}` : null,
      ]
        .filter(Boolean)
        .join(', ') || "Barcha mijozlar";

      await exportClientsAnnualToExcel(filteredAnnualClients, selectedYear, filterLabel);
    } catch (err) {
      console.error("Clients Excel export error:", err);
    } finally {
      setIsExportingClients(false);
    }
  };

  // =========================================================================
  // 3-BLOK DATA & STATES (Mijozlarga berilgan mahsulotlar 1 yillik tahlili)
  // =========================================================================
  const internalPlans = useMemo(() => {
    return propPlans !== undefined ? propPlans : storageService.getDailyPlans();
  }, [propPlans]);

  // Index internalPlans by clientId in O(M) so Block 3 runs in O(N + M) instead of O(N * M)
  const internalPlansByClientMap = useMemo(() => {
    const map = new Map<string, DailyPlanItem[]>();
    for (let i = 0; i < internalPlans.length; i++) {
      const p = internalPlans[i];
      const existing = map.get(p.clientId);
      if (existing) {
        existing.push(p);
      } else {
        map.set(p.clientId, [p]);
      }
    }
    return map;
  }, [internalPlans]);

  const [delivSearch, setDelivSearch] = useState('');
  const deferredDelivSearch = useDeferredValue(delivSearch);
  const [delivRegion, setDelivRegion] = useState<string>('all');
  const [delivDistrict, setDelivDistrict] = useState<string>('all');
  const [delivYear, setDelivYear] = useState<number>(2026);
  const [delivSortMode, setDelivSortMode] = useState<ProductDeliverySortMode>('qty_desc');
  const [delivStartDate, setDelivStartDate] = useState<string>('');
  const [delivEndDate, setDelivEndDate] = useState<string>('');
  const [isExportingDelivery, setIsExportingDelivery] = useState(false);
  const [block3Page, setBlock3Page] = useState<number>(1);
  const [block3PageSize, setBlock3PageSize] = useState<number | 'all'>(50);

  const computeClientProductDeliveries = (
    client: Client,
    year: number,
    startD?: string,
    endD?: string
  ): MonthlyProductDeliveryData[] => {
    const monthlyData: MonthlyProductDeliveryData[] = [];

    for (let m = 0; m < 12; m++) {
      monthlyData.push({
        month: m + 1,
        monthName: MONTH_NAMES[m],
        onCredit: { itemsSummary: '', totalQuantity: 0, totalSum: 0 },
        paid: { itemsSummary: '', totalQuantity: 0, totalSum: 0 },
      });
    }

    const isWithinFilterRange = (dStr: string) => {
      const d = dStr.slice(0, 10);
      if (startD && d < startD) return false;
      if (endD && d > endD) return false;
      return true;
    };

    const clientPlans = internalPlansByClientMap.get(client.id) || [];
    clientPlans.forEach((plan) => {
      const timeStr = plan.completedAt || plan.createdAt;
      if (!timeStr || !timeStr.startsWith(String(year)) || !isWithinFilterRange(timeStr)) return;

      const mIdx = parseInt(timeStr.slice(5, 7), 10) - 1;
      if (mIdx < 0 || mIdx > 11) return;

      const actions = plan.actionsHistory && plan.actionsHistory.length > 0
        ? plan.actionsHistory
        : [
            {
              productsDelivered: plan.productsDelivered,
              deliveryPayment: plan.deliveryPayment,
            },
          ];

      actions.forEach((act) => {
        if (!act.productsDelivered || act.productsDelivered.length === 0) return;

        const payType = act.deliveryPayment?.paymentType || 'qarzga';
        const isCredit = payType === 'qarzga';
        const targetObj = isCredit ? monthlyData[mIdx].onCredit : monthlyData[mIdx].paid;

        act.productsDelivered.forEach((p) => {
          const qty = p.quantity || 0;
          const sum = p.totalPrice || qty * (p.unitPrice || 0);
          targetObj.totalQuantity += qty;
          targetObj.totalSum += sum;

          const pDesc = `${p.name} (${qty} ${p.unit})`;
          if (!targetObj.itemsSummary.includes(p.name)) {
            targetObj.itemsSummary = targetObj.itemsSummary
              ? `${targetObj.itemsSummary}, ${pDesc}`
              : pDesc;
          }
        });
      });
    });

    if (client.products && client.products.length > 0) {
      const baseDate = client.createdAt || `${year}-01-01`;
      if (baseDate.startsWith(String(year)) && isWithinFilterRange(baseDate)) {
        const mIdx = parseInt(baseDate.slice(5, 7), 10) - 1;
        if (mIdx >= 0 && mIdx <= 11) {
          const hasExisting =
            monthlyData[mIdx].onCredit.totalQuantity > 0 || monthlyData[mIdx].paid.totalQuantity > 0;

          if (!hasExisting) {
            const isCredit = (client.currentDebt || 0) > 0;
            const targetObj = isCredit ? monthlyData[mIdx].onCredit : monthlyData[mIdx].paid;

            client.products.forEach((p) => {
              const qty = p.quantity || 0;
              const sum = p.totalPrice || qty * (p.unitPrice || 0);
              targetObj.totalQuantity += qty;
              targetObj.totalSum += sum;

              const pDesc = `${p.name} (${qty} ${p.unit})`;
              if (!targetObj.itemsSummary.includes(p.name)) {
                targetObj.itemsSummary = targetObj.itemsSummary
                  ? `${targetObj.itemsSummary}, ${pDesc}`
                  : pDesc;
              }
            });
          }
        }
      }
    }

    return monthlyData;
  };

  const filteredDeliveryClients = useMemo(() => {
    let list: ClientProductAnnualItem[] = internalClients.map((c) => {
      const months = computeClientProductDeliveries(c, delivYear, delivStartDate, delivEndDate);
      let totalDeliveredCreditSum = 0;
      let totalDeliveredPaidSum = 0;
      let totalDeliveredPieces = 0;

      months.forEach((m) => {
        totalDeliveredCreditSum += m.onCredit.totalSum;
        totalDeliveredPaidSum += m.paid.totalSum;
        totalDeliveredPieces += m.onCredit.totalQuantity + m.paid.totalQuantity;
      });

      return {
        client: c,
        totalDeliveredCreditSum,
        totalDeliveredPaidSum,
        totalDeliveredPieces,
        months,
      };
    });

    if (deferredDelivSearch.trim()) {
      const q = deferredDelivSearch.toLowerCase().trim();
      list = list.filter(({ client: c, months }) => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const phoneMatch = c.phone.toLowerCase().includes(q);
        const addrMatch = (c.address || '').toLowerCase().includes(q);
        const prodMatch = months.some(
          (m) =>
            m.onCredit.itemsSummary.toLowerCase().includes(q) ||
            m.paid.itemsSummary.toLowerCase().includes(q)
        );
        return nameMatch || phoneMatch || addrMatch || prodMatch;
      });
    }

    if (delivRegion !== 'all') {
      const targetReg = delivRegion.toLowerCase();
      list = list.filter(({ client: c }) => {
        const reg = (c.region || parseLegacyAddress(c.address).region).toLowerCase();
        return reg === targetReg || (c.address || '').toLowerCase().includes(targetReg);
      });
    }

    if (delivDistrict !== 'all') {
      const targetDist = delivDistrict.toLowerCase();
      list = list.filter(({ client: c }) => {
        const dist = (c.district || parseLegacyAddress(c.address).district).toLowerCase();
        return dist === targetDist || (c.address || '').toLowerCase().includes(targetDist);
      });
    }

    list.sort((a, b) => {
      if (delivSortMode === 'qty_desc') return b.totalDeliveredPieces - a.totalDeliveredPieces;
      if (delivSortMode === 'qty_asc') return a.totalDeliveredPieces - b.totalDeliveredPieces;
      if (delivSortMode === 'sum_desc') {
        return (
          b.totalDeliveredCreditSum +
          b.totalDeliveredPaidSum -
          (a.totalDeliveredCreditSum + a.totalDeliveredPaidSum)
        );
      }
      if (delivSortMode === 'sum_asc') {
        return (
          a.totalDeliveredCreditSum +
          a.totalDeliveredPaidSum -
          (b.totalDeliveredCreditSum + b.totalDeliveredPaidSum)
        );
      }
      if (delivSortMode === 'credit_desc') return b.totalDeliveredCreditSum - a.totalDeliveredCreditSum;
      if (delivSortMode === 'paid_desc') return b.totalDeliveredPaidSum - a.totalDeliveredPaidSum;
      if (delivSortMode === 'name_asc') return a.client.name.localeCompare(b.client.name, 'uz');
      return 0;
    });

    return list;
  }, [
    internalClients,
    internalPlansByClientMap,
    deferredDelivSearch,
    delivRegion,
    delivDistrict,
    delivYear,
    delivStartDate,
    delivEndDate,
    delivSortMode,
  ]);

  useEffect(() => {
    setBlock3Page(1);
  }, [deferredDelivSearch, delivRegion, delivDistrict, delivYear, delivStartDate, delivEndDate, delivSortMode, block3PageSize]);

  const block3TotalPages = block3PageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredDeliveryClients.length / block3PageSize));
  const safeBlock3Page = Math.min(block3Page, block3TotalPages);
  const visibleBlock3Clients = useMemo(() => {
    if (block3PageSize === 'all') return filteredDeliveryClients;
    const start = (safeBlock3Page - 1) * block3PageSize;
    return filteredDeliveryClients.slice(start, start + block3PageSize);
  }, [filteredDeliveryClients, block3PageSize, safeBlock3Page]);

  const delivStats = useMemo(() => {
    let grandPieces = 0;
    let grandCreditSum = 0;
    let grandPaidSum = 0;

    filteredDeliveryClients.forEach((i) => {
      grandPieces += i.totalDeliveredPieces;
      grandCreditSum += i.totalDeliveredCreditSum;
      grandPaidSum += i.totalDeliveredPaidSum;
    });

    return {
      totalClients: filteredDeliveryClients.length,
      grandPieces,
      grandCreditSum,
      grandPaidSum,
    };
  }, [filteredDeliveryClients]);

  const handleExportDeliveryExcel = async () => {
    try {
      setIsExportingDelivery(true);
      const filterLabel = [
        delivRegion !== 'all' ? `Viloyat: ${delivRegion}` : null,
        delivDistrict !== 'all' ? `Tuman: ${delivDistrict}` : null,
      ]
        .filter(Boolean)
        .join(', ') || "Barcha mijozlar";

      await exportClientProductsAnnualToExcel(filteredDeliveryClients, delivYear, filterLabel);
    } catch (err) {
      console.error("Delivery Excel export error:", err);
    } finally {
      setIsExportingDelivery(false);
    }
  };

  // =========================================================================
  // 4-BLOK DATA & STATES (Agentlar amaliyotlari, tushumlar va tovar harakati)
  // =========================================================================
  // 1. Eng avval ma'lum muddat oralig'ini tanlash
  const [actionStartDate, setActionStartDate] = useState<string>(() => {
    const today = new Date();
    const past = new Date(today);
    past.setDate(today.getDate() - 30);
    return past.toISOString().slice(0, 10);
  });
  const [actionEndDate, setActionEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // 2. Amal turi bo'yicha filtr: 'telefon qilindi', 'joyiga borildi', 'telefon qilindi + joyiga borildi', 'all'
  const [selectedActionType, setSelectedActionType] = useState<ActionFilterType>('all');

  // 3. Viloyat, tuman, agent va qidiruv filtri
  const [actionRegion, setActionRegion] = useState<string>('all');
  const [actionDistrict, setActionDistrict] = useState<string>('all');
  const [actionAgent, setActionAgent] = useState<string>('all');
  const [actionSearch, setActionSearch] = useState<string>('');
  const deferredActionSearch = useDeferredValue(actionSearch);
  const [isExportingActions, setIsExportingActions] = useState(false);
  const [actionViewMode, setActionViewMode] = useState<'consolidated' | 'detailed'>('consolidated');
  const [expandedClientKeys, setExpandedClientKeys] = useState<Set<string>>(new Set());

  // 4-Blok: Amallar soni bo'yicha filtr va saralash
  const [actionCountQuickFilter, setActionCountQuickFilter] = useState<'all' | '1' | '2+' | '3+' | '5+'>('all');
  const [minActionCount, setMinActionCount] = useState<string>('');
  const [maxActionCount, setMaxActionCount] = useState<string>('');
  const [actionCountSort, setActionCountSort] = useState<'date_desc' | 'count_desc' | 'count_asc'>('date_desc');

  const toggleClientExpand = (key: string) => {
    setExpandedClientKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Extract daily closed-plan actions across plans:
  // Rule: If a client was selected for a plan on a given day and the plan was closed (with action),
  // even if multiple financial or product operations were performed on that day, it counts as 1 action (1 marta) for that day.
  const allActionItems = useMemo(() => {
    const dailyClientMap = new Map<string, ActionExportItem>();

    internalPlans.forEach((plan) => {
      const isClosedPlan = Boolean(plan.isClosed || plan.status === 'yopildi');
      const hasAnyRecordedAction =
        Boolean(plan.actionDone) || Boolean(plan.actionsHistory && plan.actionsHistory.length > 0);
      const isClosedWithoutAction =
        plan.closedWithoutAction !== undefined
          ? Boolean(plan.closedWithoutAction)
          : !hasAnyRecordedAction;
      if (!isClosedPlan || isClosedWithoutAction) return;

      const rawActions =
        plan.actionsHistory && plan.actionsHistory.length > 0
          ? plan.actionsHistory
          : plan.actionDone || plan.financialAction || plan.productsDelivered || plan.productsReturned
          ? [
              {
                timestamp: plan.closedAt || plan.completedAt || plan.createdAt,
                author: plan.agentUsername,
                actionDone: plan.actionDone || plan.plannedAction || ('joyiga borildi' as const),
                financialAction: plan.financialAction,
                deliveryPayment: plan.deliveryPayment,
                productsDelivered: plan.productsDelivered,
                productsReturned: plan.productsReturned,
                reportNote: plan.reportNote,
              },
            ]
          : [];

      const hasAnyAction =
        Boolean(plan.actionDone) ||
        rawActions.length > 0;
      if (!hasAnyAction) return;

      const client = internalClientsMap.get(plan.clientId);
      const reg =
        plan.clientRegion ||
        client?.region ||
        parseLegacyAddress(plan.clientAddress || client?.address || '').region;
      const dist =
        plan.clientDistrict ||
        client?.district ||
        parseLegacyAddress(plan.clientAddress || client?.address || '').district;
      const locationStr = [reg, dist].filter(Boolean).join(', ') || plan.clientAddress || client?.address || '-';

      const opDateStr = (
        getClosedDateKey(plan) ||
        getPlanDateKey(plan) ||
        plan.closedAt ||
        plan.planDate ||
        plan.createdAt ||
        ''
      ).slice(0, 10);
      const canonicalClientId = client?.id || plan.clientId || '';
      const cleanPhone = (plan.clientPhone || client?.phone || '').replace(/\D/g, '');
      const cleanName = (plan.clientName || client?.name || '').trim().toLowerCase();
      const clientKey = canonicalClientId
        ? canonicalClientId.toLowerCase()
        : `${cleanName}___${cleanPhone.slice(-9)}`;
      const dailyKey = `${clientKey}___${opDateStr}`;

      const planAgents = new Set<string>();
      if (plan.agentUsername) planAgents.add(plan.agentUsername.trim());
      if (plan.lastExecutedBy) planAgents.add(plan.lastExecutedBy.trim());
      if (plan.closedBy) planAgents.add(plan.closedBy.trim());

      let naqd = 0;
      let karta = 0;
      let bank = 0;
      let qr = 0;
      let creditDeliv = 0;
      let paidDeliv = 0;
      let totalDeliv = 0;
      let returnedCount = 0;
      const deliveredDescList: string[] = [];
      const returnedDescList: string[] = [];
      const notesList: string[] = [];

      let sawCall = false;
      let sawVisit = false;
      const planLevelAct = (plan.actionDone || plan.plannedAction || '').toLowerCase();
      if (planLevelAct.includes('telefon')) sawCall = true;
      if (planLevelAct.includes('joyiga')) sawVisit = true;

      rawActions.forEach((act) => {
        if (act.author) planAgents.add(act.author.trim());
        const actStr = (act.actionDone || '').toLowerCase();
        if (actStr.includes('telefon')) sawCall = true;
        if (actStr.includes('joyiga')) sawVisit = true;

        if (act.financialAction && act.financialAction.amount > 0) {
          const splits = act.financialAction.splits;
          if (splits && splits.length > 0) {
            splits.forEach((sp) => {
              if (!sp || sp.amount <= 0) return;
              const mStr = (sp.method || sp.methodLabel || '').toLowerCase();
              if (mStr.includes('karta')) karta += sp.amount;
              else if (mStr.includes('bank')) bank += sp.amount;
              else if (mStr.includes('qr')) qr += sp.amount;
              else naqd += sp.amount;
            });
          } else {
            const m =
              (act.financialAction as any).method ||
              ((act.financialAction.methodLabel || '').toLowerCase().includes('naqd')
                ? 'naqd'
                : (act.financialAction.methodLabel || '').toLowerCase().includes('karta')
                ? 'karta'
                : (act.financialAction.methodLabel || '').toLowerCase().includes('bank')
                ? 'bank'
                : (act.financialAction.methodLabel || '').toLowerCase().includes('qr')
                ? 'qr'
                : 'naqd');
            const amt = act.financialAction.amount;
            if (m === 'naqd') naqd += amt;
            else if (m === 'karta') karta += amt;
            else if (m === 'bank') bank += amt;
            else if (m === 'qr') qr += amt;
          }
        }

        let actCredit = 0;
        let actPaid = 0;
        if (act.deliveryPayment) {
          const dp = act.deliveryPayment;
          const pType = dp.paymentType;
          if (pType === 'qarzga') {
            actCredit += dp.totalAmount || dp.debtAmount || 0;
          } else {
            actPaid += dp.paidAmount || 0;
            if (dp.splits && dp.splits.length > 0) {
              dp.splits.forEach((sp) => {
                const mStr = (sp.method || sp.methodLabel || '').toLowerCase();
                if (mStr.includes('karta')) karta += sp.amount || 0;
                else if (mStr.includes('bank')) bank += sp.amount || 0;
                else if (mStr.includes('qr')) qr += sp.amount || 0;
                else naqd += sp.amount || 0;
              });
            } else {
              if (pType === 'naqd') naqd += dp.paidAmount || 0;
              else if (pType === 'karta') karta += dp.paidAmount || 0;
              else if (pType === 'bank') bank += dp.paidAmount || 0;
              else if (pType === 'qr') qr += dp.paidAmount || 0;
            }
            if (dp.debtAmount && dp.debtAmount > 0) {
              actCredit += dp.debtAmount;
            }
          }
        }

        const actDelivSum = (act.productsDelivered || []).reduce(
          (sum, p) => sum + (p.totalPrice || p.quantity * (p.unitPrice || 0)),
          0
        );
        if (actCredit === 0 && actDelivSum > actPaid) {
          actCredit = actDelivSum - actPaid;
        }

        creditDeliv += actCredit;
        paidDeliv += actPaid;
        totalDeliv += actCredit + actPaid || actDelivSum;

        (act.productsDelivered || []).forEach((p) => {
          const u = (p.unit || 'dona').toLowerCase() === 'birlik' ? 'dona' : p.unit || 'dona';
          const desc = `${p.name} (${p.quantity} ${u})`;
          if (!deliveredDescList.includes(desc)) deliveredDescList.push(desc);
        });

        (act.productsReturned || []).forEach((r) => {
          const u = (r.unit || 'dona').toLowerCase() === 'birlik' ? 'dona' : r.unit || 'dona';
          const desc = `${r.name} (${r.quantity} ${u})`;
          if (!returnedDescList.includes(desc)) returnedDescList.push(desc);
          returnedCount += r.quantity || 0;
        });

        if (act.reportNote && act.reportNote.trim() && !notesList.includes(act.reportNote.trim())) {
          notesList.push(act.reportNote.trim());
        }
      });

      if (plan.reportNote && plan.reportNote.trim() && !notesList.includes(plan.reportNote.trim())) {
        notesList.push(plan.reportNote.trim());
      } else if (plan.planNote && plan.planNote.trim() && notesList.length === 0) {
        notesList.push(plan.planNote.trim());
      }

      const resolvedActionDone: 'telefon qilindi' | 'joyiga borildi' | 'telefon qilindi + joyiga borildi' =
        sawCall && sawVisit
          ? 'telefon qilindi + joyiga borildi'
          : sawCall
          ? 'telefon qilindi'
          : 'joyiga borildi';

      const displayTimestamp =
        plan.closedAt ||
        plan.completedAt ||
        plan.lastExecutedAt ||
        (plan.actionsHistory && plan.actionsHistory[0]?.timestamp) ||
        (plan.planDate
          ? `${plan.planDate.slice(0, 10)}${(plan.createdAt || '').slice(10) || 'T12:00:00'}`
          : plan.createdAt);

      const existing = dailyClientMap.get(dailyKey);
      if (!existing) {
        const initialAgentsList = Array.from(planAgents).filter(Boolean);
        const formattedAgent =
          initialAgentsList.length > 1
            ? `${initialAgentsList.map(getAgentDisplayName).join(', ')} (${initialAgentsList.length === 2 ? 'ikkala agent' : `${initialAgentsList.length} ta agent`})`
            : initialAgentsList[0] || plan.agentUsername || 'Agent';

        dailyClientMap.set(dailyKey, {
          id: `${canonicalClientId || plan.id}_${opDateStr}`,
          timestamp: displayTimestamp,
          agentUsername: formattedAgent,
          agents: initialAgentsList,
          clientName: client?.name || plan.clientName,
          clientPhone: client?.phone || plan.clientPhone,
          clientLocation: locationStr,
          actionDone: resolvedActionDone,
          receiptNaqd: naqd,
          receiptKarta: karta,
          receiptBank: bank,
          receiptQr: qr,
          totalReceipt: naqd + karta + bank + qr,
          deliveredProductsDesc: deliveredDescList.join(', '),
          deliveredCreditSum: creditDeliv,
          deliveredPaidSum: paidDeliv,
          totalDeliveredSum: totalDeliv,
          returnedProductsDesc: returnedDescList.join(', '),
          returnedCount,
          note: notesList.join('; '),
        });
      } else {
        // Merge agents
        const mergedAgentsSet = new Set<string>(existing.agents || []);
        if (existing.agentUsername) {
          existing.agentUsername.split(',').forEach((ag) => {
            const cleanAg = ag.replace(/\(.*?\)/g, '').trim();
            if (cleanAg) mergedAgentsSet.add(cleanAg);
          });
        }
        planAgents.forEach((ag) => {
          if (ag) mergedAgentsSet.add(ag);
        });
        const mergedAgentsList = Array.from(mergedAgentsSet).filter(Boolean);
        existing.agents = mergedAgentsList;
        existing.agentUsername =
          mergedAgentsList.length > 1
            ? `${mergedAgentsList.map(getAgentDisplayName).join(', ')} (${mergedAgentsList.length === 2 ? 'ikkala agent' : `${mergedAgentsList.length} ta agent`})`
            : mergedAgentsList[0] || existing.agentUsername;

        existing.receiptNaqd += naqd;
        existing.receiptKarta += karta;
        existing.receiptBank += bank;
        existing.receiptQr += qr;
        existing.totalReceipt += naqd + karta + bank + qr;
        existing.deliveredCreditSum += creditDeliv;
        existing.deliveredPaidSum += paidDeliv;
        existing.totalDeliveredSum += totalDeliv;
        existing.returnedCount += returnedCount;
        if (deliveredDescList.length > 0) {
          const mergedDel = new Set(
            [...(existing.deliveredProductsDesc ? existing.deliveredProductsDesc.split(', ') : []), ...deliveredDescList].filter(Boolean)
          );
          existing.deliveredProductsDesc = Array.from(mergedDel).join(', ');
        }
        if (returnedDescList.length > 0) {
          const mergedRet = new Set(
            [...(existing.returnedProductsDesc ? existing.returnedProductsDesc.split(', ') : []), ...returnedDescList].filter(Boolean)
          );
          existing.returnedProductsDesc = Array.from(mergedRet).join(', ');
        }
        if (notesList.length > 0) {
          const mergedNotes = new Set(
            [...(existing.note ? existing.note.split('; ') : []), ...notesList].filter(Boolean)
          );
          existing.note = Array.from(mergedNotes).join('; ');
        }
        const prevAct = existing.actionDone.toLowerCase();
        const combinedCall = prevAct.includes('telefon') || sawCall;
        const combinedVisit = prevAct.includes('joyiga') || sawVisit;
        existing.actionDone =
          combinedCall && combinedVisit
            ? 'telefon qilindi + joyiga borildi'
            : combinedCall
            ? 'telefon qilindi'
            : 'joyiga borildi';

        if (displayTimestamp && (!existing.timestamp || displayTimestamp > existing.timestamp)) {
          existing.timestamp = displayTimestamp;
        }
      }
    });

    return Array.from(dailyClientMap.values());
  }, [internalPlans, internalClientsMap]);

  // Unique agents in 4-blok
  const uniqueActionAgents = useMemo(() => {
    const set = new Set<string>();
    allActionItems.forEach((a) => {
      if (a.agents && a.agents.length > 0) {
        a.agents.forEach((ag) => {
          if (ag) set.add(ag);
        });
      } else if (a.agentUsername) {
        set.add(a.agentUsername);
      }
    });
    return Array.from(set).sort();
  }, [allActionItems]);

  // Base filter 4-Blok by: 1. Date Range -> 2. Action Type -> 3. Region/District -> 4. Search (deferred)
  const baseFilteredActionItems = useMemo(() => {
    return allActionItems.filter((item) => {
      // 1. Date range filter
      if (item.timestamp) {
        const itemD = item.timestamp.slice(0, 10);
        if (actionStartDate && itemD < actionStartDate) return false;
        if (actionEndDate && itemD > actionEndDate) return false;
      }

      // 2. Action Type filter
      if (selectedActionType !== 'all') {
        const actLower = item.actionDone.toLowerCase();
        const targetLower = selectedActionType.toLowerCase();
        if (actLower !== targetLower) return false;
      }

      // 3. Region & District filter
      if (actionRegion !== 'all') {
        const targetReg = actionRegion.toLowerCase();
        if (!item.clientLocation.toLowerCase().includes(targetReg)) return false;
      }

      if (actionDistrict !== 'all') {
        const targetDist = actionDistrict.toLowerCase();
        if (!item.clientLocation.toLowerCase().includes(targetDist)) return false;
      }

      // Agent filter
      if (actionAgent !== 'all') {
        const hasAgent =
          item.agents && item.agents.length > 0
            ? item.agents.some(
                (ag) =>
                  ag.toLowerCase() === actionAgent.toLowerCase() ||
                  ag.toLowerCase().includes(actionAgent.toLowerCase())
              )
            : item.agentUsername.toLowerCase().includes(actionAgent.toLowerCase());
        if (!hasAgent) return false;
      }

      // Search
      if (deferredActionSearch.trim()) {
        const q = deferredActionSearch.toLowerCase().trim();
        const mName = item.clientName.toLowerCase().includes(q);
        const mPhone = item.clientPhone.toLowerCase().includes(q);
        const mLoc = item.clientLocation.toLowerCase().includes(q);
        const mProd = item.deliveredProductsDesc.toLowerCase().includes(q);
        const mRet = item.returnedProductsDesc.toLowerCase().includes(q);
        if (!mName && !mPhone && !mLoc && !mProd && !mRet) return false;
      }

      return true;
    });
  }, [
    allActionItems,
    actionStartDate,
    actionEndDate,
    selectedActionType,
    actionRegion,
    actionDistrict,
    actionAgent,
    deferredActionSearch,
  ]);

  // Group / Consolidate actions by client for the selected date range & apply action count filter
  const consolidatedActionItems = useMemo(() => {
    const map = new Map<string, {
      key: string;
      clientName: string;
      clientPhone: string;
      clientLocation: string;
      totalActionsCount: number;
      visitCount: number;
      callCount: number;
      callAndVisitCount: number;
      actionSummaryLabel: string;
      agents: string[];
      lastTimestamp: string;
      firstTimestamp: string;
      receiptNaqd: number;
      receiptKarta: number;
      receiptBank: number;
      receiptQr: number;
      totalReceipt: number;
      deliveredProductsDesc: string;
      deliveredCreditSum: number;
      deliveredPaidSum: number;
      totalDeliveredSum: number;
      returnedProductsDesc: string;
      returnedCount: number;
      notes: string[];
      rawItems: ActionExportItem[];
    }>();

    baseFilteredActionItems.forEach((item) => {
      const nameKey = (item.clientName || 'Noma\'lum').trim().toLowerCase();
      const phoneKey = (item.clientPhone || '').trim();
      const groupKey = `${nameKey}___${phoneKey}`;

      let group = map.get(groupKey);
      if (!group) {
        group = {
          key: groupKey,
          clientName: item.clientName || 'Noma\'lum',
          clientPhone: item.clientPhone || '-',
          clientLocation: item.clientLocation || '-',
          totalActionsCount: 0,
          visitCount: 0,
          callCount: 0,
          callAndVisitCount: 0,
          actionSummaryLabel: '',
          agents: [],
          lastTimestamp: item.timestamp,
          firstTimestamp: item.timestamp,
          receiptNaqd: 0,
          receiptKarta: 0,
          receiptBank: 0,
          receiptQr: 0,
          totalReceipt: 0,
          deliveredProductsDesc: '',
          deliveredCreditSum: 0,
          deliveredPaidSum: 0,
          totalDeliveredSum: 0,
          returnedProductsDesc: '',
          returnedCount: 0,
          notes: [],
          rawItems: [],
        };
        map.set(groupKey, group);
      }

      group.totalActionsCount += 1;
      group.rawItems.push(item);

      if (item.timestamp) {
        if (!group.lastTimestamp || item.timestamp > group.lastTimestamp) {
          group.lastTimestamp = item.timestamp;
        }
        if (!group.firstTimestamp || item.timestamp < group.firstTimestamp) {
          group.firstTimestamp = item.timestamp;
        }
      }

      const act = (item.actionDone || '').toLowerCase();
      if (act.includes('telefon') && act.includes('joyiga')) {
        group.callAndVisitCount += 1;
      } else if (act.includes('telefon')) {
        group.callCount += 1;
      } else if (act.includes('joyiga')) {
        group.visitCount += 1;
      }

      if (item.agents && item.agents.length > 0) {
        item.agents.forEach((ag) => {
          if (ag && !group.agents.includes(ag)) group.agents.push(ag);
        });
      } else if (item.agentUsername && !group.agents.includes(item.agentUsername)) {
        group.agents.push(item.agentUsername);
      }

      group.receiptNaqd += item.receiptNaqd || 0;
      group.receiptKarta += item.receiptKarta || 0;
      group.receiptBank += item.receiptBank || 0;
      group.receiptQr += item.receiptQr || 0;
      group.totalReceipt += item.totalReceipt || 0;

      group.deliveredCreditSum += item.deliveredCreditSum || 0;
      group.deliveredPaidSum += item.deliveredPaidSum || 0;
      group.totalDeliveredSum += item.totalDeliveredSum || 0;

      group.returnedCount += item.returnedCount || 0;

      if (item.note && item.note.trim() && !group.notes.includes(item.note.trim())) {
        group.notes.push(item.note.trim());
      }
    });

    const parsedMinCount = parseInt(minActionCount, 10);
    const parsedMaxCount = parseInt(maxActionCount, 10);

    const result: Array<{
      key: string;
      clientName: string;
      clientPhone: string;
      clientLocation: string;
      totalActionsCount: number;
      visitCount: number;
      callCount: number;
      callAndVisitCount: number;
      actionSummaryLabel: string;
      agents: string[];
      lastTimestamp: string;
      firstTimestamp: string;
      receiptNaqd: number;
      receiptKarta: number;
      receiptBank: number;
      receiptQr: number;
      totalReceipt: number;
      deliveredProductsDesc: string;
      deliveredCreditSum: number;
      deliveredPaidSum: number;
      totalDeliveredSum: number;
      returnedProductsDesc: string;
      returnedCount: number;
      notes: string[];
      rawItems: ActionExportItem[];
    }> = [];

    map.forEach((group) => {
      // Filter by action count
      if (actionCountQuickFilter === '1' && group.totalActionsCount !== 1) return;
      if (actionCountQuickFilter === '2+' && group.totalActionsCount < 2) return;
      if (actionCountQuickFilter === '3+' && group.totalActionsCount < 3) return;
      if (actionCountQuickFilter === '5+' && group.totalActionsCount < 5) return;

      if (!isNaN(parsedMinCount) && parsedMinCount > 0 && group.totalActionsCount < parsedMinCount) return;
      if (!isNaN(parsedMaxCount) && parsedMaxCount > 0 && group.totalActionsCount > parsedMaxCount) return;

      group.rawItems.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

      const agentParenthesis =
        group.agents.length > 1
          ? ` (${group.agents.length === 2 ? 'ikkala agent' : `${group.agents.length} ta agent`}: ${group.agents.map(getAgentDisplayName).join(', ')})`
          : '';

      if (group.totalActionsCount === 1) {
        group.actionSummaryLabel = `${group.rawItems[0]?.actionDone || 'Joyiga borildi'} (1 marta)${agentParenthesis}`;
      } else if (group.visitCount === group.totalActionsCount) {
        group.actionSummaryLabel = `Joyiga borildi (${group.totalActionsCount} marta)${agentParenthesis}`;
      } else if (group.callCount === group.totalActionsCount) {
        group.actionSummaryLabel = `Telefon qilindi (${group.totalActionsCount} marta)${agentParenthesis}`;
      } else if (group.callAndVisitCount === group.totalActionsCount) {
        group.actionSummaryLabel = `Tel + Joyiga borildi (${group.totalActionsCount} marta)${agentParenthesis}`;
      } else {
        const parts: string[] = [];
        if (group.visitCount > 0) parts.push(`${group.visitCount}x Joyiga borildi`);
        if (group.callCount > 0) parts.push(`${group.callCount}x Telefon qilindi`);
        if (group.callAndVisitCount > 0) parts.push(`${group.callAndVisitCount}x Tel+Joyiga`);
        const remaining = group.totalActionsCount - (group.visitCount + group.callCount + group.callAndVisitCount);
        if (remaining > 0) parts.push(`${remaining}x Boshqa`);
        group.actionSummaryLabel = `${group.totalActionsCount} marta (${parts.join(', ')})${agentParenthesis}`;
      }

      const delSet = new Set<string>();
      group.rawItems.forEach((ri) => {
        if (ri.deliveredProductsDesc && ri.deliveredProductsDesc !== '-') {
          ri.deliveredProductsDesc.split(',').forEach((p) => {
            const clean = p.trim();
            if (clean) delSet.add(clean);
          });
        }
      });
      group.deliveredProductsDesc = Array.from(delSet).join(', ');

      const retSet = new Set<string>();
      group.rawItems.forEach((ri) => {
        if (ri.returnedProductsDesc && ri.returnedProductsDesc !== '-') {
          ri.returnedProductsDesc.split(',').forEach((r) => {
            const clean = r.trim();
            if (clean) retSet.add(clean);
          });
        }
      });
      group.returnedProductsDesc = Array.from(retSet).join(', ');

      result.push(group);
    });

    result.sort((a, b) => {
      if (actionCountSort === 'count_desc') {
        if (b.totalActionsCount !== a.totalActionsCount) return b.totalActionsCount - a.totalActionsCount;
      } else if (actionCountSort === 'count_asc') {
        if (a.totalActionsCount !== b.totalActionsCount) return a.totalActionsCount - b.totalActionsCount;
      }
      return (b.lastTimestamp || '').localeCompare(a.lastTimestamp || '');
    });
    return result;
  }, [baseFilteredActionItems, actionCountQuickFilter, minActionCount, maxActionCount, actionCountSort]);

  // Final filteredActionItems (respects action count filters as well)
  const filteredActionItems = useMemo(() => {
    const allowedClientKeys = new Set(consolidatedActionItems.map((g) => g.key));
    return baseFilteredActionItems.filter((item) => {
      const nameKey = (item.clientName || 'Noma\'lum').trim().toLowerCase();
      const phoneKey = (item.clientPhone || '').trim();
      return allowedClientKeys.has(`${nameKey}___${phoneKey}`);
    });
  }, [baseFilteredActionItems, consolidatedActionItems]);

  // 4-Blok Aggregates & KPI
  const actionStats = useMemo(() => {
    let callCount = 0;
    let visitCount = 0;
    let callAndVisitCount = 0;

    let naqdSum = 0;
    let kartaSum = 0;
    let bankSum = 0;
    let qrSum = 0;
    let totalReceipts = 0;

    let creditDelivSum = 0;
    let paidDelivSum = 0;
    let totalDeliveredSum = 0;

    let returnedProductsCount = 0;

    filteredActionItems.forEach((i) => {
      const act = i.actionDone.toLowerCase();
      if (act.includes('telefon') && act.includes('joyiga')) {
        callAndVisitCount++;
      } else if (act.includes('telefon')) {
        callCount++;
      } else if (act.includes('joyiga')) {
        visitCount++;
      }

      naqdSum += i.receiptNaqd;
      kartaSum += i.receiptKarta;
      bankSum += i.receiptBank;
      qrSum += i.receiptQr;
      totalReceipts += i.totalReceipt;

      creditDelivSum += i.deliveredCreditSum;
      paidDelivSum += i.deliveredPaidSum;
      totalDeliveredSum += i.totalDeliveredSum;

      returnedProductsCount += i.returnedCount;
    });

    return {
      totalActions: filteredActionItems.length,
      callCount,
      visitCount,
      callAndVisitCount,
      naqdSum,
      kartaSum,
      bankSum,
      qrSum,
      totalReceipts,
      creditDelivSum,
      paidDelivSum,
      totalDeliveredSum,
      returnedProductsCount,
    };
  }, [filteredActionItems]);

  // 4-Blok Excel Export with solid black borders
  const handleExportActionsExcel = async () => {
    try {
      setIsExportingActions(true);
      const dateTitle = `${actionStartDate || 'Boshi'} dan ${actionEndDate || 'Hozirgacha'}`;
      const actionLabel =
        selectedActionType === 'all'
          ? "Barcha amallar"
          : selectedActionType === 'telefon qilindi'
          ? "Telefon qilingan"
          : selectedActionType === 'joyiga borildi'
          ? "Joyiga borilgan"
          : "Telefon + Joyiga borilgan";

      if (actionViewMode === 'consolidated') {
        const exportList: ActionExportItem[] = consolidatedActionItems.map((g, idx) => ({
          id: `cons_${idx}`,
          timestamp: g.lastTimestamp,
          agentUsername: g.agents.join(', '),
          clientName: g.clientName,
          clientPhone: g.clientPhone,
          clientLocation: g.clientLocation,
          actionDone: g.actionSummaryLabel,
          actionCount: g.totalActionsCount,
          receiptNaqd: g.receiptNaqd,
          receiptKarta: g.receiptKarta,
          receiptBank: g.receiptBank,
          receiptQr: g.receiptQr,
          totalReceipt: g.totalReceipt,
          deliveredProductsDesc: g.deliveredProductsDesc,
          deliveredCreditSum: g.deliveredCreditSum,
          deliveredPaidSum: g.deliveredPaidSum,
          totalDeliveredSum: g.totalDeliveredSum,
          returnedProductsDesc: g.returnedProductsDesc,
          returnedCount: g.returnedCount,
          note: g.notes.join('; ') || '-',
        }));
        await exportAgentActionsToExcel(
          exportList,
          dateTitle,
          actionLabel,
          true,
          filteredActionItems.length
        );
      } else {
        await exportAgentActionsToExcel(
          filteredActionItems,
          dateTitle,
          actionLabel,
          false
        );
      }
    } catch (err) {
      console.error("Actions Excel export error:", err);
    } finally {
      setIsExportingActions(false);
    }
  };

  const isActionFilterActive =
    actionSearch.trim() !== '' ||
    actionRegion !== 'all' ||
    actionDistrict !== 'all' ||
    actionAgent !== 'all' ||
    selectedActionType !== 'all' ||
    actionCountQuickFilter !== 'all' ||
    minActionCount.trim() !== '' ||
    maxActionCount.trim() !== '' ||
    actionCountSort !== 'date_desc';

  // =========================================================================
  // 5-BLOK DATA & STATES (So'mda (kurs bilan) qabul qilingan to'lovlar va mahsulot to'lovlari)
  // =========================================================================
  const [b5DatePreset, setB5DatePreset] = useState<'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom'>('all');
  const [b5StartDate, setB5StartDate] = useState<string>('');
  const [b5EndDate, setB5EndDate] = useState<string>('');
  const [b5PurposeFilter, setB5PurposeFilter] = useState<'all' | 'payment' | 'product'>('all');
  const [b5MethodFilter, setB5MethodFilter] = useState<string>('all');
  const [b5AuthorFilter, setB5AuthorFilter] = useState<string>('all');
  const [b5SortMode, setB5SortMode] = useState<'date_desc' | 'date_asc' | 'uzs_desc' | 'usd_desc' | 'rate_desc'>('date_desc');
  const [b5Search, setB5Search] = useState<string>('');
  const deferredB5Search = useDeferredValue(b5Search);
  const [isExportingB5, setIsExportingB5] = useState<boolean>(false);

  const handleB5DatePresetChange = (preset: 'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom') => {
    setB5DatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === 'all') {
      setB5StartDate('');
      setB5EndDate('');
    } else if (preset === 'today') {
      setB5StartDate(todayStr);
      setB5EndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      setB5StartDate(yStr);
      setB5EndDate(yStr);
    } else if (preset === 'last7') {
      const p7 = new Date(now);
      p7.setDate(now.getDate() - 7);
      setB5StartDate(p7.toISOString().slice(0, 10));
      setB5EndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const firstDay = `${todayStr.slice(0, 7)}-01`;
      setB5StartDate(firstDay);
      setB5EndDate(todayStr);
    }
  };

  // Extract all payment transactions (both UZS-to-USD converted & direct USD payments, for plain payments & product deliveries)
  const allUzsConversionItems = useMemo<UzsConversionAnalyticsItem[]>(() => {
    const items: UzsConversionAnalyticsItem[] = [];

    // 1. From DailyPlans (actionsHistory & top-level fields)
    internalPlans.forEach((plan) => {
      const client = internalClientsMap.get(plan.clientId);
      const clientName = plan.clientName || client?.name || "Noma'lum mijoz";
      const clientPhone = plan.clientPhone || client?.phone || '';

      const rawActions =
        plan.actionsHistory && plan.actionsHistory.length > 0
          ? plan.actionsHistory
          : plan.actionDone || plan.financialAction || plan.productsDelivered || plan.deliveryPayment
          ? [
              {
                timestamp: plan.completedAt || plan.createdAt,
                author: plan.closedBy || plan.agentUsername,
                actionDone: plan.actionDone || ('joyiga borildi' as const),
                financialAction: plan.financialAction,
                deliveryPayment: plan.deliveryPayment,
                productsDelivered: plan.productsDelivered,
                productsReturned: plan.productsReturned,
                reportNote: plan.reportNote,
              },
            ]
          : [];

      rawActions.forEach((act, actIdx) => {
        const ts = act.timestamp || plan.completedAt || plan.createdAt;
        const dateStr = (ts || '').slice(0, 10);
        const author = act.author || plan.closedBy || plan.agentUsername || 'agentp1';

        // A. Shunchaki to'lov (Section 2: financialAction)
        if (act.financialAction && act.financialAction.amount > 0) {
          const fin = act.financialAction;
          const splits = fin.splits;

          if (splits && splits.length > 0) {
            splits.forEach((sp, spIdx) => {
              if (sp && sp.amount > 0) {
                const isConverted = Boolean(sp.amountUzs && sp.amountUzs > 0);
                const rate = isConverted
                  ? sp.exchangeRate && sp.exchangeRate > 0
                    ? sp.exchangeRate
                    : Math.round((sp.amountUzs || 0) / sp.amount)
                  : 0;
                items.push({
                  id: `plan_fin_sp_${plan.id}_${actIdx}_${spIdx}`,
                  timestamp: ts,
                  dateStr,
                  clientId: plan.clientId,
                  clientName,
                  clientPhone,
                  purpose: 'payment',
                  purposeLabel: "Shunchaki to'lov",
                  paymentMethod: sp.method || 'naqd',
                  paymentMethodLabel: sp.methodLabel || "To'lov",
                  isConverted,
                  amountUzs: isConverted ? Math.round(sp.amountUzs || 0) : 0,
                  exchangeRate: rate,
                  amountUsd: Math.round(sp.amount * 100) / 100,
                  author,
                  note: fin.note || act.reportNote || '',
                });
              }
            });
          } else {
            const isConverted = Boolean(fin.amountUzs && fin.amountUzs > 0);
            const rate = isConverted
              ? fin.exchangeRate && fin.exchangeRate > 0
                ? fin.exchangeRate
                : Math.round((fin.amountUzs || 0) / fin.amount)
              : 0;
            items.push({
              id: `plan_fin_${plan.id}_${actIdx}`,
              timestamp: ts,
              dateStr,
              clientId: plan.clientId,
              clientName,
              clientPhone,
              purpose: 'payment',
              purposeLabel: "Shunchaki to'lov",
              paymentMethod: fin.method || 'naqd',
              paymentMethodLabel: fin.methodLabel || "To'lov",
              isConverted,
              amountUzs: isConverted ? Math.round(fin.amountUzs || 0) : 0,
              exchangeRate: rate,
              amountUsd: Math.round(fin.amount * 100) / 100,
              author,
              note: fin.note || act.reportNote || '',
            });
          }
        }

        // B. Mahsulot uchun to'lov (Section 3: deliveryPayment)
        if (act.deliveryPayment && act.deliveryPayment.paidAmount > 0) {
          const dp = act.deliveryPayment;
          const prodSummary = (act.productsDelivered || [])
            .map((p) => `${p.name} (${p.quantity} ${p.unit})`)
            .join(', ');

          if (dp.splits && dp.splits.length > 0) {
            dp.splits.forEach((sp, spIdx) => {
              if (sp && (sp.amount || 0) > 0) {
                const isConverted = Boolean(sp.amountUzs && sp.amountUzs > 0);
                const rate = isConverted
                  ? sp.exchangeRate && sp.exchangeRate > 0
                    ? sp.exchangeRate
                    : Math.round((sp.amountUzs || 0) / (sp.amount || 1))
                  : 0;
                items.push({
                  id: `plan_deliv_${plan.id}_${actIdx}_${spIdx}`,
                  timestamp: ts,
                  dateStr,
                  clientId: plan.clientId,
                  clientName,
                  clientPhone,
                  purpose: 'product',
                  purposeLabel: 'Mahsulot uchun',
                  paymentMethod: sp.method || 'naqd',
                  paymentMethodLabel: sp.methodLabel || dp.paymentLabel || "Mahsulot to'lovi",
                  isConverted,
                  amountUzs: isConverted ? Math.round(sp.amountUzs || 0) : 0,
                  exchangeRate: rate,
                  amountUsd: Math.round((sp.amount || 0) * 100) / 100,
                  author,
                  note: act.reportNote || plan.reportNote || '',
                  productsSummary: prodSummary,
                });
              }
            });
          } else {
            const isConverted = Boolean(dp.paidAmountUzs && dp.paidAmountUzs > 0);
            const rate = isConverted
              ? dp.exchangeRate && dp.exchangeRate > 0
                ? dp.exchangeRate
                : Math.round((dp.paidAmountUzs || 0) / dp.paidAmount)
              : 0;
            items.push({
              id: `plan_deliv_${plan.id}_${actIdx}`,
              timestamp: ts,
              dateStr,
              clientId: plan.clientId,
              clientName,
              clientPhone,
              purpose: 'product',
              purposeLabel: 'Mahsulot uchun',
              paymentMethod: dp.paymentType || 'naqd',
              paymentMethodLabel: dp.paymentLabel || "Mahsulot to'lovi",
              isConverted,
              amountUzs: isConverted ? Math.round(dp.paidAmountUzs || 0) : 0,
              exchangeRate: rate,
              amountUsd: Math.round(dp.paidAmount * 100) / 100,
              author,
              note: act.reportNote || plan.reportNote || '',
              productsSummary: prodSummary,
            });
          }
        }
      });
    });

    // 2. From Client Audit Logs (standalone QuickPaymentModal or direct debt/advance updates)
    internalClients.forEach((client) => {
      if (!client.logs || client.logs.length === 0) return;
      client.logs.forEach((log) => {
        if (
          log.type === 'visit_action' ||
          log.type === 'product_added' ||
          String(log.id || '').endsWith('_fin')
        ) {
          return;
        }
        const isConverted = Boolean(log.amountUzs && log.amountUzs > 0);
        const isPaymentLog =
          isConverted ||
          Boolean(log.paymentMethodLabel) ||
          log.type === 'payment';

        if (!isPaymentLog) return;

        const rate = isConverted
          ? log.exchangeRate && log.exchangeRate > 0
            ? log.exchangeRate
            : 12800
          : 0;
        const calcUsd =
          log.amountChanged && log.amountChanged > 0
            ? Math.round(log.amountChanged * 100) / 100
            : isConverted && rate > 0
            ? Math.round(((log.amountUzs || 0) / rate) * 100) / 100
            : 0;

        if (calcUsd <= 0) return;

        const purpose = log.purpose === 'product' ? 'product' : 'payment';
        const mLabel = log.paymentMethodLabel || "To'lov";
        const mLower = mLabel.toLowerCase();
        const mKey = mLower.includes('karta')
          ? 'karta'
          : mLower.includes('bank')
          ? 'bank'
          : mLower.includes('qr')
          ? 'qr'
          : 'naqd';

        items.push({
          id: `client_log_${client.id}_${log.id}`,
          timestamp: log.timestamp,
          dateStr: (log.timestamp || '').slice(0, 10),
          clientId: client.id,
          clientName: client.name,
          clientPhone: client.phone,
          purpose,
          purposeLabel: purpose === 'product' ? 'Mahsulot uchun' : "Shunchaki to'lov",
          paymentMethod: mKey,
          paymentMethodLabel: mLabel,
          isConverted,
          amountUzs: isConverted ? Math.round(log.amountUzs || 0) : 0,
          exchangeRate: rate,
          amountUsd: calcUsd,
          author: log.author || 'adminc',
          note: log.details || log.title || '',
        });
      });
    });

    return items;
  }, [internalPlans, internalClients, internalClientsMap]);

  const uniqueB5Authors = useMemo(() => {
    const set = new Set<string>();
    allUzsConversionItems.forEach((item) => {
      if (item.author) set.add(item.author);
    });
    return Array.from(set).sort();
  }, [allUzsConversionItems]);

  const filteredB5Items = useMemo(() => {
    const list = allUzsConversionItems.filter((item) => {
      if (b5StartDate && item.dateStr < b5StartDate) return false;
      if (b5EndDate && item.dateStr > b5EndDate) return false;
      if (b5PurposeFilter !== 'all' && item.purpose !== b5PurposeFilter) return false;
      if (b5AuthorFilter !== 'all' && item.author !== b5AuthorFilter) return false;
      if (b5MethodFilter !== 'all') {
        const mStr = `${item.paymentMethod} ${item.paymentMethodLabel}`.toLowerCase();
        if (!mStr.includes(b5MethodFilter.toLowerCase())) return false;
      }
      if (deferredB5Search.trim()) {
        const q = deferredB5Search.toLowerCase().trim();
        const mName = item.clientName.toLowerCase().includes(q);
        const mPhone = (item.clientPhone || '').toLowerCase().includes(q);
        const mAuthor = item.author.toLowerCase().includes(q);
        const mNote = (item.note || '').toLowerCase().includes(q);
        const mProd = (item.productsSummary || '').toLowerCase().includes(q);
        if (!mName && !mPhone && !mAuthor && !mNote && !mProd) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (b5SortMode === 'date_desc') return (b.timestamp || '').localeCompare(a.timestamp || '');
      if (b5SortMode === 'date_asc') return (a.timestamp || '').localeCompare(b.timestamp || '');
      if (b5SortMode === 'uzs_desc') return b.amountUzs - a.amountUzs;
      if (b5SortMode === 'usd_desc') return b.amountUsd - a.amountUsd;
      if (b5SortMode === 'rate_desc') return b.exchangeRate - a.exchangeRate;
      return 0;
    });

    return list;
  }, [
    allUzsConversionItems,
    b5StartDate,
    b5EndDate,
    b5PurposeFilter,
    b5AuthorFilter,
    b5MethodFilter,
    b5SortMode,
    deferredB5Search,
  ]);

  const b5Stats = useMemo(() => {
    let totalUzs = 0;
    let totalUsd = 0;
    let convertedUsd = 0;
    let nonConvertedUsd = 0;

    filteredB5Items.forEach((i) => {
      if (i.isConverted) {
        totalUzs += i.amountUzs;
        convertedUsd += i.amountUsd;
      } else {
        nonConvertedUsd += i.amountUsd;
      }
      totalUsd += i.amountUsd;
    });

    const avgRate = convertedUsd > 0 ? Math.round(totalUzs / convertedUsd) : 0;

    return {
      totalCount: filteredB5Items.length,
      totalUzs,
      totalUsd: Math.round(totalUsd * 100) / 100,
      convertedUsd: Math.round(convertedUsd * 100) / 100,
      nonConvertedUsd: Math.round(nonConvertedUsd * 100) / 100,
      avgRate,
    };
  }, [filteredB5Items]);

  const handleExportB5Excel = async () => {
    try {
      setIsExportingB5(true);
      const dateLabel =
        b5StartDate || b5EndDate
          ? `${b5StartDate || 'Boshi'} dan ${b5EndDate || 'Hozirgacha'}`
          : 'Barcha vaqt';
      const purposeLabel =
        b5PurposeFilter === 'all'
          ? "Barchasi (Shunchaki to'lov + Mahsulot uchun)"
          : b5PurposeFilter === 'payment'
          ? "Faqat shunchaki to'lov"
          : 'Faqat mahsulot uchun';
      await exportUzsConversionsToExcel(filteredB5Items, dateLabel, purposeLabel);
    } catch (err) {
      console.error('5-Blok Excel export error:', err);
    } finally {
      setIsExportingB5(false);
    }
  };

  // =========================================================================
  // 6-BLOK: MIJOZLAR BO'YICHA KUNLIK BAJARILIB YOPILGAN AMALLAR MATRITSASI (MAKS. 31 KUN: t, b, t+b)
  // =========================================================================
  const [b6DatePreset, setB6DatePreset] = useState<'thisMonth' | 'last7' | 'last15' | 'last31' | 'custom'>('thisMonth');
  const [b6StartDate, setB6StartDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [b6EndDate, setB6EndDate] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [b6LimitWarning, setB6LimitWarning] = useState<string | null>(null);
  const [b6Search, setB6Search] = useState<string>('');
  const deferredB6Search = useDeferredValue(b6Search);
  const [b6AgentFilter, setB6AgentFilter] = useState<string>('all');
  const [b6ClientShowMode, setB6ClientShowMode] = useState<'all' | 'active_only'>('all');
  const [b6MarkFilter, setB6MarkFilter] = useState<'all' | 't' | 'b' | 't+b'>('all');
  const [isExportingB6, setIsExportingB6] = useState<boolean>(false);

  const toLocalYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleB6PresetChange = (preset: 'thisMonth' | 'last7' | 'last15' | 'last31') => {
    setB6DatePreset(preset);
    setB6LimitWarning(null);
    const now = new Date();
    if (preset === 'thisMonth') {
      const s = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const e = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setB6StartDate(s);
      setB6EndDate(e);
    } else {
      const daysBack = preset === 'last7' ? 6 : preset === 'last15' ? 14 : 30;
      const startObj = new Date(now);
      startObj.setDate(now.getDate() - daysBack);
      setB6StartDate(toLocalYMD(startObj));
      setB6EndDate(toLocalYMD(now));
    }
  };

  const handleB6StartChange = (newStart: string) => {
    if (!newStart) return;
    setB6DatePreset('custom');
    const sDate = new Date(`${newStart}T00:00:00`);
    const eDate = b6EndDate ? new Date(`${b6EndDate}T00:00:00`) : new Date(`${newStart}T00:00:00`);

    if (sDate > eDate) {
      setB6StartDate(newStart);
      setB6EndDate(newStart);
      setB6LimitWarning(null);
      return;
    }

    const diffDays = Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      // Cap end date to start + 30 days (31 inclusive days)
      const cappedEnd = new Date(sDate);
      cappedEnd.setDate(sDate.getDate() + 30);
      setB6StartDate(newStart);
      setB6EndDate(toLocalYMD(cappedEnd));
      setB6LimitWarning("Maksimal vaqt oralig'i 31 kundan oshmasligi kerak! Tugash sanasi avtomatik 31 kunga moslashtirildi.");
      setTimeout(() => setB6LimitWarning(null), 5000);
    } else {
      setB6StartDate(newStart);
      setB6LimitWarning(null);
    }
  };

  const handleB6EndChange = (newEnd: string) => {
    if (!newEnd) return;
    setB6DatePreset('custom');
    const eDate = new Date(`${newEnd}T00:00:00`);
    const sDate = b6StartDate ? new Date(`${b6StartDate}T00:00:00`) : new Date(`${newEnd}T00:00:00`);

    if (eDate < sDate) {
      setB6StartDate(newEnd);
      setB6EndDate(newEnd);
      setB6LimitWarning(null);
      return;
    }

    const diffDays = Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      // Cap start date to end - 30 days (31 inclusive days)
      const cappedStart = new Date(eDate);
      cappedStart.setDate(eDate.getDate() - 30);
      setB6StartDate(toLocalYMD(cappedStart));
      setB6EndDate(newEnd);
      setB6LimitWarning("Maksimal vaqt oralig'i 31 kundan oshmasligi kerak! Boshlanish sanasi avtomatik 31 kunga moslashtirildi.");
      setTimeout(() => setB6LimitWarning(null), 5000);
    } else {
      setB6EndDate(newEnd);
      setB6LimitWarning(null);
    }
  };

  // Generate array of YYYY-MM-DD dates in the selected interval (strictly max 31 days)
  const b6DatesList = useMemo(() => {
    if (!b6StartDate || !b6EndDate) return [];
    const s = new Date(`${b6StartDate}T00:00:00`);
    const e = new Date(`${b6EndDate}T00:00:00`);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return [b6StartDate];

    const list: string[] = [];
    const cur = new Date(s);
    while (cur <= e && list.length < 31) {
      list.push(toLocalYMD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  }, [b6StartDate, b6EndDate]);

  // Build lookup of completed & closed actions per (clientId, dateStr) -> { hasT, hasB, agents }
  const b6MatrixRows: ClientDailyMatrixRow[] = useMemo(() => {
    const dateSet = new Set(b6DatesList);
    // Map: clientId -> dateStr -> { hasT: boolean; hasB: boolean; agents: Set<string> }
    const clientDayMap = new Map<
      string,
      Map<string, { hasT: boolean; hasB: boolean; agents: Set<string> }>
    >();

    // Track plans that are still open or closed WITHOUT action so we don't misclassify logs for those days
    const nonCompletedPlanDays = new Set<string>();

    const registerAction = (
      clientId: string,
      dateStr: string,
      actionText: string,
      agentUser: string
    ) => {
      if (!dateSet.has(dateStr)) return;
      if (b6AgentFilter !== 'all' && agentUser !== b6AgentFilter) return;

      const lower = (actionText || '').toLowerCase();
      const isTel = lower.includes('telefon');
      const isBor = lower.includes('joyiga') || lower.includes('borildi');
      if (!isTel && !isBor) return;

      if (!clientDayMap.has(clientId)) {
        clientDayMap.set(clientId, new Map());
      }
      const dMap = clientDayMap.get(clientId)!;
      if (!dMap.has(dateStr)) {
        dMap.set(dateStr, { hasT: false, hasB: false, agents: new Set() });
      }
      const entry = dMap.get(dateStr)!;
      if (isTel) entry.hasT = true;
      if (isBor) entry.hasB = true;
      if (agentUser) entry.agents.add(agentUser);
    };

    // 1. Inspect dailyPlans: only plans that are closed as completed ("bajarib yopilgan")
    internalPlans.forEach((plan) => {
      const pDate = getPlanDateKey(plan) || (plan.planDate || plan.createdAt || '').slice(0, 10);
      const cDate = getClosedDateKey(plan) || ((plan as any).closedDisplayDate || plan.closedAt || '').slice(0, 10);
      const planDateStr = cDate || pDate;

      const isClosed = Boolean(plan.isClosed || plan.status === 'yopildi');
      const hasAnyAction =
        Boolean(plan.actionDone) || Boolean(plan.actionsHistory && plan.actionsHistory.length > 0);
      const withoutAction =
        plan.closedWithoutAction !== undefined
          ? Boolean(plan.closedWithoutAction)
          : !hasAnyAction;
      const isCompletedAndClosed = isClosed && !withoutAction;

      if (!isCompletedAndClosed) {
        if (planDateStr) {
          nonCompletedPlanDays.add(`${plan.clientId}_${planDateStr}`);
        }
        return;
      }

      const defaultAuthor =
        plan.closedBy || plan.lastExecutedBy || plan.agentUsername || 'agentp1';

      if (plan.actionsHistory && plan.actionsHistory.length > 0) {
        plan.actionsHistory.forEach((act) => {
          registerAction(
            plan.clientId,
            planDateStr,
            act.actionDone || plan.actionDone || 'joyiga borildi',
            act.author || defaultAuthor
          );
        });
      } else if (plan.actionDone || plan.status === 'yopildi') {
        registerAction(
          plan.clientId,
          planDateStr,
          plan.actionDone || 'joyiga borildi',
          defaultAuthor
        );
      }
    });

    // Build rows for all clients
    const result: ClientDailyMatrixRow[] = [];

    internalClients.forEach((client) => {
      if (deferredB6Search.trim()) {
        const q = deferredB6Search.toLowerCase().trim();
        const mName = (client.name || '').toLowerCase().includes(q);
        const mPhone = (client.phone || '').toLowerCase().includes(q);
        const mAddr = (client.address || '').toLowerCase().includes(q);
        if (!mName && !mPhone && !mAddr) return;
      }

      const dMap = clientDayMap.get(client.id);
      const dailyMarks: Record<string, 't' | 'b' | 't+b'> = {};
      const dailyAgents: Record<string, string> = {};
      let totalActiveDays = 0;
      let countT = 0;
      let countB = 0;
      let countTB = 0;

      b6DatesList.forEach((dStr) => {
        const info = dMap?.get(dStr);
        if (!info) return;
        let mark: 't' | 'b' | 't+b' | null = null;
        if (info.hasT && info.hasB) {
          mark = 't+b';
        } else if (info.hasB) {
          mark = 'b';
        } else if (info.hasT) {
          mark = 't';
        }

        if (mark) {
          if (b6MarkFilter !== 'all' && mark !== b6MarkFilter) return;
          dailyMarks[dStr] = mark;
          dailyAgents[dStr] = Array.from(info.agents)
            .map((a) => `${getAgentDisplayName(a)} (@${a})`)
            .join(', ');
          totalActiveDays++;
          if (mark === 't') countT++;
          else if (mark === 'b') countB++;
          else if (mark === 't+b') countTB++;
        }
      });

      if (b6ClientShowMode === 'active_only' && totalActiveDays === 0) {
        return;
      }
      if (b6MarkFilter !== 'all' && totalActiveDays === 0) {
        return;
      }

      result.push({
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone || '',
        clientAddress: client.address || '',
        dailyMarks,
        dailyAgents,
        totalActiveDays,
        countT,
        countB,
        countTB,
      });
    });

    // Sort: clients with actions first or alphabetical by client code/name
    result.sort((a, b) => a.clientName.localeCompare(b.clientName, 'uz'));
    return result;
  }, [
    internalClients,
    internalPlans,
    b6DatesList,
    b6AgentFilter,
    b6ClientShowMode,
    b6MarkFilter,
    deferredB6Search,
  ]);

  const b6SummaryStats = useMemo(() => {
    let totalT = 0;
    let totalB = 0;
    let totalTB = 0;
    let clientsWithActions = 0;
    const perDayTotals: Record<string, { total: number; t: number; b: number; tb: number }> = {};
    b6DatesList.forEach((d) => {
      perDayTotals[d] = { total: 0, t: 0, b: 0, tb: 0 };
    });

    b6MatrixRows.forEach((r) => {
      if (r.totalActiveDays > 0) clientsWithActions++;
      totalT += r.countT;
      totalB += r.countB;
      totalTB += r.countTB;
      b6DatesList.forEach((d) => {
        const m = r.dailyMarks[d];
        if (m) {
          perDayTotals[d].total++;
          if (m === 't') perDayTotals[d].t++;
          else if (m === 'b') perDayTotals[d].b++;
          else if (m === 't+b') perDayTotals[d].tb++;
        }
      });
    });

    return {
      totalClients: b6MatrixRows.length,
      clientsWithActions,
      totalActions: totalT + totalB + totalTB,
      totalT,
      totalB,
      totalTB,
      perDayTotals,
    };
  }, [b6MatrixRows, b6DatesList]);

  const handleExportB6Excel = async () => {
    try {
      setIsExportingB6(true);
      const agentLabel =
        b6AgentFilter === 'all'
          ? 'Barcha agentlar'
          : `${getAgentDisplayName(b6AgentFilter)} (@${b6AgentFilter})`;
      await exportClientDailyActionsMatrixToExcel(
        b6MatrixRows,
        b6DatesList,
        b6StartDate,
        b6EndDate,
        agentLabel
      );
    } catch (err) {
      console.error('6-Blok Excel export error:', err);
    } finally {
      setIsExportingB6(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* TOP NAVIGATION TABS FOR BLOCKS 1, 2, 3, 4, 5 & 6          */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl p-1.5 border border-rose-100 shadow-2xs flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveBlockView('block1')}
          className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeBlockView === 'block1'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'text-neutral-700 hover:bg-rose-50'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>1-Blok: Ombor mahsulotlari</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveBlockView('block2')}
          className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeBlockView === 'block2'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'text-neutral-700 hover:bg-rose-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2-Blok: 1 yillik qarz / haq</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveBlockView('block3')}
          className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeBlockView === 'block3'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'text-neutral-700 hover:bg-rose-50'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>3-Blok: Berilgan mahsulotlar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveBlockView('block4')}
          className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeBlockView === 'block4'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'text-neutral-700 hover:bg-rose-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>4-Blok: Agentlar amallari & tushumlar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveBlockView('block5')}
          className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeBlockView === 'block5'
              ? 'bg-amber-700 text-white shadow-xs'
              : 'text-amber-900 bg-amber-50/70 hover:bg-amber-100 border border-amber-200/80'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>5-Blok: To'lovlar va konvertatsiya ({allUzsConversionItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveBlockView('block6')}
          className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeBlockView === 'block6'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-teal-900 bg-teal-50/80 hover:bg-teal-100 border border-teal-200/90'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>6-Blok: Kunlik amallar matritsasi (t / b / t+b)</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1-BLOK: OMBORDAGI MAHSULOTLAR SONI                       */}
      {/* ========================================================= */}
      {activeBlockView === 'block1' && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-6 bg-gradient-to-r from-neutral-900 via-neutral-850 to-neutral-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <Package className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-xl font-bold font-display tracking-tight text-white">
                  1-Blok: Ombordagi mahsulotlar soni tahliliy jadvali
                </h2>
              </div>
              <p className="text-xs text-neutral-300">
                Hozirgi ombor qoldig'i, mahsulot turlari va qoldiq soni bo'yicha tahliliy hisobot
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-neutral-300 uppercase font-semibold">Turlar</div>
                <div className="text-sm sm:text-base font-bold font-mono text-white">
                  {stockStats.totalProducts} xil
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-indigo-300 uppercase font-semibold">Dastlabki kiritilgan</div>
                <div className="text-sm sm:text-base font-bold font-mono text-indigo-200">
                  {formatNumber(stockStats.totalInitialPieces)} dona
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-neutral-300 uppercase font-semibold">
                  {block1SnapshotDate ? `${block1SnapshotDate} dagi qoldiq` : 'Joriy qoldiq'}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-300">
                  {formatNumber(stockStats.totalPieces)} dona
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBlock1Prices((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[40px] cursor-pointer shrink-0 border ${
                  showBlock1Prices
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                }`}
                title="Sotib olish (kirim) va minimal sotish narxlarini ko'rish / yashirish"
              >
                {showBlock1Prices ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showBlock1Prices ? 'Narxlarni yashirish' : "Narxlarni ko'rish"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportStockExcel}
                disabled={isExportingStock || filteredProducts.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[40px] cursor-pointer shrink-0"
              >
                <Download className={`w-4 h-4 ${isExportingStock ? 'animate-bounce' : ''}`} />
                <span>{isExportingStock ? "Yuklanmoqda..." : "1-Blok Excel (.xlsx)"}</span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-neutral-50/80 border-b border-neutral-200/80 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Mahsulot nomi yoki brend..."
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none transition"
                />
              </div>

              <div>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer"
                >
                  <option value="all">Barcha brendlar ({uniqueBrands.length})</option>
                  {uniqueBrands.map((b) => (
                    <option key={b} value={b}>
                      Brend: {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={stockSortMode}
                  onChange={(e) => setStockSortMode(e.target.value as StockSortMode)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer text-neutral-900"
                >
                  <option value="desc">Soni: Ozayish tartibida (ko'pdan kamga)</option>
                  <option value="asc">Soni: Ko'payish tartibida (kamdan ko'pga)</option>
                </select>
              </div>
            </div>

            {/* Sana bo'yicha ombor qoldig'ini ko'rish paneli */}
            <div className="p-2.5 rounded-2xl bg-teal-50/80 border border-teal-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-teal-950 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-teal-700" />
                  <span>Ma'lum bir sanani tanlab shu vaqtdagi qoldiqni ko'rish:</span>
                </span>
                <input
                  type="date"
                  value={block1SnapshotDate}
                  onChange={(e) => setBlock1SnapshotDate(e.target.value)}
                  className="px-2.5 py-1 rounded-xl border border-teal-300 bg-white font-mono font-bold text-teal-950 outline-none focus:border-teal-600"
                />
                <button
                  type="button"
                  onClick={() => setBlock1SnapshotDate('')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    !block1SnapshotDate
                      ? 'bg-teal-800 text-white shadow-2xs'
                      : 'bg-white text-teal-900 border border-teal-200 hover:bg-teal-100'
                  }`}
                >
                  Hozirgi (Joriy holat)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                      d.getDate()
                    ).padStart(2, '0')}`;
                    setBlock1SnapshotDate(ymd);
                  }}
                  className="px-2.5 py-1 rounded-lg font-bold bg-white text-teal-900 border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
                >
                  Kecha
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
                    setBlock1SnapshotDate(ymd);
                  }}
                  className="px-2.5 py-1 rounded-lg font-bold bg-white text-teal-900 border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
                >
                  Oy boshi
                </button>
              </div>
              {block1SnapshotDate && (
                <div className="text-[11px] font-bold text-teal-950 bg-white px-2.5 py-1 rounded-xl border border-teal-200">
                  Tanlangan sana: <strong className="font-mono text-teal-800">{block1SnapshotDate}</strong> yakunidagi ombor qoldig'i
                </div>
              )}
            </div>
          </div>

          {filteredProducts.length > 0 && (
            <div>
              <StickyTableWrapper>
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-rose-50 border-b border-rose-100 text-neutral-800 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-20">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-3">Mahsulot nomi</th>
                      <th className="py-3 px-3">Brendi</th>
                      <th className="py-3 px-3 text-center">O'lchamlari</th>
                      <th className="py-3 px-3.5 text-right font-bold text-indigo-950">
                        Dastlabki kiritilgan qoldiq (Baza yaratilganda)
                      </th>
                      <th className="py-3 px-3.5 text-right font-bold text-emerald-950">
                        {block1SnapshotDate
                          ? `${block1SnapshotDate} sanadagi qoldiq`
                          : "Ombordagi joriy qoldiq (Barcha o'lchamlar)"}
                      </th>
                      {showBlock1Prices && (
                        <>
                          <th className="py-3 px-3 text-right">Sotib olish (kirim)</th>
                          <th className="py-3 px-3 text-right">Minimal sotish</th>
                        </>
                      )}
                      <th className="py-3 px-3 text-right">Kiritilgan sana</th>
                      {(onEditWarehouseProduct || onDeleteWarehouseProduct) && (
                        <th className="py-3 px-3 text-center w-20">Amal</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-150">
                    {visibleBlock1Products.map((p, index) => {
                      const globalIndex =
                        block1PageSize === 'all' ? index : (safeBlock1Page - 1) * block1PageSize + index;
                      const chron = block1ChronologyMap.get(p.id);
                      const snap = block1SnapshotDate && chron ? chron.getStockAtDate(block1SnapshotDate) : null;
                      const stockInfo = snap
                        ? { primary: snap.primaryFormatted, secondary: snap.secondaryFormatted }
                        : formatWarehouseStock(p);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => setHistoryProduct(p)}
                          className={`cursor-pointer transition-colors ${
                            index % 2 === 1 ? 'bg-neutral-50/50 hover:bg-rose-50/40' : 'bg-white hover:bg-rose-50/40'
                          }`}
                          title="Ushbu mahsulot bo'yicha dastlabki qoldiq o'zgarishlari va sotuv xronologiyasini ko'rish uchun bosing"
                        >
                          <td className="py-3 px-3 text-center font-mono text-neutral-400">{globalIndex + 1}</td>
                          <td className="py-3 px-3 font-bold text-neutral-900 hover:text-rose-800 underline decoration-rose-200 underline-offset-2">
                            {p.name}
                            {p.mark1 ? <span className="ml-1 text-[11px] font-semibold text-rose-700">[{p.mark1}]</span> : null}
                          </td>
                          <td className="py-3 px-3 font-semibold text-neutral-700">{p.brand}</td>
                          <td className="py-3 px-3 text-center text-[11px]">
                            {p.packageUnitName && (p.piecesPerPackage || 1) > 1 ? (
                              <div>
                                <span className="font-semibold text-neutral-800">
                                  1 {p.packageUnitName} = {p.piecesPerPackage} dona
                                </span>
                                <div className="text-[10px] text-neutral-500">
                                  (1 dona = {p.volumePerPiece} {p.baseUnit})
                                </div>
                              </div>
                            ) : (
                              <span className="text-neutral-700">
                                1 {p.pieceUnitName || 'dona'} = {p.volumePerPiece} {p.baseUnit}
                              </span>
                            )}
                          </td>

                          {/* Baza yaratilganda dastlabki kiritilgan qoldiq va necha marta o'zgargani */}
                          <td className="py-3 px-3.5 text-right font-mono">
                            <span className="text-xs sm:text-sm font-extrabold text-indigo-950 block">
                              {chron ? chron.initialFormatted.primary : `${p.initialTotalPieces || p.totalPieces} dona`}
                            </span>
                            <span className="text-[10px] font-medium text-neutral-500 block">
                              {chron ? chron.initialFormatted.secondary : ''}
                            </span>
                            {chron && chron.initialEditCount > 0 ? (
                              <span className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-sans font-bold">
                                <History className="w-2.5 h-2.5" />
                                <span>{chron.initialEditCount} marta o'zgargan</span>
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-sans font-semibold text-emerald-700 block">
                                O'zgartirilmagan (Asl)
                              </span>
                            )}
                          </td>

                          {/* Ombordagi qoldiq - barcha o'lchamlarda (korobka, dona, litr/kg) */}
                          <td className="py-3 px-3.5 text-right font-mono">
                            <span
                              className={`text-xs sm:text-sm font-extrabold block ${
                                block1SnapshotDate ? 'text-teal-900' : 'text-emerald-800'
                              }`}
                            >
                              {stockInfo.primary}
                            </span>
                            <span className="text-[10.5px] font-medium text-neutral-500 block">
                              {stockInfo.secondary}
                            </span>
                            {snap && (
                              <span className="text-[10px] font-sans font-semibold text-teal-800 block mt-0.5">
                                Shu sanagacha sotilgan: {snap.soldUpToDatePieces} dona
                              </span>
                            )}
                          </td>

                        {showBlock1Prices && (
                          <>
                            {/* Sotib olish (kirim) narxi */}
                            <td className="py-3 px-3 text-right font-mono text-xs">
                              {p.price > 0 ? (
                                <div>
                                  <span className="font-bold text-neutral-900">
                                    {formatMoney(p.price)}
                                  </span>
                                  <div className="text-[10px] font-sans text-neutral-500">
                                    1 {p.pricingUnitType === 'package' && p.packageUnitName ? p.packageUnitName : p.pieceUnitName || 'dona'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block font-sans">
                                  Narxsiz
                                </span>
                              )}
                            </td>

                            {/* Minimal sotish narxi */}
                            <td className="py-3 px-3 text-right font-mono text-xs">
                              <span className="font-bold text-indigo-950">
                                {formatMoney(p.minSellingPrice !== undefined && p.minSellingPrice > 0 ? p.minSellingPrice : p.price || 0)}
                              </span>
                              <div className="text-[10px] font-sans text-neutral-500">
                                1 {(p.minSellingPricingUnitType || p.pricingUnitType) === 'package' && p.packageUnitName ? p.packageUnitName : p.pieceUnitName || 'dona'}
                              </div>
                            </td>
                          </>
                        )}

                        <td className="py-3 px-3 text-right font-mono text-neutral-500 text-[11px]">{p.intakeDate || '-'}</td>
                        {(onEditWarehouseProduct || onDeleteWarehouseProduct) && (
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center justify-center gap-1">
                              {onEditWarehouseProduct && (
                                <button
                                  type="button"
                                  onClick={() => onEditWarehouseProduct(p)}
                                  className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Mahsulotni tahrirlash"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}
                              {onDeleteWarehouseProduct && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteWarehouseProduct(p)}
                                  className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Ombordan va butun bazadan o'chirish"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </StickyTableWrapper>
              {filteredProducts.length > 25 && (
                <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-neutral-600">
                    <span>Sahifada:</span>
                    <select
                      value={block1PageSize}
                      onChange={(e) => setBlock1PageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="px-2 py-1 rounded-lg border border-neutral-300 bg-white font-bold text-neutral-900 outline-none cursor-pointer"
                    >
                      <option value={50}>50 ta</option>
                      <option value={100}>100 ta</option>
                      <option value={250}>250 ta</option>
                      <option value="all">Barchasi ({filteredProducts.length} ta)</option>
                    </select>
                  </div>
                  {block1PageSize !== 'all' && block1TotalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeBlock1Page <= 1}
                        onClick={() => setBlock1Page((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        Oldingi
                      </button>
                      <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-mono font-bold">
                        {safeBlock1Page} / {block1TotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeBlock1Page >= block1TotalPages}
                        onClick={() => setBlock1Page((p) => Math.min(block1TotalPages, p + 1))}
                        className="px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        Keyingi
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2-BLOK: 1 YILLIK QARZDORLIK VA HAQDORLIK                  */}
      {/* ========================================================= */}
      {activeBlockView === 'block2' && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-6 bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-xl font-bold font-display tracking-tight text-white">
                  2-Blok: Mijozlarning 1 yillik oylik qarzdorlik va haqdorlik tahlili
                </h2>
              </div>
              <p className="text-xs text-rose-200/80">
                Hudud, balans holati, kiritgan xodim va qarz miqdori bo'yicha filtrlash hamda xulosaviy tahlillar
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-rose-200 uppercase font-semibold">Mijozlar</div>
                <div className="text-sm sm:text-base font-bold font-mono text-white">
                  {clientStats.filteredClientsCount} / {clientStats.totalClients} ta
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-rose-200 uppercase font-semibold">Jami qarz</div>
                <div className="text-sm sm:text-base font-bold font-mono text-rose-300">
                  {formatMoney(clientStats.totalDebt)}
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-rose-200 uppercase font-semibold">Jami haqdorlik</div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-300">
                  {formatMoney(clientStats.totalAdvance)}
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportClientsExcel}
                disabled={isExportingClients || filteredAnnualClients.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[40px] cursor-pointer shrink-0"
              >
                <Download className={`w-4 h-4 ${isExportingClients ? 'animate-bounce' : ''}`} />
                <span>{isExportingClients ? "Yuklanmoqda..." : "2-Blok Excel (.xlsx)"}</span>
              </button>
            </div>
          </div>

          {/* 2-BLOK FILTRLAR PANELI */}
          <div className="p-4 bg-neutral-50/80 border-b border-neutral-200/80 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              {/* 1. Qidiruv */}
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Mijoz ismi, telefon, manzil bo'yicha qidirish..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none transition"
                />
              </div>

              {/* 2. Viloyat filtri */}
              <div>
                <select
                  value={selectedRegion}
                  onChange={(e) => {
                    setSelectedRegion(e.target.value);
                    setSelectedDistrict('all');
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer"
                >
                  <option value="all">Barcha viloyatlar ({uniqueRegions.length})</option>
                  {uniqueRegions.map((reg) => (
                    <option key={reg} value={reg}>
                      Viloyat: {reg}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Tuman filtri */}
              <div>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer"
                >
                  <option value="all">Barcha tumanlar ({uniqueDistricts.length})</option>
                  {uniqueDistricts.map((dist) => (
                    <option key={dist} value={dist}>
                      Tuman: {dist}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Yil va Oy filtri */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-24 px-2.5 py-2 text-xs font-bold bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer"
                  title="Tahlil yili"
                >
                  <option value={2025}>2025-yil</option>
                  <option value={2026}>2026-yil</option>
                  <option value={2027}>2027-yil</option>
                </select>

                <select
                  value={selectedClientMonth}
                  onChange={(e) =>
                    setSelectedClientMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  className="flex-1 px-2.5 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer"
                  title="Oy bo'yicha filtr"
                >
                  <option value="all">Barcha 12 oy</option>
                  {MONTH_NAMES.map((mName, idx) => (
                    <option key={mName} value={idx + 1}>
                      {idx + 1}-oy: {mName}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Saralash */}
              <div>
                <select
                  value={clientSortMode}
                  onChange={(e) => setClientSortMode(e.target.value as ClientSortMode)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer text-neutral-900"
                >
                  <option value="debt_desc">Qarz: Ko'pdan kamga</option>
                  <option value="debt_asc">Qarz: Kamdan ko'pga</option>
                  <option value="adv_desc">Haqdorlik: Ko'pdan kamga</option>
                  <option value="adv_asc">Haqdorlik: Kamdan ko'pga</option>
                  <option value="name_asc">Mijoz ismi (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Ikkinchi qator filtrlar: Balans holati, Kiritgan xodim, Min/Max qarz summasi, Tozalash */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-neutral-200/70 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-neutral-500 uppercase mr-1">
                  Balans holati:
                </span>
                <button
                  type="button"
                  onClick={() => setClientBalanceFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    clientBalanceFilter === 'all'
                      ? 'bg-rose-700 text-white shadow-2xs'
                      : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
                  }`}
                >
                  Barchasi ({internalClients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setClientBalanceFilter('debtors')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    clientBalanceFilter === 'debtors'
                      ? 'bg-rose-700 text-white shadow-2xs'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  Faqat qarzdorlar ({globalClientBalanceCounts.debtors})
                </button>
                <button
                  type="button"
                  onClick={() => setClientBalanceFilter('creditors')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    clientBalanceFilter === 'creditors'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  Faqat haqdorlar ({globalClientBalanceCounts.creditors})
                </button>
                <button
                  type="button"
                  onClick={() => setClientBalanceFilter('zero')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    clientBalanceFilter === 'zero'
                      ? 'bg-neutral-800 text-white shadow-2xs'
                      : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
                  }`}
                >
                  Qarz va haqsiz mijozlar ({globalClientBalanceCounts.zero})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Kiritgan xodim filtri */}
                <select
                  value={selectedClientCreator}
                  onChange={(e) => setSelectedClientCreator(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white rounded-lg border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer"
                >
                  <option value="all">Barcha kirituvchilar</option>
                  {uniqueClientCreators.map((cr) => (
                    <option key={cr} value={cr}>
                      Kiritgan: {cr}
                    </option>
                  ))}
                </select>

                {/* Qarz summasi oralig'i (Min / Max USD) */}
                <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-neutral-300">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase">Qarz ($):</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Min"
                    value={minDebtFilter}
                    onChange={(e) => setMinDebtFilter(e.target.value)}
                    className="w-16 text-xs font-mono outline-none bg-transparent text-neutral-900"
                  />
                  <span className="text-neutral-300">-</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Max"
                    value={maxDebtFilter}
                    onChange={(e) => setMaxDebtFilter(e.target.value)}
                    className="w-16 text-xs font-mono outline-none bg-transparent text-neutral-900"
                  />
                </div>

                {isBlock2FilterActive && (
                  <button
                    type="button"
                    onClick={resetBlock2Filters}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Filtrlarni tozalash</span>
                  </button>
                )}
              </div>
            </div>

            {/* Uchinchi qator filtrlar: Qaysidir kun yoki muddat oralig'ini tanlash */}
            <div className="p-2.5 rounded-2xl bg-white border border-rose-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1 mr-1">
                  <Calendar className="w-3.5 h-3.5 text-rose-700" />
                  <span>Muddat oralig'i bo'yicha qarz / haqdorlik:</span>
                </span>
                <button
                  type="button"
                  onClick={() => applyB2QuickDate('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    !isB2DateActive
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  Hozirgi (Barcha vaqt)
                </button>
                <button
                  type="button"
                  onClick={() => applyB2QuickDate('today')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                >
                  Bugun
                </button>
                <button
                  type="button"
                  onClick={() => applyB2QuickDate('yesterday')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition cursor-pointer"
                >
                  Kecha
                </button>
                <button
                  type="button"
                  onClick={() => applyB2QuickDate('thisMonth')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition cursor-pointer"
                >
                  Shu oy
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-rose-50/60 px-2 py-1 rounded-xl border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-900">Aniq kun:</span>
                  <input
                    type="date"
                    value={b2StartDate && b2StartDate === b2EndDate ? b2StartDate : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setB2StartDate(v);
                      setB2EndDate(v);
                    }}
                    className="text-xs font-mono bg-white px-2 py-0.5 rounded-lg border border-rose-200 outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1 rounded-xl border border-neutral-200">
                  <span className="text-[10px] font-bold text-neutral-600">Dan:</span>
                  <input
                    type="date"
                    value={b2StartDate}
                    onChange={(e) => setB2StartDate(e.target.value)}
                    className="text-xs font-mono bg-white px-2 py-0.5 rounded-lg border border-neutral-200 outline-none"
                  />
                  <span className="text-[10px] font-bold text-neutral-600">Gacha:</span>
                  <input
                    type="date"
                    value={b2EndDate}
                    onChange={(e) => setB2EndDate(e.target.value)}
                    className="text-xs font-mono bg-white px-2 py-0.5 rounded-lg border border-neutral-200 outline-none"
                  />
                </div>

                {isB2DateActive && (
                  <select
                    value={b2DateCalcMode}
                    onChange={(e) => setB2DateCalcMode(e.target.value as 'snapshot' | 'period_activity')}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-700 text-white outline-none cursor-pointer"
                  >
                    <option value="snapshot">Sana yakunidagi qoldiq (Qarz / Haq)</option>
                    <option value="period_activity">Faqat shu muddatdagi harakat</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* 2-BLOK XULOSAVIY TAHLILLAR PANELI */}
          <div
            className={`p-4 border-b transition ${
              isBlock2FilterActive
                ? 'bg-gradient-to-r from-rose-50/80 via-white to-emerald-50/50 border-rose-200'
                : 'bg-white border-neutral-200/80'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider ${
                    isBlock2FilterActive ? 'bg-rose-700 text-white' : 'bg-neutral-800 text-white'
                  }`}
                >
                  {isBlock2FilterActive
                    ? "2-Blok: Filtr bo'yicha xulosaviy tahlil"
                    : "2-Blok: Umumiy xulosaviy tahlil"}
                </span>
                <span className="text-xs font-semibold text-neutral-600">
                  Tanlangan mijozlar:{' '}
                  <strong className="text-neutral-900">{clientStats.filteredClientsCount} ta</strong>{' '}
                  (umumiy bazadan{' '}
                  {clientStats.totalClients > 0
                    ? Math.round((clientStats.filteredClientsCount / clientStats.totalClients) * 100)
                    : 0}
                  %)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {clientStats.maxDebtor && (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-medium">
                    Eng yuqori qarz:{' '}
                    <strong>{clientStats.maxDebtor.client.name}</strong> (
                    <span className="font-mono font-bold text-rose-700">
                      {formatMoney(clientStats.maxDebtor.currentDebt)}
                    </span>
                    )
                  </span>
                )}
                {clientStats.topRegion && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 font-medium">
                    Top qarzdor hudud:{' '}
                    <strong>{clientStats.topRegion.region}</strong> (
                    <span className="font-mono font-bold text-amber-900">
                      {formatMoney(clientStats.topRegion.debt)}
                    </span>{' '}
                    • {clientStats.topRegion.count} ta mijoz)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* 1. Mijozlar tarkibi */}
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/90">
                <div className="text-[10px] font-bold uppercase text-neutral-500">
                  Mijozlar tarkibi
                </div>
                <div className="text-base sm:text-lg font-extrabold font-mono text-neutral-900 mt-0.5">
                  {clientStats.filteredClientsCount} ta mijoz
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">
                  Qarzdor: {clientStats.debtorsCount} • Haqdor: {clientStats.creditorsCount} • Qarz va haqsiz: {clientStats.zeroCount}
                </div>
              </div>

              {/* 2. Jami qarzdorlik tahlili */}
              <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-200">
                <div className="text-[10px] font-bold uppercase text-rose-800">
                  Xulosaviy jami qarz
                </div>
                <div className="text-base sm:text-lg font-extrabold font-mono text-rose-700 mt-0.5">
                  {formatMoney(clientStats.totalDebt)}
                </div>
                <div className="text-[10px] text-rose-900/80 mt-0.5">
                  {clientStats.debtorsCount} ta qarzdor ({clientStats.filteredClientsCount > 0 ? Math.round((clientStats.debtorsCount / clientStats.filteredClientsCount) * 100) : 0}%)
                </div>
              </div>

              {/* 3. O'rtacha qarzdorlik */}
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200">
                <div className="text-[10px] font-bold uppercase text-amber-900">
                  O'rtacha qarzdorlik
                </div>
                <div className="text-base sm:text-lg font-extrabold font-mono text-neutral-900 mt-0.5">
                  {formatMoney(Math.round(clientStats.avgDebtPerDebtor))}
                </div>
                <div className="text-[10px] text-amber-900/80 mt-0.5">
                  Har bir qarzdor mijoz hisobiga
                </div>
              </div>

              {/* 4. Jami haqdorlik tahlili */}
              <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200">
                <div className="text-[10px] font-bold uppercase text-emerald-800">
                  Xulosaviy jami haqdorlik
                </div>
                <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-700 mt-0.5">
                  {formatMoney(clientStats.totalAdvance)}
                </div>
                <div className="text-[10px] text-emerald-900/80 mt-0.5">
                  {clientStats.creditorsCount} ta haqdor (o'rtacha {formatMoney(Math.round(clientStats.avgAdvancePerCreditor))})
                </div>
              </div>

              {/* 5. Sof balans (Qarz - Haqdorlik) */}
              <div className="p-3 rounded-xl bg-neutral-900 text-white border border-neutral-800 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">
                  Sof balans (Qarz − Haq)
                </div>
                <div
                  className={`text-base sm:text-lg font-extrabold font-mono mt-0.5 ${
                    clientStats.netBalance >= 0 ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  {formatMoney(Math.abs(clientStats.netBalance))}
                </div>
                <div className="text-[10px] text-neutral-300 mt-0.5">
                  {clientStats.netBalance >= 0 ? 'Sof undiriladigan qarz' : 'Sof mijoz haqdorligi'}
                </div>
              </div>
            </div>
          </div>

          {filteredAnnualClients.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="text-sm font-bold text-neutral-800">
                Tanlangan filtrlar bo'yicha mijozlar topilmadi
              </div>
              <p className="text-xs text-neutral-500">
                Qidiruv so'zini yoki filtr shartlarini o'zgartirib ko'ring.
              </p>
              {isBlock2FilterActive && (
                <button
                  type="button"
                  onClick={resetBlock2Filters}
                  className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Filtrlarni tozalash</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              <StickyTableWrapper>
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-rose-50 text-neutral-800 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-20 border-b border-rose-200">
                    <tr>
                    <th rowSpan={2} className="py-3 px-3 w-10 text-center border-b border-rose-200">#</th>
                    <th rowSpan={2} className="py-3 px-3.5 min-w-[180px] border-b border-rose-200">Mijoz nomi</th>
                    <th rowSpan={2} className="py-3 px-3 min-w-[120px] border-b border-rose-200">Telefon</th>
                    <th rowSpan={2} className="py-3 px-3 min-w-[140px] border-b border-rose-200">Hudud</th>
                    <th rowSpan={2} className="py-3 px-3.5 text-right bg-rose-100/90 text-rose-950 min-w-[125px] border-b border-rose-200">
                      Hozirgi qarz
                    </th>
                    <th rowSpan={2} className="py-3 px-3.5 text-right bg-emerald-100/90 text-emerald-950 min-w-[125px] border-b border-rose-200">
                      Hozirgi haqdorlik
                    </th>
                    {MONTH_NAMES.map((name, idx) => (
                      <th
                        key={name}
                        colSpan={2}
                        className={`py-2 px-2.5 text-center border-l-2 border-b border-rose-200/90 font-bold ${
                          selectedClientMonth === idx + 1
                            ? 'bg-rose-700 text-white'
                            : 'bg-rose-100/60 text-neutral-900'
                        }`}
                      >
                        {name} ({selectedYear})
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-rose-50/70 text-[10px] text-neutral-600 font-bold">
                    {MONTH_NAMES.map((name) => (
                      <React.Fragment key={name}>
                        <th className="py-1 px-2 text-right border-l-2 border-rose-200/90 text-rose-800 bg-rose-50/90 min-w-[90px]">Qarz</th>
                        <th className="py-1 px-2 text-right border-l border-rose-100 text-emerald-800 bg-emerald-50/60 min-w-[90px]">Haq</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150">
                  {visibleBlock2Clients.map((item, index) => {
                    const globalIndex =
                      block2PageSize === 'all' ? index : (safeBlock2Page - 1) * block2PageSize + index;
                    const c = item.client;
                    const location = [c.region, c.district].filter(Boolean).join(', ') || c.address || '-';
                    return (
                      <tr key={c.id} className={index % 2 === 1 ? 'bg-neutral-50/40' : 'bg-white'}>
                        <td className="py-2.5 px-3 text-center font-mono text-neutral-400">{globalIndex + 1}</td>
                        <td className="py-2.5 px-3.5 font-bold text-neutral-900">
                          <div>{c.name}</div>
                          <div className="text-[10px] font-mono text-neutral-400 font-normal">
                            Kiritgan: {c.createdBy || 'adminc'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-600">{c.phone}</td>
                        <td className="py-2.5 px-3 text-neutral-700 truncate max-w-[140px]">{location}</td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold bg-rose-50/40">
                          {item.currentDebt > 0 ? (
                            <span className="text-rose-700 font-extrabold">{formatMoney(item.currentDebt)}</span>
                          ) : '-'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold bg-emerald-50/40">
                          {item.currentAdvance > 0 ? (
                            <span className="text-emerald-700 font-extrabold">{formatMoney(item.currentAdvance)}</span>
                          ) : '-'}
                        </td>
                        {item.months.map((m) => (
                          <React.Fragment key={m.month}>
                            <td
                              className={`py-2.5 px-2 text-right font-mono text-[11px] border-l-2 border-neutral-200 ${
                                selectedClientMonth === m.month ? 'bg-rose-50/70' : ''
                              }`}
                            >
                              {m.debt > 0 ? <span className="text-rose-700 font-bold">{formatMoney(m.debt)}</span> : '-'}
                            </td>
                            <td
                              className={`py-2.5 px-2 text-right font-mono text-[11px] border-l border-neutral-150 ${
                                selectedClientMonth === m.month ? 'bg-emerald-50/70' : ''
                              }`}
                            >
                              {m.advance > 0 ? <span className="text-emerald-700 font-bold">{formatMoney(m.advance)}</span> : '-'}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-rose-100/80 border-t-2 border-rose-300 text-neutral-900 font-extrabold text-xs">
                  <tr>
                    <td colSpan={4} className="py-3 px-3.5 uppercase tracking-wide text-rose-950">
                      JAMI XULOSAVIY QIYMAT ({clientStats.filteredClientsCount} ta mijoz • Qarzdor: {clientStats.debtorsCount} • Haqdor: {clientStats.creditorsCount})
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-rose-800 bg-rose-200/70">
                      {formatMoney(clientStats.totalDebt)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-emerald-800 bg-emerald-200/70">
                      {formatMoney(clientStats.totalAdvance)}
                    </td>
                    {clientStats.monthlyTotals.map((mt) => (
                      <React.Fragment key={mt.month}>
                        <td className="py-3 px-2 text-right font-mono text-[11px] border-l-2 border-rose-300 text-rose-800 bg-rose-100/60">
                          {mt.debt > 0 ? formatMoney(mt.debt) : '-'}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-[11px] border-l border-rose-200 text-emerald-800 bg-emerald-100/60">
                          {mt.advance > 0 ? formatMoney(mt.advance) : '-'}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                </tfoot>
                </table>
              </StickyTableWrapper>
              {filteredAnnualClients.length > 25 && (
                <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-neutral-600">
                    <span>Sahifada:</span>
                    <select
                      value={block2PageSize}
                      onChange={(e) => setBlock2PageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="px-2 py-1 rounded-lg border border-neutral-300 bg-white font-bold text-neutral-900 outline-none cursor-pointer"
                    >
                      <option value={50}>50 ta</option>
                      <option value={100}>100 ta</option>
                      <option value={250}>250 ta</option>
                      <option value="all">Barchasi ({filteredAnnualClients.length} ta)</option>
                    </select>
                  </div>
                  {block2PageSize !== 'all' && block2TotalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeBlock2Page <= 1}
                        onClick={() => setBlock2Page((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        Oldingi
                      </button>
                      <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-mono font-bold">
                        {safeBlock2Page} / {block2TotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeBlock2Page >= block2TotalPages}
                        onClick={() => setBlock2Page((p) => Math.min(block2TotalPages, p + 1))}
                        className="px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        Keyingi
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3-BLOK: BERILGAN MAHSULOTLAR (QARZGA VA QARZSIZ)          */}
      {/* ========================================================= */}
      {activeBlockView === 'block3' && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-6 bg-gradient-to-r from-neutral-900 via-rose-950 to-neutral-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-xl font-bold font-display tracking-tight text-white">
                  3-Blok: Mijozlarga berilgan mahsulotlar 1 yillik tahlili
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-rose-300 uppercase font-semibold">Qarzga berilgan</div>
                <div className="text-sm sm:text-base font-bold font-mono text-rose-300">
                  {formatMoney(delivStats.grandCreditSum)}
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-emerald-300 uppercase font-semibold">Qarzsiz berilgan</div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-300">
                  {formatMoney(delivStats.grandPaidSum)}
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportDeliveryExcel}
                disabled={isExportingDelivery || filteredDeliveryClients.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[40px] cursor-pointer shrink-0"
              >
                <Download className={`w-4 h-4 ${isExportingDelivery ? 'animate-bounce' : ''}`} />
                <span>{isExportingDelivery ? "Yuklanmoqda..." : "3-Blok Excel (.xlsx)"}</span>
              </button>
            </div>
          </div>

          <div>
            <StickyTableWrapper>
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-rose-50 text-neutral-800 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-20 border-b border-rose-200">
                  <tr>
                  <th rowSpan={2} className="py-3 px-3 w-10 text-center border-b border-rose-200">#</th>
                  <th rowSpan={2} className="py-3 px-3.5 min-w-[170px] border-b border-rose-200">Mijoz nomi</th>
                  <th rowSpan={2} className="py-3 px-3 min-w-[110px] border-b border-rose-200">Telefon</th>
                  <th rowSpan={2} className="py-3 px-3 min-w-[130px] border-b border-rose-200">Hudud</th>
                  <th rowSpan={2} className="py-3 px-3 text-right bg-rose-100/90 text-rose-950 min-w-[130px] border-b border-rose-200">Jami qarzga</th>
                  <th rowSpan={2} className="py-3 px-3 text-right bg-emerald-100/90 text-emerald-950 min-w-[130px] border-b border-rose-200">Jami qarzsiz</th>
                  {MONTH_NAMES.map((name) => (
                    <th key={name} colSpan={2} className="py-2 px-2.5 text-center border-l-2 border-b border-rose-200/90 bg-rose-100/60 text-neutral-900 font-bold">
                      {name} ({delivYear})
                    </th>
                  ))}
                </tr>
                <tr className="bg-rose-50/70 text-[10px] text-neutral-600 font-bold">
                  {MONTH_NAMES.map((name) => (
                    <React.Fragment key={name}>
                      <th className="py-1 px-2 text-center border-l-2 border-rose-200/90 text-rose-800 bg-rose-50/90 min-w-[130px]">Qarzga berilgan</th>
                      <th className="py-1 px-2 text-center border-l border-rose-100 text-emerald-800 bg-emerald-50/60 min-w-[130px]">Qarzsiz berilgan</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-150">
                {visibleBlock3Clients.map((item, index) => {
                  const globalIndex =
                    block3PageSize === 'all' ? index : (safeBlock3Page - 1) * block3PageSize + index;
                  const c = item.client;
                  const location = [c.region, c.district].filter(Boolean).join(', ') || c.address || '-';
                  return (
                    <tr key={c.id} className={index % 2 === 1 ? 'bg-neutral-50/40' : 'bg-white'}>
                      <td className="py-2.5 px-3 text-center font-mono text-neutral-400">{globalIndex + 1}</td>
                      <td className="py-2.5 px-3.5 font-bold text-neutral-900">{c.name}</td>
                      <td className="py-2.5 px-3 font-mono text-neutral-600">{c.phone}</td>
                      <td className="py-2.5 px-3 text-neutral-700 truncate max-w-[130px]">{location}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold bg-rose-50/40">
                        {item.totalDeliveredCreditSum > 0 ? (
                          <span className="text-rose-700 font-extrabold">{formatMoney(item.totalDeliveredCreditSum)}</span>
                        ) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold bg-emerald-50/40">
                        {item.totalDeliveredPaidSum > 0 ? (
                          <span className="text-emerald-700 font-extrabold">{formatMoney(item.totalDeliveredPaidSum)}</span>
                        ) : '-'}
                      </td>
                      {item.months.map((m) => (
                        <React.Fragment key={m.month}>
                          <td className="py-2.5 px-2 border-l-2 border-neutral-200 max-w-[160px] text-left">
                            {m.onCredit.totalSum > 0 || m.onCredit.totalQuantity > 0 ? (
                              <div>
                                <div className="font-semibold text-[11px] text-neutral-900 truncate" title={m.onCredit.itemsSummary}>
                                  {m.onCredit.itemsSummary}
                                </div>
                                <div className="font-mono font-extrabold text-[11px] text-rose-700 text-right">
                                  {formatMoney(m.onCredit.totalSum)}
                                </div>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-2.5 px-2 border-l border-neutral-150 max-w-[160px] text-left">
                            {m.paid.totalSum > 0 || m.paid.totalQuantity > 0 ? (
                              <div>
                                <div className="font-semibold text-[11px] text-neutral-900 truncate" title={m.paid.itemsSummary}>
                                  {m.paid.itemsSummary}
                                </div>
                                <div className="font-mono font-extrabold text-[11px] text-emerald-700 text-right">
                                  {formatMoney(m.paid.totalSum)}
                                </div>
                              </div>
                            ) : '-'}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </StickyTableWrapper>
            {filteredDeliveryClients.length > 25 && (
              <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-neutral-600">
                  <span>Sahifada:</span>
                  <select
                    value={block3PageSize}
                    onChange={(e) => setBlock3PageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="px-2 py-1 rounded-lg border border-neutral-300 bg-white font-bold text-neutral-900 outline-none cursor-pointer"
                  >
                    <option value={50}>50 ta</option>
                    <option value={100}>100 ta</option>
                    <option value={250}>250 ta</option>
                    <option value="all">Barchasi ({filteredDeliveryClients.length} ta)</option>
                  </select>
                </div>
                {block3PageSize !== 'all' && block3TotalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeBlock3Page <= 1}
                      onClick={() => setBlock3Page((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-40 font-semibold cursor-pointer"
                    >
                      Oldingi
                    </button>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-mono font-bold">
                      {safeBlock3Page} / {block3TotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeBlock3Page >= block3TotalPages}
                      onClick={() => setBlock3Page((p) => Math.min(block3TotalPages, p + 1))}
                      className="px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-40 font-semibold cursor-pointer"
                    >
                      Keyingi
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4-BLOK: AGENTLAR AMALLARI, TUSHUMLAR VA MAHSULOT HARAKATI */}
      {/* ========================================================= */}
      {activeBlockView === 'block4' && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
          {/* Banner */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-neutral-950 via-rose-950 to-neutral-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <Activity className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-xl font-bold font-display tracking-tight text-white">
                  4-Blok: Agentlar amallari, tushumlar va tovar harakati tahlili
                </h2>
              </div>
              <p className="text-xs text-neutral-300">
                Vaqt oralig'i, bajarilgan amal turi (telefon/joyiga borish), to'lov shakli va qaytgan tovarlar bo'yicha batafsil hisobot
              </p>
            </div>

            {/* Quick KPI & Excel Export */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-neutral-300 uppercase font-semibold">Jami amallar</div>
                <div className="text-sm sm:text-base font-bold font-mono text-white">
                  {actionStats.totalActions} ta
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-emerald-300 uppercase font-semibold">Jami tushum</div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-300">
                  {formatMoney(actionStats.totalReceipts)}
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-rose-300 uppercase font-semibold">Qarzga berildi</div>
                <div className="text-sm sm:text-base font-bold font-mono text-rose-300">
                  {formatMoney(actionStats.creditDelivSum)}
                </div>
              </div>

              {/* 4-Blok Excel Export with Black Borders */}
              <button
                type="button"
                onClick={handleExportActionsExcel}
                disabled={isExportingActions || filteredActionItems.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[40px] cursor-pointer shrink-0"
                title="4-blokni Excel (.xlsx) formatda qora borderlar bilan yuklab olish"
              >
                <Download className={`w-4 h-4 ${isExportingActions ? 'animate-bounce' : ''}`} />
                <span>{isExportingActions ? "Yuklanmoqda..." : "4-Blok Excel (.xlsx)"}</span>
              </button>
            </div>
          </div>

          {/* 4-Blok Workflow Controls: Step 1 (Dates), Step 2 (Action Type), Step 3 (Region/District) */}
          <div className="p-4 bg-neutral-50/80 border-b border-neutral-200/80 space-y-3.5">
            {/* STEP 1: Eng avval ma'lum muddat oralig'ini tanlash */}
            <div className="p-3 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-700 text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-rose-700" />
                    <span>Eng avval muddat oralig'ini belgilang:</span>
                  </span>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      setActionStartDate(today);
                      setActionEndDate(today);
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 cursor-pointer"
                  >
                    Bugun
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const past = new Date(today);
                      past.setDate(today.getDate() - 7);
                      setActionStartDate(past.toISOString().slice(0, 10));
                      setActionEndDate(today.toISOString().slice(0, 10));
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 cursor-pointer"
                  >
                    Oxirgi 7 kun
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const first = new Date(today.getFullYear(), today.getMonth(), 1);
                      setActionStartDate(first.toISOString().slice(0, 10));
                      setActionEndDate(today.toISOString().slice(0, 10));
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 cursor-pointer"
                  >
                    Shu oy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const past = new Date(today);
                      past.setDate(today.getDate() - 30);
                      setActionStartDate(past.toISOString().slice(0, 10));
                      setActionEndDate(today.toISOString().slice(0, 10));
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-100 hover:bg-rose-200 text-rose-900 cursor-pointer font-bold"
                  >
                    Oxirgi 30 kun
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionStartDate('');
                      setActionEndDate('');
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 cursor-pointer"
                  >
                    Barcha muddat
                  </button>
                </div>
              </div>

              {/* Exact Date Inputs */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[11px] text-neutral-500 font-medium">Boshlanish:</span>
                <input
                  type="date"
                  value={actionStartDate}
                  onChange={(e) => setActionStartDate(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-neutral-50 focus:bg-white rounded-xl border border-neutral-300 outline-none font-medium"
                />
                <span className="text-neutral-400 text-xs">—</span>
                <span className="text-[11px] text-neutral-500 font-medium">Tugash:</span>
                <input
                  type="date"
                  value={actionEndDate}
                  onChange={(e) => setActionEndDate(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-neutral-50 focus:bg-white rounded-xl border border-neutral-300 outline-none font-medium"
                />
                <span className="text-[11px] font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 ml-auto">
                  {actionStartDate && actionEndDate ? `${actionStartDate} dan ${actionEndDate} gacha` : "Barcha sana oralig'i"}
                </span>
              </div>
            </div>

            {/* STEP 2: Undan keyin amal turi bo'yicha tanlash */}
            <div className="p-3 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-700 text-white text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-xs font-bold text-neutral-900">
                  Amal turini tanlang (agentlar bajargan amaliyotlar):
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedActionType('all')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
                    selectedActionType === 'all'
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <span>Barcha amallar</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedActionType === 'all' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-800'}`}>
                    {allActionItems.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedActionType('telefon qilindi')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
                    selectedActionType === 'telefon qilindi'
                      ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                      : 'bg-blue-50/60 text-blue-900 border-blue-200 hover:bg-blue-100/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Telefon qilingan</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedActionType === 'telefon qilindi' ? 'bg-white/20 text-white' : 'bg-blue-200 text-blue-900'}`}>
                    {actionStats.callCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedActionType('joyiga borildi')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
                    selectedActionType === 'joyiga borildi'
                      ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                      : 'bg-rose-50/60 text-rose-900 border-rose-200 hover:bg-rose-100/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Joyiga borilgan</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedActionType === 'joyiga borildi' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-900'}`}>
                    {actionStats.visitCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedActionType('telefon qilindi + joyiga borildi')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
                    selectedActionType === 'telefon qilindi + joyiga borildi'
                      ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                      : 'bg-purple-50/60 text-purple-900 border-purple-200 hover:bg-purple-100/60'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Tel + Joyiga borilgan</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedActionType === 'telefon qilindi + joyiga borildi' ? 'bg-white/20 text-white' : 'bg-purple-200 text-purple-900'}`}>
                    {actionStats.callAndVisitCount}
                  </span>
                </button>
              </div>
            </div>

            {/* STEP 3: Chiqqandan so'ng viloyat, tuman, agent va qidiruv bo'yicha filtr */}
            <div className="p-3 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-rose-700 text-white text-[11px] font-bold flex items-center justify-center">
                  3
                </span>
                <span className="text-xs font-bold text-neutral-900">
                  Viloyat, tuman va agent bo'yicha saralash:
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Mijoz, telefon, mahsulot..."
                    value={actionSearch}
                    onChange={(e) => setActionSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 focus:bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none transition"
                  />
                </div>

                <div>
                  <select
                    value={actionRegion}
                    onChange={(e) => {
                      setActionRegion(e.target.value);
                      setActionDistrict('all');
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold bg-neutral-50 rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer"
                  >
                    <option value="all">Barcha viloyatlar ({uniqueRegions.length})</option>
                    {uniqueRegions.map((reg) => (
                      <option key={reg} value={reg}>
                        Viloyat: {reg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={actionDistrict}
                    onChange={(e) => setActionDistrict(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-neutral-50 rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer"
                  >
                    <option value="all">Barcha tumanlar ({uniqueDistricts.length})</option>
                    {uniqueDistricts.map((dist) => (
                      <option key={dist} value={dist}>
                        Tuman: {dist}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={actionAgent}
                    onChange={(e) => setActionAgent(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-neutral-50 rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer"
                  >
                    <option value="all">Barcha agentlar ({uniqueActionAgents.length})</option>
                    {uniqueActionAgents.map((ag) => (
                      <option key={ag} value={ag}>
                        Agent: @{ag}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amallar soni (necha marotaba qilingani) bo'yicha filtr va saralash */}
              <div className="pt-2.5 border-t border-neutral-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-rose-900 uppercase mr-1">
                    Amallar soni bo'yicha filtr:
                  </span>
                  {(
                    [
                      { id: 'all', label: 'Barchasi' },
                      { id: '1', label: 'Faqat 1 marta' },
                      { id: '2+', label: '2 va undan ko\'p (2+)' },
                      { id: '3+', label: '3 va undan ko\'p (3+)' },
                      { id: '5+', label: '5 va undan ko\'p (5+)' },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setActionCountQuickFilter(btn.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        actionCountQuickFilter === btn.id
                          ? 'bg-rose-700 text-white shadow-2xs'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}

                  <div className="flex items-center gap-1 bg-neutral-50 px-2.5 py-1 rounded-lg border border-neutral-300 ml-1">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase">Soni (marta):</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="Min"
                      value={minActionCount}
                      onChange={(e) => setMinActionCount(e.target.value)}
                      className="w-12 text-xs font-mono outline-none bg-transparent text-neutral-900"
                    />
                    <span className="text-neutral-300">-</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="Max"
                      value={maxActionCount}
                      onChange={(e) => setMaxActionCount(e.target.value)}
                      className="w-12 text-xs font-mono outline-none bg-transparent text-neutral-900"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={actionCountSort}
                    onChange={(e) =>
                      setActionCountSort(e.target.value as 'date_desc' | 'count_desc' | 'count_asc')
                    }
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-950 border border-rose-200 outline-none cursor-pointer"
                  >
                    <option value="date_desc">Saralash: So'nggi amal vaqti bo'yicha</option>
                    <option value="count_desc">Amallar soni: Eng ko'p qilinganlar oldin</option>
                    <option value="count_asc">Amallar soni: Eng kam qilinganlar oldin</option>
                  </select>

                  {isActionFilterActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionSearch('');
                        setActionRegion('all');
                        setActionDistrict('all');
                        setActionAgent('all');
                        setSelectedActionType('all');
                        setActionCountQuickFilter('all');
                        setMinActionCount('');
                        setMaxActionCount('');
                        setActionCountSort('date_desc');
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 transition px-2.5 py-1 rounded-lg hover:bg-rose-50 cursor-pointer border border-rose-200"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Filtrlarni tozalash</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 4-Blok Summary Metric Cards: Tushumlar to'lov turiga qarab, Berilgan mahsulotlar qarz va to'lovga qarab, Qaytgan mahsulotlar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Card 1: Tushumlar to'lov turlariga qarab */}
              <div className="p-3.5 rounded-2xl bg-white border border-neutral-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>Tushumlar (to'lov turlari bo'yicha)</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">
                    {formatMoney(actionStats.totalReceipts)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-neutral-100 font-mono">
                  <div className="flex justify-between bg-emerald-50/60 p-1.5 rounded-lg">
                    <span className="text-neutral-600">Naqd pul:</span>
                    <span className="font-bold text-emerald-900">{formatMoney(actionStats.naqdSum)}</span>
                  </div>
                  <div className="flex justify-between bg-purple-50/60 p-1.5 rounded-lg">
                    <span className="text-neutral-600">Karta:</span>
                    <span className="font-bold text-purple-900">{formatMoney(actionStats.kartaSum)}</span>
                  </div>
                  <div className="flex justify-between bg-blue-50/60 p-1.5 rounded-lg">
                    <span className="text-neutral-600">Bank o'tkazma:</span>
                    <span className="font-bold text-blue-900">{formatMoney(actionStats.bankSum)}</span>
                  </div>
                  <div className="flex justify-between bg-amber-50/60 p-1.5 rounded-lg">
                    <span className="text-neutral-600">QR to'lov:</span>
                    <span className="font-bold text-amber-900">{formatMoney(actionStats.qrSum)}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Berilgan mahsulotlar (Qarzga va Qarzsiz) */}
              <div className="p-3.5 rounded-2xl bg-white border border-neutral-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-rose-600" />
                    <span>Berilgan mahsulotlar summasi</span>
                  </span>
                  <span className="font-mono font-bold text-neutral-900 text-sm">
                    {formatMoney(actionStats.totalDeliveredSum)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-neutral-100 font-mono">
                  <div className="flex justify-between bg-rose-50/70 p-1.5 rounded-lg">
                    <span className="text-rose-900">Qarzga berildi:</span>
                    <span className="font-bold text-rose-900">{formatMoney(actionStats.creditDelivSum)}</span>
                  </div>
                  <div className="flex justify-between bg-emerald-50/70 p-1.5 rounded-lg">
                    <span className="text-emerald-900">To'langan:</span>
                    <span className="font-bold text-emerald-900">{formatMoney(actionStats.paidDelivSum)}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Qaytgan mahsulotlar */}
              <div className="p-3.5 rounded-2xl bg-white border border-neutral-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                    <span>Qaytarilgan mahsulotlar</span>
                  </span>
                  <span className="font-mono font-bold text-amber-900 text-sm">
                    {actionStats.returnedProductsCount} dona / birlik
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500 pt-1 border-t border-neutral-100">
                  Mijozlar tomonidan omborga qaytarilgan va qabul qilingan mahsulotlar hisoboti
                </div>
              </div>
            </div>
          </div>

          {/* 4-Blok Table Mode Switcher & Counter */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-neutral-100/90 border-b border-neutral-200 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-800">Ko'rinish:</span>
              <button
                type="button"
                onClick={() => setActionViewMode('consolidated')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  actionViewMode === 'consolidated'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50'
                }`}
                title="Bitta mijozga belgilangan vaqt oralig'ida necha marta amal bajarilganini bitta qatorda jamlab ko'rsatish"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Mijozlar bo'yicha jamlangan (bitta qilib)</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    actionViewMode === 'consolidated' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-900 font-bold'
                  }`}
                >
                  {consolidatedActionItems.length} ta mijoz
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActionViewMode('detailed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  actionViewMode === 'detailed'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50'
                }`}
                title="Barcha amallarni har bir yozuv bo'yicha alohida ko'rish"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Barcha amallar alohida</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    actionViewMode === 'detailed' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-800'
                  }`}
                >
                  {filteredActionItems.length} ta
                </span>
              </button>
            </div>

            <div className="text-[11px] text-neutral-600 font-medium hidden md:block">
              {actionViewMode === 'consolidated'
                ? `Mijozga bir nechta amal bajarilgan bo'lsa, bitta qatorda nechchi marta bajarilgani aks etadi`
                : `Barcha amallar alohida yozuv sifatida aks etmoqda`}
            </div>
          </div>

          {/* 4-Blok Table */}
          {filteredActionItems.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Activity className="w-10 h-10 text-neutral-300 mx-auto" />
              <h4 className="text-sm font-bold text-neutral-800">
                Ushbu muddat va filtrlar bo'yicha amallar topilmadi
              </h4>
              <p className="text-xs text-neutral-500">
                Sana oralig'ini kengaytirib yoki boshqa amal turini tanlab ko'ring
              </p>
            </div>
          ) : actionViewMode === 'consolidated' ? (
            /* CONSOLIDATED VIEW: Bitta mijozga belgilangan vaqt oralig'ida nechchi marta amal bajarilgani bitta qilib */
            <StickyTableWrapper>
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-rose-50 text-neutral-800 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-20 border-b border-rose-200">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 min-w-[130px]">So'nggi amal vaqti</th>
                    <th className="py-3 px-3 min-w-[110px]">Agent(lar)</th>
                    <th className="py-3 px-3.5 min-w-[170px]">Mijoz va Telefon</th>
                    <th className="py-3 px-3 min-w-[130px]">Hudud</th>
                    <th className="py-3 px-3 min-w-[190px] bg-rose-100/70 text-rose-950">
                      Amal turi va soni (Necha marta)
                    </th>
                    <th className="py-3 px-3.5 text-right bg-emerald-50/80 text-emerald-950 min-w-[140px]">
                      Tushumlar (Turi)
                    </th>
                    <th className="py-3 px-3.5 text-left bg-rose-50/80 text-rose-950 min-w-[180px]">
                      Berilgan mahsulotlar
                    </th>
                    <th className="py-3 px-3.5 text-right min-w-[120px]">
                      Qarzga berildi
                    </th>
                    <th className="py-3 px-3.5 text-right min-w-[120px]">
                      To'langan
                    </th>
                    <th className="py-3 px-3 min-w-[140px]">Qaytgan mahsulotlar</th>
                    <th className="py-3 px-3 min-w-[130px] text-center">Tafsilot</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-150">
                  {consolidatedActionItems.map((item, index) => {
                    const isExpanded = expandedClientKeys.has(item.key);

                    return (
                      <React.Fragment key={item.key}>
                        <tr
                          className={`hover:bg-rose-50/40 transition-colors ${
                            index % 2 === 1 ? 'bg-neutral-50/40' : 'bg-white'
                          } ${isExpanded ? 'bg-rose-50/20' : ''}`}
                        >
                          {/* # */}
                          <td className="py-2.5 px-3 text-center font-mono text-neutral-400">
                            {index + 1}
                          </td>

                          {/* So'nggi amal vaqti */}
                          <td className="py-2.5 px-3">
                            <div className="font-mono text-neutral-800 text-[11px] font-semibold">
                              {item.lastTimestamp ? item.lastTimestamp.replace('T', ' ').slice(0, 16) : '-'}
                            </div>
                            {item.totalActionsCount > 1 && item.firstTimestamp && item.firstTimestamp !== item.lastTimestamp && (
                              <div className="text-[10px] text-neutral-400 font-mono">
                                1-amal: {item.firstTimestamp.replace('T', ' ').slice(0, 10)}
                              </div>
                            )}
                          </td>

                          {/* Agent(lar) */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[130px]">
                              {item.agents.map((ag) => (
                                <span
                                  key={ag}
                                  className="inline-block bg-neutral-100 border border-neutral-200 text-neutral-800 font-bold px-1.5 py-0.5 rounded text-[10px]"
                                >
                                  {getAgentDisplayName(ag)}
                                </span>
                              ))}
                            </div>
                            {item.agents.length > 1 && (
                              <span className="text-[10px] font-bold text-rose-800 block mt-0.5">
                                ({item.agents.length === 2 ? 'ikkala agent' : `${item.agents.length} ta agent`})
                              </span>
                            )}
                          </td>

                          {/* Mijoz va Telefon */}
                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-neutral-900">{item.clientName}</span>
                              {item.totalActionsCount > 1 && (
                                <span className="text-[10px] font-black bg-rose-100 text-rose-900 px-1.5 py-0.2 rounded-full border border-rose-300">
                                  {item.totalActionsCount}x
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-neutral-500">{item.clientPhone}</div>
                          </td>

                          {/* Hudud */}
                          <td className="py-2.5 px-3 text-neutral-700 truncate max-w-[140px]" title={item.clientLocation}>
                            {item.clientLocation}
                          </td>

                          {/* Amal turi va nechchi marta bajarilgani */}
                          <td className="py-2.5 px-3">
                            {item.totalActionsCount > 1 ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  {item.visitCount === item.totalActionsCount ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs">
                                      <MapPin className="w-3.5 h-3.5 text-rose-700" />
                                      <span>Joyiga borildi</span>
                                      <span className="px-2 py-0.2 bg-rose-700 text-white rounded-full text-[10px] font-black tracking-wide">
                                        {item.totalActionsCount} marta
                                      </span>
                                    </span>
                                  ) : item.callCount === item.totalActionsCount ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
                                      <Phone className="w-3.5 h-3.5 text-blue-700" />
                                      <span>Telefon qilindi</span>
                                      <span className="px-2 py-0.2 bg-blue-700 text-white rounded-full text-[10px] font-black tracking-wide">
                                        {item.totalActionsCount} marta
                                      </span>
                                    </span>
                                  ) : item.callAndVisitCount === item.totalActionsCount ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
                                      <Check className="w-3.5 h-3.5 text-purple-700" />
                                      <span>Tel + Joyiga borildi</span>
                                      <span className="px-2 py-0.2 bg-purple-700 text-white rounded-full text-[10px] font-black tracking-wide">
                                        {item.totalActionsCount} marta
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-900 text-white shadow-2xs">
                                      <Layers className="w-3.5 h-3.5 text-rose-400" />
                                      <span>Jami: {item.totalActionsCount} marta amal</span>
                                    </span>
                                  )}
                                </div>

                                {/* Breakdown tags if mixed actions */}
                                {item.visitCount !== item.totalActionsCount &&
                                  item.callCount !== item.totalActionsCount &&
                                  item.callAndVisitCount !== item.totalActionsCount && (
                                    <div className="flex items-center gap-1 flex-wrap text-[10px]">
                                      {item.visitCount > 0 && (
                                        <span className="bg-rose-50 text-rose-900 border border-rose-200 px-1.5 py-0.2 rounded font-semibold">
                                          {item.visitCount}x joyiga
                                        </span>
                                      )}
                                      {item.callCount > 0 && (
                                        <span className="bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.2 rounded font-semibold">
                                          {item.callCount}x telefon
                                        </span>
                                      )}
                                      {item.callAndVisitCount > 0 && (
                                        <span className="bg-purple-50 text-purple-900 border border-purple-200 px-1.5 py-0.2 rounded font-semibold">
                                          {item.callAndVisitCount}x tel+joyiga
                                        </span>
                                      )}
                                    </div>
                                  )}
                              </div>
                            ) : (
                              /* 1 marta amal */
                              <div>
                                {item.rawItems[0]?.actionDone.toLowerCase().includes('telefon') &&
                                item.rawItems[0]?.actionDone.toLowerCase().includes('joyiga') ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                                    <Check className="w-3 h-3 text-purple-700" />
                                    <span>Tel + Joyiga borildi (1 marta)</span>
                                  </span>
                                ) : item.rawItems[0]?.actionDone.toLowerCase().includes('telefon') ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                    <Phone className="w-3 h-3 text-blue-700" />
                                    <span>Telefon qilindi (1 marta)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200">
                                    <MapPin className="w-3 h-3 text-rose-700" />
                                    <span>Joyiga borildi (1 marta)</span>
                                  </span>
                                )}
                                {item.agents.length > 1 && (
                                  <div className="text-[10px] font-semibold text-rose-900 mt-0.5">
                                    ({item.agents.length === 2 ? 'ikkala agent' : `${item.agents.length} ta agent`}: {item.agents.map(getAgentDisplayName).join(', ')})
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Tushumlar */}
                          <td className="py-2.5 px-3.5 text-right font-mono bg-emerald-50/30">
                            {item.totalReceipt > 0 ? (
                              <div className="space-y-0.5">
                                <div className="font-extrabold text-emerald-800 text-xs">
                                  +{formatMoney(item.totalReceipt)}
                                </div>
                                <div className="text-[10px] text-neutral-500">
                                  {[
                                    item.receiptNaqd > 0 ? `Naqd: ${formatMoney(item.receiptNaqd)}` : null,
                                    item.receiptKarta > 0 ? `Karta: ${formatMoney(item.receiptKarta)}` : null,
                                    item.receiptBank > 0 ? `Bank: ${formatMoney(item.receiptBank)}` : null,
                                    item.receiptQr > 0 ? `QR: ${formatMoney(item.receiptQr)}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' | ')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-neutral-300">-</span>
                            )}
                          </td>

                          {/* Berilgan mahsulotlar */}
                          <td className="py-2.5 px-3.5 text-left bg-rose-50/20 max-w-[200px]">
                            {item.deliveredProductsDesc ? (
                              <div
                                className="text-[11px] font-medium text-neutral-900 truncate"
                                title={item.deliveredProductsDesc}
                              >
                                {item.deliveredProductsDesc}
                              </div>
                            ) : (
                              <span className="text-neutral-300">-</span>
                            )}
                          </td>

                          {/* Qarzga berildi */}
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold">
                            {item.deliveredCreditSum > 0 ? (
                              <span className="text-rose-700 font-extrabold">
                                {formatMoney(item.deliveredCreditSum)}
                              </span>
                            ) : (
                              <span className="text-neutral-300">-</span>
                            )}
                          </td>

                          {/* To'langan */}
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold">
                            {item.deliveredPaidSum > 0 ? (
                              <span className="text-emerald-700 font-extrabold">
                                {formatMoney(item.deliveredPaidSum)}
                              </span>
                            ) : (
                              <span className="text-neutral-300">-</span>
                            )}
                          </td>

                          {/* Qaytgan mahsulotlar */}
                          <td className="py-2.5 px-3 max-w-[160px]">
                            {item.returnedProductsDesc ? (
                              <span
                                className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 block truncate"
                                title={item.returnedProductsDesc}
                              >
                                {item.returnedProductsDesc}
                              </span>
                            ) : (
                              <span className="text-neutral-300">-</span>
                            )}
                          </td>

                          {/* Tafsilot tugmasi (Accordion toggle) */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleClientExpand(item.key)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                isExpanded
                                  ? 'bg-rose-700 text-white shadow-2xs'
                                  : 'text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-300'
                              }`}
                              title="Ushbu mijozga qilingan barcha amallar tarixini ko'rish"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {isExpanded
                                  ? 'Yopish'
                                  : item.totalActionsCount > 1
                                  ? `${item.totalActionsCount} ta amal`
                                  : 'Tafsilot'}
                              </span>
                            </button>
                          </td>
                        </tr>

                        {/* Accordion Expanded Sub-Table */}
                        {isExpanded && (
                          <tr className="bg-rose-50/30 border-y border-rose-200">
                            <td colSpan={12} className="p-3 bg-neutral-50/80">
                              <div className="rounded-xl border border-rose-200 bg-white p-3 shadow-xs space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-neutral-800 border-b border-neutral-200 pb-2">
                                  <span className="flex items-center gap-1.5 text-rose-900">
                                    <Activity className="w-4 h-4 text-rose-700" />
                                    <span>
                                      "{item.clientName}" mijoziga belgilangan vaqt oralig'ida bajarilgan{' '}
                                      {item.totalActionsCount} ta amal tarixi:
                                    </span>
                                  </span>
                                  <span className="text-[11px] text-neutral-500 font-normal">
                                    Telefon: {item.clientPhone} | Manzil: {item.clientLocation}
                                  </span>
                                </div>

                                <StickyTableWrapper maxHeightClassName="max-h-64">
                                  <table className="w-full min-w-[760px] text-left text-xs">
                                    <thead className="bg-neutral-100 text-neutral-700 text-[10px] uppercase font-bold border-b border-neutral-200 sticky top-0 z-20">
                                      <tr>
                                        <th className="py-2 px-2.5 w-8">#</th>
                                        <th className="py-2 px-2.5">Sana va Vaqt</th>
                                        <th className="py-2 px-2.5">Agent</th>
                                        <th className="py-2 px-2.5">Bajarilgan amal</th>
                                        <th className="py-2 px-2.5 text-right">Tushum</th>
                                        <th className="py-2 px-2.5">Berilgan mahsulotlar</th>
                                        <th className="py-2 px-2.5 text-right">Qarzga</th>
                                        <th className="py-2 px-2.5 text-right">To'langan</th>
                                        <th className="py-2 px-2.5">Qaytgan mahsulot</th>
                                        <th className="py-2 px-2.5">Hisobot izohi</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-150">
                                      {item.rawItems.map((actItem, actIdx) => (
                                        <tr key={actItem.id} className="hover:bg-neutral-50 text-[11px]">
                                          <td className="py-2 px-2.5 text-neutral-400 font-mono">
                                            {actIdx + 1}
                                          </td>
                                          <td className="py-2 px-2.5 font-mono text-neutral-700">
                                            {actItem.timestamp
                                              ? actItem.timestamp.replace('T', ' ').slice(0, 16)
                                              : '-'}
                                          </td>
                                          <td className="py-2 px-2.5 font-bold text-neutral-800">
                                            <div className="flex flex-wrap gap-1 max-w-[120px]">
                                              {actItem.agents && actItem.agents.length > 1 ? (
                                                actItem.agents.map((ag) => (
                                                  <span
                                                    key={ag}
                                                    className="inline-block bg-neutral-100 border border-neutral-200 text-neutral-800 font-bold px-1.5 py-0.2 rounded text-[10px]"
                                                  >
                                                    {getAgentDisplayName(ag)}
                                                  </span>
                                                ))
                                              ) : (
                                                <span>{getAgentDisplayName(actItem.agentUsername)}</span>
                                              )}
                                            </div>
                                            {actItem.agents && actItem.agents.length > 1 && (
                                              <span className="text-[9px] font-bold text-rose-800 block mt-0.5">
                                                ({actItem.agents.length === 2 ? 'ikkala agent' : `${actItem.agents.length} ta agent`})
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-2.5 font-semibold text-neutral-800">
                                            <span className="inline-block px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200">
                                              {actItem.actionDone} (1 marta)
                                            </span>
                                            {actItem.agents && actItem.agents.length > 1 && (
                                              <span className="text-[10px] text-rose-900 font-semibold block mt-0.5">
                                                ({actItem.agents.length === 2 ? 'ikkala agent' : `${actItem.agents.length} ta agent`}: {actItem.agents.map(getAgentDisplayName).join(', ')})
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-800">
                                            {actItem.totalReceipt > 0
                                              ? `+${formatMoney(actItem.totalReceipt)}`
                                              : '-'}
                                          </td>
                                          <td
                                            className="py-2 px-2.5 text-neutral-700 max-w-[200px] truncate"
                                            title={actItem.deliveredProductsDesc}
                                          >
                                            {actItem.deliveredProductsDesc || '-'}
                                          </td>
                                          <td className="py-2 px-2.5 text-right font-mono text-rose-700 font-semibold">
                                            {actItem.deliveredCreditSum > 0
                                              ? formatMoney(actItem.deliveredCreditSum)
                                              : '-'}
                                          </td>
                                          <td className="py-2 px-2.5 text-right font-mono text-emerald-700 font-semibold">
                                            {actItem.deliveredPaidSum > 0
                                              ? formatMoney(actItem.deliveredPaidSum)
                                              : '-'}
                                          </td>
                                          <td className="py-2 px-2.5 text-amber-800">
                                            {actItem.returnedProductsDesc || '-'}
                                          </td>
                                          <td
                                            className="py-2 px-2.5 text-neutral-600 max-w-[180px] truncate"
                                            title={actItem.note}
                                          >
                                            {actItem.note || '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </StickyTableWrapper>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>

                {/* Table Footer: Total Row */}
                <tfoot className="bg-rose-50/90 border-t-2 border-rose-200 font-bold sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={6} className="py-3 px-3.5 text-right text-neutral-900 uppercase tracking-wider text-[11px]">
                      JAMI ({consolidatedActionItems.length} ta mijoz, {filteredActionItems.length} ta amal):
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-xs sm:text-sm text-emerald-950 font-extrabold bg-emerald-100/90">
                      +{formatMoney(actionStats.totalReceipts)}
                    </td>
                    <td className="py-3 px-3.5 text-left text-[11px] text-neutral-700 font-normal">
                      Jami mahsulot summasi: {formatMoney(actionStats.totalDeliveredSum)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-xs sm:text-sm text-rose-950 font-extrabold">
                      {formatMoney(actionStats.creditDelivSum)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-xs sm:text-sm text-emerald-950 font-extrabold">
                      {formatMoney(actionStats.paidDelivSum)}
                    </td>
                    <td className="py-3 px-3 text-neutral-800 font-mono text-[11px]">
                      {actionStats.returnedProductsCount > 0 ? `${actionStats.returnedProductsCount} dona qaytdi` : '-'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </StickyTableWrapper>
          ) : (
            /* DETAILED VIEW: Barcha amallar alohida */
            <StickyTableWrapper>
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-rose-50 text-neutral-800 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-20 border-b border-rose-200">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 min-w-[125px]">Sana va Vaqt</th>
                    <th className="py-3 px-3 min-w-[100px]">Agent</th>
                    <th className="py-3 px-3.5 min-w-[160px]">Mijoz va Telefon</th>
                    <th className="py-3 px-3 min-w-[130px]">Hudud</th>
                    <th className="py-3 px-3 min-w-[150px]">Amal turi</th>
                    <th className="py-3 px-3.5 text-right bg-emerald-50/80 text-emerald-950 min-w-[140px]">
                      Tushumlar (Turi)
                    </th>
                    <th className="py-3 px-3.5 text-left bg-rose-50/80 text-rose-950 min-w-[180px]">
                      Berilgan mahsulotlar
                    </th>
                    <th className="py-3 px-3.5 text-right min-w-[120px]">
                      Qarzga berildi
                    </th>
                    <th className="py-3 px-3.5 text-right min-w-[120px]">
                      To'langan
                    </th>
                    <th className="py-3 px-3 min-w-[140px]">Qaytgan mahsulotlar</th>
                    <th className="py-3 px-3 min-w-[140px]">Hisobot izohi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-150">
                  {filteredActionItems.map((item, index) => {
                    const actLower = item.actionDone.toLowerCase();
                    const isCall = actLower.includes('telefon') && !actLower.includes('joyiga');
                    const isVisit = actLower.includes('joyiga') && !actLower.includes('telefon');
                    const isBoth = actLower.includes('telefon') && actLower.includes('joyiga');

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-rose-50/30 transition-colors ${
                          index % 2 === 1 ? 'bg-neutral-50/40' : 'bg-white'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-neutral-400">
                          {index + 1}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-neutral-600 text-[11px]">
                          {item.timestamp ? item.timestamp.replace('T', ' ').slice(0, 16) : '-'}
                        </td>

                        <td className="py-2.5 px-3 font-bold text-neutral-800">
                          <div className="flex flex-wrap gap-1 max-w-[130px]">
                            {item.agents && item.agents.length > 1 ? (
                              item.agents.map((ag) => (
                                <span
                                  key={ag}
                                  className="inline-block bg-neutral-100 border border-neutral-200 text-neutral-800 font-bold px-1.5 py-0.5 rounded text-[10px]"
                                >
                                  {getAgentDisplayName(ag)}
                                </span>
                              ))
                            ) : (
                              <span>{getAgentDisplayName(item.agentUsername)}</span>
                            )}
                          </div>
                          {item.agents && item.agents.length > 1 && (
                            <span className="text-[10px] font-bold text-rose-800 block mt-0.5">
                              ({item.agents.length === 2 ? 'ikkala agent' : `${item.agents.length} ta agent`})
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3.5">
                          <div className="font-bold text-neutral-900">{item.clientName}</div>
                          <div className="text-[11px] font-mono text-neutral-500">{item.clientPhone}</div>
                        </td>

                        <td className="py-2.5 px-3 text-neutral-700 truncate max-w-[140px]" title={item.clientLocation}>
                          {item.clientLocation}
                        </td>

                        {/* Amal turi badge */}
                        <td className="py-2.5 px-3">
                          <div>
                            {isBoth ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                                <Check className="w-3 h-3 text-purple-700" />
                                <span>Tel + Joyiga borildi (1 marta)</span>
                              </span>
                            ) : isCall ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                <Phone className="w-3 h-3 text-blue-700" />
                                <span>Telefon qilindi (1 marta)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200">
                                <MapPin className="w-3 h-3 text-rose-700" />
                                <span>Joyiga borildi (1 marta)</span>
                              </span>
                            )}
                          </div>
                          {item.agents && item.agents.length > 1 && (
                            <div className="text-[10px] font-semibold text-rose-900 mt-0.5">
                              ({item.agents.length === 2 ? 'ikkala agent' : `${item.agents.length} ta agent`}: {item.agents.map(getAgentDisplayName).join(', ')})
                            </div>
                          )}
                        </td>

                        {/* Tushumlar to'lov turi bo'yicha */}
                        <td className="py-2.5 px-3.5 text-right font-mono bg-emerald-50/30">
                          {item.totalReceipt > 0 ? (
                            <div className="space-y-0.5">
                              <div className="font-extrabold text-emerald-800 text-xs">
                                +{formatMoney(item.totalReceipt)}
                              </div>
                              <div className="text-[10px] text-neutral-500">
                                {[
                                  item.receiptNaqd > 0 ? `Naqd: ${formatMoney(item.receiptNaqd)}` : null,
                                  item.receiptKarta > 0 ? `Karta: ${formatMoney(item.receiptKarta)}` : null,
                                  item.receiptBank > 0 ? `Bank: ${formatMoney(item.receiptBank)}` : null,
                                  item.receiptQr > 0 ? `QR: ${formatMoney(item.receiptQr)}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(' | ')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* Berilgan mahsulotlar */}
                        <td className="py-2.5 px-3.5 text-left bg-rose-50/20 max-w-[200px]">
                          {item.deliveredProductsDesc ? (
                            <div className="text-[11px] font-medium text-neutral-900 truncate" title={item.deliveredProductsDesc}>
                              {item.deliveredProductsDesc}
                            </div>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* Qarzga berildi summa */}
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold">
                          {item.deliveredCreditSum > 0 ? (
                            <span className="text-rose-700 font-extrabold">
                              {formatMoney(item.deliveredCreditSum)}
                            </span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* To'langan summa */}
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold">
                          {item.deliveredPaidSum > 0 ? (
                            <span className="text-emerald-700 font-extrabold">
                              {formatMoney(item.deliveredPaidSum)}
                            </span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* Qaytgan mahsulotlar */}
                        <td className="py-2.5 px-3 max-w-[160px]">
                          {item.returnedProductsDesc ? (
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 block truncate" title={item.returnedProductsDesc}>
                              {item.returnedProductsDesc}
                            </span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* Izoh */}
                        <td className="py-2.5 px-3 max-w-[160px] text-neutral-600 text-[11px] truncate" title={item.note}>
                          {item.note || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer: Total Row */}
                <tfoot className="bg-rose-50/90 border-t-2 border-rose-200 font-bold sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={6} className="py-3 px-3.5 text-right text-neutral-900 uppercase tracking-wider text-[11px]">
                      JAMI ({filteredActionItems.length} ta amal):
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-xs sm:text-sm text-emerald-950 font-extrabold bg-emerald-100/90">
                      +{formatMoney(actionStats.totalReceipts)}
                    </td>
                    <td className="py-3 px-3.5 text-left text-[11px] text-neutral-700 font-normal">
                      Jami mahsulot summasi: {formatMoney(actionStats.totalDeliveredSum)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-xs sm:text-sm text-rose-950 font-extrabold">
                      {formatMoney(actionStats.creditDelivSum)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-xs sm:text-sm text-emerald-950 font-extrabold">
                      {formatMoney(actionStats.paidDelivSum)}
                    </td>
                    <td className="py-3 px-3 text-neutral-800 font-mono text-[11px]">
                      {actionStats.returnedProductsCount > 0 ? `${actionStats.returnedProductsCount} dona qaytdi` : '-'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </StickyTableWrapper>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5-BLOK: TO'LOVLAR VA KONVERTATSIYA TAHLILI                */}
      {/* ========================================================= */}
      {activeBlockView === 'block5' && (
        <div className="bg-white rounded-3xl border border-amber-200 shadow-xs overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-900 via-amber-800 to-neutral-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center shadow-xs font-extrabold">
                  <Calculator className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-xl font-bold font-display tracking-tight text-white">
                  5-Blok: To'lovlar va konvertatsiya tahlili
                </h2>
              </div>
              <p className="text-xs text-amber-100/90">
                Qabul qilingan barcha to'lovlar va mahsulot to'lovlari (konvertatsiya bilan + va konvertatsiyasiz -) jadvali
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportB5Excel}
                disabled={isExportingB5 || filteredB5Items.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[40px] cursor-pointer shrink-0"
              >
                <Download className={`w-4 h-4 ${isExportingB5 ? 'animate-bounce' : ''}`} />
                <span>{isExportingB5 ? 'Yuklanmoqda...' : '5-Blok Excel (.xlsx)'}</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards: 1. So'm | 2. Dollar (Konvertatsiya bilan va Konvertatsiyasiz) */}
          <div className="p-4 bg-amber-50/40 border-b border-amber-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-xs font-extrabold text-amber-900 uppercase">So'm</div>
                <div className="text-lg sm:text-xl font-extrabold font-mono text-amber-800 mt-1">
                  {new Intl.NumberFormat('uz-UZ').format(b5Stats.totalUzs)} so'm
                </div>
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">
                Tanlangan vaqt / jadval bo'yicha qabul qilingan so'm ustuni jami summasi
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-emerald-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-emerald-900 uppercase">Dollar</div>
                <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-800">
                  {formatMoney(b5Stats.totalUsd)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-emerald-100 text-xs">
                <div className="px-2.5 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200/80">
                  <span className="text-[10px] font-bold text-amber-900 block">
                    Konvertatsiya bilan (+):
                  </span>
                  <span className="font-mono font-extrabold text-amber-950 text-xs sm:text-sm">
                    {formatMoney(b5Stats.convertedUsd)}
                  </span>
                </div>
                <div className="px-2.5 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[10px] font-bold text-neutral-600 block">
                    Konvertatsiyasiz (-):
                  </span>
                  <span className="font-mono font-extrabold text-neutral-900 text-xs sm:text-sm">
                    {formatMoney(b5Stats.nonConvertedUsd)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Panel */}
          <div className="p-4 bg-neutral-50 border-b border-neutral-200 space-y-3">
            {/* Row 1: Date range presets + Custom Start/End Date + Purpose buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-neutral-700 flex items-center gap-1 mr-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-700" />
                  <span>Vaqt oralig'i:</span>
                </span>
                {(
                  [
                    { id: 'all', label: 'Barcha vaqt' },
                    { id: 'today', label: 'Bugun' },
                    { id: 'yesterday', label: 'Kecha' },
                    { id: 'last7', label: 'Oxirgi 7 kun' },
                    { id: 'thisMonth', label: 'Shu oy' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleB5DatePresetChange(p.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      b5DatePreset === p.id
                        ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-amber-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Maxsus sana oralig'i: Dan — Gacha */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-neutral-300">
                  <span className="text-[11px] font-bold text-neutral-600">Dan:</span>
                  <input
                    type="date"
                    value={b5StartDate}
                    onChange={(e) => {
                      setB5StartDate(e.target.value);
                      setB5DatePreset('custom');
                    }}
                    className="text-xs font-mono font-bold text-neutral-900 outline-none bg-transparent cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-neutral-300">
                  <span className="text-[11px] font-bold text-neutral-600">Gacha:</span>
                  <input
                    type="date"
                    value={b5EndDate}
                    onChange={(e) => {
                      setB5EndDate(e.target.value);
                      setB5DatePreset('custom');
                    }}
                    className="text-xs font-mono font-bold text-neutral-900 outline-none bg-transparent cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Purpose Filter (Barchasi | Shunchaki to'lov | Mahsulot uchun) */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-bold text-neutral-700">To'lov maqsadi:</span>
              <button
                type="button"
                onClick={() => setB5PurposeFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  b5PurposeFilter === 'all'
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                Barchasi ({allUzsConversionItems.length})
              </button>
              <button
                type="button"
                onClick={() => setB5PurposeFilter('payment')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                  b5PurposeFilter === 'payment'
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Shunchaki to'lov</span>
              </button>
              <button
                type="button"
                onClick={() => setB5PurposeFilter('product')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                  b5PurposeFilter === 'product'
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-white text-purple-800 border-purple-200 hover:bg-purple-50'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Mahsulot uchun</span>
              </button>
            </div>

            {/* Row 3: Search, Method filter, Author (Kim qo'shgani) filter, Sort */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Mijoz ismi, tel, mahsulot yoki izoh..."
                  value={b5Search}
                  onChange={(e) => setB5Search(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-neutral-300 focus:border-amber-600 outline-none"
                />
              </div>

              <select
                value={b5AuthorFilter}
                onChange={(e) => setB5AuthorFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-amber-600 outline-none cursor-pointer"
              >
                <option value="all">Kim qo'shgani: Barchasi ({uniqueB5Authors.length})</option>
                {uniqueB5Authors.map((a) => (
                  <option key={a} value={a}>
                    Qo'shgan: {getAgentDisplayName(a)} (@{a})
                  </option>
                ))}
              </select>

              <select
                value={b5MethodFilter}
                onChange={(e) => setB5MethodFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-amber-600 outline-none cursor-pointer"
              >
                <option value="all">Barcha to'lov turlari</option>
                <option value="naqd">Naqd pul</option>
                <option value="karta">Karta o'tkazmasi</option>
                <option value="bank">Bank o'tkazmasi</option>
                <option value="qr">QR to'lov</option>
              </select>

              <select
                value={b5SortMode}
                onChange={(e) => setB5SortMode(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-amber-600 outline-none cursor-pointer"
              >
                <option value="date_desc">Sana: Yangidan eskiga</option>
                <option value="date_asc">Sana: Eskidan yangiga</option>
                <option value="uzs_desc">So'm miqdori: Ko'pdan kamga</option>
                <option value="usd_desc">Dollar qiymati: Ko'pdan kamga</option>
                <option value="rate_desc">Kurs: Yuqoridan pastga</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {filteredB5Items.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
                <Calculator className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-neutral-800">
                Tanlangan filtrlar bo'yicha to'lovlar topilmadi
              </div>
            </div>
          ) : (
            <StickyTableWrapper>
              <table className="w-full min-w-[1150px] text-left text-xs">
                <thead className="bg-amber-50 border-b border-amber-200 text-neutral-800 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-20">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3">Sana va Mijoz</th>
                    <th className="py-3 px-3 text-center">Shunchaki to'lov yoki Mahsulot uchun</th>
                    <th className="py-3 px-3 text-center">To'lov usuli</th>
                    <th className="py-3 px-3 text-center">Konvertatsiya bo'lgan yoki yo'q</th>
                    <th className="py-3 px-3.5 text-right text-amber-950">Qabul qilingan so'm miqdori</th>
                    <th className="py-3 px-3 text-right text-neutral-800">Kurs</th>
                    <th className="py-3 px-3.5 text-right text-emerald-950">Dollar qiymati</th>
                    <th className="py-3 px-3 text-center">Kim qo'shgani</th>
                    <th className="py-3 px-3">Izoh / Mahsulotlar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150">
                  {filteredB5Items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={
                        idx % 2 === 1
                          ? 'bg-neutral-50/50 hover:bg-amber-50/30'
                          : 'bg-white hover:bg-amber-50/30'
                      }
                    >
                      <td className="py-3 px-3 text-center font-mono font-bold text-neutral-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-neutral-900">{item.clientName}</div>
                        <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>{formatDate(item.timestamp)}</span>
                          {item.clientPhone && <span>• {item.clientPhone}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.purpose === 'product' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[11px]">
                            <ShoppingBag className="w-3 h-3" />
                            <span>Mahsulot uchun</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[11px]">
                            <Coins className="w-3 h-3" />
                            <span>Shunchaki to'lov</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-800 font-semibold text-[11px]">
                          {item.paymentMethodLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.isConverted ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-mono font-black text-sm">
                            +
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neutral-100 text-neutral-600 border border-neutral-300 font-mono font-black text-sm">
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-extrabold text-amber-900 text-xs sm:text-sm">
                        {item.isConverted
                          ? `${new Intl.NumberFormat('uz-UZ').format(item.amountUzs)} so'm`
                          : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-neutral-700">
                        {item.isConverted
                          ? `${new Intl.NumberFormat('uz-UZ').format(item.exchangeRate)} so'm`
                          : '-'}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/40 text-xs sm:text-sm">
                        {formatMoney(item.amountUsd)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-900 border border-rose-200 font-bold text-[11px]">
                          @{item.author}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-[260px]">
                        {item.productsSummary && (
                          <div className="text-[11px] font-semibold text-purple-900 truncate" title={item.productsSummary}>
                            Mahsulot: {item.productsSummary}
                          </div>
                        )}
                        <div className="text-[11px] text-neutral-600 truncate" title={item.note}>
                          {item.note || '-'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-amber-50/90 border-t-2 border-amber-200 font-bold sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={5} className="py-3 px-3.5 text-right text-neutral-900 uppercase tracking-wider text-[11px]">
                      JAMI:
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-xs sm:text-sm text-amber-950 font-extrabold">
                      {new Intl.NumberFormat('uz-UZ').format(b5Stats.totalUzs)} so'm
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[11px] text-neutral-700">
                      -
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-xs sm:text-sm text-emerald-950 font-extrabold bg-emerald-100/90">
                      {formatMoney(b5Stats.totalUsd)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </StickyTableWrapper>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 6-BLOK: MIJOZLAR BO'YICHA KUNLIK BAJARILIB YOPILGAN AMALLAR MATRITSASI (MAKS. 31 KUN) */}
      {/* ========================================================= */}
      {activeBlockView === 'block6' && (
        <div className="bg-white rounded-3xl border border-teal-200 shadow-xs overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className="w-8 h-8 rounded-xl bg-teal-400 text-slate-950 flex items-center justify-center shadow-xs font-extrabold">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-xl font-bold font-display tracking-tight text-white">
                  6-Blok: Mijozlar bo'yicha kunlik bajarib yopilgan amallar matritsasi
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-teal-400/20 text-teal-200 border border-teal-400/30">
                  Maksimal: 31 kun ({b6DatesList.length} kun tanlangan)
                </span>
              </div>
              <p className="text-xs text-teal-100/90">
                Birinchi ustunda barcha mijozlar ro'yxati va yuqori qatorda tanlangan kunlar bittalab ko'rsatiladi: <strong className="text-white">t</strong> — telefon qilindi, <strong className="text-white">b</strong> — joyiga borildi, <strong className="text-white">t+b</strong> — ikkalasi ham bajarib yopilgan
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15">
                <div className="text-[10px] text-teal-200 uppercase font-semibold">Tanlangan kunlar</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-white">
                  {b6DatesList.length} kun <span className="text-[10px] text-teal-300 font-normal">(maks. 31)</span>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15">
                <div className="text-[10px] text-emerald-200 uppercase font-semibold">Bajarib yopilgan</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-emerald-300">
                  {b6SummaryStats.totalActions} ta amal
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportB6Excel}
                disabled={isExportingB6 || b6MatrixRows.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[40px] cursor-pointer shrink-0"
              >
                <Download className={`w-4 h-4 ${isExportingB6 ? 'animate-bounce' : ''}`} />
                <span>{isExportingB6 ? 'Yuklanmoqda...' : '6-Blok Excel (.xlsx)'}</span>
              </button>
            </div>
          </div>

          {/* 31-day limit warning banner if triggered */}
          {b6LimitWarning && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-xs font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{b6LimitWarning}</span>
            </div>
          )}

          {/* KPI Summary Cards & Legend */}
          <div className="p-4 bg-teal-50/40 border-b border-teal-100 grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3 rounded-2xl bg-white border border-teal-200/80 shadow-2xs">
              <div className="text-[11px] font-bold text-neutral-500 uppercase">Ro'yxatdagi mijozlar</div>
              <div className="text-base sm:text-lg font-extrabold font-mono text-neutral-900 mt-0.5">
                {b6SummaryStats.totalClients} ta
              </div>
              <div className="text-[11px] text-teal-800 font-medium mt-0.5">
                Amal bajarilgan: <strong>{b6SummaryStats.clientsWithActions} ta</strong> mijoz
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-blue-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-900 uppercase">Telefon bilan (t)</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-mono font-extrabold text-xs border border-blue-300">
                  t
                </span>
              </div>
              <div className="text-base sm:text-lg font-extrabold font-mono text-blue-800 mt-0.5">
                {b6SummaryStats.totalT} ta
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Telefon qilindi va yopildi</div>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-purple-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-900 uppercase">Joyiga borish (b)</span>
                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-mono font-extrabold text-xs border border-purple-300">
                  b
                </span>
              </div>
              <div className="text-base sm:text-lg font-extrabold font-mono text-purple-800 mt-0.5">
                {b6SummaryStats.totalB} ta
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Joyiga borildi va yopildi</div>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-emerald-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-900 uppercase">Ikkalasi ham (t+b)</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-mono font-extrabold text-xs border border-emerald-300">
                  t+b
                </span>
              </div>
              <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-800 mt-0.5">
                {b6SummaryStats.totalTB} ta
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Telefon + Joyiga borib yopildi</div>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs col-span-2 lg:col-span-1">
              <div className="text-[11px] font-bold text-neutral-600 uppercase">Jami bajarib yopilgan</div>
              <div className="text-base sm:text-lg font-extrabold font-mono text-teal-900 mt-0.5">
                {b6SummaryStats.totalActions} ta
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {b6DatesList.length} kunlik davr ichida
              </div>
            </div>
          </div>

          {/* Filter Panel */}
          <div className="p-4 bg-neutral-50 border-b border-neutral-200 space-y-3">
            {/* Row 1: Date range presets + Custom Start/End Date (max 31 days) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-neutral-700 flex items-center gap-1 mr-1">
                  <Calendar className="w-3.5 h-3.5 text-teal-700" />
                  <span>Vaqt oralig'i (maks. 31 kun):</span>
                </span>
                {(
                  [
                    { id: 'thisMonth', label: 'Shu oy (maks. 31 kun)' },
                    { id: 'last7', label: 'Oxirgi 7 kun' },
                    { id: 'last15', label: 'Oxirgi 15 kun' },
                    { id: 'last31', label: 'Oxirgi 31 kun' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleB6PresetChange(p.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      b6DatePreset === p.id
                        ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-teal-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Maxsus sana oralig'i: Dan — Gacha (Max 31 kun) */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-teal-300 shadow-2xs">
                  <span className="text-[11px] font-bold text-teal-800">Dan:</span>
                  <input
                    type="date"
                    value={b6StartDate}
                    onChange={(e) => handleB6StartChange(e.target.value)}
                    className="text-xs font-mono font-bold text-neutral-900 outline-none bg-transparent cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-teal-300 shadow-2xs">
                  <span className="text-[11px] font-bold text-teal-800">Gacha:</span>
                  <input
                    type="date"
                    value={b6EndDate}
                    onChange={(e) => handleB6EndChange(e.target.value)}
                    className="text-xs font-mono font-bold text-neutral-900 outline-none bg-transparent cursor-pointer"
                  />
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-teal-100 text-teal-900 border border-teal-300 text-xs font-mono font-bold">
                  {b6DatesList.length} / 31 kun
                </span>
              </div>
            </div>

            {/* Row 2: Search, Agent filter, Mark filter (t / b / t+b), Client display mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Mijoz ismi, kodi, telefoni yoki manzili..."
                  value={b6Search}
                  onChange={(e) => setB6Search(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-neutral-300 focus:border-teal-600 outline-none"
                />
              </div>

              <select
                value={b6AgentFilter}
                onChange={(e) => setB6AgentFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-teal-600 outline-none cursor-pointer"
              >
                <option value="all">Barcha agentlar tomonidan yopilganlar</option>
                <option value="agentc1">Eldorbek (@agentc1)</option>
                <option value="agentp1">Mirsaid (@agentp1)</option>
                <option value="adminc">Administrator (@adminc)</option>
              </select>

              <select
                value={b6MarkFilter}
                onChange={(e) => setB6MarkFilter(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-teal-600 outline-none cursor-pointer"
              >
                <option value="all">Barcha amaliyot turlari (t, b, t+b)</option>
                <option value="t">Faqat "t" — Telefon qilindi</option>
                <option value="b">Faqat "b" — Joyiga borildi</option>
                <option value="t+b">Faqat "t+b" — Telefon + Joyiga borildi</option>
              </select>

              <select
                value={b6ClientShowMode}
                onChange={(e) => setB6ClientShowMode(e.target.value as 'all' | 'active_only')}
                className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-teal-600 outline-none cursor-pointer"
              >
                <option value="all">Barcha mijozlar ro'yxati ({internalClients.length} ta)</option>
                <option value="active_only">
                  Faqat shu kunlarda amaliyot bajarilgan mijozlar ({b6SummaryStats.clientsWithActions} ta)
                </option>
              </select>
            </div>
          </div>

          {/* Matrix Table */}
          {b6MatrixRows.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-neutral-800">
                Tanlangan filtr bo'yicha mijozlar topilmadi
              </div>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Filtrlarni tozalab barcha mijozlar ro'yxatini ko'rishingiz mumkin.
              </p>
            </div>
          ) : (
            <StickyTableWrapper>
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-teal-50 border-b-2 border-teal-200 text-neutral-800 font-bold text-[11px] sticky top-0 z-20">
                  <tr>
                    <th className="py-2.5 px-2.5 w-10 text-center border-r border-teal-200 bg-teal-50 sticky left-0 z-30">
                      №
                    </th>
                    <th className="py-2.5 px-3 min-w-[230px] max-w-[280px] border-r-2 border-teal-300 bg-teal-50 sticky left-10 z-30 shadow-2xs">
                      Mijozlar ro'yxati ({b6MatrixRows.length} ta)
                    </th>
                    {b6DatesList.map((dStr) => {
                      const parts = dStr.split('-');
                      const dayNum = parts[2] || dStr;
                      const monthNum = parts[1] || '';
                      const dayTotal = b6SummaryStats.perDayTotals[dStr]?.total || 0;
                      return (
                        <th
                          key={dStr}
                          title={`Sana: ${dayNum}.${monthNum}.${parts[0]} — Jami bajarilgan: ${dayTotal} ta`}
                          className="py-2 px-1.5 min-w-[46px] text-center border-r border-teal-200/80 font-mono"
                        >
                          <div className="text-[11px] font-extrabold text-teal-950 leading-tight">
                            {dayNum}.{monthNum}
                          </div>
                          {dayTotal > 0 ? (
                            <div className="text-[9px] font-bold text-emerald-700 bg-emerald-100/90 rounded px-1 mt-0.5 inline-block">
                              {dayTotal} ta
                            </div>
                          ) : (
                            <div className="text-[9px] font-normal text-neutral-400 mt-0.5">-</div>
                          )}
                        </th>
                      );
                    })}
                    <th className="py-2.5 px-3 min-w-[80px] text-center bg-teal-100/80 text-teal-950 border-l-2 border-teal-300">
                      Jami (kun)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {b6MatrixRows.map((row, idx) => {
                    const isEven = idx % 2 === 0;
                    const stickyBg = isEven ? 'bg-white' : 'bg-neutral-50';
                    return (
                      <tr
                        key={row.clientId}
                        className={`${
                          isEven ? 'bg-white' : 'bg-neutral-50/70'
                        } hover:bg-teal-50/40 transition-colors`}
                      >
                        <td
                          className={`py-2 px-2 text-center font-mono text-[11px] font-semibold text-neutral-500 border-r border-neutral-200 sticky left-0 z-10 ${stickyBg}`}
                        >
                          {idx + 1}
                        </td>
                        <td
                          className={`py-2 px-3 border-r-2 border-teal-200 sticky left-10 z-10 ${stickyBg} max-w-[280px]`}
                        >
                          <div className="font-bold text-neutral-900 truncate" title={row.clientName}>
                            {row.clientName}
                          </div>
                          {row.clientPhone && (
                            <div className="text-[10px] text-neutral-500 font-mono truncate">
                              {row.clientPhone}
                            </div>
                          )}
                        </td>
                        {b6DatesList.map((dStr) => {
                          const mark = row.dailyMarks[dStr];
                          const agentInfo = row.dailyAgents?.[dStr] || '';
                          return (
                            <td
                              key={dStr}
                              title={
                                mark
                                  ? `${row.clientName} | Sana: ${dStr} | Amal: ${
                                      mark === 't+b'
                                        ? 'Telefon + Joyiga borildi (t+b)'
                                        : mark === 'b'
                                        ? 'Joyiga borildi (b)'
                                        : 'Telefon qilindi (t)'
                                    }${agentInfo ? ` | Agent: ${agentInfo}` : ''}`
                                  : `${row.clientName} (${dStr}): amal qayd etilmagan`
                              }
                              className="py-1.5 px-1 text-center border-r border-neutral-200/80 font-mono align-middle"
                            >
                              {mark === 't+b' ? (
                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[11px] shadow-2xs">
                                  t+b
                                </span>
                              ) : mark === 'b' ? (
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 font-extrabold text-[11px] shadow-2xs">
                                  b
                                </span>
                              ) : mark === 't' ? (
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-300 font-extrabold text-[11px] shadow-2xs">
                                  t
                                </span>
                              ) : (
                                <span className="text-neutral-300 text-[10px]">·</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-2.5 text-center font-mono font-bold border-l-2 border-teal-200 bg-teal-50/30">
                          {row.totalActiveDays > 0 ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-teal-100 text-teal-900 border border-teal-300 text-xs font-extrabold">
                              {row.totalActiveDays}
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-[11px]">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-teal-50/95 border-t-2 border-teal-300 font-bold sticky bottom-0 z-20">
                  <tr>
                    <td
                      colSpan={2}
                      className="py-2.5 px-3 text-right text-teal-950 uppercase tracking-wider text-[11px] border-r-2 border-teal-300 sticky left-0 z-30 bg-teal-100"
                    >
                      JAMI KUNLIK BAJARILGANLAR:
                    </td>
                    {b6DatesList.map((dStr) => {
                      const dayStat = b6SummaryStats.perDayTotals[dStr];
                      const cnt = dayStat?.total || 0;
                      return (
                        <td
                          key={dStr}
                          title={`t: ${dayStat?.t || 0} ta, b: ${dayStat?.b || 0} ta, t+b: ${dayStat?.tb || 0} ta`}
                          className="py-2 px-1 text-center font-mono text-xs border-r border-teal-200"
                        >
                          {cnt > 0 ? (
                            <span className="font-extrabold text-teal-900">{cnt}</span>
                          ) : (
                            <span className="text-neutral-400 text-[10px]">0</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-center font-mono text-xs sm:text-sm font-extrabold text-emerald-950 bg-emerald-100 border-l-2 border-teal-300">
                      {b6SummaryStats.totalActions}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </StickyTableWrapper>
          )}
        </div>
      )}

      {/* Tasdiqlash modali: Mahsulotni ombordan o'chirish */}
      {confirmDeleteWarehouseProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-200 shrink-0">
                <Trash2 className="w-6 h-6 text-rose-700" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-neutral-900">
                  Mahsulotni o'chirish
                </h3>
                <p className="text-xs text-neutral-500">
                  Ombor zaxirasi va butun bazadan o'chirish
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-950 space-y-2">
              <p className="font-semibold text-neutral-900 text-sm">
                Ushbu mahsulotni ombordan o'chirib yuborishga ishonchingiz komilmi?
              </p>
              <div className="p-2.5 rounded-xl bg-white border border-rose-200/80 space-y-1">
                <div className="font-bold text-neutral-900">
                  {confirmDeleteWarehouseProduct.brand} — {confirmDeleteWarehouseProduct.name}
                </div>
                <div className="text-neutral-600 flex items-center gap-2">
                  <span>Ombor qoldig'i:</span>
                  <strong className="text-emerald-800 font-mono">
                    {confirmDeleteWarehouseProduct.totalPieces.toLocaleString()} dona
                  </strong>
                  {confirmDeleteWarehouseProduct.packageUnitName && (confirmDeleteWarehouseProduct.piecesPerPackage || 1) > 1 && (
                    <span className="text-neutral-500">
                      ({Math.floor(confirmDeleteWarehouseProduct.totalPieces / (confirmDeleteWarehouseProduct.piecesPerPackage || 1))} {confirmDeleteWarehouseProduct.packageUnitName})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-rose-800 font-bold pt-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Ushbu amal qaytarilmaydi va mahsulot butun bazadan to'liq o'chiriladi.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteWarehouseProduct(null)}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 min-h-[42px] cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = confirmDeleteWarehouseProduct.id;
                  setConfirmDeleteWarehouseProduct(null);
                  if (onDeleteWarehouseProduct) {
                    onDeleteWarehouseProduct(id);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs min-h-[42px] flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ha, o'chirilsin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ProductDeliveryHistoryModal
        isOpen={!!historyProduct}
        onClose={() => setHistoryProduct(null)}
        product={historyProduct}
        dailyPlans={internalPlans}
        clients={internalClients}
      />
    </div>
  );
};
