import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WithdrawButtonProps {
  /** Connected wallet address */
  walletAddress: string;
  /** PayrollStream contract instance (ethers.js or viem Contract) */
  contract: {
    withdrawableAmount: (address: string) => Promise<bigint>;
    withdraw: () => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  };
  /** Token symbol shown next to amount, e.g. "USDC" */
  tokenSymbol?: string;
  /** Decimal places for the token (default 6 for USDC) */
  tokenDecimals?: number;
  /** Optional callback fired after a successful withdrawal */
  onSuccess?: (txHash: string) => void;
}

type TxStatus =
  | "idle"
  | "fetching"
  | "confirm"
  | "pending"
  | "success"
  | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(raw: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${fracStr}`;
}

function shortenHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

// ─── Icons (inline SVG, zero dependencies) ───────────────────────────────────

const IconArrowUp = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconRefresh = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────

const Spinner = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    style={{ animation: "wbSpin 0.8s linear infinite" }}
  >
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function WithdrawButton({
  walletAddress,
  contract,
  tokenSymbol = "USDC",
  tokenDecimals = 6,
  onSuccess,
}: WithdrawButtonProps) {
  const [rawAmount, setRawAmount] = useState<bigint>(0n);
  const [status, setStatus] = useState<TxStatus>("fetching");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // ── Fetch withdrawable amount ──────────────────────────────────────────────

  const fetchAmount = useCallback(async () => {
    setStatus("fetching");
    try {
      const amount = await contract.withdrawableAmount(walletAddress);
      setRawAmount(amount);
      setStatus("idle");
    } catch (err: unknown) {
      console.error("Failed to fetch withdrawable amount:", err);
      setStatus("error");
      setErrorMsg("Could not load withdrawable balance.");
    }
  }, [contract, walletAddress]);

  useEffect(() => {
    void fetchAmount();
  }, [fetchAmount]);

  // ── Withdraw flow ──────────────────────────────────────────────────────────

  const handleWithdraw = async () => {
    if (rawAmount === 0n) return;
    setStatus("confirm");
    setErrorMsg("");
    setTxHash(null);

    try {
      const tx = await contract.withdraw();
      setStatus("pending");
      setTxHash(tx.hash);
      await tx.wait();
      setStatus("success");
      onSuccess?.(tx.hash);
      // Refresh amount after a short delay so the chain state settles
      setTimeout(() => {
        setRawAmount(0n);
      }, 1000);
    } catch (err: unknown) {
      console.error("Withdrawal failed:", err);
      setStatus("error");
      const message =
        err instanceof Error
          ? err.message.includes("user rejected")
            ? "Transaction rejected by user."
            : err.message.slice(0, 120)
          : "Unexpected error during withdrawal.";
      setErrorMsg(message);
    }
  };

  const reset = () => {
    setStatus("idle");
    setErrorMsg("");
    setTxHash(null);
    void fetchAmount();
  };

  // ── Derived UI values ──────────────────────────────────────────────────────

  const formattedAmount = formatAmount(rawAmount, tokenDecimals);
  const hasBalance = rawAmount > 0n;

  const buttonLabel = () => {
    switch (status) {
      case "fetching":
        return "Loading…";
      case "confirm":
        return "Confirm in wallet";
      case "pending":
        return "Broadcasting…";
      case "success":
        return "Withdrawn!";
      case "error":
        return "Try again";
      default:
        return hasBalance
          ? `Withdraw ${formattedAmount} ${tokenSymbol}`
          : `Nothing to withdraw`;
    }
  };

  const isLoading =
    status === "fetching" || status === "confirm" || status === "pending";
  const isDisabled = isLoading || (!hasBalance && status === "idle");

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Scoped styles – no external CSS file needed */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        @keyframes wbSpin     { to { transform: rotate(360deg); } }
        @keyframes wbFadeUp   { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes wbPulse    { 0%,100% { opacity:1; } 50% { opacity:.5; } }
        @keyframes wbShimmer  {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }

        .wb-root * { box-sizing: border-box; margin: 0; padding: 0; }

        .wb-root {
          --clr-bg:         #0d0f14;
          --clr-card:       #13161e;
          --clr-border:     rgba(255,255,255,0.07);
          --clr-accent:     #00e5a0;
          --clr-accent-dim: rgba(0,229,160,0.12);
          --clr-text:       #e8eaf0;
          --clr-muted:      #5a607a;
          --clr-danger:     #ff5f5f;
          --clr-danger-dim: rgba(255,95,95,0.12);
          --clr-success:    #00e5a0;
          --clr-pending:    #f5a623;
          --radius:         16px;
          font-family: 'Syne', sans-serif;
          color: var(--clr-text);
        }

        /* ── Card ── */
        .wb-card {
          background: var(--clr-card);
          border: 1px solid var(--clr-border);
          border-radius: var(--radius);
          padding: 28px;
          max-width: 400px;
          width: 100%;
          animation: wbFadeUp .35s ease both;
          position: relative;
          overflow: hidden;
        }
        .wb-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,229,160,.06) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ── Header ── */
        .wb-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .wb-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--clr-muted);
        }
        .wb-badge {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 99px;
          background: var(--clr-accent-dim);
          color: var(--clr-accent);
          letter-spacing: .04em;
        }

        /* ── Amount display ── */
        .wb-amount-block {
          margin-bottom: 24px;
        }
        .wb-amount-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: var(--clr-muted);
          margin-bottom: 6px;
        }
        .wb-amount-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .wb-amount-value {
          font-family: 'DM Mono', monospace;
          font-size: 36px;
          font-weight: 500;
          color: var(--clr-text);
          line-height: 1;
          transition: color .3s;
        }
        .wb-amount-value.has-balance {
          color: var(--clr-accent);
        }
        .wb-amount-symbol {
          font-size: 14px;
          font-weight: 600;
          color: var(--clr-muted);
          letter-spacing: .06em;
        }
        .wb-amount-shimmer .wb-amount-value {
          background: linear-gradient(90deg, var(--clr-muted) 25%, #8b93af 50%, var(--clr-muted) 75%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: wbShimmer 1.4s linear infinite;
        }

        /* ── Divider ── */
        .wb-divider {
          height: 1px;
          background: var(--clr-border);
          margin-bottom: 24px;
        }

        /* ── Button ── */
        .wb-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 15px 24px;
          border: none;
          border-radius: 12px;
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: .03em;
          cursor: pointer;
          transition: opacity .2s, transform .15s, box-shadow .2s, background .3s;
          position: relative;
          overflow: hidden;
        }
        .wb-btn:focus-visible {
          outline: 2px solid var(--clr-accent);
          outline-offset: 3px;
        }

        /* idle / default */
        .wb-btn-default {
          background: var(--clr-accent);
          color: #05120d;
          box-shadow: 0 0 24px rgba(0,229,160,.25);
        }
        .wb-btn-default:hover:not(:disabled) {
          box-shadow: 0 0 36px rgba(0,229,160,.4);
          transform: translateY(-1px);
        }
        .wb-btn-default:active:not(:disabled) {
          transform: translateY(0);
        }

        /* disabled (no balance) */
        .wb-btn-disabled {
          background: rgba(255,255,255,0.05);
          color: var(--clr-muted);
          cursor: not-allowed;
        }

        /* loading */
        .wb-btn-loading {
          background: rgba(0,229,160,0.15);
          color: var(--clr-accent);
          cursor: not-allowed;
          animation: wbPulse 1.6s ease-in-out infinite;
        }

        /* success */
        .wb-btn-success {
          background: rgba(0,229,160,0.15);
          color: var(--clr-accent);
          cursor: default;
        }

        /* error */
        .wb-btn-error {
          background: var(--clr-danger-dim);
          color: var(--clr-danger);
        }
        .wb-btn-error:hover {
          background: rgba(255,95,95,.2);
        }

        /* ── Status area ── */
        .wb-status {
          margin-top: 16px;
          animation: wbFadeUp .25s ease both;
        }
        .wb-status-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 10px;
        }
        .wb-status-pending {
          background: rgba(245,166,35,0.1);
          color: var(--clr-pending);
        }
        .wb-status-success {
          background: rgba(0,229,160,0.1);
          color: var(--clr-accent);
        }
        .wb-status-error {
          background: var(--clr-danger-dim);
          color: var(--clr-danger);
        }
        .wb-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
          animation: wbPulse 1.4s ease infinite;
        }
        .wb-status-dot.static {
          animation: none;
        }
        .wb-tx-link {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: inherit;
          opacity: .75;
          text-decoration: none;
          margin-left: auto;
          flex-shrink: 0;
        }
        .wb-tx-link:hover { opacity: 1; text-decoration: underline; }

        /* ── Refresh button ── */
        .wb-refresh {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-family: 'Syne', sans-serif;
          font-weight: 600;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: var(--clr-muted);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 0;
          margin-top: 12px;
          transition: color .2s;
        }
        .wb-refresh:hover { color: var(--clr-text); }
      `}</style>

      <div className="wb-root">
        <div className="wb-card">
          {/* Header */}
          <div className="wb-header">
            <span className="wb-title">Salary Withdrawal</span>
            <span className="wb-badge">PayrollStream</span>
          </div>

          {/* Amount */}
          <div
            className={`wb-amount-block ${status === "fetching" ? "wb-amount-shimmer" : ""}`}
          >
            <div className="wb-amount-label">Available to withdraw</div>
            <div className="wb-amount-row">
              <span
                className={`wb-amount-value ${hasBalance && status !== "fetching" ? "has-balance" : ""}`}
              >
                {status === "fetching" ? "——" : formattedAmount}
              </span>
              {status !== "fetching" && (
                <span className="wb-amount-symbol">{tokenSymbol}</span>
              )}
            </div>
          </div>

          <div className="wb-divider" />

          {/* CTA Button */}
          <button
            className={`wb-btn ${
              isLoading
                ? "wb-btn-loading"
                : status === "success"
                  ? "wb-btn-success"
                  : status === "error"
                    ? "wb-btn-error"
                    : isDisabled
                      ? "wb-btn-disabled"
                      : "wb-btn-default"
            }`}
            onClick={status === "error" ? reset : handleWithdraw}
            // disabled={isDisabled && status !== "error"}
            aria-label={buttonLabel()}
            aria-busy={isLoading}
          >
            {isLoading && <Spinner size={18} />}
            {status === "success" && <IconCheck />}
            {status === "error" && <IconX />}
            {!isLoading && status !== "success" && status !== "error" && (
              <IconArrowUp />
            )}
            {buttonLabel()}
          </button>

          {/* Status messages */}
          {status === "pending" && txHash && (
            <div className="wb-status">
              <div className="wb-status-row wb-status-pending">
                <span className="wb-status-dot" />
                <span>Transaction broadcasting…</span>
                <a
                  className="wb-tx-link"
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={txHash}
                >
                  {shortenHash(txHash)} ↗
                </a>
              </div>
            </div>
          )}

          {status === "success" && txHash && (
            <div className="wb-status">
              <div className="wb-status-row wb-status-success">
                <span className="wb-status-dot static" />
                <span>Withdrawal confirmed</span>
                <a
                  className="wb-tx-link"
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={txHash}
                >
                  {shortenHash(txHash)} ↗
                </a>
              </div>
              <button
                className="wb-refresh"
                onClick={reset}
                aria-label="Refresh balance"
              >
                <IconRefresh /> Refresh balance
              </button>
            </div>
          )}

          {status === "error" && errorMsg && (
            <div className="wb-status">
              <div className="wb-status-row wb-status-error">
                <span className="wb-status-dot static" />
                <span>{errorMsg}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
