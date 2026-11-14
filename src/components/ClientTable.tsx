import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { Client, DailyPlanItem } from '../types';
import { formatMoney, formatNumber, formatDate, formatDateDMY, getAgentDisplayName, getInitialDebtForClient } from '../utils/format';
import { parseLegacyAddress } from '../utils/location';
import { storageService } from '../services/storage';
import {
  exportClientsToXLSX,
  exportClientProductAnalyticsToXLSX,
  ClientBlock2ExportRow,
} from '../utils/excelExport';
import { StickyTableWrapper } from './StickyTableWrapper';
import {
  Search,
  Plus,
  Phone,
  MapPin,
  Eye,
  Edit,
  Trash2,
  FileSpreadsheet,
  ArrowUpDown,
  Package,
  X,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  Layers,
} from 'lucide-react';

interface Props {
  clients: Client[];
  dailyPlans?: DailyPlanItem[];
  onOpenAddModal: () => void;
  onViewClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onQuickPayment?: (client: Client) => void;
  onOpenWarehouseDebtModal?: (client?: Client) => void;
  userRole?: 'admin' | 'agent';
  currentUsername?: string;
}

type FilterType = 'all' | 'debtors' | 'creditors';
type SortType = 'newest' | 'name' | 'debt_desc';

type Block2OrderMode =
  | 'qty_desc'
  | 'qty_asc'
  | 'sum_desc'
  | 'sum_asc'
  | 'count_desc'
  | 'count_asc';

type Block2ProductTypeFilter = 'any_taken' | 'single_type' | 'multi_type';

interface ProductDeliveryOccurrence {
  clientId: string;
  date: string; // YYYY-MM-DD
  productName: string;
  productKey: string;
  unit: string;
  quantity: number;
  totalPriceUsd: number;
  paidUsd: number;
  creditUsd: number;
}

interface ClientAggregatedProductRow {
  productName: string;
  productKey: string;
  unit: string;
  timesDelivered: number; // Shu turdagi mahsulotni necha marta olgani
  totalQuantity: number;
  totalSumUsd: number;
  paidSumUsd: number;
  creditSumUsd: number;
  dates: string[];
}

interface ClientBlock2ComputedItem {
  client: Client;
  matchedProducts: ClientAggregatedProductRow[];
  distinctProductTypesCount: number;
  totalTimesDelivered: number;
  totalQuantity: number;
  totalSumUsd: number;
  paidSumUsd: number;
  creditSumUsd: number;
}

