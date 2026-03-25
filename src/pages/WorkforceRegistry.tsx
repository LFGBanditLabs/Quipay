import React, { useState, useCallback, useRef, useEffect } from "react";
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

/* ── Design tokens (shared across sub-components) ───────────────── */

const tw = {
  page: "min-h-screen bg-[linear-gradient(135deg,#0f172a_0%,#1e1b4b_50%,#0f172a_100%)] px-6 pb-16 pt-8 font-[Inter,sans-serif] text-slate-200",
  pageHeader: "mx-auto mb-8 max-w-[1200px]",
  pageTitle:
    "mb-1 bg-[linear-gradient(135deg,#818cf8,#c084fc,#6366f1)] bg-clip-text text-[2rem] font-extrabold tracking-[-0.02em] text-transparent",
  pageSubtitle: "m-0 text-[0.95rem] text-slate-400",
  card: "mx-auto mb-6 max-w-[1200px] rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-[20px]",
  cardHeader: "mb-5 flex flex-wrap items-center justify-between gap-3",
  cardTitle: "flex items-center gap-2 text-[1.1rem] font-bold text-slate-100",
  statsGrid:
    "mx-auto mb-6 max-w-[1200px] grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4",
  statCard:
    "rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-5 backdrop-blur-[20px]",
  statLabel:
    "mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-slate-500",
  statValue: "text-[1.5rem] font-extrabold text-slate-100",
  btnPrimary:
    "inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.4)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(79,70,229,0.5)]",
  btnGhost:
    "inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition-all duration-200 hover:bg-indigo-500/25 hover:text-indigo-100",
  btnDanger:
    "inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-all duration-200 hover:bg-rose-500/25 hover:text-rose-100",
  searchInput:
    "w-full max-w-sm rounded-xl border border-indigo-500/20 bg-slate-900/65 px-4 py-2.5 text-sm text-slate-200 outline-none transition focus:border-indigo-400/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] placeholder:text-slate-500",
  formInput:
    "w-full rounded-xl border border-indigo-500/20 bg-slate-900/65 px-4 py-2.5 text-sm text-slate-200 outline-none transition focus:border-indigo-400/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] placeholder:text-slate-500",
  formLabel: "mb-1.5 block text-sm font-medium text-slate-300",
  formError: "mt-1.5 text-xs text-rose-400",
  workerGrid:
    "mx-auto max-w-[1200px] grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5 max-[768px]:grid-cols-1",
  workerCard:
    "rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-5 backdrop-blur-[20px] transition-all duration-200 hover:border-indigo-400/30 hover:shadow-[0_8px_28px_rgba(0,0,0,0.3)]",
  badge:
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  badgeActive: "bg-emerald-500/15 text-emerald-300",
  badgeCompleted: "bg-indigo-500/15 text-indigo-300",
  badgeCancelled: "bg-rose-500/15 text-rose-300",
  tableWrapper:
    "mt-4 overflow-hidden rounded-xl border border-indigo-500/10 bg-slate-900/40",
  table: "w-full border-collapse text-xs",
  th: "bg-slate-900/50 px-4 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-slate-500",
  td: "border-t border-slate-700/40 px-4 py-2.5",
  emptyCard:
    "mx-auto max-w-[1200px] rounded-2xl border border-dashed border-slate-600/50 p-14 text-center",
  overlay:
    "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm",
  modal:
    "relative mx-4 w-full max-w-md rounded-2xl border border-indigo-500/20 bg-[#1e1b4b] p-6 shadow-2xl",
  toast:
    "fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-xl border border-indigo-400/35 bg-slate-900/90 px-4 py-3 text-sm font-medium text-indigo-100 shadow-2xl backdrop-blur",
};

/* ── Status badge ───────────────────────────────────────────────── */

function StatusBadge({ status }: { status: WorkerStreamRecord["status"] }) {
  const { t } = useTranslation();
  const map = {
    active: { cls: tw.badgeActive, label: t("workforce.stream_status_active") },
    completed: {
      cls: tw.badgeCompleted,
      label: t("workforce.stream_status_completed"),
    },
    cancelled: {
      cls: tw.badgeCancelled,
      label: t("workforce.stream_status_cancelled"),
    },
  };
  const { cls, label } = map[status] ?? map.active;
  return <span className={`${tw.badge} ${cls}`}>{label}</span>;
}

