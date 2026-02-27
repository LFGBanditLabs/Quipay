import React from "react";

/* ── Skeleton ────────────────────────────────────────────────────────────────── */

export interface SkeletonProps {
  /** Visual variant */
  variant?: "text" | "circle" | "rect";
  /** Width (CSS value) */
  width?: string;
  /** Height (CSS value) */
  height?: string;
  /** Number of text lines (only for variant="text") */
  lines?: number;
  /** Disable shimmer animation */
  animate?: boolean;
  className?: string;
}

/**
 * Configurable shimmer placeholder for content that hasn't loaded yet.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "text",
  width,
  height,
  lines = 1,
  animate = true,
  className,
}) => {
  const baseClass = `rounded bg-[linear-gradient(90deg,var(--surface-subtle)_25%,var(--border)_50%,var(--surface-subtle)_75%)] bg-[length:200%_100%] ${animate ? "[animation:shimmer_1.4s_ease-in-out_infinite]" : "bg-[var(--surface-subtle)]"} ${className ?? ""}`;

  if (variant === "text" && lines > 1) {
    return (
      <>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={`skeleton-line-${String(i)}`}
            className={`${baseClass} mb-2 h-[14px] w-full`}
            style={{ width: i === lines - 1 ? "60%" : width }}
          />
        ))}
      </>
    );
  }

  return (
    <div
      className={`${baseClass} ${variant === "circle" ? "rounded-full" : variant === "text" ? "mb-2 h-[14px] w-full" : ""}`}
      style={{ width, height }}
    />
  );
};

/* ── SkeletonCard ─────────────────────────────────────────────────────────── */

export interface SkeletonCardProps {
  /** Number of skeleton lines inside the card */
  lines?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Card-shaped skeleton that matches the existing `.card` styling used across
 * EmployerDashboard and TreasuryManager.
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  lines = 3,
  className,
  children,
}) => (
  <div
    className={`flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] ${className ?? ""}`}
  >
    {children ?? (
      <>
        <Skeleton variant="text" width="40%" height="12px" />
        <Skeleton variant="rect" width="100%" height="28px" />
        {lines > 2 && <Skeleton variant="text" width="50%" height="12px" />}
      </>
    )}
  </div>
);

/* ── SkeletonRow ──────────────────────────────────────────────────────────── */

export interface SkeletonRowProps {
  className?: string;
}

/**
 * Row-shaped skeleton that matches stream list items.
 */
export const SkeletonRow: React.FC<SkeletonRowProps> = ({ className }) => (
  <div
    className={`flex items-center justify-between gap-4 rounded-md border border-[var(--border)] bg-[var(--bg)] p-[15px] ${className ?? ""}`}
  >
    <div className="flex flex-1 flex-col gap-[6px]">
      <Skeleton variant="text" width="120px" height="14px" />
      <Skeleton variant="text" width="180px" height="12px" />
    </div>
    <div className="flex flex-1 flex-col gap-[6px]">
      <Skeleton variant="text" width="140px" height="12px" />
      <Skeleton variant="text" width="100px" height="12px" />
    </div>
    <Skeleton variant="rect" width="100px" height="20px" />
  </div>
);
