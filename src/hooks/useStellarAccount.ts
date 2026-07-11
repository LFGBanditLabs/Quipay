import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * The account's linked Stellar address (the Privy embedded wallet), resolved
 * from the backend. This is the identity that dashboard/payroll/worker pages
 * key their on-chain reads on now that wallet-connect is no longer the login
 * mechanism. `ready` flips true once the lookup settles, so pages can wait
 * before showing a "no wallet" state.
 */
export function useStellarAccount() {
  const { getAccessToken } = useAuth();
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/api/accounts/wallets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as {
            wallets: Array<{ chain: string; address: string }>;
          };
          const s = data.wallets?.find((w) => w.chain === "stellar");
          if (!cancelled && s) setAddress(s.address);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  return { address, ready };
}
