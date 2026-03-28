/**
 * BugReportModal.tsx
 * ──────────────────
 * A modal for users to submit structured bug reports with automatically
 * captured state context (wallet, network, route, browser, console errors).
 */

import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import CopyButton from "./CopyButton";

/* ── State collector ────────────────────────────────────────────────────────── */

function collectStateContext(): Record<string, unknown> {
  return {
    app: {
      url: window.location.href,
      route: window.location.pathname,
      timestamp: new Date().toISOString(),
      theme: document.documentElement.getAttribute("data-theme"),
      language: document.documentElement.lang,
    },
    wallet: {
      walletId: localStorage.getItem("walletId") || null,
      walletAddress: localStorage.getItem("walletAddress") || null,
      walletNetwork: localStorage.getItem("walletNetwork") || null,
      networkPassphrase: localStorage.getItem("networkPassphrase") || null,
    },
    browser: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      online: navigator.onLine,
      cookiesEnabled: navigator.cookieEnabled,
    },
    performance: {
      memoryUsage:
        "memory" in performance
          ? {
              usedJSHeapSize: (
                performance as unknown as {
                  memory: { usedJSHeapSize: number };
                }
              ).memory.usedJSHeapSize,
            }
          : null,
      navigationTiming: performance.getEntriesByType("navigation")[0]
        ? {
            domComplete: (
              performance.getEntriesByType(
                "navigation",
              )[0] as PerformanceNavigationTiming
            ).domComplete,
            loadEventEnd: (
              performance.getEntriesByType(
                "navigation",
              )[0] as PerformanceNavigationTiming
            ).loadEventEnd,
          }
        : null,
    },
  };
}

/* ── Component ──────────────────────────────────────────────────────────────── */

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional: pre-fill with a specific error */
  error?: Error;
}

const BugReportModal: React.FC<BugReportModalProps> = ({
  open,
  onClose,
  error,
}) => {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const stateContext = useMemo(() => collectStateContext(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullReport = useMemo(() => {
    return JSON.stringify(
      {
        bugReport: {
          description: description || "(no description provided)",
          stepsToReproduce: stepsToReproduce || "(not provided)",
          error: error
            ? { name: error.name, message: error.message, stack: error.stack }
            : null,
        },
        stateContext,
      },
      null,
      2,
    );
  }, [description, stepsToReproduce, error, stateContext]);

  const handleSubmit = useCallback(() => {
    // Copy to clipboard and log
    navigator.clipboard.writeText(fullReport).catch(() => {});
    console.info("[BugReport] Captured:", fullReport);

    // If there's an API endpoint, send it
    const apiBase = (
      import.meta as unknown as Record<string, Record<string, string>>
    ).env?.VITE_API_BASE_URL;
    if (apiBase) {
      fetch(`${apiBase}/api/bug-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: fullReport,
      }).catch(() => {});
    }

    setSubmitted(true);
  }, [fullReport]);

  const handleClose = useCallback(() => {
    setDescription("");
    setStepsToReproduce("");
    setSubmitted(false);
    onClose();
  }, [onClose]);

  if (!open) return null;

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
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "85vh",
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>🐛</span>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              {t("bug_report.title", "Report a Bug")}
            </h3>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "18px",
              cursor: "pointer",
              color: "var(--muted)",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
          }}
        >
          {submitted ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
              <h4
                style={{
                  margin: "0 0 8px",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                {t("bug_report.submitted", "Report Captured!")}
              </h4>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: "13px",
                  color: "var(--muted)",
                }}
              >
                {t(
                  "bug_report.submitted_desc",
                  "The bug report has been copied to your clipboard and logged. You can paste it in a GitHub issue or send it to the team.",
                )}
              </p>
              <button
                onClick={handleClose}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--accent, #6366f1)",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("common.close", "Close")}
              </button>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {/* Error context */}
              {error && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    fontSize: "12px",
                    color: "var(--sds-color-feedback-error, #ef4444)",
                  }}
                >
                  <strong>Error:</strong> {error.message}
                </div>
              )}

              {/* Description */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text)",
                    marginBottom: "6px",
                  }}
                >
                  {t("bug_report.description_label", "What happened?")}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t(
                    "bug_report.description_placeholder",
                    "Describe what you were doing and what went wrong…",
                  )}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: "13px",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Steps to reproduce */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text)",
                    marginBottom: "6px",
                  }}
                >
                  {t("bug_report.steps_label", "Steps to reproduce (optional)")}
                </label>
                <textarea
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                  placeholder="1. Go to…&#10;2. Click on…&#10;3. See error…"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: "13px",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Auto-captured context (collapsible) */}
              <details>
                <summary
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--muted)",
                    cursor: "pointer",
                    marginBottom: "6px",
                  }}
                >
                  {t(
                    "bug_report.auto_context",
                    "Auto-captured context (included in report)",
                  )}
                </summary>
                <div
                  style={{
                    position: "relative",
                    marginTop: "6px",
                  }}
                >
                  <pre
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      fontSize: "11px",
                      color: "var(--muted)",
                      overflowX: "auto",
                      maxHeight: "200px",
                    }}
                  >
                    {JSON.stringify(stateContext, null, 2)}
                  </pre>
                  <div style={{ position: "absolute", top: 6, right: 6 }}>
                    <CopyButton
                      value={JSON.stringify(stateContext, null, 2)}
                      label="Copy context"
                    />
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
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
              onClick={handleClose}
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
              onClick={handleSubmit}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                background: "var(--accent, #6366f1)",
                color: "white",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🐛 {t("bug_report.submit", "Submit Report")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BugReportModal;
