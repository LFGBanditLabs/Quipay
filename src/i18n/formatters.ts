/**
 * Locale-aware formatting utilities for Quipay financial data.
 *
 * All public functions accept an explicit `locale` string (BCP-47) so they
 * stay in sync with the current i18next language without importing the i18n
 * singleton — that keeps them pure and easy to test.
 */

// ── Locale → BCP-47 mapping ─────────────────────────────────────────────
const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  ar: "ar-SA",
  he: "he-IL",
};

/** Resolve a short locale code ("ar") to a full BCP-47 tag ("ar-SA"). */
export function resolveLocale(lng: string): string {
  const base = lng.split("-")[0].toLowerCase();
  return LOCALE_MAP[base] ?? lng;
}

// ── Currency formatting ──────────────────────────────────────────────────

export interface FormatCurrencyOptions {
  /** ISO 4217 currency code — defaults to `"USD"`. */
  currency?: string;
  /** Minimum fraction digits — defaults to `2`. */
  minimumFractionDigits?: number;
  /** Maximum fraction digits — defaults to `2`. */
  maximumFractionDigits?: number;
  /** When `true`, omit the currency symbol (just format the number). */
  numberOnly?: boolean;
}

/**
 * Format a monetary value according to the user's locale.
 *
 * ```ts
 * formatCurrency(1234.5, "ar")   // "١٬٢٣٤٫٥٠ US$"
 * formatCurrency(1234.5, "en")   // "$1,234.50"
 * formatCurrency(1234.5, "fr")   // "1 234,50 $US"
 * ```
 */
export function formatCurrency(
  value: number,
  locale: string,
  options: FormatCurrencyOptions = {},
): string {
  const {
    currency = "USD",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    numberOnly = false,
  } = options;

  const resolved = resolveLocale(locale);

  if (numberOnly) {
    return new Intl.NumberFormat(resolved, {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value);
  }

  return new Intl.NumberFormat(resolved, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

// ── Number formatting ────────────────────────────────────────────────────

export interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: "standard" | "compact";
}

/**
 * Format a plain number using locale-specific grouping & decimals.
 *
 * ```ts
 * formatNumber(10_000, "ar")  // "١٠٬٠٠٠"
 * formatNumber(10_000, "en")  // "10,000"
 * ```
 */
export function formatNumber(
  value: number,
  locale: string,
  options: FormatNumberOptions = {},
): string {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    notation = "standard",
  } = options;

  return new Intl.NumberFormat(resolveLocale(locale), {
    minimumFractionDigits,
    maximumFractionDigits,
    notation,
  }).format(value);
}

/**
 * Format a crypto-token amount (higher precision than fiat).
 *
 * ```ts
 * formatTokenLocale(0.001648, "en")  // "0.001648"
 * formatTokenLocale(0.001648, "ar")  // "٠٫٠٠١٦٤٨"
 * ```
 */
export function formatTokenLocale(
  value: number,
  locale: string,
  maxDecimals = 7,
): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

// ── Date/time formatting ─────────────────────────────────────────────────

export type DateStyle = "full" | "long" | "medium" | "short";

/**
 * Format a `Date` (or ISO string / timestamp) for the user's locale.
 *
 * ```ts
 * formatDate(new Date(), "ar")  // "٨ آذار ٢٠٢٥"
 * formatDate(new Date(), "en")  // "Mar 8, 2025"
 * ```
 */
export function formatDate(
  date: Date | string | number,
  locale: string,
  style: DateStyle = "medium",
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    dateStyle: style,
  }).format(d);
}

/**
 * Format a `Date` as date + time for the user's locale.
 */
export function formatDateTime(
  date: Date | string | number,
  locale: string,
  dateStyle: DateStyle = "medium",
  timeStyle: DateStyle = "short",
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    dateStyle,
    timeStyle,
  }).format(d);
}

/**
 * Format a relative time, e.g. "3 days ago" / "في غضون 3 أيام".
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: string,
): string {
  return new Intl.RelativeTimeFormat(resolveLocale(locale), {
    numeric: "auto",
  }).format(value, unit);
}

// ── Percentage formatting ────────────────────────────────────────────────

/**
 * Format a decimal ratio as a locale-aware percentage.
 *
 * ```ts
 * formatPercent(0.1234, "en")  // "12.34%"
 * formatPercent(0.1234, "ar")  // "١٢٫٣٤٪"
 * ```
 */
export function formatPercent(
  value: number,
  locale: string,
  maximumFractionDigits = 2,
): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "percent",
    maximumFractionDigits,
  }).format(value);
}
