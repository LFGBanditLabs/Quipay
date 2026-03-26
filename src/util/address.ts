/**
 * Shortens a Stellar address or hash for display.
 * @param addr The address or hash to shorten.
 * @param chars Number of characters to show at the end (default: 4).
 *              Shows 6 characters at the beginning.
 * @returns The shortened string (e.g., "GABC...XYZ").
 */
export const shortenAddress = (addr: string, chars: number = 4): string => {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-chars)}`;
};
