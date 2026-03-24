import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Layout, Text, Input } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import {
  payrollVaultClient,
  type TreasuryTokenState,
  type TreasuryTransaction,
} from "../lib/payrollVaultClient";
import { Skeleton, SkeletonCard } from "../components/Loading";

interface TreasuryViewTokenState extends TreasuryTokenState {
  availableBalance: number;
}

const toDisplayAmount = (amount: number): string => amount.toFixed(2);
const STELLAR_ASSET_CODE_REGEX = /^[A-Z0-9]{1,12}$/;

const TreasuryManager: React.FC = () => {
  const tw = {
    headerRow: "mb-5 flex items-center justify-between",
    description: "mb-6 max-w-[760px]",
    balancesGrid:
      "mb-7 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4",
    card: "rounded-[10px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4",
    metricLabel: "text-[13px] text-[var(--muted)]",
    metricValue: "mb-2 mt-1",
    formsGrid: "mb-7 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4",
    fieldGroup: "flex flex-col gap-3",
    selectInput:
      "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]",
    historyList: "flex flex-col gap-2",
    historyItem:
      "flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3",
    historyMeta: "text-[var(--muted)]",
    emptyState: "py-3 text-[var(--muted)]",
    errorText: "text-[var(--sds-color-feedback-error)]",
    successText: "text-[var(--sds-color-feedback-success)]",
  };

  const navigate = useNavigate();
  const { address } = useWallet();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tokenState, setTokenState] = useState<TreasuryTokenState[]>([]);
  const [history, setHistory] = useState<TreasuryTransaction[]>([]);
  const [selectedDepositToken, setSelectedDepositToken] =
    useState<string>("USDC");
  const [selectedWithdrawalToken, setSelectedWithdrawalToken] =
    useState<string>("USDC");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const employerAddress = address ?? "demo-employer";

  const hydrateState = useCallback(async () => {
    setIsLoading(true);
    try {
      const store = await payrollVaultClient.getTreasuryState(employerAddress);
      setTokenState(store.tokenState);
      setHistory(store.history);
      if (store.tokenState.length > 0) {
        setSelectedDepositToken(store.tokenState[0].tokenSymbol);
        setSelectedWithdrawalToken(store.tokenState[0].tokenSymbol);
      }
    } finally {
      setIsLoading(false);
    }
  }, [employerAddress]);

  useEffect(() => {
    void hydrateState();
  }, [hydrateState]);

  const viewTokenState = useMemo<TreasuryViewTokenState[]>(
    () =>
      tokenState.map((token) => ({
        ...token,
        availableBalance: token.treasuryBalance - token.totalLiability,
      })),
    [tokenState],
  );

  const handleDeposit = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Enter a valid deposit amount greater than zero.");
      return;
    }
    const tokenSymbol = selectedDepositToken.trim().toUpperCase();
    if (!STELLAR_ASSET_CODE_REGEX.test(tokenSymbol)) {
      setErrorMessage(
        "Enter a valid Stellar asset code (1-12 uppercase letters/numbers).",
      );
      return;
    }

    try {
      const store = await payrollVaultClient.deposit({
        employerAddress,
        tokenSymbol,
        amount,
      });
      setTokenState(store.tokenState);
      setHistory(store.history);
      setDepositAmount("");
      setSelectedDepositToken(tokenSymbol);
      setSuccessMessage(`Deposited ${toDisplayAmount(amount)} ${tokenSymbol}.`);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to deposit funds.";
      setErrorMessage(msg);
    }
  };

  const handleWithdraw = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    const amount = Number(withdrawalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Enter a valid withdrawal amount greater than zero.");
      return;
    }

    try {
      const store = await payrollVaultClient.withdraw({
        employerAddress,
        tokenSymbol: selectedWithdrawalToken,
        amount,
      });
      setTokenState(store.tokenState);
      setHistory(store.history);
      setWithdrawalAmount("");
      setSuccessMessage(
        `Withdrew ${toDisplayAmount(amount)} ${selectedWithdrawalToken}.`,
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to withdraw funds.";
      setErrorMessage(msg);
    }
  };

  if (isLoading) {
    return (
      <Layout.Content>
        <Layout.Inset>
          <div className={tw.headerRow}>
            <Skeleton variant="rect" width="220px" height="28px" />
            <Skeleton variant="rect" width="140px" height="32px" />
          </div>
          <Skeleton variant="text" width="80%" height="14px" />
          <div className={tw.balancesGrid} style={{ marginTop: "16px" }}>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </div>
          <div className={tw.formsGrid} style={{ marginTop: "16px" }}>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
          <SkeletonCard lines={5} />
        </Layout.Inset>
      </Layout.Content>
    );
  }

  return (
    <Layout.Content>
      <Layout.Inset>
        <div className={tw.headerRow}>
          <Text as="h1" size="xl" weight="medium">
            Treasury Management
          </Text>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigate("/dashboard");
            }}
          >
            Back to Dashboard
          </Button>
        </div>

        <Text as="p" size="md" className={tw.description}>
          Manage treasury funds per token, review solvency, and track every
          treasury operation. Available balance is calculated as treasury
          balance minus total liabilities.
        </Text>

        <div className={tw.balancesGrid}>
          {viewTokenState.map((token: TreasuryViewTokenState) => (
            <div key={token.tokenSymbol} className={tw.card}>
              <Text as="div" size="md" weight="semi-bold">
                {token.tokenSymbol}
              </Text>
              <div className={tw.metricValue}>
                <Text as="div" size="sm" className={tw.metricLabel}>
                  Treasury Balance
                </Text>
                <Text as="div" size="md">
                  {toDisplayAmount(token.treasuryBalance)} {token.tokenSymbol}
                </Text>
              </div>
              <div className={tw.metricValue}>
                <Text as="div" size="sm" className={tw.metricLabel}>
                  Total Liability
                </Text>
                <Text as="div" size="md">
                  {toDisplayAmount(token.totalLiability)} {token.tokenSymbol}
                </Text>
              </div>
              <div>
                <Text as="div" size="sm" className={tw.metricLabel}>
                  Available Balance
                </Text>
                <Text as="div" size="md">
                  {toDisplayAmount(token.availableBalance)} {token.tokenSymbol}
                </Text>
              </div>
            </div>
          ))}
        </div>

        {(errorMessage || successMessage) && (
          <div style={{ marginBottom: "16px" }}>
            {errorMessage && (
              <Text as="p" size="sm" className={tw.errorText}>
                {errorMessage}
              </Text>
            )}
            {successMessage && (
              <Text as="p" size="sm" className={tw.successText}>
                {successMessage}
              </Text>
            )}
          </div>
        )}

        <div className={tw.formsGrid}>
          <div className={tw.card}>
            <Text as="h2" size="lg" weight="medium">
              Deposit Funds
            </Text>
            <div className={tw.fieldGroup}>
              <label htmlFor="deposit-token">
                <Text as="span" size="sm">
                  Asset Code (Any Stellar Asset)
                </Text>
              </label>
              <Input
                id="deposit-token"
                label=""
                fieldSize="md"
                placeholder="USDC"
                value={selectedDepositToken}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setSelectedDepositToken(event.target.value)
                }
              />
              <Input
                id="deposit-amount"
                label="Amount"
                fieldSize="md"
                type="number"
                min="0"
                step="0.01"
                value={depositAmount}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setDepositAmount(event.target.value)
                }
              />
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  void handleDeposit();
                }}
              >
                Deposit
              </Button>
            </div>
          </div>

          <div className={tw.card}>
            <Text as="h2" size="lg" weight="medium">
              Withdraw Funds
            </Text>
            <div className={tw.fieldGroup}>
              <label htmlFor="withdraw-token">
                <Text as="span" size="sm">
                  Token
                </Text>
              </label>
              <select
                id="withdraw-token"
                className={tw.selectInput}
                value={selectedWithdrawalToken}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedWithdrawalToken(event.target.value)
                }
              >
                {viewTokenState.map((token: TreasuryViewTokenState) => (
                  <option key={token.tokenSymbol} value={token.tokenSymbol}>
                    {token.tokenSymbol}
                  </option>
                ))}
              </select>
              <Input
                id="withdraw-amount"
                label="Amount"
                fieldSize="md"
                type="number"
                min="0"
                step="0.01"
                value={withdrawalAmount}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setWithdrawalAmount(event.target.value)
                }
              />
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  void handleWithdraw();
                }}
              >
                Withdraw
              </Button>
            </div>
          </div>
        </div>

        <div className={tw.card}>
          <Text as="h2" size="lg" weight="medium">
            Transaction History
          </Text>
          {history.length === 0 ? (
            <Text as="p" size="sm" className={tw.emptyState}>
              No transactions yet.
            </Text>
          ) : (
            <div className={tw.historyList}>
              {history.map((transaction: TreasuryTransaction) => (
                <div className={tw.historyItem} key={transaction.id}>
                  <div>
                    <Text as="div" size="sm" weight="semi-bold">
                      {transaction.type === "deposit"
                        ? "Deposit"
                        : "Withdrawal"}{" "}
                      {toDisplayAmount(transaction.amount)}{" "}
                      {transaction.tokenSymbol}
                    </Text>
                    <Text as="div" size="sm" className={tw.historyMeta}>
                      {new Date(transaction.timestamp).toLocaleString()}
                    </Text>
                  </div>
                  <Text as="div" size="sm" className={tw.successText}>
                    {transaction.status}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default TreasuryManager;
