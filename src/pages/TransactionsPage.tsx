import { useMemo, useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { useStreams } from "../hooks/useStreams";
import { SeoHelmet } from "../components/seo/SeoHelmet";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

interface BackendWithdrawal {
  id: number;
  worker_address: string;
  employer_address: string | null;
  stream_id: string;
  amount: string;
  token_symbol: string;
  tx_hash: string;
  created_at: string;
}

// Unified row shape for the table
interface TxRow {
  key: string;
  date: string;
  amount: string;
  tokenSymbol: string;
  streamId: string;
  employerAddress: string | null;
  txHash: string;
}

export default function TransactionsPage() {
  const { address } = useWallet();
  const {
    streams,
    withdrawalHistory,
    isLoading: streamsLoading,
  } = useStreams(address);

  const [backendRows, setBackendRows] = useState<BackendWithdrawal[]>([]);
  const [backendLoading, setBackendLoading] = useState(false);
  const [filter, setFilter] = useState("");

  // Fetch all-time history from backend DB
  useEffect(() => {
    if (!address || !API_BASE) return;
    void (async () => {
      setBackendLoading(true);
      try {
        const r = await fetch(
          `${API_BASE}/api/employers/withdrawal-events?address=${encodeURIComponent(address)}`,
        );
        const d = (await r.json()) as { withdrawals?: BackendWithdrawal[] };
        setBackendRows(d.withdrawals ?? []);
      } catch {
        setBackendRows([]);
      } finally {
        setBackendLoading(false);
      }
    })();
  }, [address]);

  // Merge: backend rows are primary (persistent), on-chain events fill in anything not yet saved
  const merged = useMemo((): TxRow[] => {
    const backendHashes = new Set(backendRows.map((r) => r.tx_hash));

    // Backend rows (already newest-first from the query)
    const fromBackend: TxRow[] = backendRows.map((r) => ({
      key: r.tx_hash,
      date: new Date(r.created_at).toLocaleString(),
      amount: r.amount,
      tokenSymbol: r.token_symbol,
      streamId: r.stream_id,
      employerAddress: r.employer_address,
      txHash: r.tx_hash,
    }));

    // On-chain events not yet in backend (e.g., just happened this session before POST saved)
    const fromChain: TxRow[] = [...withdrawalHistory]
      .reverse()
      .filter((r) => !backendHashes.has(r.txHash))
      .map((r) => ({
        key: r.txHash,
        date: r.date,
        amount: r.amount,
        tokenSymbol: r.tokenSymbol,
        streamId: r.streamId,
        employerAddress: null,
        txHash: r.txHash,
      }));

    return [...fromChain, ...fromBackend];
  }, [backendRows, withdrawalHistory]);

  // streamId → employer display name
  const streamMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of streams) {
      m.set(
        s.id,
        s.employerName !== s.employerAddress
          ? s.employerName
          : shortAddr(s.employerAddress),
      );
    }
    return m;
  }, [streams]);

  const isLoading = streamsLoading || backendLoading;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter(
      (r) =>
        r.date.toLowerCase().includes(q) ||
        r.amount.includes(q) ||
        r.tokenSymbol.toLowerCase().includes(q) ||
        r.streamId.includes(q) ||
        r.txHash.toLowerCase().includes(q) ||
        (r.employerAddress ?? "").toLowerCase().includes(q) ||
        (streamMap.get(r.streamId) ?? "").toLowerCase().includes(q),
    );
  }, [merged, filter, streamMap]);

  const totalWithdrawn = useMemo(
    () => merged.reduce((sum, r) => sum + parseFloat(r.amount), 0),
    [merged],
  );

  const byToken = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of merged) {
      m.set(r.tokenSymbol, (m.get(r.tokenSymbol) ?? 0) + parseFloat(r.amount));
    }
    return [...m.entries()];
  }, [merged]);

  // ── No wallet ──────────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10">
          <svg
            className="h-8 w-8 text-yellow-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        </div>
        <h2 className="text-[20px] font-bold text-white mb-2">
          Connect your wallet
        </h2>
        <p className="text-[14px] text-neutral-500">
          Connect to view your transaction history.
        </p>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 h-8 w-44 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
        <div className="h-10 animate-pulse rounded-xl bg-white/[0.04] mb-4" />
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <>
      <SeoHelmet
        title="Transactions · Quipay"
        description="Your withdrawal transaction history."
        path="/transactions"
        robots="noindex,nofollow"
      />

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Transactions
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            All withdrawal transactions across your streams.
          </p>
        </div>

        {/* Summary strip */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
              Total Withdrawn
            </p>
            <p className="text-[26px] font-black" style={{ color: "#facc15" }}>
              {totalWithdrawn.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}
            </p>
            <p className="text-[11px] text-neutral-600 mt-0.5">all time</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
              Transactions
            </p>
            <p className="text-[26px] font-black text-white">
              {withdrawalHistory.length}
            </p>
            <p className="text-[11px] text-neutral-600 mt-0.5">
              on-chain events
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
              By Token
            </p>
            {byToken.length === 0 ? (
              <p className="text-[14px] text-neutral-600">—</p>
            ) : (
              <div className="flex flex-col gap-1">
                {byToken.map(([token, amount]) => (
                  <div
                    key={token}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[12px] font-bold text-neutral-400">
                      {token}
                    </span>
                    <span className="font-mono text-[13px] font-bold text-white">
                      {amount.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by date, amount, token, stream, or tx hash…"
            className="w-full rounded-xl border border-white/[0.1] bg-[#0a0a0a] pl-10 pr-4 py-3 text-[14px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-yellow-400/40 focus:ring-1 focus:ring-yellow-400/20 transition-colors"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Result count when filtering */}
        {filter.trim() && (
          <p className="mb-3 text-[13px] text-neutral-600">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "
            {filter}"
          </p>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
                <svg
                  className="h-7 w-7 text-neutral-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="text-[15px] font-bold text-white mb-1">
                {filter ? "No matching transactions" : "No transactions yet"}
              </p>
              <p className="text-[13px] text-neutral-600">
                {filter
                  ? "Try a different search term."
                  : "Your withdrawal history will appear here after your first withdrawal."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-600">
                      Date
                    </th>
                    <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-600">
                      Amount
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-600 hidden md:table-cell">
                      Employer
                    </th>
                    <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-600 hidden sm:table-cell">
                      Stream
                    </th>
                    <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-600">
                      Transaction
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rec) => {
                    const employerName =
                      streamMap.get(rec.streamId) ??
                      (rec.employerAddress
                        ? shortAddr(rec.employerAddress)
                        : "—");
                    return (
                      <tr
                        key={rec.key}
                        className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-4 text-[13px] text-neutral-400 whitespace-nowrap">
                          {rec.date}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <span className="text-[14px] font-bold text-white">
                            {parseFloat(rec.amount).toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                          </span>
                          <span className="ml-1.5 text-[11px] font-semibold text-neutral-500">
                            {rec.tokenSymbol}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[13px] text-neutral-400 hidden md:table-cell max-w-[160px]">
                          <span className="truncate block">{employerName}</span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-[12px] text-neutral-600 hidden sm:table-cell whitespace-nowrap">
                          #{rec.streamId}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${rec.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-yellow-400/60 hover:text-yellow-400 transition-colors whitespace-nowrap"
                            title={rec.txHash}
                          >
                            {rec.txHash.slice(0, 8)}…{rec.txHash.slice(-6)}
                            <svg
                              className="h-3 w-3 shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
