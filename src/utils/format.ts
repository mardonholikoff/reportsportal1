export function formatMoney(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "0 so'm";
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + " so'm";
}

export function formatNumber(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return new Intl.NumberFormat('uz-UZ').format(val);
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('uz-UZ', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatShortDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoString;
  }
}
