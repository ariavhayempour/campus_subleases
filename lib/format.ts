const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

// Date-only values are formatted in UTC so the calendar day never shifts.
const day = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatRent(rentCents: number): string {
  return `${usd.format(rentCents / 100)}/mo`;
}

export function formatDate(isoDate: string): string {
  return day.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

export function formatDistanceKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatMonthYear(date: Date): string {
  return monthYear.format(date);
}
