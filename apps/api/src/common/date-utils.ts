/**
 * Compare two Date objects by calendar day only (ignoring time).
 * Uses UTC date to avoid timezone-shift edge cases in comparisons.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Return YYYY-MM-DD from a Date object (UTC).
 */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Parse a YYYY-MM-DD string into a Date at midnight UTC.
 */
export function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
