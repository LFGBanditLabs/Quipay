import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import {
  useRealTimeEarnings,
  StreamEarning,
} from "../hooks/useRealTimeEarnings";
import { WorkerStream } from "../hooks/useStreams";
import { formatTokenAmount } from "../util/tokenDecimals";

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
  const { t } = useTranslation();
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
    <div className="relative mb-8 flex flex-col gap-8 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow)] dark:bg-[rgba(var(--surface-rgb),0.03)] dark:backdrop-blur-[20px]">
      <div className="z-[1] flex items-center justify-between max-[992px]:flex-col max-[992px]:items-start max-[992px]:gap-8">
        <div className="flex flex-col">
          <span className="mb-2 text-sm uppercase tracking-[0.1em] text-[var(--muted)]">
            {t("earnings.realtime_total")}
          </span>
          <div className="text-[3.5rem] font-extrabold leading-none text-[var(--text)] max-[992px]:text-[2.5rem]">
            {formatTokenAmount(earnings.totalEarned, activeToken)}
            <span className="ml-2 text-2xl font-normal text-[var(--text)]/80">
              {activeToken}
            </span>
          </div>
          <div className="mt-4 inline-flex w-fit items-center gap-2 rounded-[20px] bg-[rgba(16,185,129,0.1)] px-3 py-1 text-sm text-emerald-500">
            <div className="h-2 w-2 rounded-full bg-emerald-500 [animation:pulse_2s_infinite]"></div>
            {earnings.activeStreamsCount}{" "}
            {earnings.activeStreamsCount === 1
              ? t("earnings.active_stream")
              : t("earnings.active_streams")}
          </div>
        </div>

        <div className="flex min-h-[200px] flex-1 justify-end max-[992px]:w-full max-[992px]:justify-center">
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
                  {chartData.map(
                    (
                      entry: { name: string; value: number; symbol: string },
                      index: number,
                    ) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={COLORS[index % COLORS.length]}
                        stroke="none"
                      />
                    ),
                  )}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--text)",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "var(--text)" }}
                  formatter={(value: number | string | undefined) => [
                    typeof value === "number"
                      ? formatTokenAmount(value, activeToken)
                      : value || "",
                    t("earnings.earned"),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center text-sm text-[var(--muted)]">
              {t("earnings.waiting_for_earnings")}
            </div>
          )}
        </div>
      </div>

      <div className="z-[1] grid grid-cols-3 gap-6 max-[768px]:grid-cols-1">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] transition-all hover:-translate-y-[5px] hover:bg-[var(--bg)] dark:bg-[rgba(var(--surface-rgb),0.03)]">
          <div className="mb-2 text-sm uppercase tracking-[0.1em] text-[var(--muted)]">
            {t("earnings.current_flow_rate")}
          </div>
          <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold text-emerald-500">
            +{formatTokenAmount(earnings.hourlyRate / 3600, activeToken, 5)}{" "}
            <span style={{ fontSize: "0.75rem" }}>{activeToken}/s</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] transition-all hover:-translate-y-[5px] hover:bg-[var(--bg)] dark:bg-[rgba(var(--surface-rgb),0.03)]">
          <div className="mb-2 text-sm uppercase tracking-[0.1em] text-[var(--muted)]">
            {t("earnings.one_hour_projection")}
          </div>
          <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold text-[var(--accent)]">
            {formatTokenAmount(earnings.projectedOneHour, activeToken)}{" "}
            <span style={{ fontSize: "0.75rem" }}>{activeToken}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] transition-all hover:-translate-y-[5px] hover:bg-[var(--bg)] dark:bg-[rgba(var(--surface-rgb),0.03)]">
          <div className="mb-2 text-sm uppercase tracking-[0.1em] text-[var(--muted)]">
            {t("earnings.twenty_four_hour_projection")}
          </div>
          <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold text-[var(--accent)]">
            {formatTokenAmount(earnings.projectedTwentyFourHours, activeToken)}{" "}
            <span style={{ fontSize: "0.75rem" }}>{activeToken}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
