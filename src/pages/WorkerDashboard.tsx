import React, { useState, useEffect, useRef, useMemo } from "react";
import { useWallet } from "../hooks/useWallet";
import { useStreamSubscription } from "../hooks/useStreamSubscription";
import {
  useStreams,
  WorkerStream,
  WithdrawalRecord,
} from "../hooks/useStreams";
import { useNotification } from "../hooks/useNotification";
import { buildRegisterWorkerTx } from "../contracts/workforce_registry";
import { submitAndAwaitTx } from "../contracts/payroll_stream";
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

// ─── Join employer card ───────────────────────────────────────────────────────

const JoinEmployer: React.FC<{ workerAddress: string }> = ({
  workerAddress,
}) => {
  const { signTransaction } = useWallet();
  const { addNotification } = useNotification();
  const [employerAddr, setEmployerAddr] = useState("");
  const [registering, setRegistering] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = employerAddr.startsWith("G") && employerAddr.length >= 56;

  const handleRegister = async () => {
    if (!signTransaction || !isValid) return;
    setRegistering(true);
    setError(null);
    try {
      const { preparedXdr } = await buildRegisterWorkerTx(
        workerAddress,
        employerAddr,
      );
      const { signedTxXdr } = await signTransaction(preparedXdr, {
        networkPassphrase: import.meta.env
          .PUBLIC_STELLAR_NETWORK_PASSPHRASE as string,
      });
      await submitAndAwaitTx(signedTxXdr);
      setDone(true);
      addNotification("You're now in your employer's roster!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.05] p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
          <svg
            className="h-7 w-7 text-green-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-[18px] font-bold text-white mb-1">
          You're registered!
        </h3>
        <p className="text-[14px] text-neutral-500 mb-5">
          Your employer can now see you and create a payment stream. You'll see
          your earnings appear here once it's set up.
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
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
      {/* Top accent */}
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
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-1.5-3.1M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        <h3 className="text-[20px] font-bold text-white mb-2">
          Join your employer
        </h3>
        <p className="text-[14px] text-neutral-500 mb-8 max-w-sm mx-auto">
          Enter your employer's Stellar address. One signature and you're on
          their roster — they'll set up your stream right after.
        </p>

        <div className="max-w-md mx-auto flex flex-col gap-3">
          <input
            value={employerAddr}
            onChange={(e) => {
              setEmployerAddr(e.target.value.trim());
              setError(null);
            }}
            placeholder="Employer's Stellar address (G…)"
            className={`w-full rounded-xl border bg-black px-4 py-3.5 font-mono text-[13px] text-white placeholder:text-neutral-700 focus:outline-none focus:ring-1 transition-colors ${
              employerAddr && !isValid
                ? "border-red-500/40 focus:ring-red-500/20"
                : "border-white/[0.1] focus:border-yellow-400/40 focus:ring-yellow-400/20"
            }`}
          />
          {error && (
            <p className="text-[12px] text-red-400 text-left">{error}</p>
          )}
          <button
            onClick={() => void handleRegister()}
            disabled={!isValid || registering}
            className="w-full rounded-xl py-3.5 text-[15px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#facc15" }}
          >
            {registering ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
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
                Joining…
              </span>
            ) : (
              "Join Employer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Stream card ──────────────────────────────────────────────────────────────

const StreamCard: React.FC<{
  stream: WorkerStream;
  withdrawals: WithdrawalRecord[];
}> = ({ stream, withdrawals }) => {
  const { addNotification, addStreamNotification } = useNotification();
  const [showTimeline, setShowTimeline] = useState(false);
  const [lastEventAmount, setLastEventAmount] = useState<number | null>(null);
  const previousAvailableRef = useRef<number | null>(null);
  const nowMs = useSharedClockMs();

  useStreamSubscription((update) => {
    if (update.streamId === String(stream.id))
      setLastEventAmount(update.amount);
  });

  const nowSeconds = Math.floor(nowMs / 1000);
  const timeToCliff = stream.cliffTime - nowSeconds;
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

  const elapsedAfterCliff = useElapsedTime(stream.cliffTime);
  const currentEarnings = isBeforeCliff
    ? 0
    : Math.min(elapsedAfterCliff * stream.flowRate, stream.totalAmount);

  useEffect(() => {
    if (isBeforeCliff) {
      previousAvailableRef.current = 0;
      return;
    }
    const nextAvailable = Math.max(0, currentEarnings - stream.claimedAmount);
    if (
      previousAvailableRef.current !== null &&
      previousAvailableRef.current <= 0 &&
      nextAvailable > 0
    ) {
      addStreamNotification("withdrawal_available", {
        message: `Funds available for stream ${stream.id}.`,
        dedupeKey: `withdrawal-available-${stream.id}`,
      });
    }
    previousAvailableRef.current = nextAvailable;
  }, [
    addStreamNotification,
    currentEarnings,
    isBeforeCliff,
    stream.claimedAmount,
    stream.id,
  ]);

  const pct =
    stream.totalAmount > 0 ? (currentEarnings / stream.totalAmount) * 100 : 0;
  const available = Math.max(0, currentEarnings - stream.claimedAmount);
  const remaining = Math.max(0, stream.totalAmount - currentEarnings);

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
              {formatTokenAmount(currentEarnings, stream.tokenSymbol)}
            </span>
            <span
              className="text-[14px] font-bold"
              style={{ color: "#facc15" }}
            >
              {stream.tokenSymbol}
            </span>
          </div>
          <p className="text-[12px] text-neutral-700 mt-1">
            of {stream.totalAmount} {stream.tokenSymbol} total ·{" "}
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
              available > 0 ? "rgba(250,204,21,0.2)" : "rgba(255,255,255,0.05)",
            backgroundColor:
              available > 0
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
              style={{ color: available > 0 ? "#facc15" : "#525252" }}
            >
              {formatTokenAmount(available, stream.tokenSymbol)}{" "}
              {stream.tokenSymbol}
            </span>
          </div>
          {remaining > 0 && (
            <p className="text-[11px] text-neutral-700 mt-0.5">
              {formatTokenAmount(remaining, stream.tokenSymbol)} remaining
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
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
          >
            {showTimeline ? "Hide" : "History"}
          </button>
          <button
            onClick={() => addNotification("Withdrawal triggered!", "success")}
            disabled={available <= 0}
            className="flex-1 rounded-xl py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#facc15" }}
          >
            Withdraw
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

const WorkerDashboard: React.FC = () => {
  const { address } = useWallet();
  const { streams, withdrawalHistory, isLoading, error, refetch } =
    useStreams(address);
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
  const totalWithdrawn = withdrawalHistory.reduce(
    (s, w) => s + (parseFloat(w.amount) || 0),
    0,
  );

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

        {/* No streams — show join employer */}
        {streams.length === 0 ? (
          <JoinEmployer workerAddress={address} />
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
                      withdrawals={withdrawalHistory.filter(
                        (w) => w.streamId === s.id,
                      )}
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

            {/* Withdrawal history */}
            <div>
              <h2 className="text-[18px] font-bold text-white mb-4">
                Withdrawal History
              </h2>
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
