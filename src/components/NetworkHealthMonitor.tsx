import React from "react";
import { useNetworkStatus } from "../providers/NetworkStatusProvider";

const toneClass: Record<string, string> = {
  online: "text-emerald-500",
  degraded: "text-amber-500",
  offline: "text-red-500",
};

export const NetworkHealthMonitor: React.FC = () => {
  const { status, horizon, sorobanRpc, congestion, minFee, issues, refresh } =
    useNetworkStatus();

  return (
    <section className="rounded-xl border border-border bg-(--surface) p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Network Health</h3>
        <button
          className="rounded-md border border-border px-2 py-1 text-xs"
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <p>
          Overall:{" "}
          <span className={toneClass[status]}>{status.toUpperCase()}</span>
        </p>
        <p>
          Congestion: <strong>{congestion}</strong> ({minFee} stroops min fee)
        </p>
        <p>
          Horizon:{" "}
          <span className={toneClass[horizon.status]}>
            {horizon.status.toUpperCase()}
          </span>{" "}
          ({horizon.latency}ms)
        </p>
        <p>
          Soroban RPC:{" "}
          <span className={toneClass[sorobanRpc.status]}>
            {sorobanRpc.status.toUpperCase()}
          </span>{" "}
          ({sorobanRpc.latency}ms)
        </p>
      </div>
      {issues.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-red-500">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default NetworkHealthMonitor;
