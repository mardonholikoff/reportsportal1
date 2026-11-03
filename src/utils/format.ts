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

