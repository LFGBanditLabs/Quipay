import { useState, useEffect, useMemo } from "react";
import { useWallet } from "../hooks/useWallet";
import { useStreams, WorkerStream } from "../hooks/useStreams";
import {
  getWithdrawable,
  buildWithdrawTx,
  submitAndAwaitTx,
} from "../contracts/payroll_stream";
import { formatTokenAmount } from "../util/tokenDecimals";
import { useNotification } from "../hooks/useNotification";
import {
  useSharedClockMs,
  useElapsedTime,
} from "../context/SharedClockContext";
import { SeoHelmet } from "../components/seo/SeoHelmet";
import { recordWithdrawalEvent } from "../util/recordWithdrawal";

const STROOPS = 1e7;

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtCountdown(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// ─── Withdrawal History ───────────────────────────────────────────────────────

function WithdrawalHistorySection({
  history,
}: {
  history: import("../hooks/useStreams").WithdrawalRecord[];
}) {
  if (history.length === 0) return null;
  const sorted = [...history].reverse();
  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-[16px] font-bold text-white">Withdrawal History</h2>
        <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[11px] font-bold text-neutral-400">
          {history.length}
        </span>
      </div>
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-600">
                Date
              </th>
              <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-600">
                Amount
              </th>
              <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-600 hidden sm:table-cell">
                Stream
              </th>
              <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-600">
                Tx
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((rec) => (
              <tr
                key={rec.id}
                className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-5 py-3.5 text-[13px] text-neutral-400">
                  {rec.date}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="text-[13px] font-bold text-white">
                    {parseFloat(rec.amount).toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </span>
                  <span className="ml-1.5 text-[11px] text-neutral-500">
                    {rec.tokenSymbol}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-[12px] text-neutral-600 hidden sm:table-cell">
                  #{rec.streamId}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${rec.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-yellow-400/60 hover:text-yellow-400 transition-colors"
                  >
                    {rec.txHash.slice(0, 8)}…
                    <svg
                      className="h-3 w-3 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Stream Card ──────────────────────────────────────────────────────────────

function StreamCard({
  stream,
  workerAddress,
  onSuccess,
}: {
  stream: WorkerStream;
  workerAddress: string;
  onSuccess: (amount: number) => void;
}) {
  const { signTransaction } = useWallet();
  const { addNotification } = useNotification();
  const nowMs = useSharedClockMs();
  const nowSec = Math.floor(nowMs / 1000);

  // cliff_ts = 0 means no cliff — fall back to startTime to avoid measuring from Unix epoch
  const effectiveCliff =
    stream.cliffTime > 0 ? stream.cliffTime : stream.startTime;
  const isBeforeCliff = effectiveCliff > nowSec;
  const cliffSecsLeft = Math.max(0, effectiveCliff - nowSec);
  const isPaused = stream.status === 3;

  // Client-side live available estimate (ticks every second via shared clock)
  const elapsedAfterCliff = useElapsedTime(effectiveCliff);
  const clientAvailable = useMemo(() => {
    if (isBeforeCliff || isPaused) return 0;
    const earned = Math.min(
      elapsedAfterCliff * stream.flowRate,
      stream.totalAmount,
    );
    return Math.max(0, earned - stream.claimedAmount);
  }, [
    isBeforeCliff,
    isPaused,
    elapsedAfterCliff,
    stream.flowRate,
    stream.totalAmount,
    stream.claimedAmount,
  ]);

  // On-chain confirmed withdrawable (fetched once, accurate)
  const [onChainAmt, setOnChainAmt] = useState<number | null>(null);
  const [loadingAmt, setLoadingAmt] = useState(true);
  const [onChainFetchTick, setOnChainFetchTick] = useState(0);

  useEffect(() => {
    void (async () => {
      setLoadingAmt(true);
      try {
        const raw = await getWithdrawable(BigInt(stream.id));
        setOnChainAmt(raw !== null ? Number(raw) / STROOPS : 0);
      } catch {
        setOnChainAmt(0);
      } finally {
        setLoadingAmt(false);
      }
    })();
  }, [stream.id, onChainFetchTick]);

  // Use client estimate for display; on-chain for the TX check
  const displayAmt = clientAvailable;
  const canWithdraw =
    !loadingAmt && !isBeforeCliff && !isPaused && (onChainAmt ?? 0) > 0;

  // Withdrawal state
  const [submitting, setSubmitting] = useState(false);
  const [txStep, setTxStep] = useState<"building" | "signing" | "sending" | "">(
    "",
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleWithdraw = async () => {
    if (!signTransaction || !canWithdraw) return;
    setSubmitting(true);
    setError(null);
    try {
      setTxStep("building");
      const { preparedXdr } = await buildWithdrawTx(
        BigInt(stream.id),
        workerAddress,
      );
      setTxStep("signing");
      const { signedTxXdr } = await signTransaction(preparedXdr, {
        networkPassphrase: import.meta.env
          .PUBLIC_STELLAR_NETWORK_PASSPHRASE as string,
      });
      setTxStep("sending");
      const txHash = await submitAndAwaitTx(signedTxXdr);
      const withdrawn = onChainAmt ?? displayAmt;
      void recordWithdrawalEvent({
        workerAddress,
        employerAddress: stream.employerAddress,
        streamId: stream.id,
        amount: withdrawn,
        tokenSymbol: stream.tokenSymbol,
        txHash,
      });
      addNotification(
        `Withdrew ${formatTokenAmount(withdrawn, stream.tokenSymbol)} ${stream.tokenSymbol}`,
        "success",
      );
      setDone(true);
      onSuccess(withdrawn);
      setOnChainFetchTick((t) => t + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Withdrawal failed";
      setError(
        msg.includes("rejected") || msg.includes("declined")
          ? "Transaction rejected."
          : msg,
      );
    } finally {
      setSubmitting(false);
      setTxStep("");
    }
  };

  // Time-based progress bar
  const totalSec = stream.endTime - stream.startTime;
  const elapsed = Math.max(0, Math.min(nowSec - stream.startTime, totalSec));
  const timePct = totalSec > 0 ? (elapsed / totalSec) * 100 : 0;
  const daysLeft = Math.max(0, Math.ceil((stream.endTime - nowSec) / 86400));

  return (
    <div
      className={`rounded-2xl border bg-[#0a0a0a] overflow-hidden flex flex-col transition-all ${
        done ? "border-green-500/20 opacity-60" : "border-white/[0.07]"
      }`}
    >
      {/* Time progress bar */}
      <div className="h-[3px] w-full bg-white/[0.05]">
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{
            width: `${Math.min(100, timePct)}%`,
            backgroundColor: done ? "#22c55e" : "#facc15",
          }}
        />
      </div>

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-white truncate">
              {stream.employerName !== stream.employerAddress
                ? stream.employerName
                : shortAddr(stream.employerAddress)}
            </p>
            <p className="font-mono text-[11px] text-neutral-600 mt-0.5">
              Stream #{stream.id} · {stream.tokenSymbol}
              {daysLeft > 0 && ` · ${daysLeft}d left`}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              done
                ? "bg-green-500/10 text-green-400"
                : isPaused
                  ? "bg-neutral-500/10 text-neutral-400"
                  : isBeforeCliff
                    ? "bg-yellow-400/10 text-yellow-400"
                    : "bg-green-500/10 text-green-400"
            }`}
          >
            {done
              ? "Withdrawn"
              : isPaused
                ? "Paused"
                : isBeforeCliff
                  ? "Locked"
                  : "● Live"}
          </span>
        </div>

        {/* Cliff countdown */}
        {isBeforeCliff && !done && (
          <div className="rounded-xl border border-yellow-400/15 bg-yellow-400/[0.04] px-4 py-3 flex items-center gap-3">
            <svg
              className="h-4 w-4 text-yellow-400 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div>
              <p className="text-[12px] font-semibold text-yellow-400">
                Locked for {fmtCountdown(cliffSecsLeft)}
              </p>
              <p className="text-[11px] text-neutral-600">
                Earnings accumulate but cannot be withdrawn yet.
              </p>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 mb-1">
              Total
            </p>
            <p className="text-[14px] font-black text-white leading-none">
              {formatTokenAmount(stream.totalAmount, stream.tokenSymbol)}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 mb-1">
              Claimed
            </p>
            <p className="text-[14px] font-black text-white leading-none">
              {formatTokenAmount(stream.claimedAmount, stream.tokenSymbol)}
            </p>
          </div>
          <div
            className="rounded-xl border p-3 text-center"
            style={{
              backgroundColor: canWithdraw
                ? "rgba(250,204,21,0.06)"
                : "rgba(255,255,255,0.02)",
              borderColor: canWithdraw
                ? "rgba(250,204,21,0.2)"
                : "rgba(255,255,255,0.05)",
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 mb-1">
              Available
            </p>
            {loadingAmt ? (
              <div className="mx-auto mt-1 h-3.5 w-10 animate-pulse rounded bg-white/[0.06]" />
            ) : (
              <p
                className="text-[14px] font-black leading-none"
                style={{ color: canWithdraw ? "#facc15" : "#525252" }}
              >
                {formatTokenAmount(displayAmt, stream.tokenSymbol)}
              </p>
            )}
          </div>
        </div>

        {/* Flow rate */}
        {!isBeforeCliff && !isPaused && (
          <div className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-2">
            <span className="text-[11px] text-neutral-600">Streaming at</span>
            <span className="font-mono text-[12px] font-semibold text-white">
              +{formatTokenAmount(stream.flowRate, stream.tokenSymbol, 7)}{" "}
              {stream.tokenSymbol}/s
            </span>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-[12px] text-red-400 break-all">{error}</p>}

        {/* Withdraw button */}
        {!done && (
          <button
            onClick={() => void handleWithdraw()}
            disabled={!canWithdraw || submitting}
            className="mt-auto w-full rounded-xl py-3 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#facc15" }}
          >
            {submitting ? (
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
                {txStep === "building" && "Preparing…"}
                {txStep === "signing" && "Sign in Freighter…"}
                {txStep === "sending" && "Broadcasting…"}
              </span>
            ) : isBeforeCliff ? (
              `Unlocks in ${fmtCountdown(cliffSecsLeft)}`
            ) : isPaused ? (
              "Stream is paused"
            ) : canWithdraw ? (
              `Withdraw ${formatTokenAmount(onChainAmt ?? displayAmt, stream.tokenSymbol)} ${stream.tokenSymbol}`
            ) : (
              "Nothing to withdraw yet"
            )}
          </button>
        )}

        {done && (
          <div className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-green-500/20 bg-green-500/[0.05] py-3">
            <svg
              className="h-4 w-4 text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-[13px] font-semibold text-green-400">
              Withdrawn successfully
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WithdrawPage() {
  const { address, signTransaction } = useWallet();
  const { streams, isLoading, error, refetch, withdrawalHistory } =
    useStreams(address);
  const { addNotification } = useNotification();
  const [totalWithdrawnThisSession, setTotalWithdrawnThisSession] = useState(0);
  const [withdrawingAll, setWithdrawingAll] = useState(false);
  const [withdrawAllProgress, setWithdrawAllProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const nowMs = useSharedClockMs();
  const nowSec = Math.floor(nowMs / 1000);

  const activeStreams = streams.filter((s) => s.status === 0 || s.status === 3);
  const readyStreams = activeStreams.filter(
    (s) => s.cliffTime <= nowSec && s.status !== 3,
  );

  // Client-side total available (approx — real amounts fetched per card)
  const totalClientAvailable = readyStreams.reduce((sum, s) => {
    const elapsed = Math.max(0, nowSec - s.cliffTime);
    const earned = Math.min(elapsed * s.flowRate, s.totalAmount);
    return sum + Math.max(0, earned - s.claimedAmount);
  }, 0);

  const totalFlowRate = readyStreams.reduce((sum, s) => sum + s.flowRate, 0);

  // Withdraw All — sequential (each TX needs different sequence number)
  const handleWithdrawAll = async () => {
    if (!signTransaction || readyStreams.length === 0) return;
    setWithdrawingAll(true);
    setWithdrawAllProgress({ done: 0, total: readyStreams.length });
    let withdrawn = 0;
    for (let i = 0; i < readyStreams.length; i++) {
      const s = readyStreams[i];
      try {
        const { preparedXdr } = await buildWithdrawTx(BigInt(s.id), address!);
        const { signedTxXdr } = await signTransaction(preparedXdr, {
          networkPassphrase: import.meta.env
            .PUBLIC_STELLAR_NETWORK_PASSPHRASE as string,
        });
        await submitAndAwaitTx(signedTxXdr);
        withdrawn++;
      } catch {
        // Skip failed streams, continue with rest
      }
      setWithdrawAllProgress({ done: i + 1, total: readyStreams.length });
    }
    setWithdrawingAll(false);
    setWithdrawAllProgress(null);
    addNotification(
      `Withdrew from ${withdrawn} stream${withdrawn !== 1 ? "s" : ""}`,
      "success",
    );
    refetch();
  };

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
          Connect to see streams you can withdraw from.
        </p>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 h-8 w-44 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="mb-6 h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
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
        <p className="font-mono text-[12px] text-neutral-600 mb-5">{error}</p>
        <button
          onClick={refetch}
          className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-black"
          style={{ backgroundColor: "#facc15" }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── No streams ────────────────────────────────────────────────────────────
  if (activeStreams.length === 0) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Withdraw Earnings
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Claim your available stream earnings.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04]">
            <svg
              className="h-7 w-7 text-neutral-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-[15px] font-bold text-white mb-1">
            No active streams
          </p>
          <p className="text-[13px] text-neutral-600">
            Your streams will appear here once your employer sets them up.
          </p>
        </div>
        <WithdrawalHistorySection history={withdrawalHistory} />
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <>
      <SeoHelmet
        title="Withdraw Earnings · Quipay"
        description="Claim your available payroll stream earnings."
        path="/withdraw"
        robots="noindex,nofollow"
      />

      {/* Withdraw All overlay */}
      {withdrawingAll && withdrawAllProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#111] p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400/10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" />
            </div>
            <p className="text-[16px] font-bold text-white mb-1">
              Withdrawing from stream {withdrawAllProgress.done + 1} of{" "}
              {withdrawAllProgress.total}
            </p>
            <p className="text-[13px] text-neutral-600 mb-4">
              Sign each transaction in Freighter
            </p>
            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(withdrawAllProgress.done / withdrawAllProgress.total) * 100}%`,
                  backgroundColor: "#facc15",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold text-white tracking-tight">
              Withdraw Earnings
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              {activeStreams.length} active stream
              {activeStreams.length !== 1 ? "s" : ""}
              {readyStreams.length < activeStreams.length &&
                ` · ${activeStreams.length - readyStreams.length} locked`}
            </p>
          </div>
          {readyStreams.length > 1 && (
            <button
              onClick={() => void handleWithdrawAll()}
              disabled={withdrawingAll}
              className="shrink-0 rounded-xl px-5 py-2.5 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
              style={{ backgroundColor: "#facc15" }}
            >
              Withdraw All
            </button>
          )}
        </div>

        {/* Summary bar */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
              Total Available
            </p>
            <p
              className="text-[26px] font-black"
              style={{
                color: totalClientAvailable > 0 ? "#facc15" : "#525252",
              }}
            >
              {totalClientAvailable.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}
            </p>
            <p className="text-[11px] text-neutral-600 mt-0.5">
              across all streams
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
              Flow Rate
            </p>
            <p className="text-[26px] font-black text-white">
              {totalFlowRate > 0
                ? formatTokenAmount(totalFlowRate * 3600, "USDC", 4)
                : "—"}
            </p>
            <p className="text-[11px] text-neutral-600 mt-0.5">per hour</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
              This Session
            </p>
            <p className="text-[26px] font-black text-white">
              {totalWithdrawnThisSession > 0
                ? totalWithdrawnThisSession.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })
                : "—"}
            </p>
            <p className="text-[11px] text-neutral-600 mt-0.5">
              withdrawn today
            </p>
          </div>
        </div>

        {/* Stream cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeStreams.map((s) => (
            <StreamCard
              key={s.id}
              stream={s}
              workerAddress={address}
              onSuccess={(amt) => {
                setTotalWithdrawnThisSession((t) => t + amt);
                refetch();
              }}
            />
          ))}
        </div>

        <WithdrawalHistorySection history={withdrawalHistory} />
      </div>
    </>
  );
}
