import { useState } from "react";
import { ExportModal } from "./ExportModal";
import { useExport } from "../../hooks/useExport";
import type { StreamRecord } from "../../util/exportData";

interface ExportButtonProps {
  streams: StreamRecord[];
}

export const ExportButton = ({ streams }: ExportButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { handleExport, isExporting } = useExport(streams);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Export stream history"
        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export
      </button>

      <ExportModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onExport={(format, filters) => void handleExport(format, filters)}
        isExporting={isExporting}
      />
    </>
  );
};
