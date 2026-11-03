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

