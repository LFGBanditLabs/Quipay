/**
 * Converts an on-chain integer amount (e.g. Stellar stroops) to a token-unit
 * number.
 *
 * `Number(raw)` on its own loses precision once `raw` exceeds
 * `Number.MAX_SAFE_INTEGER` (2^53 - 1), which happens well within realistic
 * treasury sizes once stroops are counted (10^7 per token unit). Splitting
 * `raw` into a whole part and a remainder before converting to `Number` keeps
 * both halves within the safe integer range for all but astronomically large
 * amounts, since only the (much smaller) whole-unit count and the bounded
 * remainder ever get converted.
 *
 * @param raw - Raw on-chain integer amount, in the smallest unit.
 * @param decimals - Number of decimal places the smallest unit represents.
 *   Defaults to `7` (Stellar stroops).
 */
export function rawToUnitNumber(raw: bigint, decimals = 7): number {
  const divisor = 10n ** BigInt(decimals);
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const whole = abs / divisor;
  const remainder = abs % divisor;
  const value = Number(whole) + Number(remainder) / Number(divisor);
  return negative ? -value : value;
}

/**
 * Converts an on-chain integer amount to an exact decimal string, e.g.
 * `rawToUnitString(15_000_000_001n, 7)` returns `"1500.0000001"`.
 *
 * Built directly from BigInt division/remainder rather than
 * `(Number(raw) / 10 ** decimals).toString()`, so it never rounds regardless
 * of magnitude.
 *
 * @param raw - Raw on-chain integer amount, in the smallest unit.
 * @param decimals - Number of decimal places the smallest unit represents.
 *   Defaults to `7` (Stellar stroops).
 */
export function rawToUnitString(raw: bigint, decimals = 7): string {
  const divisor = 10n ** BigInt(decimals);
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const whole = abs / divisor;
  const remainder = abs % divisor;
  const fraction = remainder.toString().padStart(decimals, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}
