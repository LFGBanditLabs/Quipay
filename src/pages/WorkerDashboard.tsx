import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { recordWithdrawalEvent } from "../util/recordWithdrawal";
import { useWallet } from "../hooks/useWallet";
import { useStreamSubscription } from "../hooks/useStreamSubscription";
import {
  useStreams,
  WorkerStream,
  WithdrawalRecord,
} from "../hooks/useStreams";
import { useNotification } from "../hooks/useNotification";
import { buildWithdrawTx, submitAndAwaitTx } from "../contracts/payroll_stream";
import { formatTokenAmount } from "../util/tokenDecimals";
import { StreamTimeline } from "../components/StreamTimeline";
import CopyButton from "../components/CopyButton";
import {
  useElapsedTime,
  useSharedClockMs,
} from "../context/SharedClockContext";
import { SeoHelmet } from "../components/seo/SeoHelmet";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── Awaiting-invite card ──────────────────────────────────────────────────────
//
// Workers no longer search for a company and self-describe their own role —
// the employer defines the role/pay/duration and sends a personal invite link
// (see InviteAccept.tsx, /invite/:code). This card just points them there and
// shows their wallet address for the case where an employer already has it
// and adds them directly by address instead.

const AwaitingInvite: React.FC<{ workerAddress: string }> = ({
  workerAddress,
}) => {
  const { addNotification } = useNotification();

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
      <div className="h-[2px]" style={{ background: "#facc15" }} />
      <div className="p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400/10">
          <svg
            className="h-8 w-8 text-yellow-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 6L12 13 2 6" />
            <rect x="2" y="4" width="20" height="16" rx="2" />
          </svg>
        </div>
        <h3 className="text-[20px] font-bold text-white mb-2">
          Waiting on an invite
        </h3>
        <p className="text-[14px] text-neutral-500 mb-6 max-w-sm mx-auto">
          Your employer sends you a personal invite link with your role, pay,
          and duration already filled in — open it and accept to get started. No
          searching required.
        </p>
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 max-w-xs mx-auto">
          <span className="flex-1 truncate font-mono text-[12px] text-neutral-400">
            {workerAddress}
          </span>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(workerAddress);
              addNotification("Address copied", "success");
            }}
            className="shrink-0 text-neutral-600 hover:text-yellow-400 transition-colors"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
        <p className="mt-3 text-[12px] text-neutral-600">
          If your employer already has your address, they can add you directly —
          share it with them above.
        </p>
      </div>
    </div>
  );
};

// ─── Stream card ──────────────────────────────────────────────────────────────

