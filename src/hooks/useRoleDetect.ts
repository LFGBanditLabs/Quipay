import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { isWorkerRegistered } from "../contracts/workforce_registry";

/**
 * Role is resolved two different ways:
 *
 *  - employer: authoritative backend status (`/api/employers/status`), Bearer
 *    auth only — no wallet required, since KYB can be completed before ever
 *    connecting a chain wallet.
 *  - worker: on-chain WorkforceRegistry membership, which still needs a
 *    connected wallet address (workers need one to receive payouts anyway,
 *    so this isn't a loss relative to being wallet-optional elsewhere).
 *
 * Cached in localStorage for 5 minutes, keyed by the Privy account id when
 * available (falling back to wallet address) so role state survives wallet
 * reconnects/switches instead of resetting, but the source of truth is
 * always re-checked once the cache expires.
 */

export type UserRole = "employer" | "worker" | "unknown";

const CACHE_TTL = 5 * 60 * 1000; // 5 min
const key = (id: string) => `quipay-role-v2-${id}`;
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function readCache(id: string): UserRole | null {
  try {
    const raw = localStorage.getItem(key(id));
    if (!raw) return null;
    const { role, ts } = JSON.parse(raw) as { role: UserRole; ts: number };
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(key(id));
      return null;
    }
    // Only cache confirmed roles — never cache "unknown"
    return role === "unknown" ? null : role;
  } catch {
    return null;
  }
}

function writeCache(id: string, role: UserRole) {
  if (role === "unknown") return; // don't cache — re-check next visit
  try {
    localStorage.setItem(key(id), JSON.stringify({ role, ts: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function clearRoleCache(id: string) {
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* */
  }
}

async function fetchIsEmployer(
  getAccessToken: () => Promise<string | null>,
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    const res = await fetch(`${API_BASE}/api/employers/status`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return Boolean(data.status) && data.status !== "not_started";
  } catch {
    return false;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRoleDetect(address: string | undefined) {
  const { authenticated, privyId, getAccessToken } = useAuth();
  const [role, setRole] = useState<UserRole>("unknown");
  const [isDetecting, setIsDetecting] = useState(false);

  const cacheId = privyId ?? address;

  useEffect(() => {
    if (!authenticated && !address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole("unknown");
      return;
    }

    if (cacheId) {
      const cached = readCache(cacheId);
      if (cached) {
        setRole(cached);
        return;
      }
    }

    setIsDetecting(true);

    void Promise.all([
      // Worker check: are they in the WorkforceRegistry? (still wallet-gated)
      address
        ? isWorkerRegistered(address, address).catch(() => false)
        : Promise.resolve(false),
      // Employer check: has their account completed/started KYB?
      authenticated ? fetchIsEmployer(getAccessToken) : Promise.resolve(false),
    ])
      .then(([isWorker, isEmployer]) => {
        let detected: UserRole;
        if (isWorker) detected = "worker";
        else if (isEmployer) detected = "employer";
        else detected = "unknown"; // new user

        setRole(detected);
        if (cacheId) writeCache(cacheId, detected);
      })
      .finally(() => {
        setIsDetecting(false);
      });
  }, [authenticated, address, cacheId, getAccessToken]);

  const forceRole = (r: UserRole) => {
    if (cacheId) writeCache(cacheId, r);
    setRole(r);
  };

  const resetRole = () => {
    if (cacheId) clearRoleCache(cacheId);
    setRole("unknown");
    setIsDetecting(false);
  };

  return { role, isDetecting, forceRole, resetRole };
}
