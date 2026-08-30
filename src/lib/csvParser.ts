/**
 * csvParser.ts
 * ────────────
 * Lightweight, robust CSV parsing, validation, and export utilities for
 * bulk payroll imports. Supports both standard total-amount streams and
 * hourly-rate calculations.
 */

export interface ParsedPayrollRow {
  id: string;
  rowIndex: number;
  email: string;
  qpId: string;
  amount: number;
  hourlyRate?: number;
  hoursPerWeek?: number;
  token: "USDC" | "XLM" | string;
  startDate: string;
  endDate: string;
  startTs: number;
  endTs: number;
  durationDays: number;
  workerAddress?: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  raw: Record<string, string>;
}

export interface PayrollValidationSummary {
  rows: ParsedPayrollRow[];
  totalRows: number;
  validRows: ParsedPayrollRow[];
  invalidRows: ParsedPayrollRow[];
  validCount: number;
  errorCount: number;
  totalsByToken: Record<string, number>;
  duplicateQpIds: string[];
}

/**
 * Parses raw CSV text into array of object records.
 * Correctly handles quotes, commas in quotes, whitespace, and CRLF line breaks.
 */
export function parseCsvText(csvText: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const cleanText = csvText.trim();
  if (!cleanText) {
    return { headers: [], rows: [] };
  }

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // End of quoted string
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\r" || char === "\n") {
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = lines[0];
  const normalizedHeaders = rawHeaders.map((h) =>
    h
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, ""),
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const record: Record<string, string> = {};
    normalizedHeaders.forEach((header, colIndex) => {
      record[header] = line[colIndex] ?? "";
    });
    rows.push(record);
  }

  return { headers: normalizedHeaders, rows };
}

/**
 * Normalizes field aliases in CSV columns (e.g. qp_id vs quipay_id).
 */
function extractFieldValue(
  record: Record<string, string>,
  aliases: string[],
): string {
  for (const alias of aliases) {
    if (record[alias] !== undefined && record[alias] !== "") {
      return record[alias].trim();
    }
  }
  return "";
}

/**
 * Validates and normalizes a date string, returning Unix seconds and ISO date string.
 */
export function parseDateToUnixSeconds(dateStr: string): {
  timestamp: number;
  formattedDate: string;
  isValid: boolean;
} {
  if (!dateStr) return { timestamp: 0, formattedDate: "", isValid: false };

  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) {
    // Check if it's purely numeric timestamp
    const num = Number(dateStr);
    if (!isNaN(num) && num > 1e9) {
      const ts = num > 1e11 ? Math.floor(num / 1000) : num;
      const d = new Date(ts * 1000);
      return {
        timestamp: ts,
        formattedDate: d.toISOString().split("T")[0],
        isValid: true,
      };
    }
    return { timestamp: 0, formattedDate: "", isValid: false };
  }

  const d = new Date(parsed);
  const ts = Math.floor(d.getTime() / 1000);
  return {
    timestamp: ts,
    formattedDate: d.toISOString().split("T")[0],
    isValid: true,
  };
}

/**
 * Validates a single payroll record.
 */
