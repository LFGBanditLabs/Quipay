/**
 * TransactionSimulationModal.tsx
 * Quipay — Pre-signing transaction simulation preview modal
 * Place in: src/components/TransactionSimulationModal.tsx
 *
 * Shows estimated gas, resulting balances, and failure alerts
 * BEFORE the user signs a Soroban transaction.
 */

import { useState, useEffect, useCallback } from "react";
import type { SimulationResult, TokenBalance } from "../util/simulationUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransactionPreview {
  /** Human-readable description, e.g. "Withdraw 250.00 USDC" */
  description: string;
  /** The contract function being called */
  contractFunction: string;
  /** Contract address (shortened for display) */
  contractAddress: string;
  /** Current balances before the tx */
  currentBalances: { token: string; symbol: string; amount: number }[];
}

interface TransactionSimulationModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** The tx metadata shown in the modal */
  preview: TransactionPreview;
  /**
   * Called when modal mounts — must run the simulation and resolve.
   * Pass your actual simulateTransaction() call here.
   */
  onSimulate: () => Promise<SimulationResult>;
  /** User clicked "Confirm & Sign" */
  onConfirm: () => void;
  /** User clicked "Cancel" or closed the modal */
  onCancel: () => void;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconShield = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconGas = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    <path d="M15 8h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h0" />
    <line x1="3" y1="22" x2="21" y2="22" />
    <line x1="7" y1="10" x2="11" y2="10" />
  </svg>
);

const IconAlert = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="20"
    height="20"
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

const IconRestore = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
  </svg>
);

