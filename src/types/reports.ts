/**
 * Types for the Reports module — CSV/PDF export and monthly summaries.
 */

export interface PayrollTransaction {
  id: string;
  date: string; // ISO 8601
  employeeName: string;
  employeeId: string;
  walletAddress: string;
  amount: number;
  currency: string;
  txHash: string;
  status: "completed" | "pending" | "failed";
  description: string;
}

export interface MonthlySummary {
  month: string; // e.g. "February 2026"
  totalPayroll: number;
  totalTransactions: number;
  completedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  averagePayment: number;
  largestPayment: number;
  smallestPayment: number;
  currency: string;
  breakdown: DepartmentBreakdown[];
}

export interface DepartmentBreakdown {
  department: string;
  totalAmount: number;
  employeeCount: number;
  transactionCount: number;
}

export type ReportFormat = "csv" | "pdf";

export type ReportType = "transaction-history" | "monthly-summary" | "paycheck";

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  status?: PayrollTransaction["status"] | "all";
  employeeId?: string;
  department?: string;
}
