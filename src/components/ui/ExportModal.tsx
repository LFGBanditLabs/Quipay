import { useState } from "react";
import type { ExportFilters } from "../../util/exportData";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: "csv" | "xlsx", filters: ExportFilters) => void;
  isExporting: boolean;
}

export const ExportModal = ({
  isOpen,
  onClose,
  onExport,
  isExporting,
}: ExportModalProps) => {
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<ExportFilters["status"]>("all");

  if (!isOpen) return null;

  const handleSubmit = () => {
    onExport(format, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      status,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 shadow-xl space-y-5">
        <h2
          id="export-modal-title"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Export Stream History
        </h2>

        {/* Format */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Format
          </label>
          <div className="flex gap-3">
            {(["csv", "xlsx"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  format === f
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              To
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* Status filter */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Status
          </label>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as ExportFilters["status"])
            }
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--color-border)] py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isExporting}
            className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
          >
            {isExporting ? "Exporting..." : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
};
