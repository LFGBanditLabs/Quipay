/**
 * CrossChainWithdraw.tsx
 * ────────────────────────
 * Chain selector, address input, amount, and progress UI for
 * cross-chain USDC withdrawals via CCTP.
 */

import { useState, useEffect, useMemo } from "react";
import {
  useCrossChainWithdraw,
  getExplorerUrl,
  type CrossChainProgress,
  type CrossChainStep,
} from "../hooks/useCrossChainWithdraw";
import {
  SUPPORTED_EVM_CHAINS,
  getEvmChainConfig,
  validateEvmAddress,
  type SupportedEvmChain,
} from "../lib/evmAddresses";
import { shortenAddress } from "../util/address";
import { useEvmWallet } from "../hooks/useEvmWallet";
import { stellarNetwork } from "../contracts/util";

// ─── Chain Icon ───────────────────────────────────────────────────────────────

function ChainIcon({ chain }: { chain: SupportedEvmChain }) {
  const colors: Record<SupportedEvmChain, string> = {
    ethereum: "#627EEA",
    base: "#0052FF",
    arbitrum: "#28A0F0",
    optimism: "#FF0420",
  };

  return (
    <div
      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
      style={{ backgroundColor: colors[chain] }}
    >
      {chain === "ethereum" && "ETH"}
      {chain === "base" && "BASE"}
      {chain === "arbitrum" && "ARB"}
      {chain === "optimism" && "OP"}
    </div>
  );
}

// ─── Progress Indicator ───────────────────────────────────────────────────────

const STEP_ORDER: CrossChainStep[] = [
  "burning",
  "attesting",
  "minting",
  "complete",
];

