/**
 * useEvmWallet.ts
 * ─────────────────
 * Reads the embedded EVM wallet address from the Privy user.
 * Used to auto-fill the destination address for cross-chain withdrawals.
 */

import { useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";

/**
 * Extracts the embedded EVM wallet address from the Privy user's linked
 * accounts. Matches by address shape (0x… = EVM/Arc).
 */
export function useEvmWallet(): { evmAddress: string | null } {
  const { user } = usePrivy();

  const evmAddress = useMemo(() => {
    if (!user?.linkedAccounts) return null;

    for (const account of user.linkedAccounts) {
      if (
        account.type === "wallet" &&
        account.connectorType === "embedded" &&
        typeof account.address === "string" &&
        account.address.startsWith("0x")
      ) {
        return account.address;
      }
    }
    return null;
  }, [user]);

  return { evmAddress };
}
