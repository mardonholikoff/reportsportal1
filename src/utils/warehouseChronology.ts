import {
  WarehouseProduct,
  DailyPlanItem,
  Client,
  ProductItem,
  SystemLog,
  WarehouseStockChangeLog,
} from '../types';
import { getPlanDateKey, getClosedDateKey } from '../services/storage';
import { getLocalSystemLogs } from '../services/firebase';

export interface ProductChronologyTimelineItem {
  id: string;
  timestamp: string;
  dateStr: string;
  eventType:
    | 'initial_intake'
    | 'initial_edit'
    | 'restock_intake'
    | 'manual_adjustment'
    | 'sale'
    | 'return';
  title: string;
  subtitle: string;
  author: string;
  clientId?: string;
  clientName?: string;
  quantityDisplay: string;
  deltaPieces: number; // positive for intake/return/increase, negative for sale/decrease
  beforePieces: number;
  afterPieces: number;
  unitPrice?: number;
  totalPrice?: number;
  paymentType?: string;
  note?: string;
  formattedAfter: string;
  description: string;
}

export interface ProductDateStockSnapshot {
  dateYmd: string;
  pieces: number;
  volume: number;
  piecesAtDate: number;
  volumeAtDate: number;
  primaryFormatted: string;
  secondaryFormatted: string;
  initialPieces: number;
  initialFormatted: string;
  soldOnDatePieces: number;
  soldUpToDatePieces: number;
  returnedUpToDatePieces: number;
  restockedUpToDatePieces: number;
  initialEditCount: number;
}

export interface WarehouseProductChronologyResult {
  initialPieces: number;
  initialVolume: number;
  initialDate: string;
  initialFormatted: {
    primary: string;
    secondary: string;
  };
  currentPieces: number;
  currentFormatted: {
    primary: string;
    secondary: string;
  };
  totalRestockedPieces: number;
  totalSoldPieces: number;
  totalReturnedPieces: number;
  initialEditCount: number;
  initialAndEditLogs: WarehouseStockChangeLog[];
  timelineEvents: ProductChronologyTimelineItem[];
  getStockAtDate: (dateYmd: string) => ProductDateStockSnapshot;
}

export type ProductChronologyResult = WarehouseProductChronologyResult;

export function formatPiecesForWarehouseProduct(
  p: WarehouseProduct,
  piecesVal: number
): {
  primary: string;
  secondary: string;
  pieces: number;
  volume: number;
} {
  const safePieces = Math.max(0, Math.round(piecesVal * 100) / 100);
  const pieceUnit = p.pieceUnitName || 'dona';
  const baseUnit = p.baseUnit || 'litr';
  const volPerPiece = p.volumePerPiece || 1;
  const totalVol = Math.round(safePieces * volPerPiece * 100) / 100;
  const pkgName = (p.packageUnitName || '').trim();
  const piecesPerPkg = p.piecesPerPackage && p.piecesPerPackage > 1 ? p.piecesPerPackage : 1;

  if (pkgName && piecesPerPkg > 1) {
    const fullPkgs = Math.floor(safePieces / piecesPerPkg);
    const remPieces = Math.round((safePieces - fullPkgs * piecesPerPkg) * 100) / 100;
    const primary =
      fullPkgs > 0
        ? remPieces > 0
          ? `${fullPkgs.toLocaleString()} ${pkgName} + ${remPieces.toLocaleString()} ${pieceUnit}`
          : `${fullPkgs.toLocaleString()} ${pkgName}`
        : `${safePieces.toLocaleString()} ${pieceUnit}`;
    const secondary = `${safePieces.toLocaleString()} dona (${totalVol.toLocaleString()} ${baseUnit})`;
    return { primary, secondary, pieces: safePieces, volume: totalVol };
  }

  return {
    primary: `${safePieces.toLocaleString()} ${pieceUnit}`,
    secondary: `${totalVol.toLocaleString()} ${baseUnit}`,
    pieces: safePieces,
    volume: totalVol,
  };
}

export function convertQuantityToPieces(
  p: WarehouseProduct,
  quantity: number,
  unit?: string
): number {
  const q = Number(quantity) || 0;
  if (q <= 0) return 0;
  const u = (unit || '').toLowerCase().trim();
  const pkgName = (p.packageUnitName || '').toLowerCase().trim();
  const baseUnit = (p.baseUnit || '').toLowerCase().trim();
  const piecesPerPkg = p.piecesPerPackage && p.piecesPerPackage > 1 ? p.piecesPerPackage : 1;
  const volPerPiece = p.volumePerPiece && p.volumePerPiece > 0 ? p.volumePerPiece : 1;

  if (pkgName && piecesPerPkg > 1 && u === pkgName) {
    return q * piecesPerPkg;
  }
  if (
    baseUnit &&
    volPerPiece > 1 &&
    u === baseUnit &&
    u !== (p.pieceUnitName || '').toLowerCase().trim()
  ) {
    return Math.round((q / volPerPiece) * 100) / 100;
  }
  return q;
}

export function isMatchingWarehouseProduct(
  p: WarehouseProduct,
  prod: ProductItem,
  allWarehouseProducts: WarehouseProduct[] = []
): boolean {
  if (!prod || !p) return false;

  const cleanStr = (s?: string) => (s || '').toLowerCase().trim();
  const normAlnum = (s?: string) => cleanStr(s).replace(/[^a-z0-9]/g, '');

  if (prod.warehouseId && prod.warehouseId === p.id) {
    return true;
  }
  if ((prod as any).id && (prod as any).id === p.id) {
    return true;
  }

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

  if (!prod.name) return false;

  const prodNameClean = cleanStr(prod.name);
  const pNameClean = cleanStr(p.name);
  const pBrandClean = cleanStr(p.brand);
  const prodBrandClean = cleanStr((prod as any).brand);
  const pMark1Clean = cleanStr(p.mark1);
  const prodMark1Clean = cleanStr((prod as any).mark1);
  const pMark2Clean = cleanStr(p.mark2);
  const prodMark2Clean = cleanStr((prod as any).mark2);

  const fullP = [pBrandClean, pNameClean, pMark1Clean, pMark2Clean, ...(p.extraMarks || []).map(cleanStr)]
    .filter(Boolean)
    .join(' ');
  const pPrimary = [pBrandClean, pNameClean, pMark1Clean].filter(Boolean).join(' ');
  const pNameAndMark1 = [pNameClean, pMark1Clean].filter(Boolean).join(' ');
  const fullProd = [prodBrandClean, prodNameClean, prodMark1Clean, prodMark2Clean]
    .filter(Boolean)
    .join(' ');

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

  const pLiters = pVolTokens.filter((t) => t.endsWith('l'));
  const prodLiters = prodVolTokens.filter((t) => t.endsWith('l'));

  if (pLiters.length > 0 && prodLiters.length > 0) {
    const isLiterMatch = pLiters.some((pl) => prodLiters.includes(pl));
    if (!isLiterMatch) return false;
  } else if (pLiters.length > 0 && prodLiters.length === 0) {
    return false;
  }

  const pNums = pVolTokens.filter((t) => !t.endsWith('l') && !isNaN(Number(t)));
  const prodNums = prodVolTokens.filter((t) => !t.endsWith('l') && !isNaN(Number(t)));

  if (pLiters.length === 0 && prodLiters.length === 0 && pNums.length > 0 && prodNums.length > 0) {
    const hasMatchingNum = pNums.some((pn) => prodNums.includes(pn));
    if (!hasMatchingNum && (pNums.length === 1 || prodNums.length === 1)) {
      return false;
    }
  }

  if (pBrandClean && prodBrandClean && pBrandClean !== prodBrandClean) {
    return false;
  }
  if (pMark1Clean && prodMark1Clean && pMark1Clean !== prodMark1Clean) {
    return false;
  }

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
      if (prodBrandClean) return false;
    }
    return true;
  }

  return false;
}

