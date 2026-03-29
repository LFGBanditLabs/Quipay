import React, { useMemo, useState, useEffect } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WorkerStream } from "../hooks/useStreams";
import { formatTokenAmount } from "../util/tokenDecimals";

interface EarningsForecastProps {
  streams: WorkerStream[];
}

interface ForecastPoint {
  day: number;
  label: string;
  cumulative: number;
}

interface StreamExpiry {
  id: string;
  day: number;
  label: string;
}

const DAY_SECONDS = 86400;
const HORIZONS_DAYS = [7, 30, 90] as const;

const projectedForStream = (
  stream: WorkerStream,
  nowSec: number,
  horizonSec: number,
) => {
  if (stream.flowRate <= 0 || stream.totalAmount <= 0) return 0;

  const accrualStart = Math.max(stream.startTime, stream.cliffTime);
  const streamEnd = accrualStart + stream.totalAmount / stream.flowRate;

  const rangeStart = Math.max(nowSec, accrualStart);
  const rangeEnd = Math.min(nowSec + horizonSec, streamEnd);

  if (rangeEnd <= rangeStart) return 0;
  return (rangeEnd - rangeStart) * stream.flowRate;
};

const buildProjectionPoints = (streams: WorkerStream[], nowSec: number) => {
  const points: ForecastPoint[] = [];

  for (let day = 0; day <= 90; day += 1) {
    const horizonSec = day * DAY_SECONDS;
    const cumulative = streams.reduce(
      (sum, stream) => sum + projectedForStream(stream, nowSec, horizonSec),
      0,
    );

    points.push({
      day,
      label: `Day ${day}`,
      cumulative,
    });
  }

  return points;
};

const buildExpiryMarkers = (streams: WorkerStream[], nowSec: number) => {
  return streams
    .map((stream): StreamExpiry | null => {
      if (stream.flowRate <= 0 || stream.totalAmount <= 0) return null;

      const accrualStart = Math.max(stream.startTime, stream.cliffTime);
      const streamEnd = accrualStart + stream.totalAmount / stream.flowRate;
      const day = (streamEnd - nowSec) / DAY_SECONDS;

      if (day <= 0 || day > 90) return null;

      return {
        id: stream.id,
        day,
        label: `S${stream.id}`,
      };
    })
    .filter((marker): marker is StreamExpiry => marker !== null);
};

export const EarningsForecast: React.FC<EarningsForecastProps> = ({
  streams,
}) => {
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Date.now() / 1000);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const activeStreams = useMemo(
    () => streams.filter((stream) => stream.status === 0),
    [streams],
  );

  const activeToken = activeStreams[0]?.tokenSymbol ?? "USDC";

  const chartData = useMemo(
    () => buildProjectionPoints(activeStreams, nowSec),
    [activeStreams, nowSec],
  );

  const expiryMarkers = useMemo(
    () => buildExpiryMarkers(activeStreams, nowSec),
    [activeStreams, nowSec],
  );

  const projection7d = useMemo(
    () =>
      activeStreams.reduce(
        (sum, s) => sum + projectedForStream(s, nowSec, 7 * DAY_SECONDS),
        0,
      ),
    [activeStreams, nowSec],
  );
  const projection30d = useMemo(
    () =>
      activeStreams.reduce(
        (sum, s) => sum + projectedForStream(s, nowSec, 30 * DAY_SECONDS),
        0,
      ),
    [activeStreams, nowSec],
  );
  const projection90d = useMemo(
    () =>
      activeStreams.reduce(
        (sum, s) => sum + projectedForStream(s, nowSec, 90 * DAY_SECONDS),
        0,
      ),
    [activeStreams, nowSec],
  );

  if (activeStreams.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-6">
        <h3 className="text-lg font-semibold text-[var(--text)]">
          Earnings Forecast
        </h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          No active streams available for projection.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-[var(--text)]">
            Earnings Forecast
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Projected additional earnings from active streams over the next 90
            days.
          </p>
        </div>
        <div className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
          Live
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4 max-[768px]:grid-cols-1">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            7 Days
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--text)]">
            {formatTokenAmount(projection7d, activeToken)} {activeToken}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            30 Days
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--text)]">
            {formatTokenAmount(projection30d, activeToken)} {activeToken}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            90 Days
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--text)]">
            {formatTokenAmount(projection90d, activeToken)} {activeToken}
          </div>
        </div>
      </div>

      <div
        className="h-[320px] w-full"
        aria-label="Cumulative earnings projection chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              type="number"
              domain={[0, 90]}
              ticks={[0, 7, 30, 60, 90]}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              tickFormatter={(value) => `D${value}`}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              tickFormatter={(value: number) =>
                `${formatTokenAmount(value, activeToken, 2)}`
              }
            />
            <Tooltip
              formatter={(value: number | string | undefined) => [
                typeof value === "number"
                  ? `${formatTokenAmount(value, activeToken)} ${activeToken}`
                  : (value ?? ""),
                "Projected cumulative",
              ]}
              labelFormatter={(value) => `Day ${value}`}
              contentStyle={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                color: "var(--text)",
              }}
            />
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke="var(--accent)"
              strokeWidth={3}
              dot={false}
              name="Projected cumulative"
            />
            {expiryMarkers.map((marker) => (
              <ReferenceLine
                key={marker.id}
                x={marker.day}
                stroke="rgba(245, 158, 11, 0.7)"
                strokeDasharray="4 4"
                label={{
                  value: marker.label,
                  position: "insideTopRight",
                  fill: "rgba(245, 158, 11, 0.9)",
                  fontSize: 10,
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 overflow-auto rounded-xl border border-[var(--border)]">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Cumulative earnings forecast table for the next 90 days.
          </caption>
          <thead>
            <tr>
              <th className="bg-[var(--surface-subtle)] p-3 text-left font-medium text-[var(--muted)]">
                Horizon
              </th>
              <th className="bg-[var(--surface-subtle)] p-3 text-left font-medium text-[var(--muted)]">
                Projected Additional Earnings
              </th>
            </tr>
          </thead>
          <tbody>
            {HORIZONS_DAYS.map((day) => {
              const row = chartData[day];
              return (
                <tr
                  key={day}
                  className="[&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-[var(--border)]"
                >
                  <td className="p-3">Day {day}</td>
                  <td className="p-3 font-semibold">
                    {formatTokenAmount(row?.cumulative ?? 0, activeToken)}{" "}
                    {activeToken}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
