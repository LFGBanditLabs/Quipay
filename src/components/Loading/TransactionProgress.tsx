import React, { useEffect, useState } from "react";
import styles from "./TransactionProgress.module.css";

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
    if (status === "error" && index === currentStep) return styles.circleError;
    if (index < currentStep) return styles.circleCompleted;
    if (index === currentStep && status === "loading")
      return styles.circleActive;
    if (index === currentStep && status === "success")
      return styles.circleCompleted;
    return styles.circlePending;
  };

  const getStepClass = (index: number) => {
    if (index < currentStep) return `${styles.step} ${styles.completed}`;
    return styles.step;
  };

  const circleContent = (index: number) => {
    if (index < currentStep || (index === currentStep && status === "success"))
      return "✓";
    if (index === currentStep && status === "error") return "✕";
    return index + 1;
  };

  return (
    <div className={`${styles.wrapper} ${className ?? ""}`} role="status">
      {steps.map((label, i) => (
        <div key={label} className={getStepClass(i)}>
          <div className={`${styles.circle} ${getCircleClass(i)}`}>
            {circleContent(i)}
          </div>
          <div className={styles.content}>
            <span
              className={`${styles.stepLabel} ${
                i > currentStep ? styles.stepLabelMuted : ""
              }`}
            >
              {label}
            </span>
            {i === currentStep && status === "loading" && (
              <span className={styles.stepSublabel}>In progress…</span>
            )}
          </div>
        </div>
      ))}

      {timedOut && status === "loading" && (
        <div className={styles.timeout}>
          ⏱ This is taking longer than expected. Please wait…
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className={styles.errorBanner}>⚠ {errorMessage}</div>
      )}
    </div>
  );
};