interface RawFlowEvent {
  id: string;
  timestamp: string;
  dateStr: string;
  type: 'sale' | 'return' | 'adjustment';
  author: string;
  clientId?: string;
  clientName?: string;
  pieces: number; // positive magnitude; for adjustment can be signed
  quantityDisplay: string;
  unitPrice?: number;
  totalPrice?: number;
  paymentType?: string;
  note?: string;
}

const cleanStrFast = (s?: string) => (s || '').toLowerCase().trim();
const normAlnumFast = (s?: string) => cleanStrFast(s).replace(/[^a-z0-9]/g, '');

function extractVolumeTokensFast(str: string): string[] {
  const tokens: string[] = [];
  const regex = /\b(\d+(?:\.\d+)?)\s*(l|lt|litr|liter|kg|g|ml|w\d+)?\b/gi;
  let match: RegExpExecArray | null;
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
}

interface PrecomputedWhMatchData {
  product: WarehouseProduct;
  identityKey: string;
  pNameClean: string;
  pBrandClean: string;
  pMark1Clean: string;
  pLiters: string[];
  pNums: string[];
  normPFull: string;
  normPPrimary: string;
  normPNameMark1: string;
  normPName: string;
  normPMark1: string;
  normPBrand: string;
}

function precomputeWhMatchData(p: WarehouseProduct): PrecomputedWhMatchData {
  const pNameClean = cleanStrFast(p.name);
  const pBrandClean = cleanStrFast(p.brand);
  const pMark1Clean = cleanStrFast(p.mark1);
  const pMark2Clean = cleanStrFast(p.mark2);
  const fullP = [pBrandClean, pNameClean, pMark1Clean, pMark2Clean, ...(p.extraMarks || []).map(cleanStrFast)]
    .filter(Boolean)
    .join(' ');
  const pPrimary = [pBrandClean, pNameClean, pMark1Clean].filter(Boolean).join(' ');
  const pNameAndMark1 = [pNameClean, pMark1Clean].filter(Boolean).join(' ');
  const pVolTokens = extractVolumeTokensFast(fullP);
  const pLiters = pVolTokens.filter((t) => t.endsWith('l'));
  const pNums = pVolTokens.filter((t) => !t.endsWith('l') && !isNaN(Number(t)));
  const normPName = normAlnumFast(pNameClean);
  const normPBrand = normAlnumFast(pBrandClean);
  const normPMark1 = normAlnumFast(pMark1Clean);

  return {
    product: p,
    identityKey: `${normPName}|${normPBrand}|${normPMark1}`,
    pNameClean,
    pBrandClean,
    pMark1Clean,
    pLiters,
    pNums,
    normPFull: normAlnumFast(fullP),
    normPPrimary: normAlnumFast(pPrimary),
    normPNameMark1: normAlnumFast(pNameAndMark1),
    normPName,
    normPMark1,
    normPBrand,
  };
}

function matchPrecomputedWhByText(
  wh: PrecomputedWhMatchData,
  prodNameClean: string,
  prodBrandClean: string,
  prodMark1Clean: string,
  prodLiters: string[],
  prodNums: string[],
  normProdFull: string,
  normProdName: string
): boolean {
  if (!prodNameClean) return false;

  if (wh.pLiters.length > 0 && prodLiters.length > 0) {
    const isLiterMatch = wh.pLiters.some((pl) => prodLiters.includes(pl));
    if (!isLiterMatch) return false;
  } else if (wh.pLiters.length > 0 && prodLiters.length === 0) {
    return false;
  }

  if (wh.pLiters.length === 0 && prodLiters.length === 0 && wh.pNums.length > 0 && prodNums.length > 0) {
    const hasMatchingNum = wh.pNums.some((pn) => prodNums.includes(pn));
    if (!hasMatchingNum && (wh.pNums.length === 1 || prodNums.length === 1)) {
      return false;
    }
  }

  if (wh.pBrandClean && prodBrandClean && wh.pBrandClean !== prodBrandClean) {
    return false;
  }
  if (wh.pMark1Clean && prodMark1Clean && wh.pMark1Clean !== prodMark1Clean) {
    return false;
  }

  if (
    normProdFull === wh.normPFull ||
    normProdFull === wh.normPPrimary ||
    normProdFull === wh.normPNameMark1 ||
    normProdName === wh.normPPrimary ||
    normProdName === wh.normPNameMark1 ||
    normProdName === wh.normPName
  ) {
    if (wh.normPMark1 && !normProdFull.includes(wh.normPMark1)) {
      const hasLiterEquiv = wh.pLiters.length > 0 && prodLiters.some((pl) => wh.pLiters.includes(pl));
      if (!hasLiterEquiv) return false;
    }
    return true;
  }

  if (wh.normPName.length >= 2 && normProdFull.includes(wh.normPName)) {
    if (wh.normPMark1 && !normProdFull.includes(wh.normPMark1)) {
      const hasLiterEquiv = wh.pLiters.length > 0 && prodLiters.some((pl) => wh.pLiters.includes(pl));
      if (!hasLiterEquiv) return false;
    }
    if (wh.normPBrand && !normProdFull.includes(wh.normPBrand)) {
      if (prodBrandClean) return false;
    }
    return true;
  }

  return false;
}

function resolveEffectiveDateFast(
  dp: DailyPlanItem,
  prod: ProductItem,
  nowYmd: string,
  fallbackTime?: string
): { timestamp: string; dateStr: string } {
  const prodDateRaw = (prod as any).date || (prod as any).deliveredAt;
  const prodDateKey = prodDateRaw
    ? getPlanDateKey({ createdAt: prodDateRaw } as DailyPlanItem)
    : '';
  const planTargetDate = getClosedDateKey(dp) || getPlanDateKey(dp);
  const rawTime = prodDateRaw || fallbackTime || dp.completedAt || dp.closedAt || dp.createdAt || '';
  const rawDateKey = rawTime ? getPlanDateKey({ createdAt: rawTime } as DailyPlanItem) : '';

  const effectiveDateStr = planTargetDate || prodDateKey || rawDateKey || nowYmd;
  const timeSuffix =
    rawTime && rawTime.includes('T') ? rawTime.slice(10) : 'T12:00:00.000Z';
  const effectiveTimestamp =
    rawTime && rawTime.startsWith(effectiveDateStr)
      ? rawTime
      : `${effectiveDateStr}${timeSuffix}`;

  return { timestamp: effectiveTimestamp, dateStr: effectiveDateStr };
}

