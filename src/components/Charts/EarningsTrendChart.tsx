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

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

interface Props {
  data: Record<string, string | number>[];
  employees: string[];
}

export function EarningsTrendChart({ data, employees }: Props) {
  const { theme } = useTheme();
  const axisColor = theme === "dark" ? "#94a3b8" : "#64748b";
  const gridColor =
    theme === "dark" ? "rgba(99,102,241,0.1)" : "rgba(71,85,105,0.18)";
  const tooltipStyle = {
    backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
    border:
      theme === "dark"
        ? "1px solid rgba(99,102,241,0.2)"
        : "1px solid rgba(148,163,184,0.4)",
    borderRadius: "0.75rem",
    color: theme === "dark" ? "#e2e8f0" : "#0f172a",
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
