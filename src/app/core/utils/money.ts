export function rupeesToMinor(value: string | number): number {
  const normalized = typeof value === 'number' ? String(value) : value.replace(/[₹,\s]/g, '');
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return Number.NaN;
  const [rupees, paise = ''] = normalized.split('.');
  return Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
}

export function formatInr(amountMinor: number, showPaise = false): string {
  const value = amountMinor / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showPaise && amountMinor % 100 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}
