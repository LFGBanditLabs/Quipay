import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Coins,
  ShieldAlert,
  Loader2,
  RefreshCw,
  FileText,
} from "lucide-react";
import {
  type ParsedPayrollRow,
  type PayrollValidationSummary,
  parseAndValidatePayrollCsv,
  exportErrorsToCsv,
  exportSummaryToCsv,
  downloadCsvFile,
  downloadTemplateCsv,
} from "../lib/csvParser";
import { PayrollPreviewTable } from "./PayrollPreviewTable";
import { usePayroll, type BatchStreamResultItem } from "../hooks/usePayroll";
import { useWorkforceRegistry, type ResolvedWorkerInfo } from "../hooks/useWorkforceRegistry";
import { useStellarSign } from "../hooks/useStellarSign";
import { useStellarAccount } from "../hooks/useStellarAccount";
import { useAuth } from "../hooks/useAuth";

type ImportStep = "upload" | "preview" | "confirm" | "progress" | "summary";

export const BulkPayrollImport: React.FC = () => {
  const navigate = useNavigate();
  const { address: employer } = useStellarAccount();
  const { signXdr } = useStellarSign();
  const { getAccessToken } = useAuth();
  const { vaultData, createBatchStreams, isLoading: isPayrollLoading } =
    usePayroll(employer);
  const { batchResolveQpIds } = useWorkforceRegistry(employer);

  // Flow State
  const [step, setStep] = useState<ImportStep>("upload");
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawCsvText, setRawCsvText] = useState<string>("");

  // Validation & Data State
  const [rows, setRows] = useState<ParsedPayrollRow[]>([]);
  const [resolvedWorkers, setResolvedWorkers] = useState<
    Record<string, ResolvedWorkerInfo>
  >({});
  const [isResolving, setIsResolving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Execution & Progress State
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [totalStreams, setTotalStreams] = useState(0);
  const [currentStream, setCurrentStream] = useState<ParsedPayrollRow | null>(
    null,
  );
  const [results, setResults] = useState<BatchStreamResultItem[]>([]);

  // Parse and resolve QP IDs
  const handleFileProcess = useCallback(
    async (file: File) => {
      setFileName(file.name);
      const text = await file.text();
      setRawCsvText(text);

      // Initial local parse
      const summary = parseAndValidatePayrollCsv(text);
      setRows(summary.rows);

      // Collect QP IDs to resolve
      const qpIds = Array.from(
        new Set(summary.rows.map((r) => r.qpId).filter(Boolean)),
      );

      if (qpIds.length > 0) {
        setIsResolving(true);
        try {
          const resolved = await batchResolveQpIds(qpIds, getAccessToken);
          setResolvedWorkers(resolved);

          // Re-validate with resolved workforce data
          const enriched = parseAndValidatePayrollCsv(text, resolved);
          setRows(enriched.rows);
        } catch (err) {
          console.warn("Batch resolution error:", err);
        } finally {
          setIsResolving(false);
        }
      }

      setStep("preview");
    },
    [batchResolveQpIds, getAccessToken],
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      void handleFileProcess(e.target.files[0]);
    }
  };

  // Row update handlers
  const handleUpdateRow = (updatedRow: ParsedPayrollRow) => {
    setRows((prev) =>
      prev.map((r) => (r.id === updatedRow.id ? updatedRow : r)),
    );
  };

  const handleDeleteRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleDeleteInvalidRows = () => {
    setRows((prev) => prev.filter((r) => r.isValid));
  };

  const handleDownloadErrors = () => {
    const errorCsv = exportErrorsToCsv(rows);
    downloadCsvFile(errorCsv, `payroll-errors-${Date.now()}.csv`);
  };

  const handleDownloadSummary = () => {
    const summaryCsv = exportSummaryToCsv(results);
    downloadCsvFile(summaryCsv, `payroll-batch-summary-${Date.now()}.csv`);
  };

  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);

  // Totals calculation
  const totalsByToken: Record<string, number> = {};
  validRows.forEach((r) => {
    totalsByToken[r.token] = (totalsByToken[r.token] || 0) + r.amount;
  });

  // Check vault balance against required batch total
  const getVaultBalance = (tokenSymbol: string): number => {
    const vault = vaultData.find(
      (v) => v.tokenSymbol.toUpperCase() === tokenSymbol.toUpperCase(),
    );
    return vault ? Number(vault.balance) / 1e7 : 0;
  };

  const hasInsufficientBalance = Object.entries(totalsByToken).some(
    ([token, requiredAmount]) => {
      const balance = getVaultBalance(token);
      return balance < requiredAmount;
    },
  );

  // Start Batch Execution
  const handleStartBatch = async () => {
    if (!employer) {
      alert("Please connect your wallet first.");
      return;
    }

    if (validRows.length === 0) {
      alert("No valid rows to process.");
      return;
    }

    setStep("progress");
    setIsExecuting(true);
    setTotalStreams(validRows.length);
    setProgressIndex(0);
    setResults([]);

    const batchItems = validRows.map((r) => ({
      id: r.id,
      rowIndex: r.rowIndex,
      email: r.email,
      qpId: r.qpId,
      workerAddress: r.workerAddress || "",
      amount: r.amount,
      token: r.token,
      startDate: r.startDate,
      endDate: r.endDate,
      startTs: r.startTs,
      endTs: r.endTs,
    }));

    try {
      const finalResults = await createBatchStreams(
        batchItems,
        signXdr,
        (progress) => {
          setProgressIndex(progress.currentIndex);
          setResults(progress.results);
          if (progress.currentItem) {
            const foundRow = validRows.find(
              (vr) => vr.id === progress.currentItem?.id,
            );
            setCurrentStream(foundRow || null);
          }
        },
      );

      setResults(finalResults);
      setStep("summary");
    } catch (err) {
      console.error("Batch processing failed:", err);
      setStep("summary");
    } finally {
      setIsExecuting(false);
    }
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const failureCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="w-full">
      {/* ── STEP 1: UPLOAD ────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-8 text-center">
            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all cursor-pointer ${
                dragActive
                  ? "border-yellow-400 bg-yellow-400/[0.05]"
                  : "border-white/[0.12] bg-white/[0.02] hover:border-white/[0.25] hover:bg-white/[0.04]"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />

              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 shadow-lg">
                <UploadCloud className="h-7 w-7" />
              </div>

              <h3 className="text-[17px] font-bold text-white mb-1">
                Upload your payroll spreadsheet
              </h3>
              <p className="text-[13px] text-neutral-400 max-w-[380px] mb-4">
                Drag and drop your CSV file here, or click to browse. Reads
                client-side with zero server upload.
              </p>

              <button
                type="button"
                className="rounded-xl bg-white/[0.08] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.15] transition-colors border border-white/[0.1]"
              >
                Choose CSV File
              </button>
            </div>

            {/* Template Download & Help */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-neutral-900/40 p-4 text-left">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-6 w-6 text-yellow-400 shrink-0" />
                <div>
                  <h4 className="text-[13px] font-semibold text-white">
                    Need the template format?
                  </h4>
                  <p className="text-[12px] text-neutral-500">
                    Download our formatted CSV template with example rows.
                  </p>
                </div>
              </div>

              <button
                onClick={downloadTemplateCsv}
                className="flex items-center gap-1.5 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3.5 py-2 text-[12px] font-semibold text-yellow-400 hover:bg-yellow-400/20 transition-colors shrink-0"
              >
                <Download className="h-4 w-4" />
                <span>Download Template</span>
              </button>
            </div>

            {/* Supported formats hint */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-yellow-400">
                  Standard Format
                </span>
                <p className="font-mono text-[11px] text-neutral-400 mt-1">
                  email, qp_id, amount, token, start_date, end_date
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                  Hourly Rate Format
                </span>
                <p className="font-mono text-[11px] text-neutral-400 mt-1">
                  email, qp_id, hourly_rate, hours_per_week, token, start_date, end_date
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: PREVIEW & VALIDATE ─────────────────────────────────── */}
      {step === "preview" && (
        <div className="flex flex-col gap-6">
          {/* Header Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-bold text-white">
                  Payroll Preview & Validation
                </h2>
                {isResolving && (
                  <span className="flex items-center gap-1 text-[12px] text-yellow-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Resolving QP IDs…
                  </span>
                )}
              </div>
              <p className="text-[13px] text-neutral-400 mt-0.5">
                {fileName} · {rows.length} total rows parsed ({validRows.length}{" "}
                ready, {invalidRows.length} needs attention)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("upload")}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Upload New</span>
              </button>

              <button
                onClick={() => setStep("confirm")}
                disabled={validRows.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-5 py-2 text-[13px] font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Continue to Cost Summary</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Validation Warning Alert if there are errors */}
          {invalidRows.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-bold text-red-400">
                  {invalidRows.length} row{invalidRows.length > 1 ? "s" : ""}{" "}
                  require correction
                </h4>
                <p className="text-[12px] text-red-400/80 mt-0.5">
                  You can edit values directly in the table below, remove
                  invalid rows, or export an error report.
                </p>
              </div>
            </div>
          )}

          {/* Preview Table */}
          <PayrollPreviewTable
            rows={rows}
            onUpdateRow={handleUpdateRow}
            onDeleteRow={handleDeleteRow}
            onDeleteInvalidRows={handleDeleteInvalidRows}
            onDownloadErrors={handleDownloadErrors}
            resolvedWorkers={resolvedWorkers}
          />
        </div>
      )}

      {/* ── STEP 3: COST SUMMARY & CONFIRM ────────────────────────────── */}
      {step === "confirm" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-6">
            <h2 className="text-[20px] font-bold text-white tracking-tight mb-2">
              Batch Cost & Vault Summary
            </h2>
            <p className="text-[14px] text-neutral-400 mb-6">
              Review total stream amounts, estimated network gas fees, and vault
              funding before signing.
            </p>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Streams to Create
                </span>
                <p className="text-[26px] font-extrabold text-white mt-1">
                  {validRows.length}
                </p>
                <span className="text-[12px] text-neutral-500">
                  Sequential on-chain transactions
                </span>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Total Streaming Amount
                </span>
                <div className="mt-1 flex flex-col gap-0.5">
                  {Object.entries(totalsByToken).map(([token, sum]) => (
                    <p
                      key={token}
                      className="text-[22px] font-extrabold text-yellow-400"
                    >
                      {sum.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-[14px] font-bold text-white">
                        {token}
                      </span>
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Estimated Gas Fees
                </span>
                <p className="text-[26px] font-extrabold text-white mt-1">
                  ~{(validRows.length * 0.0001).toFixed(4)}{" "}
                  <span className="text-[14px] font-bold text-neutral-400">
                    XLM
                  </span>
                </p>
                <span className="text-[12px] text-neutral-500">
                  Stellar base fee per stream
                </span>
              </div>
            </div>

            {/* Vault Balance vs Total Check */}
            <div className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-5 mb-6">
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-neutral-400 mb-3">
                Vault Balance Verification
              </h4>
              <div className="flex flex-col gap-2.5">
                {Object.entries(totalsByToken).map(([token, requiredAmount]) => {
                  const balance = getVaultBalance(token);
                  const isSufficient = balance >= requiredAmount;

                  return (
                    <div
                      key={token}
                      className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <Coins className="h-4 w-4 text-yellow-400" />
                        <span className="text-[13px] font-semibold text-white">
                          {token} Vault
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <span className="text-[11px] text-neutral-500 block">
                            Available in Vault
                          </span>
                          <span className="text-[13px] font-mono font-bold text-white">
                            {balance.toLocaleString()} {token}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-neutral-500 block">
                            Batch Requirement
                          </span>
                          <span className="text-[13px] font-mono font-bold text-yellow-400">
                            {requiredAmount.toLocaleString()} {token}
                          </span>
                        </div>
                        <div className="w-24 text-right">
                          {isSufficient ? (
                            <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-[11px] font-bold text-green-400 border border-green-500/20">
                              <CheckCircle2 className="h-3 w-3" />
                              Funded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400 border border-amber-500/20">
                              <AlertTriangle className="h-3 w-3" />
                              Low Vault
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasInsufficientBalance && (
                <div className="mt-3.5 flex items-start gap-2 text-[12px] text-amber-400/90">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Note: Your vault balance is currently lower than the total batch
                    stream commitments. Streams will start immediately, but you should
                    deposit more funds into your treasury vault to prevent interruption.
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
              <button
                onClick={() => setStep("preview")}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Preview</span>
              </button>

              <button
                onClick={handleStartBatch}
                className="flex items-center gap-2 rounded-xl bg-yellow-400 px-7 py-3 text-[14px] font-bold text-black hover:bg-yellow-300 shadow-lg shadow-yellow-400/10 transition-colors"
              >
                <span>Create {validRows.length} Streams Now</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: PROGRESS ─────────────────────────────────────────── */}
      {step === "progress" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-[20px] font-bold text-white tracking-tight">
                  Creating Payroll Streams…
                </h2>
                <p className="text-[13px] text-neutral-400 mt-0.5">
                  Processing stream {progressIndex} of {totalStreams} (
                  {Math.round((progressIndex / Math.max(1, totalStreams)) * 100)}
                  %)
                </p>
              </div>

              {isExecuting && (
                <div className="flex items-center gap-2 rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3.5 py-1.5 text-[12px] font-bold text-yellow-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing & Submitting</span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08] mb-6">
              <div
                className="h-full bg-yellow-400 transition-all duration-300"
                style={{
                  width: `${(progressIndex / Math.max(1, totalStreams)) * 100}%`,
                }}
              />
            </div>

            {/* Live Progress Feed */}
            <div className="max-h-80 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/40 p-4 divide-y divide-white/[0.04]">
              {results.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-neutral-500">
                  Preparing first transaction…
                </div>
              ) : (
                results.map((res, i) => (
                  <div
                    key={res.id || i}
                    className="flex items-center justify-between py-2.5 text-[13px]"
                  >
                    <div className="flex items-center gap-3">
                      {res.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-mono font-bold text-white">
                          {res.qpId}
                        </span>
                        {res.email && (
                          <span className="text-neutral-400 text-[12px]">
                            {" "}
                            · {res.email}
                          </span>
                        )}
                        <span className="text-neutral-500 text-[12px]">
                          {" "}
                          ({res.amount} {res.token})
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      {res.status === "success" ? (
                        <span className="font-mono text-[11px] text-neutral-500">
                          Tx {res.txHash?.slice(0, 8)}…
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-red-400">
                          {res.error || "Failed"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: SUMMARY REPORT ───────────────────────────────────── */}
      {step === "summary" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h2 className="text-[22px] font-bold text-white tracking-tight">
              Batch Import Completed
            </h2>
            <p className="text-[14px] text-neutral-400 mt-1 max-w-[440px] mx-auto">
              Successfully created {successCount} out of {results.length} payroll
              streams on Stellar.
            </p>

            {/* Result Stats */}
            <div className="my-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-green-400">
                  Successful Streams
                </span>
                <p className="text-[24px] font-extrabold text-white mt-1">
                  {successCount}
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
                  Failed Streams
                </span>
                <p className="text-[24px] font-extrabold text-white mt-1">
                  {failureCount}
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-400">
                  Total Streaming
                </span>
                <p className="text-[20px] font-extrabold text-white mt-1">
                  {results
                    .filter((r) => r.status === "success")
                    .reduce((sum, r) => sum + r.amount, 0)
                    .toLocaleString()}{" "}
                  <span className="text-[12px] text-neutral-400">USDC/XLM</span>
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleDownloadSummary}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.12] transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download Batch Summary CSV</span>
              </button>

              <button
                onClick={() => {
                  setStep("upload");
                  setRows([]);
                  setResults([]);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.12] transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Import Another CSV</span>
              </button>

              <button
                onClick={() => void navigate("/dashboard")}
                className="rounded-xl bg-yellow-400 px-6 py-2.5 text-[13px] font-bold text-black hover:bg-yellow-300 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkPayrollImport;
