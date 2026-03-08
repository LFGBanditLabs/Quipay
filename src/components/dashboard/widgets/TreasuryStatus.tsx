const METRICS = [
  { label: "Total Balance", value: "$248,500", change: "+2.1%", up: true },
  { label: "Locked Escrow", value: "$64,200", change: "-0.8%", up: false },
  { label: "Available", value: "$184,300", change: "+4.3%", up: true },
  { label: "Runway", value: "18 months", change: "stable", up: true },
];

export default function TreasuryStatus() {
  return (
    <div className="grid h-full grid-cols-2 gap-2">
      {METRICS.map((m) => (
        <div
          key={m.label}
          className="flex flex-col justify-between rounded-xl bg-white/5 p-3"
        >
          <p className="text-xs font-medium text-white/50">{m.label}</p>
          <div>
            <p className="text-lg font-bold text-white">{m.value}</p>
            <p
              className={`text-xs font-semibold ${m.up ? "text-emerald-400" : "text-red-400"}`}
            >
              {m.change}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
