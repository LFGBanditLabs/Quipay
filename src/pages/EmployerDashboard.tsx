import React from "react";
import { Layout, Text, Button } from "@stellar/design-system";
import { usePayroll } from "../hooks/usePayroll";
import { useNavigate } from "react-router-dom";
import { SeoHelmet } from "../components/seo/SeoHelmet";
import WithdrawButton from "../components/WithdrawButton";
import EmptyState from "../components/EmptyState";
import { SkeletonCard, SkeletonRow } from "../components/Loading";

const EmployerDashboard: React.FC = () => {
  const tw = {
    dashboardGrid:
      "mb-[30px] grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5 max-[768px]:grid-cols-1 max-[768px]:gap-4",
    streamsSection: "mt-10",
    streamsHeader:
      "mb-5 flex flex-wrap items-center justify-between gap-3 max-[768px]:flex-col max-[768px]:items-stretch max-[768px]:gap-4",
    streamsList: "flex flex-col gap-2.5",
    card: "rounded-lg border border-[var(--sds-color-neutral-border)] bg-[var(--sds-color-neutral-subtle)] p-5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] max-[480px]:p-4",
    cardHeader: "mb-2.5 block font-bold",
    metricValue:
      "text-2xl font-semibold text-[var(--sds-color-content-primary)] max-[768px]:text-xl",
    streamItem:
      "flex items-center justify-between gap-3.5 rounded-md border border-[var(--sds-color-neutral-border)] bg-[var(--sds-color-background-primary)] p-[15px] max-[768px]:flex-col max-[768px]:items-stretch max-[768px]:gap-3 max-[768px]:p-4",
  };

  const {
    treasuryBalances,
    totalLiabilities,
    activeStreamsCount,
    activeStreams,
    isLoading,
  } = usePayroll();
  const navigate = useNavigate();

  const seoDescription = isLoading
    ? "Loading your Quipay dashboard metrics and active stream overview."
    : `Track ${activeStreamsCount} active streams with total liabilities ${totalLiabilities} in your Quipay employer dashboard.`;

  if (isLoading) {
    return (
      <>
        <SeoHelmet
          title="Employer Dashboard"
          description={seoDescription}
          path="/dashboard"
          imagePath="/social/dashboard-preview.png"
          robots="noindex,nofollow"
        />
        <Layout.Content>
          <Layout.Inset>
            <Text as="h1" size="xl" weight="medium">
              Employer Dashboard
            </Text>
            <div className={tw.dashboardGrid}>
              <SkeletonCard lines={3} />
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </div>
            <div className={tw.streamsSection}>
              <div className={tw.streamsHeader}>
                <Text as="h2" size="lg">
                  Active Streams
                </Text>
              </div>
              <div className={tw.streamsList}>
                <SkeletonRow />
                <SkeletonRow />
              </div>
            </div>
          </Layout.Inset>
        </Layout.Content>
      </>
    );
  }

  const demoContract = {
    withdrawableAmount: () => {
      return Promise.resolve(BigInt("5000000")); // 5.00 USDC (6 decimals)
    },
    withdraw: async () => {
      await new Promise((res) => setTimeout(res, 2000)); // simulate delay
      return {
        hash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
        wait: async () => {},
      };
    },
  };

  return (
    <Layout.Content>
      <Layout.Inset>
        <Text as="h1" size="xl" weight="medium">
          Employer Dashboard
        </Text>

        <div className={tw.dashboardGrid}>
          <WithdrawButton
            walletAddress="0xYourWalletAddress"
            contract={demoContract}
            tokenSymbol="USDC"
            tokenDecimals={6}
          />

          {/* Treasury Balance */}
          <div className={tw.card} id="tour-treasury-balance">
            <Text
              as="h2"
              size="md"
              weight="semi-bold"
              className={tw.cardHeader}
            >
              Treasury Balance
            </Text>
            {treasuryBalances.map((balance) => (
              <div key={balance.tokenSymbol}>
                <Text as="div" size="lg" className={tw.metricValue}>
                  {balance.balance} {balance.tokenSymbol}
                </Text>
              </div>
            ))}
            {treasuryBalances.length === 0 ? (
              <div style={{ marginTop: "1rem" }}>
                <EmptyState
                  variant="treasury"
                  title="No Funds Yet"
                  description="Your treasury is currently empty. Deposit funds to start paying your workers."
                  icon="💰"
                  actionLabel="Deposit Funds"
                  onAction={() => {
                    void navigate("/treasury-management");
                  }}
                />
              </div>
            ) : null}
            <div style={{ marginTop: "10px" }}>
              <Button
                variant="secondary"
                size="sm"
                id="tour-manage-treasury"
                onClick={() => {
                  void navigate("/treasury-management");
                }}
              >
                Manage Treasury
              </Button>
            </div>
          </div>

          {/* Total Liabilities */}
          <div className={tw.card}>
            <Text
              as="span"
              size="md"
              weight="semi-bold"
              className={tw.cardHeader}
            >
              Total Liabilities
            </Text>
            <Text as="div" size="lg" className={tw.metricValue}>
              {totalLiabilities}
            </Text>
            <Text as="p" size="sm" style={{ color: "var(--muted)" }}>
              You are projected to pay {totalLiabilities} in the next 30 days.
            </Text>
          </div>

          {/* Active Streams Count */}
          <div className={tw.card}>
            <Text
              as="span"
              size="md"
              weight="semi-bold"
              className={tw.cardHeader}
            >
              Active Streams
            </Text>
            <Text as="div" size="lg" className={tw.metricValue}>
              {activeStreamsCount}
            </Text>
          </div>
        </div>

        <div className={tw.streamsSection}>
          <div className={tw.streamsHeader}>
            <Text as="h2" size="lg">
              Active Streams
            </Text>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                void navigate("/create-stream");
              }}
            >
              Create New Stream
            </Button>
          </div>

          {activeStreams.length === 0 ? (
            <EmptyState
              title="No active streams"
              description="You haven't created any payment streams yet. Start by adding your first worker."
              variant="streams"
              actionLabel="Create New Stream"
              onAction={() => {
                void navigate("/create-stream");
              }}
            />
          ) : (
            <div className={tw.streamsList}>
              {activeStreams.map((stream) => (
                <div
                  key={stream.id}
                  className={tw.streamItem}
                  onClick={() => {
                    void navigate(`/stream/${stream.id}`);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div>
                    <Text as="div" size="md" weight="bold">
                      {stream.employeeName}
                    </Text>
                    <Text as="div" size="sm" style={{ color: "var(--muted)" }}>
                      {stream.employeeAddress}
                    </Text>
                  </div>
                  <div>
                    <Text as="div" size="sm">
                      Flow Rate: {stream.flowRate} {stream.tokenSymbol}/sec
                    </Text>
                    <Text as="div" size="sm" style={{ color: "var(--muted)" }}>
                      Start: {stream.startDate}
                    </Text>
                  </div>
                  <div>
                    <Text as="div" size="md" weight="bold">
                      Total: {stream.totalStreamed} {stream.tokenSymbol}
                    </Text>
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
