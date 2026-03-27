/**
 * Token decimal precision mapping
 * Defines the number of decimal places for different token types
 */
export const TOKEN_DECIMALS: Record<string, number> = {
  XLM: 7,
  USDC: 2,
  EURC: 2,
  USDT: 6,
  BTC: 8,
  ETH: 18,
};

/**
 * Get the decimal precision for a token
 * Defaults to 7 (Stellar standard) if token not found
 * @param symbol Token symbol (e.g., 'XLM', 'USDC')
 * @returns Number of decimal places for the token
 */
export const getTokenDecimals = (symbol: string): number => {
  return TOKEN_DECIMALS[symbol.toUpperCase()] ?? 7;
};

/**
 * Format a number with token-specific decimal precision
 * Caps display at 7 significant digits for readability
 * @param value The numeric value to format
 * @param symbol Token symbol
 * @param maxSignificantDigits Maximum significant digits to display (default: 7)
 * @returns Formatted string with appropriate decimal places
 */
export const formatTokenAmount = (
  value: number,
  symbol: string,
  maxSignificantDigits: number = 7,
): string => {
  const decimals = getTokenDecimals(symbol);

  // For very small numbers, use the token's decimal precision
  if (value < 1) {
    return value.toFixed(decimals);
  }

  // For larger numbers, cap at significant digits for readability
  const significantDecimals = Math.max(
    0,
    maxSignificantDigits - Math.floor(Math.log10(value)) - 1,
  );
  const displayDecimals = Math.min(decimals, significantDecimals);

  return value.toFixed(displayDecimals);
};