export function validatePayrollRow(
  record: Record<string, string> | Partial<ParsedPayrollRow>,
  rowIndex: number,
  seenQpIds?: Set<string>,
  resolvedWorkers?: Record<
    string,
    { walletStellar: string | null; email?: string | null }
  >,
): ParsedPayrollRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  let email = "";
  let qpId = "";
  let rawAmount = "";
  let rawHourlyRate = "";
  let rawHoursPerWeek = "";
  let rawToken = "";
  let rawStartDate = "";
  let rawEndDate = "";

  if ("raw" in record && record.raw) {
    const raw = record.raw;
    email = extractFieldValue(raw, ["email", "worker_email", "mail"]);
    qpId = extractFieldValue(raw, [
      "qp_id",
      "qpid",
      "quipay_id",
      "quipayid",
      "worker_id",
    ]);
    rawAmount = extractFieldValue(raw, [
      "amount",
      "total_amount",
      "total",
      "pay",
    ]);
    rawHourlyRate = extractFieldValue(raw, [
      "hourly_rate",
      "hourlyrate",
      "rate_per_hour",
      "hourly",
    ]);
    rawHoursPerWeek = extractFieldValue(raw, [
      "hours_per_week",
      "hoursperweek",
      "hours_week",
      "hours",
    ]);
    rawToken = extractFieldValue(raw, [
      "token",
      "currency",
      "asset",
      "symbol",
    ]);
    rawStartDate = extractFieldValue(raw, [
      "start_date",
      "startdate",
      "start",
      "from",
    ]);
    rawEndDate = extractFieldValue(raw, [
      "end_date",
      "enddate",
      "end",
      "to",
      "until",
    ]);
  } else {
    const r = record as Record<string, string>;
    email = extractFieldValue(r, ["email", "worker_email", "mail"]);
    qpId = extractFieldValue(r, [
      "qp_id",
      "qpid",
      "quipay_id",
      "quipayid",
      "worker_id",
    ]);
    rawAmount = extractFieldValue(r, [
      "amount",
      "total_amount",
      "total",
      "pay",
    ]);
    rawHourlyRate = extractFieldValue(r, [
      "hourly_rate",
      "hourlyrate",
      "rate_per_hour",
      "hourly",
    ]);
    rawHoursPerWeek = extractFieldValue(r, [
      "hours_per_week",
      "hoursperweek",
      "hours_week",
      "hours",
    ]);
    rawToken = extractFieldValue(r, ["token", "currency", "asset", "symbol"]);
    rawStartDate = extractFieldValue(r, [
      "start_date",
      "startdate",
      "start",
      "from",
    ]);
    rawEndDate = extractFieldValue(r, [
      "end_date",
      "enddate",
      "end",
      "to",
      "until",
    ]);
  }

  // Normalize QP ID
  qpId = qpId.toUpperCase().trim();

  // Validate QP ID
  if (!qpId) {
    errors.push("Missing QP ID");
  } else if (!/^QP\d+$/i.test(qpId)) {
    errors.push("Invalid QP ID format (must be like QP100000042)");
  } else if (seenQpIds && seenQpIds.has(qpId)) {
    errors.push(`Duplicate QP ID "${qpId}" in CSV`);
  }

  // Validate Email
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    warnings.push("Email address looks invalid");
  }

  // Validate Token
  const tokenUpper = (rawToken || "USDC").toUpperCase().trim();
  let token: "USDC" | "XLM" | string = tokenUpper;
  if (!rawToken) {
    token = "USDC"; // Default to USDC if omitted
  } else if (tokenUpper !== "USDC" && tokenUpper !== "XLM") {
    errors.push(`Unsupported token "${rawToken}" (must be USDC or XLM)`);
  }

  // Validate Dates
  const parsedStart = parseDateToUnixSeconds(rawStartDate);
  const parsedEnd = parseDateToUnixSeconds(rawEndDate);

  let startTs = parsedStart.timestamp;
  let endTs = parsedEnd.timestamp;
  let startDate = parsedStart.formattedDate;
  let endDate = parsedEnd.formattedDate;

  if (!rawStartDate) {
    errors.push("Missing start_date");
  } else if (!parsedStart.isValid) {
    errors.push(`Invalid start_date "${rawStartDate}" (use YYYY-MM-DD)`);
  }

  if (!rawEndDate) {
    errors.push("Missing end_date");
  } else if (!parsedEnd.isValid) {
    errors.push(`Invalid end_date "${rawEndDate}" (use YYYY-MM-DD)`);
  }

  if (parsedStart.isValid && parsedEnd.isValid) {
    if (endTs <= startTs) {
      errors.push("end_date must be after start_date");
    }
  }

  const durationSecs = Math.max(0, endTs - startTs);
  const durationDays = Math.max(0, Math.round(durationSecs / 86400));

  // Validate Amount & Hourly Rate
  let amount = 0;
  let hourlyRate: number | undefined;
  let hoursPerWeek: number | undefined;

  if (rawAmount) {
    const parsedAmt = parseFloat(rawAmount.trim());
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      errors.push("Amount must be a positive number greater than 0");
    } else {
      amount = parsedAmt;
    }
  } else if (rawHourlyRate && rawHoursPerWeek) {
    const parsedRate = parseFloat(rawHourlyRate.trim());
    const parsedHours = parseFloat(rawHoursPerWeek.trim());

    if (isNaN(parsedRate) || parsedRate <= 0) {
      errors.push("Hourly rate must be a positive number greater than 0");
    } else {
      hourlyRate = parsedRate;
    }
    if (isNaN(parsedHours) || parsedHours <= 0) {
      errors.push("Hours per week must be greater than 0");
    } else {
      hoursPerWeek = parsedHours;
    }

    if (
      !isNaN(parsedRate) &&
      parsedRate > 0 &&
      !isNaN(parsedHours) &&
      parsedHours > 0 &&
      durationSecs > 0
    ) {
      const weeks = durationSecs / (7 * 86400);
      amount = Math.round(parsedRate * parsedHours * weeks * 100) / 100;
    }
  } else {
    errors.push("Missing amount or (hourly_rate & hours_per_week)");
  }

  // Validate resolution against workforce registry if provided
  let workerAddress: string | undefined;
  if (resolvedWorkers && qpId) {
    const resolved = resolvedWorkers[qpId];
    if (resolved) {
      if (resolved.walletStellar) {
        workerAddress = resolved.walletStellar;
        if (!email && resolved.email) {
          email = resolved.email;
        }
      } else {
        errors.push(`QP ID "${qpId}" has no active Stellar wallet registered`);
      }
    } else {
      errors.push(`QP ID "${qpId}" not found in workforce registry`);
    }
  }

  return {
    id: `row-${rowIndex}-${qpId || Math.random().toString(36).slice(2, 7)}`,
    rowIndex,
    email,
    qpId,
    amount: isNaN(amount) ? 0 : amount,
    hourlyRate,
    hoursPerWeek,
    token,
    startDate,
    endDate,
    startTs,
    endTs,
    durationDays,
    workerAddress,
    isValid: errors.length === 0,
    errors,
    warnings,
    raw: record as Record<string, string>,
  };
}

