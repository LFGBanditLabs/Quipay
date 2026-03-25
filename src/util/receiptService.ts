/**
 * Payroll Receipt Service
 * ───────────────────────
 * Service for interacting with the payroll receipt contract and managing receipts.
 */

// Receipt types
export enum ReceiptType {
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export interface ReceiptMetadata {
  employer: string;
  worker: string;
  token: string;
  total_paid: string;
  stream_id: string;
  start_date: string;
  end_date: string;
  completion_date: string;
  receipt_type: ReceiptType;
}

export interface Receipt {
  id: string;
  metadata: ReceiptMetadata;
  minted_at: string;
  owner: string;
}

// Mock service for receipt operations
export const mockReceiptService = {
  /**
   * Get receipt by ID
   */
  async getReceipt(receiptId: string): Promise<Receipt | null> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock receipt data
    return {
      id: receiptId,
      metadata: {
        employer: "GCFX...ABC1",
        worker: "GDYQ...DEF2",
        token: "native",
        total_paid: "10000000", // 1 XLM
        stream_id: "123",
        start_date: "1640995200",
        end_date: "1643587200",
        completion_date: "1643587200",
        receipt_type: ReceiptType.Completed,
      },
      minted_at: "1643587200",
      owner: "GDYQ...DEF2",
    };
  },

  /**
   * Get receipts for a worker
   */
  async getReceiptsByWorker(workerAddress: string): Promise<string[]> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return mock receipt IDs
    return [
      "receipt-001",
      "receipt-002", 
      "receipt-003",
    ];
  },

  /**
   * Get receipts for an employer
   */
  async getReceiptsByEmployer(employerAddress: string): Promise<string[]> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return mock receipt IDs
    return [
      "receipt-001",
      "receipt-004",
      "receipt-005",
    ];
  },

  /**
   * Get receipt ID for a specific stream
   */
  async getReceiptByStream(streamId: string): Promise<string | null> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return mock receipt ID or null
    return streamId === "123" ? "receipt-001" : null;
  },

  /**
   * Verify receipt authenticity
   */
  async verifyReceipt(receiptId: string): Promise<boolean> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Return mock verification result
    return receiptId.startsWith("receipt-");
  },

  /**
   * Get receipt metadata for display
   */
  async getReceiptMetadata(receiptId: string): Promise<ReceiptMetadata | null> {
    const receipt = await this.getReceipt(receiptId);
    return receipt ? receipt.metadata : null;
  },

  /**
   * Download receipt as PDF/JSON
   */
  async downloadReceipt(receiptId: string, format: 'pdf' | 'json'): Promise<Blob> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const receipt = await this.getReceipt(receiptId);
    if (!receipt) {
      throw new Error("Receipt not found");
    }

    if (format === 'json') {
      // Return JSON blob
      const jsonData = JSON.stringify(receipt, null, 2);
      return new Blob([jsonData], { type: 'application/json' });
    } else {
      // Return PDF blob (mock)
      const pdfContent = `
Payroll Receipt
================

Receipt ID: ${receipt.id}
Type: ${receipt.metadata.receipt_type}
Date: ${new Date(parseInt(receipt.metadata.completion_date) * 1000).toLocaleDateString()}

Employer: ${receipt.metadata.employer}
Worker: ${receipt.metadata.worker}
Token: ${receipt.metadata.token}
Total Paid: ${formatAmount(receipt.metadata.total_paid)}
Stream ID: ${receipt.metadata.stream_id}

Period: ${new Date(parseInt(receipt.metadata.start_date) * 1000).toLocaleDateString()} - 
         ${new Date(parseInt(receipt.metadata.end_date) * 1000).toLocaleDateString()}

This receipt serves as proof of income and can be used for tax purposes.
Generated on: ${new Date().toLocaleDateString()}
      `.trim();
      
      return new Blob([pdfContent], { type: 'text/plain' });
    }
  },
};

/**
 * Helper functions
 */
export const formatAmount = (amount: string, decimals: number = 7): string => {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

export const formatDate = (timestamp: string): string => {
  return new Date(parseInt(timestamp) * 1000).toLocaleDateString();
};

export const shortenAddress = (address: string): string => {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const getTokenSymbol = (tokenAddress: string): string => {
  if (tokenAddress === "native") return "XLM";
  // In a real implementation, you'd look up the token symbol
  return tokenAddress.includes("USDC") ? "USDC" : "TOKEN";
};

export const getReceiptTypeColor = (type: ReceiptType): string => {
  switch (type) {
    case ReceiptType.Completed:
      return "var(--sds-color-feedback-success)";
    case ReceiptType.Cancelled:
      return "var(--sds-color-feedback-error)";
    default:
      return "var(--muted)";
  }
};
