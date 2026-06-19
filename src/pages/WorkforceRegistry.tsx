import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import {
  useWorkforceRegistry,
  WorkerEntry,
  WorkerStreamRecord,
} from "../hooks/useWorkforceRegistry";

/* ── Utilities ──────────────────────────────────────────────────── */

function shortAddr(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtAmount(stroopStr: string): string {
  const val = parseFloat(stroopStr) / 1e7;
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

const STELLAR_ADDR_RE = /^G[A-Z2-7]{55}$/;

/* ── Status badge ───────────────────────────────────────────────── */

function StatusBadge({ status }: { status: WorkerStreamRecord["status"] }) {
  const { t } = useTranslation();
  const map = {
    active: {
      cls: "bg-green-500/10 text-green-400 border-green-500/20",
      label: t("workforce.stream_status_active"),
    },
    completed: {
      cls: "bg-white/[0.06] text-neutral-400 border-white/[0.08]",
      label: t("workforce.stream_status_completed"),
    },
    cancelled: {
      cls: "bg-red-500/10 text-red-400 border-red-500/20",
      label: t("workforce.stream_status_cancelled"),
    },
  };
  const { cls, label } = map[status] ?? map.active;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

/* ── Stream history table ───────────────────────────────────────── */

function StreamHistoryTable({ streams }: { streams: WorkerStreamRecord[] }) {
  const { t } = useTranslation();

  if (streams.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-neutral-700">
        {t("workforce.no_streams")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {[
              t("workforce.stream_id"),
              t("workforce.amount"),
              t("workforce.start_date"),
              t("workforce.end_date"),
              "Status",
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-700"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {streams.map((s) => (
            <tr
              key={s.stream_id}
              className="border-b border-white/[0.04] last:border-0"
            >
              <td
                className="px-4 py-2.5 font-mono text-[11px]"
                style={{ color: "#facc15" }}
              >
                #{s.stream_id}
              </td>
              <td className="px-4 py-2.5 font-bold text-white">
                {fmtAmount(s.total_amount)} XLM
              </td>
              <td className="px-4 py-2.5 text-neutral-500">
                {fmtDate(s.start_ts)}
              </td>
              <td className="px-4 py-2.5 text-neutral-500">
                {fmtDate(s.end_ts)}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={s.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Worker card ────────────────────────────────────────────────── */

function WorkerCard({
  worker,
  onRemove,
}: {
  worker: WorkerEntry;
  onRemove: (address: string) => void;
}) {
  const { t } = useTranslation();
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const copyAddress = useCallback(async () => {
    await navigator.clipboard.writeText(worker.wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [worker.wallet]);

  const initials = worker.wallet.slice(1, 3).toUpperCase();

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden transition-colors hover:border-white/[0.12]">
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        {/* Avatar */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black text-black"
          style={{ backgroundColor: "#facc15" }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => void copyAddress()}
              title={t("workforce.copy_address")}
              className="flex items-center gap-1.5 font-mono text-[13px] font-semibold text-white transition-colors hover:text-yellow-400"
            >
              {shortAddr(worker.wallet)}
              <svg
                className="h-3 w-3 text-neutral-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect
                  x="9"
                  y="9"
                  width="13"
                  height="13"
                  rx="2"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                />
              </svg>
            </button>
            {copied && (
              <span className="text-[11px] font-semibold text-green-400">
                Copied!
              </span>
            )}
          </div>

          {worker.metadata_hash && (
            <p
              className="mt-0.5 truncate font-mono text-[11px] text-neutral-700"
              title={worker.metadata_hash}
            >
              {worker.metadata_hash.length > 28
                ? `${worker.metadata_hash.slice(0, 28)}…`
                : worker.metadata_hash}
            </p>
          )}

          {/* Token badge */}
          <span className="mt-1.5 inline-flex items-center rounded-full border border-yellow-400/20 bg-yellow-400/[0.06] px-2 py-0.5 text-[11px] font-semibold text-yellow-400">
            {worker.preferred_token.length > 12
              ? shortAddr(worker.preferred_token)
              : worker.preferred_token}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 divide-x divide-white/[0.05] border-t border-white/[0.05]">
        <div className="flex flex-col items-center py-3.5 px-3 text-center">
          <span className="text-[20px] font-black text-green-400">
            {worker.activeStreams}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 mt-0.5">
            {t("workforce.active_streams")}
          </span>
        </div>
        <div className="flex flex-col items-center py-3.5 px-3 text-center">
          <span className="text-[20px] font-black text-white">
            {worker.totalPaid.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 mt-0.5">
            {t("workforce.total_paid")}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-white/[0.05] p-4">
        {!confirmingRemove ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
            >
              {showHistory
                ? t("workforce.hide_history")
                : t("workforce.view_history")}
              <svg
                className={`h-3.5 w-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <button
              onClick={() => setConfirmingRemove(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/[0.05] text-red-500 hover:bg-red-500/[0.12] transition-colors"
              title={t("workforce.remove_worker")}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3.5">
            <p className="mb-3 text-[13px] text-red-300">
              {t("workforce.confirm_remove")}
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-xl bg-red-600 py-2 text-[13px] font-semibold text-white hover:bg-red-500 transition-colors"
                onClick={() => {
                  setConfirmingRemove(false);
                  onRemove(worker.wallet);
                }}
              >
                {t("workforce.confirm")}
              </button>
              <button
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
                onClick={() => setConfirmingRemove(false)}
              >
                {t("workforce.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stream history */}
      {showHistory && (
        <div className="border-t border-white/[0.05] px-5 pb-5 pt-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-neutral-700">
            {t("workforce.stream_history")}
          </p>
          <StreamHistoryTable streams={worker.streams} />
        </div>
      )}
    </div>
  );
}

/* ── Add Worker Modal ───────────────────────────────────────────── */

function AddWorkerModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (address: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();

    if (!STELLAR_ADDR_RE.test(trimmed)) {
      setError("Enter a valid Stellar address (starts with G, 56 characters).");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onAdd(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#111] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <div>
            <h2 className="text-[16px] font-bold text-white">
              {t("workforce.add_worker_title")}
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-600">
              Register a worker to your roster.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-white/[0.06] hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Info banner */}
          <div className="mb-5 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] p-3.5 text-[12px] text-yellow-400/80">
            Workers must have self-registered in the Workforce Registry before
            they can be added to your roster.
          </div>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="worker-address"
                className="text-[13px] font-semibold text-white"
              >
                {t("workforce.worker_address")}
              </label>
              <input
                id="worker-address"
                ref={inputRef}
                type="text"
                className={`w-full rounded-xl border bg-black px-4 py-3 font-mono text-[13px] text-white placeholder:text-neutral-700 focus:outline-none focus:ring-1 transition-colors ${
                  error
                    ? "border-red-500/50 focus:ring-red-500/20"
                    : "border-white/[0.1] focus:border-yellow-400/40 focus:ring-yellow-400/20"
                }`}
                placeholder={t("workforce.worker_address_placeholder")}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setError(null);
                }}
                disabled={submitting}
                autoComplete="off"
                spellCheck={false}
              />
              {error && <p className="text-[11px] text-red-400">{error}</p>}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-[14px] font-semibold text-white hover:bg-white/[0.08] transition-colors disabled:opacity-40"
              >
                {t("workforce.cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting || address.trim().length < 10}
                className="flex-1 rounded-xl py-3 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#facc15" }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    {t("workforce.adding_worker")}
                  </span>
                ) : (
                  t("workforce.add_worker")
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */

const WorkforceRegistry: React.FC = () => {
  const { t } = useTranslation();
  const { address } = useWallet();
  const navigate = useNavigate();
  const { workers, isLoading, error, addWorker, removeWorker, refetch } =
    useWorkforceRegistry(address);

  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleAddWorker = useCallback(
    async (workerAddress: string) => {
      await addWorker(workerAddress);
      showToast("Worker added to your roster.");
    },
    [addWorker, showToast],
  );

  const handleRemoveWorker = useCallback(
    async (workerAddress: string) => {
      try {
        await removeWorker(workerAddress);
        showToast("Worker removed from your roster.");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to remove worker.",
        );
      }
    },
    [removeWorker, showToast],
  );

  const filteredWorkers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return workers.filter(
      (w) =>
        w.wallet.toLowerCase().includes(q) ||
        w.metadata_hash.toLowerCase().includes(q) ||
        w.preferred_token.toLowerCase().includes(q),
    );
  }, [workers, searchQuery]);

  // Stats
  const stats = useMemo(
    () => ({
      total: workers.length,
      withStreams: workers.filter((w) => w.activeStreams > 0).length,
      activeStreams: workers.reduce((s, w) => s + w.activeStreams, 0),
      totalPaid: workers.reduce((s, w) => s + w.totalPaid, 0),
    }),
    [workers],
  );

  // ── No wallet ──────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10">
          <svg
            className="h-8 w-8 text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <h2 className="text-[20px] font-bold text-white mb-2">
          {t("workforce.title")}
        </h2>
        <p className="text-[14px] text-neutral-500">
          {t("workforce.wallet_required")}
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            {t("workforce.title")}
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            {t("workforce.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void navigate("/create-stream")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            New Stream
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97]"
            style={{ backgroundColor: "#facc15" }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t("workforce.add_worker")}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: t("workforce.total_workers"),
            value: stats.total,
            accent: false,
          },
          {
            label: t("workforce.workers_with_streams"),
            value: stats.withStreams,
            accent: true,
          },
          {
            label: t("workforce.active_streams"),
            value: stats.activeStreams,
            accent: false,
          },
          {
            label: t("workforce.total_paid"),
            value: stats.totalPaid.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            accent: false,
          },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
              {label}
            </p>
            <p
              className="text-[26px] font-black"
              style={accent ? { color: "#facc15" } : { color: "#fff" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Search + error */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-700"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className="w-full rounded-xl border border-white/[0.1] bg-black py-2.5 pl-10 pr-4 text-[14px] text-white placeholder:text-neutral-700 focus:border-yellow-400/40 focus:outline-none focus:ring-1 focus:ring-yellow-400/20"
            placeholder={t("workforce.search_placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-[13px] text-red-400">
            {error}{" "}
            <button className="underline hover:text-red-300" onClick={refetch}>
              Retry
            </button>
          </p>
        )}
      </div>

      {/* Workers grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-[#0a0a0a]"
            />
          ))}
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04]">
            <svg
              className="h-7 w-7 text-neutral-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          {searchQuery ? (
            <>
              <p className="text-[16px] font-bold text-white mb-1">
                No workers match your search
              </p>
              <p className="text-[13px] text-neutral-600">
                Try a different address or token.
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="mb-1 text-[16px] font-bold text-white">
                {t("workforce.no_workers")}
              </p>
              <p className="mx-auto mb-5 max-w-sm text-[13px] text-neutral-600">
                {t("workforce.no_workers_desc")}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-black transition-all hover:opacity-90"
                style={{ backgroundColor: "#facc15" }}
              >
                {t("workforce.add_worker")}
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-neutral-700">
            {filteredWorkers.length}{" "}
            {filteredWorkers.length === 1 ? "worker" : "workers"}
            {searchQuery ? " matched" : " registered"}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredWorkers.map((worker) => (
              <WorkerCard
                key={worker.wallet}
                worker={worker}
                onRemove={(addr) => void handleRemoveWorker(addr)}
              />
            ))}
          </div>
        </>
      )}

      {/* Add Worker Modal */}
      {showAddModal && (
        <AddWorkerModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddWorker}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-green-500/20 bg-[#111] px-5 py-4 shadow-2xl">
          <svg
            className="h-4 w-4 shrink-0 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-[13px] font-semibold text-green-400">
            {toast}
          </span>
        </div>
      )}
    </div>
  );
};

export default WorkforceRegistry;
