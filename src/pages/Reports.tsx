import React, { useState, useCallback } from "react";
import { useTransactionData } from "../hooks/useTransactionData";
import {
  exportTransactionsCSV,
  exportTransactionsPDF,
  exportPaycheckPDF,
  exportMonthlySummaryPDF,
} from "../services/reportService";
import type { PayrollTransaction } from "../types/reports";

const tw = {
  reportsPage:
    "min-h-screen bg-[linear-gradient(135deg,#0f172a_0%,#1e1b4b_50%,#0f172a_100%)] px-6 pb-16 pt-8 font-[Inter,sans-serif] text-slate-200",
  pageHeader: "mx-auto mb-8 max-w-[1200px]",
  pageTitle:
    "mb-1 text-[2rem] font-extrabold tracking-[-0.02em] text-transparent bg-[linear-gradient(135deg,#818cf8,#c084fc,#6366f1)] bg-clip-text",
  pageSubtitle: "m-0 text-[0.95rem] text-slate-400",
  tabBar:
    "mx-auto mb-6 flex max-w-[1200px] gap-1 rounded-xl border border-indigo-500/15 bg-slate-800/60 p-1 backdrop-blur-xl",
  tab: "flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-transparent px-4 py-3 text-sm font-semibold text-slate-400 transition-all duration-200 hover:bg-indigo-500/10 hover:text-indigo-200",
  tabActive:
    "bg-[linear-gradient(135deg,#4f46e5,#6366f1)] text-white shadow-[0_4px_15px_rgba(99,102,241,0.35)]",
  tabIcon: "text-[1.1rem]",
  card: "mx-auto mb-6 max-w-[1200px] rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-[20px]",
  cardHeader: "mb-5 flex flex-wrap items-center justify-between gap-3",
  cardTitle:
    "m-0 flex items-center gap-2 text-[1.15rem] font-bold text-slate-100",
  cardTitleIcon: "text-indigo-300",
  toolbar: "flex flex-wrap items-center gap-3",
  filterSelect:
    "min-w-[140px] rounded-lg border border-indigo-500/20 bg-slate-900/65 px-3 py-2 text-[0.825rem] text-slate-200 outline-none transition focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]",
  filterInput:
    "min-w-[140px] rounded-lg border border-indigo-500/20 bg-slate-900/65 px-3 py-2 text-[0.825rem] text-slate-200 outline-none transition focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]",
  btnGroup: "flex flex-wrap gap-2",
  btnExport:
    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[0.825rem] font-semibold transition-all duration-200",
  btnCSV:
    "bg-[linear-gradient(135deg,#059669,#10b981)] text-white hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(16,185,129,0.35)]",
  btnPDF:
    "bg-[linear-gradient(135deg,#dc2626,#ef4444)] text-white hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(239,68,68,0.35)]",
  btnSummaryPDF:
    "bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] text-white hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(99,102,241,0.4)]",
  btnPaycheck:
    "border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1.5 text-xs text-indigo-300 hover:-translate-y-px hover:bg-indigo-500/25 hover:text-indigo-200",
  kpiGrid: "mb-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4",
  kpi: "rounded-xl border border-indigo-500/10 bg-slate-900/50 p-[1.15rem] transition-all hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)]",
  kpiLabel:
    "mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-slate-500",
  kpiValue: "text-[1.4rem] font-extrabold text-slate-100",
  kpiHighlight: "text-indigo-300",
  kpiSuccess: "text-emerald-400",
  kpiWarning: "text-amber-300",
  kpiDanger: "text-rose-300",
  monthSelector: "flex flex-wrap gap-2",
  monthBtn:
    "rounded-lg border border-indigo-500/20 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-indigo-500/10",
  monthBtnActive:
    "border-indigo-400/40 bg-indigo-500/20 text-indigo-100 shadow-[0_0_0_1px_rgba(129,140,248,0.35)]",
  deptGrid: "grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4",
  deptCard: "rounded-xl border border-indigo-500/10 bg-slate-900/50 p-4",
  deptName: "text-sm font-semibold text-slate-100",
  deptMeta: "text-xs text-slate-400",
  deptAmount: "text-lg font-bold text-indigo-200",
  barTrack: "mt-2 h-2 overflow-hidden rounded-full bg-slate-700",
  barFill: "h-full rounded-full bg-[linear-gradient(90deg,#6366f1,#a78bfa)]",
  tableWrapper:
    "overflow-hidden rounded-xl border border-indigo-500/15 bg-slate-900/45",
  dataTable: "w-full border-collapse text-sm",
  amountCell: "font-semibold text-slate-100",
  statusBadge:
    "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold",
  statusDot: "h-1.5 w-1.5 rounded-full",
  statusCompleted: "bg-emerald-500/15 text-emerald-300",
  statusPending: "bg-amber-500/15 text-amber-300",
  statusFailed: "bg-rose-500/15 text-rose-300",
  dotCompleted: "bg-emerald-400",
  dotPending: "bg-amber-400",
  dotFailed: "bg-rose-400",
  emptyState:
    "rounded-xl border border-dashed border-slate-600 p-10 text-center",
  emptyIcon: "mb-2 text-3xl",
  toast:
    "fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-xl border border-indigo-400/35 bg-slate-900/90 px-4 py-3 text-sm font-medium text-indigo-100 shadow-2xl backdrop-blur",
  toastIcon: "text-base",
};

