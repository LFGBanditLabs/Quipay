import { useMemo, useState } from "react";
import { Button, Layout, Text } from "@stellar/design-system";
import { Link, useNavigate } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePayroll, type Stream } from "../hooks/usePayroll";
import { useTheme } from "../providers/ThemeProvider";

const MAX_SELECTED = 4;
const MIN_SELECTED = 2;

const STATUS_STYLES: Record<
  Stream["status"],
  { badge: string; border: string; text: string; strokeDasharray?: string }
> = {
  active: {
    badge: "bg-emerald-500/15 text-emerald-300",
    border: "border-emerald-500/25",
    text: "text-emerald-300",
  },
  completed: {
    badge: "bg-sky-500/15 text-sky-300",
    border: "border-sky-500/25",
    text: "text-sky-300",
    strokeDasharray: "3 2",
  },
  cancelled: {
    badge: "bg-rose-500/15 text-rose-300",
    border: "border-rose-500/25",
    text: "text-rose-300",
    strokeDasharray: "6 3",
  },
};

const CHART_COLORS = ["#38bdf8", "#6366f1", "#10b981", "#f97316"];

function toNumber(value: string): number {
  return Number.parseFloat(value) || 0;
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getProgress(stream: Stream): number {
  const totalAmount = toNumber(stream.totalAmount);
  const totalStreamed = toNumber(stream.totalStreamed);
  if (totalAmount <= 0) {
    return 0;
  }

  return clampPercentage((totalStreamed / totalAmount) * 100);
}

function buildTimelineData(streams: Stream[]) {
  const checkpoints = [0, 25, 50, 75, 100];

  return checkpoints.map((checkpoint) => {
    const row: Record<string, string | number> = {
      checkpoint: `${checkpoint}%`,
    };

    for (const stream of streams) {
      const totalAmount = toNumber(stream.totalAmount);
      const currentAmount = toNumber(stream.totalStreamed);
      const currentProgress = getProgress(stream);

      if (stream.status === "cancelled" && checkpoint > currentProgress) {
        row[stream.id] = currentAmount;
        continue;
      }

      row[stream.id] = Number(
        ((totalAmount * Math.min(checkpoint, 100)) / 100).toFixed(2),
      );
    }

    return row;
  });
}

const StreamComparison: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { streams, isLoading } = usePayroll();
  const [selectedIds, setSelectedIds] = useState<string[]>(["1", "2", "3"]);

  const selectedStreams = useMemo(
    () => streams.filter((stream) => selectedIds.includes(stream.id)),
    [selectedIds, streams],
  );

  const timelineData = useMemo(
    () => buildTimelineData(selectedStreams),
    [selectedStreams],
  );

  const palette =
    theme === "dark"
      ? {
          page: "bg-[linear-gradient(180deg,#08111f_0%,#0f172a_42%,#111827_100%)] text-slate-100",
          surface: "bg-white/5 border-white/10",
          subtle: "text-slate-400",
          tooltip: {
            background: "#0f172a",
            border: "1px solid rgba(148,163,184,0.2)",
            color: "#e2e8f0",
          },
          axis: "#94a3b8",
          grid: "rgba(148,163,184,0.14)",
        }
      : {
          page: "bg-[linear-gradient(180deg,#f7fbff_0%,#eef4ff_42%,#fefefe_100%)] text-slate-900",
          surface: "bg-white/80 border-slate-200/80",
          subtle: "text-slate-500",
          tooltip: {
            background: "#ffffff",
            border: "1px solid rgba(148,163,184,0.35)",
            color: "#0f172a",
          },
          axis: "#64748b",
          grid: "rgba(148,163,184,0.24)",
        };

  const toggleSelection = (streamId: string) => {
    setSelectedIds((current) => {
      if (current.includes(streamId)) {
        return current.length <= MIN_SELECTED
          ? current
          : current.filter((id) => id !== streamId);
      }

      if (current.length >= MAX_SELECTED) {
        return current;
      }

      return [...current, streamId];
    });
  };

  return (
    <Layout.Content>
      <Layout.Inset>
        <div
          className={`min-h-screen rounded-[32px] px-6 py-8 ${palette.page}`}
        >
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Text as="h1" size="xl" weight="medium">
                  Stream Comparison
                </Text>
                <p className={`mt-2 max-w-[720px] text-sm ${palette.subtle}`}>
                  Compare up to four payroll streams across amount, progress,
                  remaining balance, rate, and lifecycle status on a shared
                  timeline.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigate("/dashboard");
                  }}
                >
                  Back to dashboard
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    void navigate("/create-stream");
                  }}
                >
                  Create stream
                </Button>
              </div>
            </div>

            <section
              className={`mb-6 rounded-[24px] border p-5 backdrop-blur ${palette.surface}`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Text as="h2" size="lg" weight="medium">
                  Select Streams
                </Text>
                <p className={`text-sm ${palette.subtle}`}>
                  Choose {MIN_SELECTED}-{MAX_SELECTED} streams. Selected:{" "}
                  {selectedIds.length}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {streams.map((stream) => {
                  const checked = selectedIds.includes(stream.id);
                  const statusStyle = STATUS_STYLES[stream.status];

                  return (
                    <label
                      key={stream.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                        checked
                          ? `${statusStyle.border} bg-white/8 shadow-[0_12px_24px_-20px_rgba(0,0,0,0.4)]`
                          : palette.surface
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checked}
                        onChange={() => toggleSelection(stream.id)}
                        aria-label={`Select ${stream.employeeName} for comparison`}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {stream.employeeName}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusStyle.badge}`}
                          >
                            {stream.status}
                          </span>
                        </div>
                        <p
                          className={`mt-1 truncate text-xs ${palette.subtle}`}
                        >
                          {stream.employeeAddress}
                        </p>
                        <p className="mt-2 text-sm font-medium">
                          {stream.totalAmount} {stream.tokenSymbol}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {selectedStreams.map((stream, index) => {
                const totalAmount = toNumber(stream.totalAmount);
                const totalStreamed = toNumber(stream.totalStreamed);
                const progress = getProgress(stream);
                const remaining = Math.max(0, totalAmount - totalStreamed);
                const statusStyle = STATUS_STYLES[stream.status];

                return (
                  <article
                    key={stream.id}
                    className={`rounded-[24px] border p-5 backdrop-blur ${palette.surface} ${statusStyle.border}`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">
                          {stream.employeeName}
                        </p>
                        <p className={`text-xs ${palette.subtle}`}>
                          {stream.employeeAddress}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusStyle.badge}`}
                      >
                        {stream.status}
                      </span>
                    </div>

                    <div
                      className="mb-4 h-2 overflow-hidden rounded-full bg-black/10"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{
                          width: `${progress}%`,
                          backgroundColor:
                            CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                    </div>

                    <dl className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className={palette.subtle}>Total amount</dt>
                        <dd className="font-semibold">
                          {stream.totalAmount} {stream.tokenSymbol}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className={palette.subtle}>Progress</dt>
                        <dd className={`font-semibold ${statusStyle.text}`}>
                          {progress.toFixed(1)}%
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className={palette.subtle}>Remaining</dt>
                        <dd className="font-semibold">
                          {remaining.toFixed(2)} {stream.tokenSymbol}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className={palette.subtle}>Per-second rate</dt>
                        <dd className="font-semibold">
                          {stream.flowRate} {stream.tokenSymbol}/sec
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className={palette.subtle}>Window</dt>
                        <dd className="text-right font-medium">
                          {stream.startDate}
                          <br />
                          {stream.endDate}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </section>

            <section
              className={`rounded-[24px] border p-5 backdrop-blur ${palette.surface}`}
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Text as="h2" size="lg" weight="medium">
                    Shared Timeline Overlay
                  </Text>
                  <p className={`mt-1 text-sm ${palette.subtle}`}>
                    All selected streams plotted against the same normalized
                    timeline to show cost and completion divergence.
                  </p>
                </div>
                <Link
                  className="text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                  to="/analytics"
                >
                  Open full analytics
                </Link>
              </div>

              <div className="h-[360px]">
                {isLoading ? (
                  <div
                    className={`flex h-full items-center justify-center ${palette.subtle}`}
                  >
                    Loading stream portfolio...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <CartesianGrid
                        stroke={palette.grid}
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="checkpoint"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: palette.axis, fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: palette.axis, fontSize: 12 }}
                        tickFormatter={(value: number) => `${value.toFixed(0)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: palette.tooltip.background,
                          border: palette.tooltip.border,
                          color: palette.tooltip.color,
                          borderRadius: "0.9rem",
                        }}
                        formatter={(value, name) => {
                          const stream = selectedStreams.find(
                            (item) => item.id === name,
                          );
                          const label = stream
                            ? `${stream.employeeName} (${stream.tokenSymbol})`
                            : name;
                          return [`${Number(value ?? 0).toFixed(2)}`, label];
                        }}
                      />
                      <Legend
                        formatter={(value) =>
                          selectedStreams.find((item) => item.id === value)
                            ?.employeeName || value
                        }
                      />
                      {selectedStreams.map((stream, index) => (
                        <Line
                          key={stream.id}
                          type="monotone"
                          dataKey={stream.id}
                          stroke={CHART_COLORS[index % CHART_COLORS.length]}
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          activeDot={{ r: 6 }}
                          strokeDasharray={
                            STATUS_STYLES[stream.status].strokeDasharray
                          }
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>
        </div>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default StreamComparison;
