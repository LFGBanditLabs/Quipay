import React, { useState, useEffect } from "react";
import { Layout, Text, Loader } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useStreams, WorkerStream } from "../hooks/useStreams";
import { EarningsDisplay } from "../components/EarningsDisplay";

const StreamCard: React.FC<{ stream: WorkerStream }> = ({ stream }) => {
  const [currentEarnings, setCurrentEarnings] = useState(0);

  useEffect(() => {
    const calculate = () => {
      const now = Date.now() / 1000;
      const elapsed = now - stream.startTime;
      if (elapsed < 0) {
        setCurrentEarnings(0);
        return;
      }
      const earned = elapsed * stream.flowRate;
      setCurrentEarnings(Math.min(earned, stream.totalAmount));
    };

    calculate();
    const interval = setInterval(calculate, 100);
    return () => clearInterval(interval);
  }, [stream]);

  const percentage = (currentEarnings / stream.totalAmount) * 100;
  const availableToWithdraw = Math.max(
    0,
    currentEarnings - stream.claimedAmount,
  );

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold">{stream.employerName}</div>
          <div className="font-mono text-xs text-zinc-500">
            {stream.employerAddress}
          </div>
        </div>
        <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-sm text-emerald-500">
          {stream.flowRate.toFixed(6)} {stream.tokenSymbol}/sec
        </div>
      </div>

      <div className="my-6">
        <div className="mb-2 text-sm uppercase tracking-[0.05em] text-[var(--muted)]">
          Current Earnings
        </div>
        <div className="text-[1.75rem] font-bold text-white">
          {currentEarnings.toFixed(7)} {stream.tokenSymbol}
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          of {stream.totalAmount} {stream.tokenSymbol} total
        </div>
      </div>

      <div className="my-4 h-2 overflow-hidden rounded bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-indigo-600 to-sky-500 transition-[width] duration-500"
          style={{ width: `${Math.min(100, percentage)}%` }}
        ></div>
      </div>

      <div
        style={{
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
  const { streams, withdrawalHistory, isLoading } = useStreams(address);

  if (isLoading) {
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "100px" }}
      >
        <Loader />
      </div>
    );
  }

  if (!address) {
    return (
      <div
        className="mx-auto max-w-[1200px] px-8 py-8 text-[var(--text)] text-center"
        style={{ textAlign: "center", padding: "100px" }}
      >
        <Text as="h2" size="lg">
          Please connect your wallet to view your dashboard
        </Text>
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

          <h2 className="mb-6 text-2xl font-semibold text-white">
            Your Active Streams
          </h2>
          {streams.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur">
              <p style={{ color: "var(--muted)" }}>
                No active streams found for this address.
              </p>
            </div>
          ) : (
            <div className="mb-12 grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 max-[768px]:grid-cols-1">
              {streams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          )}

          <h2 className="mb-6 text-2xl font-semibold text-white">
            Withdrawal History
          </h2>
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
            <table className="w-full border-collapse max-[768px]:block max-[768px]:overflow-x-auto">
              <thead>
                <tr>
                  <th className="bg-white/5 p-4 text-left text-sm font-medium text-[#a5a5a5]">
                    Date
                  </th>
                  <th className="bg-white/5 p-4 text-left text-sm font-medium text-[#a5a5a5]">
                    Amount
                  </th>
                  <th className="bg-white/5 p-4 text-left text-sm font-medium text-[#a5a5a5]">
                    Token
                  </th>
                  <th className="bg-white/5 p-4 text-left text-sm font-medium text-[#a5a5a5]">
                    Transaction
                  </th>
                </tr>
              </thead>
              <tbody>
                {withdrawalHistory.map((record) => (
                  <tr
                    key={record.id}
                    className="[&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-white/5"
                  >
                    <td className="p-4 text-sm">{record.date}</td>
                    <td className="p-4 text-sm font-semibold">
                      {record.amount}
                    </td>
                    <td className="p-4 text-sm">{record.tokenSymbol}</td>
                    <td className="p-4 text-sm">
                      <a
                        href={`#${record.txHash}`}
                        className="font-mono text-indigo-600 no-underline"
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
