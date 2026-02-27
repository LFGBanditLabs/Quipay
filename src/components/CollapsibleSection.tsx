import React, { useState } from "react";
import { Icon } from "@stellar/design-system";

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
    <div className="my-4 overflow-hidden rounded-lg border border-[var(--border)]">
      <button
        className="flex w-full items-center justify-between bg-[var(--surface-subtle)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface)]"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-[var(--text)]">{title}</span>
        <Icon.ChevronDown
          size="sm"
          className={`text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>
      {isExpanded && (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
