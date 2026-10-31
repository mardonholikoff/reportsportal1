import React, { useState, useMemo } from 'react';
import { WarehouseProduct, Client, DailyPlanItem } from '../types';
import { storageService } from '../services/storage';
import { formatNumber, formatMoney, formatDate } from '../utils/format';
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
  Package,
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
} from 'lucide-react';

interface Props {
  clients?: Client[];
  dailyPlans?: DailyPlanItem[];
  warehouseProducts?: WarehouseProduct[];
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
}) => {
  // Navigation between blocks: 'all' | 'block1' | 'block2' | 'block3' | 'block4'
  const [activeBlockView, setActiveBlockView] = useState<'all' | 'block1' | 'block2' | 'block3' | 'block4'>('all');

  // =========================================================================
  // 1-BLOK DATA & STATES (Ombordagi mahsulotlar soni tahliliy jadvali)
  // =========================================================================
  const [internalProducts, setInternalProducts] = useState<WarehouseProduct[]>(() =>
    propProducts && propProducts.length > 0 ? propProducts : storageService.getWarehouseProducts()
  );

  React.useEffect(() => {
    if (propProducts && propProducts.length > 0) {
      setInternalProducts(propProducts);
    } else {
      setInternalProducts(storageService.getWarehouseProducts());
    }
  }, [propProducts]);

  const [stockSearch, setStockSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [stockSortMode, setStockSortMode] = useState<StockSortMode>('desc');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('all');
  const [isExportingStock, setIsExportingStock] = useState(false);

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
      if (stockSearch.trim()) {
        const q = stockSearch.toLowerCase().trim();
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

      const pieces = p.totalPieces || 0;
      if (stockStatusFilter === 'in_stock' && pieces <= 0) return false;
      if (stockStatusFilter === 'low_stock' && (pieces <= 0 || pieces > 10)) return false;
      if (stockStatusFilter === 'out_of_stock' && pieces > 0) return false;

      return true;
    });

    if (stockSortMode === 'desc') {
      list.sort((a, b) => (b.totalPieces || 0) - (a.totalPieces || 0));
    } else if (stockSortMode === 'asc') {
      list.sort((a, b) => (a.totalPieces || 0) - (b.totalPieces || 0));
    }

    return list;
  }, [internalProducts, stockSearch, selectedBrand, selectedType, stockStatusFilter, stockSortMode]);

  const stockStats = useMemo(() => {
    let totalPieces = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    internalProducts.forEach((p) => {
      const pcs = p.totalPieces || 0;
      totalPieces += pcs;
      if (pcs <= 0) {
        outOfStockCount++;
      } else if (pcs <= 10) {
        lowStockCount++;
      }
    });

    return {
      totalProducts: internalProducts.length,
      totalPieces,
      lowStockCount,
      outOfStockCount,
    };
  }, [internalProducts]);

  const handleExportStockExcel = async () => {
    try {
      setIsExportingStock(true);
      const filterLabel = [
        selectedBrand !== 'all' ? `Brend: ${selectedBrand}` : null,
        selectedType !== 'all' ? `Tur: ${selectedType}` : null,
      ]
        .filter(Boolean)
        .join(', ') || "Barcha mahsulotlar";

      await exportWarehouseToExcel(filteredProducts, filterLabel);
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
    propClients && propClients.length > 0 ? propClients : storageService.getClients()
  );

  React.useEffect(() => {
    if (propClients && propClients.length > 0) {
      setInternalClients(propClients);
    } else {
      setInternalClients(storageService.getClients());
    }
  }, [propClients]);

  const [clientSearch, setClientSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [clientSortMode, setClientSortMode] = useState<ClientSortMode>('debt_desc');
  const [clientBalanceFilter, setClientBalanceFilter] = useState<ClientBalanceFilter>('all');
  const [isExportingClients, setIsExportingClients] = useState(false);

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
    let list: ClientAnnualData[] = internalClients.map((c) => ({
      client: c,
      currentDebt: c.currentDebt || 0,
      currentAdvance: c.currentAdvance || 0,
      months: computeClientMonthlyBalances(c, selectedYear),
    }));

    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase().trim();
      list = list.filter(({ client: c }) => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const phoneMatch = c.phone.toLowerCase().includes(q);
        const addrMatch = (c.address || '').toLowerCase().includes(q);
        const regMatch = (c.region || '').toLowerCase().includes(q);
        const distMatch = (c.district || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || addrMatch || regMatch || distMatch;
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

    if (clientBalanceFilter === 'debtors') {
      list = list.filter((item) => item.currentDebt > 0);
    } else if (clientBalanceFilter === 'creditors') {
      list = list.filter((item) => item.currentAdvance > 0);
    } else if (clientBalanceFilter === 'zero') {
      list = list.filter((item) => item.currentDebt === 0 && item.currentAdvance === 0);
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
    clientSearch,
    selectedRegion,
    selectedDistrict,
    selectedYear,
    clientSortMode,
    clientBalanceFilter,
  ]);

  const clientStats = useMemo(() => {
    let totalDebt = 0;
    let totalAdvance = 0;
    let debtorsCount = 0;
    let creditorsCount = 0;

    internalClients.forEach((c) => {
      const d = c.currentDebt || 0;
      const a = c.currentAdvance || 0;
      totalDebt += d;
      totalAdvance += a;
      if (d > 0) debtorsCount++;
      if (a > 0) creditorsCount++;
    });

    return {
      totalClients: internalClients.length,
      totalDebt,
      totalAdvance,
      debtorsCount,
      creditorsCount,
    };
  }, [internalClients]);

  const handleExportClientsExcel = async () => {
    try {
      setIsExportingClients(true);
      const filterLabel = [
        selectedRegion !== 'all' ? `Viloyat: ${selectedRegion}` : null,
        selectedDistrict !== 'all' ? `Tuman: ${selectedDistrict}` : null,
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
    return propPlans && propPlans.length > 0 ? propPlans : storageService.getDailyPlans();
  }, [propPlans]);

  const [delivSearch, setDelivSearch] = useState('');
  const [delivRegion, setDelivRegion] = useState<string>('all');
  const [delivDistrict, setDelivDistrict] = useState<string>('all');
  const [delivYear, setDelivYear] = useState<number>(2026);
  const [delivSortMode, setDelivSortMode] = useState<ProductDeliverySortMode>('qty_desc');
  const [delivStartDate, setDelivStartDate] = useState<string>('');
  const [delivEndDate, setDelivEndDate] = useState<string>('');
  const [isExportingDelivery, setIsExportingDelivery] = useState(false);

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

    const clientPlans = internalPlans.filter((p) => p.clientId === client.id);
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

    if (delivSearch.trim()) {
      const q = delivSearch.toLowerCase().trim();
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
    internalPlans,
    delivSearch,
    delivRegion,
    delivDistrict,
    delivYear,
    delivStartDate,
    delivEndDate,
    delivSortMode,
  ]);

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
  const [isExportingActions, setIsExportingActions] = useState(false);

  // Extract all single operations/actions across plans
  const allActionItems = useMemo(() => {
    const records: ActionExportItem[] = [];

    internalPlans.forEach((plan) => {
      const client = internalClients.find((c) => c.id === plan.clientId);
      const reg = plan.clientRegion || client?.region || parseLegacyAddress(plan.clientAddress || client?.address || '').region;
      const dist = plan.clientDistrict || client?.district || parseLegacyAddress(plan.clientAddress || client?.address || '').district;
      const locationStr = [reg, dist].filter(Boolean).join(', ') || plan.clientAddress || client?.address || '-';

      const rawActions =
        plan.actionsHistory && plan.actionsHistory.length > 0
          ? plan.actionsHistory
          : plan.actionDone || plan.financialAction || plan.productsDelivered || plan.productsReturned
          ? [
              {
                timestamp: plan.completedAt || plan.createdAt,
                author: plan.agentUsername,
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
        let naqd = 0;
        let karta = 0;
        let bank = 0;
        let qr = 0;

        // Payment from financialAction
        if (act.financialAction && act.financialAction.amount > 0) {
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

        // Delivery payment
        let creditDeliv = 0;
        let paidDeliv = 0;
        if (act.deliveryPayment) {
          const dp = act.deliveryPayment;
          const pType = dp.paymentType;
          if (pType === 'qarzga') {
            creditDeliv += dp.totalAmount || dp.debtAmount || 0;
          } else {
            paidDeliv += dp.paidAmount || 0;
            if (pType === 'naqd') naqd += dp.paidAmount || 0;
            else if (pType === 'karta') karta += dp.paidAmount || 0;
            else if (pType === 'bank') bank += dp.paidAmount || 0;
            else if (pType === 'qr') qr += dp.paidAmount || 0;

            if (dp.debtAmount && dp.debtAmount > 0) {
              creditDeliv += dp.debtAmount;
            }
          }
        }

        const deliveredDesc = (act.productsDelivered || [])
          .map((p) => `${p.name} (${p.quantity} ${p.unit})`)
          .join(', ');

        const totalDeliv = (act.productsDelivered || []).reduce(
          (sum, p) => sum + (p.totalPrice || p.quantity * (p.unitPrice || 0)),
          0
        );

        if (creditDeliv === 0 && totalDeliv > paidDeliv) {
          creditDeliv = totalDeliv - paidDeliv;
        }

        const returnedDesc = (act.productsReturned || [])
          .map((r) => `${r.name} (${r.quantity} ${r.unit})`)
          .join(', ');

        const returnedCount = (act.productsReturned || []).reduce(
          (sum, r) => sum + (r.quantity || 0),
          0
        );

        records.push({
          id: `${plan.id}_${actIdx}`,
          timestamp: act.timestamp || plan.completedAt || plan.createdAt,
          agentUsername: act.author || plan.agentUsername,
          clientName: plan.clientName,
          clientPhone: plan.clientPhone,
          clientLocation: locationStr,
          actionDone: act.actionDone || plan.actionDone || 'joyiga borildi',
          receiptNaqd: naqd,
          receiptKarta: karta,
          receiptBank: bank,
          receiptQr: qr,
          totalReceipt: naqd + karta + bank + qr,
          deliveredProductsDesc: deliveredDesc,
          deliveredCreditSum: creditDeliv,
          deliveredPaidSum: paidDeliv,
          totalDeliveredSum: creditDeliv + paidDeliv || totalDeliv,
          returnedProductsDesc: returnedDesc,
          returnedCount,
          note: act.reportNote || plan.reportNote || plan.planNote || '',
        });
      });
    });

    return records;
  }, [internalPlans, internalClients]);

  // Unique agents in 4-blok
  const uniqueActionAgents = useMemo(() => {
    const set = new Set<string>();
    allActionItems.forEach((a) => {
      if (a.agentUsername) set.add(a.agentUsername);
    });
    return Array.from(set).sort();
  }, [allActionItems]);

  // Filter 4-Blok by: 1. Date Range -> 2. Action Type -> 3. Region/District -> 4. Search
  const filteredActionItems = useMemo(() => {
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
      if (actionAgent !== 'all' && item.agentUsername !== actionAgent) {
        return false;
      }

      // Search
      if (actionSearch.trim()) {
        const q = actionSearch.toLowerCase().trim();
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
    actionSearch,
  ]);

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

      await exportAgentActionsToExcel(filteredActionItems, dateTitle, actionLabel);
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
    selectedActionType !== 'all';

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* TOP NAVIGATION TABS FOR BLOCKS 1, 2, 3 & 4               */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl p-1.5 border border-rose-100 shadow-2xs flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveBlockView('all')}
          className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeBlockView === 'all'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Barcha bloklar (1-4)</span>
        </button>

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
      </div>

      {/* ========================================================= */}
      {/* 1-BLOK: OMBORDAGI MAHSULOTLAR SONI                       */}
      {/* ========================================================= */}
      {(activeBlockView === 'all' || activeBlockView === 'block1') && (
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
                <div className="text-[10px] text-neutral-300 uppercase font-semibold">Jami qoldiq</div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-300">
                  {formatNumber(stockStats.totalPieces)} dona
                </div>
              </div>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
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
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-neutral-300 focus:border-rose-500 outline-none cursor-pointer"
                >
                  <option value="all">Barcha mahsulot turlari ({uniqueTypes.length})</option>
                  {uniqueTypes.map((t) => (
                    <option key={t} value={t}>
                      Turi / Birligi: {t}
                    </option>
                  ))}
                </select>
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
          </div>

          {filteredProducts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-rose-50/70 border-b border-rose-100 text-neutral-800 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-3 px-3.5">Mahsulot nomi</th>
                    <th className="py-3 px-3.5">Brendi</th>
                    <th className="py-3 px-3.5">Birligi</th>
                    <th className="py-3 px-3.5 text-center">Qadoqdagi dona</th>
                    <th className="py-3 px-3.5 text-right font-bold">Ombor qoldig'i (Dona)</th>
                    <th className="py-3 px-3.5 text-right">Qadoqlar soni</th>
                    <th className="py-3 px-3.5 text-center">Zaxira holati</th>
                    <th className="py-3 px-3.5 text-right">Kiritilgan sana</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150">
                  {filteredProducts.map((p, index) => {
                    const pieces = p.totalPieces || 0;
                    const piecesPerPkg = p.piecesPerPackage || 1;
                    const packages = Math.floor(pieces / piecesPerPkg);
                    const remainderPieces = pieces % piecesPerPkg;
                    const isOut = pieces <= 0;
                    const isLow = pieces > 0 && pieces <= 10;

                    return (
                      <tr key={p.id} className={index % 2 === 1 ? 'bg-neutral-50/50' : 'bg-white'}>
                        <td className="py-3 px-3.5 text-center font-mono text-neutral-400">{index + 1}</td>
                        <td className="py-3 px-3.5 font-bold text-neutral-900">{p.name}</td>
                        <td className="py-3 px-3.5 font-semibold text-neutral-700">{p.brand}</td>
                        <td className="py-3 px-3.5 text-neutral-700">{p.packageUnitName || p.baseUnit || 'Dona'}</td>
                        <td className="py-3 px-3.5 text-center font-mono">{piecesPerPkg} dona</td>
                        <td className="py-3 px-3.5 text-right font-mono text-sm font-extrabold text-emerald-700">
                          {formatNumber(pieces)} dona
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-neutral-700">
                          {packages > 0 ? `${formatNumber(packages)} ${p.packageUnitName || 'qadoq'}` : '0'}
                          {remainderPieces > 0 && ` +${remainderPieces} dona`}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {isOut ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Tugagan</span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">Kam qolgan</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Yetarli</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-neutral-500 text-[11px]">{p.intakeDate || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2-BLOK: 1 YILLIK QARZDORLIK VA HAQDORLIK                  */}
      {/* ========================================================= */}
      {(activeBlockView === 'all' || activeBlockView === 'block2') && (
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
              <p className="text-xs text-rose-200">
                Har bir oyda cell ikkiga bo'lingan: Qarzdorlik va Haqdorlik
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-rose-200 uppercase font-semibold">Jami qarz</div>
                <div className="text-sm sm:text-base font-bold font-mono text-rose-300">
                  {formatMoney(clientStats.totalDebt)} so'm
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-rose-200 uppercase font-semibold">Jami haqdorlik</div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-300">
                  {formatMoney(clientStats.totalAdvance)} so'm
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-rose-50/90 text-neutral-800 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 border-b border-rose-200">
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
                  {MONTH_NAMES.map((name) => (
                    <th
                      key={name}
                      colSpan={2}
                      className="py-2 px-2.5 text-center border-l-2 border-b border-rose-200/90 bg-rose-100/60 text-neutral-900 font-bold"
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
                {filteredAnnualClients.map((item, index) => {
                  const c = item.client;
                  const location = [c.region, c.district].filter(Boolean).join(', ') || c.address || '-';
                  return (
                    <tr key={c.id} className={index % 2 === 1 ? 'bg-neutral-50/40' : 'bg-white'}>
                      <td className="py-2.5 px-3 text-center font-mono text-neutral-400">{index + 1}</td>
                      <td className="py-2.5 px-3.5 font-bold text-neutral-900">{c.name}</td>
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
                          <td className="py-2.5 px-2 text-right font-mono text-[11px] border-l-2 border-neutral-200">
                            {m.debt > 0 ? <span className="text-rose-700 font-bold">{formatMoney(m.debt)}</span> : '-'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-[11px] border-l border-neutral-150">
                            {m.advance > 0 ? <span className="text-emerald-700 font-bold">{formatMoney(m.advance)}</span> : '-'}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3-BLOK: BERILGAN MAHSULOTLAR (QARZGA VA QARZSIZ)          */}
      {/* ========================================================= */}
      {(activeBlockView === 'all' || activeBlockView === 'block3') && (
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
              <p className="text-xs text-neutral-300">
                Har bir oyda cell ikkiga bo'lingan: Qarzga berilgan va Qarzsiz berilgan mahsulotlar nomlari, sonlari va summalari
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-rose-300 uppercase font-semibold">Qarzga berilgan</div>
                <div className="text-sm sm:text-base font-bold font-mono text-rose-300">
                  {formatMoney(delivStats.grandCreditSum)} so'm
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-emerald-300 uppercase font-semibold">Qarzsiz berilgan</div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-300">
                  {formatMoney(delivStats.grandPaidSum)} so'm
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-rose-50/90 text-neutral-800 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 border-b border-rose-200">
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
                {filteredDeliveryClients.map((item, index) => {
                  const c = item.client;
                  const location = [c.region, c.district].filter(Boolean).join(', ') || c.address || '-';
                  return (
                    <tr key={c.id} className={index % 2 === 1 ? 'bg-neutral-50/40' : 'bg-white'}>
                      <td className="py-2.5 px-3 text-center font-mono text-neutral-400">{index + 1}</td>
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
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4-BLOK: AGENTLAR AMALLARI, TUSHUMLAR VA MAHSULOT HARAKATI */}
      {/* ========================================================= */}
      {(activeBlockView === 'all' || activeBlockView === 'block4') && (
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
                  {formatMoney(actionStats.totalReceipts)} so'm
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-rose-300 uppercase font-semibold">Qarzga berildi</div>
                <div className="text-sm sm:text-base font-bold font-mono text-rose-300">
                  {formatMoney(actionStats.creditDelivSum)} so'm
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

              {isActionFilterActive && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActionSearch('');
                      setActionRegion('all');
                      setActionDistrict('all');
                      setActionAgent('all');
                      setSelectedActionType('all');
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 transition px-2 py-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Filtrlarni tozalash</span>
                  </button>
                </div>
              )}
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
                    {formatMoney(actionStats.totalReceipts)} so'm
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
                    {formatMoney(actionStats.totalDeliveredSum)} so'm
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-rose-50/90 text-neutral-800 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 border-b border-rose-200">
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
                          @{item.agentUsername}
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
                          {isBoth ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                              <Check className="w-3 h-3 text-purple-700" />
                              <span>Tel + Joyiga borildi</span>
                            </span>
                          ) : isCall ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                              <Phone className="w-3 h-3 text-blue-700" />
                              <span>Telefon qilindi</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200">
                              <MapPin className="w-3 h-3 text-rose-700" />
                              <span>Joyiga borildi</span>
                            </span>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