export const ClientTable: React.FC<Props> = ({
  clients,
  dailyPlans: propDailyPlans,
  onOpenAddModal,
  onViewClient,
  onEditClient,
  onDeleteClient,
  userRole = 'admin',
  currentUsername,
}) => {
  // Block selector: 'block1' (Mijozlar va qarzdorlik/haqdorlik) | 'block2' (Mahsulotlar asosida filtr va tahlil)
  const [activeClientBlock, setActiveClientBlock] = useState<'block1' | 'block2'>('block1');

  // =========================================================================
  // 1-BLOK STATES (Viloyat, Tuman, Yangi qo'shilganlar, Sana/Muddat oralig'i, Barchasi, Qarzdorlar, Haqdorlar)
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [block1StartDate, setBlock1StartDate] = useState<string>('');
  const [block1EndDate, setBlock1EndDate] = useState<string>('');
  const [block1DateCalcMode, setBlock1DateCalcMode] = useState<'snapshot' | 'period_activity'>('snapshot');

  const [isExporting, setIsExporting] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  // =========================================================================
  // 2-BLOK STATES (Mahsulotlar asosida filtr, maxsus vaqt oralig'i, ko'p/kam olganlar)
  // =========================================================================
  const [block2Search, setBlock2Search] = useState('');
  const deferredBlock2Search = useDeferredValue(block2Search);
  const [block2StartDate, setBlock2StartDate] = useState<string>('');
  const [block2EndDate, setBlock2EndDate] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productMatchMode, setProductMatchMode] = useState<'any' | 'all'>('any');
  const [productTypeCountFilter, setProductTypeCountFilter] =
    useState<Block2ProductTypeFilter>('any_taken');
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productFilterSearch, setProductFilterSearch] = useState('');
  const [block2OrderMode, setBlock2OrderMode] = useState<Block2OrderMode>('qty_desc');
  const [minProductQty, setMinProductQty] = useState<string>('');
  const [maxProductQty, setMaxProductQty] = useState<string>('');
  const [block2Page, setBlock2Page] = useState<number>(1);
  const [block2PageSize, setBlock2PageSize] = useState<number | 'all'>(50);
  const [isExportingBlock2, setIsExportingBlock2] = useState(false);

  // Faqat adminc va adminc1 o'chirish huquqiga ega
  const canDelete = currentUsername === 'adminc' || currentUsername === 'adminc1';

  const resolvedDailyPlans = useMemo(() => {
    return propDailyPlans && propDailyPlans.length > 0
      ? propDailyPlans
      : storageService.getDailyPlans();
  }, [propDailyPlans, clients]);

  const applyBlock1QuickDate = (preset: 'all' | 'today' | 'yesterday' | 7 | 'month' | 30) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === 'all') {
      setBlock1StartDate('');
      setBlock1EndDate('');
      return;
    }
    if (preset === 'today') {
      setBlock1StartDate(todayStr);
      setBlock1EndDate(todayStr);
      return;
    }
    if (preset === 'yesterday') {
      const y = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      setBlock1StartDate(y);
      setBlock1EndDate(y);
      return;
    }
    if (preset === 'month') {
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setBlock1StartDate(firstDay);
      setBlock1EndDate(todayStr);
      return;
    }
    const startDt = new Date(now.getTime() - preset * 86400000);
    setBlock1StartDate(startDt.toISOString().slice(0, 10));
    setBlock1EndDate(todayStr);
  };

  // Compute each client's debt and advance for 1-Blok (supports current state, snapshot as of date/range, or activity within range)
  const clientBlock1BalanceMap = useMemo(() => {
    const map = new Map<string, { debt: number; advance: number; hasActivityInRange: boolean }>();
    const hasDateFilter = Boolean(block1StartDate || block1EndDate);

    if (!hasDateFilter) {
      clients.forEach((c) => {
        map.set(c.id, {
          debt: Math.max(0, Number(c.currentDebt) || 0),
          advance: Math.max(0, Number(c.currentAdvance) || 0),
          hasActivityInRange: true,
        });
      });
      return map;
    }

    const startStr = block1StartDate || '0000-01-01';
    const endStr = block1EndDate || block1StartDate || '9999-12-31';

    const plansByClient = new Map<string, DailyPlanItem[]>();
    resolvedDailyPlans.forEach((p) => {
      if (!p || !p.clientId) return;
      const arr = plansByClient.get(p.clientId) || [];
      arr.push(p);
      plansByClient.set(p.clientId, arr);
    });

    clients.forEach((c) => {
      const logs = [...(c.logs || [])].sort((a, b) =>
        (b.timestamp || '').localeCompare(a.timestamp || '')
      );
      const cPlans = plansByClient.get(c.id) || [];

      if (block1DateCalcMode === 'period_activity') {
        // Shu muddat oralig'ida yuzaga kelgan qarzdorlik (nasiyaga berilgan yuk / qarz qo'shilishi) va haqdorlik/to'lovlar
        let periodDebtAdded = 0;
        let periodAdvanceOrPaid = 0;
        let hasAct = false;

        cPlans.forEach((plan) => {
          const actions =
            plan.actionsHistory && plan.actionsHistory.length > 0
              ? plan.actionsHistory.map((act) => ({
                  dateStr: (
                    act.timestamp ||
                    plan.closedAt ||
                    plan.completedAt ||
                    plan.planDate ||
                    plan.createdAt ||
                    ''
                  ).slice(0, 10),
                  financialAction: act.financialAction,
                  deliveryPayment: act.deliveryPayment,
                  productsDelivered: act.productsDelivered,
                }))
              : [
                  {
                    dateStr: (
                      plan.closedAt ||
                      plan.completedAt ||
                      plan.planDate ||
                      plan.createdAt ||
                      ''
                    ).slice(0, 10),
                    financialAction: plan.financialAction,
                    deliveryPayment: plan.deliveryPayment,
                    productsDelivered: plan.productsDelivered,
                  },
                ];

          actions.forEach((act) => {
            if (!act.dateStr || act.dateStr < startStr || act.dateStr > endStr) return;
            if (act.financialAction && (act.financialAction.amount || 0) > 0) {
              periodAdvanceOrPaid += Number(act.financialAction.amount) || 0;
              hasAct = true;
            }
            const prods = act.productsDelivered || [];
            const prodTotal = prods.reduce(
              (s, p) =>
                s + (Number(p.totalPrice) || (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0)),
              0
            );
            if (act.deliveryPayment) {
              const dp = act.deliveryPayment;
              if (dp.paymentType === 'qarzga') {
                const dAmt = Number(dp.debtAmount ?? dp.totalAmount ?? prodTotal) || 0;
                if (dAmt > 0) {
                  periodDebtAdded += dAmt;
                  hasAct = true;
                }
              } else {
                const pAmt = Number(dp.paidAmount) || 0;
                const dAmt =
                  dp.debtAmount !== undefined
                    ? Number(dp.debtAmount) || 0
                    : Math.max(0, prodTotal - pAmt);
                if (pAmt > 0) {
                  periodAdvanceOrPaid += pAmt;
                  hasAct = true;
                }
                if (dAmt > 0) {
                  periodDebtAdded += dAmt;
                  hasAct = true;
                }
              }
            } else if (prodTotal > 0) {
              periodDebtAdded += prodTotal;
              hasAct = true;
            }
          });
        });

        // Also check direct balance logs in range not already covered by clientPlans or visit_action
        logs.forEach((l) => {
          const dStr = (l.timestamp || '').slice(0, 10);
          if (!dStr || dStr < startStr || dStr > endStr) return;
          if (l.type === 'visit_action') return;
          const logId = String(l.id || '');
          if (
            cPlans.length > 0 &&
            (logId.endsWith('_fin') ||
              logId.endsWith('_prod') ||
              logId.endsWith('_prod_edit') ||
              logId.endsWith('_ret'))
          ) {
            return;
          }
          const amt = Number(l.amountChanged) || 0;
          if (amt > 0) {
            if (l.type === 'product_added') {
              periodDebtAdded += amt;
              hasAct = true;
            } else if (l.type === 'payment') {
              periodAdvanceOrPaid += amt;
              hasAct = true;
            }
          }
        });

        map.set(c.id, {
          debt: Math.round(periodDebtAdded * 100) / 100,
          advance: Math.round(periodAdvanceOrPaid * 100) / 100,
          hasActivityInRange: hasAct || periodDebtAdded > 0 || periodAdvanceOrPaid > 0,
        });
        return;
      }

      // Default mode ('snapshot'): Tanlangan sana / muddat yakunidagi (endStr) qarzdorlik va haqdorlik holati
      let net = (Number(c.currentDebt) || 0) - (Number(c.currentAdvance) || 0);

      // Revert logs that happened AFTER endStr
      logs.forEach((l) => {
        const dStr = (l.timestamp || '').slice(0, 10);
        if (dStr > endStr && l.amountChanged) {
          const amt = Number(l.amountChanged) || 0;
          if (l.type === 'product_added') {
            net -= amt;
          } else if (l.type === 'payment') {
            net += amt;
          }
        }
      });

      const snapDebt = net > 0 ? Math.round(net * 100) / 100 : 0;
      const snapAdvance = net < 0 ? Math.round(Math.abs(net) * 100) / 100 : 0;

      map.set(c.id, {
        debt: snapDebt,
        advance: snapAdvance,
        hasActivityInRange: true,
      });
    });

    return map;
  }, [clients, resolvedDailyPlans, block1StartDate, block1EndDate, block1DateCalcMode]);

  // Pre-compute global tab counts in a single O(N) pass (1-Blok)
  const globalTabCounts = useMemo(() => {
    let debtors = 0;
    let creditors = 0;
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      const bal = clientBlock1BalanceMap.get(c.id);
      const d = bal ? bal.debt : c.currentDebt;
      const a = bal ? bal.advance : c.currentAdvance;
      if (d > 0) debtors++;
      if (a > 0) creditors++;
    }
    return { debtors, creditors };
  }, [clients, clientBlock1BalanceMap]);

  // Extract unique regions from clients
  const uniqueRegions = useMemo(() => {
    const regSet = new Set<string>();
    clients.forEach((c) => {
      const reg = c.region?.trim() || parseLegacyAddress(c.address).region;
      if (reg) regSet.add(reg);
    });
    return Array.from(regSet).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [clients]);

  // Extract unique districts from clients (if region selected, only for that region)
  const uniqueDistricts = useMemo(() => {
    const distSet = new Set<string>();
    clients.forEach((c) => {
      const reg = c.region?.trim() || parseLegacyAddress(c.address).region;
      const dist = c.district?.trim() || parseLegacyAddress(c.address).district;
      if (dist) {
        if (selectedRegion === 'all' || reg.toLowerCase() === selectedRegion.toLowerCase()) {
          distSet.add(dist);
        }
      }
    });
    return Array.from(distSet).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [clients, selectedRegion]);

  // =========================================================================
  // 1-BLOK FILTERING & SUMMARY
  // =========================================================================
  const isBlock1FilterActive =
    searchQuery.trim() !== '' ||
    filterType !== 'all' ||
    selectedRegion !== 'all' ||
    selectedDistrict !== 'all' ||
    block1StartDate !== '' ||
    block1EndDate !== '';

  const resetBlock1Filters = () => {
    setSearchQuery('');
    setFilterType('all');
    setSelectedRegion('all');
    setSelectedDistrict('all');
    setSortType('newest');
    setBlock1StartDate('');
    setBlock1EndDate('');
    setBlock1DateCalcMode('snapshot');
  };

  const filteredClients = useMemo(() => {
    let result = [...clients];

    if ((block1StartDate || block1EndDate) && block1DateCalcMode === 'period_activity') {
      result = result.filter((c) => {
        const bal = clientBlock1BalanceMap.get(c.id);
        return bal ? bal.hasActivityInRange : false;
      });
    }

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone.toLowerCase().includes(q);
        const matchesAddress = (c.address || '').toLowerCase().includes(q);
        const matchesRegion = (c.region || '').toLowerCase().includes(q);
        const matchesDistrict = (c.district || '').toLowerCase().includes(q);
        const matchesLandmark = (c.landmark || '').toLowerCase().includes(q);
        return (
          matchesName ||
          matchesPhone ||
          matchesAddress ||
          matchesRegion ||
          matchesDistrict ||
          matchesLandmark
        );
      });
    }

    if (filterType === 'debtors') {
      result = result.filter((c) => (clientBlock1BalanceMap.get(c.id)?.debt ?? c.currentDebt) > 0);
    } else if (filterType === 'creditors') {
      result = result.filter(
        (c) => (clientBlock1BalanceMap.get(c.id)?.advance ?? c.currentAdvance) > 0
      );
    }

    if (selectedRegion !== 'all') {
      const targetReg = selectedRegion.toLowerCase();
      result = result.filter((c) => {
        const cReg = (c.region || parseLegacyAddress(c.address).region).toLowerCase();
        return cReg === targetReg || (c.address || '').toLowerCase().includes(targetReg);
      });
    }

    if (selectedDistrict !== 'all') {
      const targetDist = selectedDistrict.toLowerCase();
      result = result.filter((c) => {
        const cDist = (c.district || parseLegacyAddress(c.address).district).toLowerCase();
        return cDist === targetDist || (c.address || '').toLowerCase().includes(targetDist);
      });
    }

    result.sort((a, b) => {
      if (sortType === 'name') {
        return a.name.localeCompare(b.name, 'uz');
      }
      if (sortType === 'debt_desc') {
        const dA = clientBlock1BalanceMap.get(a.id)?.debt ?? a.currentDebt;
        const dB = clientBlock1BalanceMap.get(b.id)?.debt ?? b.currentDebt;
        return dB - dA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [
    clients,
    deferredSearchQuery,
    filterType,
    sortType,
    selectedRegion,
    selectedDistrict,
    block1StartDate,
    block1EndDate,
    block1DateCalcMode,
    clientBlock1BalanceMap,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    deferredSearchQuery,
    filterType,
    sortType,
    selectedRegion,
    selectedDistrict,
    block1StartDate,
    block1EndDate,
    block1DateCalcMode,
    pageSize,
  ]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(filteredClients.length / pageSize));
  }, [filteredClients.length, pageSize]);

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const visibleClients = useMemo(() => {
    if (pageSize === 'all') return filteredClients;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, pageSize, safeCurrentPage]);

  const filteredSummary = useMemo(() => {
    let totalDebt = 0;
    let totalAdvance = 0;
    let debtorsCount = 0;
    let creditorsCount = 0;
    let maxDebtor: { client: Client; debt: number } | null = null;

    filteredClients.forEach((c) => {
      const bal = clientBlock1BalanceMap.get(c.id);
      const d = bal ? bal.debt : c.currentDebt || 0;
      const a = bal ? bal.advance : c.currentAdvance || 0;

      totalDebt += d;
      totalAdvance += a;

      if (d > 0) {
        debtorsCount++;
        if (!maxDebtor || d > maxDebtor.debt) {
          maxDebtor = { client: c, debt: d };
        }
      }
      if (a > 0) {
        creditorsCount++;
      }
    });

    const avgDebtPerDebtor = debtorsCount > 0 ? totalDebt / debtorsCount : 0;
    const netBalance = totalDebt - totalAdvance;

    return {
      totalCount: filteredClients.length,
      allClientsCount: clients.length,
      totalDebt,
      totalAdvance,
      debtorsCount,
      creditorsCount,
      avgDebtPerDebtor,
      netBalance,
      maxDebtor: maxDebtor
        ? ({ ...(maxDebtor as { client: Client; debt: number }).client, currentDebt: (maxDebtor as { client: Client; debt: number }).debt } as Client)
        : null,
    };
  }, [filteredClients, clients.length, clientBlock1BalanceMap]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const sourceList = filteredClients.length > 0 ? filteredClients : clients;
      const exportList = sourceList.map((c) => {
        const bal = clientBlock1BalanceMap.get(c.id);
        if (!bal) return c;
        return {
          ...c,
          currentDebt: bal.debt,
          currentAdvance: bal.advance,
        };
      });
      await exportClientsToXLSX(exportList);
    } catch (err) {
      console.error('Failed to export excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // =========================================================================
  // 2-BLOK: MAHSULOTLAR YETKAZIB BERILISHI VA DAVR BO'YICHA HISOBLASH
  // =========================================================================
  // Har bir mijozga qachon, qaysi mahsulot, necha marta, qanchasi nasiyasiz va qanchasi nasiyaga berilganini yig'amiz
  const allDeliveryOccurrencesByClient = useMemo(() => {
    const map = new Map<string, ProductDeliveryOccurrence[]>();

    const plansByClient = new Map<string, DailyPlanItem[]>();
    resolvedDailyPlans.forEach((plan) => {
      if (!plan || !plan.clientId) return;
      const list = plansByClient.get(plan.clientId) || [];
      list.push(plan);
      plansByClient.set(plan.clientId, list);
    });

    clients.forEach((client) => {
      const occurrences: ProductDeliveryOccurrence[] = [];
      const coveredProductIds = new Set<string>();
      const coveredQtyByProdKey = new Map<string, number>();

      const cPlans = plansByClient.get(client.id) || [];
      cPlans.forEach((plan) => {
        const actions =
          plan.actionsHistory && plan.actionsHistory.length > 0
            ? plan.actionsHistory.map((act) => ({
                dateStr: (
                  act.timestamp ||
                  plan.closedAt ||
                  plan.completedAt ||
                  plan.planDate ||
                  plan.createdAt ||
                  ''
                ).slice(0, 10),
                productsDelivered: act.productsDelivered,
                deliveryPayment: act.deliveryPayment,
              }))
            : plan.productsDelivered && plan.productsDelivered.length > 0
            ? [
                {
                  dateStr: (
                    plan.closedAt ||
                    plan.completedAt ||
                    plan.planDate ||
                    plan.createdAt ||
                    ''
                  ).slice(0, 10),
                  productsDelivered: plan.productsDelivered,
                  deliveryPayment: plan.deliveryPayment,
                },
              ]
            : [];

        actions.forEach((act) => {
          const prods = (act.productsDelivered || []).filter(
            (p) => p && (p.name || '').trim() !== '' && (Number(p.quantity) || 0) > 0
          );
          if (prods.length === 0) return;

          const eventTotal = prods.reduce(
            (s, p) => s + (Number(p.totalPrice) || (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0)),
            0
          );

          const dp = act.deliveryPayment;
          let paidRatio = 0;
          let creditRatio = 1;

          if (!dp || dp.paymentType === 'qarzga') {
            paidRatio = 0;
            creditRatio = 1;
          } else if (dp.paidAmount !== undefined || dp.debtAmount !== undefined) {
            const paid = Math.max(0, Number(dp.paidAmount) || 0);
            const debt =
              dp.debtAmount !== undefined
                ? Math.max(0, Number(dp.debtAmount) || 0)
                : Math.max(0, eventTotal - paid);
            const denom = paid + debt > 0 ? paid + debt : eventTotal;
            if (denom > 0) {
              paidRatio = Math.min(1, paid / denom);
              creditRatio = Math.max(0, 1 - paidRatio);
            } else {
              paidRatio = 1;
              creditRatio = 0;
            }
          } else {
            paidRatio = 1;
            creditRatio = 0;
          }

          // Bir amaliyot ichida bir xil mahsulot bir necha qatorda bo'lsa ham 1 marta berilgan deb guruhlaymiz
          const groupedInBatch = new Map<
            string,
            { name: string; unit: string; qty: number; sum: number }
          >();

          prods.forEach((p) => {
            if (p.id) coveredProductIds.add(p.id);
            const cleanName = p.name.trim();
            const pKey = cleanName.toLowerCase();
            const q = Number(p.quantity) || 0;
            const s = Number(p.totalPrice) || q * (Number(p.unitPrice) || 0);

            coveredQtyByProdKey.set(pKey, (coveredQtyByProdKey.get(pKey) || 0) + q);

            const rawUnit = (p.unit || '').trim();
            const normUnit = !rawUnit || rawUnit.toLowerCase() === 'birlik' ? 'dona' : rawUnit;
            const ex = groupedInBatch.get(pKey) || {
              name: cleanName,
              unit: normUnit,
              qty: 0,
              sum: 0,
            };
            ex.qty += q;
            ex.sum += s;
            groupedInBatch.set(pKey, ex);
          });

          groupedInBatch.forEach((g, pKey) => {
            occurrences.push({
              clientId: client.id,
              date: act.dateStr || (client.createdAt || '').slice(0, 10),
              productName: g.name,
              productKey: pKey,
              unit: g.unit,
              quantity: Math.round(g.qty * 100) / 100,
              totalPriceUsd: Math.round(g.sum * 100) / 100,
              paidUsd: Math.round(g.sum * paidRatio * 100) / 100,
              creditUsd: Math.round(g.sum * creditRatio * 100) / 100,
            });
          });
        });
      });

      // Mijozning client.products ro'yxatida bo'lib, dailyPlans ichida qamrab olinmagan mahsulotlarni ham qo'shamiz
      const clientProds = (client.products || []).filter(
        (p) => p && (p.name || '').trim() !== '' && (Number(p.quantity) || 0) > 0
      );
      if (clientProds.length > 0) {
        const totalClientProdVal = clientProds.reduce(
          (s, p) => s + (Number(p.totalPrice) || (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0)),
          0
        );
        const clientDebt = Math.max(0, Number(client.currentDebt) || 0);
        const fallbackCreditRatio =
          totalClientProdVal > 0 ? Math.min(1, clientDebt / totalClientProdVal) : clientDebt > 0 ? 1 : 0;
        const fallbackPaidRatio = Math.max(0, 1 - fallbackCreditRatio);

        // Track remaining covered quantities for products without matching ID
        const remainingCoveredQty = new Map(coveredQtyByProdKey);
        const fallbackGrouped = new Map<
          string,
          { name: string; unit: string; qty: number; sum: number }
        >();

        clientProds.forEach((p) => {
          if (p.id && coveredProductIds.has(p.id)) return;
          const cleanName = p.name.trim();
          const pKey = cleanName.toLowerCase();
          const q = Number(p.quantity) || 0;
          const unitP = Number(p.unitPrice) || 0;
          const totalP = Number(p.totalPrice) || q * unitP;

          const alreadyCov = remainingCoveredQty.get(pKey) || 0;
          if (alreadyCov >= q) {
            remainingCoveredQty.set(pKey, alreadyCov - q);
            return;
          }

          const uncoveredQty = q - alreadyCov;
          remainingCoveredQty.set(pKey, 0);
          const ratio = q > 0 ? uncoveredQty / q : 1;
          const uncoveredSum = totalP * ratio;
          const rawUnit = (p.unit || '').trim();
          const normUnit = !rawUnit || rawUnit.toLowerCase() === 'birlik' ? 'dona' : rawUnit;

          const ex = fallbackGrouped.get(pKey) || {
            name: cleanName,
            unit: normUnit,
            qty: 0,
            sum: 0,
          };
          ex.qty += uncoveredQty;
          ex.sum += uncoveredSum;
          fallbackGrouped.set(pKey, ex);
        });

        fallbackGrouped.forEach((g, pKey) => {
          occurrences.push({
            clientId: client.id,
            date: (client.createdAt || new Date().toISOString()).slice(0, 10),
            productName: g.name,
            productKey: pKey,
            unit: g.unit,
            quantity: Math.round(g.qty * 100) / 100,
            totalPriceUsd: Math.round(g.sum * 100) / 100,
            paidUsd: Math.round(g.sum * fallbackPaidRatio * 100) / 100,
            creditUsd: Math.round(g.sum * fallbackCreditRatio * 100) / 100,
          });
        });
      }

      map.set(client.id, occurrences);
    });

    return map;
  }, [clients, resolvedDailyPlans]);

  // Catalog of all unique products available in the selected date range (for the multi-select picker)
  const uniqueProductCatalog = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        unit: string;
        clientsSet: Set<string>;
        totalQty: number;
        totalSum: number;
        totalTimes: number;
      }
    >();

    allDeliveryOccurrencesByClient.forEach((occurrences, clientId) => {
      occurrences.forEach((occ) => {
        if (block2StartDate && occ.date < block2StartDate) return;
        if (block2EndDate && occ.date > block2EndDate) return;

        const existing = map.get(occ.productKey) || {
          name: occ.productName,
          unit: occ.unit,
          clientsSet: new Set<string>(),
          totalQty: 0,
          totalSum: 0,
          totalTimes: 0,
        };
        existing.clientsSet.add(clientId);
        existing.totalQty += occ.quantity;
        existing.totalSum += occ.totalPriceUsd;
        existing.totalTimes += 1;
        map.set(occ.productKey, existing);
      });
    });

    return Array.from(map.values())
      .map((item) => ({
        name: item.name,
        key: item.name.toLowerCase(),
        unit: item.unit,
        clientsCount: item.clientsSet.size,
        totalQty: Math.round(item.totalQty * 100) / 100,
        totalSum: Math.round(item.totalSum * 100) / 100,
        totalTimes: item.totalTimes,
      }))
      .sort((a, b) => b.clientsCount - a.clientsCount || a.name.localeCompare(b.name, 'uz'));
  }, [allDeliveryOccurrencesByClient, block2StartDate, block2EndDate]);

  const toggleProductSelection = (prodName: string) => {
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.toLowerCase() === prodName.toLowerCase());
      return exists
        ? prev.filter((p) => p.toLowerCase() !== prodName.toLowerCase())
        : [...prev, prodName];
    });
  };

  // Compute filtered & sorted Block 2 rows
  const block2FilteredRows = useMemo<ClientBlock2ComputedItem[]>(() => {
    const selectedSet = new Set(selectedProducts.map((s) => s.toLowerCase()));
    const minQ = minProductQty.trim() !== '' ? Number(minProductQty) : null;
    const maxQ = maxProductQty.trim() !== '' ? Number(maxProductQty) : null;
    const qSearch = deferredBlock2Search.toLowerCase().trim();

    const rows: ClientBlock2ComputedItem[] = [];

    clients.forEach((client) => {
      // Search filter on client or product
      const rawOccurrences = allDeliveryOccurrencesByClient.get(client.id) || [];

      // Filter occurrences by date range first
      const dateMatchedOccurrences = rawOccurrences.filter((occ) => {
        if (block2StartDate && occ.date < block2StartDate) return false;
        if (block2EndDate && occ.date > block2EndDate) return false;
        return true;
      });

      if (dateMatchedOccurrences.length === 0) return;

      // All distinct product types taken by this client in the selected period
      const allPeriodProductKeys = new Set(dateMatchedOccurrences.map((o) => o.productKey));

      // If specific products are selected:
      if (selectedSet.size > 0) {
        if (productMatchMode === 'all') {
          // Mijoz tanlangan mahsulotlarning barchasini olgan bo'lishi kerak
          let hasAll = true;
          selectedSet.forEach((selKey) => {
            if (!allPeriodProductKeys.has(selKey)) hasAll = false;
          });
          if (!hasAll) return;
        } else {
          // Mijoz tanlangan mahsulotlardan kamida bittasini olgan bo'lishi kerak
          let hasAny = false;
          selectedSet.forEach((selKey) => {
            if (allPeriodProductKeys.has(selKey)) hasAny = true;
          });
          if (!hasAny) return;
        }
      }

      // Filter occurrences to selected products (if any selected)
      const relevantOccurrences =
        selectedSet.size > 0
          ? dateMatchedOccurrences.filter((o) => selectedSet.has(o.productKey))
          : dateMatchedOccurrences;

      if (relevantOccurrences.length === 0) return;

      // Group by productKey to compute how many times each product was delivered ("nechchi marta berilgani")
      const prodAggMap = new Map<string, ClientAggregatedProductRow>();
      relevantOccurrences.forEach((occ) => {
        const normUnit = !occ.unit || occ.unit.toLowerCase() === 'birlik' ? 'dona' : occ.unit;
        const existing = prodAggMap.get(occ.productKey) || {
          productName: occ.productName,
          productKey: occ.productKey,
          unit: normUnit,
          timesDelivered: 0,
          totalQuantity: 0,
          totalSumUsd: 0,
          paidSumUsd: 0,
          creditSumUsd: 0,
          dates: [],
        };
        existing.timesDelivered += 1;
        existing.totalQuantity = Math.round((existing.totalQuantity + occ.quantity) * 100) / 100;
        existing.totalSumUsd = Math.round((existing.totalSumUsd + occ.totalPriceUsd) * 100) / 100;
        existing.paidSumUsd = Math.round((existing.paidSumUsd + occ.paidUsd) * 100) / 100;
        existing.creditSumUsd = Math.round((existing.creditSumUsd + occ.creditUsd) * 100) / 100;
        if (occ.date && !existing.dates.includes(occ.date)) {
          existing.dates.push(occ.date);
        }
        prodAggMap.set(occ.productKey, existing);
      });

      const matchedProducts = Array.from(prodAggMap.values()).sort(
        (a, b) => b.totalQuantity - a.totalQuantity || b.timesDelivered - a.timesDelivered
      );

      const distinctProductTypesCount = allPeriodProductKeys.size;

      // Filter by 1 turdagi vs 2+ turdagi mahsulot olganlar
      if (productTypeCountFilter === 'single_type' && distinctProductTypesCount !== 1) {
        return;
      }
      if (productTypeCountFilter === 'multi_type' && distinctProductTypesCount < 2) {
        return;
      }

      let totalTimesDelivered = 0;
      let totalQuantity = 0;
      let totalSumUsd = 0;
      let paidSumUsd = 0;
      let creditSumUsd = 0;

      matchedProducts.forEach((mp) => {
        totalTimesDelivered += mp.timesDelivered;
        totalQuantity += mp.totalQuantity;
        totalSumUsd += mp.totalSumUsd;
        paidSumUsd += mp.paidSumUsd;
        creditSumUsd += mp.creditSumUsd;
      });

      totalQuantity = Math.round(totalQuantity * 100) / 100;
      totalSumUsd = Math.round(totalSumUsd * 100) / 100;
      paidSumUsd = Math.round(paidSumUsd * 100) / 100;
      creditSumUsd = Math.round(creditSumUsd * 100) / 100;

      if (minQ !== null && !isNaN(minQ) && totalQuantity < minQ) return;
      if (maxQ !== null && !isNaN(maxQ) && totalQuantity > maxQ) return;

      if (qSearch) {
        const matchesClient =
          client.name.toLowerCase().includes(qSearch) ||
          client.phone.toLowerCase().includes(qSearch) ||
          (client.address || '').toLowerCase().includes(qSearch) ||
          (client.region || '').toLowerCase().includes(qSearch) ||
          (client.district || '').toLowerCase().includes(qSearch);
        const matchesProd = matchedProducts.some((mp) =>
          mp.productName.toLowerCase().includes(qSearch)
        );
        if (!matchesClient && !matchesProd) return;
      }

      rows.push({
        client,
        matchedProducts,
        distinctProductTypesCount,
        totalTimesDelivered,
        totalQuantity,
        totalSumUsd,
        paidSumUsd,
        creditSumUsd,
      });
    });

    rows.sort((a, b) => {
      if (block2OrderMode === 'qty_desc') {
        if (b.totalQuantity !== a.totalQuantity) return b.totalQuantity - a.totalQuantity;
        return b.totalSumUsd - a.totalSumUsd;
      }
      if (block2OrderMode === 'qty_asc') {
        if (a.totalQuantity !== b.totalQuantity) return a.totalQuantity - b.totalQuantity;
        return a.totalSumUsd - b.totalSumUsd;
      }
      if (block2OrderMode === 'sum_desc') {
        if (b.totalSumUsd !== a.totalSumUsd) return b.totalSumUsd - a.totalSumUsd;
        return b.totalQuantity - a.totalQuantity;
      }
      if (block2OrderMode === 'sum_asc') {
        if (a.totalSumUsd !== b.totalSumUsd) return a.totalSumUsd - b.totalSumUsd;
        return a.totalQuantity - b.totalQuantity;
      }
      if (block2OrderMode === 'count_desc') {
        if (b.totalTimesDelivered !== a.totalTimesDelivered)
          return b.totalTimesDelivered - a.totalTimesDelivered;
        return b.totalQuantity - a.totalQuantity;
      }
      if (block2OrderMode === 'count_asc') {
        if (a.totalTimesDelivered !== b.totalTimesDelivered)
          return a.totalTimesDelivered - b.totalTimesDelivered;
        return a.totalQuantity - b.totalQuantity;
      }
      return 0;
    });

    return rows;
  }, [
    clients,
    allDeliveryOccurrencesByClient,
    block2StartDate,
    block2EndDate,
    selectedProducts,
    productMatchMode,
    productTypeCountFilter,
    minProductQty,
    maxProductQty,
    deferredBlock2Search,
    block2OrderMode,
  ]);

  useEffect(() => {
    setBlock2Page(1);
  }, [
    block2StartDate,
    block2EndDate,
    selectedProducts,
    productMatchMode,
    productTypeCountFilter,
    minProductQty,
    maxProductQty,
    deferredBlock2Search,
    block2OrderMode,
    block2PageSize,
  ]);

  const block2TotalPages = useMemo(() => {
    if (block2PageSize === 'all') return 1;
    return Math.max(1, Math.ceil(block2FilteredRows.length / block2PageSize));
  }, [block2FilteredRows.length, block2PageSize]);

  const safeBlock2Page = Math.min(block2Page, block2TotalPages);

  const visibleBlock2Rows = useMemo(() => {
    if (block2PageSize === 'all') return block2FilteredRows;
    const start = (safeBlock2Page - 1) * block2PageSize;
    return block2FilteredRows.slice(start, start + block2PageSize);
  }, [block2FilteredRows, block2PageSize, safeBlock2Page]);

  // 2-Blok Ko'rsatkichlar (Tanlangan muddatdagi tanlangan mahsulotlar qiymati, nasiyasiz va nasiyaga sotilgani)
  const block2Summary = useMemo(() => {
    let totalSumUsd = 0;
    let paidSumUsd = 0;
    let creditSumUsd = 0;
    let totalQuantity = 0;
    let totalTimesDelivered = 0;

    block2FilteredRows.forEach((r) => {
      totalSumUsd += r.totalSumUsd;
      paidSumUsd += r.paidSumUsd;
      creditSumUsd += r.creditSumUsd;
      totalQuantity += r.totalQuantity;
      totalTimesDelivered += r.totalTimesDelivered;
    });

    totalSumUsd = Math.round(totalSumUsd * 100) / 100;
    paidSumUsd = Math.round(paidSumUsd * 100) / 100;
    creditSumUsd = Math.round(creditSumUsd * 100) / 100;
    totalQuantity = Math.round(totalQuantity * 100) / 100;

    const paidPercent = totalSumUsd > 0 ? Math.round((paidSumUsd / totalSumUsd) * 100) : 0;
    const creditPercent = totalSumUsd > 0 ? Math.max(0, 100 - paidPercent) : 0;

    return {
      clientsCount: block2FilteredRows.length,
      totalSumUsd,
      paidSumUsd,
      creditSumUsd,
      paidPercent,
      creditPercent,
      totalQuantity,
      totalTimesDelivered,
    };
  }, [block2FilteredRows]);

  const isBlock2FilterActive =
    block2Search.trim() !== '' ||
    block2StartDate !== '' ||
    block2EndDate !== '' ||
    selectedProducts.length > 0 ||
    productTypeCountFilter !== 'any_taken' ||
    minProductQty.trim() !== '' ||
    maxProductQty.trim() !== '';

  const resetBlock2Filters = () => {
    setBlock2Search('');
    setBlock2StartDate('');
    setBlock2EndDate('');
    setSelectedProducts([]);
    setProductMatchMode('any');
    setProductTypeCountFilter('any_taken');
    setBlock2OrderMode('qty_desc');
    setMinProductQty('');
    setMaxProductQty('');
  };

  const applyQuickDateRange = (days: number | 'month' | 'today' | 'yesterday' | 'all') => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (days === 'all') {
      setBlock2StartDate('');
      setBlock2EndDate('');
      return;
    }
    if (days === 'today') {
      setBlock2StartDate(todayStr);
      setBlock2EndDate(todayStr);
      return;
    }
    if (days === 'yesterday') {
      const yStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      setBlock2StartDate(yStr);
      setBlock2EndDate(yStr);
      return;
    }
    if (days === 'month') {
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setBlock2StartDate(firstDay);
      setBlock2EndDate(todayStr);
      return;
    }
    const startDt = new Date(now.getTime() - days * 86400000);
    setBlock2StartDate(startDt.toISOString().slice(0, 10));
    setBlock2EndDate(todayStr);
  };

  const handleExportBlock2Excel = async () => {
    try {
      setIsExportingBlock2(true);
      const periodLabel =
        block2StartDate || block2EndDate
          ? `${block2StartDate ? formatDateDMY(block2StartDate) : 'Boshidan'} — ${
              block2EndDate ? formatDateDMY(block2EndDate) : 'Bugungacha'
            }`
          : 'Barcha vaqt';

      const exportRows: ClientBlock2ExportRow[] = block2FilteredRows.map((r) => ({
        client: r.client,
        productsSummaryLines: r.matchedProducts.map(
          (mp) =>
            `${mp.productName} — ${mp.timesDelivered} marta olgan (${formatNumber(mp.totalQuantity)} dona, ${formatMoney(mp.totalSumUsd)})`
        ),
        totalDeliveryEventsCount: r.totalTimesDelivered,
        totalQuantity: r.totalQuantity,
        paidSumUsd: r.paidSumUsd,
        creditSumUsd: r.creditSumUsd,
        totalSumUsd: r.totalSumUsd,
      }));

      await exportClientProductAnalyticsToXLSX(exportRows, periodLabel);
    } catch (err) {
      console.error('Failed to export block 2 excel:', err);
    } finally {
      setIsExportingBlock2(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ===================================================================== */}
      {/* 1-BLOK VA 2-BLOK TANLASH NAVIGATSIYASI                                */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl p-2 border border-rose-100 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveClientBlock('block1')}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left transition cursor-pointer ${
            activeClientBlock === 'block1'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'bg-neutral-50 hover:bg-rose-50/60 text-neutral-800 border border-neutral-200/80'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg font-extrabold font-display text-xs flex items-center justify-center shrink-0 ${
                activeClientBlock === 'block1'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              1-Blok
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold truncate">
                Mijozlar va qarzdorlik / haqdorlik ro'yxati
              </div>
              <div
                className={`text-[11px] truncate ${
                  activeClientBlock === 'block1' ? 'text-rose-100' : 'text-neutral-500'
                }`}
              >
                Viloyat, tuman, yangi qo'shilganlar, qarzdorlar va haqdorlar
              </div>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold shrink-0 ${
              activeClientBlock === 'block1'
                ? 'bg-white/20 text-white'
                : 'bg-white text-neutral-700 border border-neutral-200'
            }`}
          >
            {filteredClients.length} ta
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveClientBlock('block2')}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left transition cursor-pointer ${
            activeClientBlock === 'block2'
              ? 'bg-indigo-700 text-white shadow-sm'
              : 'bg-neutral-50 hover:bg-indigo-50/60 text-neutral-800 border border-neutral-200/80'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg font-extrabold font-display text-xs flex items-center justify-center shrink-0 ${
                activeClientBlock === 'block2'
                  ? 'bg-white/20 text-white'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              2-Blok
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold truncate">
                Mahsulotlar asosida filtr va tahlil
              </div>
              <div
                className={`text-[11px] truncate ${
                  activeClientBlock === 'block2' ? 'text-indigo-100' : 'text-neutral-500'
                }`}
              >
                Vaqt oralig'i, mahsulot turlari, ko'p va kam olganlar, nasiya tahlili
              </div>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold shrink-0 ${
              activeClientBlock === 'block2'
                ? 'bg-white/20 text-white'
                : 'bg-white text-neutral-700 border border-neutral-200'
            }`}
          >
            {block2FilteredRows.length} ta
          </span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* 1-BLOK CONTENT                                                        */}
      {/* ===================================================================== */}
      {activeClientBlock === 'block1' && (
        <>
          {/* Search, Filter, Sort and Action Strip */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-rose-100 shadow-xs space-y-3.5">
            {/* Large, wide, optimal search field */}
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-rose-600">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Mijoz ismi, telefon raqami, viloyat, tuman yoki mo'ljal bo'yicha tezkor qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-24 py-3.5 bg-neutral-50/90 focus:bg-white rounded-2xl border-2 border-neutral-200 focus:border-rose-600 focus:ring-2 focus:ring-rose-100 text-sm sm:text-base font-medium text-neutral-900 placeholder:text-neutral-400 outline-none transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-2 my-auto h-8 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 flex items-center gap-1 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Tozalash</span>
                </button>
              )}
            </div>

            {/* Filters & Export Row (Faqat Viloyat, Tuman va Yangi qo'shilganlar saralash) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Viloyat yoki shahar bo'yicha filtr */}
                <div className="relative flex items-center">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700">
                    <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <select
                      value={selectedRegion}
                      onChange={(e) => {
                        setSelectedRegion(e.target.value);
                        setSelectedDistrict('all');
                      }}
                      className="bg-transparent outline-none cursor-pointer text-neutral-900 font-semibold max-w-[160px] truncate"
                      title="Viloyat yoki shahar bo'yicha filtr"
                    >
                      <option value="all">Barcha viloyatlar</option>
                      {uniqueRegions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Tuman bo'yicha filtr */}
                <div className="relative flex items-center">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700">
                    <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <select
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      className="bg-transparent outline-none cursor-pointer text-neutral-900 font-semibold max-w-[150px] truncate"
                      title="Tuman bo'yicha filtr"
                    >
                      <option value="all">Barcha tumanlar</option>
                      {uniqueDistricts.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Yangi qo'shilganlar (Sort selector) */}
                <div className="relative flex items-center">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700">
                    <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    <select
                      value={sortType}
                      onChange={(e) => setSortType(e.target.value as SortType)}
                      className="bg-transparent outline-none cursor-pointer text-neutral-900 font-semibold"
                    >
                      <option value="newest">Yangi qo'shilganlar</option>
                      <option value="name">Ism bo'yicha (A-Z)</option>
                      <option value="debt_desc">Qarzdorlik (kamayish)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Export XLSX */}
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-900 transition min-h-[38px] disabled:opacity-50 cursor-pointer"
                title="Excel (.xlsx) formatida yuklab olish"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>{isExporting ? 'Yuklanmoqda...' : 'Excel (.xlsx)'}</span>
              </button>
            </div>

            {/* 1-Blok Sana / Muddat oralig'i bo'yicha qarzdorlik va haqdorlikni ko'rish */}
            <div className="p-3 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-950">
                  <Calendar className="w-4 h-4 text-rose-700" />
                  <span>Kun yoki muddat oralig'i bo'yicha qarzdorlik / haqdorlik:</span>
                </span>

                <div className="flex items-center gap-1 flex-wrap text-[11px]">
                  <button
                    type="button"
                    onClick={() => applyBlock1QuickDate('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      !block1StartDate && !block1EndDate
                        ? 'bg-rose-700 text-white shadow-2xs'
                        : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    Joriy holat (Barchasi)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBlock1QuickDate('today')}
                    className="px-2.5 py-1 rounded-lg font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Bugun
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBlock1QuickDate('yesterday')}
                    className="px-2.5 py-1 rounded-lg font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Kecha
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBlock1QuickDate(7)}
                    className="px-2.5 py-1 rounded-lg font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Oxirgi 7 kun
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBlock1QuickDate('month')}
                    className="px-2.5 py-1 rounded-lg font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Shu oy
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBlock1QuickDate(30)}
                    className="px-2.5 py-1 rounded-lg font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Oxirgi 30 kun
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Aniq 1 kun tanlash */}
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-rose-200 text-xs">
                    <span className="text-rose-800 font-bold">Aniq kun:</span>
                    <input
                      type="date"
                      value={
                        block1StartDate && block1StartDate === block1EndDate ? block1StartDate : ''
                      }
                      onChange={(e) => {
                        setBlock1StartDate(e.target.value);
                        setBlock1EndDate(e.target.value);
                      }}
                      className="font-mono font-bold text-neutral-900 bg-transparent outline-none cursor-pointer"
                    />
                  </div>

                  {/* Muddat oralig'i: Dan — Gacha */}
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-neutral-200 text-xs">
                    <span className="text-neutral-500 font-semibold">Dan:</span>
                    <input
                      type="date"
                      value={block1StartDate}
                      onChange={(e) => setBlock1StartDate(e.target.value)}
                      className="font-mono font-bold text-neutral-900 bg-transparent outline-none cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-neutral-200 text-xs">
                    <span className="text-neutral-500 font-semibold">Gacha:</span>
                    <input
                      type="date"
                      value={block1EndDate}
                      onChange={(e) => setBlock1EndDate(e.target.value)}
                      className="font-mono font-bold text-neutral-900 bg-transparent outline-none cursor-pointer"
                    />
                  </div>

                  {(block1StartDate || block1EndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setBlock1StartDate('');
                        setBlock1EndDate('');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-bold cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Sanani tozalash</span>
                    </button>
                  )}
                </div>

                {(block1StartDate || block1EndDate) && (
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-rose-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setBlock1DateCalcMode('snapshot')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        block1DateCalcMode === 'snapshot'
                          ? 'bg-rose-700 text-white'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      Sana holatidagi balans
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlock1DateCalcMode('period_activity')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        block1DateCalcMode === 'period_activity'
                          ? 'bg-rose-700 text-white'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      Shu muddatdagi qarz / to'lov
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Filter Tabs: Faqat Barchasi, Qarzdorlar, Haqdorlar */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 text-xs">
              <span className="text-[11px] font-bold text-neutral-500 uppercase mr-1">Filtr:</span>
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Barchasi ({clients.length})
              </button>
              <button
                onClick={() => setFilterType('debtors')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] cursor-pointer ${
                  filterType === 'debtors'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                Qarzdorlar ({globalTabCounts.debtors})
              </button>
              <button
                onClick={() => setFilterType('creditors')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition min-h-[34px] cursor-pointer ${
                  filterType === 'creditors'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                Haqdorlar ({globalTabCounts.creditors})
              </button>

              {selectedRegion !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-900 border border-rose-300 font-bold text-xs ml-auto">
                  <MapPin className="w-3.5 h-3.5 text-rose-700" />
                  <span>Viloyat: {selectedRegion}</span>
                  <button
                    onClick={() => {
                      setSelectedRegion('all');
                      setSelectedDistrict('all');
                    }}
                    className="p-0.5 hover:bg-rose-200 rounded text-rose-800 transition cursor-pointer"
                    title="Viloyat filtrini tozalash"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}

              {selectedDistrict !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 border border-neutral-300 font-bold text-xs">
                  <MapPin className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Tuman: {selectedDistrict}</span>
                  <button
                    onClick={() => setSelectedDistrict('all')}
                    className="p-0.5 hover:bg-neutral-200 rounded text-neutral-800 transition cursor-pointer"
                    title="Tuman filtrini tozalash"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}

              {isBlock1FilterActive && (
                <button
                  type="button"
                  onClick={resetBlock1Filters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs ml-auto transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Filtrlarni tozalash</span>
                </button>
              )}
            </div>
          </div>

          {/* 1-Blok Xulosaviy qiymatlar (Mahsulotlar jami qiymati olib tashlangan) */}
          <div
            className={`rounded-2xl p-4 border shadow-xs transition ${
              isBlock1FilterActive
                ? 'bg-gradient-to-r from-rose-50/90 via-white to-emerald-50/60 border-rose-300 ring-1 ring-rose-200/70'
                : 'bg-white border-rose-100'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-neutral-200/80">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider ${
                    isBlock1FilterActive ? 'bg-rose-700 text-white' : 'bg-neutral-800 text-white'
                  }`}
                >
                  {isBlock1FilterActive
                    ? "1-Blok: Filtr natijasi bo'yicha xulosa"
                    : "1-Blok: Jadval bo'yicha xulosaviy qiymatlar"}
                </span>
                {(block1StartDate || block1EndDate) && (
                  <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 text-[11px] font-bold">
                    Muddat:{' '}
                    {block1StartDate && block1StartDate === block1EndDate
                      ? formatDateDMY(block1StartDate)
                      : `${block1StartDate ? formatDateDMY(block1StartDate) : 'Boshidan'} — ${
                          block1EndDate ? formatDateDMY(block1EndDate) : 'Bugungacha'
                        }`}
                  </span>
                )}
                <span className="text-xs font-semibold text-neutral-600">
                  Ko'rsatilmoqda:{' '}
                  <strong className="text-neutral-900">{filteredSummary.totalCount} ta</strong> mijoz
                  {isBlock1FilterActive && (
                    <span>
                      {' '}
                      (jami {filteredSummary.allClientsCount} tadan{' '}
                      {filteredSummary.allClientsCount > 0
                        ? Math.round(
                            (filteredSummary.totalCount / filteredSummary.allClientsCount) * 100
                          )
                        : 0}
                      %)
                    </span>
                  )}
                </span>
              </div>

              {filteredSummary.maxDebtor && (
                <div className="text-[11px] text-rose-900 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 font-medium">
                  Eng katta qarzdor:{' '}
                  <strong className="font-bold">{filteredSummary.maxDebtor.name}</strong> (
                  <span className="font-mono font-bold text-rose-700">
                    {formatMoney(filteredSummary.maxDebtor.currentDebt)}
                  </span>
                  )
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* 1. Mijozlar soni va holati */}
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/90">
                <div className="text-[10px] font-bold uppercase text-neutral-500">
                  Jadvaldagi mijozlar
                </div>
                <div className="text-base sm:text-lg font-extrabold font-mono text-neutral-900 mt-0.5">
                  {filteredSummary.totalCount} ta
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  Qarzdor: {filteredSummary.debtorsCount} • Haqdor: {filteredSummary.creditorsCount}
                </div>
              </div>

              {/* 2. Jami qarzdorlik */}
              <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-200">
                <div className="text-[10px] font-bold uppercase text-rose-800">
                  Jami qarzdorlik (Jadval)
                </div>
                <div className="text-base sm:text-lg font-extrabold font-mono text-rose-700 mt-0.5">
                  {formatMoney(filteredSummary.totalDebt)}
                </div>
                <div className="text-[10px] text-rose-900/70 mt-0.5">
                  {filteredSummary.debtorsCount} ta qarzdor (o'rtacha{' '}
                  {formatMoney(Math.round(filteredSummary.avgDebtPerDebtor))})
                </div>
              </div>

              {/* 3. Jami haqdorlik */}
              <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200">
                <div className="text-[10px] font-bold uppercase text-emerald-800">
                  Jami haqdorlik / avans
                </div>
                <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-700 mt-0.5">
                  {formatMoney(filteredSummary.totalAdvance)}
                </div>
                <div className="text-[10px] text-emerald-900/70 mt-0.5">
                  {filteredSummary.creditorsCount} ta haqdor mijozda
                </div>
              </div>

              {/* 4. Sof balans farqi */}
              <div className="p-3 rounded-xl bg-neutral-900 text-white border border-neutral-800">
                <div className="text-[10px] font-bold uppercase text-neutral-400">
                  Sof balans (Qarz − Haq)
                </div>
                <div
                  className={`text-base sm:text-lg font-extrabold font-mono mt-0.5 ${
                    filteredSummary.netBalance >= 0 ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  {formatMoney(Math.abs(filteredSummary.netBalance))}
                </div>
                <div className="text-[10px] text-neutral-300 mt-0.5">
                  {filteredSummary.netBalance >= 0
                    ? 'Sof undiriladigan qarz'
                    : 'Sof mijoz haqdorligi'}
                </div>
              </div>
            </div>
          </div>

          {/* Empty State */}
          {filteredClients.length === 0 && (
            <div className="bg-white rounded-3xl p-10 text-center border border-rose-100 shadow-xs space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold font-display text-neutral-900">
                Mijozlar topilmadi
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {searchQuery
                  ? `"${searchQuery}" so'rovi bo'yicha hech qanday mijoz topilmadi. Qidiruv so'zini o'zgartirib ko'ring.`
                  : "Hozircha hech qanday mijoz kiritilmagan. Birinchi mijozingizni qo'shing."}
              </p>
              <button
                onClick={onOpenAddModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition shadow-xs"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Yangi mijoz qo'shish</span>
              </button>
            </div>
          )}

          {/* 1-Blok Desktop & Tablet Table (Topshirilgan tovarlar, Mahsulotlar qiymati, Ombordagi qarzdorlik, To'lov kiritish olib tashlangan) */}
          {filteredClients.length > 0 && (
            <div className="hidden md:block bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
              <StickyTableWrapper>
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-rose-50 border-b border-rose-100 text-neutral-800 uppercase tracking-wider font-bold sticky top-0 z-20">
                    <tr>
                      <th className="py-3.5 px-4">Mijoz ismi & Telefon</th>
                      <th className="py-3.5 px-4">Manzili</th>
                      <th className="py-3.5 px-4 text-right">
                        {block1StartDate || block1EndDate ? 'Tanlangan davr qarzdorligi' : 'Joriy qarzdorlik'}
                      </th>
                      <th className="py-3.5 px-4 text-right">
                        {block1StartDate || block1EndDate ? 'Tanlangan davr haqdorligi' : 'Joriy haqdorlik'}
                      </th>
                      <th className="py-3.5 px-4">Qo'shgan & Sana</th>
                      <th className="py-3.5 px-4 text-center">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100/60">
                    {visibleClients.map((client) => {
                      const bal = clientBlock1BalanceMap.get(client.id);
                      const dispDebt = bal ? bal.debt : client.currentDebt;
                      const dispAdv = bal ? bal.advance : client.currentAdvance;
                      return (
                        <tr
                          key={client.id}
                          className="hover:bg-rose-50/30 transition-colors group cursor-pointer"
                          onClick={() => onViewClient(client)}
                        >
                          {/* Name & Phone */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-sm text-neutral-900 group-hover:text-rose-700 transition-colors">
                              {client.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-neutral-600 mt-0.5">
                              <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="font-mono text-[11px] tabular-nums font-semibold">
                                {client.phone || "Telefon yo'q"}
                              </span>
                            </div>
                            {client.lastPlanCloseReason && (
                              <div
                                className="mt-1 flex items-center gap-1 text-[10px] text-rose-800 font-semibold truncate max-w-[200px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                                title={`Reja yopilish sababi: ${client.lastPlanCloseReason}`}
                              >
                                <Lock className="w-2.5 h-2.5 text-rose-700 shrink-0" />
                                <span className="truncate">
                                  Yopilgan: "{client.lastPlanCloseReason}"
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Address: Viloyat, Tuman, Mo'ljal */}
                          <td className="py-3.5 px-4 max-w-[260px]">
                            <div className="flex items-start gap-1.5 text-neutral-700">
                              <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <div
                                  className="font-semibold text-neutral-900 truncate"
                                  title={
                                    [client.region, client.district].filter(Boolean).join(', ') ||
                                    client.address
                                  }
                                >
                                  {[client.region, client.district].filter(Boolean).join(', ') ||
                                    client.address ||
                                    "Ko'rsatilmagan"}
                                </div>
                                {client.landmark && (
                                  <div
                                    className="text-[11px] text-neutral-500 truncate"
                                    title={`Mo'ljal: ${client.landmark}`}
                                  >
                                    Mo'ljal: {client.landmark}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Debt */}
                          <td className="py-3.5 px-4 text-right">
                            {dispDebt > 0 ? (
                              <div className="inline-block px-2.5 py-1 rounded-lg bg-rose-100/90 text-rose-900 font-mono font-bold text-xs tabular-nums border border-rose-200">
                                {formatMoney(dispDebt)}
                              </div>
                            ) : (
                              <span className="text-neutral-400 font-mono">0 USD</span>
                            )}
                          </td>

                          {/* Advance (Haqdorlik) */}
                          <td className="py-3.5 px-4 text-right">
                            {dispAdv > 0 ? (
                              <div className="inline-block px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-900 font-mono font-bold text-xs tabular-nums border border-emerald-200">
                                {formatMoney(dispAdv)}
                              </div>
                            ) : (
                              <span className="text-neutral-400 font-mono">0 USD</span>
                            )}
                          </td>

                          {/* Author & Date */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                  client.createdBy === 'agentp1'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-rose-100 text-rose-900 border border-rose-200'
                                }`}
                              >
                                {getAgentDisplayName(client.createdBy || 'adminc')}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                              {formatDate(client.createdAt)}
                            </div>
                          </td>

                          {/* Actions (Faqat Ko'rish, Tahrirlash, O'chirish) */}
                          <td
                            className="py-3.5 px-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => onViewClient(client)}
                                className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                                title="Batafsil ko'rish"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {userRole !== 'agent' && (
                                <button
                                  onClick={() => onEditClient(client)}
                                  className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                                  title="Tahrirlash"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => setClientToDelete(client)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                                  title="Mijoz va ma'lumotlarini o'chirish"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-rose-50/90 border-t-2 border-rose-200 text-neutral-900 font-bold text-xs">
                    <tr>
                      <td colSpan={2} className="py-3.5 px-4">
                        <div className="font-extrabold text-neutral-900 uppercase tracking-wide">
                          JAMI XULOSA ({filteredSummary.totalCount} ta mijoz)
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-500 mt-0.5">
                          Qarzdor: {filteredSummary.debtorsCount} ta • Haqdor:{' '}
                          {filteredSummary.creditorsCount} ta
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-rose-800 bg-rose-100/80 tabular-nums">
                        {formatMoney(filteredSummary.totalDebt)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-800 bg-emerald-100/80 tabular-nums">
                        {formatMoney(filteredSummary.totalAdvance)}
                      </td>
                      <td colSpan={2} className="py-3.5 px-4 text-right text-[11px] font-mono">
                        <span className="text-neutral-500 mr-1">Sof balans:</span>
                        <span
                          className={`font-extrabold ${
                            filteredSummary.netBalance >= 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatMoney(Math.abs(filteredSummary.netBalance))}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </StickyTableWrapper>
            </div>
          )}

          {/* 1-Blok Mobile Card List (< 768px) */}
          {filteredClients.length > 0 && (
            <div className="md:hidden space-y-3">
              {visibleClients.map((client) => {
                const bal = clientBlock1BalanceMap.get(client.id);
                const dispDebt = bal ? bal.debt : client.currentDebt;
                const dispAdv = bal ? bal.advance : client.currentAdvance;
                return (
                  <div
                    key={client.id}
                    onClick={() => onViewClient(client)}
                    className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs space-y-3 active:bg-rose-50/40 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-rose-700 text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {client.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-neutral-900 leading-tight">
                            {client.name}
                          </h4>
                          <p
                            className="text-[11px] text-neutral-500 truncate max-w-[200px]"
                            title={client.address}
                          >
                            {[client.region, client.district].filter(Boolean).join(', ') ||
                              client.address ||
                              "Manzil ko'rsatilmagan"}
                            {client.landmark ? ` (${client.landmark})` : ''}
                          </p>
                          {client.lastPlanCloseReason && (
                            <div
                              className="mt-1 flex items-center gap-1 text-[10px] text-rose-800 font-semibold truncate max-w-[200px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                              title={`Reja yopilish sababi: ${client.lastPlanCloseReason}`}
                            >
                              <Lock className="w-2.5 h-2.5 text-rose-700 shrink-0" />
                              <span className="truncate">
                                Yopilgan: "{client.lastPlanCloseReason}"
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <a
                        href={`tel:${client.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-rose-50 text-neutral-800 hover:text-rose-700 flex items-center justify-center border border-neutral-200 transition min-h-[44px] min-w-[44px]"
                        title="Qo'ng'iroq qilish"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>

                    {/* Balances: Debt and Advance */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/80">
                        <span className="text-[10px] font-bold text-rose-900 uppercase block">
                          Joriy Qarzdorlik:
                        </span>
                        <span className="font-mono font-bold text-neutral-900 text-xs tabular-nums block mt-0.5">
                          {formatMoney(dispDebt)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
                        <span className="text-[10px] font-bold text-emerald-900 uppercase block">
                          Haqdorlik / Avans:
                        </span>
                        <span className="font-mono font-bold text-neutral-900 text-xs tabular-nums block mt-0.5">
                          {formatMoney(dispAdv)}
                        </span>
                      </div>
                    </div>

                    {/* Author & Creation date on mobile */}
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                      <span className="flex items-center gap-1.5">
                        <span>Qo'shgan:</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                            client.createdBy === 'agentp1'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-rose-100 text-rose-900 border border-rose-200'
                          }`}
                        >
                          {getAgentDisplayName(client.createdBy || 'adminc')}
                        </span>
                      </span>
                      <span className="font-mono text-[10px]">{formatDate(client.createdAt)}</span>
                    </div>

                    {/* Quick actions for mobile (Faqat Ko'rish, Tahrirlash, O'chirish) */}
                    <div
                      className="pt-1 flex items-center justify-between gap-2 border-t border-neutral-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onViewClient(client)}
                        className="flex-1 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition min-h-[44px] flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ko'rish</span>
                      </button>

                      {userRole !== 'agent' && (
                        <button
                          onClick={() => onEditClient(client)}
                          className="p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                          title="Tahrirlash"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setClientToDelete(client)}
                          className="p-2 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                          title="Mijoz va ma'lumotlarini o'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 1-Blok Smart Pagination Bar */}
          {filteredClients.length > 25 && (
            <div className="bg-white rounded-2xl px-4 py-3 border border-rose-100 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-neutral-600">
                <span>Sahifada ko'rsatish:</span>
                <select
                  value={pageSize}
                  onChange={(e) =>
                    setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-neutral-50 font-bold text-neutral-900 outline-none cursor-pointer"
                >
                  <option value={50}>50 ta</option>
                  <option value={100}>100 ta</option>
                  <option value={250}>250 ta</option>
                  <option value="all">Barchasi ({filteredClients.length} ta)</option>
                </select>
                <span className="text-neutral-500 hidden sm:inline">
                  • Jami {filteredClients.length} tadan {visibleClients.length} tasi ekranda
                </span>
              </div>

              {pageSize !== 'all' && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40 font-semibold text-neutral-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Oldingi</span>
                  </button>
                  <span className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-mono font-bold">
                    {safeCurrentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40 font-semibold text-neutral-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>Keyingi</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* 2-BLOK CONTENT: MAHSULOTLAR ASOSIDA FILTR VA TAHLIL                   */}
      {/* ===================================================================== */}
      {activeClientBlock === 'block2' && (
        <>
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-indigo-100 shadow-xs space-y-4">
            {/* Search & Excel Export Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-indigo-600">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Mijoz ismi, telefoni, manzili yoki olgan mahsulot nomi bo'yicha qidirish..."
                  value={block2Search}
                  onChange={(e) => setBlock2Search(e.target.value)}
                  className="w-full pl-12 pr-24 py-3 bg-neutral-50/90 focus:bg-white rounded-2xl border-2 border-neutral-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-xs sm:text-sm font-medium text-neutral-900 placeholder:text-neutral-400 outline-none transition"
                />
                {block2Search && (
                  <button
                    type="button"
                    onClick={() => setBlock2Search('')}
                    className="absolute inset-y-0 right-2 my-auto h-7 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-700 flex items-center gap-1 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Tozalash</span>
                  </button>
                )}
              </div>

              <button
                onClick={handleExportBlock2Excel}
                disabled={isExportingBlock2 || block2FilteredRows.length === 0}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-900 transition min-h-[42px] disabled:opacity-50 cursor-pointer shrink-0"
                title="2-Blok jadvalini Excel (.xlsx) formatida yuklab olish"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>{isExportingBlock2 ? 'Yuklanmoqda...' : 'Excel (.xlsx)'}</span>
              </button>
            </div>

            {/* 1-Qadam: Maxsus kun yoki vaqt oralig'ini tanlash */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-950">
                    <Calendar className="w-4 h-4 text-indigo-700" />
                    <span>1. Maxsus kun yoki kunlar oralig'ini tanlash:</span>
                  </span>
                </div>

                {/* Tezkor davr tugmalari */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <button
                    type="button"
                    onClick={() => applyQuickDateRange('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      !block2StartDate && !block2EndDate
                        ? 'bg-indigo-700 text-white shadow-2xs'
                        : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    Barcha vaqt
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateRange('today')}
                    className="px-2.5 py-1 rounded-lg font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Bugun
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateRange('yesterday')}
                    className="px-2.5 py-1 rounded-lg font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Kecha
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateRange(7)}
                    className="px-2.5 py-1 rounded-lg font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Oxirgi 7 kun
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateRange('month')}
                    className="px-2.5 py-1 rounded-lg font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Shu oy
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateRange(30)}
                    className="px-2.5 py-1 rounded-lg font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Oxirgi 30 kun
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-300 text-xs">
                  <span className="text-indigo-800 font-bold">Aniq kun:</span>
                  <input
                    type="date"
                    value={
                      block2StartDate && block2StartDate === block2EndDate ? block2StartDate : ''
                    }
                    onChange={(e) => {
                      setBlock2StartDate(e.target.value);
                      setBlock2EndDate(e.target.value);
                    }}
                    className="font-mono font-bold text-neutral-900 bg-transparent outline-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 text-xs">
                  <span className="text-neutral-500 font-semibold">Dan:</span>
                  <input
                    type="date"
                    value={block2StartDate}
                    onChange={(e) => setBlock2StartDate(e.target.value)}
                    className="font-mono font-bold text-neutral-900 bg-transparent outline-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 text-xs">
                  <span className="text-neutral-500 font-semibold">Gacha:</span>
                  <input
                    type="date"
                    value={block2EndDate}
                    onChange={(e) => setBlock2EndDate(e.target.value)}
                    className="font-mono font-bold text-neutral-900 bg-transparent outline-none cursor-pointer"
                  />
                </div>

                {(block2StartDate || block2EndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setBlock2StartDate('');
                      setBlock2EndDate('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Sanani tozalash</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2-Qadam: Shu vaqt oralig'ida bitta yoki undan ko'p turdagi mahsulot olganlarni filtrlash */}
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/90 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-neutral-900">
                  <Package className="w-4 h-4 text-indigo-700" />
                  <span>
                    2. Shu vaqt oralig'ida bitta yoki undan ko'p turdagi mahsulot olganlarni filtrlash:
                  </span>
                </span>

                {/* Mahsulot turlari soni bo'yicha tezkor filtr */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-200 text-[11px] flex-wrap">
                  <button
                    type="button"
                    onClick={() => setProductTypeCountFilter('any_taken')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      productTypeCountFilter === 'any_taken'
                        ? 'bg-indigo-700 text-white shadow-2xs'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    Barchasi (1+ tur olganlar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductTypeCountFilter('single_type')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      productTypeCountFilter === 'single_type'
                        ? 'bg-indigo-700 text-white shadow-2xs'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    Faqat 1 turdagi mahsulot olganlar
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductTypeCountFilter('multi_type')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      productTypeCountFilter === 'multi_type'
                        ? 'bg-indigo-700 text-white shadow-2xs'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    2 va undan ko'p turdagi mahsulot olganlar
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Qidirish orqali bir yoki bir nechta mahsulotlarni tanlash */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsProductPickerOpen((prev) => !prev)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      selectedProducts.length > 0
                        ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                        : 'bg-white hover:bg-indigo-50/70 text-indigo-950 border-indigo-300'
                    }`}
                  >
                    <Layers className="w-4 h-4 shrink-0" />
                    <span>
                      {selectedProducts.length > 0
                        ? `Tanlangan mahsulotlar (${selectedProducts.length} ta)`
                        : 'Mahsulotlarni qidirish va tanlash (1 yoki bir nechta)...'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        isProductPickerOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isProductPickerOpen && (
                    <div className="absolute left-0 top-full mt-1.5 z-40 w-80 sm:w-96 bg-white rounded-2xl border border-indigo-200 shadow-2xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-100">
                        <span className="text-xs font-extrabold text-neutral-900">
                          Mahsulotlarni qidiring va belgilang
                        </span>
                        <div className="flex items-center gap-1.5">
                          {selectedProducts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedProducts([])}
                              className="text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 px-2 py-0.5 rounded-lg cursor-pointer"
                            >
                              Tozalash ({selectedProducts.length})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsProductPickerOpen(false)}
                            className="text-xs font-bold text-neutral-500 hover:text-neutral-800 px-1.5 py-0.5 rounded-lg bg-neutral-100 cursor-pointer"
                          >
                            Yopish ✕
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Mahsulot nomini yozib qidiring..."
                          value={productFilterSearch}
                          onChange={(e) => setProductFilterSearch(e.target.value)}
                          className="w-full pl-8.5 pr-8 py-2 rounded-xl border border-neutral-300 focus:border-indigo-600 text-xs font-medium text-neutral-900 outline-none bg-neutral-50 focus:bg-white"
                        />
                        {productFilterSearch && (
                          <button
                            type="button"
                            onClick={() => setProductFilterSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100 border border-neutral-100 rounded-xl">
                        {(() => {
                          const q = productFilterSearch.toLowerCase().trim();
                          const matchingCatalog = q
                            ? uniqueProductCatalog.filter((p) => p.name.toLowerCase().includes(q))
                            : uniqueProductCatalog;

                          if (matchingCatalog.length === 0) {
                            return (
                              <div className="p-4 text-center text-xs text-neutral-400">
                                Mahsulot topilmadi
                              </div>
                            );
                          }

                          return matchingCatalog.map((prod) => {
                            const isSel = selectedProducts.some(
                              (s) => s.toLowerCase() === prod.key
                            );
                            return (
                              <button
                                key={prod.key}
                                type="button"
                                onClick={() => toggleProductSelection(prod.name)}
                                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-xs transition cursor-pointer ${
                                  isSel
                                    ? 'bg-indigo-50/90 text-indigo-950 font-bold'
                                    : 'hover:bg-neutral-50 text-neutral-800'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                      isSel
                                        ? 'bg-indigo-700 border-indigo-700 text-white'
                                        : 'border-neutral-300 bg-white'
                                    }`}
                                  >
                                    {isSel && <Check className="w-3 h-3 stroke-[3]" />}
                                  </span>
                                  <span className="truncate">{prod.name}</span>
                                </div>
                                <span className="text-[10px] font-mono text-neutral-500 shrink-0">
                                  {prod.clientsCount} mijoz • {prod.totalTimes} marta •{' '}
                                  {formatNumber(prod.totalQty)} dona
                                </span>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Agar 2 yoki undan ko'p mahsulot tanlangan bo'lsa, moslik sharti */}
                {selectedProducts.length > 1 && (
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-indigo-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setProductMatchMode('any')}
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition ${
                        productMatchMode === 'any'
                          ? 'bg-indigo-700 text-white'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      Kamida bittasini olganlar
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductMatchMode('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition ${
                        productMatchMode === 'all'
                          ? 'bg-indigo-700 text-white'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      Barchasini birga olganlar
                    </button>
                  </div>
                )}
              </div>

              {/* Tanlangan mahsulotlar chiplari */}
              {selectedProducts.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase mr-1">
                    Tanlangan mahsulotlar ({selectedProducts.length}):
                  </span>
                  {selectedProducts.map((prodName) => (
                    <span
                      key={prodName}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-700 text-white shadow-2xs"
                    >
                      <span>{prodName}</span>
                      <button
                        type="button"
                        onClick={() => toggleProductSelection(prodName)}
                        className="hover:bg-white/20 rounded p-0.5 cursor-pointer"
                        title="Tanlovdan olib tashlash"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedProducts([])}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                  >
                    ✕ Barchasini tozalash
                  </button>
                </div>
              )}
            </div>

            {/* 3-Qadam: Eng ko'p va eng kam olganlar bo'yicha saralash / filtrlash */}
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-950">
                  <ArrowUpDown className="w-4 h-4 text-amber-700" />
                  <span>3. Eng ko'p va eng kam olganlar bo'yicha filtrlash:</span>
                </span>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBlock2OrderMode('qty_desc')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      block2OrderMode === 'qty_desc'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-neutral-800 border border-amber-200 hover:bg-amber-100/50'
                    }`}
                  >
                    Eng ko'p olganlar (Miqdori ↓)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlock2OrderMode('qty_asc')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      block2OrderMode === 'qty_asc'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-neutral-800 border border-amber-200 hover:bg-amber-100/50'
                    }`}
                  >
                    Eng kam olganlar (Miqdori ↑)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlock2OrderMode('sum_desc')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      block2OrderMode === 'sum_desc'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-neutral-800 border border-amber-200 hover:bg-amber-100/50'
                    }`}
                  >
                    Summasi eng ko'p ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlock2OrderMode('sum_asc')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      block2OrderMode === 'sum_asc'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-neutral-800 border border-amber-200 hover:bg-amber-100/50'
                    }`}
                  >
                    Summasi eng kam ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlock2OrderMode('count_desc')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      block2OrderMode === 'count_desc'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-neutral-800 border border-amber-200 hover:bg-amber-100/50'
                    }`}
                  >
                    Eng ko'p marta olganlar ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlock2OrderMode('count_asc')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      block2OrderMode === 'count_asc'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-neutral-800 border border-amber-200 hover:bg-amber-100/50'
                    }`}
                  >
                    Eng kam marta olganlar ↑
                  </button>
                </div>
              </div>

              {/* Min va Max miqdor filtri */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-amber-200 text-xs">
                <span className="text-[10px] font-bold text-neutral-500 uppercase">Miqdor:</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Min"
                  value={minProductQty}
                  onChange={(e) => setMinProductQty(e.target.value)}
                  className="w-20 px-2 py-0.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs font-mono font-bold text-neutral-900 outline-none focus:border-indigo-500"
                />
                <span className="text-neutral-400">—</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Max"
                  value={maxProductQty}
                  onChange={(e) => setMaxProductQty(e.target.value)}
                  className="w-20 px-2 py-0.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs font-mono font-bold text-neutral-900 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {isBlock2FilterActive && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={resetBlock2Filters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>2-Blok filtrlarini tozalash</span>
                </button>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* 2-BLOK KO'RSATKICHLARI: JAMI QIYMATI, NASIYASIZ VA NASIYAGA       */}
          {/* ================================================================= */}
          <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/60 border border-indigo-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-indigo-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-700 text-white text-[11px] font-extrabold uppercase tracking-wider">
                  2-Blok ko'rsatkichlari
                </span>
                <span className="text-xs font-semibold text-neutral-600">
                  Muddat:{' '}
                  <strong className="text-neutral-900">
                    {block2StartDate || block2EndDate
                      ? `${block2StartDate ? formatDateDMY(block2StartDate) : 'Boshidan'} — ${
                          block2EndDate ? formatDateDMY(block2EndDate) : 'Bugungacha'
                        }`
                      : 'Barcha vaqt'}
                  </strong>
                </span>
              </div>

              <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                Jami {block2Summary.clientsCount} ta mijoz • {block2Summary.totalTimesDelivered} marta
                mahsulot berilgan
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Tanlangan muddatdagi tanlangan mahsulotlar qiymati */}
              <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase text-indigo-900">
                    Tanlangan mahsulotlar qiymati
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-extrabold font-mono text-neutral-900 mt-1">
                  {formatMoney(block2Summary.totalSumUsd)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1 font-medium">
                  Jami miqdor: <strong className="text-neutral-800">{formatNumber(block2Summary.totalQuantity)}</strong> dona
                </div>
              </div>

              {/* 2. Qanchasi nasiyasiz sotilgani */}
              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase text-emerald-900">
                    Nasiyasiz sotilgani (To'langan)
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-extrabold font-mono text-emerald-800 mt-1">
                  {formatMoney(block2Summary.paidSumUsd)}
                </div>
                <div className="text-[11px] text-emerald-900/80 mt-1 font-semibold">
                  Umumiy savdoning <strong>{block2Summary.paidPercent}%</strong> qismi nasiyasiz
                </div>
              </div>

              {/* 3. Qanchasi nasiyaga sotilgani */}
              <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase text-rose-900">
                    Nasiyaga sotilgani (Qarzga)
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-extrabold font-mono text-rose-800 mt-1">
                  {formatMoney(block2Summary.creditSumUsd)}
                </div>
                <div className="text-[11px] text-rose-900/80 mt-1 font-semibold">
                  Umumiy savdoning <strong>{block2Summary.creditPercent}%</strong> qismi nasiyaga
                </div>
              </div>
            </div>
          </div>

          {/* 2-Blok Empty State */}
          {block2FilteredRows.length === 0 && (
            <div className="bg-white rounded-3xl p-10 text-center border border-indigo-100 shadow-xs space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Package className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold font-display text-neutral-900">
                Tanlangan filtr va vaqt oralig'ida mahsulot olgan mijozlar topilmadi
              </h3>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Vaqt oralig'ini kengaytiring yoki mahsulot filtrini o'zgartirib ko'ring.
              </p>
              {isBlock2FilterActive && (
                <button
                  type="button"
                  onClick={resetBlock2Filters}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Filtrlarni tozalash</span>
                </button>
              )}
            </div>
          )}

          {/* 2-Blok Desktop Table */}
          {block2FilteredRows.length > 0 && (
            <div className="hidden md:block bg-white rounded-3xl border border-indigo-100 shadow-xs overflow-hidden">
              <StickyTableWrapper>
                <table className="w-full min-w-[960px] text-left text-xs">
                  <thead className="bg-indigo-50/90 border-b border-indigo-100 text-neutral-800 uppercase tracking-wider font-bold sticky top-0 z-20">
                    <tr>
                      <th className="py-3.5 px-4">Mijoz ismi & Telefon</th>
                      <th className="py-3.5 px-4">Manzili</th>
                      <th className="py-3.5 px-4">
                        Qaysi mahsulot necha marta olingani
                      </th>
                      <th className="py-3.5 px-4 text-right">Jami miqdori (dona)</th>
                      <th className="py-3.5 px-4 text-right">Nasiyasiz sotilgan</th>
                      <th className="py-3.5 px-4 text-right">Nasiyaga sotilgan</th>
                      <th className="py-3.5 px-4 text-right">Mahsulotlar qiymati</th>
                      <th className="py-3.5 px-4 text-center">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-100/60">
                    {visibleBlock2Rows.map((row) => {
                      const { client, matchedProducts } = row;
                      return (
                        <tr
                          key={client.id}
                          onClick={() => onViewClient(client)}
                          className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                        >
                          {/* Mijoz ismi & Telefon */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-sm text-neutral-900 group-hover:text-indigo-700 transition-colors">
                              {client.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-neutral-600 mt-0.5">
                              <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="font-mono text-[11px] tabular-nums font-semibold">
                                {client.phone || "Telefon yo'q"}
                              </span>
                            </div>
                          </td>

                          {/* Manzili */}
                          <td className="py-3.5 px-4 max-w-[200px]">
                            <div className="font-semibold text-neutral-900 truncate">
                              {[client.region, client.district].filter(Boolean).join(', ') ||
                                client.address ||
                                "Ko'rsatilmagan"}
                            </div>
                            {client.landmark && (
                              <div className="text-[11px] text-neutral-500 truncate">
                                Mo'ljal: {client.landmark}
                              </div>
                            )}
                          </td>

                          {/* Qaysi mahsulotni necha marta olgani (bitta ustunda har bir turdagi mahsulot bo'yicha) */}
                          <td className="py-3.5 px-4 max-w-[360px]">
                            <div className="space-y-1.5">
                              {matchedProducts.map((mp) => (
                                <div
                                  key={mp.productKey}
                                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200/80"
                                >
                                  <div className="min-w-0">
                                    <span className="font-bold text-neutral-900 block truncate">
                                      {mp.productName}
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-mono block">
                                      Miqdori: {formatNumber(mp.totalQuantity)} dona (
                                      {formatMoney(mp.totalSumUsd)})
                                    </span>
                                    {mp.dates && mp.dates.length > 0 && (
                                      <span className="text-[10px] text-neutral-400 font-mono block">
                                        Sana: {mp.dates.slice(0, 3).map(formatDateDMY).join(', ')}
                                        {mp.dates.length > 3 ? ` (+${mp.dates.length - 3})` : ''}
                                      </span>
                                    )}
                                  </div>
                                  <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono font-extrabold text-[11px] shrink-0">
                                    {mp.timesDelivered} marta olgan
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Jami miqdori (dona) va har bir mahsulot turi bo'yicha necha marta olingani */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="font-mono font-bold text-neutral-900 text-xs">
                              {formatNumber(row.totalQuantity)} dona
                            </div>
                            <div className="text-[10px] text-indigo-700 font-bold space-y-0.5 mt-0.5">
                              {matchedProducts.map((mp) => (
                                <div key={mp.productKey} className="truncate max-w-[180px] ml-auto">
                                  {mp.productName}: {mp.timesDelivered} marta
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Nasiyasiz sotilgan */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {row.paidSumUsd > 0 ? (
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-900 font-mono font-bold text-xs border border-emerald-200">
                                {formatMoney(row.paidSumUsd)}
                              </span>
                            ) : (
                              <span className="text-neutral-400 font-mono">0 USD</span>
                            )}
                          </td>

                          {/* Nasiyaga sotilgan */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {row.creditSumUsd > 0 ? (
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-rose-100/90 text-rose-900 font-mono font-bold text-xs border border-rose-200">
                                {formatMoney(row.creditSumUsd)}
                              </span>
                            ) : (
                              <span className="text-neutral-400 font-mono">0 USD</span>
                            )}
                          </td>

                          {/* Mahsulotlar jami qiymati */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span className="font-mono font-extrabold text-neutral-900 text-xs">
                              {formatMoney(row.totalSumUsd)}
                            </span>
                          </td>

                          {/* Amal */}
                          <td
                            className="py-3.5 px-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => onViewClient(client)}
                              className="p-1.5 rounded-lg text-neutral-600 hover:text-indigo-700 hover:bg-indigo-50 transition min-h-[36px] min-w-[36px] inline-flex items-center justify-center cursor-pointer"
                              title="Batafsil ko'rish"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-indigo-50/90 border-t-2 border-indigo-200 text-neutral-900 font-bold text-xs">
                    <tr>
                      <td colSpan={3} className="py-3.5 px-4">
                        <div className="font-extrabold text-neutral-900 uppercase">
                          JAMI ({block2Summary.clientsCount} ta mijoz)
                        </div>
                        <div className="text-[10px] text-neutral-600">
                          Jami miqdor: {formatNumber(block2Summary.totalQuantity)} dona
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold">
                        {formatNumber(block2Summary.totalQuantity)} dona
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-800 bg-emerald-100/80">
                        {formatMoney(block2Summary.paidSumUsd)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-rose-800 bg-rose-100/80">
                        {formatMoney(block2Summary.creditSumUsd)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-indigo-950">
                        {formatMoney(block2Summary.totalSumUsd)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </StickyTableWrapper>
            </div>
          )}

          {/* 2-Blok Mobile Cards (< 768px) */}
          {block2FilteredRows.length > 0 && (
            <div className="md:hidden space-y-3">
              {visibleBlock2Rows.map((row) => {
                const { client, matchedProducts } = row;
                return (
                  <div
                    key={client.id}
                    onClick={() => onViewClient(client)}
                    className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-xs space-y-3 active:bg-indigo-50/30 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-neutral-900">{client.name}</h4>
                        <p className="text-[11px] text-neutral-500">
                          {[client.region, client.district].filter(Boolean).join(', ') ||
                            client.address ||
                            "Manzil ko'rsatilmagan"}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px] font-mono font-bold">
                        {formatNumber(row.totalQuantity)} dona
                      </span>
                    </div>

                    {/* Qaysi mahsulot necha marta berilgani */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-neutral-500 block">
                        Olingan mahsulotlar va necha marta olingani:
                      </span>
                      {matchedProducts.map((mp) => (
                        <div
                          key={mp.productKey}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-neutral-900 block truncate">
                              {mp.productName}
                            </span>
                            <span className="text-[11px] text-neutral-500 font-mono">
                              {formatNumber(mp.totalQuantity)} dona •{' '}
                              {formatMoney(mp.totalSumUsd)}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-mono font-extrabold text-[11px] shrink-0">
                            {mp.timesDelivered} marta olgan
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Nasiyasiz, Nasiyaga va Jami qiymati */}
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-[10px] font-bold text-emerald-900 block">
                          Nasiyasiz:
                        </span>
                        <span className="font-mono font-bold text-emerald-800 text-[11px]">
                          {formatMoney(row.paidSumUsd)}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                        <span className="text-[10px] font-bold text-rose-900 block">
                          Nasiyaga:
                        </span>
                        <span className="font-mono font-bold text-rose-800 text-[11px]">
                          {formatMoney(row.creditSumUsd)}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200">
                        <span className="text-[10px] font-bold text-indigo-900 block">Jami:</span>
                        <span className="font-mono font-extrabold text-indigo-950 text-[11px]">
                          {formatMoney(row.totalSumUsd)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2-Blok Pagination */}
          {block2FilteredRows.length > 25 && (
            <div className="bg-white rounded-2xl px-4 py-3 border border-indigo-100 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-neutral-600">
                <span>Sahifada ko'rsatish:</span>
                <select
                  value={block2PageSize}
                  onChange={(e) =>
                    setBlock2PageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-neutral-50 font-bold text-neutral-900 outline-none cursor-pointer"
                >
                  <option value={50}>50 ta</option>
                  <option value={100}>100 ta</option>
                  <option value={250}>250 ta</option>
                  <option value="all">Barchasi ({block2FilteredRows.length} ta)</option>
                </select>
              </div>

              {block2PageSize !== 'all' && block2TotalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeBlock2Page <= 1}
                    onClick={() => setBlock2Page((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40 font-semibold text-neutral-800 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Oldingi</span>
                  </button>
                  <span className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-mono font-bold">
                    {safeBlock2Page} / {block2TotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeBlock2Page >= block2TotalPages}
                    onClick={() => setBlock2Page((p) => Math.min(block2TotalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40 font-semibold text-neutral-800 cursor-pointer"
                  >
                    <span>Keyingi</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Custom Confirmation Modal for Deleting Client (Adminc & Adminc1 only) */}
      {clientToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100"
          onClick={() => setClientToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 font-display">
                  Mijozni o'chirishni tasdiqlaysizmi?
                </h3>
                <p className="text-xs text-rose-700 font-semibold">
                  Faqat {currentUsername || 'Admin'} vakolatida
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200/80 text-xs text-neutral-700 space-y-1.5">
              <div className="font-bold text-neutral-900 text-sm">{clientToDelete.name}</div>
              <div className="text-neutral-600">
                Telefon:{' '}
                <span className="font-mono font-semibold">{clientToDelete.phone || "Yo'q"}</span>
              </div>
              {clientToDelete.address && (
                <div className="text-neutral-600 truncate">Manzil: {clientToDelete.address}</div>
              )}
              <div className="text-rose-800 font-semibold pt-1 border-t border-rose-200/60 leading-relaxed">
                Ushbu mijoz va unga oid barcha rejalar, qarzdorlik/haqdorlik yozuvlari hamda
                hisobotlar tizimdan to'liq o'chiriladi. Bu amalni qaytarib bo'lmaydi!
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition min-h-[42px] cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = clientToDelete.id;
                  setClientToDelete(null);
                  onDeleteClient(id);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 min-h-[42px] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ha, to'liq o'chirilsin</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
