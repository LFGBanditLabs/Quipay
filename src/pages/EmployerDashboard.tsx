import React from "react";
import { Layout, Text, Button, Loader } from "@stellar/design-system";
import { usePayroll } from "../hooks/usePayroll";
import styles from "./EmployerDashboard.module.css";
import { useNavigate } from "react-router-dom";
import WithdrawButton from "../components/WithdrawButton";
import EmptyState from "../components/EmptyState";

const EmployerDashboard: React.FC = () => {
  const {
    treasuryBalances,
    totalLiabilities,
    activeStreamsCount,
    activeStreams,
    isLoading,
  } = usePayroll();
  const navigate = useNavigate();

  const demoContract = {
    // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
    withdrawableAmount: async (_address: string) => {
      return BigInt("5000000"); // 5.00 USDC (6 decimals)
    },
    withdraw: async () => {
      await new Promise((res) => setTimeout(res, 2000)); // simulate delay
      return {
        hash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
        wait: async () => {},
      };
    },
  };

  if (isLoading) {
    return (
      <Layout.Content>
        <Layout.Inset>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "50px",
            }}
          >
            <Loader aria-label="Loading dashboard content" aria-busy="true" />
          </div>
        </Layout.Inset>
      </Layout.Content>
    );
  }

  const demoContract = {
    withdrawableAmount: async (address: string) => {
      return BigInt("5000000"); // 5.00 USDC (6 decimals)
    },
    withdraw: async () => {
      await new Promise((res) => setTimeout(res, 2000)); // simulate delay
      return {
        hash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
        wait: async () => { },
      };
    },
  };

  return (
    <Layout.Content>
      <Layout.Inset>
        <Text as="h1" size="xl" weight="medium">
          Employer Dashboard
        </Text>

        <div className={styles.dashboardGrid}>
          <WithdrawButton
            walletAddress="0xYourWalletAddress"
            contract={demoContract}
            tokenSymbol="USDC"
            tokenDecimals={6}
          />
          {/* Treasury Balance */}
          <div className={styles.card} id="tour-treasury-balance">
            <Text
              as="h2"
              size="md"
              weight="semi-bold"
              className={styles.cardHeader}
            >
              Treasury Balance
            </Text>
            {treasuryBalances.length === 0 ? (
              <div style={{ marginTop: "1rem" }}>
                <EmptyState
                  variant="treasury"
                  title="No Funds Yet"
                  description="Your treasury is currently empty. Deposit funds to start paying your workers."
                  icon="💰"
                  actionLabel="Deposit Funds"
                  onAction={() => navigate("/treasury-management")}
                />
              </div>
            ) : (
              <>
                {treasuryBalances.map((balance) => (
                  <div key={balance.tokenSymbol}>
                    <Text as="div" size="lg" className={styles.metricValue}>
                      {balance.balance} {balance.tokenSymbol}
                    </Text>
                  </div>
                ))}
                <div style={{ marginTop: "10px" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    id="tour-manage-treasury"
                    onClick={() => navigate("/treasury-management")}
                  >
                    Manage Treasury
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Total Liabilities */}
          <div className={styles.card}>
            <Text as="span" size="md" weight="semi-bold" className={styles.cardHeader}>
              Total Liabilities
            </Text>
            <Text as="div" size="lg" className={styles.metricValue}>
              {totalLiabilities}
            </Text>
            <Text as="p" size="sm" variant="secondary">
              Estimated monthly
            </Text>
          </div>

          {/* Active Streams Count */}
          <div className={styles.card}>
            <Text as="span" size="md" weight="semi-bold" className={styles.cardHeader}>
              Active Streams
            </Text>
            <Text as="div" size="lg" className={styles.metricValue}>
              {activeStreamsCount}
            </Text>
          </div>
        </div>

        <div className={styles.streamsSection}>
          <div className={styles.streamsHeader}>
            <Text as="h2" size="lg">
              Active Streams
            </Text>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate("/create-stream")}
            >
              Create New Stream
            </Button>
          </div>

          {activeStreams.length === 0 ? (
            <EmptyState
              variant="streams"
              title="No Active Streams"
              description="You haven't set up any payment streams yet. Start by creating a new stream for your first worker."
              icon="🌊"
              actionLabel="Create New Stream"
              onAction={() => navigate("/create-stream")}
            />
          ) : (
            <div className={styles.streamsList}>
              {activeStreams.map((stream) => (
                <div key={stream.id} className={styles.streamItem}>
                  <div>
                    <Text as="div" weight="bold">{stream.employeeName}</Text>
                    <Text as="div" size="sm" variant="secondary">{stream.employeeAddress}</Text>
                  </div>
                  <div>
                    <Text as="div">Flow Rate: {stream.flowRate} {stream.tokenSymbol}/sec</Text>
                    <Text as="div" size="sm" variant="secondary">Start: {stream.startDate}</Text>
                  </div>
                  <div>
                    <Text as="div" weight="bold">Total: {stream.totalStreamed} {stream.tokenSymbol}</Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default EmployerDashboard;
