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

  const resolveEffectiveDate = (
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

    const effectiveDateStr = planTargetDate || prodDateKey || rawDateKey || nowYmd;
    const timeSuffix =
      rawTime && rawTime.includes('T') ? rawTime.slice(10) : 'T12:00:00.000Z';
    const effectiveTimestamp =
      rawTime && rawTime.startsWith(effectiveDateStr)
        ? rawTime
        : `${effectiveDateStr}${timeSuffix}`;

    return { timestamp: effectiveTimestamp, dateStr: effectiveDateStr };
  };

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

              const { timestamp, dateStr } = resolveEffectiveDate(dp, prod, act.timestamp);
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

              const { timestamp, dateStr } = resolveEffectiveDate(dp, retAsProd, act.timestamp);
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

          const { timestamp, dateStr } = resolveEffectiveDate(dp, prod);
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

          const { timestamp, dateStr } = resolveEffectiveDate(dp, retAsProd);
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

  // 3. Collect stockHistory & systemLogs for initial intake and manual edits
  const resolvedSystemLogs = systemLogs && systemLogs.length > 0 ? systemLogs : getLocalSystemLogs();
  const rawHistory: WarehouseStockChangeLog[] = Array.isArray(product.stockHistory)
    ? [...product.stockHistory]
    : [];

  // Reconstruct any missing edit logs from systemLogs ('ombor_kirimi' with 'Ombor mahsuloti tahrirlandi')
  const prodTitleMatch = `${product.brand} - ${product.name}`.toLowerCase();
  resolvedSystemLogs.forEach((sl) => {
    if (!sl || sl.actionType !== 'ombor_kirimi') return;
    const isThisProd =
      sl.metadata?.productId === product.id ||
      (sl.actionTitle && sl.actionTitle.toLowerCase().includes(prodTitleMatch));
    if (!isThisProd) return;

    const isEdit = sl.actionTitle?.toLowerCase().includes('tahrirlandi');
    if (isEdit) {
      const slTime = sl.timestamp || sl.createdAt || '';
      const alreadyInHistory = rawHistory.some(
        (h) =>
          h.changeType !== 'initial_intake' &&
          Math.abs(new Date(h.timestamp).getTime() - new Date(slTime).getTime()) < 5000
      );
      if (!alreadyInHistory && slTime) {
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
  });

  const totalSoldPieces = flowEvents
    .filter((e) => e.type === 'sale')
    .reduce((s, e) => s + e.pieces, 0);
  const totalReturnedPieces = flowEvents
    .filter((e) => e.type === 'return')
    .reduce((s, e) => s + e.pieces, 0);

  const initialEditLogsOnly = rawHistory
    .filter((h) => h && h.changeType === 'initial_edit')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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

  // Conservation formula: Initial - Sold + Returned = Current
  // => Reconstructed Initial = Current + Sold - Returned
  const reconstructedInitialFromConservation = Math.max(
    0,
    Math.round((rawCurrentPieces + totalSoldPieces - totalReturnedPieces) * 100) / 100
  );

  const initialPieces =
    hasExplicitInitialEdit &&
    product.initialTotalPieces !== undefined &&
    product.initialTotalPieces >= 0
      ? product.initialTotalPieces
      : Math.max(
          product.initialTotalPieces || 0,
          configuredIntakePieces,
          reconstructedInitialFromConservation
        );

  // Hozirgi qoldiq bosh qoldiqqa va bugungi kungacha bo'lgan amallarga (sotuv va qaytarishlarga) asoslanadi
  const currentPieces = hasExplicitInitialEdit
    ? Math.max(0, Math.round((initialPieces - totalSoldPieces + totalReturnedPieces) * 100) / 100)
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
    initialEditLogsOnly[0].previousInitialPieces > 0
      ? initialEditLogsOnly[0].previousInitialPieces
      : existingInitLog && existingInitLog.newPieces > 0 && initialEditLogsOnly.length > 0
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
  ];

  // Build unified step-by-step timeline in chronological order (oldest -> newest) then reverse for display
  // Barcha sotuv va qaytarish amallari yangilangan bosh qoldiqdan (initialPieces) boshlab hisoblanadi
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

  flowEvents
    .filter((fe) => fe.type === 'sale' || fe.type === 'return')
    .forEach((fe) => {
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
      } else {
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
    });

  rawTimeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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

  // Reverse so newest operations appear at the top (with initial intake clearly visible at the bottom of the chronology)
  const timelineEventsDesc = [...timelineWithBalances].reverse();

  const getStockAtDate = (dateYmd: string): ProductDateStockSnapshot => {
    const cleanDate = (dateYmd || '').trim() || nowYmd;

    let soldOnDate = 0;
    let soldUpToDate = 0;
    let returnedUpToDate = 0;

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

    const piecesAtDate = Math.max(
      0,
      Math.round((initialPieces - soldUpToDate + returnedUpToDate) * 100) / 100
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
    totalSoldPieces: Math.round(totalSoldPieces * 100) / 100,
    totalReturnedPieces: Math.round(totalReturnedPieces * 100) / 100,
    initialEditCount: editLogsOnly.length,
    initialAndEditLogs: allInitialAndEditLogs,
    timelineEvents: timelineEventsDesc,
    getStockAtDate,
  };
}
