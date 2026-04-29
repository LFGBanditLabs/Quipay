import React from "react";
import { Layout, Text, Button } from "@stellar/design-system";
import { useTranslation } from "react-i18next";
import { usePayroll, Stream } from "../hooks/usePayroll";
import { useNavigate } from "react-router-dom";
import { SeoHelmet } from "../components/seo/SeoHelmet";
import EmptyState from "../components/EmptyState";
import { ErrorMessage } from "../components/ErrorMessage";
import StreamVisualizer from "../components/StreamVisualizer";
import { CancelStreamModal } from "../components/CancelStreamModal";
import {
  buildCancelStreamTx,
  buildPauseStreamTx,
  buildResumeStreamTx,
} from "../contracts/payroll_stream";
import { useWallet } from "../hooks/useWallet";
import { useNotification } from "../hooks/useNotification";
import { SkeletonRow, StatTileSkeleton } from "../components/Loading";
import CopyButton from "../components/CopyButton";
import {
  type StreamAction,
  useStreamActionMutation,
} from "../hooks/useStreamActions";

const EmployerDashboard: React.FC = () => {
  const { t } = useTranslation();
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
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const { address } = useWallet();
  const {
    treasuryBalances,
    totalLiabilities,
    activeStreamsCount,
    activeStreams,
    isLoading,
    payrollSummaryError,
    refreshData,
    retryPayrollSummary,
    applyOptimisticStreamStatus,
    restoreStream,
    clearStreamPending,
  } = usePayroll(address);

  const [streamToCancel, setStreamToCancel] = React.useState<Stream | null>(
    null,
  );

  const streamAction = useStreamActionMutation({
    employerAddress: address,
    runAction: async (stream, action) => {
      if (!address) {
        throw new Error("Connect your wallet before updating a stream.");
      }

      const streamIdBigInt = BigInt(stream.id);
      if (action === "pause") {
        await buildPauseStreamTx(streamIdBigInt, address);
      } else if (action === "resume") {
        await buildResumeStreamTx(streamIdBigInt, address);
      } else {
        await buildCancelStreamTx(streamIdBigInt, address);
      }
    },
  });

  const queueStreamAction = (stream: Stream, action: StreamAction) => {
    streamAction.mutate(
      { stream, action },
      {
        onSuccess: () => {
          addNotification(
            `Successfully requested ${action} for stream ${stream.id}`,
            "success",
          );
          void refreshData();
        },
      },
    );
  };

  const handleConfirmCancel = () => {
    if (streamToCancel) {
      queueStreamAction(streamToCancel, "cancel");
    }
    return Promise.resolve();
  };

  const getActionLabel = (stream: Stream, action: StreamAction) => {
    if (stream.pendingAction === action) {
      return action === "cancel"
        ? "Cancelling..."
        : action === "pause"
          ? "Pausing..."
          : "Resuming...";
    }
    return action === "cancel"
      ? "Cancel Stream"
      : action === "pause"
        ? "Pause"
        : "Resume";
  };

  const seoDescription = isLoading
    ? t("dashboard.loading_description")
    : t("dashboard.seo_description", { activeStreamsCount, totalLiabilities });

  if (isLoading) {
    return (
      <>
        <SeoHelmet
          title={t("dashboard.title")}
          description={seoDescription}
          path="/dashboard"
          imagePath="/social/dashboard-preview.png"
          robots="noindex,nofollow"
        />
        <Layout.Content>
          <Layout.Inset>
            <Text as="h1" size="xl" weight="medium">
              {t("dashboard.title")}
            </Text>
            <div className={tw.dashboardGrid} aria-busy="true">
              <StatTileSkeleton />
              <StatTileSkeleton />
              <StatTileSkeleton />
            </div>
            <div className={tw.streamsSection}>
              <div className={tw.streamsHeader}>
                <Text as="h2" size="lg">
                  {t("dashboard.active_streams")}
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

  return (
    <Layout.Content>
      <Layout.Inset>
        <Text as="h1" size="xl" weight="medium">
          {t("dashboard.title")}
        </Text>

        {/* Topology Visualizer */}
        <div style={{ marginTop: "24px", marginBottom: "32px" }}>
          <Text
            as="h2"
            size="lg"
            weight="medium"
            style={{ marginBottom: "16px" }}
          >
            Network Topology
          </Text>
          <StreamVisualizer
            streams={activeStreams}
            treasuryBalance={
              treasuryBalances.length > 0
                ? treasuryBalances
                    .map((t) => `${t.balance} ${t.tokenSymbol}`)
                    .join(", ")
                : "0"
            }
          />
        </div>

        {payrollSummaryError && (
          <ErrorMessage
            error={payrollSummaryError}
            onRetry={() => {
              void retryPayrollSummary();
            }}
          />
        )}

        <div className={tw.dashboardGrid}>
          {/* Treasury Balance */}
          <div className={tw.card} id="tour-treasury-balance">
            <Text
              as="h2"
              size="md"
              weight="semi-bold"
              className={tw.cardHeader}
            >
              {t("dashboard.treasury_balance")}
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
                  title={t("dashboard.no_funds_title")}
                  description={t("dashboard.no_funds_description")}
                  icon="💰"
                  actionLabel={t("dashboard.deposit_funds")}
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
                {t("dashboard.manage_treasury")}
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
              {t("dashboard.total_liabilities")}
            </Text>
            <Text as="div" size="lg" className={tw.metricValue}>
              {totalLiabilities}
            </Text>
            <Text as="p" size="sm" style={{ color: "var(--muted)" }}>
              {t("dashboard.projected_pay", { totalLiabilities })}
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
              {t("dashboard.active_streams")}
            </Text>
            <Text as="div" size="lg" className={tw.metricValue}>
              {activeStreamsCount}
            </Text>
          </div>
        </div>

        <div className={tw.streamsSection}>
          <div className={tw.streamsHeader}>
            <Text as="h2" size="lg">
              {t("dashboard.active_streams")}
            </Text>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  void navigate("/stream-comparison");
                }}
              >
                Compare streams
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  void navigate("/create-stream");
                }}
              >
                {t("dashboard.create_new_stream")}
              </Button>
            </div>
          </div>

          {activeStreams.length === 0 ? (
            <EmptyState
              title={t("dashboard.no_streams_title")}
              description={t("dashboard.no_streams_description")}
              variant="streams"
              actionLabel={t("dashboard.create_new_stream")}
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Text
                        as="span"
                        size="sm"
                        style={{ color: "var(--muted)" }}
                      >
                        {stream.employeeAddress}
                      </Text>
                      <CopyButton
                        value={stream.employeeAddress}
                        label="Copy employee address"
                      />
                    </div>
                  </div>
                  <div>
                    <Text as="div" size="sm">
                      {t("dashboard.flow_rate")}: {stream.flowRate}{" "}
                      {stream.tokenSymbol}/sec
                    </Text>
                    <Text as="div" size="sm" style={{ color: "var(--muted)" }}>
                      {t("dashboard.start")}: {stream.startDate}
                    </Text>
                  </div>
                  <div className="flex flex-col items-end justify-center gap-2">
                    <Text as="div" size="md" weight="bold">
                      Total: {stream.totalStreamed} {stream.tokenSymbol}
                    </Text>
                    {stream.pendingAction && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                        Pending {stream.pendingAction}
                      </span>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!!stream.pendingAction}
                      onClick={(e) => {
                        e.stopPropagation();
                        queueStreamAction(
                          stream,
                          stream.status === "paused" ? "resume" : "pause",
                        );
                      }}
                    >
                      {getActionLabel(
                        stream,
                        stream.status === "paused" ? "resume" : "pause",
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={!!stream.pendingAction}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStreamToCancel(stream);
                      }}
                    >
                      {getActionLabel(stream, "cancel")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout.Inset>

      {streamToCancel && (
        <CancelStreamModal
          isOpen={!!streamToCancel}
          onClose={() => setStreamToCancel(null)}
          onConfirm={handleConfirmCancel}
          employeeName={streamToCancel.employeeName}
          flowRate={streamToCancel.flowRate}
          tokenSymbol={streamToCancel.tokenSymbol}
        />
      )}
    </Layout.Content>
  );
};

export default EmployerDashboard;
