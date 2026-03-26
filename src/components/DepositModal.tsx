import React, { useState } from "react";
import { Button, Text, Icon } from "@stellar/design-system";
import { TokenVaultData } from "../contracts/payroll_vault";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultData: TokenVaultData[];
  onDeposit: (tokenAddress: string, amount: string) => Promise<void>;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  vaultData,
  onDeposit,
}) => {
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<string>(
    vaultData[0]?.token || "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentTokenData = vaultData.find((t) => t.token === selectedToken);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;

    try {
      setIsSubmitting(true);
      await onDeposit(selectedToken, amount);
      onClose();
      setAmount("");
    } catch (err) {
      console.error("Deposit failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--sds-color-neutral-border)] bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <Text as="h3" size="lg" weight="bold">
            Deposit Funds
          </Text>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
          >
            <Icon.X size="sm" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-[var(--text)]">
              Select Token
            </label>
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3 text-[var(--text)] outline-none focus:border-[var(--accent)]"
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              disabled={isSubmitting}
            >
              {vaultData.map((t) => (
                <option key={t.tokenSymbol} value={t.token}>
                  {t.tokenSymbol} (Balance:{" "}
                  {(
                    Number(t.balance) /
                    Math.pow(10, t.tokenSymbol === "USDC" ? 6 : 7)
                  ).toFixed(2)}{" "}
                  {t.tokenSymbol})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-[var(--text)]">
              Amount to Deposit
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSubmitting}
                required
                min="0.0000001"
              />
              {currentTokenData && (
                <div className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-[var(--muted)]">
                  {currentTokenData.tokenSymbol}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={!amount || isSubmitting}
            >
              {isSubmitting ? "Depositing..." : "Confirm Deposit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
