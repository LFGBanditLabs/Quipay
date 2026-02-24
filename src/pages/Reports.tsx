import React, { useState, useCallback } from "react";
import { useTransactionData } from "../hooks/useTransactionData";
import {
  exportTransactionsCSV,
  exportTransactionsPDF,
  exportPaycheckPDF,
  exportMonthlySummaryPDF,
} from "../services/reportService";
import type { PayrollTransaction } from "../types/reports";
import styles from "./Reports.module.css";

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
    completed: { badge: styles.statusCompleted, dot: styles.dotCompleted },
    pending: { badge: styles.statusPending, dot: styles.dotPending },
    failed: { badge: styles.statusFailed, dot: styles.dotFailed },
  };
  const s = map[status];
  return (
    <span className={`${styles.statusBadge} ${s.badge}`}>
      <span className={`${styles.statusDot} ${s.dot}`} />
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
    <div className={styles.reportsPage}>
      {/* Header */}
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Reports &amp; Exports</h1>
        <p className={styles.pageSubtitle}>
          Generate CSV &amp; PDF reports for accounting, taxes, and audits
        </p>
      </header>

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button
          id="tab-transactions"
          className={`${styles.tab} ${activeTab === "transactions" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          <span className={styles.tabIcon}>📋</span>
          Transaction History
        </button>
        <button
          id="tab-monthly"
          className={`${styles.tab} ${activeTab === "monthly" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("monthly")}
        >
          <span className={styles.tabIcon}>📊</span>
          Monthly Summary
        </button>
      </div>

      {/* ── Transaction History Tab ─────────────────────────────── */}
      {activeTab === "transactions" && (
        <>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardTitleIcon}>📋</span>
                Transaction History
              </h2>
              <div className={styles.toolbar}>
                <select
                  id="filter-status"
                  className={styles.filterSelect}
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

                <div className={styles.btnGroup}>
                  <button
                    id="btn-export-csv"
                    className={`${styles.btnExport} ${styles.btnCSV}`}
                    onClick={handleCSVExport}
                  >
                    📥 Export CSV
                  </button>
                  <button
                    id="btn-export-pdf"
                    className={`${styles.btnExport} ${styles.btnPDF}`}
                    onClick={handlePDFExport}
                  >
                    📄 Export PDF
                  </button>
                </div>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📭</div>
                <p>No transactions match the current filter.</p>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.dataTable}>
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
                        <td className={styles.amountCell}>
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
                            className={`${styles.btnExport} ${styles.btnPaycheck}`}
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
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardTitleIcon}>📊</span>
                Monthly Summary — {selectedMonth}
              </h2>
              <div className={styles.toolbar}>
                <div className={styles.monthSelector}>
                  {availableMonths.map((m) => (
                    <button
                      key={m}
                      className={`${styles.monthBtn} ${m === selectedMonth ? styles.monthBtnActive : ""}`}
                      onClick={() => setSelectedMonth(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  id="btn-export-monthly-pdf"
                  className={`${styles.btnExport} ${styles.btnSummaryPDF}`}
                  onClick={handleMonthlySummaryPDF}
                >
                  📄 Download PDF Report
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div className={styles.kpiGrid}>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Total Payroll</div>
                <div className={`${styles.kpiValue} ${styles.kpiHighlight}`}>
                  {fmtCurrency(
                    monthlySummary.totalPayroll,
                    monthlySummary.currency,
                  )}
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Transactions</div>
                <div className={styles.kpiValue}>
                  {monthlySummary.totalTransactions}
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Completed</div>
                <div className={`${styles.kpiValue} ${styles.kpiSuccess}`}>
                  {monthlySummary.completedTransactions}
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Pending</div>
                <div className={`${styles.kpiValue} ${styles.kpiWarning}`}>
                  {monthlySummary.pendingTransactions}
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Failed</div>
                <div className={`${styles.kpiValue} ${styles.kpiDanger}`}>
                  {monthlySummary.failedTransactions}
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Avg Payment</div>
                <div className={styles.kpiValue}>
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
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardTitleIcon}>🏢</span>
                Department Breakdown
              </h2>
              <div className={styles.deptGrid}>
                {monthlySummary.breakdown.map((dept) => {
                  const pct =
                    monthlySummary.totalPayroll > 0
                      ? (dept.totalAmount / monthlySummary.totalPayroll) * 100
                      : 0;
                  return (
                    <div key={dept.department} className={styles.deptCard}>
                      <div className={styles.deptName}>{dept.department}</div>
                      <div className={styles.deptMeta}>
                        <span>👤 {dept.employeeCount} employees</span>
                        <span>🔄 {dept.transactionCount} txns</span>
                      </div>
                      <div className={styles.deptAmount}>
                        {fmtCurrency(dept.totalAmount, monthlySummary.currency)}
                      </div>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
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
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardTitleIcon}>📋</span>
                Transactions in {selectedMonth}
              </h2>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
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
                      <td className={styles.amountCell}>
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
        <div className={styles.toast}>
          <span className={styles.toastIcon}>✅</span>
          {toast}
        </div>
      )}
    </div>
  );
};

export default Reports;
