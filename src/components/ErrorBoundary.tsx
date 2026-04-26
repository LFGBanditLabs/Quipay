/* eslint-disable react-refresh/only-export-components */
import { Component, ErrorInfo, ReactNode, useState, useCallback } from "react";
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
 * Guided "Fix It" resolutions keyed by error code or pattern.
 * Each entry provides step-by-step user guidance.
 */
interface FixItGuide {
  title: string;
  steps: string[];
}

const FIX_IT_GUIDES: Record<string, FixItGuide> = {
  // Contract error codes
  "1003": {
    title: "Authorization Required",
    steps: [
      "Ensure your wallet is connected and unlocked.",
      "Verify you are using the correct account (employer/admin).",
      "Reconnect your wallet and try again.",
    ],
  },
  "1006": {
    title: "Insufficient Balance",
    steps: [
      "Check your token balances in the Treasury.",
      "Add more XLM or the required token to your wallet.",
      "If using USDC, ensure the trustline is established.",
    ],
  },
  "1007": {
    title: "Protocol Paused",
    steps: [
      "The Quipay protocol has been paused by governance.",
      "Check the Governance page for active proposals.",
      "Wait for the protocol to be unpaused before retrying.",
    ],
  },
  "1014": {
    title: "Invalid Token",
    steps: [
      "The token address provided is not recognized.",
      "Ensure you are using a supported Stellar asset.",
      "Check the Treasury page for supported tokens.",
    ],
  },
  "1017": {
    title: "Worker Not Registered",
    steps: [
      "The connected wallet is not registered as a worker.",
      "Ask your employer to add your address to the Workforce Registry.",
      "Navigate to the Workforce page to verify registration.",
    ],
  },
  // Pattern-based guides
  network_error: {
    title: "Network Connection Issue",
    steps: [
      "Check your internet connection.",
      "The Stellar RPC node may be temporarily down.",
      "Try switching to a different network in Settings.",
      "Wait a few moments and click 'Retry'.",
    ],
  },
  wallet_error: {
    title: "Wallet Issue",
    steps: [
      "Make sure your wallet extension is installed and unlocked.",
      "Try disconnecting and reconnecting your wallet.",
      "Ensure your wallet is set to the correct Stellar network.",
      "If using Freighter, check for pending updates.",
    ],
  },
  insufficient_xlm: {
    title: "Add XLM to Wallet",
    steps: [
      "You need XLM to pay for transaction fees on Stellar.",
      "Get testnet XLM from the Stellar Friendbot (testnet only).",
      "Or transfer XLM from an exchange to your wallet address.",
      "A minimum of 1 XLM is recommended for fees.",
    ],
  },
};

/**
 * Extracts a QuipayError code from an error message/name.
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

/**
 * Determines which Fix-It guide to show based on the error.
 */