/**
 * Parses and validates an entire CSV string.
 */
export function parseAndValidatePayrollCsv(
  csvText: string,
  resolvedWorkers?: Record<
    string,
    { walletStellar: string | null; email?: string | null }
  >,
): PayrollValidationSummary {
  const { rows: rawRows } = parseCsvText(csvText);

  const seenQpIds = new Set<string>();
  const duplicateQpIds: string[] = [];
  const parsedRows: ParsedPayrollRow[] = [];
  const totalsByToken: Record<string, number> = {};

  rawRows.forEach((record, idx) => {
    const qpIdCandidate = extractFieldValue(record, [
      "qp_id",
      "qpid",
      "quipay_id",
      "quipayid",
      "worker_id",
    ])
      .toUpperCase()
      .trim();

    if (qpIdCandidate) {
      if (seenQpIds.has(qpIdCandidate)) {
        duplicateQpIds.push(qpIdCandidate);
      } else {
        seenQpIds.add(qpIdCandidate);
      }
    }

    const validated = validatePayrollRow(
      record,
      idx + 1,
      duplicateQpIds.includes(qpIdCandidate) ? seenQpIds : undefined,
      resolvedWorkers,
    );

    parsedRows.push(validated);

    if (validated.isValid && validated.amount > 0) {
      totalsByToken[validated.token] =
        (totalsByToken[validated.token] || 0) + validated.amount;
    }
  });

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validRows,
    invalidRows,
    validCount: validRows.length,
    errorCount: invalidRows.length,
    totalsByToken,
    duplicateQpIds,
  };
}

/**
 * Exports validation errors to CSV string.
 */
export function exportErrorsToCsv(rows: ParsedPayrollRow[]): string {
  const headers = [
    "Row",
    "QP ID",
    "Email",
    "Amount",
    "Token",
    "Start Date",
    "End Date",
    "Errors",
  ];
  const errorLines = rows
    .filter((r) => !r.isValid)
    .map((r) => [
      r.rowIndex,
      `"${r.qpId}"`,
      `"${r.email}"`,
      r.amount,
      r.token,
      r.startDate,
      r.endDate,
      `"${r.errors.join("; ")}"`,
    ]);

  return [headers.join(","), ...errorLines.map((l) => l.join(","))].join("\n");
}

/**
 * Exports batch execution results summary to CSV string.
 */
export function exportSummaryToCsv(
  results: Array<{
    rowIndex?: number;
    qpId: string;
    email?: string;
    amount: number;
    token: string;
    workerAddress?: string;
    status: "success" | "error";
    txHash?: string;
    streamId?: string;
    error?: string;
  }>,
): string {
  const headers = [
    "Row",
    "QP ID",
    "Email",
    "Amount",
    "Token",
    "Worker Address",
    "Status",
    "Stream ID / Tx Hash",
    "Error Details",
  ];

  const lines = results.map((r, i) => [
    r.rowIndex ?? i + 1,
    `"${r.qpId}"`,
    `"${r.email || ""}"`,
    r.amount,
    r.token,
    `"${r.workerAddress || ""}"`,
    r.status.toUpperCase(),
    `"${r.streamId || r.txHash || ""}"`,
    `"${r.error || ""}"`,
  ]);

  return [headers.join(","), ...lines.map((l) => l.join(","))].join("\n");
}

/**
 * Triggers client-side browser download for generated CSV.
 */
export function downloadCsvFile(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads standard template CSV.
 */
export function downloadTemplateCsv(): void {
  const template = `email,qp_id,amount,token,start_date,end_date\nalice@company.com,QP100000042,5000,USDC,2026-09-01,2027-08-31\nbob@company.com,QP100000043,3500,USDC,2026-09-01,2027-08-31\ncharlie@company.com,QP100000044,1200,XLM,2026-09-01,2027-08-31\n`;
  downloadCsvFile(template, "payroll-import-template.csv");
}
