/**
 * PreflightCheckModal.tsx
 * ──────────────────────
 * Shows the results of a pre-flight check before an on-chain action.
 * Displays blockers, warnings, and info items with guided fix actions.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import type {
  PreflightResult,
  PreflightIssue,
  PreflightSeverity,
} from "../hooks/usePreflightCheck";

/* ── Styling maps ───────────────────────────────────────────────────────────── */

const SEVERITY_CONFIG: Record<
  PreflightSeverity,
  { bg: string; border: string; icon: string; color: string; label: string }
> = {
  blocker: {
    bg: "rgba(239, 68, 68, 0.08)",
    border: "rgba(239, 68, 68, 0.25)",
    icon: "🚫",
    color: "#ef4444",
    label: "Blocker",
  },
  warning: {
    bg: "rgba(245, 166, 35, 0.08)",
    border: "rgba(245, 166, 35, 0.25)",
    icon: "⚠️",
    color: "#f5a623",
    label: "Warning",
  },
  info: {
    bg: "rgba(99, 102, 241, 0.08)",
    border: "rgba(99, 102, 241, 0.25)",
    icon: "ℹ️",
    color: "#6366f1",
    label: "Info",
  },
};

/* ── Issue row ──────────────────────────────────────────────────────────────── */

function IssueRow({ issue }: { issue: PreflightIssue }) {
  const cfg = SEVERITY_CONFIG[issue.severity];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "10px 14px",
        borderRadius: "8px",
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>
        {cfg.icon}
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: cfg.color,
            marginBottom: "2px",
          }}
        >
          {issue.title}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: "var(--text)",
            opacity: 0.85,
            lineHeight: 1.4,
          }}
        >
          {issue.message}
        </p>
        {issue.fixAction && (
          <button
            onClick={issue.fixAction.onClick}
            style={{
              marginTop: "6px",
              fontSize: "11px",
              fontWeight: 700,
              color: cfg.color,
              background: "none",
              border: `1px solid ${cfg.border}`,
              borderRadius: "4px",
              padding: "3px 10px",
              cursor: "pointer",
            }}
          >
            {issue.fixAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */

interface PreflightCheckModalProps {
  open: boolean;
  result: PreflightResult | null;
  isChecking: boolean;
  /** Called when user acknowledges and wants to proceed (only if no blockers) */
  onProceed: () => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Optional action description (e.g. "Withdraw 250 USDC") */
  actionLabel?: string;
}

const PreflightCheckModal: React.FC<PreflightCheckModalProps> = ({
  open,
  result,
  isChecking,
  onProceed,
  onCancel,
  actionLabel,
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  const hasBlockers = result?.issues.some((i) => i.severity === "blocker");
  const hasWarnings = result?.issues.some((i) => i.severity === "warning");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          maxHeight: "80vh",
          borderRadius: "16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px -15px var(--shadow-color, rgba(0,0,0,0.4))",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          margin: "16px",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "20px" }}>🛫</span>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              {t("preflight.title", "Pre-flight Check")}
            </h3>
          </div>
          {actionLabel && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "13px",
                color: "var(--muted)",
              }}
            >
              {actionLabel}
            </p>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {isChecking && (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              <div
                style={{
                  margin: "0 auto 12px",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "3px solid var(--border)",
                  borderTopColor: "var(--accent, #6366f1)",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              {t("preflight.checking", "Running pre-flight checks…")}
            </div>
          )}

          {!isChecking && result && result.issues.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "#10b981",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
              {t("preflight.all_clear", "All checks passed. Ready to proceed.")}
            </div>
          )}

          {!isChecking &&
            result?.issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
        </div>

        {/* Footer */}
        {!isChecking && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              padding: "16px 24px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              onClick={onCancel}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              onClick={onProceed}
              disabled={!!hasBlockers}
              title={
                hasBlockers ? "Fix all blockers before proceeding" : undefined
              }
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                background: hasBlockers
                  ? "var(--border)"
                  : hasWarnings
                    ? "#f5a623"
                    : "var(--accent, #6366f1)",
                color: "white",
                fontSize: "13px",
                fontWeight: 600,
                cursor: hasBlockers ? "not-allowed" : "pointer",
                opacity: hasBlockers ? 0.5 : 1,
              }}
            >
              {hasBlockers
                ? t("preflight.blocked", "Cannot Proceed")
                : hasWarnings
                  ? t("preflight.proceed_anyway", "Proceed Anyway")
                  : t("preflight.proceed", "Proceed")}
            </button>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
};

export default PreflightCheckModal;
