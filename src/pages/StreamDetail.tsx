import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStellarAccount } from "../hooks/useStellarAccount";
import {
  getStreamById,
  type ContractStream,
} from "../contracts/payroll_stream";

const STROOPS = 1e7; // USDC / XLM use 7 decimals on Stellar

const STATUS_LABEL: Record<number, { label: string; color: string }> = {
  0: { label: "Active", color: "#4ade80" },
  1: { label: "Cancelled", color: "#f87171" },
  2: { label: "Completed", color: "#a3a3a3" },
  3: { label: "Paused", color: "#facc15" },
};

const fmt = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const shortAddr = (a: string) =>
  a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

const fmtDate = (ts: number) =>
  ts > 0 ? new Date(ts * 1000).toLocaleString() : "—";

/**
 * Live view of a single payroll stream — vested/withdrawn/available amounts,
 * a progress bar, rate, and the participants. Read straight from the contract.
 */
export default function StreamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address, ready } = useStellarAccount();

  const [stream, setStream] = useState<ContractStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const src =
          address ?? "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
        const s = await getStreamById(src, BigInt(id ?? "0"));
        if (!cancelled) setStream(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, address, id]);

  // Tick every second so vested/available update live.
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="px-6 py-10 text-[14px] text-neutral-500">Loading…</div>
    );
  }

  if (!stream) {
    return (
      <div className="px-6 py-10 sm:px-8 max-w-[720px]">
        <h1 className="text-[22px] font-bold text-white">Stream not found</h1>
        <p className="mt-1 text-[14px] text-neutral-500">
          Stream #{id} doesn't exist or couldn't be loaded.
        </p>
        <button
          onClick={() => void navigate("/dashboard")}
          className="mt-5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
        >
          ← Back to dashboard
        </button>
      </div>
    );
  }

  const total = Number(stream.total_amount) / STROOPS;
  const withdrawn = Number(stream.withdrawn_amount) / STROOPS;
  const start = Number(stream.start_ts);
  const end = Number(stream.end_ts);
  const cliff = Number(stream.cliff_ts);
  const rate = Number(stream.rate) / STROOPS;

  const elapsed = Math.max(0, Math.min(now, end) - start);
  const vested = Math.min((Number(stream.rate) * elapsed) / STROOPS, total);
  const available = now >= cliff ? Math.max(0, vested - withdrawn) : 0;
  const pct = total > 0 ? Math.min(100, (vested / total) * 100) : 0;

  const status = STATUS_LABEL[stream.status] ?? {
    label: `#${stream.status}`,
    color: "#a3a3a3",
  };

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10 max-w-[720px]">
      <button
        onClick={() => void navigate(-1)}
        className="mb-5 text-[13px] font-semibold text-neutral-500 hover:text-white transition-colors"
      >
        ← Back
      </button>

      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-[24px] font-bold text-white tracking-tight">
          Stream #{id}
        </h1>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: `${status.color}1a`, color: status.color }}
        >
          {status.label}
        </span>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total", value: total },
          { label: "Vested", value: vested },
          { label: "Available now", value: available },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              {s.label}
            </p>
            <p className="mt-1 text-[20px] font-bold text-white">
              {fmt(s.value)}{" "}
              <span className="text-[12px] font-medium text-neutral-500">
                USDC
              </span>
            </p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6 mb-5">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="text-neutral-500">Streamed</span>
          <span className="font-semibold text-white">{pct.toFixed(1)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: "#facc15" }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[12px] text-neutral-500">
          <span>{fmtDate(start)}</span>
          <span>{fmtDate(end)}</span>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6">
        <div className="flex flex-col gap-3 text-[13px]">
          {[
            { label: "Worker", value: shortAddr(stream.worker) },
            { label: "Employer", value: shortAddr(stream.employer) },
            { label: "Rate", value: `${rate.toFixed(6)} USDC / sec` },
            { label: "Withdrawn", value: `${fmt(withdrawn)} USDC` },
            {
              label: "Cliff",
              value: cliff > start ? fmtDate(cliff) : "None",
            },
            { label: "Created", value: fmtDate(Number(stream.created_at)) },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4"
            >
              <span className="text-neutral-500">{row.label}</span>
              <span className="font-mono text-[12px] text-white text-right break-all">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
