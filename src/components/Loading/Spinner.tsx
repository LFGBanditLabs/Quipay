import React from "react";
import styles from "./Spinner.module.css";

export interface SpinnerProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional label shown next to the spinner */
  label?: string;
  /** Custom className for the wrapper */
  className?: string;
}

/**
 * Accessible animated spinner with optional label.
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  label,
  className,
}) => (
  <span
    className={`${styles.wrapper} ${className ?? ""}`}
    role="status"
    aria-busy="true"
    aria-label={label ?? "Loading"}
  >
    <svg
      className={`${styles.spinner} ${styles[size]}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
    {label && <span className={styles.label}>{label}</span>}
  </span>
);
