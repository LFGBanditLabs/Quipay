import React, { useState, useEffect, useCallback } from "react";
import { Layout, Text, Loader } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useStreams, WorkerStream } from "../hooks/useStreams";
import { EarningsDisplay } from "../components/EarningsDisplay";
import { useStreamSubscription } from "../hooks/useStreamSubscription";
import "../components/StreamProgress.css";

const StreamCard: React.FC<{
  stream: WorkerStream;
  refetch?: () => void;
}> = ({ stream, refetch }) => {
  const [currentEarnings, setCurrentEarnings] = useState(0);
  const [timeUntilCliff, setTimeUntilCliff] = useState<string>("");
  const [isBeforeCliff, setIsBeforeCliff] = useState(false);
  const [lastEventAmount, setLastEventAmount] = useState<number | null>(null);

  // Subscribe to real-time withdrawal events from the contract
  const handleWithdrawal = useCallback(
    (update: { streamId: string; amount: number }) => {
      if (update.streamId === stream.id) {
        setLastEventAmount(update.amount);
      }
    },
    [stream.id],
  );

  useStreamSubscription(handleWithdrawal, refetch);

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
        return;
      }

      const elapsedAfterCliff = now - stream.cliffTime;
      if (elapsedAfterCliff < 0) {
        setCurrentEarnings(0);
        return;
      }
      const earned = elapsedAfterCliff * stream.flowRate;
      setCurrentEarnings(Math.min(earned, stream.totalAmount));
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [stream]);

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
          <div className="font-mono text-xs text-[var(--muted)]">
            {stream.employerAddress}
          </div>
        </div>
        <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-sm text-emerald-500">
          {stream.flowRate.toFixed(6)} {stream.tokenSymbol}/sec
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
          Current Earnings
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
          {currentEarnings.toFixed(7)} {stream.tokenSymbol}
        </div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          of {stream.totalAmount} {stream.tokenSymbol} total
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
      {lastEventAmount !== null && (
        <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/8 px-3 py-2 text-xs text-sky-400">
          ⚡ Last withdrawal detected: {lastEventAmount.toFixed(7)}{" "}
          {stream.tokenSymbol}
        </div>
      )}

      <div
        style={{
          marginTop: "1rem",
          marginBottom: "1rem",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
          Available:
        </span>
        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
          {availableToWithdraw.toFixed(7)} {stream.tokenSymbol}
        </span>
      </div>

      <button
        className="w-full rounded-xl border-0 bg-[var(--accent)] px-3 py-3 font-semibold text-white transition-opacity hover:opacity-90"
        onClick={() => alert("Withdrawal triggered!")}
      >
        Withdraw Funds
      </button>
    </div>
  );
};

const WorkerDashboard: React.FC = () => {
  const { address } = useWallet();
  const { streams, withdrawalHistory, isLoading, error, refetch } =
    useStreams(address);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader />
      </div>
    );
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-[1200px] px-8 py-24 text-[var(--text)] text-center">
        <Text as="h2" size="lg">
          Please connect your wallet to view your dashboard
        </Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1200px] px-8 py-24 text-center">
        <Text as="h2" size="lg">
          Failed to load stream data
        </Text>
        <p className="mt-4 font-mono text-sm text-[var(--muted)]">{error}</p>
        <button
          className="mt-6 rounded-xl border-0 bg-[var(--accent)] px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          onClick={refetch}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <Layout.Content>
      <Layout.Inset>
        <div className="mx-auto max-w-[1200px] px-8 py-8 text-[var(--text)] max-[768px]:px-4">
          <header className="mb-8 flex items-center justify-between max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-4">
            <h1 className="bg-gradient-to-br from-[var(--text)] to-[var(--muted)] bg-clip-text text-[2.5rem] font-bold text-transparent max-[768px]:text-[2rem]">
              Worker Dashboard
            </h1>
          </header>

          <section className="mb-12 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6 max-[768px]:grid-cols-1">
            <EarningsDisplay streams={streams} />
          </section>

          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[var(--text)]">
            Batch withdrawals are atomic. If a single payout in the batch fails,
            the entire transaction reverts and no stream in that batch is
            withdrawn.
          </div>

          <h2 className="mb-6 text-2xl font-semibold text-[var(--text)]">
            Your Active Streams
          </h2>
          {streams.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-12 text-center backdrop-blur">
              <p style={{ color: "var(--muted)" }}>
                No active streams found for this address.
              </p>
            </div>
          ) : (
            <div className="mb-12 grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 max-[768px]:grid-cols-1">
              {streams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} refetch={refetch} />
              ))}
            </div>
          )}

          <h2 className="mb-6 text-2xl font-semibold text-[var(--text)]">
            Withdrawal History
          </h2>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)]">
            <table className="w-full border-collapse max-[768px]:block max-[768px]:overflow-x-auto">
              <thead>
                <tr>
                  <th className="bg-[var(--surface-subtle)] p-4 text-left text-sm font-medium text-[var(--muted)]">
                    Date
                  </th>
                  <th className="bg-[var(--surface-subtle)] p-4 text-left text-sm font-medium text-[var(--muted)]">
                    Amount
                  </th>
                  <th className="bg-[var(--surface-subtle)] p-4 text-left text-sm font-medium text-[var(--muted)]">
                    Token
                  </th>
                  <th className="bg-[var(--surface-subtle)] p-4 text-left text-sm font-medium text-[var(--muted)]">
                    Transaction
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
                      <a
                        href={`#${record.txHash}`}
                        className="font-mono text-[var(--accent)] no-underline"
                      >
                        {record.txHash}
                      </a>
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
                      No withdrawal history yet.
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
