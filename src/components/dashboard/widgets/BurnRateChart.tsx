import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { month: "Oct", burn: 12400 },
  { month: "Nov", burn: 15200 },
  { month: "Dec", burn: 11800 },
  { month: "Jan", burn: 17600 },
  { month: "Feb", burn: 14200 },
  { month: "Mar", burn: 16100 },
];

export default function BurnRateChart() {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/60">Last 6 months</p>
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
          ↑ 13.4%
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f87171" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
          />
          <XAxis
            dataKey="month"
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(17,17,27,0.9)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
            }}
            formatter={(v: number | undefined) => [
              `$${(v ?? 0).toLocaleString()}`,
              "Burn",
            ]}
          />
          <Area
            type="monotone"
            dataKey="burn"
            stroke="#f87171"
            strokeWidth={2}
            fill="url(#burnGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
