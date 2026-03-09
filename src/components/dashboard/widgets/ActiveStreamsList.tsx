const STREAMS = [
  {
    id: "s1",
    recipient: "alice.stellar",
    amount: "500 XLM/mo",
    status: "active",
  },
  { id: "s2", recipient: "bob.xlm", amount: "1,200 USDC/mo", status: "active" },
  {
    id: "s3",
    recipient: "carol.eth",
    amount: "750 XLM/mo",
    status: "paused",
  },
  {
    id: "s4",
    recipient: "dave.stellar",
    amount: "300 USDC/mo",
    status: "active",
  },
];

export default function ActiveStreamsList() {
  return (
    <div className="flex h-full flex-col gap-2 overflow-auto">
      <p className="text-sm font-medium text-white/60">
        {STREAMS.filter((s) => s.status === "active").length} active ·{" "}
        {STREAMS.length} total
      </p>
      <ul className="flex flex-col gap-1.5">
        {STREAMS.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-white">{s.recipient}</p>
              <p className="text-xs text-white/40">{s.amount}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                s.status === "active"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-yellow-500/15 text-yellow-400"
              }`}
            >
              {s.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
