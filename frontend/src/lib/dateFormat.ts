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

