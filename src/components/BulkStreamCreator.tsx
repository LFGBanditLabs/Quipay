/**
 * BulkStreamCreator
 * ─────────────────
 * Employer-facing UI for creating up to 20 payroll streams in one transaction.
 *
 * Modes
 * ─────
 * • CSV upload  – parse a file with columns: worker,token,rate,startDate,endDate
 * • Manual entry – add rows one by one via a form table
 *
 * Flow
 * ────
 * 1. Employer adds rows (CSV or manual)
 * 2. Client-side validation per row
 * 3. Solvency pre-check: sum all stream totals, call checkTreasurySolvency
 * 4. Build + sign + submit batch_create_streams transaction
 */

import React, { useCallback, useRef, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { useNotification } from "../hooks/useNotification";
import {
  buildBatchCreateStreamsTx,
  checkTreasurySolvency,
  submitAndAwaitTx,
  type BatchStreamEntry,
} from "../contracts/payroll_stream";
import { PAYROLL_VAULT_CONTRACT_ID } from "../contracts/payroll_vault";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_BATCH = 20;
const STROOPS = 10_000_000n; // 1 token unit = 10^7 stroops

const SUPPORTED_TOKENS: Record<string, string> = {
  XLM: "native",
  USDC: import.meta.env.PUBLIC_USDC_ISSUER || "",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BatchRow {
  id: string;
  worker: string;
  token: string;
  /** Rate in human-readable token units per second (e.g. "0.001") */
  rateDisplay: string;
  startDate: string;
  endDate: string;
  /** Validation error message, or empty string */
  error: string;
}

type SubmitPhase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "solvent"; totalStroops: bigint }
  | { kind: "insolvent" }
  | { kind: "signing" }
  | { kind: "submitting" }
  | { kind: "success"; txHash: string }
  | { kind: "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyRow(): BatchRow {
  return {
    id: uid(),
    worker: "",
    token: "USDC",
    rateDisplay: "",
    startDate: "",
    endDate: "",
    error: "",
  };
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function dateToTs(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

function validateRow(row: BatchRow): string {
  if (!/^G[A-Z2-7]{55}$/.test(row.worker)) return "Invalid worker address";
  if (!row.token) return "Token required";
  const rate = parseFloat(row.rateDisplay);
  if (isNaN(rate) || rate <= 0) return "Rate must be > 0";
  if (!row.startDate) return "Start date required";
  if (!row.endDate) return "End date required";
  if (new Date(row.endDate) <= new Date(row.startDate))
    return "End must be after start";
  if (new Date(row.startDate) < new Date(todayStr()))
    return "Start date must be today or future";
  return "";
}

function rowToEntry(row: BatchRow): BatchStreamEntry {
  const rateStroops = BigInt(Math.round(parseFloat(row.rateDisplay) * 1e7));
  return {
    worker: row.worker,
    token: SUPPORTED_TOKENS[row.token] ?? row.token,
    rate: rateStroops,
    startTs: dateToTs(row.startDate),
    endTs: dateToTs(row.endDate),
  };
}

/** Compute total stream amount in stroops for a row */
function rowTotalStroops(row: BatchRow): bigint {
  const rate = parseFloat(row.rateDisplay);
  if (isNaN(rate) || rate <= 0 || !row.startDate || !row.endDate) return 0n;
  const durationSecs = dateToTs(row.endDate) - dateToTs(row.startDate);
  if (durationSecs <= 0) return 0n;
  return BigInt(Math.round(rate * 1e7)) * BigInt(durationSecs);
}

/** Parse CSV text into BatchRow[]. Expected columns: worker,token,rate,startDate,endDate */
function parseCSV(text: string): BatchRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Skip header row if present
  const firstCols = lines[0].toLowerCase().split(",");
  const startIdx = firstCols[0] === "worker" ? 1 : 0;

  return lines.slice(startIdx).map((line) => {
    const [
      worker = "",
      token = "USDC",
      rateDisplay = "",
      startDate = "",
      endDate = "",
    ] = line.split(",").map((c) => c.trim());
    const row: BatchRow = {
      id: uid(),
      worker,
      token: token.toUpperCase(),
      rateDisplay,
      startDate,
      endDate,
      error: "",
    };
    row.error = validateRow(row);
    return row;
  });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const tw = {
  wrapper:
    "mx-auto max-w-[900px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm",
  title: "mb-1 text-lg font-bold text-[var(--text)]",
  subtitle: "mb-5 text-sm text-[var(--muted)]",
  toolbar: "mb-4 flex flex-wrap items-center gap-3",
  btn: "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-150 disabled:opacity-50",
  btnPrimary: "bg-indigo-600 text-white hover:bg-indigo-700",
  btnSecondary:
    "border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text)] hover:bg-[var(--border)]",
  btnDanger:
    "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20",
  table: "w-full border-collapse text-sm",
  th: "border-b border-[var(--border)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]",
  td: "border-b border-[var(--border)] px-2 py-1.5",
  input:
    "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] focus:border-indigo-400 focus:outline-none",
  inputErr: "!border-red-400",
  errCell: "px-3 py-1 text-xs text-red-400",
  solvencyOk:
    "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400",
  solvencyBad:
    "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400",
  solvencyChecking:
    "rounded-lg border border-slate-500/30 bg-slate-500/10 px-4 py-2.5 text-sm text-slate-400",
  successBox:
    "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300",
  spinner:
    "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white align-middle",
};

// ── Component ─────────────────────────────────────────────────────────────────

const BulkStreamCreator: React.FC = () => {
  const { address: publicKey, signTransaction } = useWallet();
  const { addNotification } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<BatchRow[]>([emptyRow()]);
  const [phase, setPhase] = useState<SubmitPhase>({ kind: "idle" });

  // ── Row mutations ──────────────────────────────────────────────────────────

  const updateRow = useCallback(
    (id: string, field: keyof BatchRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, [field]: value };
          updated.error = validateRow(updated);
          return updated;
        }),
      );
      setPhase({ kind: "idle" });
    },
    [],
  );

  const addRow = () => {
    if (rows.length >= MAX_BATCH) return;
    setRows((prev) => [...prev, emptyRow()]);
    setPhase({ kind: "idle" });
  };

  const removeRow = (id: string) => {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev,
    );
    setPhase({ kind: "idle" });
  };

  const clearAll = () => {
    setRows([emptyRow()]);
    setPhase({ kind: "idle" });
  };

  // ── CSV upload ─────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        addNotification("CSV is empty or could not be parsed", "error");
        return;
      }
      const capped = parsed.slice(0, MAX_BATCH);
      setRows(capped);
      setPhase({ kind: "idle" });
      addNotification(`Loaded ${capped.length} row(s) from CSV`, "success");
    };
    reader.readAsText(file);
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  };

  // ── Solvency check ─────────────────────────────────────────────────────────

  const validRows = rows.filter((r) => r.error === "");

  const checkSolvency = useCallback(async () => {
    if (validRows.length === 0) return;
    setPhase({ kind: "checking" });
    try {
      // Sum total stroops across all valid rows (per token — use first token for simplicity)
      const totalStroops = validRows.reduce(
        (acc, r) => acc + rowTotalStroops(r),
        0n,
      );
      const firstToken =
        SUPPORTED_TOKENS[validRows[0].token] ?? validRows[0].token;
      const solvent = await checkTreasurySolvency(
        PAYROLL_VAULT_CONTRACT_ID,
        firstToken,
        totalStroops,
      );
      setPhase(
        solvent ? { kind: "solvent", totalStroops } : { kind: "insolvent" },
      );
    } catch {
      setPhase({ kind: "insolvent" });
    }
  }, [validRows]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!publicKey) {
      addNotification("Connect your wallet first", "error");
      return;
    }
    if (validRows.length === 0) {
      addNotification("No valid rows to submit", "error");
      return;
    }

    // Re-check solvency if not already confirmed
    if (phase.kind !== "solvent") {
      await checkSolvency();
      return;
    }

    try {
      setPhase({ kind: "signing" });
      const entries = validRows.map(rowToEntry);
      const { preparedXdr } = await buildBatchCreateStreamsTx(
        publicKey,
        entries,
      );

      setPhase({ kind: "submitting" });
      const signResult = await signTransaction(preparedXdr, {
        networkPassphrase: import.meta.env
          .VITE_STELLAR_NETWORK_PASSPHRASE as string,
      });
      if (
        !signResult ||
        typeof signResult !== "object" ||
        !("signedTxXdr" in signResult)
      ) {
        throw new Error("Invalid response from signTransaction");
      }
      const { signedTxXdr } = signResult as { signedTxXdr: string };
      const txHash = await submitAndAwaitTx(signedTxXdr);

      setPhase({ kind: "success", txHash });
      addNotification(
        `${validRows.length} stream(s) created successfully`,
        "success",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setPhase({ kind: "error", message: msg });
      addNotification(msg, "error");
    }
  }, [
    publicKey,
    validRows,
    phase,
    checkSolvency,
    signTransaction,
    addNotification,
  ]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const hasErrors = rows.some((r) => r.error !== "");
  const isBusy =
    phase.kind === "checking" ||
    phase.kind === "signing" ||
    phase.kind === "submitting";
  const totalDisplay = (
    validRows.reduce((acc, r) => acc + rowTotalStroops(r), 0n) / STROOPS
  ).toLocaleString();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={tw.wrapper}>
      <h2 className={tw.title}>Bulk Stream Creation</h2>
      <p className={tw.subtitle}>
        Create up to {MAX_BATCH} payroll streams in a single transaction. Upload
        a CSV or add rows manually.
      </p>

      {/* Toolbar */}
      <div className={tw.toolbar}>
        <button
          className={`${tw.btn} ${tw.btnSecondary}`}
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          type="button"
        >
          📂 Upload CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Upload CSV file"
        />

        <button
          className={`${tw.btn} ${tw.btnSecondary}`}
          onClick={addRow}
          disabled={isBusy || rows.length >= MAX_BATCH}
          type="button"
        >
          + Add Row
        </button>

        <button
          className={`${tw.btn} ${tw.btnDanger}`}
          onClick={clearAll}
          disabled={isBusy}
          type="button"
        >
          Clear All
        </button>

        <span className="ml-auto text-xs text-[var(--muted)]">
          {rows.length}/{MAX_BATCH} rows
        </span>
      </div>

      {/* CSV hint */}
      <p className="mb-3 text-xs text-[var(--muted)]">
        CSV format:{" "}
        <code className="rounded bg-[var(--surface-subtle)] px-1 py-0.5 font-mono">
          worker,token,rate,startDate,endDate
        </code>{" "}
        — e.g.{" "}
        <code className="rounded bg-[var(--surface-subtle)] px-1 py-0.5 font-mono">
          GABC…,USDC,0.001,2025-08-01,2025-12-31
        </code>
      </p>

      {/* Table */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className={tw.table} aria-label="Batch stream entries">
          <thead>
            <tr>
              <th className={tw.th}>#</th>
              <th className={tw.th}>Worker Address</th>
              <th className={tw.th}>Token</th>
              <th className={tw.th}>Rate (units/sec)</th>
              <th className={tw.th}>Start Date</th>
              <th className={tw.th}>End Date</th>
              <th className={tw.th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <React.Fragment key={row.id}>
                <tr>
                  <td
                    className={`${tw.td} w-8 text-center text-xs text-[var(--muted)]`}
                  >
                    {idx + 1}
                  </td>
                  <td className={tw.td}>
                    <input
                      className={`${tw.input} ${row.error && row.worker ? tw.inputErr : ""}`}
                      placeholder="GABC…"
                      value={row.worker}
                      onChange={(e) =>
                        updateRow(row.id, "worker", e.target.value)
                      }
                      disabled={isBusy}
                      aria-label={`Worker address row ${idx + 1}`}
                    />
                  </td>
                  <td className={`${tw.td} w-24`}>
                    <select
                      className={tw.input}
                      value={row.token}
                      onChange={(e) =>
                        updateRow(row.id, "token", e.target.value)
                      }
                      disabled={isBusy}
                      aria-label={`Token row ${idx + 1}`}
                    >
                      {Object.keys(SUPPORTED_TOKENS).map((sym) => (
                        <option key={sym} value={sym}>
                          {sym}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${tw.td} w-32`}>
                    <input
                      className={`${tw.input} ${row.error && row.rateDisplay ? tw.inputErr : ""}`}
                      placeholder="0.001"
                      type="number"
                      min="0"
                      step="any"
                      value={row.rateDisplay}
                      onChange={(e) =>
                        updateRow(row.id, "rateDisplay", e.target.value)
                      }
                      disabled={isBusy}
                      aria-label={`Rate row ${idx + 1}`}
                    />
                  </td>
                  <td className={`${tw.td} w-36`}>
                    <input
                      className={`${tw.input} ${row.error && row.startDate ? tw.inputErr : ""}`}
                      type="date"
                      min={todayStr()}
                      value={row.startDate}
                      onChange={(e) =>
                        updateRow(row.id, "startDate", e.target.value)
                      }
                      disabled={isBusy}
                      aria-label={`Start date row ${idx + 1}`}
                    />
                  </td>
                  <td className={`${tw.td} w-36`}>
                    <input
                      className={`${tw.input} ${row.error && row.endDate ? tw.inputErr : ""}`}
                      type="date"
                      min={row.startDate || todayStr()}
                      value={row.endDate}
                      onChange={(e) =>
                        updateRow(row.id, "endDate", e.target.value)
                      }
                      disabled={isBusy}
                      aria-label={`End date row ${idx + 1}`}
                    />
                  </td>
                  <td className={`${tw.td} w-10 text-center`}>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={isBusy || rows.length === 1}
                      className="rounded p-1 text-[var(--muted)] hover:text-red-400 disabled:opacity-30"
                      aria-label={`Remove row ${idx + 1}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
                {row.error && (
                  <tr aria-live="polite">
                    <td />
                    <td colSpan={6} className={tw.errCell}>
                      ⚠ {row.error}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary + solvency */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--muted)]">
          {validRows.length} valid row(s) · estimated total:{" "}
          <strong className="text-[var(--text)]">{totalDisplay}</strong> tokens
        </span>

        {phase.kind === "checking" && (
          <span className={tw.solvencyChecking}>
            <span className={tw.spinner} /> Checking treasury solvency…
          </span>
        )}
        {phase.kind === "solvent" && (
          <span className={tw.solvencyOk}>✅ Treasury funds confirmed</span>
        )}
        {phase.kind === "insolvent" && (
          <span className={tw.solvencyBad}>
            ⚠ Insufficient treasury balance for this batch
          </span>
        )}
        {phase.kind === "error" && (
          <span className={tw.solvencyBad}>✕ {phase.message}</span>
        )}
      </div>

      {/* Success */}
      {phase.kind === "success" && (
        <div className={`${tw.successBox} mb-4`} role="status">
          ✅ {validRows.length} stream(s) created.{" "}
          <span className="font-mono text-xs opacity-75">
            Tx: {phase.txHash.slice(0, 12)}…
          </span>
          <button className="ml-4 underline" onClick={clearAll} type="button">
            Create another batch
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={`${tw.btn} ${tw.btnSecondary}`}
          onClick={() => void checkSolvency()}
          disabled={isBusy || validRows.length === 0 || hasErrors}
        >
          {phase.kind === "checking" ? (
            <span className={tw.spinner} />
          ) : (
            "Check Solvency"
          )}
        </button>

        <button
          type="button"
          className={`${tw.btn} ${tw.btnPrimary}`}
          onClick={() => void handleSubmit()}
          disabled={
            isBusy ||
            validRows.length === 0 ||
            hasErrors ||
            phase.kind === "insolvent" ||
            phase.kind === "success" ||
            !publicKey
          }
        >
          {phase.kind === "signing" || phase.kind === "submitting" ? (
            <>
              <span className={tw.spinner} />
              {phase.kind === "signing"
                ? "Waiting for signature…"
                : "Submitting…"}
            </>
          ) : (
            `Submit ${validRows.length} Stream${validRows.length !== 1 ? "s" : ""}`
          )}
        </button>

        {!publicKey && (
          <span className="self-center text-xs text-[var(--muted)]">
            Connect wallet to submit
          </span>
        )}
      </div>
    </div>
  );
};

export default BulkStreamCreator;
