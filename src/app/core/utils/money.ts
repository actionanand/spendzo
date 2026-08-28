export function rupeesToMinor(value: string | number): number {
  const normalized =
    typeof value === 'number'
      ? String(value)
      : value
          .trim()
          .replace(/^[^\d.+-]+/, '')
          .replace(/[,\s]/g, '');
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return Number.NaN;
  const [rupees, paise = ''] = normalized.split('.');
  return Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
}

export function formatInr(amountMinor: number, showPaise = false): string {
  return formatMoney(amountMinor, 'INR', 'IN', showPaise);
}

export function formatMoney(
  amountMinor: number,
  currencyCode: string,
  countryCode: string,
  showMinor = false,
): string {
  const value = amountMinor / 100;
  try {
    return new Intl.NumberFormat(countryCode === 'IN' ? 'en-IN' : `en-${countryCode}`, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: showMinor && amountMinor % 100 !== 0 ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toLocaleString('en-IN', {
      minimumFractionDigits: showMinor && amountMinor % 100 !== 0 ? 2 : 0,
      maximumFractionDigits: 2,
    })}`;
  }
}

export function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}
