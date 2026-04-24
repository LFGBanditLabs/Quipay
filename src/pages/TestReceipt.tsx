import React, { useEffect, useMemo, useState } from "react";
import { getReceiptById } from "../contracts/payroll_stream";
import {
  exportOnChainReceiptPDF,
  exportPaycheckPDF,
} from "../services/reportService";
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
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const receiptId = params.get("receiptId");
  const sourceAddress =
    params.get("source") ??
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const [statusText, setStatusText] = useState(
    receiptId
      ? `Attempting on-chain receipt export for receipt ${receiptId}`
      : "Using demo paycheck data",
  );

  const downloadReceipt = async () => {
    if (!receiptId) {
      await exportPaycheckPDF(DemoTransaction);
      return;
    }

    const receipt = await getReceiptById(sourceAddress, BigInt(receiptId));
    if (!receipt) {
      setStatusText(
        `Receipt ${receiptId} was not found on chain, using demo data`,
      );
      await exportPaycheckPDF(DemoTransaction);
      return;
    }

    setStatusText(`Exporting on-chain receipt ${receiptId}`);
    await exportOnChainReceiptPDF(receipt, { sourceAddress });
  };

  useEffect(() => {
    void (async () => {
      try {
        await downloadReceipt();
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Test Paycheck Receipt</h2>
      <p>{statusText}</p>
      <button onClick={() => void downloadReceipt()}>
        Download Test Paycheck
      </button>
    </div>
  );
};

export default TestReceipt;
