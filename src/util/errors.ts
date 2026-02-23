/**
 * Quipay — Centralized Error Handling Utility
 * Translates technical error codes and exceptions into user-friendly messages.
 */

export enum ErrorType {
  NETWORK = "NETWORK",
  CONTRACT = "CONTRACT",
  VALIDATION = "VALIDATION",
  UNKNOWN = "UNKNOWN",
  WALLET = "WALLET",
}

export interface AppError {
  message: string;
  type: ErrorType;
  severity: "error" | "warning" | "info";
  actionableStep?: string;
  technicalDetails?: string;
}

/**
 * Common Stellar / Soroban result codes and their user-friendly equivalents.
 * See: https://developers.stellar.org/docs/data/rpc/api-reference/get-transaction#result-codes
 */
const STELLAR_ERROR_MAP: Record<string, { message: string; action?: string }> =
  {
    tx_bad_auth: {
      message: "Transaction authentication failed.",
      action: "Please verify your wallet connection and try again.",
    },
    tx_insufficient_balance: {
      message: "Insufficient XLM to pay for transaction fees.",
      action: "Add more XLM to your account and try again.",
    },
    tx_too_late: {
      message: "Transaction expired.",
      action: "The network was too busy. Please try again.",
    },
    tx_not_supported: {
      message: "Transaction version not supported.",
      action: "Please update your wallet or try a different one.",
    },
    tx_bad_seq: {
      message: "Outdated account sequence number.",
      action: "Refresh the page and try again.",
    },
    op_underfunded: {
      message: "Insufficient funds to complete this operation.",
      action: "Verify your token balances and try again.",
    },
    op_no_destination: {
      message: "Destination account does not exist.",
      action: "Ensure the worker address is valid and funded.",
    },
    op_cross_self: {
      message: "Cannot stream tokens to yourself.",
      action: "Enter a different worker address.",
    },
  };

/**
 * Translates any error into a standardized AppError object.
 */
export function translateError(err: unknown): AppError {
  // 1. Handle string errors
  if (typeof err === "string") {
    const matched = Object.entries(STELLAR_ERROR_MAP).find(([code]) =>
      err.toLowerCase().includes(code.toLowerCase()),
    );
    if (matched) {
      return {
        message: matched[1].message,
        type: ErrorType.CONTRACT,
        severity: "error",
        actionableStep: matched[1].action,
        technicalDetails: err,
      };
    }
    return {
      message: err,
      type: ErrorType.UNKNOWN,
      severity: "error",
    };
  }

  // 2. Handle Error objects
  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    // Network issues
    if (
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("failed to fetch") ||
      message.includes("cors")
    ) {
      return {
        message: "Network connection error.",
        type: ErrorType.NETWORK,
        severity: "error",
        actionableStep: "Check your internet connection and RPC settings.",
        technicalDetails: err.message,
      };
    }

    // Wallet issues
    if (message.includes("user rejected") || message.includes("cancelled")) {
      return {
        message: "Transaction cancelled.",
        type: ErrorType.WALLET,
        severity: "warning",
        actionableStep: "You'll need to sign the transaction to proceed.",
      };
    }

    if (message.includes("freighter") || message.includes("wallet")) {
      return {
        message: "Wallet communication error.",
        type: ErrorType.WALLET,
        severity: "error",
        actionableStep: "Ensure your wallet extension is unlocked and active.",
        technicalDetails: err.message,
      };
    }

    // Check mapping again for error messages
    const matched = Object.entries(STELLAR_ERROR_MAP).find(([code]) =>
      message.includes(code.toLowerCase()),
    );
    if (matched) {
      return {
        message: matched[1].message,
        type: ErrorType.CONTRACT,
        severity: "error",
        actionableStep: matched[1].action,
        technicalDetails: err.message,
      };
    }

    return {
      message: err.message,
      type: ErrorType.UNKNOWN,
      severity: "error",
      technicalDetails: err.stack,
    };
  }

  // 3. Fallback
  return {
    message: "An unexpected error occurred.",
    type: ErrorType.UNKNOWN,
    severity: "error",
    actionableStep: "Refresh the page or contact support if this persists.",
  };
}
