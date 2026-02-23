import React from "react";
import type { AppError } from "../util/errors";

interface ErrorMessageProps {
  error: AppError | string | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * ErrorMessage Component
 * ──────────────────────
 * Displays an inline error alert with appropriate styling and icons based on
 * the error type and severity. Supports an optional retry action.
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  className = "",
}) => {
  if (!error) return null;

  const appError: Partial<AppError> =
    typeof error === "string" ? { message: error, severity: "error" } : error;

  const colors = {
    error: {
      bg: "rgba(248, 113, 113, 0.1)",
      border: "rgba(248, 113, 113, 0.25)",
      text: "#f87171",
      icon: "⚠",
    },
    warning: {
      bg: "rgba(251, 191, 36, 0.1)",
      border: "rgba(251, 191, 36, 0.25)",
      text: "#fbbf24",
      icon: "⚡",
    },
    info: {
      bg: "rgba(110, 86, 207, 0.1)",
      border: "rgba(110, 86, 207, 0.25)",
      text: "#9b85f5",
      icon: "i",
    },
  };

  const styleSet = colors[appError.severity || "error"];

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "12px 16px",
        borderRadius: "12px",
        backgroundColor: styleSet.bg,
        border: `1px solid ${styleSet.border}`,
        marginBottom: "16px",
        fontSize: "13px",
        lineHeight: "1.5",
        color: styleSet.text,
        animation: "slideIn 0.2s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <span style={{ fontWeight: 800, fontSize: "14px" }}>
          {styleSet.icon}
        </span>
        <div style={{ flex: 1 }}>
          <strong style={{ display: "block", marginBottom: "2px" }}>
            {appError.message}
          </strong>
          {appError.actionableStep && (
            <p style={{ margin: 0, opacity: 0.9, fontSize: "12px" }}>
              {appError.actionableStep}
            </p>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid currentColor",
              color: "inherit",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};
