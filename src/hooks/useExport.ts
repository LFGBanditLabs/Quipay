import { useState, useCallback } from "react";
import { exportToCSV, exportToXLSX } from "../util/exportData";
import type { ExportFilters, StreamRecord } from "../util/exportData";
import toast from "react-hot-toast";

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
        } else {
          exportToXLSX(streams, filters);
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
