/**
 * useWorkforceRegistry
 * ────────────────────
 * Fetches the employer's active worker roster from the WorkforceRegistry
 * Soroban contract and enriches each worker with their stream history from
 * the backend analytics API.
 *
 * Also exposes `addWorker` and `removeWorker` mutations that build, sign,
 * and submit `set_stream_active` transactions through the connected wallet.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getWorkersByEmployer,
  getWorkerProfile,
  buildSetStreamActiveTx,
  WorkerProfile,
} from "../contracts/workforce_registry";
import {
  getStreamsByEmployer,
  submitAndAwaitTx,
  ContractStream,
} from "../contracts/payroll_stream";
import { wallet } from "../util/wallet";
import { networkPassphrase } from "../contracts/util";
import { useAuth } from "./useAuth";

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const STROOPS_PER_UNIT = 1e7;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkerStreamRecord {
  stream_id: number;
  worker: string;
  total_amount: string;
  withdrawn_amount: string;
  start_ts: number;
  end_ts: number;
  status: "active" | "completed" | "cancelled";
}

export interface WorkerEntry extends WorkerProfile {
  activeStreams: number;
  totalStreams: number;
  /** Total withdrawn across completed streams, in token units (not stroops). */
  totalPaid: number;
  streams: WorkerStreamRecord[];
  // Employee profile data from backend (set after on-chain registration)
  quipayId?: string | null;
  fullName?: string;
  jobTitle?: string;
  department?: string;
  workEmail?: string;
  employeeRef?: string;
}

/** A worker who registered under this employer but hasn't been approved onto
 *  the on-chain roster yet (registration = request; approval = set_stream_active). */
export interface PendingJoinRequest {
  wallet: string;
  fullName: string;
  jobTitle: string;
  department?: string;
  workEmail?: string;
  employeeRef?: string;
  registeredAt?: string;
}

export interface WorkerInvite {
  code: string;
  candidate_name: string;
  job_title: string;
  description: string | null;
  pay_amount: string;
  pay_token: string;
  duration_days: number;
  status: "pending" | "accepted" | "expired" | "cancelled";
  created_at: string;
}

export interface CreateInviteInput {
  candidateQuipayId: string;
  jobTitle: string;
  description?: string;
  payAmount: number;
  payToken?: string;
  durationDays: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkforceRegistry(employerAddress: string | undefined) {
  const { getAccessToken } = useAuth();
  const [workers, setWorkers] = useState<WorkerEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingJoinRequest[]>(
    [],
  );
  const [invites, setInvites] = useState<WorkerInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => setFetchTick((t) => t + 1), []);

