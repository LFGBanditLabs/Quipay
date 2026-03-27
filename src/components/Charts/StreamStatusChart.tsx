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

const COLORS = ["#10b981", "#f59e0b", "#ef4444"];

export function StreamStatusChart({ data }: { data: Datapoint[] }) {
  const { theme } = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0);
  const axisColor = theme === "dark" ? "#94a3b8" : "#64748b";
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
