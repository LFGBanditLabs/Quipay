import React, { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Trash2,
  Download,
  Filter,
  AlertTriangle,
} from "lucide-react";
import {
  type ParsedPayrollRow,
  validatePayrollRow,
} from "../lib/csvParser";

interface PayrollPreviewTableProps {
  rows: ParsedPayrollRow[];
  onUpdateRow: (row: ParsedPayrollRow) => void;
  onDeleteRow: (rowId: string) => void;
  onDeleteInvalidRows: () => void;
  onDownloadErrors: () => void;
  resolvedWorkers?: Record<
    string,
    { walletStellar: string | null; email?: string | null }
  >;
}

export const PayrollPreviewTable: React.FC<PayrollPreviewTableProps> = ({
  rows,
  onUpdateRow,
  onDeleteRow,
  onDeleteInvalidRows,
  onDownloadErrors,
  resolvedWorkers,
}) => {
  const [filter, setFilter] = useState<"all" | "valid" | "invalid">("all");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);

  const filteredRows = rows.filter((r) => {
    if (filter === "valid") return r.isValid;
    if (filter === "invalid") return !r.isValid;
    return true;
  });

  const handleFieldChange = (
    row: ParsedPayrollRow,
    field: keyof ParsedPayrollRow,
    value: unknown,
  ) => {
    const updatedRaw = {
      ...row.raw,
      [field === "qpId"
        ? "qp_id"
        : field === "startDate"
          ? "start_date"
          : field === "endDate"
            ? "end_date"
            : String(field)]: String(value),
    };

    const revalidated = validatePayrollRow(
      { ...row, [field]: value, raw: updatedRaw },
      row.rowIndex,
      undefined,
      resolvedWorkers,
    );

    onUpdateRow(revalidated);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controls / Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0c0c0c] p-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-neutral-500 ml-1 mr-1" />
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors ${
              filter === "all"
                ? "bg-white/[0.12] text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            All ({rows.length})
          </button>
          <button
            onClick={() => setFilter("valid")}
            className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors ${
              filter === "valid"
                ? "bg-green-500/20 text-green-400"
                : "text-neutral-400 hover:text-green-400"
            }`}
          >
            Valid ({validRows.length})
          </button>
          <button
            onClick={() => setFilter("invalid")}
            className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors ${
              filter === "invalid"
                ? "bg-red-500/20 text-red-400"
                : "text-neutral-400 hover:text-red-400"
            }`}
          >
            Needs Attention ({invalidRows.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {invalidRows.length > 0 && (
            <>
              <button
                onClick={onDownloadErrors}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-[12px] font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                title="Download CSV report of invalid rows"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Errors</span>
              </button>
              <button
                onClick={onDeleteInvalidRows}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[12px] font-medium text-neutral-300 hover:bg-white/[0.08] transition-colors"
                title="Delete all rows containing validation errors"
              >
                <Trash2 className="h-3.5 w-3.5 text-neutral-400" />
                <span>Remove Invalid</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0a0a0a]">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-white/[0.08] bg-neutral-900/60 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              <th className="py-3 px-3.5 text-center w-10">Status</th>
              <th className="py-3 px-3 w-12 text-center">#</th>
              <th className="py-3 px-4">QP ID</th>
              <th className="py-3 px-4">Worker / Email</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-3 w-24">Token</th>
              <th className="py-3 px-4">Start Date</th>
              <th className="py-3 px-4">End Date</th>
              <th className="py-3 px-4">Validation / Errors</th>
              <th className="py-3 px-3 text-center w-12">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-neutral-500">
                  No payroll rows matching current filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const isEditing = editingRowId === row.id;

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      !row.isValid
                        ? "bg-red-500/[0.04] hover:bg-red-500/[0.08]"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Status icon */}
                    <td className="py-3 px-3.5 text-center align-top pt-3.5">
                      {row.isValid ? (
                        <CheckCircle2
                          className="h-4 w-4 text-emerald-400 mx-auto"
                          title="Valid row"
                        />
                      ) : (
                        <AlertCircle
                          className="h-4 w-4 text-rose-400 mx-auto"
                          title="Row has errors"
                        />
                      )}
                    </td>

                    {/* Row Index */}
                    <td className="py-3 px-3 text-center font-mono text-[11px] text-neutral-500 align-top pt-3.5">
                      {row.rowIndex}
                    </td>

                    {/* QP ID */}
                    <td className="py-2.5 px-4 align-top">
                      <input
                        value={row.qpId}
                        onChange={(e) =>
                          handleFieldChange(row, "qpId", e.target.value)
                        }
                        placeholder="QP100000042"
                        className="w-32 rounded-lg bg-neutral-900/80 border border-neutral-700/60 px-2 py-1 font-mono text-[12px] text-white focus:border-yellow-400 focus:outline-none"
                      />
                    </td>

                    {/* Email */}
                    <td className="py-2.5 px-4 align-top">
                      <input
                        value={row.email}
                        onChange={(e) =>
                          handleFieldChange(row, "email", e.target.value)
                        }
                        placeholder="employee@company.com"
                        className="w-44 rounded-lg bg-neutral-900/80 border border-neutral-700/60 px-2 py-1 text-[12px] text-neutral-200 focus:border-yellow-400 focus:outline-none"
                      />
                    </td>

                    {/* Amount */}
                    <td className="py-2.5 px-4 align-top">
                      <input
                        type="number"
                        step="any"
                        value={row.amount || ""}
                        onChange={(e) =>
                          handleFieldChange(
                            row,
                            "amount",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        placeholder="5000"
                        className="w-24 rounded-lg bg-neutral-900/80 border border-neutral-700/60 px-2 py-1 font-mono text-[12px] text-white text-right focus:border-yellow-400 focus:outline-none"
                      />
                    </td>

                    {/* Token */}
                    <td className="py-2.5 px-3 align-top">
                      <select
                        value={row.token}
                        onChange={(e) =>
                          handleFieldChange(row, "token", e.target.value)
                        }
                        className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700/60 px-2 py-1 text-[12px] font-semibold text-white focus:border-yellow-400 focus:outline-none cursor-pointer"
                      >
                        <option value="USDC">USDC</option>
                        <option value="XLM">XLM</option>
                      </select>
                    </td>

                    {/* Start Date */}
                    <td className="py-2.5 px-4 align-top">
                      <input
                        type="date"
                        value={row.startDate}
                        onChange={(e) =>
                          handleFieldChange(row, "startDate", e.target.value)
                        }
                        className="w-32 rounded-lg bg-neutral-900/80 border border-neutral-700/60 px-2 py-1 text-[11px] text-neutral-300 focus:border-yellow-400 focus:outline-none"
                      />
                    </td>

                    {/* End Date */}
                    <td className="py-2.5 px-4 align-top">
                      <input
                        type="date"
                        value={row.endDate}
                        onChange={(e) =>
                          handleFieldChange(row, "endDate", e.target.value)
                        }
                        className="w-32 rounded-lg bg-neutral-900/80 border border-neutral-700/60 px-2 py-1 text-[11px] text-neutral-300 focus:border-yellow-400 focus:outline-none"
                      />
                    </td>

                    {/* Validation Errors & Details */}
                    <td className="py-3 px-4 align-top">
                      {row.errors.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {row.errors.map((err, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400 border border-red-500/20"
                            >
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              {err}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[12px] text-neutral-400">
                          <span>{row.durationDays} days</span>
                          {row.workerAddress && (
                            <span className="font-mono text-[10px] text-neutral-500">
                              ({row.workerAddress.slice(0, 4)}…{row.workerAddress.slice(-4)})
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Delete action */}
                    <td className="py-2.5 px-3 text-center align-top pt-3">
                      <button
                        type="button"
                        onClick={() => onDeleteRow(row.id)}
                        className="rounded-lg p-1.5 text-neutral-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        title="Delete row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayrollPreviewTable;
