export function formatTzs(value: number) {
  return formatCurrency(value, 'TZS');
}

export function formatCurrency(value: number, currency = 'TZS') {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-TZ', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${new Intl.NumberFormat('en-TZ', {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return new Intl.DateTimeFormat('en-TZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function initialsFromName(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
