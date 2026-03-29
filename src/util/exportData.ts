import * as XLSX from "xlsx";
import { format } from "date-fns";

export interface ExportRow {
  "Stream ID": string;
  "Worker Address": string;
  "Amount/sec": string;
  "Total Paid": string;
  Status: string;
  "Created Date": string;
  "Cancelled Date": string;
}

export interface ExportFilters {
  from?: Date;
  to?: Date;
  status?: "active" | "completed" | "cancelled" | "all";
}

export interface StreamRecord {
  id: string;
  recipient: string;
  amount: string; // was amountPerSec
  totalPaid: string;
  status: "active" | "completed" | "cancelled";
  startTime: number;
  endTime?: number;
}

const formatRow = (stream: StreamRecord): ExportRow => ({
  "Stream ID": stream.id,
  "Worker Address": stream.recipient,
  "Amount/sec": stream.amount, // was stream.amountPerSec
  "Total Paid": stream.totalPaid,
  Status: stream.status,
  "Created Date": format(
    new Date(stream.startTime * 1000),
    "yyyy-MM-dd HH:mm:ss",
  ),
  "Cancelled Date": stream.endTime
    ? format(new Date(stream.endTime * 1000), "yyyy-MM-dd HH:mm:ss")
    : "—",
});

const applyFilters = (
  streams: StreamRecord[],
  filters: ExportFilters,
): StreamRecord[] => {
  return streams.filter((stream) => {
    const created = new Date(stream.startTime * 1000);
    if (filters.from && created < filters.from) return false;
    if (filters.to && created > filters.to) return false;
    if (
      filters.status &&
      filters.status !== "all" &&
      stream.status !== filters.status
    )
      return false;
    return true;
  });
};

const getFileName = (ext: "csv" | "xlsx") => {
  const date = format(new Date(), "yyyy-MM-dd");
  return `quipay-streams-${date}.${ext}`;
};

export const exportToCSV = (
  streams: StreamRecord[],
  filters: ExportFilters,
) => {
  const filtered = applyFilters(streams, filters);
  const rows = filtered.map(formatRow);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Streams");
  XLSX.writeFile(wb, getFileName("csv"), { bookType: "csv" });
};

export const exportToXLSX = (
  streams: StreamRecord[],
  filters: ExportFilters,
) => {
  const filtered = applyFilters(streams, filters);
  const rows = filtered.map(formatRow);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 20 },
    { wch: 44 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Streams");
  XLSX.writeFile(wb, getFileName("xlsx"));
};