function ProgressSteps({ progress }: { progress: CrossChainProgress }) {
  const currentIdx = STEP_ORDER.indexOf(progress.step);

  const steps = [
    { key: "burning", label: "Burn on Stellar" },
    { key: "attesting", label: "Circle Attestation" },
    { key: "minting", label: "Mint on destination" },
    { key: "complete", label: "Complete" },
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isPending = idx > currentIdx;

        return (
          <div key={step.key} className="flex items-center gap-3">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                isDone
                  ? "bg-green-500/20 text-green-400"
                  : isCurrent
                    ? "bg-yellow-400/20 text-yellow-400"
                    : "bg-white/[0.05] text-neutral-600"
              }`}
            >
              {isDone ? (
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                idx + 1
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-[13px] font-semibold ${
                  isDone
                    ? "text-green-400"
                    : isCurrent
                      ? "text-white"
                      : "text-neutral-600"
                }`}
              >
                {step.label}
              </p>
              {isCurrent && progress.message && (
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {progress.message}
                </p>
              )}
            </div>
            {isCurrent && progress.step !== "complete" && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CrossChainWithdrawProps {
  workerAddress: string;
  availableAmount: number;
  onSuccess?: () => void;
}

export function CrossChainWithdraw({
  workerAddress,
  availableAmount,
  onSuccess,
}: CrossChainWithdrawProps) {
  const { progress, withdraw, reset, isBusy } =
    useCrossChainWithdraw(workerAddress);
  const { evmAddress } = useEvmWallet();

  const [selectedChain, setSelectedChain] =
    useState<SupportedEvmChain>("base");
  const [destAddress, setDestAddress] = useState("");
  const [amount, setAmount] = useState("");

  // Auto-fill from Privy embedded EVM wallet
  useEffect(() => {
    if (evmAddress && !destAddress) {
      setDestAddress(evmAddress);
    }
  }, [evmAddress]);

  // Derive address validation inline instead of useEffect
  const addressError = useMemo(() => {
    if (!destAddress) return null;
    return validateEvmAddress(destAddress);
  }, [destAddress]);

  const chainConfig = getEvmChainConfig(selectedChain);
  const parsedAmount = parseFloat(amount) || 0;
  const isValidAmount = parsedAmount > 0 && parsedAmount <= availableAmount;
  const isValidAddress = destAddress && !addressError;
  const canSubmit = isValidAmount && isValidAddress && !isBusy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await withdraw({
      amount: parsedAmount,
      destinationChain: selectedChain,
      destinationAddress: destAddress,
    });
    onSuccess?.();
  };

  // ── Completion view ────────────────────────────────────────────────────
  if (progress.step === "complete") {
    return (
      <div className="rounded-2xl border border-green-500/20 bg-[#0a0a0a] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg
              className="h-5 w-5 text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-white">
              Withdrawal Complete
            </p>
            <p className="text-[12px] text-neutral-500">
              USDC sent to {chainConfig.name}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {progress.stellarTxHash && (
            <a
              href={`https://stellar.expert/explorer/${stellarNetwork.toLowerCase()}/tx/${progress.stellarTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
            >
              <span className="text-[12px] text-neutral-500">
                Stellar burn tx
              </span>
              <span className="font-mono text-[11px] text-yellow-400/70">
                {shortenAddress(progress.stellarTxHash)}
              </span>
            </a>
          )}
          {progress.destTxHash && (
            <a
              href={getExplorerUrl(selectedChain, progress.destTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
            >
              <span className="text-[12px] text-neutral-500">
                {chainConfig.explorerName} tx
              </span>
              <span className="font-mono text-[11px] text-yellow-400/70">
                {shortenAddress(progress.destTxHash)}
              </span>
            </a>
          )}
        </div>

        <button
          onClick={reset}
          className="mt-5 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] py-3 text-[13px] font-semibold text-neutral-400 hover:bg-white/[0.06] transition-colors"
        >
          Withdraw to Another Chain
        </button>
      </div>
    );
  }

  // ── Error view ─────────────────────────────────────────────────────────
  if (progress.step === "error") {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-[#0a0a0a] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-white">
              Withdrawal Failed
            </p>
            <p className="text-[12px] text-red-400">{progress.error}</p>
          </div>
        </div>
        <button
          onClick={reset}
          className="w-full rounded-xl bg-yellow-400 py-3 text-[13px] font-bold text-black hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── In-progress view ───────────────────────────────────────────────────
  if (progress.step !== "idle") {
    return (
      <div className="rounded-2xl border border-yellow-400/20 bg-[#0a0a0a] p-6">
        <p className="text-[15px] font-bold text-white mb-5">
          Cross-Chain Withdrawal
        </p>
        <ProgressSteps progress={progress} />
        <p className="mt-5 text-[11px] text-neutral-600 text-center">
          Please do not close this page while the transfer is in progress.
        </p>
      </div>
    );
  }

  // ── Form view ──────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6">
      <p className="text-[15px] font-bold text-white mb-5">
        Withdraw to Another Chain
      </p>

      {/* Chain selector */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
          Destination Chain
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SUPPORTED_EVM_CHAINS.map((chain) => {
            const cfg = getEvmChainConfig(chain);
            const isSelected = chain === selectedChain;
            return (
              <button
                key={chain}
                onClick={() => setSelectedChain(chain)}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all ${
                  isSelected
                    ? "border-yellow-400/30 bg-yellow-400/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <ChainIcon chain={chain} />
                <div className="text-left">
                  <p
                    className={`text-[13px] font-semibold ${isSelected ? "text-white" : "text-neutral-400"}`}
                  >
                    {cfg.name}
                  </p>
                  <p className="text-[10px] text-neutral-600">
                    {cfg.nativeSymbol}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
          Amount (USDC)
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            max={availableAmount}
            step="0.01"
            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[14px] font-semibold text-white placeholder:text-neutral-700 focus:outline-none focus:border-yellow-400/30 transition-colors"
          />
          <button
            onClick={() => setAmount(availableAmount.toString())}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-neutral-500 hover:text-white transition-colors"
          >
            MAX
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-600">
          Available: {availableAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC
        </p>
      </div>

      {/* Destination address */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
          {chainConfig.name} Address
        </label>
        <input
          type="text"
          value={destAddress}
          onChange={(e) => setDestAddress(e.target.value)}
          placeholder="0x..."
          className={`w-full rounded-xl border bg-white/[0.03] px-4 py-3 text-[14px] font-mono text-white placeholder:text-neutral-700 focus:outline-none transition-colors ${
            addressError
              ? "border-red-500/30 focus:border-red-500/50"
              : "border-white/[0.07] focus:border-yellow-400/30"
          }`}
        />
        {destAddress === evmAddress && evmAddress && (
          <p className="mt-1.5 text-[11px] text-green-400/70">
            Auto-filled from your embedded wallet
          </p>
        )}
        {addressError && (
          <p className="mt-1.5 text-[11px] text-red-400">{addressError}</p>
        )}
        <p className="mt-1.5 text-[10px] text-neutral-700">
          CCTP burns are irreversible. Double-check this address.
        </p>
      </div>

      {/* Submit */}
      <button
        onClick={() => void handleSubmit()}
        disabled={!canSubmit}
        className="w-full rounded-xl bg-yellow-400 py-3.5 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Withdraw {parsedAmount > 0 ? `${parsedAmount} USDC` : ""} to{" "}
        {chainConfig.name}
      </button>

      <p className="mt-3 text-[10px] text-neutral-700 text-center">
        Cross-chain transfers via Circle CCTP. Typical time: 1-2 minutes.
      </p>
    </div>
  );
}
