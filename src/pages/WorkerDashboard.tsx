import React, { useState, useEffect } from "react";
import { Layout, Text, Loader } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useStreams, WorkerStream } from "../hooks/useStreams";
import { EarningsDisplay } from "../components/EarningsDisplay";
import styles from "./WorkerDashboard.module.css";

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
    <div className={styles.streamCard}>
      <div className={styles.streamHeader}>
        <div>
          <div className={styles.employerName}>{stream.employerName}</div>
          <div className={styles.employerAddress}>{stream.employerAddress}</div>
        </div>
        <div className={styles.flowRate}>
          {stream.flowRate.toFixed(6)} {stream.tokenSymbol}/sec
        </div>
      </div>

      <div className={styles.earningsDisplay}>
        <div className={styles.statLabel}>Current Earnings</div>
        <div className={styles.currentEarnings}>
          {currentEarnings.toFixed(7)} {stream.tokenSymbol}
        </div>
        <div className={styles.totalLimit}>
          of {stream.totalAmount} {stream.tokenSymbol} total
        </div>
      </div>

      <div className={styles.progressBarContainer}>
        <div
          className={styles.progressBar}
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
        className={styles.withdrawButton}
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
        className={styles.container}
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
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>Worker Dashboard</h1>
          </header>

          <section className={styles.statsGrid}>
            <EarningsDisplay streams={streams} />
          </section>

          <h2 className={styles.sectionTitle}>Your Active Streams</h2>
          {streams.length === 0 ? (
            <div
              className={styles.statCard}
              style={{ textAlign: "center", padding: "3rem" }}
            >
              <p style={{ color: "var(--muted)" }}>
                No active streams found for this address.
              </p>
            </div>
          ) : (
            <div className={styles.streamsGrid}>
              {streams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          )}

          <h2 className={styles.sectionTitle}>Withdrawal History</h2>
          <div className={styles.historyContainer}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Token</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalHistory.map((record) => (
                  <tr key={record.id}>
                    <td>{record.date}</td>
                    <td style={{ fontWeight: 600 }}>{record.amount}</td>
                    <td>{record.tokenSymbol}</td>
                    <td>
                      <a href={`#${record.txHash}`} className={styles.txHash}>
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
