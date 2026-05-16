import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../hooks/useNotification";
import { useWallet } from "../hooks/useWallet";
import { useWorkforceRegistry } from "../hooks/useWorkforceRegistry";
import {
  buildBatchCreateStreamsTx,
  submitAndAwaitTx,
  type BatchStreamEntry,
} from "../contracts/payroll_stream";
import { SeoHelmet } from "../components/seo/SeoHelmet";

// ─── Constants ────────────────────────────────────────────────────────────────

const STROOPS = 1e7;

const TOKEN_ADDRESS: Record<string, string> = {
  XLM: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", // native XLM SAC testnet
  USDC: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", // Circle USDC testnet
};

function toUnixSec(d: string) {
  return Math.floor(new Date(d).getTime() / 1000);
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CreateStream: React.FC = () => {
  const navigate = useNavigate();
  const { address, signTransaction } = useWallet();
  const { addNotification, addStreamNotification } = useNotification();
  const { workers, isLoading } = useWorkforceRegistry(address);

  // ── Shared config ─────────────────────────────────────────────────────────
  const [token, setToken] = useState("XLM");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ── Per-worker amounts & selection ────────────────────────────────────────
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  // Select all by default when workers load
  useEffect(() => {
    if (workers.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((prev) => {
      const next = { ...prev };
      workers.forEach((w) => {
        if (next[w.wallet] === undefined) next[w.wallet] = true;
      });
      return next;
    });
  }, [workers]);

  const toggleWorker = (wallet: string) =>
    setSelected((s) => ({ ...s, [wallet]: !s[wallet] }));

  const setAmount = (wallet: string, val: string) =>
    setAmounts((a) => ({ ...a, [wallet]: val }));

  const selectedWorkers = workers.filter((w) => selected[w.wallet]);
  const totalAmount = selectedWorkers.reduce(
    (s, w) => s + (parseFloat(amounts[w.wallet] ?? "") || 0),
    0,
  );

  // ── Validation ────────────────────────────────────────────────────────────
  const canSubmit =
    !!address &&
    selectedWorkers.length > 0 &&
    selectedWorkers.every((w) => parseFloat(amounts[w.wallet] ?? "") > 0) &&
    startDate.length > 0 &&
    endDate.length > 0 &&
    toUnixSec(endDate) > toUnixSec(startDate);

  const missingAmounts = selectedWorkers.filter(
    (w) => !(parseFloat(amounts[w.wallet] ?? "") > 0),
  );

  // ── Transaction state ─────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<
    "building" | "signing" | "sending" | ""
  >("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!address || !signTransaction || !canSubmit) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      const startTs = toUnixSec(startDate);
      const endTs = toUnixSec(endDate);
      const durSec = endTs - startTs;

      const entries: BatchStreamEntry[] = selectedWorkers.map((w) => {
        const totalStroops = BigInt(
          Math.round(parseFloat(amounts[w.wallet]) * STROOPS),
        );
        const rate = durSec > 0 ? totalStroops / BigInt(durSec) : BigInt(1);
        return {
          worker: w.wallet,
          token: TOKEN_ADDRESS[token] ?? "",
          rate,
          startTs,
          endTs,
        };
      });

      setSubmitStep("building");
      const { preparedXdr } = await buildBatchCreateStreamsTx(address, entries);

      setSubmitStep("signing");
      const { signedTxXdr } = await signTransaction(preparedXdr, {
        networkPassphrase: import.meta.env
          .PUBLIC_STELLAR_NETWORK_PASSPHRASE as string,
      });

      setSubmitStep("sending");
      await submitAndAwaitTx(signedTxXdr);

      addStreamNotification("stream_started", {
        message: `${selectedWorkers.length} stream${selectedWorkers.length > 1 ? "s" : ""} created.`,
        dedupeKey: "batch-create",
      });
      addNotification(
        `${selectedWorkers.length} streams created on-chain!`,
        "success",
      );
      void navigate("/dashboard");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
      setSubmitStep("");
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <>
      <SeoHelmet
        title="Create Streams · Quipay"
        description="Pay your registered workers."
        path="/create-stream"
        robots="noindex,nofollow"
      />

      {/* Transaction overlay */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#111] p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400/10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" />
            </div>
            <p className="text-[16px] font-bold text-white mb-1">
              {submitStep === "building" && "Preparing transaction…"}
              {submitStep === "signing" && "Check Freighter to sign"}
              {submitStep === "sending" && "Broadcasting to Stellar…"}
            </p>
            <p className="text-[13px] text-neutral-600">
              {submitStep === "building" &&
                `Simulating ${selectedWorkers.length} streams`}
              {submitStep === "signing" &&
                "Approve the transaction in your wallet"}
              {submitStep === "sending" &&
                "Waiting for ledger confirmation (~5s)"}
            </p>
          </div>
        </div>
      )}

      <div className="px-6 py-8 sm:px-8 sm:py-10 max-w-[900px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[22px] font-bold text-white tracking-tight">
            Create Payment Streams
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Select workers from your roster, set their amounts, and stream
            everyone in one transaction.
          </p>
        </div>

        {/* Error */}
        {submitError && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-red-400">
                Transaction failed
              </p>
              <p className="text-[12px] text-red-400/70 mt-0.5 break-all">
                {submitError}
              </p>
            </div>
            <button
              onClick={() => setSubmitError(null)}
              className="text-red-700 hover:text-red-400 shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* ── Left: worker list ── */}
          <div className="flex flex-col gap-4">
            {/* Loading */}
            {isLoading && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-10 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" />
                <p className="mt-3 text-[13px] text-neutral-600">
                  Loading your workforce…
                </p>
              </div>
            )}

            {/* No workers registered */}
            {!isLoading && workers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04]">
                  <svg
                    className="h-7 w-7 text-neutral-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <p className="text-[15px] font-bold text-white mb-1">
                  No workers registered yet
                </p>
                <p className="text-[13px] text-neutral-600 mb-5">
                  Share your wallet address with your workers so they can
                  register under your company.
                </p>
                <div className="mx-auto flex max-w-xs items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <span className="flex-1 truncate font-mono text-[12px] text-neutral-400">
                    {address}
                  </span>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(address ?? "");
                      addNotification("Address copied", "success");
                    }}
                    className="shrink-0 text-neutral-600 hover:text-yellow-400 transition-colors"
                    title="Copy your employer address"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
                <p className="mt-3 text-[11px] text-neutral-700">
                  Workers go to their dashboard and enter this address to
                  register.
                </p>
              </div>
            )}

            {/* Worker checklist */}
            {!isLoading && workers.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
                {/* Header row */}
                <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                  <p className="text-[13px] font-bold text-white">
                    {workers.length} registered worker
                    {workers.length > 1 ? "s" : ""}
                  </p>
                  <button
                    onClick={() => {
                      const allSelected = workers.every(
                        (w) => selected[w.wallet],
                      );
                      const next: Record<string, boolean> = {};
                      workers.forEach((w) => {
                        next[w.wallet] = !allSelected;
                      });
                      setSelected(next);
                    }}
                    className="text-[12px] font-semibold transition-colors hover:text-white"
                    style={{ color: "#facc15" }}
                  >
                    {workers.every((w) => selected[w.wallet])
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                </div>

                {/* Workers */}
                <div className="divide-y divide-white/[0.04]">
                  {workers.map((w) => {
                    const isSelected = !!selected[w.wallet];
                    const amt = amounts[w.wallet] ?? "";
                    return (
                      <div
                        key={w.wallet}
                        className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                          isSelected ? "bg-yellow-400/[0.03]" : "opacity-50"
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleWorker(w.wallet)}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-yellow-400/60 bg-yellow-400/20"
                              : "border-white/[0.15] bg-transparent"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="h-3 w-3 text-yellow-400"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>

                        {/* Avatar */}
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-black text-black"
                          style={{
                            backgroundColor: "#facc15",
                            opacity: isSelected ? 1 : 0.5,
                          }}
                        >
                          {w.wallet.slice(1, 3).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[13px] font-medium text-white truncate">
                            {shortAddr(w.wallet)}
                          </p>
                          <p className="text-[11px] text-neutral-600">
                            {w.preferred_token
                              ? shortAddr(w.preferred_token)
                              : "XLM"}{" "}
                            · {w.activeStreams} active stream
                            {w.activeStreams !== 1 ? "s" : ""}
                          </p>
                        </div>

                        {/* Amount input */}
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amt}
                            disabled={!isSelected}
                            onChange={(e) =>
                              setAmount(w.wallet, e.target.value)
                            }
                            placeholder="Amount"
                            className={`w-[110px] rounded-xl border bg-black px-3 py-2 text-right text-[13px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-yellow-400/40 focus:ring-1 focus:ring-yellow-400/20 disabled:opacity-30 ${
                              isSelected && parseFloat(amt) <= 0 && amt !== ""
                                ? "border-red-500/40"
                                : "border-white/[0.1]"
                            }`}
                          />
                          <span className="text-[12px] font-semibold text-neutral-600 w-10 shrink-0">
                            {token}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: config + summary ── */}
          <div className="flex flex-col gap-4">
            {/* Stream settings */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
              <p className="mb-4 text-[13px] font-bold text-white">
                Stream Settings
              </p>
              <div className="flex flex-col gap-4">
                {/* Token */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-neutral-400">
                    Token
                  </label>
                  <select
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.1] bg-black px-4 py-2.5 text-[13px] text-white focus:border-yellow-400/40 focus:outline-none"
                  >
                    <option value="XLM">XLM (Native)</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>

                {/* Start date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-neutral-400">
                    Start date <span style={{ color: "#facc15" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.1] bg-black px-4 py-2.5 text-[13px] text-white focus:border-yellow-400/40 focus:outline-none"
                  />
                </div>

                {/* End date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-neutral-400">
                    End date <span style={{ color: "#facc15" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.1] bg-black px-4 py-2.5 text-[13px] text-white focus:border-yellow-400/40 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
              <p className="mb-4 text-[13px] font-bold text-white">Summary</p>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between">
                  <span className="text-[13px] text-neutral-500">
                    Selected workers
                  </span>
                  <span className="text-[13px] font-semibold text-white">
                    {selectedWorkers.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[13px] text-neutral-500">
                    Total {token}
                  </span>
                  <span className="text-[13px] font-semibold text-white">
                    {totalAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </span>
                </div>
                {startDate &&
                  endDate &&
                  toUnixSec(endDate) > toUnixSec(startDate) && (
                    <div className="flex justify-between">
                      <span className="text-[13px] text-neutral-500">
                        Duration
                      </span>
                      <span className="text-[13px] font-semibold text-white">
                        {Math.round(
                          (toUnixSec(endDate) - toUnixSec(startDate)) / 86400,
                        )}{" "}
                        days
                      </span>
                    </div>
                  )}
              </div>

              {/* Validation hints */}
              {missingAmounts.length > 0 && (
                <p className="mt-3 text-[11px] text-yellow-400/70">
                  Enter an amount for{" "}
                  {missingAmounts.length === 1
                    ? "1 selected worker"
                    : `${missingAmounts.length} selected workers`}
                  .
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className="w-full rounded-xl py-3 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#facc15" }}
                >
                  Create{" "}
                  {selectedWorkers.length > 0
                    ? `${selectedWorkers.length} `
                    : ""}
                  Stream{selectedWorkers.length !== 1 ? "s" : ""}
                </button>
                <button
                  onClick={() => void navigate("/dashboard")}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-[14px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateStream;
