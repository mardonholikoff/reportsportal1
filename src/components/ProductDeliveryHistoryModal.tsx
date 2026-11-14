import React, { useState, useMemo, useEffect } from 'react';
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
  History,
  ArrowRight,
  Edit3,
  Layers,
  RotateCcw,
  CheckCircle2,
  Save,
  Plus,
  Minus,
} from 'lucide-react';
import { WarehouseProduct, DailyPlanItem, Client, ProductItem } from '../types';
import { storageService, getPlanDateKey, getClosedDateKey } from '../services/storage';
import { syncWarehouseProductToFirestore, addSystemLog } from '../services/firebase';
import { formatMoney, formatDateDMY, getAgentDisplayName } from '../utils/format';
import {
  buildWarehouseProductChronology,
  formatPiecesForWarehouseProduct,
} from '../utils/warehouseChronology';
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
  const [storageTick, setStorageTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'all_chronology' | 'initial_changes' | 'sales_only'>('all_chronology');

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

  const [snapshotDate, setSnapshotDate] = useState<string>(() => formatYMD(new Date()));

  useEffect(() => {
    if (!isOpen) return;
    setStorageTick((t) => t + 1);
    const unsubscribe = storageService.subscribe(() => {
      setStorageTick((t) => t + 1);
    });
    return unsubscribe;
  }, [isOpen]);

  // Always combine latest storage plans & clients with any prop overrides so new edits appear immediately
  const resolvedPlans = useMemo(() => {
    const fresh = storageService.getDailyPlans();
    if (fresh && fresh.length > 0) return fresh;
    return propDailyPlans || [];
  }, [propDailyPlans, isOpen, storageTick]);

  const resolvedClients = useMemo(() => {
    const fresh = storageService.getClients();
    if (fresh && fresh.length > 0) return fresh;
    return propClients || [];
  }, [propClients, isOpen, storageTick]);

  const allWarehouseProducts = useMemo(() => {
    return storageService.getWarehouseProducts() || [];
  }, [isOpen, storageTick]);

  // Resolve latest version of product from storage so live updates reflect immediately
  const activeProduct = useMemo(() => {
    if (!product) return null;
    return allWarehouseProducts.find((w) => w.id === product.id) || product;
  }, [product, allWarehouseProducts]);

  // Build full product chronology (initial stock, edits, running balance, and date snapshot)
  const chronology = useMemo(() => {
    if (!activeProduct) return null;
    return buildWarehouseProductChronology(
      activeProduct,
      resolvedPlans,
      resolvedClients,
      undefined,
      allWarehouseProducts
    );
  }, [activeProduct, resolvedPlans, resolvedClients, allWarehouseProducts, storageTick]);

  const snapshotAtDate = useMemo(() => {
    if (!chronology) return null;
    return chronology.getStockAtDate(snapshotDate || todayYmd);
  }, [chronology, snapshotDate, todayYmd]);

  // Bazaga kiritilgandagi dastlabki soni (Bosh qoldiq) tahrirlash holatlari
  const [editInitUnitType, setEditInitUnitType] = useState<'package' | 'piece'>('piece');
  const [editInitQtyStr, setEditInitQtyStr] = useState<string>('');
  const [editInitNote, setEditInitNote] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const hasPackageForInit = Boolean(
    activeProduct &&
      activeProduct.packageUnitName &&
      activeProduct.packageUnitName.trim() &&
      (activeProduct.piecesPerPackage || 1) > 1
  );
  const piecesPerPkgForInit =
    hasPackageForInit && activeProduct?.piecesPerPackage ? activeProduct.piecesPerPackage : 1;

  useEffect(() => {
    if (!isOpen || !activeProduct || !chronology) return;
    const initPieces = chronology.initialPieces;
    const preferredUnit: 'package' | 'piece' =
      hasPackageForInit &&
      (activeProduct.initialIntakeUnitType === 'package' ||
        activeProduct.intakeUnitType === 'package') &&
      initPieces % piecesPerPkgForInit === 0
        ? 'package'
        : 'piece';
    setEditInitUnitType(preferredUnit);
    setEditInitQtyStr(
      preferredUnit === 'package'
        ? String(Math.round((initPieces / piecesPerPkgForInit) * 100) / 100)
        : String(initPieces)
    );
    setEditInitNote('');
    setSaveSuccessMsg(null);
  }, [isOpen, activeProduct?.id, chronology?.initialPieces, hasPackageForInit, piecesPerPkgForInit]);

  const parsedNewInitQty = Math.max(0, parseFloat(editInitQtyStr) || 0);
  const previewNewInitialPieces = useMemo(() => {
    if (!activeProduct) return 0;
    if (editInitUnitType === 'package' && hasPackageForInit) {
      return Math.max(0, Math.round(parsedNewInitQty * piecesPerPkgForInit * 100) / 100);
    }
    return Math.max(0, Math.round(parsedNewInitQty * 100) / 100);
  }, [activeProduct, editInitUnitType, hasPackageForInit, parsedNewInitQty, piecesPerPkgForInit]);

  const netSoldUpToTodayPieces = useMemo(() => {
    if (!chronology) return 0;
    return Math.round((chronology.totalSoldPieces - chronology.totalReturnedPieces) * 100) / 100;
  }, [chronology]);

  const previewNewCurrentPieces = useMemo(() => {
    return Math.max(0, Math.round((previewNewInitialPieces - netSoldUpToTodayPieces) * 100) / 100);
  }, [previewNewInitialPieces, netSoldUpToTodayPieces]);

  const previewNewInitialFormatted = useMemo(() => {
    if (!activeProduct) return { primary: '0 dona', secondary: '', pieces: 0, volume: 0 };
    return formatPiecesForWarehouseProduct(activeProduct, previewNewInitialPieces);
  }, [activeProduct, previewNewInitialPieces]);

  const previewNewCurrentFormatted = useMemo(() => {
    if (!activeProduct) return { primary: '0 dona', secondary: '', pieces: 0, volume: 0 };
    return formatPiecesForWarehouseProduct(activeProduct, previewNewCurrentPieces);
  }, [activeProduct, previewNewCurrentPieces]);

  const handleSaveInitialStockChange = () => {
    if (!activeProduct || !chronology) return;
    const oldInitPieces = chronology.initialPieces;
    const updated = storageService.updateWarehouseInitialStock(
      activeProduct.id,
      {
        newInitialQuantity: parsedNewInitQty,
        newInitialUnitType: hasPackageForInit ? editInitUnitType : 'piece',
        note: editInitNote.trim() || undefined,
        oldInitialPiecesOverride: oldInitPieces,
        netSoldPiecesUpToToday: netSoldUpToTodayPieces,
      },
      'adminc'
    );
    if (!updated) return;

    syncWarehouseProductToFirestore(updated);
    addSystemLog({
      userId: 'adminc',
      userRole: 'admin',
      actionType: 'ombor_kirimi',
      actionTitle: `Ombor mahsuloti bosh qoldig'i tahrirlandi: ${updated.brand} - ${updated.name}`,
      details: `Bazaga kiritilgandagi soni (bosh qoldiq): ${oldInitPieces} donadan ${updated.initialTotalPieces} donaga o'zgartirildi. Bugungi kungacha amallar: -${netSoldUpToTodayPieces} dona. Yangi hozirgi qoldiq: ${updated.totalPieces} dona (${updated.totalVolume} ${updated.baseUnit}).`,
      metadata: {
        productId: updated.id,
      },
    });

    setStorageTick((t) => t + 1);
    setEditInitNote('');
    setSaveSuccessMsg(
      `Bosh qoldiq ${previewNewInitialFormatted.primary} (${previewNewInitialPieces} dona) qilib saqlandi! Shu bosh qoldiqqa asosan hozirgi qoldiq: ${previewNewCurrentFormatted.primary} (${previewNewCurrentPieces} dona).`
    );
  };

  // Matching helper: Check if a delivered product matches the target WarehouseProduct
  const isMatchingProduct = (p: WarehouseProduct, prod: ProductItem): boolean => {
    if (!prod || !p) return false;

    const cleanStr = (s?: string) => (s || '').toLowerCase().trim();
    const normAlnum = (s?: string) => cleanStr(s).replace(/[^a-z0-9]/g, '');

    // 1. Direct ID match
    if (prod.warehouseId && prod.warehouseId === p.id) {
      return true;
    }
    if ((prod as any).id && (prod as any).id === p.id) {
      return true;
    }

    // 2. If prod.warehouseId points to a different warehouse item that still exists and has a different name/mark, reject
    if (prod.warehouseId && prod.warehouseId !== p.id) {
      const otherWh = allWarehouseProducts.find((w) => w.id === prod.warehouseId);
      if (otherWh) {
        const sameIdentity =
          normAlnum(otherWh.name) === normAlnum(p.name) &&
          normAlnum(otherWh.brand) === normAlnum(p.brand) &&
          normAlnum(otherWh.mark1) === normAlnum(p.mark1);
        if (!sameIdentity) {
          return false;
        }
      }
    }

    // 3. Fallback matching by product name, brand, mark, and volume/liter tokens
    if (!prod.name) return false;

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
    const pPrimary = [pBrandClean, pNameClean, pMark1Clean].filter(Boolean).join(' ');
    const pNameAndMark1 = [pNameClean, pMark1Clean].filter(Boolean).join(' ');

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
    } else if (pLiters.length > 0 && prodLiters.length === 0) {
      return false;
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

    // Compare normalized alphanumerics of full & primary strings (ExecutePlanModal formats as `${brand} - ${name} [${mark1}]`)
    const normPFull = normAlnum(fullP);
    const normPPrimary = normAlnum(pPrimary);
    const normPNameMark1 = normAlnum(pNameAndMark1);
    const normPName = normAlnum(pNameClean);
    const normProdFull = normAlnum(fullProd);
    const normProdName = normAlnum(prodNameClean);
    const normPMark1 = normAlnum(pMark1Clean);
    const normPBrand = normAlnum(pBrandClean);

    if (
      normProdFull === normPFull ||
      normProdFull === normPPrimary ||
      normProdFull === normPNameMark1 ||
      normProdName === normPPrimary ||
      normProdName === normPNameMark1 ||
      normProdName === normPName
    ) {
      if (normPMark1 && !normProdFull.includes(normPMark1)) {
        const hasLiterEquiv = pLiters.length > 0 && prodLiters.some((pl) => pLiters.includes(pl));
        if (!hasLiterEquiv) return false;
      }
      return true;
    }

    if (normPName.length >= 2 && normProdFull.includes(normPName)) {
      if (normPMark1 && !normProdFull.includes(normPMark1)) {
        const hasLiterEquiv = pLiters.length > 0 && prodLiters.some((pl) => pLiters.includes(pl));
        if (!hasLiterEquiv) return false;
      }
      if (normPBrand && !normProdFull.includes(normPBrand)) {
        // Allow if prod didn't include brand prefix (e.g., "ATF 4L" directly)
        if (prodBrandClean) return false;
      }
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

    const resolveEffectiveDeliveryDate = (
      dp: DailyPlanItem,
      prod: ProductItem,
      fallbackTime?: string
    ): { timestamp: string; dateStr: string } => {
      const prodDateRaw = (prod as any).date || (prod as any).deliveredAt;
      const prodDateKey = prodDateRaw
        ? getPlanDateKey({ createdAt: prodDateRaw } as DailyPlanItem)
        : '';
      const planTargetDate = getClosedDateKey(dp) || getPlanDateKey(dp);
      const rawTime = prodDateRaw || fallbackTime || dp.completedAt || dp.closedAt || dp.createdAt || '';
      const rawDateKey = rawTime ? getPlanDateKey({ createdAt: rawTime } as DailyPlanItem) : '';

      // Prefer the plan's closed/target date when the plan belongs to a specific date (e.g. 2026-11-04)
      const effectiveDateStr = planTargetDate || prodDateKey || rawDateKey || todayYmd;
      const timeSuffix =
        rawTime && rawTime.includes('T') ? rawTime.slice(10) : 'T12:00:00.000Z';
      const effectiveTimestamp =
        rawTime && rawTime.startsWith(effectiveDateStr)
          ? rawTime
          : `${effectiveDateStr}${timeSuffix}`;

      return { timestamp: effectiveTimestamp, dateStr: effectiveDateStr };
    };

    // 1. Daily plans deliveries
    resolvedPlans.forEach((dp) => {
      if (!dp) return;
      const clientObj = clientsMap.get(dp.clientId);
      const cName = dp.clientName || clientObj?.name || 'Mijoz';
      const cPhone = dp.clientPhone || clientObj?.phone || '';
      const cAddr = dp.clientAddress || clientObj?.address || '';
      const cReg = dp.clientRegion || clientObj?.region;
      const cDist = dp.clientDistrict || clientObj?.district;

      const seenInPlan = new Set<string>();

      if (dp.actionsHistory && dp.actionsHistory.length > 0) {
        dp.actionsHistory.forEach((act, actIdx) => {
          if (act && act.productsDelivered && act.productsDelivered.length > 0) {
            act.productsDelivered.forEach((prod, pIdx) => {
              if (isMatchingProduct(product, prod)) {
                const dedupKey = `${prod.id || pIdx}_${prod.quantity}_${prod.unitPrice}`;
                if (seenInPlan.has(dedupKey)) return;
                seenInPlan.add(dedupKey);

                const { timestamp: timeStr, dateStr: dStr } = resolveEffectiveDeliveryDate(
                  dp,
                  prod,
                  act.timestamp
                );
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
                  paidAmount: act.deliveryPayment?.paidAmount ?? dp.deliveryPayment?.paidAmount,
                  debtAmount: act.deliveryPayment?.debtAmount ?? dp.deliveryPayment?.debtAmount,
                  reportNote: act.reportNote || dp.reportNote || dp.planNote,
                });
              }
            });
          }
        });
      }

      if (dp.productsDelivered && dp.productsDelivered.length > 0) {
        dp.productsDelivered.forEach((prod, pIdx) => {
          if (isMatchingProduct(product, prod)) {
            const dedupKey = `${prod.id || pIdx}_${prod.quantity}_${prod.unitPrice}`;
            if (seenInPlan.has(dedupKey)) return;
            seenInPlan.add(dedupKey);

            const { timestamp: timeStr, dateStr: dStr } = resolveEffectiveDeliveryDate(dp, prod);
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

    // 2. Fallback from client.products & client.logs (for products added via client edit or whose plan was modified/deduplicated)
    const clientsWithDelivery = new Set<string>(list.map((r) => r.clientId));

    resolvedClients.forEach((client) => {
      if (!client || !client.id) return;
      if (clientsWithDelivery.has(client.id)) return;

      const clientLogs = Array.isArray(client.logs) ? client.logs : [];
      const prodAddLog = clientLogs.find(
        (l) =>
          l &&
          l.type === 'product_added' &&
          l.title !== 'Mahsulot omborga qaytarildi'
      );
      const latestCloseLog = clientLogs.find(
        (l) =>
          l &&
          (l.id?.endsWith('_close') ||
            l.title === 'Reja yakunlandi va yopildi' ||
            l.title === 'Reja bajarilmasdan yopildi')
      );

      const inferClientDeliveryDate = (prod?: ProductItem): { timestamp: string; dateStr: string } => {
        const prodDateRaw = prod ? (prod as any).date || (prod as any).deliveredAt : '';
        if (prodDateRaw) {
          const dKey = getPlanDateKey({ createdAt: prodDateRaw } as DailyPlanItem) || todayYmd;
          return {
            timestamp: prodDateRaw.includes('T') ? prodDateRaw : `${dKey}T12:00:00.000Z`,
            dateStr: dKey,
          };
        }
        // If client has a close log (e.g. 2026-11-04) or lastPlanClosedAt, prefer that plan date
        const closeTime = latestCloseLog?.timestamp || client.lastPlanClosedAt || '';
        if (closeTime) {
          const closeKey = getPlanDateKey({ createdAt: closeTime } as DailyPlanItem);
          if (closeKey) {
            return {
              timestamp: closeTime.includes('T') ? closeTime : `${closeKey}T12:00:00.000Z`,
              dateStr: closeKey,
            };
          }
        }
        const logTime = prodAddLog?.timestamp || client.updatedAt || client.createdAt || '';
        const logKey = logTime
          ? getPlanDateKey({ createdAt: logTime } as DailyPlanItem) || todayYmd
          : todayYmd;
        return {
          timestamp: logTime && logTime.includes('T') ? logTime : `${logKey}T12:00:00.000Z`,
          dateStr: logKey,
        };
      };

      const inferPaymentFromLog = () => {
        if (!prodAddLog) return { paymentType: 'qarz' };
        const label = (prodAddLog.paymentMethodLabel || prodAddLog.details || '').toLowerCase();
        if (label.includes('naqd')) return { paymentType: 'naqd', paidAmount: prodAddLog.amountChanged };
        if (label.includes('bank')) return { paymentType: 'bank', paidAmount: prodAddLog.amountChanged };
        if (label.includes('karta')) return { paymentType: 'karta', paidAmount: prodAddLog.amountChanged };
        if (label.includes('qr')) return { paymentType: 'qr', paidAmount: prodAddLog.amountChanged };
        return { paymentType: 'qarz', debtAmount: prodAddLog.amountChanged };
      };

      const matchingClientProducts = (client.products || []).filter((prod) =>
        isMatchingProduct(product, prod)
      );

      if (matchingClientProducts.length > 0) {
        matchingClientProducts.forEach((prod, idx) => {
          const { timestamp: timeStr, dateStr: dStr } = inferClientDeliveryDate(prod);
          const payInfo = inferPaymentFromLog();
          const author =
            prodAddLog?.author ||
            latestCloseLog?.author ||
            client.lastPlanClosedBy ||
            client.createdBy ||
            'adminc';

          list.push({
            id: `client_prod_${client.id}_${prod.id || idx}`,
            timestamp: timeStr,
            dateStr: dStr,
            clientId: client.id,
            clientName: client.name || 'Mijoz',
            clientPhone: client.phone || '',
            clientAddress: client.address || '',
            clientRegion: client.region,
            clientDistrict: client.district,
            quantity: prod.quantity || 0,
            unit: prod.unit || product.pieceUnitName || 'dona',
            unitPrice: prod.unitPrice || product.minSellingPrice || product.price || 0,
            totalPrice: prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0),
            author,
            paymentType: payInfo.paymentType,
            paidAmount: payInfo.paidAmount,
            debtAmount: payInfo.debtAmount,
            reportNote: prodAddLog?.details,
          });
        });
        clientsWithDelivery.add(client.id);
      } else if (prodAddLog && prodAddLog.details) {
        // Parse product_added log details if client.products was later modified
        const m = prodAddLog.details.match(/(?:topshirildi|tahrirlandi):\s*(.+?)\.\s*(?:Qiymati|Jami):/i);
        if (m && m[1]) {
          const itemsRaw = m[1].split(',').map((s) => s.trim());
          itemsRaw.forEach((itemStr, idx) => {
            const itemMatch = itemStr.match(/^(.+?)\s*\(([\d.]+)\s*([^)]+)\)$/);
            const parsedName = itemMatch ? itemMatch[1].trim() : itemStr;
            const parsedQty = itemMatch ? parseFloat(itemMatch[2]) || 1 : 1;
            const parsedUnit = itemMatch ? itemMatch[3].trim() : product.pieceUnitName || 'dona';
            if (
              isMatchingProduct(product, {
                id: '',
                name: parsedName,
                quantity: parsedQty,
                unit: parsedUnit,
                unitPrice: 0,
                totalPrice: 0,
              })
            ) {
              const { timestamp: timeStr, dateStr: dStr } = inferClientDeliveryDate();
              const payInfo = inferPaymentFromLog();
              const unitPrice = product.minSellingPrice || product.price || 0;
              list.push({
                id: `client_log_${client.id}_${prodAddLog.id}_${idx}`,
                timestamp: timeStr,
                dateStr: dStr,
                clientId: client.id,
                clientName: client.name || 'Mijoz',
                clientPhone: client.phone || '',
                clientAddress: client.address || '',
                clientRegion: client.region,
                clientDistrict: client.district,
                quantity: parsedQty,
                unit: parsedUnit,
                unitPrice,
                totalPrice: Math.round(parsedQty * unitPrice * 100) / 100,
                author: prodAddLog.author || client.lastPlanClosedBy || 'adminc',
                paymentType: payInfo.paymentType,
                paidAmount: payInfo.paidAmount,
                debtAmount: payInfo.debtAmount,
                reportNote: prodAddLog.details,
              });
              clientsWithDelivery.add(client.id);
            }
          });
        }
      }
    });

    // Sort by timestamp descending
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [product, resolvedPlans, resolvedClients, allWarehouseProducts, todayYmd]);

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

  // Aggregated Summary Stats for filtered range (with package/korobka & piece/kanistr conversion)
  const summary = useMemo(() => {
    let grandTotalPieces = 0;
    let totalSumUsd = 0;
    const clientIdsSet = new Set<string>();

    if (!product) {
      return {
        totalPieces: 0,
        formattedPieces: '0 dona',
        subtext: '',
        totalSumUsd: 0,
        deliveryCount: 0,
        clientsCount: 0,
      };
    }

    const piecesPerPkg = product.piecesPerPackage && product.piecesPerPackage > 0 ? product.piecesPerPackage : 1;
    const pkgName = product.packageUnitName || 'korobka';
    const pieceName = product.pieceUnitName || 'kanistr';
    const hasPackage = Boolean(product.packageUnitName && product.packageUnitName.trim() && piecesPerPkg > 1);

    filteredRecords.forEach((r) => {
      const isPkgUnit =
        hasPackage &&
        (r.unit.toLowerCase() === pkgName.toLowerCase() ||
          r.unit.toLowerCase().includes('korobk') ||
          r.unit.toLowerCase().includes('quti') ||
          r.unit.toLowerCase().includes('pack'));

      const rPieces = isPkgUnit ? r.quantity * piecesPerPkg : r.quantity;

      grandTotalPieces += rPieces;
      totalSumUsd += r.totalPrice;
      if (r.clientId) clientIdsSet.add(r.clientId);
    });

    let formattedPieces = `${grandTotalPieces.toLocaleString()} ${pieceName}`;
    let subtext = '';

    if (hasPackage) {
      const pkgs = Math.floor(grandTotalPieces / piecesPerPkg);
      const rem = grandTotalPieces % piecesPerPkg;

      if (pkgs > 0 && rem > 0) {
        formattedPieces = `${pkgs} ${pkgName} + ${rem} ${pieceName}`;
      } else if (pkgs > 0) {
        formattedPieces = `${pkgs} ${pkgName}`;
      } else {
        formattedPieces = `${rem} ${pieceName}`;
      }

      subtext = `Jami: ${grandTotalPieces.toLocaleString()} ${pieceName} (1 ${pkgName} = ${piecesPerPkg} ${pieceName})`;
    }

    return {
      totalPieces: grandTotalPieces,
      formattedPieces,
      subtext,
      totalSumUsd,
      deliveryCount: filteredRecords.length,
      clientsCount: clientIdsSet.size,
    };
  }, [filteredRecords, product]);

  // Helper: Format record quantity for table and mobile cards
  const getFormattedRecordQty = (rec: ProductDeliveryRecord) => {
    if (!product) return { primary: `${rec.quantity} ${rec.unit}`, secondary: '' };

    const piecesPerPkg = product.piecesPerPackage && product.piecesPerPackage > 0 ? product.piecesPerPackage : 1;
    const pkgName = product.packageUnitName || 'korobka';
    const pieceName = product.pieceUnitName || 'kanistr';
    const hasPackage = Boolean(product.packageUnitName && product.packageUnitName.trim() && piecesPerPkg > 1);

    const isPkgUnit =
      hasPackage &&
      (rec.unit.toLowerCase() === pkgName.toLowerCase() ||
        rec.unit.toLowerCase().includes('korobk') ||
        rec.unit.toLowerCase().includes('quti') ||
        rec.unit.toLowerCase().includes('pack'));

    const rPieces = isPkgUnit ? rec.quantity * piecesPerPkg : rec.quantity;

    if (!hasPackage) {
      return {
        primary: `${rec.quantity.toLocaleString()} ${rec.unit || pieceName}`,
        secondary: '',
      };
    }

    const pkgs = Math.floor(rPieces / piecesPerPkg);
    const rem = rPieces % piecesPerPkg;

    let equivText = '';
    if (isPkgUnit) {
      equivText = `(${rPieces.toLocaleString()} ${pieceName})`;
    } else {
      if (pkgs > 0 && rem > 0) {
        equivText = `(${pkgs} ${pkgName} + ${rem} ${pieceName})`;
      } else if (pkgs > 0) {
        equivText = `(${pkgs} ${pkgName})`;
      } else {
        equivText = `(${rem} ${pieceName})`;
      }
    }

    return {
      primary: `${rec.quantity.toLocaleString()} ${rec.unit}`,
      secondary: equivText,
    };
  };

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
                <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white flex items-center gap-2 flex-wrap">
                  <span>{product.name}</span>
                  {product.mark1 && (
                    <span className="text-xs bg-rose-500/30 text-rose-100 px-2.5 py-0.5 rounded-md border border-rose-400/40 font-bold font-mono">
                      {product.mark1}
                    </span>
                  )}
                  {product.mark2 && (
                    <span className="text-xs bg-rose-500/30 text-rose-100 px-2.5 py-0.5 rounded-md border border-rose-400/40 font-bold font-mono">
                      {product.mark2}
                    </span>
                  )}
                  {product.extraMarks &&
                    product.extraMarks.map((em, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-rose-500/30 text-rose-100 px-2.5 py-0.5 rounded-md border border-rose-400/40 font-bold font-mono"
                      >
                        {em}
                      </span>
                    ))}
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

        {/* Scrollable Modal Body (No sticky giant top panels blocking chronology) */}
        <div className="flex-1 overflow-y-auto">
          {/* Dastlabki qoldiq, Tanlangan sanadagi qoldiq va Joriy holat panellari */}
          {chronology && activeProduct && (
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-50 via-neutral-50 to-rose-50/40 border-b border-neutral-200 space-y-2.5">
              {/* BAZAGA KIRITILGANDAGI SONI (BOSH QOLDIQ) VA UNI O'ZGARTIRISH PANELI — IXCHAM KO'RINISHDA */}
              <div className="p-2.5 sm:p-3 rounded-2xl bg-indigo-50/90 border border-indigo-300 shadow-2xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider">
                      Bosh qoldiq
                    </span>
                    <span className="text-xs font-bold text-indigo-950">
                      Bazaga kiritilgandagi soni:{' '}
                      <strong className="font-mono text-indigo-900 underline">
                        {chronology.initialFormatted.primary} ({chronology.initialPieces}{' '}
                        {activeProduct.pieceUnitName || 'dona'})
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10.5px] font-mono font-bold flex-wrap">
                    <span className="px-2 py-0.5 rounded-lg bg-white border border-indigo-200 text-indigo-950">
                      Bosh: {chronology.initialPieces}
                    </span>
                    <span className="text-indigo-700">&minus;</span>
                    <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                      Amallar: {netSoldUpToTodayPieces}
                    </span>
                    <span className="text-indigo-700">=</span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-950">
                      Hozirgi: {chronology.currentPieces} dona
                    </span>
                  </div>
                </div>

                {saveSuccessMsg && (
                  <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{saveSuccessMsg}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSaveSuccessMsg(null)}
                      className="text-emerald-800 hover:text-emerald-950 px-1.5 py-0.5 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center">
                  {/* 1. Birlik tanlash (Agar korobka/qadoq bo'lsa) */}
                  {hasPackageForInit && (
                    <div className="lg:col-span-3">
                      <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-white border border-indigo-200">
                        <button
                          type="button"
                          onClick={() => {
                            if (editInitUnitType !== 'package') {
                              setEditInitUnitType('package');
                              setEditInitQtyStr(
                                String(
                                  Math.round((previewNewInitialPieces / piecesPerPkgForInit) * 100) /
                                    100
                                )
                              );
                            }
                          }}
                          className={`py-1 px-2 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                            editInitUnitType === 'package'
                              ? 'bg-indigo-700 text-white shadow-2xs'
                              : 'text-indigo-900 hover:bg-indigo-50'
                          }`}
                        >
                          {activeProduct.packageUnitName} (1={piecesPerPkgForInit})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (editInitUnitType !== 'piece') {
                              setEditInitUnitType('piece');
                              setEditInitQtyStr(String(previewNewInitialPieces));
                            }
                          }}
                          className={`py-1 px-2 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                            editInitUnitType === 'piece'
                              ? 'bg-indigo-700 text-white shadow-2xs'
                              : 'text-indigo-900 hover:bg-indigo-50'
                          }`}
                        >
                          {activeProduct.pieceUnitName || 'dona'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. Bazaga kiritilgandagi sonini yozish */}
                  <div className={hasPackageForInit ? 'lg:col-span-3' : 'lg:col-span-4'}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(0, (parseFloat(editInitQtyStr) || 0) - 1);
                          setEditInitQtyStr(String(next));
                          setSaveSuccessMsg(null);
                        }}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold flex items-center justify-center transition cursor-pointer shrink-0"
                        title="Kamaytirish (-1)"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editInitQtyStr}
                        onChange={(e) => {
                          setEditInitQtyStr(e.target.value);
                          setSaveSuccessMsg(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveInitialStockChange();
                          }
                        }}
                        className="w-full h-8 px-2.5 rounded-xl border border-indigo-400 bg-white font-mono font-extrabold text-xs text-indigo-950 text-center focus:outline-none focus:border-indigo-700"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = (parseFloat(editInitQtyStr) || 0) + 1;
                          setEditInitQtyStr(String(next));
                          setSaveSuccessMsg(null);
                        }}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold flex items-center justify-center transition cursor-pointer shrink-0"
                        title="Ko'paytirish (+1)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 3. Natija oldindan ko'rinishi (Yangi bosh qoldiq -> Yangi hozirgi qoldiq) */}
                  <div className={hasPackageForInit ? 'lg:col-span-4' : 'lg:col-span-5'}>
                    <div className="px-2.5 py-1.5 rounded-xl bg-white border border-indigo-200 text-[10.5px] flex flex-wrap items-center justify-between gap-1.5">
                      <div>
                        <span className="text-neutral-500 mr-1">Yangi bosh:</span>
                        <span className="font-mono font-extrabold text-indigo-950">
                          {previewNewInitialFormatted.primary} ({previewNewInitialPieces})
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <div>
                        <span className="text-emerald-800 font-bold mr-1">Hozirgi:</span>
                        <span className="font-mono font-extrabold text-emerald-700">
                          {previewNewCurrentFormatted.primary} ({previewNewCurrentPieces})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Saqlash tugmasi */}
                  <div className={hasPackageForInit ? 'lg:col-span-2' : 'lg:col-span-3'}>
                    <button
                      type="button"
                      onClick={handleSaveInitialStockChange}
                      className="w-full h-8 px-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-950 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5 shrink-0" />
                      <span>Saqlash</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* 1. Baza yaratilganda kiritilgan dastlabki qoldiq */}
                <div className="p-2.5 sm:p-3 rounded-2xl bg-white border border-indigo-200/80 shadow-2xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10.5px] font-bold text-indigo-800 uppercase tracking-wide">
                      1. Baza yaratilganda:
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md border border-indigo-200">
                      {formatDateDMY(chronology.initialDate)}
                    </span>
                  </div>
                  <div className="text-sm sm:text-base font-extrabold font-mono text-indigo-950 mt-0.5 tabular-nums">
                    {chronology.initialFormatted.primary}
                  </div>
                  <div className="text-[10px] text-neutral-600 font-mono">
                    {chronology.initialFormatted.secondary}
                  </div>
                </div>

                {/* 2. Dastlabki qoldiq necha marta va qanday o'zgargani */}
                <div
                  onClick={() => setActiveTab('initial_changes')}
                  className="p-2.5 sm:p-3 rounded-2xl bg-amber-50/70 hover:bg-amber-50 border border-amber-200 shadow-2xs cursor-pointer transition"
                  title="Dastlabki qoldiq o'zgarishlari xronologiyasini ko'rish uchun bosing"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10.5px] font-bold text-amber-900 uppercase tracking-wide">
                      2. Bosh qoldiq tahriri:
                    </span>
                    <History className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                  <div className="text-sm sm:text-base font-extrabold font-mono text-amber-950 mt-0.5 tabular-nums">
                    {chronology.initialEditCount > 0
                      ? `${chronology.initialEditCount} marta o'zgartirilgan`
                      : "O'zgartirilmagan (Asl)"}
                  </div>
                  <div className="text-[10px] text-amber-800 font-semibold flex items-center gap-1">
                    <span>Jami yozuvlar: {chronology.initialAndEditLogs.length} ta</span>
                    <span className="underline ml-auto">Ko'rish &rarr;</span>
                  </div>
                </div>

                {/* 3. Tanlangan sanadagi ombor qoldig'i */}
                <div className="p-2.5 sm:p-3 rounded-2xl bg-teal-50/80 border border-teal-300 shadow-2xs">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-[10.5px] font-bold text-teal-900 uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-teal-700" />
                      <span>3. Sanadagi qoldiq:</span>
                    </span>
                    <input
                      type="date"
                      value={snapshotDate}
                      onChange={(e) => setSnapshotDate(e.target.value || todayYmd)}
                      className="px-1.5 py-0.5 rounded-lg border border-teal-400 bg-white font-mono font-bold text-[10.5px] text-teal-950 outline-none focus:border-teal-700"
                    />
                  </div>
                  {snapshotAtDate && (
                    <>
                      <div className="text-sm sm:text-base font-extrabold font-mono text-teal-950 mt-0.5 tabular-nums">
                        {snapshotAtDate.primaryFormatted}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-teal-900 font-semibold mt-0.5">
                        <span>Sotilgan: {snapshotAtDate.soldUpToDatePieces} dona</span>
                        {snapshotAtDate.soldOnDatePieces > 0 && (
                          <span className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-mono font-bold">
                            Shu kuni: -{snapshotAtDate.soldOnDatePieces}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* 4. Hozirgi joriy qoldiq va Jami sotilgan */}
                <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 shadow-2xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wide">
                      4. Hozirgi qoldiq:
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded-md">
                      Sotilgan: {summary.formattedPieces}
                    </span>
                  </div>
                  <div className="text-sm sm:text-base font-extrabold font-mono text-emerald-950 mt-0.5 tabular-nums">
                    {chronology.currentFormatted.primary}
                  </div>
                  <div className="text-[10px] text-emerald-800 font-mono flex items-center justify-between">
                    <span>{chronology.currentFormatted.secondary}</span>
                    <strong className="text-emerald-950">{formatMoney(summary.totalSumUsd)}</strong>
                  </div>
                </div>
              </div>

              {/* Bo'limlar tab tugmalari */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all_chronology')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'all_chronology'
                        ? 'bg-neutral-900 text-white shadow-2xs'
                        : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-rose-400" />
                    <span>To'liq xronologiya va sotuvlar ({chronology.timelineEvents.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('initial_changes')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'initial_changes'
                        ? 'bg-amber-700 text-white shadow-2xs'
                        : 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>
                      Dastlabki qoldiq va o'zgarishlar xronologiyasi ({chronology.initialAndEditLogs.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('sales_only')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'sales_only'
                        ? 'bg-rose-700 text-white shadow-2xs'
                        : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Faqat mijozlarga sotuvlar ({filteredRecords.length})</span>
                  </button>
                </div>

                {/* Tezkor sana tanlash tugmalari (Sanadagi qoldiq uchun) */}
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-neutral-500 font-medium mr-1">Sanadagi qoldiq:</span>
                  <button
                    type="button"
                    onClick={() => setSnapshotDate(todayYmd)}
                    className={`px-2 py-0.5 rounded-lg font-bold cursor-pointer ${
                      snapshotDate === todayYmd
                        ? 'bg-teal-700 text-white'
                        : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    Bugun
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnapshotDate(yesterdayYmd)}
                    className={`px-2 py-0.5 rounded-lg font-bold cursor-pointer ${
                      snapshotDate === yesterdayYmd
                        ? 'bg-teal-700 text-white'
                        : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    Kecha
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnapshotDate(firstDayOfMonthYmd)}
                    className={`px-2 py-0.5 rounded-lg font-bold cursor-pointer ${
                      snapshotDate === firstDayOfMonthYmd
                        ? 'bg-teal-700 text-white'
                        : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    Oy boshi
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filters and Date Range Picker Bar */}
          <div className="p-3.5 sm:p-4 bg-white border-b border-neutral-200 space-y-3">
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
          <div className="p-4 sm:p-6 space-y-6">
          {/* 1-BO'LIM: BAZA YARATILGANDA KIRITILGAN DASTLABKI QOLDIQ VA UNING O'ZGARISHLARI XRONOLOGIYASI */}
          {chronology && (activeTab === 'all_chronology' || activeTab === 'initial_changes') && (
            <div className="space-y-4">
              {/* Dastlabki qoldiq va tahrirlar tarixi */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/30 overflow-hidden shadow-2xs">
                <div className="px-4 py-3 bg-amber-100/80 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-800" />
                    <h3 className="text-xs sm:text-sm font-bold text-amber-950">
                      Baza yaratilganda kiritilgan dastlabki qoldiq va tahrirlar tarixi
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="px-2.5 py-0.5 rounded-lg bg-white border border-amber-300 text-amber-950 font-mono">
                      Dastlabki kiritilgan: {chronology.initialFormatted.primary} ({chronology.initialPieces} dona)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-800 text-white font-mono">
                      {chronology.initialEditCount > 0
                        ? `${chronology.initialEditCount} marta o'zgartirilgan`
                        : "O'zgartirilmagan"}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-left text-xs text-neutral-900 border-collapse">
                    <thead>
                      <tr className="bg-amber-50/60 border-b border-amber-100 text-amber-950 font-bold uppercase tracking-wider text-[10.5px]">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Sana va vaqt</th>
                        <th className="py-2.5 px-3">Amal turi</th>
                        <th className="py-2.5 px-3 text-center">Oldingi qoldiq</th>
                        <th className="py-2.5 px-3 text-center">O'zgarish</th>
                        <th className="py-2.5 px-3 text-center">Keyingi qoldiq</th>
                        <th className="py-2.5 px-3 text-center">Kim tomonidan</th>
                        <th className="py-2.5 px-3">Tafsilot / Izoh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {chronology.initialAndEditLogs.map((log, idx) => {
                        const isInitial = log.changeType === 'initial_intake';
                        return (
                          <tr key={log.id || idx} className="hover:bg-amber-50/20">
                            <td className="py-2.5 px-3 text-center font-mono text-neutral-400">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono whitespace-nowrap font-bold text-neutral-800">
                              {formatDateDMY(log.timestamp)}{' '}
                              <span className="text-[10px] text-neutral-400">
                                {log.timestamp.length > 10 ? log.timestamp.slice(11, 16) : ''}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${
                                  isInitial
                                    ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                                    : 'bg-amber-50 text-amber-900 border-amber-200'
                                }`}
                              >
                                {isInitial
                                  ? 'Baza yaratilganda dastlabki kiritish'
                                  : log.changeType === 'initial_edit'
                                  ? "Dastlabki kirim miqdori o'zgartirildi"
                                  : "Ombor qoldig'i qo'lda tahrirlandi"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-neutral-600">
                              {log.previousPieces.toLocaleString()} dona
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-extrabold">
                              <span
                                className={
                                  log.deltaPieces > 0
                                    ? 'text-emerald-700'
                                    : log.deltaPieces < 0
                                    ? 'text-rose-700'
                                    : 'text-neutral-600'
                                }
                              >
                                {log.deltaPieces > 0 ? `+${log.deltaPieces.toLocaleString()}` : log.deltaPieces.toLocaleString()} dona
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-extrabold text-indigo-950">
                              {log.newPieces.toLocaleString()} dona
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-lg bg-neutral-100 border border-neutral-200 font-bold text-[11px]">
                                {getAgentDisplayName(log.author || 'adminc')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-neutral-600 text-[11px]">
                              {log.note}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Qadam-baqadam barcha qoldiq o'zgarishlari zanjiri (Dastlabki -> Tahrir -> Sotuv -> Qaytarish -> Joriy) */}
              <div className="rounded-2xl border border-indigo-200 bg-white overflow-hidden shadow-2xs">
                <div className="px-4 py-3 bg-indigo-50/80 border-b border-indigo-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-700" />
                    <h3 className="text-xs sm:text-sm font-bold text-indigo-950">
                      Qadam-baqadam qoldiq harakati xronologiyasi (Oldingi qoldiq &rarr; O'zgarish &rarr; Keyingi qoldiq)
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-indigo-800">
                    Jami {chronology.timelineEvents.length} ta harakat
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-neutral-900 border-collapse">
                    <thead className="bg-indigo-50/95 border-b border-indigo-100 text-indigo-950 font-bold uppercase tracking-wider text-[10.5px]">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Sana</th>
                        <th className="py-2.5 px-3">Harakat / Mijoz</th>
                        <th className="py-2.5 px-3 text-center">Oldingi qoldiq</th>
                        <th className="py-2.5 px-3 text-center">O'zgarish</th>
                        <th className="py-2.5 px-3 text-center">Keyingi qoldiq</th>
                        <th className="py-2.5 px-3 text-center">Xodim</th>
                        <th className="py-2.5 px-3">Tafsilot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {chronology.timelineEvents.map((ev, idx) => (
                        <tr key={ev.id || idx} className="hover:bg-indigo-50/20">
                          <td className="py-2 px-3 text-center font-mono text-neutral-400">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono whitespace-nowrap font-bold text-neutral-800">
                            {formatDateDMY(ev.timestamp)}
                          </td>
                          <td className="py-2 px-3 font-bold text-neutral-900">
                            {ev.title}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-neutral-600">
                            {ev.beforePieces.toLocaleString()} dona
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-extrabold">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md ${
                                ev.deltaPieces > 0
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : ev.deltaPieces < 0
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              {ev.deltaPieces > 0
                                ? `+${ev.deltaPieces.toLocaleString()}`
                                : ev.deltaPieces.toLocaleString()}{' '}
                              dona
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-extrabold text-indigo-950">
                            <div>{ev.afterPieces.toLocaleString()} dona</div>
                            <div className="text-[10px] text-neutral-500 font-normal">
                              ({ev.formattedAfter})
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-lg bg-neutral-100 text-[11px] font-bold">
                              {getAgentDisplayName(ev.author || 'adminc')}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-neutral-600 max-w-xs">
                            {ev.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2-BO'LIM: MIJOZLARGA TOPSHIRILGAN (SOTILGAN) MAHSULOTLAR JADVALI */}
          {(activeTab === 'all_chronology' || activeTab === 'sales_only') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-rose-600" />
                  <span>Mijozlarga topshirilgan (sotilgan) mahsulotlar ro'yxati ({filteredRecords.length} ta)</span>
                </h3>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 space-y-3 bg-neutral-50 rounded-2xl border border-neutral-200">
                  <Package className="w-10 h-10 text-neutral-300 mx-auto" />
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
                    <thead>
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
                              {(() => {
                                const formattedQty = getFormattedRecordQty(rec);
                                return (
                                  <>
                                    <div className="font-extrabold text-neutral-900 font-mono text-sm">
                                      {formattedQty.primary}
                                    </div>
                                    {formattedQty.secondary && (
                                      <div className="text-[11px] text-emerald-800 font-bold font-mono">
                                        {formattedQty.secondary}
                                      </div>
                                    )}
                                    <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                                      {rec.unitPrice.toLocaleString()} USD / {rec.unit}
                                    </div>
                                  </>
                                );
                              })()}
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

                  const formattedQty = getFormattedRecordQty(rec);

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
                            {formattedQty.primary}
                          </span>
                          {formattedQty.secondary && (
                            <span className="text-[10px] font-bold text-emerald-800 block">
                              {formattedQty.secondary}
                            </span>
                          )}
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
          )}
          </div>
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
