import React, { useState } from "react";

interface CopyButtonProps {
  /** The full value to copy to clipboard */
  value: string;
  /** Optional accessible label (defaults to "Copy to clipboard") */
  label?: string;
  /** Optional extra CSS class names for the button */
  className?: string;
}

/**
 * CopyButton — a small, subtle icon button that copies `value` to the
 * clipboard and shows a brief "Copied!" confirmation tick.
 * Resolves Issue #453.
 */
const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  label = "Copy to clipboard",
  className = "",
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const el = document.createElement("textarea");
      el.value = value;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void handleCopy();
      }}
      aria-label={copied ? "Copied!" : label}
      title={copied ? "Copied!" : label}
      className={`inline-flex items-center justify-center rounded p-1 transition-all duration-150 ${
        copied
          ? "text-emerald-400 opacity-100"
          : "text-[var(--muted)] opacity-60 hover:opacity-100 hover:text-[var(--text)]"
      } ${className}`}
      style={{ background: "none", border: "none", cursor: "pointer" }}
    >
      {copied ? (
        // Checkmark icon
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        // Copy icon
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
};

export default CopyButton;
