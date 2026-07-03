/**
 * Shared Intl formatters — module-level singletons so every screen renders
 * numbers, currency and dates identically. Server-safe (no "use client");
 * usable from server components, client components and route handlers alike.
 */

const numberFormat = new Intl.NumberFormat("en-US");

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const currencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyCentsFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const relativeFormat = new Intl.RelativeTimeFormat("en", {
  style: "narrow",
  numeric: "always",
});

/** Largest-first unit ladder for formatRelative, in seconds. */
const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

function toValidDate(d: Date | string | number): Date | null {
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "1,234,567" */
export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** "1.2M" / "12.3K" / "987" */
export function formatCompact(n: number): string {
  return compactFormat.format(n);
}

/** "$1,234" — "$1.2M" with { compact: true }, "$1,234.56" with { decimals: 2 } */
export function formatCurrency(
  n: number,
  opts?: { compact?: boolean; decimals?: 0 | 2 },
): string {
  // Sub-cent magnitudes (float residue, credit-zeroed billing) read as "-$0.00" otherwise.
  const value = Math.abs(n) < 0.005 ? 0 : n;
  if (opts?.compact) return compactCurrencyFormat.format(value);
  return opts?.decimals === 2 ? currencyCentsFormat.format(value) : currencyFormat.format(value);
}

/** "12 Jun 2026" — invalid input renders "—" */
export function formatDate(d: Date | string | number): string {
  const date = toValidDate(d);
  return date === null ? "—" : dateFormat.format(date);
}

/** "3h ago" / "in 3h" / "just now" — invalid input renders "—" */
export function formatRelative(d: Date | string | number): string {
  const date = toValidDate(d);
  if (date === null) return "—";
  const deltaSeconds = (date.getTime() - Date.now()) / 1000;
  const magnitude = Math.abs(deltaSeconds);
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (magnitude >= seconds) {
      return relativeFormat.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return "just now";
}
