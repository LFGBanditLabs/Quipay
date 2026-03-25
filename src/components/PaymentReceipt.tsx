/**
 * Payment Receipt Component
 * ─────────────────────────
 * Component for displaying and downloading payroll receipts.
 *
 * Features
 * ────────
 * • Display receipt metadata and details
 * • Download receipt as PDF or JSON
 * • Verify receipt authenticity
 * • Responsive design with mobile support
 */

import React, { useState } from "react";
import {
  Button,
  Card,
  Badge,
  Modal,
  Select,
  Loader,
  Notification,
} from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useNotification } from "../hooks/useNotification";
import { 
  mockReceiptService, 
  Receipt, 
  ReceiptType, 
  formatAmount, 
  formatDate, 
  shortenAddress, 
  getTokenSymbol, 
  getReceiptTypeColor 
} from "../util/receiptService";

// Props
interface PaymentReceiptProps {
  receiptId?: string;
  streamId?: string;
  visible?: boolean;
  onClose?: () => void;
}

// Styles
const tw = {
  wrapper: "w-full max-w-[600px]",
  header: "mb-6 flex items-start justify-between gap-4",
  title: "text-xl font-bold text-[var(--sds-color-content-primary,#0f172a)]",
  subtitle: "text-sm text-[var(--sds-color-content-secondary,#4b5563)]",
  grid: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-6",
  section: "space-y-3",
  sectionTitle: "text-lg font-semibold text-[var(--sds-color-content-primary,#0f172a)] mb-3",
  field: "flex justify-between items-center py-2 border-b border-[var(--sds-color-neutral-border,#e2e8f0)]",
  fieldLabel: "text-sm text-[var(--sds-color-content-secondary,#4b5563)]",
  fieldValue: "text-sm font-medium text-[var(--sds-color-content-primary,#0f172a)]",
  actions: "flex flex-wrap gap-3 mt-6",
  loadingContainer: "flex items-center justify-center py-12",
  receiptCard: "rounded-xl border border-[var(--sds-color-neutral-border,#e2e8f0)] bg-[var(--sds-color-background-primary,#fff)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]",
  statusBadge: "ml-auto",
  downloadSection: "mt-6 pt-6 border-t border-[var(--sds-color-neutral-border,#e2e8f0)]",
  downloadTitle: "text-lg font-semibold text-[var(--sds-color-content-primary,#0f172a)] mb-3",
  downloadOptions: "flex flex-wrap gap-3",
  verified: "text-[var(--sds-color-feedback-success)]",
  notVerified: "text-[var(--sds-color-feedback-error)]",
};

