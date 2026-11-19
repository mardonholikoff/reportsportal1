export function formatMoney(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 USD';
  const rounded = Math.round(amount * 100) / 100;
  return (
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(rounded) + ' USD'
  );
}

export function formatNumber(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return new Intl.NumberFormat('uz-UZ').format(val);
}

export function formatDateDMY(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const trimmed = isoString.trim();
    // Handle YYYY-MM-DD directly to avoid timezone shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      return `${d}/${m}/${y}`;
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
}

export function formatDate(isoString: string): string {
  if (!isoString) return '—';
  try {
    const trimmed = isoString.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      return `${d}/${m}/${y}`;
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export function formatShortDate(isoString: string): string {
  return formatDateDMY(isoString);
}

export function getAgentDisplayName(username?: string | null): string {
  if (!username) return 'Noma\'lum';
  const raw = username.trim();
  const clean = raw.replace(/^@/, '').toLowerCase();
  if (clean === 'agentc1') return 'Eldorbek';
  if (clean === 'agentp1') return 'Mirsaid';
  return raw;
}

export function formatWarehouseStock(p: {
  totalPieces: number;
  pieceUnitName?: string;
  packageUnitName?: string;
  piecesPerPackage?: number;
  totalVolume?: number;
  baseUnit?: string;
}): {
  primary: string;
  secondary: string;
  packagesCount: number;
  remainderPieces: number;
  hasPackage: boolean;
} {
  const pieces = p.totalPieces || 0;
  const piecesPerPkg = p.piecesPerPackage && p.piecesPerPackage > 0 ? p.piecesPerPackage : 1;
  const hasPackage = Boolean(p.packageUnitName && p.packageUnitName.trim() && piecesPerPkg > 1);
  const pieceName = p.pieceUnitName || 'dona';
  const pkgName = p.packageUnitName || 'qadoq';
  const vol = p.totalVolume || 0;
  const base = p.baseUnit || 'litr';

  if (!hasPackage) {
    return {
      primary: `${formatNumber(pieces)} ${pieceName}`,
      secondary: `Jami hajm: ${formatNumber(vol)} ${base}`,
      packagesCount: 0,
      remainderPieces: pieces,
      hasPackage: false,
    };
  }

  const packagesCount = Math.floor(pieces / piecesPerPkg);
  const remainderPieces = pieces % piecesPerPkg;

  let primary = '';
  if (packagesCount > 0 && remainderPieces > 0) {
    primary = `${formatNumber(packagesCount)} ${pkgName} va ${remainderPieces} ${pieceName}`;
  } else if (packagesCount > 0) {
    primary = `${formatNumber(packagesCount)} ${pkgName}`;
  } else {
    primary = `${remainderPieces} ${pieceName}`;
  }

  const secondary = `Jami: ${formatNumber(pieces)} ${pieceName} (${formatNumber(vol)} ${base})`;

  return {
    primary,
    secondary,
    packagesCount,
    remainderPieces,
    hasPackage: true,
  };
}

export function calculateProfitMargin(product: {
  price?: number;
  pricingUnitType?: 'piece' | 'package';
  minSellingPrice?: number;
  minSellingPricingUnitType?: 'piece' | 'package';
  piecesPerPackage?: number;
}): {
  hasCost: boolean;
  costPerPiece: number;
  sellingPerPiece: number;
  profitPerPiece: number;
  marginPercent: number;
} {
  const piecesPerPkg = product.piecesPerPackage && product.piecesPerPackage > 0 ? product.piecesPerPackage : 1;
  const rawCost = product.price || 0;
  const rawSelling = product.minSellingPrice || 0;

  const costPerPiece = product.pricingUnitType === 'package' ? rawCost / piecesPerPkg : rawCost;
  const sellingPerPiece = product.minSellingPricingUnitType === 'package' ? rawSelling / piecesPerPkg : rawSelling;

  const hasCost = rawCost > 0;
  const profitPerPiece = hasCost ? sellingPerPiece - costPerPiece : 0;
  const marginPercent = hasCost && costPerPiece > 0 ? ((sellingPerPiece - costPerPiece) / costPerPiece) * 100 : 0;

  return {
    hasCost,
    costPerPiece,
    sellingPerPiece,
    profitPerPiece,
    marginPercent,
  };
}

export function getInitialDebtForClient(client: {
  initialDebt?: number;
  currentDebt?: number;
  logs?: Array<{ type?: string; title?: string; details?: string }>;
}): number {
  if (!client) return 0;

  // 1. Explicit initialDebt property (authoritative source whenever set or edited by admin)
  if (typeof client.initialDebt === 'number' && !isNaN(client.initialDebt) && client.initialDebt >= 0) {
    return Math.round(client.initialDebt * 100) / 100;
  }

  // 2. Fallback to creation audit log only if explicit initialDebt is missing (legacy records)
  if (Array.isArray(client.logs) && client.logs.length > 0) {
    const createLog =
      client.logs.find((l) => l && l.type === 'created') ||
      client.logs.find(
        (l) =>
          l &&
          l.title &&
          (l.title === "Mijoz ro'yxatga qo'shildi" ||
            l.title === "Mijoz qo'shildi" ||
            l.title.includes('Excel (.xlsx) orqali'))
      ) ||
      client.logs[client.logs.length - 1];

    if (createLog && createLog.details) {
      const match = createLog.details.match(/Qarz:\s*([\d\s.,]+)/i);
      if (match && match[1]) {
        const cleanVal = match[1].replace(/[\s,]/g, '');
        const parsed = parseFloat(cleanVal);
        if (!isNaN(parsed) && parsed >= 0) {
          return Math.round(parsed * 100) / 100;
        }
      }
    }
  }

  // 3. Fallback to currentDebt
  return client.currentDebt || 0;
}

type ClientLogLike = {
  id?: string;
  type?: string;
  title?: string;
  details?: string;
  amountChanged?: number;
};

type ClientBalanceLike = {
  initialDebt?: number;
  currentDebt?: number;
  currentAdvance?: number;
  logs?: ClientLogLike[];
};

function findClientCreationLog(logs?: ClientLogLike[]): ClientLogLike | undefined {
  if (!Array.isArray(logs) || logs.length === 0) return undefined;
  return (
    logs.find((l) => l && l.type === 'created') ||
    logs.find(
      (l) =>
        l &&
        l.title &&
        (l.title === "Mijoz ro'yxatga qo'shildi" ||
          l.title === "Mijoz qo'shildi" ||
          l.title.includes('Excel (.xlsx) orqali'))
    )
  );
}

export function hasClientCreationLog(client?: ClientBalanceLike | null): boolean {
  if (!client) return false;
  return Boolean(findClientCreationLog(client.logs));
}

export function getInitialAdvanceForClient(client?: ClientBalanceLike | null): number {
  if (!client) return 0;
  const createLog = findClientCreationLog(client.logs);
  if (createLog && createLog.details) {
    const match = createLog.details.match(/Avans:\s*([\d\s.,]+)/i);
    if (match && match[1]) {
      const cleanVal = match[1].replace(/[\s,]/g, '');
      const parsed = parseFloat(cleanVal);
      if (!isNaN(parsed) && parsed >= 0) {
        return Math.round(parsed * 100) / 100;
      }
    }
  }
  return 0;
}

/**
 * Returns the signed net-debt delta of a single audit log entry:
 *  - positive (+) means client's net debt increased (or advance decreased)
 *  - negative (-) means client's net debt decreased (or advance increased)
 */
export function getClientLogNetDelta(log?: ClientLogLike | null): number {
  if (!log) return 0;
  const amt = Number(log.amountChanged) || 0;
  if (amt <= 0) return 0;

  if (log.type === 'product_added') {
    const isReturn =
      String(log.id || '').endsWith('_ret') ||
      (log.title || '').toLowerCase().includes('qaytarildi');
    return Math.round((isReturn ? -amt : amt) * 100) / 100;
  }

  if (log.type === 'payment') {
    const text = `${log.title || ''} ${log.details || ''}`.toLowerCase();
    const isDebtAddition =
      text.includes("qarz qo'shildi") ||
      text.includes("qarzdorlik qo'shildi") ||
      String(log.id || '').endsWith('_whdebt');
    return Math.round((isDebtAddition ? amt : -amt) * 100) / 100;
  }

  return 0;
}

export function computeClientSubsequentOpsNetDelta(client?: ClientBalanceLike | null): number {
  if (!client || !Array.isArray(client.logs) || client.logs.length === 0) return 0;
  let deltaSum = 0;
  for (let i = 0; i < client.logs.length; i++) {
    deltaSum += getClientLogNetDelta(client.logs[i]);
  }
  return Math.round(deltaSum * 100) / 100;
}

export function getClientSubsequentOpsBreakdown(client?: ClientBalanceLike | null): {
  totalPayments: number;
  totalProductDebts: number;
  totalExtraDebts: number;
  totalReturns: number;
  netDelta: number;
} {
  let totalPayments = 0;
  let totalProductDebts = 0;
  let totalExtraDebts = 0;
  let totalReturns = 0;

  if (client && Array.isArray(client.logs)) {
    for (let i = 0; i < client.logs.length; i++) {
      const log = client.logs[i];
      if (!log) continue;
      const amt = Number(log.amountChanged) || 0;
      if (amt <= 0) continue;

      if (log.type === 'product_added') {
        const isReturn =
          String(log.id || '').endsWith('_ret') ||
          (log.title || '').toLowerCase().includes('qaytarildi');
        if (isReturn) {
          totalReturns += amt;
        } else if (String(log.id || '').endsWith('_whdebt')) {
          totalExtraDebts += amt;
        } else {
          totalProductDebts += amt;
        }
      } else if (log.type === 'payment') {
        const text = `${log.title || ''} ${log.details || ''}`.toLowerCase();
        const isDebtAddition =
          text.includes("qarz qo'shildi") ||
          text.includes("qarzdorlik qo'shildi") ||
          String(log.id || '').endsWith('_whdebt');
        if (isDebtAddition) {
          totalExtraDebts += amt;
        } else {
          totalPayments += amt;
        }
      }
    }
  }

  totalPayments = Math.round(totalPayments * 100) / 100;
  totalProductDebts = Math.round(totalProductDebts * 100) / 100;
  totalExtraDebts = Math.round(totalExtraDebts * 100) / 100;
  totalReturns = Math.round(totalReturns * 100) / 100;
  const netDelta =
    Math.round((totalProductDebts + totalExtraDebts - totalPayments - totalReturns) * 100) / 100;

  return {
    totalPayments,
    totalProductDebts,
    totalExtraDebts,
    totalReturns,
    netDelta,
  };
}

export function computeExpectedBalanceFromInitial(
  client: ClientBalanceLike,
  overrideInitialDebt?: number
): {
  initDebt: number;
  initAdvance: number;
  subsequentDelta: number;
  expectedNet: number;
  currentDebt: number;
  currentAdvance: number;
} {
  const initDebt =
    overrideInitialDebt !== undefined && !isNaN(overrideInitialDebt)
      ? Math.round(Math.max(0, overrideInitialDebt) * 100) / 100
      : getInitialDebtForClient(client);
  const rawInitAdvance = getInitialAdvanceForClient(client);
  const initAdvance =
    overrideInitialDebt !== undefined && initDebt > 0 ? 0 : rawInitAdvance;
  const subsequentDelta = computeClientSubsequentOpsNetDelta(client);
  const expectedNet = Math.round((initDebt - initAdvance + subsequentDelta) * 100) / 100;
  return {
    initDebt,
    initAdvance,
    subsequentDelta,
    expectedNet,
    currentDebt: expectedNet > 0 ? expectedNet : 0,
    currentAdvance: expectedNet < 0 ? Math.round(Math.abs(expectedNet) * 100) / 100 : 0,
  };
}