const StreamCard: React.FC<{
  stream: WorkerStream;
  withdrawals: WithdrawalRecord[];
  workerAddress: string;
  onWithdrawn: () => void;
}> = ({ stream, withdrawals, workerAddress, onWithdrawn }) => {
  const { t } = useTranslation();
  const { signTransaction } = useWallet();
  const { addNotification, addStreamNotification } = useNotification();
  const [showTimeline, setShowTimeline] = useState(false);
  const [lastEventAmount, setLastEventAmount] = useState<number | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const previousAvailableRef = useRef<number | null>(null);
  const nowMs = useSharedClockMs();

  useStreamSubscription((update) => {
    if (update.streamId === String(stream.id))
      setLastEventAmount(update.amount);
  });

  const nowSeconds = Math.floor(nowMs / 1000);
  // cliff_ts = 0 means no cliff — use startTime so we don't measure from Unix epoch
  const effectiveCliff =
    stream.cliffTime > 0 ? stream.cliffTime : stream.startTime;
  const timeToCliff = effectiveCliff - nowSeconds;
  const isBeforeCliff = timeToCliff > 0;

  const timeUntilCliff = useMemo(() => {
    if (!isBeforeCliff) return "Unlocked";
    const d = Math.floor(timeToCliff / 86400);
    const h = Math.floor((timeToCliff % 86400) / 3600);
    const m = Math.floor((timeToCliff % 3600) / 60);
    const s = Math.floor(timeToCliff % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }, [isBeforeCliff, timeToCliff]);

  // Earnings always accrue from startTime — cliff only gates withdrawal
  const elapsedSinceStart = useElapsedTime(stream.startTime);
  const currentEarnings = Math.min(
    elapsedSinceStart * stream.flowRate,
    stream.totalAmount,
  );

  // What the user can actually withdraw (0 until cliff passes)
  const withdrawable = isBeforeCliff
    ? 0
    : Math.max(0, currentEarnings - stream.claimedAmount);

  // Distinguish "locked by cliff" from "withdrawable 0 because nothing accrued".
  // When locked by the cliff, show an explicit countdown tooltip on the button.
  const cliffTooltip = useMemo(() => {
    if (!isBeforeCliff) return undefined;
    const days = Math.ceil(timeToCliff / 86400);
    const unit = t(days === 1 ? "earnings.day" : "earnings.days");
    return t("earnings.cliff_tooltip", { days, unit });
  }, [isBeforeCliff, timeToCliff, t]);

  useEffect(() => {
    if (
      previousAvailableRef.current !== null &&
      previousAvailableRef.current <= 0 &&
      withdrawable > 0
    ) {
      addStreamNotification("withdrawal_available", {
        message: `Funds available to withdraw from stream ${stream.id}.`,
        dedupeKey: `withdrawal-available-${stream.id}`,
      });
    }
    previousAvailableRef.current = withdrawable;
  }, [addStreamNotification, withdrawable, stream.id]);

  const pct =
    stream.totalAmount > 0 ? (currentEarnings / stream.totalAmount) * 100 : 0;
  const remaining = Math.max(0, stream.totalAmount - currentEarnings);

  const handleWithdraw = async () => {
    if (!signTransaction || withdrawable <= 0) return;
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      const { preparedXdr } = await buildWithdrawTx(
        BigInt(stream.id),
        workerAddress,
      );
      const { signedTxXdr } = await signTransaction(preparedXdr, {
        networkPassphrase: import.meta.env
          .PUBLIC_STELLAR_NETWORK_PASSPHRASE as string,
      });
      const txHash = await submitAndAwaitTx(signedTxXdr);
      void recordWithdrawalEvent({
        workerAddress,
        employerAddress: stream.employerAddress,
        streamId: stream.id,
        amount: withdrawable,
        tokenSymbol: stream.tokenSymbol,
        txHash,
      });
      addNotification(
        `Withdrew ${withdrawable.toFixed(4)} ${stream.tokenSymbol}`,
        "success",
      );
      onWithdrawn();
    } catch (err: unknown) {
      const msg =
        (err instanceof Error ? err.message : null) ?? "Withdrawal failed";
      setWithdrawError(
        msg.includes("rejected") ? "Transaction rejected." : msg,
      );
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden flex flex-col">
      {/* Progress accent line at top */}
      <div className="h-[3px] w-full bg-white/[0.06]">
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{
            width: `${Math.min(100, pct)}%`,
            backgroundColor: "#facc15",
          }}
        />
      </div>

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Employer */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-white truncate">
              {stream.employerName || shortAddr(stream.employerAddress)}
            </p>
            <p className="font-mono text-[11px] text-neutral-600 mt-0.5 truncate">
              {shortAddr(stream.employerAddress)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              isBeforeCliff
                ? "bg-yellow-400/10 text-yellow-400"
                : "bg-green-500/10 text-green-400"
            }`}
          >
            {isBeforeCliff ? `🔒 ${timeUntilCliff}` : "● Live"}
          </span>
        </div>

        {/* Earnings */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-700 mb-1">
            Earned so far
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-black text-white tabular-nums leading-none font-mono">
              {currentEarnings.toFixed(7)}
            </span>
            <span
              className="text-[14px] font-bold"
              style={{ color: "#facc15" }}
            >
              {stream.tokenSymbol}
            </span>
          </div>
          <p className="text-[12px] text-neutral-700 mt-1">
            of {stream.totalAmount.toFixed(2)} {stream.tokenSymbol} total ·{" "}
            {pct.toFixed(1)}% complete
          </p>
        </div>

        {/* Flow rate */}
        <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-2.5">
          <span className="text-[12px] text-neutral-500">Rate</span>
          <span className="font-mono text-[13px] font-semibold text-white">
            {formatTokenAmount(stream.flowRate, stream.tokenSymbol, 7)}{" "}
            {stream.tokenSymbol}/s
          </span>
        </div>

        {/* Available to withdraw */}
        <div
          className="rounded-xl border px-4 py-3"
          style={{
            borderColor:
              withdrawable > 0
                ? "rgba(250,204,21,0.2)"
                : "rgba(255,255,255,0.05)",
            backgroundColor:
              withdrawable > 0
                ? "rgba(250,204,21,0.04)"
                : "rgba(255,255,255,0.02)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-neutral-500">
              Available to withdraw
            </span>
            <span
              className="font-mono text-[14px] font-black"
              style={{ color: withdrawable > 0 ? "#facc15" : "#525252" }}
            >
              {withdrawable.toFixed(7)} {stream.tokenSymbol}
            </span>
          </div>
          {remaining > 0 && (
            <p className="text-[11px] text-neutral-700 mt-0.5">
              {remaining.toFixed(4)} remaining
            </p>
          )}
        </div>

        {/* Last event */}
        {lastEventAmount !== null && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] px-3 py-2 text-[12px] text-blue-400 flex items-center gap-2">
            <span>⚡</span> Last withdrawal: {lastEventAmount.toFixed(7)}{" "}
            {stream.tokenSymbol}
          </div>
        )}

        {/* Actions */}
        {withdrawError && (
          <p className="text-[12px] text-red-400">{withdrawError}</p>
        )}
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
          >
            {showTimeline ? "Hide" : "History"}
          </button>
          <button
            onClick={() => void handleWithdraw()}
            disabled={withdrawable <= 0 || withdrawing}
            title={
              cliffTooltip ??
              (withdrawable <= 0
                ? t("earnings.nothing_to_withdraw")
                : undefined)
            }
            className="flex-1 rounded-xl py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#facc15" }}
          >
            {withdrawing ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Withdrawing...
              </span>
            ) : isBeforeCliff ? (
              `Locked · ${timeUntilCliff}`
            ) : (
              "Withdraw"
            )}
          </button>
        </div>

        {showTimeline && (
          <StreamTimeline stream={stream} withdrawals={withdrawals} />
        )}
      </div>
    </div>
  );
};

// ─── Completed stream card ────────────────────────────────────────────────────

const CompletedStreamCard: React.FC<{ stream: WorkerStream }> = ({
  stream,
}) => (
  <div className="rounded-2xl border border-white/[0.05] bg-[#0a0a0a] p-5 flex flex-col gap-3 opacity-70">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-white truncate">
          {stream.employerName || shortAddr(stream.employerAddress)}
        </p>
        <p className="font-mono text-[11px] text-neutral-600 truncate">
          {shortAddr(stream.employerAddress)}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-neutral-800 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-500">
        Completed
      </span>
    </div>
    <div>
      <p className="text-[11px] text-neutral-700 mb-0.5 uppercase tracking-widest font-bold">
        Total paid
      </p>
      <p className="text-[22px] font-black text-white font-mono">
        {formatTokenAmount(stream.totalAmount, stream.tokenSymbol)}{" "}
        <span className="text-[13px] font-semibold text-neutral-500">
          {stream.tokenSymbol}
        </span>
      </p>
    </div>
    <div className="h-[2px] w-full rounded-full bg-neutral-800" />
    {stream.proofGatewayUrl && (
      <a
        href={stream.proofGatewayUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 text-[13px] font-semibold text-white no-underline hover:bg-white/[0.06] transition-colors"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download Proof
      </a>
    )}
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Page ─────────────────────────────────────────────────────────────────────

interface RegisteredEmployer {
  employer_id: string;
  business_name: string;
  country_code: string;
  stellar_address: string;
}

function useRegisteredEmployers(workerAddress: string | undefined) {
  const [employers, setEmployers] = useState<RegisteredEmployer[]>([]);
  useEffect(() => {
    void (async () => {
      if (!workerAddress) {
        setEmployers([]);
        return;
      }
      try {
        const r = await fetch(
          `${API_BASE}/api/employers/worker-registrations/${encodeURIComponent(workerAddress)}`,
        );
        const d = (await r.json()) as { employers: RegisteredEmployer[] };
        setEmployers(d.employers ?? []);
      } catch {
        setEmployers([]);
      }
    })();
  }, [workerAddress]);
  return employers;
}

function useBackendTotalWithdrawn(address: string | undefined, tick: number) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!address || !API_BASE) return;
    fetch(
      `${API_BASE}/api/employers/withdrawal-events?address=${encodeURIComponent(address)}`,
    )
      .then((r) => r.json())
      .then((d: { withdrawals?: { amount: string }[] }) => {
        const sum = (d.withdrawals ?? []).reduce(
          (s, w) => s + parseFloat(w.amount),
          0,
        );
        setTotal(sum);
      })
      .catch(() => {});
  }, [address, tick]);
  return total;
}

const WorkerDashboard: React.FC = () => {
  const { address } = useWallet();
  const { streams, withdrawalHistory, isLoading, error, refetch } =
    useStreams(address);
  const registeredEmployers = useRegisteredEmployers(address);
  const [withdrawTick, setWithdrawTick] = useState(0);
  useBackendTotalWithdrawn(address, withdrawTick);
  const { addStreamNotification } = useNotification();
  const previousStreamStatusesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (isLoading) return;
    const prev = previousStreamStatusesRef.current;
    streams.forEach((stream) => {
      const ps = prev[stream.id];
      if (ps === undefined) return;
      if (ps !== 2 && stream.status === 2)
        addStreamNotification("stream_completed", {
          message: `Stream ${stream.id} completed.`,
          dedupeKey: `stream-completed-${stream.id}`,
        });
      if (ps !== 1 && stream.status === 1)
        addStreamNotification("stream_cancelled", {
          message: `Stream ${stream.id} was cancelled.`,
          dedupeKey: `stream-cancelled-${stream.id}`,
        });
    });
    previousStreamStatusesRef.current = streams.reduce<Record<string, number>>(
      (acc, s) => {
        acc[s.id] = s.status;
        return acc;
      },
      {},
    );
  }, [addStreamNotification, isLoading, streams]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="mb-8 h-8 w-48 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── No wallet ─────────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10">
          <svg
            className="h-8 w-8 text-yellow-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        </div>
        <h2 className="text-[20px] font-bold text-white mb-2">
          Connect your wallet
        </h2>
        <p className="text-[14px] text-neutral-500">
          Connect your Stellar wallet to view your earnings.
        </p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <p className="text-[18px] font-bold text-white mb-2">
          Failed to load streams
        </p>
        <p className="font-mono text-[12px] text-neutral-600 mb-6">{error}</p>
        <button
          onClick={refetch}
          className="rounded-xl px-6 py-3 text-[14px] font-bold text-black"
          style={{ backgroundColor: "#facc15" }}
        >
          Retry
        </button>
      </div>
    );
  }

  const activeStreams = streams.filter((s) => s.status !== 2);
  const completedStreams = streams.filter((s) => s.status === 2);

  // Summary stats
  const totalEarned = activeStreams.reduce((s, st) => s + st.totalAmount, 0);
  // claimedAmount comes directly from the contract — always accurate
  const totalWithdrawn = streams.reduce((s, st) => s + st.claimedAmount, 0);

  return (
    <>
      <SeoHelmet
        title="My Earnings · Quipay"
        description="Your real-time earnings on Quipay"
        path="/worker"
        robots="noindex,nofollow"
      />

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold text-white tracking-tight">
              My Earnings
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-[12px] text-neutral-600">
                {shortAddr(address)}
              </span>
              <CopyButton value={address} label="Copy your wallet address" />
            </div>
          </div>
          {activeStreams.length > 0 && (
            <span className="rounded-full bg-green-500/10 px-3 py-1 text-[12px] font-bold text-green-400">
              ● {activeStreams.length} active stream
              {activeStreams.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {streams.length === 0 ? (
          <AwaitingInvite workerAddress={address} />
        ) : (
          <>
            {/* Stats strip */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
                  Active Streams
                </p>
                <p className="text-[28px] font-black text-white">
                  {activeStreams.length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
                  Total in Streams
                </p>
                <p
                  className="text-[28px] font-black"
                  style={{ color: "#facc15" }}
                >
                  {totalEarned.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
                  Total Withdrawn
                </p>
                <p className="text-[28px] font-black text-white">
                  {totalWithdrawn.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {/* Active streams */}
            {activeStreams.length > 0 && (
              <div className="mb-10">
                <h2 className="text-[18px] font-bold text-white mb-4">
                  Active Streams
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {activeStreams.map((s) => (
                    <StreamCard
                      key={s.id}
                      stream={s}
                      workerAddress={address}
                      withdrawals={withdrawalHistory.filter(
                        (w) => w.streamId === s.id,
                      )}
                      onWithdrawn={() => {
                        setWithdrawTick((t) => t + 1);
                        refetch();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed streams */}
            {completedStreams.length > 0 && (
              <div className="mb-10">
                <h2 className="text-[18px] font-bold text-white mb-4">
                  Completed
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {completedStreams.map((s) => (
                    <CompletedStreamCard key={s.id} stream={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Registered employers (from workforce_registry, may not have streams yet) */}
            {registeredEmployers.length > 0 && (
              <div className="mb-10">
                <h2 className="text-[18px] font-bold text-white mb-4">
                  Your Employers
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {registeredEmployers.map((emp) => {
                    const hasStream = streams.some(
                      (s) => s.employerAddress === emp.stellar_address,
                    );
                    return (
                      <div
                        key={emp.employer_id}
                        className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5 flex items-center gap-4"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
                          <svg
                            className="h-5 w-5 text-yellow-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                          >
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-bold text-white truncate">
                            {emp.business_name}
                          </p>
                          <p className="text-[11px] text-neutral-600 truncate">
                            {emp.country_code}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            hasStream
                              ? "bg-green-500/10 text-green-400"
                              : "bg-yellow-400/10 text-yellow-400"
                          }`}
                        >
                          {hasStream ? "Active" : "Pending stream"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Join another employer */}
            <div className="mb-10">
              <h2 className="text-[18px] font-bold text-white mb-4">
                Join Another Employer
              </h2>
              <AwaitingInvite workerAddress={address} />
            </div>

            {/* Withdrawal history */}
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[18px] font-bold text-white">
                  Withdrawal History
                </h2>
                <Link
                  to="/transactions"
                  className="flex items-center gap-1 text-[13px] font-semibold text-yellow-400/70 hover:text-yellow-400 transition-colors"
                >
                  View all
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0a0a]">
                {withdrawalHistory.length === 0 ? (
                  <div className="p-12 text-center text-[14px] text-neutral-600">
                    No withdrawals yet
                  </div>
                ) : (
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {["Date", "Amount", "Token", "Transaction"].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawalHistory.map((rec, i) => (
                        <tr
                          key={i}
                          className="border-b border-white/[0.04] last:border-0"
                        >
                          <td className="px-5 py-3 text-neutral-500">
                            {rec.date}
                          </td>
                          <td className="px-5 py-3 font-bold text-white">
                            {rec.amount}
                          </td>
                          <td className="px-5 py-3 text-neutral-500">
                            {rec.tokenSymbol}
                          </td>
                          <td className="px-5 py-3">
                            <a
                              href={`https://stellar.expert/explorer/testnet/tx/${rec.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[11px] no-underline hover:underline"
                              style={{ color: "#facc15" }}
                            >
                              {rec.txHash.slice(0, 8)}…{rec.txHash.slice(-6)}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default WorkerDashboard;
