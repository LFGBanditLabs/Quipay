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
    <div className="stream-progress-card">
      <div className="stream-progress-card-header">
        <span className="stream-progress-card-title">{employerName}</span>
        <span
          className={`stream-progress-card-status ${
            isComplete ? "stream-progress-card-status--complete" : ""
          }`}
        >
          {isComplete ? "Complete" : tokenSymbol}
        </span>
      </div>

      <div className="stream-progress-bar">
        <div
          className={`stream-progress-fill ${
            isComplete ? "stream-progress-fill--complete" : ""
          }`}
          style={{
            width: `${pct}%`,
            animation: isComplete ? "none" : undefined,
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
