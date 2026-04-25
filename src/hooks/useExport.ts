import { useState, useCallback } from "react";
import { exportToCSV, exportToXLSX } from "../util/exportData";
import type { ExportFilters, StreamRecord } from "../util/exportData";
import toast from "react-hot-toast";

/**
 * Handles exporting payroll stream records to CSV or XLSX format.
 *
 * Wraps the underlying export utilities with loading state management and
 * user-facing toast notifications for success and error feedback.
 *
 * @param streams - Array of stream records to export.
 * @returns An object containing the export handler and a loading flag.
 *
 * @example
 * ```tsx
 * const { handleExport, isExporting } = useExport(streams);
 * await handleExport("csv", { dateRange: "last30days" });
 * ```
 */
export const useExport = (streams: StreamRecord[]) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(
    async (format: "csv" | "xlsx", filters: ExportFilters) => {
      if (streams.length === 0) {
        toast.error("No data to export");
        return;
      }

      setIsExporting(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (format === "csv") {
          exportToCSV(streams, filters);
        } else if (format === "xlsx") {
          exportToXLSX(streams, filters);
        } else if (format === "pdf") {
          generatePayrollReport(streams, filters.from || new Date(0), filters.to || new Date(), "pdf");
        }
        toast.success(`Exported as ${format.toUpperCase()} successfully`);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Export failed. Please try again.";
        toast.error(message);
      } finally {
        setIsExporting(false);
      }
    },
    [streams],
  );

  return { handleExport, isExporting };
};
