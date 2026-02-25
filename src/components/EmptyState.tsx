import React from "react";
import { Text, Button } from "@stellar/design-system";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "streams" | "workers" | "treasury" | "default";
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = "✨",
  actionLabel,
  onAction,
  variant = "default",
}) => {
  const variantClasses: Record<typeof variant, string> = {
    default: "bg-[var(--surface-subtle)] border-[var(--border)]",
    streams:
      "bg-[var(--accent-transparent)] border-[var(--accent-transparent-strong)]",
    workers: "bg-[rgba(236,72,153,0.08)] border-[rgba(236,72,153,0.2)]",
    treasury:
      "bg-[var(--success-transparent-strong)] border-[var(--sds-color-feedback-success)]",
  };

  return (
    <div
      className={`my-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-12 text-center ${variantClasses[variant]}`}
    >
      <div className="mb-4 text-5xl">
        <span>{icon}</span>
      </div>
      <Text as="h3" size="lg" weight="bold" className="mb-2 text-[var(--text)]">
        {title}
      </Text>
      <Text as="p" size="md" className="mb-6 max-w-[400px] text-[var(--muted)]">
        {description}
      </Text>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
