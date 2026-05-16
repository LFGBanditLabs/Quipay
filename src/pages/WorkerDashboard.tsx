import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWallet } from "../hooks/useWallet";
import { useStreamSubscription } from "../hooks/useStreamSubscription";
import {
  useStreams,
  WorkerStream,
  WithdrawalRecord,
} from "../hooks/useStreams";
import { useNotification } from "../hooks/useNotification";
import { EarningsDisplay } from "../components/EarningsDisplay";
import { EarningsForecast } from "../components/EarningsForecast";
import CopyButton from "../components/CopyButton";
import { formatTokenAmount } from "../util/tokenDecimals";
import { StreamTimeline } from "../components/StreamTimeline";
import { StreamCardSkeleton } from "../components/dashboard/StreamCardSkeleton";
import { EarningsSkeleton } from "../components/dashboard/EarningsSkeleton";
import { Skeleton } from "../components/Loading/Skeleton";
import { TableVirtuoso } from "react-virtuoso";
import { shortHash } from "../services/reportService";
import PayslipDownloadButton from "../components/PayslipDownloadButton";
import {
  useElapsedTime,
  useSharedClockMs,
} from "../context/SharedClockContext";
import { SeoHelmet } from "../components/seo/SeoHelmet";

// ─── Stream card ──────────────────────────────────────────────────────────────

