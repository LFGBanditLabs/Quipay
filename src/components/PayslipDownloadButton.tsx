import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayslipDownloadButtonProps {
  /** Worker wallet address */
  workerAddress: string;
  /** Period in YYYY-MM format (e.g., "2025-01") */
  period: string;
  /** Optional CSS class name */
  className?: string;
  /** Optional callback fired after successful download */
  onSuccess?: () => void;
  /** Optional callback fired on error */
  onError?: (error: string) => void;
}

type DownloadStatus = "idle" | "loading" | "success" | "error";

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconDownload = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="16"
    height="16"
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
);

const IconX = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const Spinner = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    style={{ animation: "pdSpin 0.8s linear infinite" }}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function PayslipDownloadButton({
  workerAddress,
  period,
  className = "",
  onSuccess,
  onError,
}: PayslipDownloadButtonProps) {
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const downloadPayslip = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");

    try {
      // Call the payslip API endpoint
      const apiBase = import.meta.env?.VITE_API_BASE_URL || "";
      const response = await fetch(
        `${apiBase}/api/workers/${workerAddress}/payslip?period=${period}`,
        {
          method: "GET",
          credentials: "include", // Include cookies for authentication
        },
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You can only download your own payslips.");
        } else if (response.status === 404) {
          throw new Error("No streams found for this period.");
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Failed to generate payslip (${response.status})`,
          );
        }
      }

      // Get the PDF blob
      const blob = await response.blob();

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `payslip-${period}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStatus("success");
      onSuccess?.();

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 2000);
    } catch (err: unknown) {
      console.error("Payslip download failed:", err);
      const message = err instanceof Error ? err.message : "Download failed";
      setErrorMsg(message);
      setStatus("error");
      onError?.(message);

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus("idle");
        setErrorMsg("");
      }, 3000);
    }
  }, [workerAddress, period, onSuccess, onError]);

  const buttonLabel = () => {
    switch (status) {
      case "loading":
        return "Generating…";
      case "success":
        return "Downloaded!";
      case "error":
        return "Try again";
      default:
        return "Download Payslip";
    }
  };

  const isLoading = status === "loading";
  const isDisabled = isLoading;

  return (
    <>
      <style>{`
        @keyframes pdSpin { to { transform: rotate(360deg); } }
        @keyframes pdFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        .pd-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 18px;
          border: none;
          border-radius: 10px;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, background 0.2s;
          position: relative;
          overflow: hidden;
        }
        .pd-btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .pd-btn-idle {
          background: var(--surface);
          color: var(--text);
          border: 1px solid var(--border);
        }
        .pd-btn-idle:hover:not(:disabled) {
          background: var(--surface-subtle);
          transform: translateY(-1px);
        }

        .pd-btn-loading {
          background: var(--surface);
          color: var(--accent);
          border: 1px solid var(--border);
          cursor: not-allowed;
        }

        .pd-btn-success {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .pd-btn-error {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .pd-btn-error:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .pd-error-msg {
          margin-top: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          font-size: 12px;
          animation: pdFadeIn 0.2s ease;
        }
      `}</style>

      <div>
        <button
          className={`pd-btn ${
            isLoading
              ? "pd-btn-loading"
              : status === "success"
                ? "pd-btn-success"
                : status === "error"
                  ? "pd-btn-error"
                  : "pd-btn-idle"
          } ${className}`}
          onClick={() => void downloadPayslip()}
          disabled={isDisabled}
          aria-label={buttonLabel()}
          aria-busy={isLoading}
        >
          {isLoading && <Spinner size={16} />}
          {status === "success" && <IconCheck />}
          {status === "error" && <IconX />}
          {status === "idle" && <IconDownload />}
          {buttonLabel()}
        </button>

        {status === "error" && errorMsg && (
          <div className="pd-error-msg">{errorMsg}</div>
        )}
      </div>
    </>
  );
}
