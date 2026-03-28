import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getDirection } from "./config";
import {
  formatCurrency,
  formatNumber,
  formatTokenLocale,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatPercent,
  type FormatCurrencyOptions,
  type FormatNumberOptions,
  type DateStyle,
} from "./formatters";

/**
 * Hook that returns memoised, locale-aware formatting helpers.
 *
 * All returned functions automatically use the current i18next language, so
 * they update reactively whenever the user switches locale.
 *
 * ```tsx
 * const { fmtCurrency, fmtDate, dir } = useLocaleFormat();
 * return <span dir={dir}>{fmtCurrency(1234)}</span>;
 * ```
 */
export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const lng = i18n.language;
  const dir = useMemo(() => getDirection(lng), [lng]);
  const isRtl = dir === "rtl";

  const fmtCurrency = useCallback(
    (value: number, opts?: FormatCurrencyOptions) =>
      formatCurrency(value, lng, opts),
    [lng],
  );

  const fmtNumber = useCallback(
    (value: number, opts?: FormatNumberOptions) =>
      formatNumber(value, lng, opts),
    [lng],
  );

  const fmtToken = useCallback(
    (value: number, maxDecimals?: number) =>
      formatTokenLocale(value, lng, maxDecimals),
    [lng],
  );

  const fmtDate = useCallback(
    (date: Date | string | number, style?: DateStyle) =>
      formatDate(date, lng, style),
    [lng],
  );

  const fmtDateTime = useCallback(
    (
      date: Date | string | number,
      dateStyle?: DateStyle,
      timeStyle?: DateStyle,
    ) => formatDateTime(date, lng, dateStyle, timeStyle),
    [lng],
  );

  const fmtRelative = useCallback(
    (value: number, unit: Intl.RelativeTimeFormatUnit) =>
      formatRelativeTime(value, unit, lng),
    [lng],
  );

  const fmtPercent = useCallback(
    (value: number, maxFrac?: number) => formatPercent(value, lng, maxFrac),
    [lng],
  );

  return {
    /** Current text direction — `"rtl"` or `"ltr"`. */
    dir,
    /** `true` when the active language is right-to-left. */
    isRtl,
    /** Current i18next language code. */
    locale: lng,

    fmtCurrency,
    fmtNumber,
    fmtToken,
    fmtDate,
    fmtDateTime,
    fmtRelative,
    fmtPercent,
  } as const;
}
