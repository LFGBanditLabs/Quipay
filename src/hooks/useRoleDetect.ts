import { useState, useEffect } from "react";
import {
  getStreamsByEmployer,
  getStreamsByWorker,
} from "../contracts/payroll_stream";

export type UserRole = "employer" | "worker" | "unknown";

interface RoleDetectResult {
  role: UserRole;
  isDetecting: boolean;
  setRole: (role: UserRole) => void;
  clearRole: () => void;
}

const CACHE_KEY = (address: string) => `quipay-role-${address}`;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readCache(address: string): UserRole | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY(address));
    if (!raw) return null;
    const { role, ts } = JSON.parse(raw) as { role: UserRole; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY(address));
      return null;
    }
    return role;
  } catch {
    return null;
  }
}

function writeCache(address: string, role: UserRole) {
  try {
    localStorage.setItem(
      CACHE_KEY(address),
      JSON.stringify({ role, ts: Date.now() }),
    );
  } catch {
    /* storage unavailable */
  }
}

export function useRoleDetect(address: string | undefined): RoleDetectResult {
  const [role, setRoleState] = useState<UserRole>("unknown");
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    if (!address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoleState("unknown");
      return;
    }

    // Use cached role if fresh
    const cached = readCache(address);
    if (cached) {
      setRoleState(cached);
      return;
    }

    setIsDetecting(true);

    // Query both contracts in parallel with limit=1 — just enough to confirm existence
    void Promise.all([
      getStreamsByEmployer(address, 0, 1).catch(() => ({
        streams: [],
        total: 0,
      })),
      getStreamsByWorker(address, 0, 1).catch(() => []),
    ])
      .then(([employerPage, workerIds]) => {
        const isEmployer =
          employerPage.total > 0 || employerPage.streams.length > 0;
        const isWorker = Array.isArray(workerIds) && workerIds.length > 0;

        // One role only — employer takes priority if both somehow match
        let detected: UserRole;
        if (isEmployer) detected = "employer";
        else if (isWorker) detected = "worker";
        else detected = "unknown"; // new user — will be asked once

        setRoleState(detected);
        writeCache(address, detected);
      })
      .finally(() => {
        setIsDetecting(false);
      });
  }, [address]);

  const setRole = (newRole: UserRole) => {
    if (address) writeCache(address, newRole);
    setRoleState(newRole);
  };

  const clearRole = () => {
    if (address) localStorage.removeItem(CACHE_KEY(address));
    setRoleState("unknown");
  };

  return { role, isDetecting, setRole, clearRole };
}
