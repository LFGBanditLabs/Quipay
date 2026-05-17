import React from "react";
import { useTranslation } from "react-i18next";
import { usePayroll, Stream } from "../hooks/usePayroll";
import { useNavigate } from "react-router-dom";

const STROOPS = 1e7;
function fmtStroops(raw: string | number | bigint, decimals = 2): string {
  const n = typeof raw === "bigint" ? Number(raw) : Number(raw);
  if (!n) return "0";
  return (n / STROOPS).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
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

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  id?: string;
  action?: { label: string; onClick: () => void };
}> = ({ label, value, sub, accent, id, action }) => (
  <div
    id={id}
    className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5 flex flex-col gap-3"
  >
    <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-neutral-500">
      {label}
    </p>
    <p
      className="font-mono text-[28px] font-bold leading-none tabular-nums text-white"
      style={accent ? { color: "#facc15" } : {}}
    >
      {value}
    </p>
    {sub && <p className="text-[14px] text-neutral-500">{sub}</p>}
    {action && (
      <button
        onClick={action.onClick}
        className="mt-auto inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.08] w-fit"
      >
        {action.label}
      </button>
    )}
  </div>
);

// ─── Stream row ───────────────────────────────────────────────────────────────

const StreamRow: React.FC<{
  stream: Stream;
  onPauseResume: () => void;
  onCancel: () => void;
  actionLabel: (a: StreamAction) => string;
  onClick: () => void;
}> = ({ stream, onPauseResume, onCancel, actionLabel, onClick }) => {
  const isPaused = stream.status === "paused";
  const hasPending = !!stream.pendingAction;

  const initials = stream.employeeName
    ? stream.employeeName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0a0a0a] px-5 py-4 transition-colors hover:border-yellow-400/20 hover:bg-[#0e0e0e]"
    >
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black text-black"
        style={{ backgroundColor: "#facc15" }}
      >
        {initials}
      </div>

      {/* Name + address */}
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold text-white leading-none">
          {stream.employeeName}
        </p>
        <div className="mt-1 flex items-center gap-1">
          <p className="truncate font-mono text-[11px] text-neutral-600 max-w-[160px]">
            {stream.employeeAddress}
          </p>
          <span onClick={(e) => e.stopPropagation()}>
            <CopyButton value={stream.employeeAddress} label="Copy address" />
          </span>
        </div>
      </div>

      {/* Rate */}
      <div className="hidden text-right sm:block">
        <p className="text-[12px] text-neutral-600 uppercase tracking-widest">
          Rate
        </p>
        <p className="font-mono text-[13px] font-semibold text-white">
          {stream.flowRate}{" "}
          <span className="text-neutral-600">{stream.tokenSymbol}/s</span>
          <span className="ml-1 text-[11px] text-neutral-700">
            ≈ {(parseFloat(stream.flowRate) * 86400).toFixed(2)}/day
          </span>
        </p>
      </div>

      {/* Total streamed */}
      <div className="hidden text-right md:block">
        <p className="text-[12px] text-neutral-600 uppercase tracking-widest">
          Streamed
        </p>
        <p
          className="font-mono text-[13px] font-bold"
          style={{ color: "#facc15" }}
        >
          {stream.totalStreamed}{" "}
          <span className="text-neutral-600 font-semibold">
            {stream.tokenSymbol}
          </span>
        </p>
      </div>

      {/* Status */}
      <div className="hidden sm:block">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            isPaused
              ? "bg-yellow-400/10 text-yellow-400"
              : "bg-green-500/10 text-green-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isPaused ? "bg-yellow-400" : "animate-pulse bg-green-400"}`}
          />
          {isPaused ? "Paused" : "Streaming"}
        </span>
      </div>

      {/* Pending badge */}
      {hasPending && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          {stream.pendingAction}...
        </span>
      )}

      {/* Actions */}
      <div
        className="flex items-center gap-2 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          disabled={hasPending}
          onClick={onPauseResume}
          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {actionLabel(isPaused ? "resume" : "pause")}
        </button>
        <button
          disabled={hasPending}
          onClick={onCancel}
          className="rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-1.5 text-[12px] font-semibold text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {actionLabel("cancel")}
        </button>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const EmployerDashboard: React.FC = () => {
  const { t } = useTranslation();
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
  } = usePayroll(address);

  const [streamToCancel, setStreamToCancel] = React.useState<Stream | null>(
    null,
  );

  const streamAction = useStreamActionMutation({
    employerAddress: address,
    runAction: async (stream, action) => {
      if (!address)
        throw new Error("Connect your wallet before updating a stream.");
      const id = BigInt(stream.id);
      if (action === "pause") await buildPauseStreamTx(id, address);
      else if (action === "resume") await buildResumeStreamTx(id, address);
      else await buildCancelStreamTx(id, address);
    },
  });

  const queueAction = (stream: Stream, action: StreamAction) => {
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
    if (streamToCancel) queueAction(streamToCancel, "cancel");
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
      ? "Cancel"
      : action === "pause"
        ? "Pause"
        : "Resume";
  };

  const seoDescription = isLoading
    ? t("dashboard.loading_description")
    : t("dashboard.seo_description", { activeStreamsCount, totalLiabilities });

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <SeoHelmet
          title={t("dashboard.title")}
          description={seoDescription}
          path="/dashboard"
          robots="noindex,nofollow"
        />
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <div className="mb-8">
            <div className="h-7 w-40 animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="mt-1 h-4 w-56 animate-pulse rounded-xl bg-white/[0.04]" />
          </div>
          <div
            className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
            aria-busy="true"
          >
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
          </div>
          <div className="space-y-3">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </>
    );
  }

  // Convert stroops to human-readable token amounts
  const treasuryDisplay =
    treasuryBalances.length > 0
      ? treasuryBalances
          .filter((b) => Number(b.balance) > 0)
          .map((b) => `${fmtStroops(b.balance)} ${b.tokenSymbol}`)
          .join(" · ") || "0 (no funds)"
      : "—";

  const liabilityDisplay = fmtStroops(totalLiabilities || "0");

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <>
      <SeoHelmet
        title={t("dashboard.title")}
        description={seoDescription}
        path="/dashboard"
        robots="noindex,nofollow"
      />

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* ── Page header ──────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">
              {t("dashboard.title")}
            </h1>
            <p className="mt-1 text-[15px] text-neutral-500">
              Payroll overview · Stellar Testnet
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void navigate("/stream-comparison")}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              Compare
            </button>
            <button
              onClick={() => void navigate("/create-stream")}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold text-black transition-colors hover:opacity-90"
              style={{ backgroundColor: "#facc15" }}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              {t("dashboard.create_new_stream")}
            </button>
          </div>
        </div>

        {/* ── Error ────────────────────────────────────────────────── */}
        {payrollSummaryError && (
          <div className="mb-6">
            <ErrorMessage
              error={payrollSummaryError}
              onRetry={() => void refreshData()}
            />
          </div>
        )}

        {/* ── KPI cards ────────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            id="tour-treasury-balance"
            label={t("dashboard.treasury_balance")}
            value={treasuryDisplay}
            sub={
              treasuryBalances.length === 0
                ? "Deposit to fund streams"
                : "Vault balance on-chain"
            }
            accent
            action={{
              label: t("dashboard.manage_treasury"),
              onClick: () => void navigate("/treasury-management"),
            }}
          />
          <StatCard
            label={t("dashboard.total_liabilities")}
            value={liabilityDisplay}
            sub="Committed to active streams"
          />
          <StatCard
            label={t("dashboard.active_streams")}
            value={activeStreamsCount ?? 0}
            sub={`${activeStreamsCount ?? 0} running right now`}
          />
        </div>

        {/* ── Network topology ─────────────────────────────────────── */}
        <div className="mb-8 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-white">
                Network Topology
              </h2>
              <p className="text-[11px] text-neutral-600 mt-0.5">
                Live stream visualisation across your treasury
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              <span className="text-[10px] font-mono text-neutral-600">
                LIVE
              </span>
            </div>
          </div>
          <StreamVisualizer
            streams={activeStreams}
            treasuryBalance={treasuryDisplay}
          />
        </div>

        {/* ── Streams section ──────────────────────────────────────── */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-white">
                {t("dashboard.active_streams")}
              </h2>
              <p className="text-[11px] text-neutral-600 mt-0.5">
                {activeStreamsCount} active payroll streams
              </p>
            </div>
          </div>

          {activeStreams.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-10">
              <EmptyState
                title={t("dashboard.no_streams_title")}
                description={t("dashboard.no_streams_description")}
                variant="streams"
                actionLabel={t("dashboard.create_new_stream")}
                onAction={() => void navigate("/create-stream")}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeStreams.map((stream) => (
                <StreamRow
                  key={stream.id}
                  stream={stream}
                  onClick={() => void navigate(`/stream/${stream.id}`)}
                  onPauseResume={() =>
                    queueAction(
                      stream,
                      stream.status === "paused" ? "resume" : "pause",
                    )
                  }
                  onCancel={() => setStreamToCancel(stream)}
                  actionLabel={(action) => getActionLabel(stream, action)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cancel modal */}
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
    </>
  );
};

export default EmployerDashboard;
