import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "../../providers/ThemeProvider";

interface Datapoint {
  name: string;
  value: number;
}

const COLORS = [
  "var(--token-color-success-500)",
  "var(--token-color-warning-500)",
  "var(--token-color-error-500)",
];

export function StreamStatusChart({ data }: { data: Datapoint[] }) {
  const { theme } = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0);
  const axisColor =
    theme === "dark"
      ? "var(--token-color-neutral-300)"
      : "var(--token-color-neutral-700)";
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
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={65}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [
            `${Number(value ?? 0)} (${total > 0 ? ((Number(value ?? 0) / total) * 100).toFixed(1) : 0}%)`,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: "0.8rem", color: axisColor }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