function assembleProductChronology(
  product: WarehouseProduct,
  flowEvents: RawFlowEvent[],
  editSystemLogs: SystemLog[],
  nowYmd: string
): WarehouseProductChronologyResult {
  const rawHistory: WarehouseStockChangeLog[] = Array.isArray(product.stockHistory)
    ? [...product.stockHistory]
    : [];

  // Reconstruct any missing edit logs from systemLogs ('ombor_kirimi' with 'Ombor mahsuloti tahrirlandi')
  if (editSystemLogs.length > 0) {
    const prodTitleMatch = `${product.brand} - ${product.name}`.toLowerCase();
    for (let i = 0; i < editSystemLogs.length; i++) {
      const sl = editSystemLogs[i];
      const isThisProd =
        sl.metadata?.productId === product.id ||
        (sl.actionTitle && sl.actionTitle.toLowerCase().includes(prodTitleMatch));
      if (!isThisProd) continue;

      const slTime = sl.timestamp || sl.createdAt || '';
      if (!slTime) continue;
      const slMs = new Date(slTime).getTime();
      const alreadyInHistory = rawHistory.some(
        (h) =>
          h.changeType !== 'initial_intake' &&
          Math.abs(new Date(h.timestamp).getTime() - slMs) < 5000
      );
      if (!alreadyInHistory) {
        const qMatch = (sl.details || '').match(/Qoldiq:\s*([\d.]+)\s*dona/i);
        const newP = qMatch ? parseFloat(qMatch[1]) || product.totalPieces : product.totalPieces;
        rawHistory.push({
          id: `whlog_sys_${sl.id}`,
          timestamp: slTime,
          dateStr: slTime.slice(0, 10),
          author: sl.userId || 'adminc',
          changeType: 'manual_adjustment',
          previousPieces: newP,
          newPieces: newP,
          deltaPieces: 0,
          note: sl.details || sl.actionTitle,
        });
      }
    }
  }

  let totalSoldPieces = 0;
  let totalReturnedPieces = 0;
  for (let i = 0; i < flowEvents.length; i++) {
    const e = flowEvents[i];
    if (e.type === 'sale') totalSoldPieces += e.pieces;
    else if (e.type === 'return') totalReturnedPieces += e.pieces;
  }

  const initialEditLogsOnly = rawHistory
    .filter((h) => h && h.changeType === 'initial_edit')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const restockLogsOnly = rawHistory
    .filter((h) => h && h.changeType === 'restock_intake' && (Number(h.deltaPieces) || 0) >= 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const totalRestockedPieces =
    Math.round(
      restockLogsOnly.reduce((sum, h) => sum + Math.max(0, Number(h.deltaPieces) || 0), 0) * 100
    ) / 100;

  const editLogsOnly = rawHistory
    .filter((h) => h && (h.changeType === 'initial_edit' || h.changeType === 'manual_adjustment'))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const configuredIntakePieces =
    product.intakeUnitType === 'package' &&
    product.packageUnitName &&
    (product.piecesPerPackage || 1) > 1
      ? (product.intakeQuantity || 0) * (product.piecesPerPackage || 1)
      : product.intakeQuantity || 0;

  const rawCurrentPieces = Math.max(0, product.totalPieces || 0);
  const hasExplicitInitialEdit =
    (product.initialEditCount || 0) > 0 || initialEditLogsOnly.length > 0;

  // Conservation formula: Initial + Restocked - Sold + Returned = Current
  // => Reconstructed Initial = Current - Restocked + Sold - Returned
  const reconstructedInitialFromConservation = Math.max(
    0,
    Math.round(
      (rawCurrentPieces - totalRestockedPieces + totalSoldPieces - totalReturnedPieces) * 100
    ) / 100
  );

  const initialPieces =
    hasExplicitInitialEdit &&
    product.initialTotalPieces !== undefined &&
    product.initialTotalPieces >= 0
      ? product.initialTotalPieces
      : restockLogsOnly.length > 0 &&
        product.initialTotalPieces !== undefined &&
        product.initialTotalPieces >= 0
      ? product.initialTotalPieces
      : Math.max(
          product.initialTotalPieces || 0,
          configuredIntakePieces,
          reconstructedInitialFromConservation
        );

  // Hozirgi qoldiq bosh qoldiq + yangi kelganlar - sotuv + qaytarishlarga asoslanadi
  const currentPieces = hasExplicitInitialEdit
    ? Math.max(
        0,
        Math.round(
          (initialPieces + totalRestockedPieces - totalSoldPieces + totalReturnedPieces) * 100
        ) / 100
      )
    : rawCurrentPieces;

  const initialVolume = Math.round(initialPieces * (product.volumePerPiece || 1) * 100) / 100;
  const initialDate =
    product.initialIntakeDate ||
    product.intakeDate ||
    (product.createdAt ? product.createdAt.slice(0, 10) : nowYmd);

  const initialFormatted = formatPiecesForWarehouseProduct(product, initialPieces);
  const currentFormatted = formatPiecesForWarehouseProduct(product, currentPieces);

  // Build initialIntakeLog + editLogsOnly in chronological order for the Initial Stock Changes History table
  const existingInitLog = rawHistory.find((h) => h && h.changeType === 'initial_intake');
  const firstOriginalInitialPieces =
    initialEditLogsOnly.length > 0 &&
    initialEditLogsOnly[0].previousInitialPieces !== undefined &&
    initialEditLogsOnly[0].previousInitialPieces >= 0
      ? initialEditLogsOnly[0].previousInitialPieces
      : existingInitLog && existingInitLog.newPieces >= 0 && initialEditLogsOnly.length > 0
      ? existingInitLog.newPieces
      : initialPieces;

  const initialIntakeLog: WarehouseStockChangeLog = {
    id: existingInitLog?.id || `whlog_init_${product.id}`,
    timestamp: product.createdAt || `${initialDate}T08:00:00.000Z`,
    dateStr: initialDate,
    author: product.createdBy || 'adminc',
    changeType: 'initial_intake',
    previousPieces: 0,
    newPieces: firstOriginalInitialPieces,
    deltaPieces: firstOriginalInitialPieces,
    previousInitialPieces: 0,
    newInitialPieces: firstOriginalInitialPieces,
    unit:
      (product.initialIntakeUnitType || product.intakeUnitType) === 'package' &&
      product.packageUnitName
        ? product.packageUnitName
        : product.pieceUnitName || 'dona',
    quantityInUnit:
      (product.initialIntakeUnitType || product.intakeUnitType) === 'package' &&
      (product.piecesPerPackage || 1) > 1
        ? Math.round((firstOriginalInitialPieces / (product.piecesPerPackage || 1)) * 100) / 100
        : firstOriginalInitialPieces,
    note:
      existingInitLog?.note ||
      product.notes ||
      'Baza yaratilganda / omborga dastlabki kiritilgan qoldiq',
  };

  const normalizedEditLogs: WarehouseStockChangeLog[] = editLogsOnly.map((el) => {
    if (
      el.changeType === 'initial_edit' &&
      el.previousInitialPieces !== undefined &&
      el.newInitialPieces !== undefined
    ) {
      const initDelta = Math.round((el.newInitialPieces - el.previousInitialPieces) * 100) / 100;
      return {
        ...el,
        previousPieces: el.previousInitialPieces,
        newPieces: el.newInitialPieces,
        deltaPieces: initDelta,
      };
    }
    return el;
  });

  const allInitialAndEditLogs: WarehouseStockChangeLog[] = [
    initialIntakeLog,
    ...normalizedEditLogs,
    ...restockLogsOnly,
  ].sort((a, b) => {
    if (a.changeType === 'initial_intake') return -1;
    if (b.changeType === 'initial_intake') return 1;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  // Build unified step-by-step timeline in chronological order (oldest -> newest) then reverse for display
  const rawTimeline: Array<{
    id: string;
    timestamp: string;
    dateStr: string;
    eventType: ProductChronologyTimelineItem['eventType'];
    title: string;
    subtitle: string;
    author: string;
    clientId?: string;
    clientName?: string;
    quantityDisplay: string;
    deltaPieces: number;
    unitPrice?: number;
    totalPrice?: number;
    paymentType?: string;
    note?: string;
  }> = [];

  for (let i = 0; i < flowEvents.length; i++) {
    const fe = flowEvents[i];
    if (fe.type === 'sale') {
      rawTimeline.push({
        id: fe.id,
        timestamp: fe.timestamp,
        dateStr: fe.dateStr,
        eventType: 'sale',
        title: `Mijozga sotildi: ${fe.clientName || 'Mijoz'}`,
        subtitle: `${fe.quantityDisplay} (${formatPiecesForWarehouseProduct(product, fe.pieces).primary})`,
        author: fe.author,
        clientId: fe.clientId,
        clientName: fe.clientName,
        quantityDisplay: `-${fe.pieces} dona (${fe.quantityDisplay})`,
        deltaPieces: -fe.pieces,
        unitPrice: fe.unitPrice,
        totalPrice: fe.totalPrice,
        paymentType: fe.paymentType,
        note: fe.note,
      });
    } else if (fe.type === 'return') {
      rawTimeline.push({
        id: fe.id,
        timestamp: fe.timestamp,
        dateStr: fe.dateStr,
        eventType: 'return',
        title: `Mijozdan omborga qaytarildi: ${fe.clientName || 'Mijoz'}`,
        subtitle: `${fe.quantityDisplay} omborga qayta kirim qilindi`,
        author: fe.author,
        clientId: fe.clientId,
        clientName: fe.clientName,
        quantityDisplay: `+${fe.pieces} dona (${fe.quantityDisplay})`,
        deltaPieces: fe.pieces,
        unitPrice: fe.unitPrice,
        note: fe.note,
      });
    }
  }

  restockLogsOnly.forEach((rl) => {
    const added = Math.max(0, Number(rl.deltaPieces) || 0);
    const unitDisplay =
      rl.quantityInUnit !== undefined && rl.unit
        ? `${rl.quantityInUnit} ${rl.unit}`
        : formatPiecesForWarehouseProduct(product, added).primary;
    rawTimeline.push({
      id: rl.id,
      timestamp: rl.timestamp,
      dateStr: rl.dateStr || (rl.timestamp ? rl.timestamp.slice(0, 10) : nowYmd),
      eventType: 'restock_intake',
      title: 'Omborga yangi keldi (Kirim)',
      subtitle: `+${unitDisplay} (${formatPiecesForWarehouseProduct(product, added).primary})`,
      author: rl.author || 'adminc',
      quantityDisplay: `+${added} dona (${unitDisplay})`,
      deltaPieces: added,
      note: rl.note,
    });
  });

  if (rawTimeline.length > 1) {
    rawTimeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  const earliestEventDate =
    rawTimeline.length > 0 && rawTimeline[0].dateStr < initialDate
      ? rawTimeline[0].dateStr
      : initialDate;

  const timelineWithBalances: ProductChronologyTimelineItem[] = [];
  let runningPieces = initialPieces;

  // 1st item: Initial database creation (Bosh qoldiq)
  timelineWithBalances.push({
    id: initialIntakeLog.id,
    timestamp: initialIntakeLog.timestamp,
    dateStr: earliestEventDate,
    eventType: 'initial_intake',
    title:
      editLogsOnly.length > 0
        ? `Baza yaratilganda dastlabki qoldiq (Bosh qoldiq — ${editLogsOnly.length} marta yangilangan)`
        : 'Baza yaratilganda dastlabki kiritilgan qoldiq (Bosh qoldiq)',
    subtitle: `${initialFormatted.primary} (${initialFormatted.secondary})`,
    author: initialIntakeLog.author,
    quantityDisplay: `+${initialPieces} dona (${initialFormatted.primary})`,
    deltaPieces: initialPieces,
    beforePieces: 0,
    afterPieces: initialPieces,
    note: initialIntakeLog.note,
    formattedAfter: initialFormatted.primary,
    description:
      editLogsOnly.length > 0
        ? `Bosh qoldiq: ${initialFormatted.primary} (${initialFormatted.secondary}). Barcha bugungi kungacha bo'lgan amallar shu bosh qoldiqqa asoslanadi.`
        : initialIntakeLog.note ||
          `Dastlabki qoldiq sifatida ${initialFormatted.primary} (${initialFormatted.secondary}) kiritildi`,
  });

  rawTimeline.forEach((item) => {
    const before = runningPieces;
    const after = Math.max(0, Math.round((before + item.deltaPieces) * 100) / 100);
    runningPieces = after;

    const afterFormatted = formatPiecesForWarehouseProduct(product, after);
    timelineWithBalances.push({
      id: item.id,
      timestamp: item.timestamp,
      dateStr: item.dateStr,
      eventType: item.eventType,
      title: item.title,
      subtitle: item.subtitle,
      author: item.author,
      clientId: item.clientId,
      clientName: item.clientName,
      quantityDisplay: item.quantityDisplay,
      deltaPieces: item.deltaPieces,
      beforePieces: before,
      afterPieces: after,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      paymentType: item.paymentType,
      note: item.note,
      formattedAfter: afterFormatted.primary,
      description: item.note || item.subtitle,
    });
  });

  const timelineEventsDesc = [...timelineWithBalances].reverse();

  const getStockAtDate = (dateYmd: string): ProductDateStockSnapshot => {
    const cleanDate = (dateYmd || '').trim() || nowYmd;

    let soldOnDate = 0;
    let soldUpToDate = 0;
    let returnedUpToDate = 0;
    let restockedUpToDate = 0;

    flowEvents.forEach((fe) => {
      if (fe.type === 'sale') {
        if (fe.dateStr <= cleanDate) {
          soldUpToDate += fe.pieces;
          if (fe.dateStr === cleanDate) {
            soldOnDate += fe.pieces;
          }
        }
      } else if (fe.type === 'return') {
        if (fe.dateStr <= cleanDate) {
          returnedUpToDate += fe.pieces;
        }
      }
    });

    restockLogsOnly.forEach((rl) => {
      const rDate = rl.dateStr || (rl.timestamp ? rl.timestamp.slice(0, 10) : '');
      if (!rDate || rDate <= cleanDate) {
        restockedUpToDate += Math.max(0, Number(rl.deltaPieces) || 0);
      }
    });

    const piecesAtDate = Math.max(
      0,
      Math.round((initialPieces + restockedUpToDate - soldUpToDate + returnedUpToDate) * 100) / 100
    );
    const formattedAtDate = formatPiecesForWarehouseProduct(product, piecesAtDate);

    return {
      dateYmd: cleanDate,
      pieces: piecesAtDate,
      volume: formattedAtDate.volume,
      piecesAtDate,
      volumeAtDate: formattedAtDate.volume,
      primaryFormatted: formattedAtDate.primary,
      secondaryFormatted: formattedAtDate.secondary,
      initialPieces,
      initialFormatted: initialFormatted.primary,
      soldOnDatePieces: Math.round(soldOnDate * 100) / 100,
      soldUpToDatePieces: Math.round(soldUpToDate * 100) / 100,
      returnedUpToDatePieces: Math.round(returnedUpToDate * 100) / 100,
      restockedUpToDatePieces: Math.round(restockedUpToDate * 100) / 100,
      initialEditCount: editLogsOnly.length,
    };
  };

  return {
    initialPieces,
    initialVolume,
    initialDate,
    initialFormatted: {
      primary: initialFormatted.primary,
      secondary: initialFormatted.secondary,
    },
    currentPieces,
    currentFormatted: {
      primary: currentFormatted.primary,
      secondary: currentFormatted.secondary,
    },
    totalRestockedPieces,
    totalSoldPieces: Math.round(totalSoldPieces * 100) / 100,
    totalReturnedPieces: Math.round(totalReturnedPieces * 100) / 100,
    initialEditCount: editLogsOnly.length,
    initialAndEditLogs: allInitialAndEditLogs,
    timelineEvents: timelineEventsDesc,
    getStockAtDate,
  };
}

/**
 * High-performance O(W + P + C + L) batch chronology builder for all warehouse products.
 * Produces 100% identical results to calling buildWarehouseProductChronology for each product,
 * while avoiding O(W * (P + C + L)) repeated scans and repeated localStorage JSON parsing.
 */
export function buildWarehouseChronologyMap(
  products: WarehouseProduct[],
  dailyPlans: DailyPlanItem[],
  clients: Client[],
  systemLogs?: SystemLog[]
): Map<string, WarehouseProductChronologyResult> {
  const result = new Map<string, WarehouseProductChronologyResult>();
  if (!products || products.length === 0) return result;

  const nowYmd = new Date().toISOString().slice(0, 10);

  // 1. Precompute warehouse product indices & normalized matching tokens ONCE
  const precomputedList: PrecomputedWhMatchData[] = new Array(products.length);
  const precomputedById = new Map<string, PrecomputedWhMatchData>();
  const identityGroups = new Map<string, PrecomputedWhMatchData[]>();
  const flowEventsByProdId = new Map<string, RawFlowEvent[]>();
  const clientsWithSaleByProdId = new Map<string, Set<string>>();

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const pre = precomputeWhMatchData(p);
    precomputedList[i] = pre;
    precomputedById.set(p.id, pre);
    const group = identityGroups.get(pre.identityKey);
    if (group) {
      group.push(pre);
    } else {
      identityGroups.set(pre.identityKey, [pre]);
    }
    flowEventsByProdId.set(p.id, []);
    clientsWithSaleByProdId.set(p.id, new Set());
  }

  // Memoized matcher from any ProductItem -> matching WarehouseProduct[]
  const matchCache = new Map<string, WarehouseProduct[]>();
  const findMatchingProducts = (prod: ProductItem): WarehouseProduct[] => {
    if (!prod) return [];
    const prodWhId = prod.warehouseId || '';
    const prodItemId = (prod as any).id || '';

    // Fast path: warehouseId points to a known warehouse product
    if (prodWhId && precomputedById.has(prodWhId)) {
      const targetPre = precomputedById.get(prodWhId)!;
      const group = identityGroups.get(targetPre.identityKey);
      const idMatchPre = prodItemId && prodItemId !== prodWhId ? precomputedById.get(prodItemId) : undefined;

      // Common case: unique identity and no cross-id match -> instant O(1)!
      if ((!group || group.length === 1) && !idMatchPre) {
        return [targetPre.product];
      }

      const matched: WarehouseProduct[] = [targetPre.product];
      if (idMatchPre && idMatchPre.product.id !== targetPre.product.id) {
        matched.push(idMatchPre.product);
      }
      if (group && group.length > 1 && prod.name) {
        const prodNameClean = cleanStrFast(prod.name);
        const prodBrandClean = cleanStrFast((prod as any).brand);
        const prodMark1Clean = cleanStrFast((prod as any).mark1);
        const prodMark2Clean = cleanStrFast((prod as any).mark2);
        const fullProd = [prodBrandClean, prodNameClean, prodMark1Clean, prodMark2Clean]
          .filter(Boolean)
          .join(' ');
        const prodVolTokens = extractVolumeTokensFast(fullProd);
        const prodLiters = prodVolTokens.filter((t) => t.endsWith('l'));
        const prodNums = prodVolTokens.filter((t) => !t.endsWith('l') && !isNaN(Number(t)));
        const normProdFull = normAlnumFast(fullProd);
        const normProdName = normAlnumFast(prodNameClean);

        for (let i = 0; i < group.length; i++) {
          const sib = group[i];
          if (sib.product.id === targetPre.product.id) continue;
          if (idMatchPre && sib.product.id === idMatchPre.product.id) continue;
          if (
            matchPrecomputedWhByText(
              sib,
              prodNameClean,
              prodBrandClean,
              prodMark1Clean,
              prodLiters,
              prodNums,
              normProdFull,
              normProdName
            )
          ) {
            matched.push(sib.product);
          }
        }
      }
      return matched;
    }

    // Fallback: cache by (id, warehouseId, brand, name, mark1, mark2)
    const cacheKey = `${prodItemId}|${prodWhId}|${(prod as any).brand || ''}|${prod.name || ''}|${(prod as any).mark1 || ''}|${(prod as any).mark2 || ''}`;
    const cached = matchCache.get(cacheKey);
    if (cached) return cached;

    const matched: WarehouseProduct[] = [];
    const prodNameClean = cleanStrFast(prod.name);
    const prodBrandClean = cleanStrFast((prod as any).brand);
    const prodMark1Clean = cleanStrFast((prod as any).mark1);
    const prodMark2Clean = cleanStrFast((prod as any).mark2);
    const fullProd = prodNameClean
      ? [prodBrandClean, prodNameClean, prodMark1Clean, prodMark2Clean].filter(Boolean).join(' ')
      : '';
    const prodVolTokens = fullProd ? extractVolumeTokensFast(fullProd) : [];
    const prodLiters = prodVolTokens.filter((t) => t.endsWith('l'));
    const prodNums = prodVolTokens.filter((t) => !t.endsWith('l') && !isNaN(Number(t)));
    const normProdFull = fullProd ? normAlnumFast(fullProd) : '';
    const normProdName = prodNameClean ? normAlnumFast(prodNameClean) : '';

    for (let i = 0; i < precomputedList.length; i++) {
      const wh = precomputedList[i];
      if ((prodWhId && prodWhId === wh.product.id) || (prodItemId && prodItemId === wh.product.id)) {
        matched.push(wh.product);
        continue;
      }
      if (
        prodNameClean &&
        matchPrecomputedWhByText(
          wh,
          prodNameClean,
          prodBrandClean,
          prodMark1Clean,
          prodLiters,
          prodNums,
          normProdFull,
          normProdName
        )
      ) {
        matched.push(wh.product);
      }
    }

    matchCache.set(cacheKey, matched);
    return matched;
  };

  // 2. Build clientsMap ONCE
  const clientsMap = new Map<string, Client>();
  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    if (c && c.id) clientsMap.set(c.id, c);
  }

  // 3. Single pass over dailyPlans
  for (let dIdx = 0; dIdx < dailyPlans.length; dIdx++) {
    const dp = dailyPlans[dIdx];
    if (!dp) continue;
    const clientObj = clientsMap.get(dp.clientId);
    const cName = dp.clientName || clientObj?.name || 'Mijoz';
    const seenByProdId = new Map<string, Set<string>>();

    const getSeenSet = (whId: string): Set<string> => {
      let s = seenByProdId.get(whId);
      if (!s) {
        s = new Set<string>();
        seenByProdId.set(whId, s);
      }
      return s;
    };

    if (dp.actionsHistory && dp.actionsHistory.length > 0) {
      for (let actIdx = 0; actIdx < dp.actionsHistory.length; actIdx++) {
        const act = dp.actionsHistory[actIdx];
        if (!act) continue;
        if (act.productsDelivered && act.productsDelivered.length > 0) {
          for (let pIdx = 0; pIdx < act.productsDelivered.length; pIdx++) {
            const prod = act.productsDelivered[pIdx];
            const matchedWhs = findMatchingProducts(prod);
            if (matchedWhs.length === 0) continue;
            const dedupKey = `sale_${prod.id || pIdx}_${prod.quantity}_${prod.unitPrice}`;
            const { timestamp, dateStr } = resolveEffectiveDateFast(dp, prod, nowYmd, act.timestamp);
            for (let mIdx = 0; mIdx < matchedWhs.length; mIdx++) {
              const product = matchedWhs[mIdx];
              const seen = getSeenSet(product.id);
              if (seen.has(dedupKey)) continue;
              seen.add(dedupKey);
              const pieces = convertQuantityToPieces(product, prod.quantity || 0, prod.unit);
              if (pieces > 0) {
                flowEventsByProdId.get(product.id)!.push({
                  id: `sale_act_${dp.id}_${actIdx}_${pIdx}`,
                  timestamp,
                  dateStr,
                  type: 'sale',
                  author: act.author || dp.lastExecutedBy || dp.agentUsername || 'adminc',
                  clientId: dp.clientId,
                  clientName: cName,
                  pieces,
                  quantityDisplay: `${prod.quantity} ${prod.unit || product.pieceUnitName || 'dona'}`,
                  unitPrice: prod.unitPrice || product.minSellingPrice || product.price || 0,
                  totalPrice: prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0),
                  paymentType: act.deliveryPayment?.paymentType || dp.deliveryPayment?.paymentType || 'qarz',
                  note: act.reportNote || dp.reportNote || dp.planNote,
                });
                clientsWithSaleByProdId.get(product.id)!.add(dp.clientId);
              }
            }
          }
        }
        if (act.productsReturned && act.productsReturned.length > 0) {
          for (let rIdx = 0; rIdx < act.productsReturned.length; rIdx++) {
            const ret = act.productsReturned[rIdx];
            const retAsProd: ProductItem = {
              id: ret.productId || '',
              name: ret.name,
              unit: ret.unit,
              quantity: ret.quantity,
              unitPrice: ret.unitPrice || 0,
              totalPrice: 0,
              warehouseId: ret.warehouseId,
            };
            const matchedWhs = findMatchingProducts(retAsProd);
            if (matchedWhs.length === 0) continue;
            const dedupKey = `ret_${ret.productId || rIdx}_${ret.quantity}`;
            const { timestamp, dateStr } = resolveEffectiveDateFast(dp, retAsProd, nowYmd, act.timestamp);
            for (let mIdx = 0; mIdx < matchedWhs.length; mIdx++) {
              const product = matchedWhs[mIdx];
              const seen = getSeenSet(product.id);
              if (seen.has(dedupKey)) continue;
              seen.add(dedupKey);
              const pieces = convertQuantityToPieces(product, ret.quantity || 0, ret.unit);
              if (pieces > 0) {
                flowEventsByProdId.get(product.id)!.push({
                  id: `ret_act_${dp.id}_${actIdx}_${rIdx}`,
                  timestamp,
                  dateStr,
                  type: 'return',
                  author: act.author || dp.lastExecutedBy || dp.agentUsername || 'adminc',
                  clientId: dp.clientId,
                  clientName: cName,
                  pieces,
                  quantityDisplay: `${ret.quantity} ${ret.unit || product.pieceUnitName || 'dona'}`,
                  unitPrice: ret.unitPrice || product.minSellingPrice || product.price || 0,
                  note: act.reportNote || dp.reportNote || 'Mijozdan omborga qaytarildi',
                });
              }
            }
          }
        }
      }
    }

    if (dp.productsDelivered && dp.productsDelivered.length > 0) {
      for (let pIdx = 0; pIdx < dp.productsDelivered.length; pIdx++) {
        const prod = dp.productsDelivered[pIdx];
        const matchedWhs = findMatchingProducts(prod);
        if (matchedWhs.length === 0) continue;
        const dedupKey = `sale_${prod.id || pIdx}_${prod.quantity}_${prod.unitPrice}`;
        const { timestamp, dateStr } = resolveEffectiveDateFast(dp, prod, nowYmd);
        for (let mIdx = 0; mIdx < matchedWhs.length; mIdx++) {
          const product = matchedWhs[mIdx];
          const seen = getSeenSet(product.id);
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);
          const pieces = convertQuantityToPieces(product, prod.quantity || 0, prod.unit);
          if (pieces > 0) {
            flowEventsByProdId.get(product.id)!.push({
              id: `sale_plan_${dp.id}_${pIdx}`,
              timestamp,
              dateStr,
              type: 'sale',
              author: dp.lastExecutedBy || dp.agentUsername || 'adminc',
              clientId: dp.clientId,
              clientName: cName,
              pieces,
              quantityDisplay: `${prod.quantity} ${prod.unit || product.pieceUnitName || 'dona'}`,
              unitPrice: prod.unitPrice || product.minSellingPrice || product.price || 0,
              totalPrice: prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0),
              paymentType: dp.deliveryPayment?.paymentType || 'qarz',
              note: dp.reportNote || dp.planNote,
            });
            clientsWithSaleByProdId.get(product.id)!.add(dp.clientId);
          }
        }
      }
    }

    if (dp.productsReturned && dp.productsReturned.length > 0) {
      for (let rIdx = 0; rIdx < dp.productsReturned.length; rIdx++) {
        const ret = dp.productsReturned[rIdx];
        const retAsProd: ProductItem = {
          id: ret.productId || '',
          name: ret.name,
          unit: ret.unit,
          quantity: ret.quantity,
          unitPrice: ret.unitPrice || 0,
          totalPrice: 0,
          warehouseId: ret.warehouseId,
        };
        const matchedWhs = findMatchingProducts(retAsProd);
        if (matchedWhs.length === 0) continue;
        const dedupKey = `ret_${ret.productId || rIdx}_${ret.quantity}`;
        const { timestamp, dateStr } = resolveEffectiveDateFast(dp, retAsProd, nowYmd);
        for (let mIdx = 0; mIdx < matchedWhs.length; mIdx++) {
          const product = matchedWhs[mIdx];
          const seen = getSeenSet(product.id);
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);
          const pieces = convertQuantityToPieces(product, ret.quantity || 0, ret.unit);
          if (pieces > 0) {
            flowEventsByProdId.get(product.id)!.push({
              id: `ret_plan_${dp.id}_${rIdx}`,
              timestamp,
              dateStr,
              type: 'return',
              author: dp.lastExecutedBy || dp.agentUsername || 'adminc',
              clientId: dp.clientId,
              clientName: cName,
              pieces,
              quantityDisplay: `${ret.quantity} ${ret.unit || product.pieceUnitName || 'dona'}`,
              unitPrice: ret.unitPrice || product.minSellingPrice || product.price || 0,
              note: dp.reportNote || 'Mijozdan omborga qaytarildi',
            });
          }
        }
      }
    }
  }

  // 4. Single pass over clients fallback sales
  for (let cIdx = 0; cIdx < clients.length; cIdx++) {
    const client = clients[cIdx];
    if (!client || !client.id || !client.products || client.products.length === 0) continue;

    let cachedProdAddLog: any | undefined;
    let cachedLatestCloseLog: any | undefined;
    let parsedClientLogs = false;

    const ensureClientLogs = () => {
      if (parsedClientLogs) return;
      parsedClientLogs = true;
      const clientLogs = Array.isArray(client.logs) ? client.logs : [];
      cachedProdAddLog = clientLogs.find(
        (l) => l && l.type === 'product_added' && l.title !== 'Mahsulot omborga qaytarildi'
      );
      cachedLatestCloseLog = clientLogs.find(
        (l) =>
          l &&
          (l.id?.endsWith('_close') ||
            l.title === 'Reja yakunlandi va yopildi' ||
            l.title === 'Reja bajarilmasdan yopildi')
      );
    };

    const inferClientDate = (prod?: ProductItem): { timestamp: string; dateStr: string } => {
      const prodDateRaw = prod ? (prod as any).date || (prod as any).deliveredAt : '';
      if (prodDateRaw) {
        const dKey = getPlanDateKey({ createdAt: prodDateRaw } as DailyPlanItem) || nowYmd;
        return {
          timestamp: prodDateRaw.includes('T') ? prodDateRaw : `${dKey}T12:00:00.000Z`,
          dateStr: dKey,
        };
      }
      ensureClientLogs();
      const closeTime = cachedLatestCloseLog?.timestamp || client.lastPlanClosedAt || '';
      if (closeTime) {
        const closeKey = getPlanDateKey({ createdAt: closeTime } as DailyPlanItem);
        if (closeKey) {
          return {
            timestamp: closeTime.includes('T') ? closeTime : `${closeKey}T12:00:00.000Z`,
            dateStr: closeKey,
          };
        }
      }
      const logTime = cachedProdAddLog?.timestamp || client.updatedAt || client.createdAt || '';
      const logKey = logTime
        ? getPlanDateKey({ createdAt: logTime } as DailyPlanItem) || nowYmd
        : nowYmd;
      return {
        timestamp: logTime && logTime.includes('T') ? logTime : `${logKey}T12:00:00.000Z`,
        dateStr: logKey,
      };
    };

    // Group matching products per warehouse product to mirror exact original idx numbering
    const matchingByWhId = new Map<string, { product: WarehouseProduct; prods: ProductItem[] }>();
    for (let pIdx = 0; pIdx < client.products.length; pIdx++) {
      const prod = client.products[pIdx];
      const matchedWhs = findMatchingProducts(prod);
      for (let mIdx = 0; mIdx < matchedWhs.length; mIdx++) {
        const wh = matchedWhs[mIdx];
        if (clientsWithSaleByProdId.get(wh.id)!.has(client.id)) continue;
        let bucket = matchingByWhId.get(wh.id);
        if (!bucket) {
          bucket = { product: wh, prods: [] };
          matchingByWhId.set(wh.id, bucket);
        }
        bucket.prods.push(prod);
      }
    }

    matchingByWhId.forEach(({ product, prods }) => {
      ensureClientLogs();
      prods.forEach((prod, idx) => {
        const { timestamp, dateStr } = inferClientDate(prod);
        const pieces = convertQuantityToPieces(product, prod.quantity || 0, prod.unit);
        if (pieces > 0) {
          flowEventsByProdId.get(product.id)!.push({
            id: `sale_client_${client.id}_${prod.id || idx}`,
            timestamp,
            dateStr,
            type: 'sale',
            author:
              cachedProdAddLog?.author ||
              cachedLatestCloseLog?.author ||
              client.lastPlanClosedBy ||
              client.createdBy ||
              'adminc',
            clientId: client.id,
            clientName: client.name || 'Mijoz',
            pieces,
            quantityDisplay: `${prod.quantity} ${prod.unit || product.pieceUnitName || 'dona'}`,
            unitPrice: prod.unitPrice || product.minSellingPrice || product.price || 0,
            totalPrice: prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0),
            paymentType: cachedProdAddLog?.paymentMethodLabel || 'qarz',
            note: cachedProdAddLog?.details,
          });
        }
      });
      clientsWithSaleByProdId.get(product.id)!.add(client.id);
    });
  }

  // 5. Read & pre-filter edit systemLogs ONCE (not 297x!)
  const resolvedSystemLogs =
    systemLogs && systemLogs.length > 0 ? systemLogs : getLocalSystemLogs();
  const editSystemLogs = resolvedSystemLogs.filter(
    (sl) =>
      sl &&
      sl.actionType === 'ombor_kirimi' &&
      sl.actionTitle &&
      sl.actionTitle.toLowerCase().includes('tahrirlandi')
  );

  // 6. Assemble chronology for every product
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    result.set(
      p.id,
      assembleProductChronology(p, flowEventsByProdId.get(p.id) || [], editSystemLogs, nowYmd)
    );
  }

  return result;
}