const StreamCard: React.FC<{
  stream: WorkerStream;
  withdrawals: WithdrawalRecord[];
}> = ({ stream, withdrawals }) => {
  const { addNotification, addStreamNotification } = useNotification();
  const { t } = useTranslation();
  const [showTimeline, setShowTimeline] = useState(false);
  const [lastEventAmount, setLastEventAmount] = useState<number | null>(null);
  const nowMs = useSharedClockMs();
  const previousAvailableRef = useRef<number | null>(null);

  useStreamSubscription((update) => {
    if (update.streamId === String(stream.id))
      setLastEventAmount(update.amount);
  });

  const nowSeconds = Math.floor(nowMs / 1000);
  const timeToCliff = stream.cliffTime - nowSeconds;
  const isBeforeCliff = timeToCliff > 0;

  const timeUntilCliff = useMemo(() => {
    if (!isBeforeCliff) return "Unlocked";
    const days = Math.floor(timeToCliff / 86400);
    const hours = Math.floor((timeToCliff % 86400) / 3600);
    const mins = Math.floor((timeToCliff % 3600) / 60);
    const secs = Math.floor(timeToCliff % 60);
    return `${days}d ${hours}h ${mins}m ${secs}s`;
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
        message: `Funds are now available for stream ${stream.id}.`,
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
  const remaining = Math.max(0, stream.totalAmount - currentEarnings);
  const available = Math.max(0, currentEarnings - stream.claimedAmount);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-white">
            {stream.employerName}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="font-mono text-[11px] text-neutral-600 truncate max-w-[180px]">
              {stream.employerAddress}
            </span>
            <CopyButton
              value={stream.employerAddress}
              label="Copy employer address"
            />
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-green-500/10 px-3 py-1 text-[12px] font-semibold text-green-400">
          {formatTokenAmount(stream.flowRate, stream.tokenSymbol, 5)}{" "}
          {stream.tokenSymbol}/s
        </span>
      </div>

      {/* Cliff status */}
      {isBeforeCliff ? (
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/[0.06] p-3">
          <div className="flex items-center gap-2 mb-1">
            <span>🔒</span>
            <span className="text-[13px] font-semibold text-yellow-400">
              Locked — cliff not reached
            </span>
          </div>
          <p className="text-[12px] text-yellow-400/70">
            Time remaining:{" "}
            <span className="font-mono font-bold">{timeUntilCliff}</span>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-green-500/20 bg-green-500/[0.06] p-3">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span className="text-[13px] font-semibold text-green-400">
              Cliff unlocked — earnings active
            </span>
          </div>
        </div>
      )}

      {/* Earnings */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
          {t("worker.current_earnings")}
        </p>
        <p className="text-[28px] font-black text-white tabular-nums font-mono">
          {formatTokenAmount(currentEarnings, stream.tokenSymbol)}{" "}
          <span
            className="text-[16px] font-semibold"
            style={{ color: "#facc15" }}
          >
            {stream.tokenSymbol}
          </span>
        </p>
        <p className="text-[13px] text-neutral-600 mt-0.5">
          of {stream.totalAmount} {stream.tokenSymbol} total
        </p>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-[4px] w-full rounded-full bg-white/[0.07] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${Math.min(100, pct)}%`,
              backgroundColor: "#facc15",
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[11px] text-neutral-600">
            Streamed: {currentEarnings.toFixed(4)} {stream.tokenSymbol}
          </span>
          <span className="text-[11px] text-neutral-600">
            Remaining: {remaining.toFixed(4)} {stream.tokenSymbol}
          </span>
        </div>
      </div>

      {/* Available */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
        <span className="text-[14px] text-neutral-400">
          {t("worker.available")}
        </span>
        <span className="font-mono text-[15px] font-bold text-white">
          {formatTokenAmount(available, stream.tokenSymbol)}{" "}
          {stream.tokenSymbol}
        </span>
      </div>

      {/* Last event */}
      {lastEventAmount !== null && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2 text-[12px] text-blue-400">
          ⚡ Last withdrawal: {lastEventAmount.toFixed(7)} {stream.tokenSymbol}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
        >
          {showTimeline ? "Hide Timeline" : "Show Timeline"}
        </button>
        <button
          onClick={() => addNotification("Withdrawal triggered!", "success")}
          className="w-full rounded-xl py-2.5 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ backgroundColor: "#facc15" }}
        >
          {t("worker.withdraw_funds")}
        </button>
      </div>

      {showTimeline && (
        <StreamTimeline stream={stream} withdrawals={withdrawals} />
      )}
    </div>
  );
};

// ─── Completed stream card ────────────────────────────────────────────────────

const CompletedStreamCard: React.FC<{
  stream: WorkerStream;
  withdrawals: WithdrawalRecord[];
}> = ({ stream, withdrawals }) => {
  const { t } = useTranslation();
  const { address } = useWallet();
  const [showTimeline, setShowTimeline] = useState(false);

  const getPeriod = () => {
    const d = new Date(stream.endTime * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[16px] font-bold text-white">
            {stream.employerName}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="font-mono text-[11px] text-neutral-600">
              {stream.employerAddress}
            </span>
            <CopyButton
              value={stream.employerAddress}
              label="Copy employer address"
            />
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-neutral-800 px-3 py-1 text-[12px] font-semibold text-neutral-400">
          {t("worker.status_completed")}
        </span>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
          {t("worker.total_paid")}
        </p>
        <p className="text-[24px] font-black text-white font-mono">
          {formatTokenAmount(stream.totalAmount, stream.tokenSymbol)}{" "}
          <span className="text-[14px]" style={{ color: "#facc15" }}>
            {stream.tokenSymbol}
          </span>
        </p>
      </div>

      <div className="h-[3px] w-full rounded-full bg-neutral-800 overflow-hidden">
        <div className="h-full w-full rounded-full bg-neutral-600" />
      </div>

      {stream.proofGatewayUrl ? (
        <a
          href={stream.proofGatewayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-[14px] font-semibold text-white no-underline hover:bg-white/[0.08]"
        >
          <svg
            className="h-4 w-4"
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
          {t("worker.download_proof")}
        </a>
      ) : (
        <div className="flex w-full items-center justify-center rounded-xl border border-white/[0.06] py-2.5 text-[13px] text-neutral-600">
          {t("worker.proof_generating")}
        </div>
      )}

      {stream.proofCid && (
        <p className="text-center font-mono text-[10px] text-neutral-700 truncate">
          {t("worker.proof_cid_label")}: {stream.proofCid}
        </p>
      )}

      {address && (
        <PayslipDownloadButton
          workerAddress={address}
          period={getPeriod()}
          className="w-full"
        />
      )}

      <button
        onClick={() => setShowTimeline(!showTimeline)}
        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 text-[14px] font-semibold text-white hover:bg-white/[0.06] transition-colors"
      >
        {showTimeline ? "Hide Timeline" : "Show Timeline"}
      </button>

      {showTimeline && (
        <StreamTimeline stream={stream} withdrawals={withdrawals} />
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const WorkerDashboard: React.FC = () => {
  const { t } = useTranslation();
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
          message: `Stream ${stream.id} is now completed.`,
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

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <Skeleton
          variant="rect"
          width="260px"
          height="2.25rem"
          className="mb-8 rounded-xl"
        />
        <div className="mb-10">
          <EarningsSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <StreamCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ── No wallet ───────────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
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
            <line x1="12" y1="12" x2="12" y2="16" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
          </svg>
        </div>
        <h2 className="text-[20px] font-bold text-white mb-2">
          {t("worker.connect_prompt")}
        </h2>
        <p className="text-[14px] text-neutral-500">
          Connect your Stellar wallet to view your streams.
        </p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="text-[18px] font-bold text-white mb-2">
          {t("worker.load_error")}
        </p>
        <p className="font-mono text-[12px] text-neutral-600 mb-6">{error}</p>
        <button
          onClick={refetch}
          className="rounded-xl px-6 py-3 text-[14px] font-bold text-black"
          style={{ backgroundColor: "#facc15" }}
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  const activeStreams = streams.filter((s) => s.status !== 2);
  const completedStreams = streams.filter((s) => s.status === 2);

  return (
    <>
      <SeoHelmet
        title={t("worker.dashboard_title")}
        description="Your real-time earnings on Quipay"
        path="/worker"
        robots="noindex,nofollow"
      />

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            {t("worker.dashboard_title")}
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Your real-time earnings and stream history.
          </p>
        </div>

        {/* Earnings overview */}
        <section className="mb-10">
          <EarningsDisplay streams={streams} />
        </section>

        {/* Forecast */}
        <section className="mb-10">
          <EarningsForecast streams={streams} />
        </section>

        {/* Batch note */}
        <div className="mb-6 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-4 py-3 text-[13px] text-yellow-400/80">
          {t("worker.batch_atomic_note")}
        </div>

        {/* Active streams */}
        <div className="mb-10">
          <h2 className="text-[20px] font-bold text-white mb-5">
            {t("worker.active_streams_heading")}
          </h2>
          {activeStreams.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-12 text-center">
              <p className="text-[14px] text-neutral-600">
                {t("worker.no_active_streams")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
          )}
        </div>

        {/* Completed streams */}
        {completedStreams.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[20px] font-bold text-white mb-5">
              Completed Streams
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {completedStreams.map((s) => (
                <CompletedStreamCard
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

        {/* Withdrawal history */}
        <div>
          <h2 className="text-[20px] font-bold text-white mb-5">
            {t("worker.withdrawal_history_heading")}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0a0a]">
            {withdrawalHistory.length === 0 ? (
              <div className="p-12 text-center text-[14px] text-neutral-600">
                {t("worker.no_withdrawal_history")}
              </div>
            ) : (
              <TableVirtuoso
                style={{ height: "360px", background: "transparent" }}
                data={withdrawalHistory}
                fixedHeaderContent={() => (
                  <tr className="bg-[#0a0a0a] border-b border-white/[0.06]">
                    {[
                      t("worker.col_date"),
                      t("worker.col_amount"),
                      t("worker.col_token"),
                      t("worker.col_transaction"),
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-neutral-600"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                )}
                itemContent={(_i, rec) => (
                  <>
                    <td className="px-5 py-3 text-[13px] text-neutral-400 border-b border-white/[0.04]">
                      {rec.date}
                    </td>
                    <td className="px-5 py-3 text-[14px] font-bold text-white border-b border-white/[0.04]">
                      {rec.amount}
                    </td>
                    <td className="px-5 py-3 text-[13px] text-neutral-400 border-b border-white/[0.04]">
                      {rec.tokenSymbol}
                    </td>
                    <td className="px-5 py-3 border-b border-white/[0.04]">
                      <span className="flex items-center gap-1">
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${rec.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[12px] no-underline"
                          style={{ color: "#facc15" }}
                        >
                          {shortHash(rec.txHash)}
                        </a>
                        <CopyButton
                          value={rec.txHash}
                          label="Copy transaction hash"
                        />
                      </span>
                    </td>
                  </>
                )}
                components={{
                  Table: ({ ...props }) => (
                    <table
                      {...props}
                      className="w-full border-collapse"
                      style={{ borderSpacing: 0 }}
                    />
                  ),
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default WorkerDashboard;