// Component
const PaymentReceipt: React.FC<PaymentReceiptProps> = ({
  receiptId,
  streamId,
  visible = false,
  onClose,
}) => {
  const { address } = useWallet();
  const { addNotification } = useNotification();
  
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'json'>('pdf');
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load receipt data
  const loadReceipt = React.useCallback(async () => {
    if (!receiptId && !streamId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      let targetReceiptId = receiptId;
      
      // If we have streamId, get receipt by stream
      if (streamId && !targetReceiptId) {
        targetReceiptId = await mockReceiptService.getReceiptByStream(streamId);
      }
      
      if (!targetReceiptId) {
        throw new Error("Receipt not found");
      }
      
      const receiptData = await mockReceiptService.getReceipt(targetReceiptId);
      if (!receiptData) {
        throw new Error("Receipt not found");
      }
      
      setReceipt(receiptData);
      
      // Verify receipt
      const verified = await mockReceiptService.verifyReceipt(targetReceiptId);
      setIsVerified(verified);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load receipt";
      setError(message);
      addNotification(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [receiptId, streamId, addNotification]);

  // Load receipt when component mounts or props change
  React.useEffect(() => {
    if (visible) {
      loadReceipt();
    }
  }, [visible, loadReceipt]);

  // Handle download
  const handleDownload = async () => {
    if (!receipt) return;
    
    setIsDownloading(true);
    
    try {
      const blob = await mockReceiptService.downloadReceipt(receipt.id, downloadFormat);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${receipt.id}.${downloadFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      addNotification(`Receipt downloaded as ${downloadFormat.toUpperCase()}`, "success");
      
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download receipt";
      addNotification(message, "error");
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle verification
  const handleVerify = async () => {
    if (!receipt) return;
    
    try {
      const verified = await mockReceiptService.verifyReceipt(receipt.id);
      setIsVerified(verified);
      
      addNotification(
        verified ? "Receipt verified successfully" : "Receipt verification failed",
        verified ? "success" : "error"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      addNotification(message, "error");
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} onClose={onClose}>
      <div className={tw.wrapper}>
        {/* Header */}
        <div className={tw.header}>
          <div>
            <h2 className={tw.title}>Payment Receipt</h2>
            <p className={tw.subtitle}>
              Official proof of income for payroll payments
            </p>
          </div>
          
          {receipt && (
            <div className={tw.statusBadge}>
              <Badge
                size="sm"
                variant={receipt.metadata.receipt_type === ReceiptType.Completed ? "success" : "error"}
              >
                {receipt.metadata.receipt_type}
              </Badge>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Notification
            variant="error"
            onClose={() => setError(null)}
            title="Receipt Error"
          >
            {error}
          </Notification>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className={tw.loadingContainer}>
            <Loader size="md" />
            <p>Loading receipt data...</p>
          </div>
        )}

        {/* Receipt Content */}
        {receipt && !isLoading && (
          <div className={tw.receiptCard}>
            {/* Verification Status */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Verification Status:</span>
              <span className={isVerified ? tw.verified : tw.notVerified}>
                {isVerified === null ? "Not verified" : isVerified ? "✓ Verified" : "✗ Invalid"}
              </span>
            </div>

            {/* Receipt Details */}
            <div className={tw.section}>
              <h3 className={tw.sectionTitle}>Receipt Details</h3>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>Receipt ID:</span>
                <span className={tw.fieldValue}>{receipt.id}</span>
              </div>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>Type:</span>
                <span 
                  className={tw.fieldValue}
                  style={{ color: getReceiptTypeColor(receipt.metadata.receipt_type) }}
                >
                  {receipt.metadata.receipt_type}
                </span>
              </div>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>Stream ID:</span>
                <span className={tw.fieldValue}>{receipt.metadata.stream_id}</span>
              </div>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>Minted Date:</span>
                <span className={tw.fieldValue}>
                  {formatDate(receipt.minted_at)}
                </span>
              </div>
            </div>

            {/* Payment Details */}
            <div className={tw.section}>
              <h3 className={tw.sectionTitle}>Payment Details</h3>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>Employer:</span>
                <span className={tw.fieldValue}>
                  {shortenAddress(receipt.metadata.employer)}
                </span>
              </div>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>Worker:</span>
                <span className={tw.fieldValue}>
                  {shortenAddress(receipt.metadata.worker)}
                </span>
              </div>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>Token:</span>
                <span className={tw.fieldValue}>
                  {getTokenSymbol(receipt.metadata.token)}
                </span>
              </div>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>Total Paid:</span>
                <span className={tw.fieldValue}>
                  {formatAmount(receipt.metadata.total_paid)} {getTokenSymbol(receipt.metadata.token)}
                </span>
              </div>
            </div>

            {/* Period Details */}
            <div className={tw.section}>
              <h3 className={tw.sectionTitle}>Payment Period</h3>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>Start Date:</span>
                <span className={tw.fieldValue}>
                  {formatDate(receipt.metadata.start_date)}
                </span>
              </div>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>End Date:</span>
                <span className={tw.fieldValue}>
                  {formatDate(receipt.metadata.end_date)}
                </span>
              </div>
              
              <div className={tw.field}>
                <span className={tw.fieldLabel}>Completion Date:</span>
                <span className={tw.fieldValue}>
                  {formatDate(receipt.metadata.completion_date)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className={tw.actions}>
              <Button
                variant="secondary"
                size="md"
                onClick={handleVerify}
                disabled={isLoading}
              >
                Verify Receipt
              </Button>
            </div>

            {/* Download Section */}
            <div className={tw.downloadSection}>
              <h3 className={tw.downloadTitle}>Download Receipt</h3>
              
              <div className={tw.downloadOptions}>
                <Select
                  id="format"
                  value={downloadFormat}
                  onChange={(e) => setDownloadFormat(e.target.value as 'pdf' | 'json')}
                  size="md"
                >
                  <option value="pdf">PDF</option>
                  <option value="json">JSON</option>
                </Select>
                
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? <Loader size="sm" /> : "Download"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PaymentReceipt;
