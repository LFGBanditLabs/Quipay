/**
 * NetworkHealthMonitor.tsx
 * ───────────────────────
 * A collapsible panel that shows live health status of Stellar Horizon
 * and Soroban RPC nodes, latency history, congestion level, and ledger info.
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNetworkStatus } from "../providers/NetworkStatusProvider";
import type { RpcNodeHealth, HorizonStatus } from "../util/networkStatus";

/* ── tiny SVG icons ─────────────────────────────────────────────────────────── */

const IconRefresh = ({ spinning }: { spinning?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={spinning ? { animation: "spin 1s linear infinite" } : undefined}
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transition: "transform 0.2s",
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ── status helpers ─────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<HorizonStatus, string> = {
  online: "#10b981",
  degraded: "#f5a623",
  offline: "#ef4444",
};

const STATUS_LABELS: Record<HorizonStatus, string> = {
  online: "Healthy",
  degraded: "Degraded",
  offline: "Offline",
};

/* ── sub-components ─────────────────────────────────────────────────────────── */

function NodeStatusRow({ node }: { node: RpcNodeHealth }) {
  const color = STATUS_COLORS[node.status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderRadius: "8px",
        background: "var(--surface-subtle, rgba(255,255,255,0.03))",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 6px ${color}`,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <div>
          <div
            style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}
          >
            {node.name}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--muted)",
              marginTop: "1px",
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.url}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color }}>
          {STATUS_LABELS[node.status]}
        </div>
        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
          {node.latency}ms
        </div>
      </div>
    </div>
  );
}

function LatencySparkline({
  data,
}: {
  data: { latency: number; ts: number }[];
}) {
  if (data.length < 2) return null;

  const maxLatency = Math.max(...data.map((d) => d.latency), 100);
  const width = 200;
  const height = 36;
  const padding = 2;

  const points = data
    .map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y =
        height - padding - (d.latency / maxLatency) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const avgLatency = Math.round(
    data.reduce((s, d) => s + d.latency, 0) / data.length,
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 14px",
        borderRadius: "8px",
        background: "var(--surface-subtle, rgba(255,255,255,0.03))",
        border: "1px solid var(--border)",
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ flexShrink: 0 }}
      >
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent, #6366f1)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <div>
        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
          Avg latency
        </div>
        <div
          style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}
        >
          {avgLatency}ms
        </div>
      </div>
    </div>
  );
}

function CongestionBadge({ level, fee }: { level: string; fee: number }) {
  const config: Record<string, { bg: string; fg: string; label: string }> = {
    low: {
      bg: "rgba(16, 185, 129, 0.12)",
      fg: "#10b981",
      label: "Low",
    },
    medium: {
      bg: "rgba(245, 166, 35, 0.12)",
      fg: "#f5a623",
      label: "Medium",
    },
    high: {
      bg: "rgba(239, 68, 68, 0.12)",
      fg: "#ef4444",
      label: "High",
    },
  };

  const c = config[level] ?? config.low;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "6px",
        background: c.bg,
        color: c.fg,
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {level === "high" && "🔥 "}
      {c.label} Congestion
      <span
        style={{
          fontSize: "11px",
          fontWeight: 500,
          opacity: 0.8,
        }}
      >
        ({fee} stroops)
      </span>
    </div>
  );
}

/* ── main component ─────────────────────────────────────────────────────────── */

const NetworkHealthMonitor: React.FC = () => {
  const { t } = useTranslation();
  const {
    status,
    horizonHealth,
    sorobanHealth,
    congestion,
    minFee,
    ledgerSequence,
    protocolVersion,
    history,
    isRefreshing,
    refresh,
  } = useNetworkStatus();
  const [isOpen, setIsOpen] = useState(false);

  const latencyHistory = useMemo(
    () =>
      history.map((h) => ({
        latency: h.latency,
        ts: h.horizonHealth.lastChecked,
      })),
    [history],
  );

  const statusColor = STATUS_COLORS[status];

  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        overflow: "hidden",
        boxShadow: "var(--shadow)",
      }}
    >
      {/* Header / toggle bar */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "12px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text)",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}`,
              display: "inline-block",
            }}
          />
          {t("network_health.title", "Network Health")}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <CongestionBadge level={congestion} fee={minFee} />
          <IconChevron open={isOpen} />
        </div>
      </button>

      {/* Collapsible detail panel */}
      {isOpen && (
        <div
          style={{
            padding: "0 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {/* Node status rows */}
          <NodeStatusRow node={horizonHealth} />
          <NodeStatusRow node={sorobanHealth} />

          {/* Latency sparkline */}
          <LatencySparkline data={latencyHistory} />

          {/* Ledger info */}
          {(ledgerSequence || protocolVersion) && (
            <div
              style={{
                display: "flex",
                gap: "16px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "var(--surface-subtle, rgba(255,255,255,0.03))",
                border: "1px solid var(--border)",
                fontSize: "12px",
                color: "var(--muted)",
              }}
            >
              {ledgerSequence && (
                <span>
                  <strong style={{ color: "var(--text)" }}>Ledger:</strong> #
                  {ledgerSequence.toLocaleString()}
                </span>
              )}
              {protocolVersion && (
                <span>
                  <strong style={{ color: "var(--text)" }}>Protocol:</strong> v
                  {protocolVersion}
                </span>
              )}
            </div>
          )}

          {/* Manual refresh */}
          <button
            onClick={() => void refresh()}
            disabled={isRefreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: isRefreshing ? "wait" : "pointer",
              opacity: isRefreshing ? 0.6 : 1,
              alignSelf: "flex-end",
            }}
          >
            <IconRefresh spinning={isRefreshing} />
            {isRefreshing
              ? t("network_health.refreshing", "Refreshing…")
              : t("network_health.refresh", "Refresh")}
          </button>
        </div>
      )}

      {/* inject spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default NetworkHealthMonitor;
