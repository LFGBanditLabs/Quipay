import { useState, useEffect } from "react";
import { isWorkerRegistered } from "../contracts/workforce_registry";
import { getStreamsByEmployer } from "../contracts/payroll_stream";

/**
 * Role is determined entirely from on-chain state — no localStorage.
 *
 * worker   = address is registered in WorkforceRegistry
 * employer = address has created at least one stream via PayrollStream
 * unknown  = brand-new user, no on-chain history yet
 *
 * Cached in localStorage for 5 minutes to avoid repeated RPC calls,
 * but the source of truth is always the contracts.
 */

export type UserRole = "employer" | "worker" | "unknown";

const CACHE_TTL = 5 * 60 * 1000; // 5 min
const key = (addr: string) => `quipay-role-v2-${addr}`;

function readCache(addr: string): UserRole | null {
  try {
    const raw = localStorage.getItem(key(addr));
    if (!raw) return null;
    const { role, ts } = JSON.parse(raw) as { role: UserRole; ts: number };
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(key(addr));
      return null;
    }
    // Only cache confirmed roles — never cache "unknown"
    return role === "unknown" ? null : role;
  } catch {
    return null;
  }
}

function writeCache(addr: string, role: UserRole) {
  if (role === "unknown") return; // don't cache — re-check next visit
  try {
    localStorage.setItem(key(addr), JSON.stringify({ role, ts: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function clearRoleCache(addr: string) {
  try {
    localStorage.removeItem(key(addr));
  } catch {
    /* */
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRoleDetect(address: string | undefined) {
  const [role, setRole] = useState<UserRole>("unknown");
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    if (!address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole("unknown");
      return;
    }

    const cached = readCache(address);
    if (cached) {
      setRole(cached);
      return;
    }

    setIsDetecting(true);

    void Promise.all([
      // Worker check: are they in the WorkforceRegistry?
      isWorkerRegistered(address, address).catch(() => false),
      // Employer check: have they created any streams?
      getStreamsByEmployer(address, 0, 1).catch(() => ({
        streams: [],
        total: 0,
      })),
    ])
      .then(([isWorker, employerPage]) => {
        const hasStreams =
          employerPage.total > 0 || employerPage.streams.length > 0;

        let detected: UserRole;
        if (isWorker) detected = "worker";
        else if (hasStreams) detected = "employer";
        else detected = "unknown"; // new user

        setRole(detected);
        writeCache(address, detected);
      })
      .finally(() => {
        setIsDetecting(false);
      });
  }, [address]);

  const forceRole = (r: UserRole) => {
    if (address) writeCache(address, r);
    setRole(r);
  };

  const resetRole = () => {
    if (address) clearRoleCache(address);
    setRole("unknown");
    setIsDetecting(false);
  };

  return { role, isDetecting, forceRole, resetRole };
}
