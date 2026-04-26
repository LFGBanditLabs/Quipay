import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import CopyButton from "./CopyButton";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";

/* ── State collector ────────────────────────────────────────────────────────── */

/* ... (collectStateContext remains same) ... */
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

  return (
    <Modal open={open} onOpenChange={handleClose}>
      <ModalContent className="max-w-[520px]">
        {/* Header */}
        <ModalHeader>
          <div className="flex items-center gap-2">
            <span className="text-xl">🐛</span>
            <ModalTitle>{t("bug_report.title", "Report a Bug")}</ModalTitle>
          </div>
        </ModalHeader>

        {/* Body */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {submitted ? (
            <div className="py-6 text-center">
              <div className="mb-3 text-4xl">✅</div>
              <h4 className="mb-2 text-base font-bold text-[var(--text)]">
                {t("bug_report.submitted", "Report Captured!")}
              </h4>
              <p className="mb-4 text-xs text-[var(--muted)]">
                {t(
                  "bug_report.submitted_desc",
                  "The bug report has been copied to your clipboard and logged. You can paste it in a GitHub issue or send it to the team.",
                )}
              </p>
              <Button
                onClick={handleClose}
                className="rounded-xl px-6"
                variant="primary"
              >
                {t("common.close", "Close")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Error context */}
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-500">
                  <strong>Error:</strong> {error.message}
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  {t("bug_report.description_label", "What happened?")}
                </label>
                <textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t(
                    "bug_report.description_placeholder",
                    "Describe what you were doing and what went wrong…",
                  )}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-[var(--text)] placeholder:text-white/20 focus:border-indigo-500/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-sans"
                />
              </div>

              {/* Steps to reproduce */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  {t("bug_report.steps_label", "Steps to reproduce (optional)")}
                </label>
                <textarea
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                  placeholder="1. Go to…&#10;2. Click on…&#10;3. See error…"
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-[var(--text)] placeholder:text-white/20 focus:border-indigo-500/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-sans"
                />
              </div>

              {/* Auto-captured context (collapsible) */}
              <details className="group">
                <summary className="cursor-pointer text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider list-none flex items-center gap-1.5">
                  <span className="group-open:rotate-90 transition-transform text-[8px]">
                    ▶
                  </span>
                  {t(
                    "bug_report.auto_context",
                    "Auto-captured context (included in report)",
                  )}
                </summary>
                <div className="relative mt-2">
                  <pre className="max-h-[180px] overflow-auto rounded-xl border border-[var(--border)] bg-black/20 p-3 font-mono text-[10px] text-[var(--muted)] scrollbar-thin">
                    {JSON.stringify(stateContext, null, 2)}
                  </pre>
                  <div className="absolute top-2 right-2">
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
          <ModalFooter className="mt-4 pt-4 border-t border-[var(--border)] bg-transparent">
            <Button
              variant="secondary"
              onClick={handleClose}
              className="rounded-xl"
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              variant="primary"
              className="rounded-xl flex items-center gap-2"
            >
              <span className="text-sm">🐛</span>
              {t("bug_report.submit", "Submit Report")}
            </Button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
};

export default BugReportModal;
