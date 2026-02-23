import React from "react";
import styles from "./Tooltip.module.css";
import { Icon } from "@stellar/design-system";

interface TooltipProps {
  content: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content }) => {
  return (
    <div className={styles.tooltipContainer} aria-label={content}>
      <Icon.InfoCircle size="sm" className={styles.tooltipIcon} />
      <div className={styles.tooltipContent}>{content}</div>
    </div>
  );
};

export default Tooltip;