const IconArrowRight = () => (
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
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────

const Spinner = ({ size = 20 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    style={{ animation: "tsmSpin .75s linear infinite" }}
  >
    <circle cx="12" cy="12" r="10" strokeOpacity=".15" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

// ─── Balance Row ──────────────────────────────────────────────────────────────

function BalanceRow({ b }: { b: TokenBalance }) {
  const isDebit = b.delta < 0;
  const isCredit = b.delta > 0;
  const unchanged = b.delta === 0;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });

  return (
    <div className="tsm-balance-row">
      {/* Token badge */}
      <span className="tsm-token-badge">{b.symbol}</span>

      {/* Before */}
      <span className="tsm-balance-val tsm-muted">{fmt(b.before)}</span>

      {/* Arrow */}
      <span className="tsm-balance-arrow">
        <IconArrowRight />
      </span>

      {/* After */}
      <span
        className={`tsm-balance-val ${isDebit ? "tsm-red" : isCredit ? "tsm-green" : "tsm-muted"}`}
      >
        {fmt(b.after)}
      </span>

      {/* Delta pill */}
      <span
        className={`tsm-delta-pill ${isDebit ? "tsm-delta-red" : isCredit ? "tsm-delta-green" : "tsm-delta-neutral"}`}
      >
        {unchanged ? "—" : `${isDebit ? "" : "+"}${fmt(b.delta)} ${b.symbol}`}
      </span>
    </div>
  );
}

// ─── Status Banner ────────────────────────────────────────────────────────────

function StatusBanner({ result }: { result: SimulationResult }) {
  if (result.status === "success") {
    return (
      <div className="tsm-banner tsm-banner-success">
        <IconCheck />
        <div>
          <strong>Simulation passed</strong>
          <p>This transaction is expected to succeed on-chain.</p>
        </div>
      </div>
    );
  }

  if (result.status === "restore_required") {
    return (
      <div className="tsm-banner tsm-banner-warning">
        <IconRestore />
        <div>
          <strong>Ledger restore required</strong>
          <p>{result.errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tsm-banner tsm-banner-error">
      <IconAlert />
      <div>
        <strong>Transaction will likely fail</strong>
        <p>
          {result.errorMessage ??
            "Simulation returned an error. Signing may waste gas."}
        </p>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function TransactionSimulationModal({
  open,
  preview,
  onSimulate,
  onConfirm,
  onCancel,
}: TransactionSimulationModalProps) {
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // ── Run simulation when modal opens ──
  const runSim = useCallback(async () => {
    setSimLoading(true);
    setSimResult(null);
    setSimError(null);
    try {
      const result = await onSimulate();
      setSimResult(result);
    } catch (err: unknown) {
      setSimError(
        err instanceof Error ? err.message : "Simulation failed unexpectedly.",
      );
    } finally {
      setSimLoading(false);
    }
  }, [onSimulate]);

  useEffect(() => {
    if (open) {
      setConfirming(false);
      void runSim();
    }
  }, [open, runSim]);

  const handleConfirm = () => {
    setConfirming(true);
    onConfirm();
  };

  const canConfirm =
    !simLoading &&
    !confirming &&
    simResult !== null &&
    simResult.status !== "restore_required";

  const willFail = simResult?.status === "error";

  if (!open) return null;

  //   const fmtXLM = (n: number) =>
  //     n.toLocaleString("en-US", {
  //       minimumFractionDigits: 7,
  //       maximumFractionDigits: 7,
  //     });

  const fmtStroops = (n: number) => n.toLocaleString("en-US");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Mona+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        @keyframes tsmSpin    { to { transform: rotate(360deg); } }
        @keyframes tsmFadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes tsmSlideUp { from { opacity:0; transform:translateY(24px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes tsmPulse   { 0%,100%{opacity:1}50%{opacity:.4} }
        @keyframes tsmShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }

        .tsm-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(5,4,12,.75);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: tsmFadeIn .2s ease both;
        }

        .tsm-modal {
          --bg:       #0f0d1a;
          --surface:  #161325;
          --border:   rgba(255,255,255,0.08);
          --accent:   #6E56CF;
          --accent2:  #9b85f5;
          --text:     #eceaf8;
          --muted:    #6b6480;
          --green:    #34d399;
          --red:      #f87171;
          --yellow:   #fbbf24;
          --radius:   16px;

          font-family: 'Mona Sans', sans-serif;
          background: var(--bg);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          color: var(--text);
          box-shadow: 0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(110,86,207,.15);
          animation: tsmSlideUp .3s cubic-bezier(.16,1,.3,1) both;
          scrollbar-width: thin;
          scrollbar-color: rgba(110,86,207,.3) transparent;
        }

        /* ── Header ── */
        .tsm-header {
          padding: 22px 24px 18px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          position: sticky;
          top: 0;
          background: var(--bg);
          z-index: 1;
        }
        .tsm-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .tsm-header-icon {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: rgba(110,86,207,.15);
          color: var(--accent2);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .tsm-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.2;
        }
        .tsm-subtitle {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }
        .tsm-close {
          background: none; border: none; cursor: pointer;
          color: var(--muted); display: flex; padding: 4px;
          border-radius: 6px; transition: color .15s;
          flex-shrink: 0;
        }
        .tsm-close:hover { color: var(--text); }

        /* ── Body ── */
        .tsm-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 20px; }

        /* ── Tx summary pill ── */
        .tsm-tx-summary {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tsm-tx-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }
        .tsm-tx-label { color: var(--muted); font-weight: 500; }
        .tsm-tx-val {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          color: var(--text);
          background: rgba(255,255,255,.04);
          padding: 3px 8px;
          border-radius: 6px;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tsm-tx-desc {
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 2px;
        }

        /* ── Section label ── */
        .tsm-section-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }

        /* ── Simulation loading ── */
        .tsm-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 28px 0;
          color: var(--muted);
          font-size: 13px;
        }
        .tsm-loading-bar {
          width: 100%;
          height: 3px;
          border-radius: 99px;
          background: rgba(110,86,207,.15);
          overflow: hidden;
        }
        .tsm-loading-fill {
          height: 100%;
          width: 40%;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          background-size: 200% auto;
          animation: tsmShimmer 1.2s linear infinite;
        }

        /* ── Banner ── */
        .tsm-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
        }
        .tsm-banner strong { display: block; font-size: 13px; font-weight: 700; margin-bottom: 2px; }
        .tsm-banner p { margin: 0; font-size: 12px; opacity: .8; }
        .tsm-banner-success {
          background: rgba(52,211,153,.08);
          border: 1px solid rgba(52,211,153,.25);
          color: var(--green);
        }
        .tsm-banner-error {
          background: rgba(248,113,113,.08);
          border: 1px solid rgba(248,113,113,.25);
          color: var(--red);
        }
        .tsm-banner-warning {
          background: rgba(251,191,36,.08);
          border: 1px solid rgba(251,191,36,.25);
          color: var(--yellow);
        }

        /* ── Gas card ── */
        .tsm-gas-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .tsm-gas-item { display: flex; flex-direction: column; gap: 3px; }
        .tsm-gas-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .tsm-gas-val {
          font-family: 'DM Mono', monospace;
          font-size: 16px;
          font-weight: 500;
          color: var(--text);
        }
        .tsm-gas-sub {
          font-size: 11px;
          color: var(--muted);
        }

        /* ── Resources grid ── */
        .tsm-resources {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .tsm-resource-item {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .tsm-resource-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
        .tsm-resource-val { font-family: 'DM Mono', monospace; font-size: 13px; color: var(--text); font-weight: 500; }

        /* ── Balances ── */
        .tsm-balance-row {
          display: grid;
          grid-template-columns: 56px 1fr auto 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          margin-bottom: 6px;
          font-size: 13px;
        }
        .tsm-token-badge {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          background: rgba(110,86,207,.15);
          color: var(--accent2);
          padding: 3px 8px;
          border-radius: 6px;
          text-align: center;
        }
        .tsm-balance-val { font-family: 'DM Mono', monospace; font-size: 13px; }
        .tsm-balance-arrow { color: var(--muted); display: flex; }
        .tsm-muted  { color: var(--muted); }
        .tsm-green  { color: var(--green); }
        .tsm-red    { color: var(--red); }
        .tsm-delta-pill {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 6px;
          white-space: nowrap;
        }
        .tsm-delta-red     { background: rgba(248,113,113,.1);  color: var(--red);   }
        .tsm-delta-green   { background: rgba(52,211,153,.1);   color: var(--green); }
        .tsm-delta-neutral { background: rgba(255,255,255,.04); color: var(--muted); }

        /* ── Sim error ── */
        .tsm-sim-error {
          text-align: center;
          padding: 20px;
          color: var(--red);
          font-size: 13px;
        }
        .tsm-sim-error button {
          margin-top: 12px;
          background: rgba(248,113,113,.1);
          border: 1px solid rgba(248,113,113,.25);
          color: var(--red);
          padding: 7px 16px;
          border-radius: 8px;
          font-family: 'Mona Sans', sans-serif;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        /* ── Footer ── */
        .tsm-footer {
          padding: 18px 24px;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 10px;
          position: sticky;
          bottom: 0;
          background: var(--bg);
        }
        .tsm-btn {
          flex: 1;
          padding: 13px 20px;
          border-radius: 12px;
          border: none;
          font-family: 'Mona Sans', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all .15s;
        }
        .tsm-btn-cancel {
          background: rgba(255,255,255,.05);
          color: var(--muted);
          border: 1.5px solid var(--border);
        }
        .tsm-btn-cancel:hover { background: rgba(255,255,255,.08); color: var(--text); }
        .tsm-btn-confirm {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 4px 20px rgba(110,86,207,.35);
        }
        .tsm-btn-confirm:hover:not(:disabled) {
          box-shadow: 0 6px 28px rgba(110,86,207,.5);
          transform: translateY(-1px);
        }
        .tsm-btn-confirm:disabled {
          opacity: .4;
          cursor: not-allowed;
          transform: none;
        }
        .tsm-btn-danger {
          background: rgba(248,113,113,.15);
          color: var(--red);
          border: 1.5px solid rgba(248,113,113,.3);
        }
        .tsm-btn-danger:hover:not(:disabled) {
          background: rgba(248,113,113,.25);
        }

        /* ── Fail override notice ── */
        .tsm-fail-notice {
          font-size: 11px;
          color: var(--muted);
          text-align: center;
          margin-top: -8px;
          padding: 0 24px 12px;
        }
      `}</style>

      <div
        className="tsm-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <div
          className="tsm-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Transaction simulation preview"
        >
          {/* ── Header ── */}
          <div className="tsm-header">
            <div className="tsm-header-left">
              <div className="tsm-header-icon">
                <IconShield />
              </div>
              <div>
                <div className="tsm-title">Transaction Preview</div>
                <div className="tsm-subtitle">
                  Simulated before signing · No gas spent
                </div>
              </div>
            </div>
            <button className="tsm-close" onClick={onCancel} aria-label="Close">
              <IconX />
            </button>
          </div>

          <div className="tsm-body">
            {/* ── Transaction summary ── */}
            <div className="tsm-tx-summary">
              <div className="tsm-tx-desc">{preview.description}</div>
              <div className="tsm-tx-row">
                <span className="tsm-tx-label">Function</span>
                <span className="tsm-tx-val">{preview.contractFunction}()</span>
              </div>
              <div className="tsm-tx-row">
                <span className="tsm-tx-label">Contract</span>
                <span className="tsm-tx-val">{preview.contractAddress}</span>
              </div>
            </div>

            {/* ── Simulation result ── */}
            {simLoading && (
              <div className="tsm-loading">
                <Spinner size={28} />
                <span>Running simulation on Soroban…</span>
                <div className="tsm-loading-bar">
                  <div className="tsm-loading-fill" />
                </div>
              </div>
            )}

            {simError && !simLoading && (
              <div className="tsm-sim-error">
                <p>Could not connect to simulation endpoint.</p>
                <p style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>
                  {simError}
                </p>
                <button
                  onClick={() => {
                    void runSim();
                  }}
                >
                  Retry simulation
                </button>
              </div>
            )}

            {simResult && !simLoading && (
              <>
                {/* Status banner */}
                <StatusBanner result={simResult} />

                {/* Gas cost */}
                <div>
                  <div className="tsm-section-label">Estimated Gas Cost</div>
                  <div className="tsm-gas-card">
                    <div className="tsm-gas-item">
                      <span className="tsm-gas-label">
                        <IconGas />
                        Fee (XLM)
                      </span>
                      <span className="tsm-gas-val">
                        {simResult.estimatedFeeXLM > 0
                          ? simResult.estimatedFeeXLM.toLocaleString("en-US", {
                              minimumFractionDigits: 7,
                            })
                          : "< 0.0000001"}
                      </span>
                      <span className="tsm-gas-sub">
                        ≈ ${(simResult.estimatedFeeXLM * 0.11).toFixed(6)} USD
                      </span>
                    </div>
                    <div className="tsm-gas-item">
                      <span className="tsm-gas-label">Stroops</span>
                      <span className="tsm-gas-val">
                        {simResult.estimatedFeeStroops > 0
                          ? fmtStroops(simResult.estimatedFeeStroops)
                          : "~100"}
                      </span>
                      <span className="tsm-gas-sub">
                        1 XLM = 10,000,000 stroops
                      </span>
                    </div>
                  </div>
                </div>

                {/* Resource usage */}
                {simResult.resources && (
                  <div>
                    <div className="tsm-section-label">
                      Soroban Resource Usage
                    </div>
                    <div className="tsm-resources">
                      <div className="tsm-resource-item">
                        <span className="tsm-resource-label">
                          CPU Instructions
                        </span>
                        <span className="tsm-resource-val">
                          {simResult.resources.instructions.toLocaleString()}
                        </span>
                      </div>
                      <div className="tsm-resource-item">
                        <span className="tsm-resource-label">
                          Memory (bytes)
                        </span>
                        <span className="tsm-resource-val">
                          {simResult.resources.readBytes.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resulting balances */}
                {simResult.balanceChanges.length > 0 && (
                  <div>
                    <div className="tsm-section-label">Resulting Balances</div>
                    {simResult.balanceChanges.map((b) => (
                      <BalanceRow key={b.token} b={b} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Footer: CTA ── */}
          {!simLoading && (
            <>
              <div className="tsm-footer">
                <button className="tsm-btn tsm-btn-cancel" onClick={onCancel}>
                  Cancel
                </button>
                {simResult?.status !== "restore_required" && (
                  <button
                    className={`tsm-btn ${willFail ? "tsm-btn-danger" : "tsm-btn-confirm"}`}
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    aria-label={
                      willFail
                        ? "Sign anyway (transaction may fail)"
                        : "Confirm and sign transaction"
                    }
                  >
                    {confirming ? (
                      <>
                        <Spinner size={16} /> Awaiting wallet…
                      </>
                    ) : willFail ? (
                      "⚠ Sign anyway"
                    ) : simResult === null ? (
                      "Waiting for simulation…"
                    ) : (
                      "Confirm & Sign →"
                    )}
                  </button>
                )}
              </div>
              {willFail && (
                <p className="tsm-fail-notice">
                  Signing may consume gas without completing the transaction.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Demo wrapper (for development) ──────────────────────────────────────────

/**
 * DemoSimulationButton
 * Drop this anywhere to test the modal with mock data.
 * Remove before shipping.
 */
export function DemoSimulationButton() {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<"success" | "error" | "restore">(
    "success",
  );

  const mockSimulate = async (): Promise<SimulationResult> => {
    // Simulate network delay
    await new Promise((res) => setTimeout(res, 1800));

    if (scenario === "error") {
      return {
        status: "error",
        estimatedFeeStroops: 0,
        estimatedFeeXLM: 0,
        balanceChanges: [],
        errorMessage:
          "HostError: Contract trap (insufficient balance). The worker has no withdrawable balance.",
        restoreRequired: false,
      };
    }

    if (scenario === "restore") {
      return {
        status: "restore_required",
        estimatedFeeStroops: 0,
        estimatedFeeXLM: 0,
        balanceChanges: [],
        errorMessage:
          "Ledger entry expired. A restore transaction is required before this operation can proceed.",
        restoreRequired: true,
      };
    }

    return {
      status: "success",
      estimatedFeeStroops: 74821,
      estimatedFeeXLM: 0.0074821,
      balanceChanges: [
        {
          token: "USDC",
          symbol: "USDC",
          before: 1250.0,
          after: 1500.0,
          delta: 250.0,
        },
        {
          token: "XLM",
          symbol: "XLM",
          before: 10.5,
          after: 10.4925,
          delta: -0.0075,
        },
      ],
      resources: {
        instructions: 2_847_326,
        readBytes: 18_432,
        writeBytes: 0,
        readEntries: 4,
        writeEntries: 2,
      },
      restoreRequired: false,
    };
  };

  const preview: TransactionPreview = {
    description: "Withdraw 250.00 USDC",
    contractFunction: "withdraw",
    contractAddress: "CAAWR...XQ2F",
    currentBalances: [
      { token: "USDC", symbol: "USDC", amount: 1250.0 },
      { token: "XLM", symbol: "XLM", amount: 10.5 },
    ],
  };

  return (
    <>
      <style>{`
        .demo-root {
          min-height: 100vh;
          background: #0a0910;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          font-family: 'Mona Sans', sans-serif;
          padding: 40px 20px;
        }
        .demo-title {
          font-size: 13px;
          color: rgba(255,255,255,.3);
          letter-spacing: .1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .demo-scenario-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .demo-scenario-btn {
          padding: 8px 18px;
          border-radius: 99px;
          border: 1.5px solid rgba(255,255,255,.1);
          background: transparent;
          color: rgba(255,255,255,.5);
          font-family: 'Mona Sans', sans-serif;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all .15s;
        }
        .demo-scenario-btn.active {
          background: #6E56CF;
          border-color: #6E56CF;
          color: #fff;
        }
        .demo-open-btn {
          padding: 14px 36px;
          background: #6E56CF;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-family: 'Mona Sans', sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 24px rgba(110,86,207,.4);
          transition: all .15s;
        }
        .demo-open-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(110,86,207,.5); }
      `}</style>
      <div className="demo-root">
        <div className="demo-title">Transaction Simulation Modal · Demo</div>
        <div className="demo-scenario-row">
          {(["success", "error", "restore"] as const).map((s) => (
            <button
              key={s}
              className={`demo-scenario-btn ${scenario === s ? "active" : ""}`}
              onClick={() => setScenario(s)}
            >
              Scenario: {s}
            </button>
          ))}
        </div>
        <button className="demo-open-btn" onClick={() => setOpen(true)}>
          Preview Transaction →
        </button>
      </div>

      <TransactionSimulationModal
        open={open}
        preview={preview}
        onSimulate={mockSimulate}
        onConfirm={() => {
          setOpen(false);
          alert("Wallet signing flow triggered!");
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
