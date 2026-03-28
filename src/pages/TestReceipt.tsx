import React, { useEffect } from "react";
import { exportPaycheckPDF } from "../services/reportService";
import type { PayrollTransaction } from "../types/reports";

const DemoTransaction: PayrollTransaction = {
  id: "TXN-TEST-001",
  date: new Date().toISOString(),
  employeeName: "Test Employee",
  employeeId: "EMP-TEST",
  walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  amount: 1234.56,
  currency: "USDC",
  txHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  status: "completed",
  description: "Automated test paycheck",
};

const TestReceipt: React.FC = () => {
  useEffect(() => {
    void (async () => {
      try {
        await exportPaycheckPDF(DemoTransaction);
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Test Paycheck Receipt</h2>
      <p>This page triggers a paycheck PDF download for test purposes.</p>
      <button onClick={() => void exportPaycheckPDF(DemoTransaction)}>
        Download Test Paycheck
      </button>
    </div>
  );
};

export default TestReceipt;
