export type DateFormat = 'dd-MM-yyyy' | 'yyyy-MM-dd' | 'MM-dd-yyyy';

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'dd-MM-yyyy', label: 'dd-MM-yyyy  (Dutch / European)' },
  { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd  (ISO / International)' },
  { value: 'MM-dd-yyyy', label: 'MM-dd-yyyy  (US)' }
];

/**
 * Given a date string and the configured format, extract just the 4-digit year.
 * Handles plain 4-digit year strings too (e.g. "1985").
 */
export function extractYear(dateStr: string | undefined, format: DateFormat): string {
  if (!dateStr?.trim()) return '';
  const parts = dateStr.trim().split('-');
  // plain year
  if (parts.length === 1) return parts[0].length === 4 ? parts[0] : '';
  switch (format) {
    case 'yyyy-MM-dd':
      return parts[0] ?? '';
    case 'dd-MM-yyyy':
    case 'MM-dd-yyyy':
      return parts[2] ?? '';
  }
}

function toValidUTCDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d;
}

// Parses a configured date string (or plain yyyy) into a UTC date.
export function parseConfiguredDate(dateStr: string | undefined, format: DateFormat): Date | null {
  if (!dateStr?.trim()) return null;
  const parts = dateStr.trim().split('-');

  if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
    return toValidUTCDate(Number(parts[0]), 1, 1);
  }
  if (parts.length !== 3) return null;

  let day = 0;
  let month = 0;
  let year = 0;

  switch (format) {
    case 'yyyy-MM-dd':
      year = Number(parts[0]);
      month = Number(parts[1]);
      day = Number(parts[2]);
      break;
    case 'dd-MM-yyyy':
      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
      break;
    case 'MM-dd-yyyy':
      month = Number(parts[0]);
      day = Number(parts[1]);
      year = Number(parts[2]);
      break;
  }

  return toValidUTCDate(year, month, day);
}

export function calculateAgeInYears(startDate: Date, endDate: Date): number | null {
  if (endDate.getTime() < startDate.getTime()) return null;
  let age = endDate.getUTCFullYear() - startDate.getUTCFullYear();
  const monthDelta = endDate.getUTCMonth() - startDate.getUTCMonth();
  const dayDelta = endDate.getUTCDate() - startDate.getUTCDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) age -= 1;
  return age < 0 ? null : age;
}