export function buildWarehouseProductChronology(
  product: WarehouseProduct,
  dailyPlans: DailyPlanItem[],
  clients: Client[],
  systemLogs?: SystemLog[],
  allWarehouseProducts: WarehouseProduct[] = []
): WarehouseProductChronologyResult {
  const nowYmd = new Date().toISOString().slice(0, 10);
  const clientsMap = new Map<string, Client>();
  clients.forEach((c) => clientsMap.set(c.id, c));

  const flowEvents: RawFlowEvent[] = [];
  const clientsWithSale = new Set<string>();

  // 1. Collect sales & returns from dailyPlans
  dailyPlans.forEach((dp) => {
    if (!dp) return;
    const clientObj = clientsMap.get(dp.clientId);
    const cName = dp.clientName || clientObj?.name || 'Mijoz';
    const seenInPlan = new Set<string>();

    if (dp.actionsHistory && dp.actionsHistory.length > 0) {
      dp.actionsHistory.forEach((act, actIdx) => {
        if (act && act.productsDelivered && act.productsDelivered.length > 0) {
          act.productsDelivered.forEach((prod, pIdx) => {
            if (isMatchingWarehouseProduct(product, prod, allWarehouseProducts)) {
              const dedupKey = `sale_${prod.id || pIdx}_${prod.quantity}_${prod.unitPrice}`;
              if (seenInPlan.has(dedupKey)) return;
              seenInPlan.add(dedupKey);

              const { timestamp, dateStr } = resolveEffectiveDateFast(dp, prod, nowYmd, act.timestamp);
              const pieces = convertQuantityToPieces(product, prod.quantity || 0, prod.unit);
              if (pieces > 0) {
                flowEvents.push({
                  id: `sale_act_${dp.id}_${actIdx}_${pIdx}`,
                  timestamp,
                  dateStr,
                  type: 'sale',
                  author: act.author || dp.lastExecutedBy || dp.agentUsername || 'adminc',
                  clientId: dp.clientId,
                  clientName: cName,
                  pieces,
                  quantityDisplay: `${prod.quantity} ${prod.unit || product.pieceUnitName || 'dona'}`,
                  unitPrice: prod.unitPrice || product.minSellingPrice || product.price || 0,
                  totalPrice: prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0),
                  paymentType: act.deliveryPayment?.paymentType || dp.deliveryPayment?.paymentType || 'qarz',
                  note: act.reportNote || dp.reportNote || dp.planNote,
                });
                clientsWithSale.add(dp.clientId);
              }
            }
          });
        }
        if (act && act.productsReturned && act.productsReturned.length > 0) {
          act.productsReturned.forEach((ret, rIdx) => {
            const retAsProd: ProductItem = {
              id: ret.productId || '',
              name: ret.name,
              unit: ret.unit,
              quantity: ret.quantity,
              unitPrice: ret.unitPrice || 0,
              totalPrice: 0,
              warehouseId: ret.warehouseId,
            };
            if (isMatchingWarehouseProduct(product, retAsProd, allWarehouseProducts)) {
              const dedupKey = `ret_${ret.productId || rIdx}_${ret.quantity}`;
              if (seenInPlan.has(dedupKey)) return;
              seenInPlan.add(dedupKey);

              const { timestamp, dateStr } = resolveEffectiveDateFast(dp, retAsProd, nowYmd, act.timestamp);
              const pieces = convertQuantityToPieces(product, ret.quantity || 0, ret.unit);
              if (pieces > 0) {
                flowEvents.push({
                  id: `ret_act_${dp.id}_${actIdx}_${rIdx}`,
                  timestamp,
                  dateStr,
                  type: 'return',
                  author: act.author || dp.lastExecutedBy || dp.agentUsername || 'adminc',
                  clientId: dp.clientId,
                  clientName: cName,
                  pieces,
                  quantityDisplay: `${ret.quantity} ${ret.unit || product.pieceUnitName || 'dona'}`,
                  unitPrice: ret.unitPrice || product.minSellingPrice || product.price || 0,
                  note: act.reportNote || dp.reportNote || 'Mijozdan omborga qaytarildi',
                });
              }
            }
          });
        }
      });
    }

    if (dp.productsDelivered && dp.productsDelivered.length > 0) {
      dp.productsDelivered.forEach((prod, pIdx) => {
        if (isMatchingWarehouseProduct(product, prod, allWarehouseProducts)) {
          const dedupKey = `sale_${prod.id || pIdx}_${prod.quantity}_${prod.unitPrice}`;
          if (seenInPlan.has(dedupKey)) return;
          seenInPlan.add(dedupKey);

          const { timestamp, dateStr } = resolveEffectiveDateFast(dp, prod, nowYmd);
          const pieces = convertQuantityToPieces(product, prod.quantity || 0, prod.unit);
          if (pieces > 0) {
            flowEvents.push({
              id: `sale_plan_${dp.id}_${pIdx}`,
              timestamp,
              dateStr,
              type: 'sale',
              author: dp.lastExecutedBy || dp.agentUsername || 'adminc',
              clientId: dp.clientId,
              clientName: cName,
              pieces,
              quantityDisplay: `${prod.quantity} ${prod.unit || product.pieceUnitName || 'dona'}`,
              unitPrice: prod.unitPrice || product.minSellingPrice || product.price || 0,
              totalPrice: prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0),
              paymentType: dp.deliveryPayment?.paymentType || 'qarz',
              note: dp.reportNote || dp.planNote,
            });
            clientsWithSale.add(dp.clientId);
          }
        }
      });
    }

    if (dp.productsReturned && dp.productsReturned.length > 0) {
      dp.productsReturned.forEach((ret, rIdx) => {
        const retAsProd: ProductItem = {
          id: ret.productId || '',
          name: ret.name,
          unit: ret.unit,
          quantity: ret.quantity,
          unitPrice: ret.unitPrice || 0,
          totalPrice: 0,
          warehouseId: ret.warehouseId,
        };
        if (isMatchingWarehouseProduct(product, retAsProd, allWarehouseProducts)) {
          const dedupKey = `ret_${ret.productId || rIdx}_${ret.quantity}`;
          if (seenInPlan.has(dedupKey)) return;
          seenInPlan.add(dedupKey);

          const { timestamp, dateStr } = resolveEffectiveDateFast(dp, retAsProd, nowYmd);
          const pieces = convertQuantityToPieces(product, ret.quantity || 0, ret.unit);
          if (pieces > 0) {
            flowEvents.push({
              id: `ret_plan_${dp.id}_${rIdx}`,
              timestamp,
              dateStr,
              type: 'return',
              author: dp.lastExecutedBy || dp.agentUsername || 'adminc',
              clientId: dp.clientId,
              clientName: cName,
              pieces,
              quantityDisplay: `${ret.quantity} ${ret.unit || product.pieceUnitName || 'dona'}`,
              unitPrice: ret.unitPrice || product.minSellingPrice || product.price || 0,
              note: dp.reportNote || 'Mijozdan omborga qaytarildi',
            });
          }
        }
      });
    }
  });

  // 2. Fallback sales from client.products & client.logs
  clients.forEach((client) => {
    if (!client || !client.id || clientsWithSale.has(client.id)) return;
    const clientLogs = Array.isArray(client.logs) ? client.logs : [];
    const prodAddLog = clientLogs.find(
      (l) => l && l.type === 'product_added' && l.title !== 'Mahsulot omborga qaytarildi'
    );
    const latestCloseLog = clientLogs.find(
      (l) =>
        l &&
        (l.id?.endsWith('_close') ||
          l.title === 'Reja yakunlandi va yopildi' ||
          l.title === 'Reja bajarilmasdan yopildi')
    );

    const inferClientDate = (prod?: ProductItem): { timestamp: string; dateStr: string } => {
      const prodDateRaw = prod ? (prod as any).date || (prod as any).deliveredAt : '';
      if (prodDateRaw) {
        const dKey = getPlanDateKey({ createdAt: prodDateRaw } as DailyPlanItem) || nowYmd;
        return {
          timestamp: prodDateRaw.includes('T') ? prodDateRaw : `${dKey}T12:00:00.000Z`,
          dateStr: dKey,
        };
      }
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
        ? getPlanDateKey({ createdAt: logTime } as DailyPlanItem) || nowYmd
        : nowYmd;
      return {
        timestamp: logTime && logTime.includes('T') ? logTime : `${logKey}T12:00:00.000Z`,
        dateStr: logKey,
      };
    };

    const matchingProds = (client.products || []).filter((prod) =>
      isMatchingWarehouseProduct(product, prod, allWarehouseProducts)
    );
    if (matchingProds.length > 0) {
      matchingProds.forEach((prod, idx) => {
        const { timestamp, dateStr } = inferClientDate(prod);
        const pieces = convertQuantityToPieces(product, prod.quantity || 0, prod.unit);
        if (pieces > 0) {
          flowEvents.push({
            id: `sale_client_${client.id}_${prod.id || idx}`,
            timestamp,
            dateStr,
            type: 'sale',
            author:
              prodAddLog?.author ||
              latestCloseLog?.author ||
              client.lastPlanClosedBy ||
              client.createdBy ||
              'adminc',
            clientId: client.id,
            clientName: client.name || 'Mijoz',
            pieces,
            quantityDisplay: `${prod.quantity} ${prod.unit || product.pieceUnitName || 'dona'}`,
            unitPrice: prod.unitPrice || product.minSellingPrice || product.price || 0,
            totalPrice: prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0),
            paymentType: prodAddLog?.paymentMethodLabel || 'qarz',
            note: prodAddLog?.details,
          });
        }
      });
      clientsWithSale.add(client.id);
    }
  });

  const resolvedSystemLogs =
    systemLogs && systemLogs.length > 0 ? systemLogs : getLocalSystemLogs();
  const editSystemLogs = resolvedSystemLogs.filter(
    (sl) =>
      sl &&
      sl.actionType === 'ombor_kirimi' &&
      sl.actionTitle &&
      sl.actionTitle.toLowerCase().includes('tahrirlandi')
  );

  return assembleProductChronology(product, flowEvents, editSystemLogs, nowYmd);
}