function getFixItGuide(error: Error): FixItGuide | null {
  // 1. Try contract code
  const code = extractContractErrorCode(error);
  if (code && FIX_IT_GUIDES[String(code)]) {
    return FIX_IT_GUIDES[String(code)];
  }

  // 2. Try pattern matching
  const msg = error.message.toLowerCase();
  if (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("cors") ||
    msg.includes("failed to fetch")
  ) {
    return FIX_IT_GUIDES.network_error;
  }
  if (
    msg.includes("wallet") ||
    msg.includes("freighter") ||
    msg.includes("user rejected")
  ) {
    return FIX_IT_GUIDES.wallet_error;
  }
  if (msg.includes("insufficient") && msg.includes("xlm")) {
    return FIX_IT_GUIDES.insufficient_xlm;
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

/**
 * Collects the full state context for a bug report.
 */
function collectBugReportPayload(error?: Error, componentStack?: string) {
  return JSON.stringify(
    {
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : null,
      componentStack: componentStack ?? null,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        walletId: localStorage.getItem("walletId") || null,
        walletAddress: localStorage.getItem("walletAddress") || null,
        walletNetwork: localStorage.getItem("walletNetwork") || null,
        theme: document.documentElement.getAttribute("data-theme"),
        language: document.documentElement.lang,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
      },
    },
    null,
    2,
  );
}

// ─── Fix-It Panel ────────────────────────────────────────────────────────────

function FixItPanel({ guide }: { guide: FixItGuide }) {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div
      style={{
        margin: "0 auto 20px",
        maxWidth: "520px",
        padding: "16px",
        background: "rgba(99, 102, 241, 0.06)",
        borderRadius: "10px",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        textAlign: "left",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "var(--accent, #6366f1)",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        🔧 {guide.title}
      </p>

      {guide.steps.map((step, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            marginBottom: "8px",
            opacity: i <= currentStep ? 1 : 0.4,
            transition: "opacity 0.2s",
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background:
                i < currentStep
                  ? "#10b981"
                  : i === currentStep
                    ? "var(--accent, #6366f1)"
                    : "var(--border)",
              color: "white",
              fontSize: "11px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {i < currentStep ? "✓" : i + 1}
          </span>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--text)",
              lineHeight: 1.5,
            }}
          >
            {step}
          </p>
        </div>
      ))}

      {currentStep < guide.steps.length - 1 && (
        <button
          onClick={() => setCurrentStep((s) => s + 1)}
          style={{
            marginTop: "8px",
            padding: "6px 14px",
            background: "var(--accent, #6366f1)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Next step →
        </button>
      )}
    </div>
  );
}

// ─── Fallback UI ─────────────────────────────────────────────────────────────

function ErrorFallback({
  error,
  componentStack,
  onRetry,
  onReload,
}: {
  error?: Error;
  componentStack?: string;
  onRetry?: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const [showStack, setShowStack] = useState(false);
  const [bugReportCopied, setBugReportCopied] = useState(false);

  const contractCode = error ? extractContractErrorCode(error) : null;
  const contractMessage = contractCode
    ? QUIPAY_ERROR_MESSAGES[contractCode]
    : null;
  const fixItGuide = error ? getFixItGuide(error) : null;

  const bugReportPayload = collectBugReportPayload(error, componentStack);

  const handleCopyBugReport = useCallback(() => {
    void navigator.clipboard.writeText(bugReportPayload).then(() => {
      setBugReportCopied(true);
      setTimeout(() => setBugReportCopied(false), 2000);
    });
  }, [bugReportPayload]);

  return (
    <div
      style={{
        padding: "40px 20px",
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "var(--bg)",
        color: "var(--text)",
        borderRadius: "12px",
        margin: "20px",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>

      <h2
        style={{
          fontSize: "20px",
          fontWeight: 700,
          marginBottom: "8px",
          color: "var(--sds-color-feedback-error, #ef4444)",
        }}
      >
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
              color: "var(--sds-color-feedback-error, #ef4444)",
            }}
          >
            Contract Error #{contractCode}
          </p>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 500,
              margin: 0,
              color: "var(--sds-color-feedback-error, #ef4444)",
            }}
          >
            {contractMessage}
          </p>
        </div>
      ) : (
        <p
          style={{
            fontSize: "14px",
            opacity: 0.8,
            marginBottom: "24px",
            color: "var(--muted)",
          }}
        >
          {error?.message || t("errors.unexpected_error")}
        </p>
      )}

      {/* Fix-It guided resolution */}
      {fixItGuide && <FixItPanel guide={fixItGuide} />}

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        {/* Retry (re-render the child tree without full reload) */}
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: "10px 20px",
              background: "var(--accent, #6366f1)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            ↻ {t("common.retry", "Retry")}
          </button>
        )}

        {/* Full page reload */}
        <button
          onClick={onReload}
          style={{
            padding: "10px 20px",
            background: onRetry ? "var(--surface)" : "var(--accent, #6366f1)",
            color: onRetry ? "var(--text)" : "white",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          {t("common.reload_application", "Reload App")}
        </button>

        {/* Copy error for support */}
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
            Copy error
            <CopyButton
              value={JSON.stringify(
                {
                  code: contractCode ?? "unknown",
                  message: error.message,
                  stack: error.stack,
                  timestamp: new Date().toISOString(),
                },
                null,
                2,
              )}
              label="Copy error details"
            />
          </span>
        )}
      </div>

      {/* Report Bug button */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "12px",
        }}
      >
        <button
          onClick={handleCopyBugReport}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            background: bugReportCopied
              ? "rgba(16, 185, 129, 0.1)"
              : "rgba(239,68,68,0.08)",
            color: bugReportCopied
              ? "#10b981"
              : "var(--sds-color-feedback-error, #ef4444)",
            border: `1px solid ${bugReportCopied ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.2)"}`,
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {bugReportCopied ? "✓ Bug Report Copied!" : "🐛 Report Bug"}
        </button>
      </div>

      {/* Dev stack trace */}
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
              {componentStack && (
                <>
                  {"\n\n─── Component Stack ───\n"}
                  {componentStack}
                </>
              )}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

// ─── Error Boundary class ─────────────────────────────────────────────────────

interface Props {
  children?: ReactNode;
  /** Optional: name/label for this boundary region (shown in reports) */
  region?: string;
  /** Optional: custom fallback renderer */
  fallback?: (props: { error: Error; retry: () => void }) => ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
}

/**
 * ErrorBoundary
 * ─────────────
 * Catches JavaScript errors anywhere in the child component tree,
 * decodes Soroban QuipayError contract codes into human-readable messages,
 * provides guided "Fix It" flows, a "Retry" button that re-mounts children
 * without a full reload, "Report Bug" with captured state context, and
 * logs errors to the analytics backend.
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.region ? `:${this.props.region}` : ""}]`,
      error,
      errorInfo,
    );
    this.setState({ componentStack: errorInfo.componentStack ?? undefined });
    logErrorToAnalytics(error, errorInfo);
  }

  /** Retry: reset error state to re-render children */
  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      componentStack: undefined,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback && this.state.error) {
        return this.props.fallback({
          error: this.state.error,
          retry: this.handleRetry,
        });
      }

      return (
        <ErrorFallback
          error={this.state.error}
          componentStack={this.state.componentStack}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
export { ErrorFallback, collectBugReportPayload, FIX_IT_GUIDES, getFixItGuide };
