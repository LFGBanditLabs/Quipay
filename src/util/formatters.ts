import i18n from "../i18n/config";

/**
 * Formats a number as a currency string based on the current locale.
 * @param amount The amount to format
 * @param currency The currency code (default: 'USD')
 * @returns A locale-aware formatted currency string
 */
export const formatCurrency = (amount: number, currency: string = "USD") => {
  const locale = i18n.language || "en";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  }).format(amount);
};

/**
 * Formats a date based on the current locale.
 * @param date The date to format
 * @param options Intl.DateTimeFormatOptions
 * @returns A locale-aware formatted date string
 */
export const formatDate = (
  date: Date | number,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
) => {
  const locale = i18n.language || "en";
  return new Intl.DateTimeFormat(locale, options).format(date);
};

/**
 * Formats a number based on the current locale.
 * @param value The value to format
 * @param minimumFractionDigits Minimum fraction digits
 * @param maximumFractionDigits Maximum fraction digits
 * @returns A locale-aware formatted number string
 */
export const formatNumber = (
  value: number,
  minimumFractionDigits: number = 2,
  maximumFractionDigits: number = 2,
) => {
  const locale = i18n.language || "en";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
};
