import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../hooks/useWallet";
import { useStreams, WorkerStream } from "../hooks/useStreams";
import {
  getWithdrawable,
  buildWithdrawTx,
  submitAndAwaitTx,
} from "../contracts/payroll_stream";
import { formatTokenAmount } from "../util/tokenDecimals";
import { useNotification } from "../hooks/useNotification";

const STROOPS = 1e7;

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// ─── Stream withdraw card ─────────────────────────────────────────────────────

function StreamCard({
  stream,
  workerAddress,
  onSuccess,
}: {
  stream: WorkerStream;
  workerAddress: string;
  onSuccess: () => void;
}) {
  const { signTransaction } = useWallet();
  const { addNotification } = useNotification();
  const [withdrawable, setWithdrawable] = useState<number | null>(null);
  const [loadingAmt, setLoadingAmt] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"building" | "signing" | "sending" | "">("");
  const [error, setError] = useState<string | null>(null);

  const fetchWithdrawable = useCallback(async () => {
    setLoadingAmt(true);
    try {
      const raw = await getWithdrawable(BigInt(stream.id));
      setWithdrawable(raw !== null ? Number(raw) / STROOPS : 0);
    } catch {
      setWithdrawable(0);
    } finally {
      setLoadingAmt(false);
    }
  }, [stream.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchWithdrawable();
  }, [fetchWithdrawable]);

  const handleWithdraw = async () => {
    if (!signTransaction || !withdrawable || withdrawable <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      setStep("building");
      const { preparedXdr } = await buildWithdrawTx(
        BigInt(stream.id),
        workerAddress,
      );

      setStep("signing");
      const { signedTxXdr } = await signTransaction(preparedXdr, {
        networkPassphrase: import.meta.env
          .PUBLIC_STELLAR_NETWORK_PASSPHRASE as string,
      });

      setStep("sending");
      await submitAndAwaitTx(signedTxXdr);

      addNotification(
        `Withdrawn ${formatTokenAmount(withdrawable, stream.tokenSymbol)} ${stream.tokenSymbol}`,
        "success",
      );
      onSuccess();
      void fetchWithdrawable();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setSubmitting(false);
      setStep("");
    }
  };

  const pct =
    stream.totalAmount > 0
      ? Math.min(100, (stream.claimedAmount / stream.totalAmount) * 100)
      : 0;

  const canWithdraw = !loadingAmt && (withdrawable ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
      {/* Progress stripe */}
      <div className="h-[3px] w-full bg-white/[0.05]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: "#facc15" }}
        />
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-bold text-white">
              {stream.employerName || shortAddr(stream.employerAddress)}
            </p>
            <p className="font-mono text-[11px] text-neutral-600 mt-0.5">
              Stream #{stream.id} · {stream.tokenSymbol}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-green-500/10 px-2.5 py-0.5 text-[11px] font-bold text-green-400">
            Active
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 mb-1">
              Total
            </p>
            <p className="text-[15px] font-black text-white">
              {formatTokenAmount(stream.totalAmount, stream.tokenSymbol)}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 mb-1">
              Claimed
            </p>
            <p className="text-[15px] font-black text-white">
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
              <div className="mx-auto mt-1 h-4 w-12 animate-pulse rounded bg-white/[0.06]" />
            ) : (
              <p
                className="text-[15px] font-black"
                style={{ color: canWithdraw ? "#facc15" : "#525252" }}
              >
                {formatTokenAmount(withdrawable ?? 0, stream.tokenSymbol)}
              </p>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[12px] text-red-400 break-all">
            {error}
          </div>
        )}

        {/* Withdraw button */}
        <button
          onClick={() => void handleWithdraw()}
          disabled={!canWithdraw || submitting}
          className="w-full rounded-xl py-3 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
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
              {step === "building" && "Preparing…"}
              {step === "signing" && "Sign in Freighter…"}
              {step === "sending" && "Broadcasting…"}
            </span>
          ) : canWithdraw ? (
            `Withdraw ${formatTokenAmount(withdrawable ?? 0, stream.tokenSymbol)} ${stream.tokenSymbol}`
          ) : (
            "Nothing to withdraw"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WithdrawPage() {
  const { address } = useWallet();
  const { streams, isLoading, error, refetch } = useStreams(address);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeStreams = streams.filter((s) => s.status === 0 || s.status === 3); // active or paused

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

  if (isLoading) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 h-8 w-44 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    );
  }

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
          <p className="text-[15px] font-bold text-white mb-1">
            No active streams
          </p>
          <p className="text-[13px] text-neutral-600">
            Your streams will appear here once your employer sets them up.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Withdraw Earnings
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            {activeStreams.length} active stream
            {activeStreams.length > 1 ? "s" : ""} — withdraw any available
            balance to your wallet.
          </p>
        </div>
      </div>

      <div
        key={refreshKey}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {activeStreams.map((s) => (
          <StreamCard
            key={s.id}
            stream={s}
            workerAddress={address}
            onSuccess={() => {
              refetch();
              setRefreshKey((k) => k + 1);
            }}
          />
        ))}
      </div>
    </div>
  );
}
