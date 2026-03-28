import { Component, ErrorInfo, ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import CopyButton from "./CopyButton";

// ─── QuipayError code map ────────────────────────────────────────────────────
// Mirrors contracts/common/src/error.rs  (repr u32, offset 1001–1040 + 1999)
const QUIPAY_ERROR_MESSAGES: Record<number, string> = {
  1001: "Contract is already initialized.",
  1002: "Contract has not been initialized.",
  1003: "Caller is not authorized to perform this action.",
  1004: "Caller has insufficient permissions.",
  1005: "The provided amount is invalid.",
  1006: "Insufficient balance to complete the operation.",
  1007: "The protocol is currently paused.",
  1008: "Contract version has not been set.",
  1009: "A storage error occurred in the contract.",
  1010: "The provided address is invalid.",
  1011: "Stream not found.",
  1012: "Stream has expired.",
  1013: "Agent not found.",
  1014: "Invalid token provided.",
  1015: "Token transfer failed.",
  1016: "Contract upgrade failed.",
  1017: "Caller is not a registered worker.",
  1018: "Stream is closed.",
  1019: "Caller is not the employer.",
  1020: "Stream is not closed.",
  1021: "The specified time range is invalid.",
  1022: "Invalid cliff configuration.",
  1023: "Start time cannot be in the past.",
  1024: "Arithmetic overflow occurred.",
  1025: "Retention requirement not met.",
  1026: "Fee exceeds the allowed maximum.",
  1027: "Address is blacklisted.",
  1028: "Worker not found.",
  1029: "Batch size exceeds the maximum allowed.",
  1030: "No pending admin transfer exists.",
  1031: "Caller is not the pending admin.",
  1032: "Signer not found.",
  1033: "Address is already a signer.",
  1034: "Invalid signature threshold.",
  1035: "Insufficient signatures to proceed.",
  1036: "No signers are registered.",
  1037: "Withdrawal is in cooldown period.",
  1038: "Grace period is still active.",
  1039: "Duplicate signer detected.",
  1040: "No drain operation is pending.",
  1041: "Drain timelock is still active.",
  1999: "A custom contract error occurred.",
};

/**
 * Extracts a QuipayError code from an error message/name.
 * Soroban SDK surfaces contract errors as strings like:
 *   "Error(Contract, #1006)"  or  "contract error: 1006"
 */
function extractContractErrorCode(error: Error): number | null {
  const patterns = [
    /Error\(Contract,\s*#(\d+)\)/,
    /contract\s+error[:\s]+(\d+)/i,
    /\bcode[:\s]+(\d+)/i,
    /\b(1\d{3})\b/,
  ];
  const haystack = `${error.message} ${error.name} ${error.stack ?? ""}`;
  for (const re of patterns) {
    const m = re.exec(haystack);
    if (m) {
      const code = parseInt(m[1], 10);
      if (code in QUIPAY_ERROR_MESSAGES) return code;
    }
  }
  return null;
}

function logErrorToAnalytics(error: Error, errorInfo: ErrorInfo) {
  const apiBase =
    (import.meta as unknown as Record<string, Record<string, string>>).env
      ?.VITE_API_BASE_URL ?? "";
  if (!apiBase) return;
  fetch(`${apiBase}/api/errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {
    // analytics logging is best-effort
  });
}

// ─── Fallback UI ─────────────────────────────────────────────────────────────

function ErrorFallback({
  error,
  onReload,
}: {
  error?: Error;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const [showStack, setShowStack] = useState(false);

  const contractCode = error ? extractContractErrorCode(error) : null;
  const contractMessage = contractCode
    ? QUIPAY_ERROR_MESSAGES[contractCode]
    : null;

  const copyPayload = error
    ? JSON.stringify(
        {
          code: contractCode ?? "unknown",
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      )
    : "";

  return (
    <div
      style={{
        padding: "40px 20px",
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "var(--bg)",
        color: "var(--sds-color-feedback-error, #ef4444)",
        borderRadius: "12px",
        margin: "20px",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>

      <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
        {t("errors.something_went_wrong")}
      </h2>

      {contractCode ? (
        <div
          style={{
            margin: "0 auto 20px",
            maxWidth: "480px",
            padding: "12px 16px",
            background: "rgba(239,68,68,0.08)",
            borderRadius: "8px",
            border: "1px solid rgba(239,68,68,0.2)",
            textAlign: "left",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              fontWeight: 600,
              opacity: 0.7,
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Contract Error #{contractCode}
          </p>
          <p style={{ fontSize: "14px", fontWeight: 500, margin: 0 }}>
            {contractMessage}
          </p>
        </div>
      ) : (
        <p style={{ fontSize: "14px", opacity: 0.8, marginBottom: "24px" }}>
          {t("errors.unexpected_error")}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <button
          onClick={onReload}
          style={{
            padding: "10px 20px",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t("common.reload_application")}
        </button>

        {error && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--text)",
              background: "var(--bg)",
            }}
          >
            Copy error details
            <CopyButton value={copyPayload} label="Copy error details" />
          </span>
        )}
      </div>

      {process.env.NODE_ENV === "development" && error && (
        <>
          <button
            onClick={() => setShowStack((v) => !v)}
            style={{
              background: "none",
              border: "none",
              fontSize: "12px",
              cursor: "pointer",
              opacity: 0.6,
              marginBottom: "8px",
              color: "inherit",
            }}
          >
            {showStack ? "Hide" : "Show"} stack trace
          </button>
          {showStack && (
            <pre
              style={{
                marginTop: "8px",
                padding: "12px",
                background: "rgba(0,0,0,0.05)",
                borderRadius: "6px",
                fontSize: "12px",
                textAlign: "left",
                overflowX: "auto",
              }}
            >
              {error.stack}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

// ─── Error Boundary class ─────────────────────────────────────────────────────

/**
 * ErrorBoundary
 * ─────────────
 * Catches JavaScript errors anywhere in the child component tree,
 * decodes Soroban QuipayError contract codes into human-readable messages,
 * provides a "Copy error details" button for support, and logs errors to
 * the analytics backend.
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    logErrorToAnalytics(error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback error={this.state.error} onReload={this.handleReload} />
      );
    }

    return this.props.children;
  }
}

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default ErrorBoundary;