/* ── Stream history table ───────────────────────────────────────── */

function StreamHistoryTable({ streams }: { streams: WorkerStreamRecord[] }) {
  const { t } = useTranslation();

  if (streams.length === 0) {
    return (
      <p className="mt-3 text-xs text-slate-500">{t("workforce.no_streams")}</p>
    );
  }

  return (
    <div className={tw.tableWrapper}>
      <table className={tw.table}>
        <thead>
          <tr>
            <th className={tw.th}>{t("workforce.stream_id")}</th>
            <th className={tw.th}>{t("workforce.amount")}</th>
            <th className={tw.th}>{t("workforce.start_date")}</th>
            <th className={tw.th}>{t("workforce.end_date")}</th>
            <th className={tw.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {streams.map((s) => (
            <tr key={s.stream_id}>
              <td className={tw.td}>
                <span className="font-mono text-indigo-300">
                  #{s.stream_id}
                </span>
              </td>
              <td className={`${tw.td} font-semibold text-slate-100`}>
                {fmtAmount(s.total_amount)} XLM
              </td>
              <td className={`${tw.td} text-slate-400`}>
                {fmtDate(s.start_ts)}
              </td>
              <td className={`${tw.td} text-slate-400`}>{fmtDate(s.end_ts)}</td>
              <td className={tw.td}>
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

  return (
    <div className={tw.workerCard}>
      {/* Address row */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
              {worker.wallet.slice(1, 3)}
            </div>
            <button
              onClick={() => void copyAddress()}
              title={t("workforce.copy_address")}
              className="flex items-center gap-1.5 font-mono text-sm text-slate-100 transition-colors hover:text-indigo-300"
            >
              {shortAddr(worker.wallet)}
              <svg
                className="h-3.5 w-3.5 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
            {copied && (
              <span className="text-xs text-emerald-400">
                {t("workforce.copied")}
              </span>
            )}
          </div>
          {worker.metadata_hash && (
            <p
              className="mt-1 truncate font-mono text-xs text-slate-500"
              title={worker.metadata_hash}
            >
              {worker.metadata_hash.length > 28
                ? `${worker.metadata_hash.slice(0, 28)}…`
                : worker.metadata_hash}
            </p>
          )}
        </div>

        {/* Preferred token badge */}
        <span className="flex-shrink-0 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-xs font-semibold text-indigo-300">
          {worker.preferred_token.length > 12
            ? shortAddr(worker.preferred_token)
            : worker.preferred_token}
        </span>
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-900/50 p-3">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
            {t("workforce.active_streams")}
          </div>
          <div className="mt-0.5 text-xl font-bold text-emerald-300">
            {worker.activeStreams}
          </div>
        </div>
        <div className="rounded-xl bg-slate-900/50 p-3">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
            {t("workforce.total_paid")}
          </div>
          <div className="mt-0.5 text-xl font-bold text-indigo-200">
            {worker.totalPaid.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      {!confirmingRemove ? (
        <div className="flex items-center gap-2">
          <button
            className={tw.btnGhost}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory
              ? t("workforce.hide_history")
              : t("workforce.view_history")}
          </button>
          <button
            className={tw.btnDanger}
            onClick={() => setConfirmingRemove(true)}
          >
            {t("workforce.remove_worker")}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
          <p className="mb-2.5 text-xs text-rose-200">
            {t("workforce.confirm_remove")}
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500"
              onClick={() => {
                setConfirmingRemove(false);
                onRemove(worker.wallet);
              }}
            >
              {t("workforce.confirm")}
            </button>
            <button
              className={tw.btnGhost}
              onClick={() => setConfirmingRemove(false)}
            >
              {t("workforce.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Expandable stream history */}
      {showHistory && (
        <div className="mt-4 border-t border-slate-700/40 pt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
      className={tw.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={tw.modal} role="dialog" aria-modal="true">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">
            {t("workforce.add_worker_title")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-700/50 hover:text-slate-200"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Info banner */}
        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
          Workers must have self-registered in the Workforce Registry before
          they can be added to your roster.
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="mb-4">
            <label htmlFor="worker-address" className={tw.formLabel}>
              {t("workforce.worker_address")}
            </label>
            <input
              id="worker-address"
              ref={inputRef}
              type="text"
              className={tw.formInput}
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
            {error && <p className={tw.formError}>{error}</p>}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={tw.btnGhost}
              onClick={onClose}
              disabled={submitting}
            >
              {t("workforce.cancel")}
            </button>
            <button
              type="submit"
              className={tw.btnPrimary}
              disabled={submitting || address.trim().length < 10}
            >
              {submitting ? (
                <>
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
                </>
              ) : (
                t("workforce.add_worker")
              )}
            </button>
          </div>
        </form>
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

  const filteredWorkers = workers.filter((w) => {
    const q = searchQuery.toLowerCase();
    return (
      w.wallet.toLowerCase().includes(q) ||
      w.metadata_hash.toLowerCase().includes(q) ||
      w.preferred_token.toLowerCase().includes(q)
    );
  });

  // ── No wallet ──────────────────────────────────────────────────
  if (!address) {
    return (
      <div className={tw.page}>
        <div className={tw.pageHeader}>
          <h1 className={tw.pageTitle}>{t("workforce.title")}</h1>
        </div>
        <div className={`${tw.emptyCard} border-solid`}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10">
            <svg
              className="h-7 w-7 text-indigo-400"
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
          <p className="text-slate-400">{t("workforce.wallet_required")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={tw.page}>
      {/* ── Header ── */}
      <header className={tw.pageHeader}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={tw.pageTitle}>{t("workforce.title")}</h1>
            <p className={tw.pageSubtitle}>{t("workforce.subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className={tw.btnGhost}
              onClick={() => {
                void navigate("/create-stream");
              }}
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
              className={tw.btnPrimary}
              onClick={() => setShowAddModal(true)}
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
      </header>

      {/* ── Stats strip ── */}
      <div className={tw.statsGrid}>
        <div className={tw.statCard}>
          <div className={tw.statLabel}>{t("workforce.total_workers")}</div>
          <div className={tw.statValue}>{workers.length}</div>
        </div>
        <div className={tw.statCard}>
          <div className={tw.statLabel}>
            {t("workforce.workers_with_streams")}
          </div>
          <div className={`${tw.statValue} text-emerald-300`}>
            {workers.filter((w) => w.activeStreams > 0).length}
          </div>
        </div>
        <div className={tw.statCard}>
          <div className={tw.statLabel}>{t("workforce.active_streams")}</div>
          <div className={`${tw.statValue} text-indigo-300`}>
            {workers.reduce((s, w) => s + w.activeStreams, 0)}
          </div>
        </div>
        <div className={tw.statCard}>
          <div className={tw.statLabel}>{t("workforce.total_paid")}</div>
          <div className={`${tw.statValue} text-purple-300`}>
            {workers
              .reduce((s, w) => s + w.totalPaid, 0)
              .toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
          </div>
        </div>
      </div>

      {/* ── Search + error ── */}
      <div className="mx-auto mb-6 max-w-[1200px] flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          className={tw.searchInput}
          placeholder={t("workforce.search_placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {error && (
          <p className="text-sm text-rose-400">
            {error}{" "}
            <button className="underline" onClick={refetch}>
              Retry
            </button>
          </p>
        )}
      </div>

      {/* ── Workers grid ── */}
      {isLoading ? (
        <div className={tw.workerGrid}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-indigo-500/10 bg-slate-800/30"
            />
          ))}
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className={tw.emptyCard}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10">
            <svg
              className="h-7 w-7 text-indigo-400"
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
          <p className="mb-1 font-semibold text-slate-300">
            {t("workforce.no_workers")}
          </p>
          <p className="mx-auto max-w-sm text-sm text-slate-500">
            {t("workforce.no_workers_desc")}
          </p>
          <button
            className={`mt-5 ${tw.btnPrimary}`}
            onClick={() => setShowAddModal(true)}
          >
            {t("workforce.add_worker")}
          </button>
        </div>
      ) : (
        <div className={tw.workerGrid}>
          {filteredWorkers.map((worker) => (
            <WorkerCard
              key={worker.wallet}
              worker={worker}
              onRemove={(addr) => void handleRemoveWorker(addr)}
            />
          ))}
        </div>
      )}

      {/* ── Add Worker Modal ── */}
      {showAddModal && (
        <AddWorkerModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddWorker}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={tw.toast}>
          <svg
            className="h-4 w-4 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
};

export default WorkforceRegistry;
