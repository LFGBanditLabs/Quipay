import React from "react";

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
}) => {
  const sizeClass =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-9 w-9" : "h-6 w-6";

  return (
    <span
      className={`inline-flex items-center gap-2 ${className ?? ""}`}
      role="status"
      aria-busy="true"
      aria-label={label ?? "Loading"}
    >
      <svg
        className={`shrink-0 animate-spin ${sizeClass}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
        <path d="M12 2a10 10 0 0 1 10 10" />
      </svg>
      {label && <span className="text-sm text-[var(--muted)]">{label}</span>}
    </span>
  );
};
