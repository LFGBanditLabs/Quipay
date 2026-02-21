import React from "react";
import { Text, Button } from "@stellar/design-system";
import styles from "./EmptyState.module.css";

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
  return (
    <div className={`${styles.emptyState} ${styles[variant]}`}>
      <div className={styles.iconContainer}>
        <span className={styles.icon}>{icon}</span>
      </div>
      <Text as="h3" size="lg" weight="bold" className={styles.title}>
        {title}
      </Text>
      <Text as="p" size="md" className={styles.description}>
        {description}
      </Text>
      {actionLabel && onAction && (
        <div className={styles.actionContainer}>
          <Button variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
