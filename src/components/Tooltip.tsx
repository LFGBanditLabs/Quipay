import React from "react";
import { Icon } from "@stellar/design-system";

interface TooltipProps {
  content: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content }) => {
  return (
    <div
      className="group relative ml-1 inline-flex cursor-help items-center text-[var(--accent)]"
      aria-label={content}
    >
      <Icon.InfoCircle size="sm" className="text-sm" />
      <div className="pointer-events-none absolute bottom-[125%] left-1/2 z-[1000] -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--text)] px-3 py-2 text-xs text-[var(--bg)] opacity-0 shadow-[0_10px_15px_-3px_var(--shadow-color)] transition-opacity duration-200 group-hover:opacity-100">
        {content}
      </div>
    </div>
  );
};

export default Tooltip;
