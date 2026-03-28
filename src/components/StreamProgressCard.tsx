import React from "react";
import "./StreamProgress.css";
import {
  StreamTickSnapshot,
  formatEarned,
  flowRateToHourly,
} from "../hooks/useStreamTicker";

interface StreamProgressCardProps {
  snapshot: StreamTickSnapshot;
}

/**
 * Displays a single stream's real-time progress.
 *
 * Renders an animated fill bar (from StreamProgress.css), the earned amount
 * that ticks up on every render, and a per-hour rate label. The bar stops
 * animating when the stream is complete.
 */
const StreamProgressCard: React.FC<StreamProgressCardProps> = ({
  snapshot,
}) => {
  const {
    employerName,
    tokenSymbol,
    earned,
    totalAmount,
    flowRate,
    progress,
    isComplete,
  } = snapshot;

  const pct = Math.min(progress * 100, 100);
  const hourlyRate = flowRateToHourly(flowRate);

  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--sds-color-neutral-border, #2d2d3d)",
        background: "var(--sds-color-neutral-background, #1a1a2e)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--text, #e2e8f0)",
          }}
        >
          {employerName}
        </span>
        <span
          style={{
            fontSize: "0.75rem",
            color: isComplete ? "#10b981" : "var(--muted, #94a3b8)",
            fontWeight: isComplete ? 600 : 400,
          }}
        >
          {isComplete ? "Complete" : tokenSymbol}
        </span>
      </div>

      <div className="stream-progress-bar">
        <div
          className="stream-progress-fill"
          style={{
            width: `${pct}%`,
            animation: isComplete ? "none" : undefined,
            background: isComplete ? "#10b981" : undefined,
          }}
        />
      </div>

      <div className="stream-stats">
        <div className="stream-stat">
          <span className="stream-stat-label">Earned</span>
          <span className="stream-stat-value">
            {formatEarned(earned)} {tokenSymbol}
          </span>
        </div>
        <div className="stream-stat">
          <span className="stream-stat-label">Total</span>
          <span className="stream-stat-value">
            {formatEarned(totalAmount, 2)} {tokenSymbol}
          </span>
        </div>
        {!isComplete && (
          <div className="stream-stat">
            <span className="stream-stat-label">Rate</span>
            <span className="stream-stat-value">
              {formatEarned(hourlyRate, 4)}/hr
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamProgressCard;
