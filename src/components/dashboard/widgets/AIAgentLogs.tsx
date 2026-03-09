const LOGS = [
  {
    id: 1,
    time: "18:12",
    level: "info",
    msg: "Disbursed 500 XLM to alice.stellar",
  },
  {
    id: 2,
    time: "17:55",
    level: "warn",
    msg: "Retry #2 for failed delivery job #88",
  },
  {
    id: 3,
    time: "17:31",
    level: "info",
    msg: "Treasury rebalance triggered automatically",
  },
  {
    id: 4,
    time: "17:04",
    level: "error",
    msg: "Job #72 moved to DLQ after 3 retries",
  },
  {
    id: 5,
    time: "16:50",
    level: "info",
    msg: "New stream created for dave.stellar",
  },
];

const levelStyles: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

export default function AIAgentLogs() {
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-auto font-mono text-xs">
      {LOGS.map((log) => (
        <div key={log.id} className="flex gap-2 rounded bg-white/5 px-2 py-1">
          <span className="shrink-0 text-white/30">{log.time}</span>
          <span
            className={`w-10 shrink-0 font-bold uppercase ${levelStyles[log.level]}`}
          >
            {log.level}
          </span>
          <span className="text-white/80">{log.msg}</span>
        </div>
      ))}
    </div>
  );
}
