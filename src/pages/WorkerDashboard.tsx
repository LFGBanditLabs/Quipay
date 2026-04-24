import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Layout, Text } from "@stellar/design-system";
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
import PayslipDownloadButton from "../components/PayslipDownloadButton";

const StreamCard: React.FC<{
  stream: WorkerStream;
  withdrawals: WithdrawalRecord[];
}> = ({ stream, withdrawals }) => {
  const { addNotification, addStreamNotification } = useNotification();
  const { t } = useTranslation();
  const [currentEarnings, setCurrentEarnings] = useState(0);
  const [timeUntilCliff, setTimeUntilCliff] = useState<string>("");
  const [isBeforeCliff, setIsBeforeCliff] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [lastEventAmount, setLastEventAmount] = useState<number | null>(null);

  useStreamSubscription((update) => {
    // Make sure the withdrawal event matches this specific stream card
    if (update.streamId === String(stream.id)) {
      setLastEventAmount(update.amount);
    }
  });
  const previousAvailableRef = useRef<number | null>(null);

  useEffect(() => {
    const calculate = () => {
      const now = Date.now() / 1000;
      const timeToCliff = stream.cliffTime - now;

      // Check if we're before the cliff
      setIsBeforeCliff(timeToCliff > 0);

      // Update countdown timer
      if (timeToCliff > 0) {
        const days = Math.floor(timeToCliff / 86400);
        const hours = Math.floor((timeToCliff % 86400) / 3600);
        const minutes = Math.floor((timeToCliff % 3600) / 60);
        const seconds = Math.floor(timeToCliff % 60);
        setTimeUntilCliff(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeUntilCliff("Unlocked");
      }

      // Calculate earnings (only start accruing after cliff)
      if (timeToCliff > 0) {
        setCurrentEarnings(0);
        previousAvailableRef.current = 0;
        return;
      }

      const elapsedAfterCliff = now - stream.cliffTime;
      if (elapsedAfterCliff < 0) {
        setCurrentEarnings(0);
        previousAvailableRef.current = 0;
        return;
      }
      const earned = elapsedAfterCliff * stream.flowRate;
      const boundedEarnings = Math.min(earned, stream.totalAmount);
      const nextAvailable = Math.max(0, boundedEarnings - stream.claimedAmount);

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
      setCurrentEarnings(boundedEarnings);
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [addStreamNotification, stream]);

  const percentage =
    stream.totalAmount > 0 ? (currentEarnings / stream.totalAmount) * 100 : 0;
  const remaining = Math.max(0, stream.totalAmount - currentEarnings);
  const availableToWithdraw = Math.max(
    0,
    currentEarnings - stream.claimedAmount,
  );

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface-subtle)] p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-[var(--text)]">
            {stream.employerName}
          </div>
          <div className="flex items-center gap-1 font-mono text-xs text-[var(--muted)]">
            <span>{stream.employerAddress}</span>
            <CopyButton
              value={stream.employerAddress}
              label="Copy employer address"
            />
          </div>
        </div>
        <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-sm text-emerald-500">
          {formatTokenAmount(stream.flowRate, stream.tokenSymbol, 5)}{" "}
          {stream.tokenSymbol}/sec
        </div>
      </div>

      {/* Cliff Status Indicator */}
      {isBeforeCliff ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <span className="text-sm font-semibold text-amber-500">
              Locked Until Cliff Unlocks
            </span>
          </div>
          <div className="text-xs text-amber-400/80">
            Time remaining:{" "}
            <span className="font-mono font-semibold">{timeUntilCliff}</span>
          </div>
          <div className="mt-2 text-xs text-amber-300/70">
            💡 Your earnings will start streaming after the cliff period ends
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="text-sm font-semibold text-emerald-500">
              Cliff Unlocked - Earnings Active
            </span>
          </div>
          {timeUntilCliff === "Unlocked" && (
            <div className="text-xs text-emerald-400/80">
              Your stream is fully active and earning
            </div>
          )}
        </div>
      )}

      <div className="my-6">
        <div className="mb-2 flex items-center gap-2 text-sm uppercase tracking-[0.05em] text-[var(--muted)]">
          {t("worker.current_earnings")}
          <div className="group relative">
            <span className="cursor-help text-[var(--muted)]">ⓘ</span>
            <div className="invisible absolute left-0 top-6 z-10 w-64 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text)] shadow-lg group-hover:visible">
              <p className="font-semibold">How the Cliff Works</p>
              <p className="mt-1 text-[var(--muted)]">
                A cliff is a waiting period before your earnings begin to
                stream. Once the cliff period ends, earnings start streaming in
                real-time and you can withdraw available funds.
              </p>
            </div>
          </div>
        </div>
        <div className="text-[1.75rem] font-bold text-[var(--text)]">
          {formatTokenAmount(currentEarnings, stream.tokenSymbol)}{" "}
          {stream.tokenSymbol}
        </div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          {t("worker.of_total", {
            amount: stream.totalAmount,
            symbol: stream.tokenSymbol,
          })}
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="stream-progress-bar">
        <div
          className="stream-progress-fill"
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>

      {/* Streamed / Remaining Stats */}
      <div className="stream-stats">
        <div className="stream-stat">
          <span className="stream-stat-label">Streamed so far</span>
          <span className="stream-stat-value">
            {currentEarnings.toFixed(7)} {stream.tokenSymbol}
          </span>
        </div>
        <div className="stream-stat" style={{ textAlign: "right" }}>
          <span className="stream-stat-label">Remaining</span>
          <span className="stream-stat-value">
            {remaining.toFixed(7)} {stream.tokenSymbol}
          </span>
        </div>
      </div>

      {/* Withdrawal Countdown */}
      <div
        className={`stream-countdown ${
          isBeforeCliff
            ? "stream-countdown--locked"
            : "stream-countdown--available"
        }`}
      >
        <span className="stream-countdown-dot" />
        <span className="stream-countdown-label">
          {isBeforeCliff ? "Next withdrawal in" : "Withdrawal available"}
        </span>
        {isBeforeCliff && (
          <span className="stream-countdown-time">{timeUntilCliff}</span>
        )}
      </div>

      {/* Last event indicator */}
      {lastEventAmount !== null &&
        (() => {
          const amt = lastEventAmount;
          return (
            <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/8 px-3 py-2 text-xs text-sky-400">
              ⚡ Last withdrawal detected: {amt.toFixed(7)} {stream.tokenSymbol}
            </div>
          );
        })()}

      <div
        style={{
          marginTop: "1rem",
          marginBottom: "1rem",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
          {t("worker.available")}
        </span>
        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
          {formatTokenAmount(availableToWithdraw, stream.tokenSymbol)}{" "}
          {stream.tokenSymbol}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-subtle)]"
          onClick={() => setShowTimeline(!showTimeline)}
        >
          {showTimeline ? "Hide Timeline" : "Show Timeline"}
        </button>
        <button
          type="button"
          className="w-full rounded-xl border-0 bg-[var(--accent)] px-3 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          onClick={() => addNotification("Withdrawal triggered!", "success")}
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

const CompletedStreamCard: React.FC<{
  stream: WorkerStream;
  withdrawals: WithdrawalRecord[];
}> = ({ stream, withdrawals }) => {
  const { t } = useTranslation();
  const { address } = useWallet();
  const [showTimeline, setShowTimeline] = useState(false);

  // Calculate the period (YYYY-MM) from the stream end date
  const getPeriod = () => {
    const endDate = new Date(stream.endTime * 1000);
    const year = endDate.getFullYear();
    const month = String(endDate.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface-subtle)] p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-[var(--text)]">
            {stream.employerName}
          </div>
          <div className="flex items-center gap-1 font-mono text-xs text-[var(--muted)]">
            <span>{stream.employerAddress}</span>
            <CopyButton
              value={stream.employerAddress}
              label="Copy employer address"
            />
          </div>
        </div>
        <div className="rounded-md bg-blue-500/10 px-2 py-1 text-sm text-blue-400">
          {t("worker.status_completed")}
        </div>
      </div>

      <div className="my-4">
        <div className="mb-1 text-sm uppercase tracking-[0.05em] text-[var(--muted)]">
          {t("worker.total_paid")}
        </div>
        <div className="text-[1.5rem] font-bold text-[var(--text)]">
          {formatTokenAmount(stream.totalAmount, stream.tokenSymbol)}{" "}
          {stream.tokenSymbol}
        </div>
      </div>

      <div className="my-4 h-2 overflow-hidden rounded bg-[var(--surface)]">
        <div className="h-full w-full bg-gradient-to-r from-blue-600 to-sky-400" />
      </div>

      {stream.proofGatewayUrl ? (
        <a
          href={stream.proofGatewayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-3 font-semibold text-blue-400 no-underline transition-opacity hover:opacity-80"
        >
          <svg
            width="16"
            height="16"
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
        <div className="flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--muted)]">
          {t("worker.proof_generating")}
        </div>
      )}

      {stream.proofCid && (
        <div className="mt-3 truncate text-center font-mono text-[10px] text-[var(--muted)]">
          {t("worker.proof_cid_label")}: {stream.proofCid}
        </div>
      )}

      {/* Payslip Download Button */}
      {address && (
        <div className="mt-4">
          <PayslipDownloadButton
            workerAddress={address}
            period={getPeriod()}
            className="w-full"
          />
        </div>
      )}

      <button
        className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-subtle)]"
        onClick={() => setShowTimeline(!showTimeline)}
      >
        {showTimeline ? "Hide Timeline" : "Show Timeline"}
      </button>

      {showTimeline && (
        <StreamTimeline stream={stream} withdrawals={withdrawals} />
      )}
    </div>
  );
};

const WorkerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { address } = useWallet();
  const { streams, withdrawalHistory, isLoading, error, refetch } =
    useStreams(address);
  const { addStreamNotification } = useNotification();
  const previousStreamStatusesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (isLoading) return;

    const previousStatuses = previousStreamStatusesRef.current;
    streams.forEach((stream) => {
      const previousStatus = previousStatuses[stream.id];
      if (previousStatus === undefined) return;

      if (previousStatus !== 2 && stream.status === 2) {
        addStreamNotification("stream_completed", {
          message: `Stream ${stream.id} is now completed.`,
          dedupeKey: `stream-completed-${stream.id}`,
        });
      }

      if (previousStatus !== 1 && stream.status === 1) {
        addStreamNotification("stream_cancelled", {
          message: `Stream ${stream.id} was cancelled.`,
          dedupeKey: `stream-cancelled-${stream.id}`,
        });
      }
    });

    previousStreamStatusesRef.current = streams.reduce<Record<string, number>>(
      (acc, stream) => {
        acc[stream.id] = stream.status;
        return acc;
      },
      {},
    );
  }, [addStreamNotification, isLoading, streams]);

  if (isLoading) {
    return (
      <Layout.Content>
        <Layout.Inset>
          <div className="mx-auto max-w-[1200px] px-8 py-8">
            <header className="mb-8">
              <Skeleton
                variant="rect"
                width="300px"
                height="3rem"
                className="rounded-lg"
              />
            </header>

            <section className="mb-12">
              <EarningsSkeleton />
            </section>

            <h2 className="mb-6">
              <Skeleton variant="rect" width="200px" height="2rem" />
            </h2>
            <div className="mb-12 grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 max-[768px]:grid-cols-1">
              {[1, 2, 3].map((i) => (
                <StreamCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </Layout.Inset>
      </Layout.Content>
    );
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-[1200px] px-8 py-24 text-[var(--text)] text-center">
        <Text as="h2" size="lg">
          {t("worker.connect_prompt")}
        </Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1200px] px-8 py-24 text-center">
        <Text as="h2" size="lg">
          {t("worker.load_error")}
        </Text>
        <p className="mt-4 font-mono text-sm text-[var(--muted)]">{error}</p>
        <button
          type="button"
          className="mt-6 rounded-xl border-0 bg-[var(--accent)] px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          onClick={refetch}
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  const activeStreams = streams.filter((s) => s.status !== 2);
  const completedStreams = streams.filter((s) => s.status === 2);

  return (
    <Layout.Content>
      <Layout.Inset>
        <div className="mx-auto max-w-[1200px] px-8 py-8 text-[var(--text)] max-[768px]:px-4">
          <header className="mb-8 flex items-center justify-between max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-4">
            <h1 className="bg-gradient-to-br from-[var(--text)] to-[var(--muted)] bg-clip-text text-[2.5rem] font-bold text-transparent max-[768px]:text-[2rem]">
              {t("worker.dashboard_title")}
            </h1>
          </header>

          <section className="mb-12 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6 max-[768px]:grid-cols-1">
            <EarningsDisplay streams={streams} />
          </section>

          <section className="mb-12">
            <EarningsForecast streams={streams} />
          </section>

          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[var(--text)]">
            {t("worker.batch_atomic_note")}
          </div>

          <h2 className="mb-6 text-2xl font-semibold text-[var(--text)]">
            {t("worker.active_streams_heading")}
          </h2>
          {activeStreams.length === 0 ? (
            <div className="mb-12 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-12 text-center backdrop-blur">
              <p style={{ color: "var(--muted)" }}>
                {t("worker.no_active_streams")}
              </p>
            </div>
          ) : (
            <div className="mb-12 grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 max-[768px]:grid-cols-1">
              {activeStreams.map((stream) => (
                <StreamCard
                  key={stream.id}
                  stream={stream}
                  withdrawals={withdrawalHistory.filter(
                    (w) => w.streamId === stream.id,
                  )}
                />
              ))}
            </div>
          )}

          {completedStreams.length > 0 && (
            <>
              <h2 className="mb-6 text-2xl font-semibold text-[var(--text)]">
                Completed Streams
              </h2>
              <div className="mb-12 grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 max-[768px]:grid-cols-1">
                {completedStreams.map((stream) => (
                  <CompletedStreamCard
                    key={stream.id}
                    stream={stream}
                    withdrawals={withdrawalHistory.filter(
                      (w) => w.streamId === stream.id,
                    )}
                  />
                ))}
              </div>
            </>
          )}

          <h2 className="mb-6 text-2xl font-semibold text-[var(--text)]">
            {t("worker.withdrawal_history_heading")}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)]">
            <table className="w-full border-collapse max-[768px]:block max-[768px]:overflow-x-auto">
              <thead>
                <tr>
                  <th className="bg-[var(--surface-subtle)] p-4 text-left text-sm font-medium text-[var(--muted)]">
                    {t("worker.col_date")}
                  </th>
                  <th className="bg-[var(--surface-subtle)] p-4 text-left text-sm font-medium text-[var(--muted)]">
                    {t("worker.col_amount")}
                  </th>
                  <th className="bg-[var(--surface-subtle)] p-4 text-left text-sm font-medium text-[var(--muted)]">
                    {t("worker.col_token")}
                  </th>
                  <th className="bg-[var(--surface-subtle)] p-4 text-left text-sm font-medium text-[var(--muted)]">
                    {t("worker.col_transaction")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {withdrawalHistory.map((record) => (
                  <tr
                    key={record.id}
                    className="[&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-[var(--border)]"
                  >
                    <td className="p-4 text-sm">{record.date}</td>
                    <td className="p-4 text-sm font-semibold">
                      {record.amount}
                    </td>
                    <td className="p-4 text-sm">{record.tokenSymbol}</td>
                    <td className="p-4 text-sm">
                      <span className="flex items-center gap-1">
                        <a
                          href={`#${record.txHash}`}
                          className="font-mono text-[var(--accent)] no-underline"
                        >
                          {record.txHash}
                        </a>
                        <CopyButton
                          value={record.txHash}
                          label="Copy transaction hash"
                        />
                      </span>
                    </td>
                  </tr>
                ))}
                {withdrawalHistory.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: "center",
                        padding: "2rem",
                        color: "var(--muted)",
                      }}
                    >
                      {t("worker.no_withdrawal_history")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default WorkerDashboard;
