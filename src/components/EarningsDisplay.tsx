import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  useRealTimeEarnings,
  StreamEarning,
} from "../hooks/useRealTimeEarnings";
import { WorkerStream } from "../hooks/useStreams";
import styles from "./EarningsDisplay.module.css";

interface EarningsDisplayProps {
  streams: WorkerStream[];
}

const COLORS = [
  "#4f46e5",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

export const EarningsDisplay: React.FC<EarningsDisplayProps> = ({
  streams,
}) => {
  const earnings = useRealTimeEarnings(streams);

  const chartData = useMemo(() => {
    return earnings.streamEarned
      .filter((s: StreamEarning) => s.earned > 0)
      .map((s: StreamEarning) => ({
        name: s.name,
        value: s.earned,
        symbol: s.symbol,
      }));
  }, [earnings.streamEarned]);

  const activeToken = streams[0]?.tokenSymbol || "USDC";

  return (
    <div className={styles.container}>
      <div className={styles.mainSection}>
        <div className={styles.totalEarningsWrapper}>
          <span className={styles.label}>Real-time Total Earnings</span>
          <div className={styles.amount}>
            {earnings.totalEarned.toFixed(7)}
            <span className={styles.symbol}>{activeToken}</span>
          </div>
          <div className={styles.activeStreams}>
            <div className={styles.pulseDot}></div>
            {earnings.activeStreamsCount} Active{" "}
            {earnings.activeStreamsCount === 1 ? "Stream" : "Streams"}
          </div>
        </div>

        <div className={styles.chartSection}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((_, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(value: number) => [value.toFixed(6), "Earned"]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                color: "#a5a5a5",
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
              }}
            >
              Waiting for earnings to accumulate...
            </div>
          )}
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statsCard}>
          <div className={styles.label}>Current Flow Rate</div>
          <div className={`${styles.statValue} ${styles.projectionPositive}`}>
            +{(earnings.hourlyRate / 3600).toFixed(6)}{" "}
            <span style={{ fontSize: "0.75rem" }}>{activeToken}/s</span>
          </div>
        </div>

        <div className={styles.statsCard}>
          <div className={styles.label}>1 Hour Projection</div>
          <div className={`${styles.statValue} ${styles.projectionLabel}`}>
            {earnings.projectedOneHour.toFixed(4)}{" "}
            <span style={{ fontSize: "0.75rem" }}>{activeToken}</span>
          </div>
        </div>

        <div className={styles.statsCard}>
          <div className={styles.label}>24 Hour Projection</div>
          <div className={`${styles.statValue} ${styles.projectionLabel}`}>
            {earnings.projectedTwentyFourHours.toFixed(4)}{" "}
            <span style={{ fontSize: "0.75rem" }}>{activeToken}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
