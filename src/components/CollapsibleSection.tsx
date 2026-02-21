import React, { useState } from "react";
import { Icon } from "@stellar/design-system";
import styles from "./CollapsibleSection.module.css";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={styles.container}>
      <button
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className={styles.title}>{title}</span>
        <Icon.ChevronDown
          size="sm"
          className={`${styles.icon} ${isExpanded ? styles.iconExpanded : ""}`}
        />
      </button>
      {isExpanded && <div className={styles.content}>{children}</div>}
    </div>
  );
};

export default CollapsibleSection;