  useEffect(() => {
    if (!employerAddress) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkers([]);
      setIsLoading(false);
      return;
    }

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Fetch profiles from the on-chain registry
        const profiles = await getWorkersByEmployer(
          employerAddress!,
          employerAddress!,
        );

        // 2. Fetch streams directly from the payroll_stream contract (no backend needed)
        let contractStreams: ContractStream[] = [];
        try {
          const page = await getStreamsByEmployer(employerAddress!, 0, 50);
          contractStreams = page.streams;
        } catch {
          // Contract unavailable — stream counts will be 0
        }

        // Also try backend if configured (enriches with withdrawn amounts)
        let backendStreams: WorkerStreamRecord[] = [];
        if (API_BASE)
          try {
            const res = await fetch(
              `${API_BASE}/analytics/streams?employer=${encodeURIComponent(employerAddress!)}&limit=200`,
            );
            if (res.ok) {
              const json = (await res.json()) as {
                ok: boolean;
                data?: WorkerStreamRecord[];
              };
              if (json.ok && Array.isArray(json.data))
                backendStreams = json.data;
            }
          } catch {
            /* backend unavailable */
          }

        // Fetch employee profiles (name, job title, dept, etc.)
        type EmpProfile = {
          worker_address: string;
          quipay_id: string | null;
          email: string | null;
          full_name: string;
          job_title: string;
          department: string | null;
          work_email: string | null;
          employee_ref: string | null;
          registered_at?: string;
        };
        let employeeProfiles: EmpProfile[] = [];
        if (API_BASE)
          try {
            const token = await getAccessToken();
            const res = await fetch(`${API_BASE}/api/employers/employees`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const json = (await res.json()) as { employees?: EmpProfile[] };
              employeeProfiles = json.employees ?? [];
            }
          } catch {
            /* backend unavailable */
          }

        // Fetch invites this employer has sent
        let fetchedInvites: WorkerInvite[] = [];
        if (API_BASE)
          try {
            const token = await getAccessToken();
            const res = await fetch(`${API_BASE}/api/employers/invites`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const json = (await res.json()) as { invites?: WorkerInvite[] };
              fetchedInvites = json.invites ?? [];
            }
          } catch {
            /* backend unavailable */
          }
        setInvites(fetchedInvites);

        // 3. Merge: prefer backend data if available, otherwise use contract data
        const entries: WorkerEntry[] = profiles.map((p) => {
          const empProfile = employeeProfiles.find(
            (ep) => ep.worker_address === p.wallet,
          );

          // Try backend first
          const backendWorkerStreams = backendStreams.filter(
            (s) => s.worker === p.wallet,
          );

          // Fall back to contract streams
          const contractWorkerStreams = contractStreams.filter(
            (s) => s.worker === p.wallet,
          );

          const profileFields = {
            quipayId: empProfile?.quipay_id,
            fullName: empProfile?.full_name,
            jobTitle: empProfile?.job_title,
            department: empProfile?.department ?? undefined,
            workEmail: empProfile?.email ?? empProfile?.work_email ?? undefined,
            employeeRef: empProfile?.employee_ref ?? undefined,
          };

          if (backendWorkerStreams.length > 0) {
            const activeStreams = backendWorkerStreams.filter(
              (s) => s.status === "active",
            ).length;
            const totalPaid = backendWorkerStreams
              .filter((s) => s.status === "completed")
              .reduce(
                (sum, s) =>
                  sum + parseFloat(s.withdrawn_amount) / STROOPS_PER_UNIT,
                0,
              );
            return {
              ...p,
              ...profileFields,
              activeStreams,
              totalStreams: backendWorkerStreams.length,
              totalPaid,
              streams: backendWorkerStreams,
            };
          }

          // Use on-chain data — status: 0=active, 1=cancelled, 2=completed, 3=paused
          const activeStreams = contractWorkerStreams.filter(
            (s) => s.status === 0 || s.status === 3,
          ).length;
          const onchainStreams: WorkerStreamRecord[] =
            contractWorkerStreams.map((s, idx) => ({
              stream_id: idx,
              worker: p.wallet,
              total_amount: String(s.total_amount ?? 0),
              withdrawn_amount: String(s.withdrawn_amount ?? 0),
              start_ts: Number(s.start_ts ?? 0),
              end_ts: Number(s.end_ts ?? 0),
              status:
                s.status === 2
                  ? "completed"
                  : s.status === 1
                    ? "cancelled"
                    : "active",
            }));

          return {
            ...p,
            ...profileFields,
            activeStreams,
            totalStreams: contractWorkerStreams.length,
            totalPaid: 0,
            streams: onchainStreams,
          };
        });

        setWorkers(entries);

        // Registered in the backend but not on the on-chain roster yet —
        // these are join requests awaiting the employer's approval.
        const rosterWallets = new Set(profiles.map((p) => p.wallet));
        setPendingRequests(
          employeeProfiles
            .filter((ep) => !rosterWallets.has(ep.worker_address))
            .map((ep) => ({
              wallet: ep.worker_address,
              fullName: ep.full_name,
              jobTitle: ep.job_title,
              department: ep.department ?? undefined,
              workEmail: ep.work_email ?? undefined,
              employeeRef: ep.employee_ref ?? undefined,
              registeredAt: ep.registered_at,
            })),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load workforce data",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [employerAddress, fetchTick]);

  // ─── addWorker ──────────────────────────────────────────────────────────────

  const addWorker = useCallback(
    async (workerAddress: string): Promise<void> => {
      if (!employerAddress) throw new Error("Wallet not connected");

      // Verify the worker is registered before calling set_stream_active
      const profile = await getWorkerProfile(employerAddress, workerAddress);
      if (!profile) {
        throw new Error(
          "Worker is not registered in the Workforce Registry. " +
            "They must register themselves before you can add them.",
        );
      }

      const { preparedXdr } = await buildSetStreamActiveTx(
        employerAddress,
        workerAddress,
        true,
      );

      const { signedTxXdr } = await wallet.signTransaction(preparedXdr, {
        networkPassphrase,
      });

      await submitAndAwaitTx(signedTxXdr);
      refetch();
    },
    [employerAddress, getAccessToken, refetch],
  );

  // ─── removeWorker ────────────────────────────────────────────────────────────

  const removeWorker = useCallback(
    async (workerAddress: string): Promise<void> => {
      if (!employerAddress) throw new Error("Wallet not connected");

      const { preparedXdr } = await buildSetStreamActiveTx(
        employerAddress,
        workerAddress,
        false,
      );

      const { signedTxXdr } = await wallet.signTransaction(preparedXdr, {
        networkPassphrase,
      });

      await submitAndAwaitTx(signedTxXdr);
      refetch();
    },
    [employerAddress, getAccessToken, refetch],
  );

  // ─── rejectWorker ───────────────────────────────────────────────────────────

  const rejectWorker = useCallback(
    async (workerAddress: string): Promise<void> => {
      if (!employerAddress) throw new Error("Wallet not connected");
      if (!API_BASE) throw new Error("Backend not configured");

      const token = await getAccessToken();
      const res = await fetch(
        `${API_BASE}/api/employers/worker-registrations/${encodeURIComponent(workerAddress)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        throw new Error(`Failed to reject request (${res.status})`);
      }
      refetch();
    },
    [employerAddress, getAccessToken, refetch],
  );

  // ─── createInvite ───────────────────────────────────────────────────────────

  const createInvite = useCallback(
    async (input: CreateInviteInput): Promise<{ inviteUrl: string }> => {
      if (!API_BASE) throw new Error("Backend not configured");

      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/employers/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          data.error ?? `Failed to create invite (${res.status})`,
        );
      }
      const data = (await res.json()) as { invite: WorkerInvite };
      refetch();
      return {
        inviteUrl: `${window.location.origin}/invite/${data.invite.code}`,
      };
    },
    [getAccessToken, refetch],
  );

  // ─── cancelInvite ───────────────────────────────────────────────────────────

  const cancelInvite = useCallback(
    async (code: string): Promise<void> => {
      if (!API_BASE) throw new Error("Backend not configured");

      const token = await getAccessToken();
      const res = await fetch(
        `${API_BASE}/api/employers/invites/${encodeURIComponent(code)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        throw new Error(`Failed to cancel invite (${res.status})`);
      }
      refetch();
    },
    [getAccessToken, refetch],
  );

  // ─── batchResolveQpIds ───────────────────────────────────────────────────

  const batchResolve = useCallback(
    async (
      qpIds: string[],
    ): Promise<Record<string, ResolvedWorkerInfo>> => {
      return batchResolveQpIds(qpIds, getAccessToken);
    },
    [getAccessToken],
  );

  return {
    workers,
    pendingRequests,
    invites,
    isLoading,
    error,
    refetch,
    addWorker,
    removeWorker,
    rejectWorker,
    createInvite,
    cancelInvite,
    batchResolveQpIds: batchResolve,
  };
}

export interface ResolvedWorkerInfo {
  qpId: string;
  walletStellar: string | null;
  email: string | null;
  fullName: string | null;
  jobTitle?: string | null;
  error?: string | null;
}

/**
 * Batch resolves multiple QP IDs against the backend API and employer roster.
 */
export async function batchResolveQpIds(
  qpIds: string[],
  getAccessToken?: () => Promise<string | null>,
): Promise<Record<string, ResolvedWorkerInfo>> {
  const result: Record<string, ResolvedWorkerInfo> = {};
  const uniqueQpIds = Array.from(
    new Set(qpIds.map((id) => id.toUpperCase().trim()).filter(Boolean)),
  );

  if (uniqueQpIds.length === 0) return result;

  let token: string | null = null;
  if (getAccessToken) {
    try {
      token = await getAccessToken();
    } catch {
      // non-fatal
    }
  }

  // 1. Try checking employer employees roster first
  const remainingIds = new Set(uniqueQpIds);
  if (API_BASE && token) {
    try {
      const res = await fetch(`${API_BASE}/api/employers/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          employees?: Array<{
            worker_address: string;
            quipay_id: string | null;
            email: string | null;
            full_name: string;
            job_title: string;
          }>;
        };

        (data.employees ?? []).forEach((emp) => {
          if (emp.quipay_id) {
            const normalized = emp.quipay_id.toUpperCase().trim();
            if (remainingIds.has(normalized)) {
              result[normalized] = {
                qpId: normalized,
                walletStellar: emp.worker_address,
                email: emp.email,
                fullName: emp.full_name,
                jobTitle: emp.job_title,
              };
              remainingIds.delete(normalized);
            }
          }
        });
      }
    } catch {
      // non-fatal
    }
  }

  // 2. Look up remaining QP IDs in parallel batches of 5
  const remainingArray = Array.from(remainingIds);
  const BATCH_SIZE = 5;

  for (let i = 0; i < remainingArray.length; i += BATCH_SIZE) {
    const chunk = remainingArray.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (id) => {
        if (!API_BASE) {
          result[id] = {
            qpId: id,
            walletStellar: null,
            email: null,
            fullName: null,
            error: "Backend API not configured for lookup",
          };
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/api/accounts/lookup/${id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await res.json();
          if (res.ok && data) {
            result[id] = {
              qpId: id,
              walletStellar: data.walletStellar ?? null,
              email: data.email ?? null,
              fullName: data.quipayId ?? id,
              error: data.walletStellar ? null : "No Stellar wallet registered",
            };
          } else {
            result[id] = {
              qpId: id,
              walletStellar: null,
              email: null,
              fullName: null,
              error: data.error ?? "QP ID not found",
            };
          }
        } catch (err) {
          result[id] = {
            qpId: id,
            walletStellar: null,
            email: null,
            fullName: null,
            error: err instanceof Error ? err.message : "Lookup failed",
          };
        }
      }),
    );
  }

  return result;
}
