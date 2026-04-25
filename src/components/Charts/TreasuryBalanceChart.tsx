import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "../../providers/ThemeProvider";

interface Datapoint {
  month: string;
  balance: number;
  payouts: number;
}

export function TreasuryBalanceChart({ data }: { data: Datapoint[] }) {
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
      <AreaChart
        data={data}
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="tbc-balance" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--token-color-success-500)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--token-color-success-500)"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
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
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [
            `$${Number(value ?? 0).toLocaleString()} USDC`,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: "0.8rem", color: axisColor }} />
        <Area
          type="monotone"
          dataKey="balance"
          name="Balance"
          stroke="var(--token-color-success-500)"
          strokeWidth={2}
          fill="url(#tbc-balance)"
        />
        <Area
          type="monotone"
          dataKey="payouts"
          name="Payouts"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="none"
          strokeDasharray="4 4"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
