import * as XLSX from "xlsx";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateStreamProgress, Stream } from "../lib/streams";

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
  status?: "active" | "completed" | "cancelled" | "paused" | "all";
}

export interface StreamRecord {
  id: string;
  recipient: string;
  amount: string; // flowRate
  totalAmount?: string;
  totalPaid: string; // withdrawn
  status: "active" | "completed" | "cancelled" | "paused";
  startTime: number;
  endTime: number;
  curve?: "Linear" | "FrontLoaded" | "BackLoaded";
}

const formatRow = (stream: StreamRecord): ExportRow => ({
  "Stream ID": stream.id,
  "Worker Address": stream.recipient,
  "Amount/sec": stream.amount,
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

const getFileName = (ext: "csv" | "xlsx" | "pdf") => {
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

export const generatePayrollReport = (
  streams: StreamRecord[],
  from: Date,
  to: Date,
  formatType: "csv" | "pdf",
) => {
  const fromSec = from.getTime() / 1000;
  const toSec = to.getTime() / 1000;

  const calculateEarned = (stream: StreamRecord, timeSec: number) => {
    const s: Stream = {
      id: stream.id,
      recipient: stream.recipient,
      amount: Number(
        stream.totalAmount ||
          Number(stream.amount) * (stream.endTime - stream.startTime),
      ),
      startTime: stream.startTime,
      endTime: stream.endTime,
      status: stream.status,
      curve: stream.curve,
    };
    const progress = calculateStreamProgress(s, timeSec);
    return s.amount * progress;
  };

  const reportData = streams.map((stream) => {
    const earnedAtStart = calculateEarned(stream, fromSec);
    const earnedAtEnd = calculateEarned(stream, toSec);
    const earnedInPeriod = Math.max(0, earnedAtEnd - earnedAtStart);

    return {
      worker: stream.recipient,
      streamId: stream.id,
      earnedInPeriod,
      status: stream.status,
    };
  });

  const grouped: Record<string, typeof reportData> = {};
  reportData.forEach((row) => {
    if (!grouped[row.worker]) grouped[row.worker] = [];
    grouped[row.worker].push(row);
  });

  if (formatType === "csv") {
    const csvRows = [
      ["Worker Address", "Stream ID", "Status", "Earned in Period"],
    ];
    Object.entries(grouped).forEach(([worker, rows]) => {
      let workerTotal = 0;
      rows.forEach((row) => {
        csvRows.push([
          worker,
          row.streamId,
          row.status,
          row.earnedInPeriod.toFixed(7),
        ]);
        workerTotal += row.earnedInPeriod;
      });
      csvRows.push(["", "", "SUBTOTAL", workerTotal.toFixed(7)]);
    });

    const csvContent = csvRows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Payroll Report", 14, 22);
    doc.setFontSize(11);
    doc.text(
      `Period: ${format(from, "yyyy-MM-dd")} to ${format(to, "yyyy-MM-dd")}`,
      14,
      30,
    );

    const tableData: any[] = [];
    Object.entries(grouped).forEach(([worker, rows]) => {
      let workerTotal = 0;
      rows.forEach((row) => {
        tableData.push([
          worker,
          row.streamId,
          row.status,
          row.earnedInPeriod.toFixed(7),
        ]);
        workerTotal += row.earnedInPeriod;
      });
      tableData.push([
        {
          content: "Subtotal",
          colSpan: 3,
          styles: { halign: "right", fontStyle: "bold" },
        },
        { content: workerTotal.toFixed(7), styles: { fontStyle: "bold" } },
      ]);
    });

    autoTable(doc, {
      startY: 40,
      head: [["Worker Address", "Stream ID", "Status", "Earned"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [63, 81, 181] },
    });

    doc.save(`payroll-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }
};

