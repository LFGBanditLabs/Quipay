import React, { useEffect, useState } from "react";

export interface TransactionProgressProps {
  /** Ordered list of step labels, e.g. ["Simulating", "Signing", "Submitting"] */
  steps: string[];
  /** Zero-based index of the currently active step */
  currentStep: number;
  /** Overall status */
  status: "loading" | "success" | "error";
  /** Optional error message shown when status is "error" */
  errorMessage?: string;
  /** Timeout in ms — shows a warning if exceeded while still loading */
  timeoutMs?: number;
  className?: string;
}

/**
 * Multi-step vertical progress tracker for blockchain transactions.
 *
 * Shows each phase with a circle indicator, connector lines, and animated
 * state transitions. Includes optional timeout warning.
 */
export const TransactionProgress: React.FC<TransactionProgressProps> = ({
  steps,
  currentStep,
  status,
  errorMessage,
  timeoutMs = 30_000,
  className,
}) => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status !== "loading") {
      setTimeout(() => setTimedOut(false), 0);
      return;
    }

    setTimeout(() => setTimedOut(false), 0);
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [status, currentStep, timeoutMs]);

  const getCircleClass = (index: number) => {
    if (status === "error" && index === currentStep)
      return "bg-[var(--sds-color-feedback-error)] text-white";
    if (index < currentStep)
      return "bg-[var(--sds-color-feedback-success)] text-white";
    if (index === currentStep && status === "loading")
      return "bg-[var(--accent)] text-white shadow-[0_0_0_4px_var(--accent-transparent-strong)] [animation:pulse_1.4s_ease-in-out_infinite]";
    if (index === currentStep && status === "success")
      return "bg-[var(--sds-color-feedback-success)] text-white";
    return "bg-[var(--surface-subtle)] text-[var(--muted)]";
  };

  const getStepClass = (index: number) => {
    if (index < currentStep)
      return "group relative flex items-start gap-3 pb-4 after:absolute after:bottom-0 after:left-[11px] after:top-6 after:w-0.5 after:bg-[#10b981] after:content-[''] last:pb-0 last:after:hidden";
    return "group relative flex items-start gap-3 pb-4 after:absolute after:bottom-0 after:left-[11px] after:top-6 after:w-0.5 after:bg-[var(--border)] after:content-[''] last:pb-0 last:after:hidden";
  };

  const circleContent = (index: number) => {
    if (index < currentStep || (index === currentStep && status === "success"))
      return "✓";
    if (index === currentStep && status === "error") return "✕";
    return index + 1;
  };

  return (
    <div
      className={`flex flex-col gap-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 [animation:fadeInUp_0.25s_ease_both] ${className ?? ""}`}
      role="status"
    >
      {steps.map((label, i) => (
        <div key={label} className={getStepClass(i)}>
          <div
            className={`h-6 w-6 shrink-0 rounded-full text-center text-xs font-bold leading-6 transition-all ${getCircleClass(i)}`}
          >
            {circleContent(i)}
          </div>
          <div className="flex flex-col gap-0.5 pt-0.5">
            <span
              className={`text-sm font-semibold text-[var(--text)] transition-colors ${
                i > currentStep
                  ? "text-[var(--sds-color-content-secondary,#9ca3af)]"
                  : ""
              }`}
            >
              {label}
            </span>
            {i === currentStep && status === "loading" && (
              <span className="text-xs text-[var(--muted)]">In progress…</span>
            )}
          </div>
        </div>
      ))}

      {timedOut && status === "loading" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[rgba(245,166,35,0.1)] px-3.5 py-2.5 text-[0.8125rem] text-[#d97706]">
          ⏱ This is taking longer than expected. Please wait…
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-[0.8125rem] text-[#ef4444]">
          ⚠ {errorMessage}
        </div>
      )}
    </div>
  );
};
