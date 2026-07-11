import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { WalletButton } from "../components/WalletButton";
import { buildRegisterWorkerTx } from "../contracts/workforce_registry";
import { submitAndAwaitTx } from "../contracts/payroll_stream";
import { ensureFundedAccount } from "../contracts/util";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface Invite {
  code: string;
  employer_address: string;
  business_name: string;
  candidate_name: string;
  job_title: string;
  description: string | null;
  pay_amount: string;
  pay_token: string;
  duration_days: number;
  status: "pending" | "accepted" | "expired" | "cancelled";
}

type LoadState = "loading" | "not_found" | "ready" | "error";

const InviteAccept: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const { address, signTransaction } = useWallet();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadState("loading");
      try {
        const res = await fetch(
          `${API_BASE}/api/employers/invites/${encodeURIComponent(code ?? "")}`,
        );
        if (cancelled) return;
        if (res.status === 404) {
          setLoadState("not_found");
          return;
        }
        if (!res.ok) {
          setLoadState("error");
          return;
        }
        const data = (await res.json()) as { invite: Invite };
        setInvite(data.invite);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleAccept = useCallback(async () => {
    if (!invite || !address || !signTransaction) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await ensureFundedAccount(address);
      const { preparedXdr } = await buildRegisterWorkerTx(
        address,
        invite.employer_address,
      );
      const { signedTxXdr } = await signTransaction(preparedXdr, {
        networkPassphrase: import.meta.env
          .PUBLIC_STELLAR_NETWORK_PASSPHRASE as string,
      });
      await submitAndAwaitTx(signedTxXdr);

      const res = await fetch(
        `${API_BASE}/api/employers/invites/${encodeURIComponent(invite.code)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerAddress: address }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Failed to record acceptance");
      }
      setAccepted(true);
    } catch (err: unknown) {
      setAcceptError(
        err instanceof Error ? err.message : "Failed to accept invite",
      );
    } finally {
      setAccepting(false);
    }
  }, [invite, address, signTransaction]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadState === "loading") {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" />
      </div>
    );
  }

  // ── Not found / error ────────────────────────────────────────────────────
  if (loadState === "not_found" || loadState === "error") {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-[20px] font-bold text-white mb-2">
          {loadState === "not_found"
            ? "Invite not found"
            : "Something went wrong"}
        </h1>
        <p className="text-[14px] text-neutral-500">
          {loadState === "not_found"
            ? "This invite link doesn't exist. Double-check the link your employer sent you."
            : "Couldn't load this invite right now. Please try again in a moment."}
        </p>
      </div>
    );
  }

  if (!invite) return null;

  // ── Already accepted (by this browser, this session) ────────────────────
  if (accepted) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
          <svg
            className="h-7 w-7 text-green-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-[20px] font-bold text-white mb-2">Request sent!</h1>
        <p className="text-[14px] text-neutral-500">
          {invite.business_name} has been notified. Once they approve you onto
          their roster and set up your payment stream, your earnings will appear
          on your worker dashboard.
        </p>
      </div>
    );
  }

  // ── Invite already used / expired / cancelled ───────────────────────────
  if (invite.status !== "pending") {
    const messages: Record<string, string> = {
      accepted: "This invite has already been accepted.",
      expired: "This invite has expired. Ask your employer to send a new one.",
      cancelled: "This invite was cancelled by the employer.",
    };
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-[20px] font-bold text-white mb-2">
          Invite no longer available
        </h1>
        <p className="text-[14px] text-neutral-500">
          {messages[invite.status] ?? "This invite is no longer active."}
        </p>
      </div>
    );
  }

  // ── The offer ────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg px-6 py-16 sm:py-24">
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
        <div className="h-[2px]" style={{ background: "#facc15" }} />
        <div className="p-8">
          <p className="text-[12px] font-bold uppercase tracking-widest text-yellow-400 mb-2">
            Job invite
          </p>
          <h1 className="text-[22px] font-bold text-white mb-1">
            {invite.business_name}
          </h1>
          <p className="text-[15px] text-neutral-300 mb-5">
            is inviting{" "}
            <span className="font-semibold text-white">
              {invite.candidate_name}
            </span>{" "}
            to join as{" "}
            <span className="font-semibold text-white">{invite.job_title}</span>
          </p>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
                Pay
              </p>
              <p className="text-[15px] font-bold text-white">
                {invite.pay_amount} {invite.pay_token}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
                Duration
              </p>
              <p className="text-[15px] font-bold text-white">
                {invite.duration_days} days
              </p>
            </div>
          </div>

          {invite.description && (
            <p className="mb-6 text-[13px] leading-relaxed text-neutral-400">
              {invite.description}
            </p>
          )}

          {!address ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
              <p className="text-[13px] text-neutral-400">
                Connect your wallet to accept this invite.
              </p>
              <WalletButton />
            </div>
          ) : (
            <div>
              {acceptError && (
                <p className="mb-3 text-[13px] text-red-400">{acceptError}</p>
              )}
              <button
                onClick={() => void handleAccept()}
                disabled={accepting}
                className="w-full rounded-xl px-4 py-3 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: "#facc15" }}
              >
                {accepting ? "Accepting…" : "Accept invite"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteAccept;