/* ── Helpers ──────────────────────────────────────────────────────── */

function fmtCurrency(n: number, c = "USDC") {
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortHash(h: string) {
  return h.length > 16 ? `${h.slice(0, 6)}…${h.slice(-6)}` : h;
}

type Tab = "transactions" | "monthly";

/* ── Status badge ─────────────────────────────────────────────────── */

const StatusBadge: React.FC<{ status: PayrollTransaction["status"] }> = ({
  status,
}) => {
  const map = {
    completed: { badge: tw.statusCompleted, dot: tw.dotCompleted },
    pending: { badge: tw.statusPending, dot: tw.dotPending },
    failed: { badge: tw.statusFailed, dot: tw.dotFailed },
  };
  const s = map[status];
  return (
    <span className={`${tw.statusBadge} ${s.badge}`}>
      <span className={`${tw.statusDot} ${s.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

/* ── Main component ──────────────────────────────────────────────── */

const Reports: React.FC = () => {
  const {
    filteredTransactions,
    monthlyTransactions,
    monthlySummary,
    filter,
    setFilter,
    selectedMonth,
    setSelectedMonth,
    availableMonths,
  } = useTransactionData();

  const [activeTab, setActiveTab] = useState<Tab>("transactions");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Export handlers ─────────────────────────────────────────── */

  const handleCSVExport = () => {
    exportTransactionsCSV(filteredTransactions);
    showToast("CSV exported successfully");
  };

  const handlePDFExport = () => {
    exportTransactionsPDF(filteredTransactions);
    showToast("PDF exported successfully");
  };

  const handlePaycheckPDF = (tx: PayrollTransaction) => {
    exportPaycheckPDF(tx);
    showToast(`Paycheck PDF generated for ${tx.employeeName}`);
  };

  const handleMonthlySummaryPDF = () => {
    exportMonthlySummaryPDF(monthlySummary, monthlyTransactions);
    showToast(`Monthly summary PDF generated for ${selectedMonth}`);
  };

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className={tw.reportsPage}>
      {/* Header */}
      <header className={tw.pageHeader}>
        <h1 className={tw.pageTitle}>Reports &amp; Exports</h1>
        <p className={tw.pageSubtitle}>
          Generate CSV &amp; PDF reports for accounting, taxes, and audits
        </p>
      </header>

      {/* Tabs */}
      <div className={tw.tabBar}>
        <button
          id="tab-transactions"
          className={`${tw.tab} ${activeTab === "transactions" ? tw.tabActive : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          <span className={tw.tabIcon}>📋</span>
          Transaction History
        </button>
        <button
          id="tab-monthly"
          className={`${tw.tab} ${activeTab === "monthly" ? tw.tabActive : ""}`}
          onClick={() => setActiveTab("monthly")}
        >
          <span className={tw.tabIcon}>📊</span>
          Monthly Summary
        </button>
      </div>

      {/* ── Transaction History Tab ─────────────────────────────── */}
      {activeTab === "transactions" && (
        <>
          <div className={tw.card}>
            <div className={tw.cardHeader}>
              <h2 className={tw.cardTitle}>
                <span className={tw.cardTitleIcon}>📋</span>
                Transaction History
              </h2>
              <div className={tw.toolbar}>
                <select
                  id="filter-status"
                  className={tw.filterSelect}
                  value={filter.status ?? "all"}
                  onChange={(e) =>
                    setFilter((f) => ({
                      ...f,
                      status: e.target.value as typeof f.status,
                    }))
                  }
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>

                <div className={tw.btnGroup}>
                  <button
                    id="btn-export-csv"
                    className={`${tw.btnExport} ${tw.btnCSV}`}
                    onClick={handleCSVExport}
                  >
                    📥 Export CSV
                  </button>
                  <button
                    id="btn-export-pdf"
                    className={`${tw.btnExport} ${tw.btnPDF}`}
                    onClick={handlePDFExport}
                  >
                    📄 Export PDF
                  </button>
                </div>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className={tw.emptyState}>
                <div className={tw.emptyIcon}>📭</div>
                <p>No transactions match the current filter.</p>
              </div>
            ) : (
              <div className={tw.tableWrapper}>
                <table className={tw.dataTable}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>TX Hash</th>
                      <th>Description</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>{fmtDate(tx.date)}</td>
                        <td>
                          {tx.employeeName}
                          <br />
                          <span
                            style={{ fontSize: "0.7rem", color: "#64748b" }}
                          >
                            {tx.employeeId}
                          </span>
                        </td>
                        <td className={tw.amountCell}>
                          {fmtCurrency(tx.amount, tx.currency)}
                        </td>
                        <td>
                          <StatusBadge status={tx.status} />
                        </td>
                        <td
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.75rem",
                          }}
                        >
                          {shortHash(tx.txHash)}
                        </td>
                        <td>{tx.description}</td>
                        <td>
                          <button
                            className={`${tw.btnExport} ${tw.btnPaycheck}`}
                            onClick={() => handlePaycheckPDF(tx)}
                            title="Download paycheck PDF"
                          >
                            📄 Paycheck
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Monthly Summary Tab ─────────────────────────────────── */}
      {activeTab === "monthly" && (
        <>
          {/* Month picker */}
          <div className={tw.card}>
            <div className={tw.cardHeader}>
              <h2 className={tw.cardTitle}>
                <span className={tw.cardTitleIcon}>📊</span>
                Monthly Summary — {selectedMonth}
              </h2>
              <div className={tw.toolbar}>
                <div className={tw.monthSelector}>
                  {availableMonths.map((m) => (
                    <button
                      key={m}
                      className={`${tw.monthBtn} ${m === selectedMonth ? tw.monthBtnActive : ""}`}
                      onClick={() => setSelectedMonth(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  id="btn-export-monthly-pdf"
                  className={`${tw.btnExport} ${tw.btnSummaryPDF}`}
                  onClick={handleMonthlySummaryPDF}
                >
                  📄 Download PDF Report
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div className={tw.kpiGrid}>
              <div className={tw.kpi}>
                <div className={tw.kpiLabel}>Total Payroll</div>
                <div className={`${tw.kpiValue} ${tw.kpiHighlight}`}>
                  {fmtCurrency(
                    monthlySummary.totalPayroll,
                    monthlySummary.currency,
                  )}
                </div>
              </div>
              <div className={tw.kpi}>
                <div className={tw.kpiLabel}>Transactions</div>
                <div className={tw.kpiValue}>
                  {monthlySummary.totalTransactions}
                </div>
              </div>
              <div className={tw.kpi}>
                <div className={tw.kpiLabel}>Completed</div>
                <div className={`${tw.kpiValue} ${tw.kpiSuccess}`}>
                  {monthlySummary.completedTransactions}
                </div>
              </div>
              <div className={tw.kpi}>
                <div className={tw.kpiLabel}>Pending</div>
                <div className={`${tw.kpiValue} ${tw.kpiWarning}`}>
                  {monthlySummary.pendingTransactions}
                </div>
              </div>
              <div className={tw.kpi}>
                <div className={tw.kpiLabel}>Failed</div>
                <div className={`${tw.kpiValue} ${tw.kpiDanger}`}>
                  {monthlySummary.failedTransactions}
                </div>
              </div>
              <div className={tw.kpi}>
                <div className={tw.kpiLabel}>Avg Payment</div>
                <div className={tw.kpiValue}>
                  {fmtCurrency(
                    monthlySummary.averagePayment,
                    monthlySummary.currency,
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Department Breakdown */}
          {monthlySummary.breakdown.length > 0 && (
            <div className={tw.card}>
              <h2 className={tw.cardTitle}>
                <span className={tw.cardTitleIcon}>🏢</span>
                Department Breakdown
              </h2>
              <div className={tw.deptGrid}>
                {monthlySummary.breakdown.map((dept) => {
                  const pct =
                    monthlySummary.totalPayroll > 0
                      ? (dept.totalAmount / monthlySummary.totalPayroll) * 100
                      : 0;
                  return (
                    <div key={dept.department} className={tw.deptCard}>
                      <div className={tw.deptName}>{dept.department}</div>
                      <div className={tw.deptMeta}>
                        <span>👤 {dept.employeeCount} employees</span>
                        <span>🔄 {dept.transactionCount} txns</span>
                      </div>
                      <div className={tw.deptAmount}>
                        {fmtCurrency(dept.totalAmount, monthlySummary.currency)}
                      </div>
                      <div className={tw.barTrack}>
                        <div
                          className={tw.barFill}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly transactions table */}
          <div className={tw.card}>
            <div className={tw.cardHeader}>
              <h2 className={tw.cardTitle}>
                <span className={tw.cardTitleIcon}>📋</span>
                Transactions in {selectedMonth}
              </h2>
            </div>
            <div className={tw.tableWrapper}>
              <table className={tw.dataTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>TX Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{fmtDate(tx.date)}</td>
                      <td>{tx.employeeName}</td>
                      <td className={tw.amountCell}>
                        {fmtCurrency(tx.amount, tx.currency)}
                      </td>
                      <td>
                        <StatusBadge status={tx.status} />
                      </td>
                      <td
                        style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                      >
                        {shortHash(tx.txHash)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={tw.toast}>
          <span className={tw.toastIcon}>✅</span>
          {toast}
        </div>
      )}
    </div>
  );
};

export default Reports;
