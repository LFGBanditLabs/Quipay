import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "../../providers/ThemeProvider";

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#06b6d4",
  "var(--token-color-success-500)",
  "var(--token-color-warning-500)",
];

interface Props {
  data: Record<string, string | number>[];
  employees: string[];
}

export function EarningsTrendChart({ data, employees }: Props) {
  const { theme } = useTheme();
  const axisColor =
    theme === "dark"
      ? "var(--token-color-neutral-300)"
      : "var(--token-color-neutral-700)";
  const gridColor =
    theme === "dark"
      ? "var(--token-color-accent-soft)"
      : "var(--token-color-border-default)";
  const tooltipStyle = {
    backgroundColor:
      theme === "dark"
        ? "var(--token-color-neutral-0)"
        : "var(--token-color-bg-surface)",
    border:
      theme === "dark"
        ? "1px solid var(--token-color-accent-soft-strong)"
        : "1px solid var(--token-color-border-default)",
    borderRadius: "0.75rem",
    color:
      theme === "dark"
        ? "var(--token-color-neutral-900)"
        : "var(--token-color-text-primary)",
    fontSize: "0.8rem",
  };

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={gridColor}
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fill: axisColor, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: axisColor, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [
            `$${Number(value ?? 0).toLocaleString()} USDC`,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: "0.8rem", color: axisColor }} />
        {employees.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ fill: COLORS[i % COLORS.length], r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
