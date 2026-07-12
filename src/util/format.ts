/** Base unit precision for Stellar contract amounts (i128 stroops, 7 decimals). */
export const STROOPS = 10_000_000;

/** Compact-formats a number: >=1M -> "1.50M", >=1k -> "3.2k", else locale string. */
export function fmt(n: number, decimals = 2): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats a raw stroop value as a compact display number.
 * Use `formatTokenAmount` from `./tokenDecimals` instead when a token symbol
 * is available, since it accounts for per-asset decimal precision.
 */
export function fmtStroops(
  raw: string | number | bigint,
  decimals = 2,
): string {
  return fmt(Number(raw) / STROOPS, decimals);
}

/** Formats an ISO date string or Unix timestamp (seconds) for display. */
export function fmtDate(ts: string | number): string {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
