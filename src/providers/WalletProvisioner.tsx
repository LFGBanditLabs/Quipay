import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Reads an embedded wallet address for a chain off the Privy user's linked
 * accounts. Matches by address shape (G… = Stellar, 0x… = EVM/Arc) so it's
 * robust to how the SDK labels chainType for extended chains.
 */
function readEmbedded(user: unknown, kind: "stellar" | "arc"): string | null {
  const accts = (user as { linkedAccounts?: unknown[] })?.linkedAccounts;
  if (!Array.isArray(accts)) return null;
  for (const a of accts as Array<Record<string, unknown>>) {
    if (a?.type !== "wallet" || a?.connectorType !== "embedded") continue;
    const addr = typeof a.address === "string" ? a.address : "";
    if (kind === "stellar" && /^G[A-Z2-7]{55}$/.test(addr)) return addr;
    if (kind === "arc" && /^0x[a-fA-F0-9]{40}$/.test(addr)) return addr;
  }
  return null;
}

/**
 * Runs once per login. Ensures the user has both an Arc (EVM) and a Stellar
 * embedded wallet, then persists both addresses to their Quipay account. The
 * EVM wallet is auto-created by Privy config; Stellar is created here (no
 * createOnLogin for extended chains). Because Privy holds the keys, these
 * addresses are owned/authorized by definition — no paste, no verify step.
 */
export function WalletProvisioner() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { createWallet } = useCreateWallet();

  const stellarGuard = useRef<string | null>(null);
  const savedSig = useRef<string | null>(null);

  const uid = authenticated ? (user?.id ?? null) : null;

  // Create the Stellar wallet if it doesn't exist yet (one attempt per user).
  useEffect(() => {
    if (!ready || !uid) return;
    if (readEmbedded(user, "stellar")) return;
    if (stellarGuard.current === uid) return;
    stellarGuard.current = uid;
    void createWallet({ chainType: "stellar" }).catch((err) => {
      console.warn("[WalletProvisioner] Stellar wallet create failed:", err);
      stellarGuard.current = null; // allow a retry on next render
    });
  }, [ready, uid, user, createWallet]);

  // Once addresses are known, save them to the Quipay account.
  useEffect(() => {
    if (!ready || !uid) return;
    const arc = readEmbedded(user, "arc");
    const stellar = readEmbedded(user, "stellar");
    if (!arc && !stellar) return;

    const sig = `${uid}|${arc ?? ""}|${stellar ?? ""}`;
    if (savedSig.current === sig) return;
    savedSig.current = sig;

    void (async () => {
      try {
        const token = await getAccessToken();
        const link = (chain: "stellar" | "arc", address: string) =>
          fetch(`${API_BASE}/api/accounts/wallets`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ chain, address }),
          }).catch(() => undefined);
        if (stellar) await link("stellar", stellar);
        if (arc) await link("arc", arc);
      } catch (err) {
        console.warn("[WalletProvisioner] saving wallets failed:", err);
        savedSig.current = null; // let it retry next render
      }
    })();
  }, [ready, uid, user, getAccessToken]);

  return null;
}
