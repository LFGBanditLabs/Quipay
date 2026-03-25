import { Text, Icon, Button } from "@stellar/design-system";
import { TokenVaultData } from "../../contracts/payroll_vault";

interface SolvencyCardProps {
  vaultData: TokenVaultData[];
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
}

/**
 * Formats a bigint amount in stroops to a human-readable string.
 * @param stroops Amount in stroops (smallest unit)
 * @param decimals Number of decimal places for the token (default: 7 for XLM)
 * @returns Formatted string with token symbol
 */
function formatStroops(stroops: bigint, decimals: number = 7): string {
  const divisor = Math.pow(10, decimals);
  const value = Number(stroops) / divisor;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Returns the appropriate number of decimals for a token.
 */
function getTokenDecimals(tokenSymbol: string): number {
  // USDC typically uses 6 decimals, XLM uses 7
  return tokenSymbol.toUpperCase() === "USDC" ? 6 : 7;
}

/**
 * SolvencyCard Component
 *
 * Displays per-token treasury solvency information including:
 * - Total balance
 * - Total liability (committed to streams)
 * - Available balance (balance - liability)
 * - Runway in days (based on burn rate)
 *
 * Shows an alert card when runway is less than 7 days.
 */
export default function SolvencyCard({
  vaultData,
  isLoading = false,
  onRefresh,
}: SolvencyCardProps) {
  // Check if any token has low runway (< 7 days)
  const hasLowRunway = vaultData.some(
    (v) => v.runwayDays < 7 && v.runwayDays !== 9999,
  );

  // Check if any token is insolvent (liability > balance)
  const hasInsolvency = vaultData.some((v) => v.liability > v.balance);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
          <Text as="p" size="sm" style={{ color: "var(--muted)" }}>
            Loading vault data...
          </Text>
        </div>
      </div>
    );
  }

  if (vaultData.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <Text as="p" size="sm" style={{ color: "var(--muted)" }}>
          No vault data available. Ensure the PayrollVault contract is
          configured.
        </Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Low Runway Alert */}
      {hasLowRunway && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <Icon.AlertTriangle size="md" style={{ color: "#f59e0b" }} />
            <div className="flex-1">
              <Text
                as="h3"
                size="md"
                weight="medium"
                style={{ color: "#f59e0b", marginBottom: "0.25rem" }}
              >
                Low Runway Alert
              </Text>
              <Text as="p" size="sm" style={{ color: "#f59e0b" }}>
                One or more tokens have less than 7 days of runway remaining.
                Consider depositing additional funds to prevent stream
                interruptions.
              </Text>
            </div>
          </div>
        </div>
      )}

      {/* Insolvency Alert */}
      {hasInsolvency && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <Icon.AlertCircle size="md" style={{ color: "#ef4444" }} />
            <div className="flex-1">
              <Text
                as="h3"
                size="md"
                weight="medium"
                style={{ color: "#ef4444", marginBottom: "0.25rem" }}
              >
                Insolvency Detected
              </Text>
              <Text as="p" size="sm" style={{ color: "#ef4444" }}>
                Liabilities exceed treasury balance for one or more tokens.
                Immediate action required to prevent stream failures.
              </Text>
            </div>
          </div>
        </div>
      )}

      {/* Per-Token Solvency Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {vaultData.map((tokenData) => {
          const decimals = getTokenDecimals(tokenData.tokenSymbol);
          const isLowRunway =
            tokenData.runwayDays < 7 && tokenData.runwayDays !== 9999;
          const isInsolvent = tokenData.liability > tokenData.balance;

          return (
            <div
              key={tokenData.tokenSymbol}
              className={`rounded-xl border p-5 ${
                isInsolvent
                  ? "border-red-500/50 bg-red-500/5"
                  : isLowRunway
                    ? "border-amber-500/50 bg-amber-500/5"
                    : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {/* Token Header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isInsolvent
                        ? "bg-red-500/20"
                        : isLowRunway
                          ? "bg-amber-500/20"
                          : "bg-[var(--primary)]/20"
                    }`}
                  >
                    <span className="text-lg font-bold">
                      {tokenData.tokenSymbol.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <Text as="h3" size="md" weight="medium">
                      {tokenData.tokenSymbol}
                    </Text>
                    <Text as="p" size="xs" style={{ color: "var(--muted)" }}>
                      {tokenData.token.slice(0, 8)}...
                    </Text>
                  </div>
                </div>
                {onRefresh && (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => {
                      void onRefresh();
                    }}
                    icon={<Icon.RefreshCw01 size="sm" />}
                  />
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Balance */}
                <div className="rounded-lg bg-[var(--surface)]/50 p-3">
                  <Text
                    as="p"
                    size="xs"
                    style={{ color: "var(--muted)" }}
                    className="mb-1"
                  >
                    Balance
                  </Text>
                  <Text as="p" size="sm" weight="medium" className="truncate">
                    {formatStroops(tokenData.balance, decimals)}{" "}
                    {tokenData.tokenSymbol}
                  </Text>
                </div>

                {/* Liability */}
                <div className="rounded-lg bg-[var(--surface)]/50 p-3">
                  <Text
                    as="p"
                    size="xs"
                    style={{ color: "var(--muted)" }}
                    className="mb-1"
                  >
                    Liability
                  </Text>
                  <Text
                    as="p"
                    size="sm"
                    weight="medium"
                    className={
                      isInsolvent ? "text-red-400" : "text-[var(--text)]"
                    }
                  >
                    {formatStroops(tokenData.liability, decimals)}{" "}
                    {tokenData.tokenSymbol}
                  </Text>
                </div>

                {/* Available */}
                <div className="rounded-lg bg-[var(--surface)]/50 p-3">
                  <Text
                    as="p"
                    size="xs"
                    style={{ color: "var(--muted)" }}
                    className="mb-1"
                  >
                    Available
                  </Text>
                  <Text
                    as="p"
                    size="sm"
                    weight="medium"
                    className={
                      tokenData.available <= BigInt(0)
                        ? "text-red-400"
                        : "text-emerald-400"
                    }
                  >
                    {formatStroops(tokenData.available, decimals)}{" "}
                    {tokenData.tokenSymbol}
                  </Text>
                </div>

                {/* Runway */}
                <div className="rounded-lg bg-[var(--surface)]/50 p-3">
                  <Text
                    as="p"
                    size="xs"
                    style={{ color: "var(--muted)" }}
                    className="mb-1"
                  >
                    Runway
                  </Text>
                  <div className="flex items-center gap-1">
                    {tokenData.runwayDays === 9999 ? (
                      <Text
                        as="p"
                        size="sm"
                        weight="medium"
                        style={{ color: "var(--muted)" }}
                      >
                        ∞ days
                      </Text>
                    ) : (
                      <>
                        <Text
                          as="p"
                          size="sm"
                          weight="medium"
                          className={
                            isLowRunway
                              ? "text-amber-400"
                              : tokenData.runwayDays < 30
                                ? "text-[var(--text)]"
                                : "text-emerald-400"
                          }
                        >
                          {tokenData.runwayDays} days
                        </Text>
                        {isLowRunway && (
                          <Icon.AlertTriangle
                            size="sm"
                            style={{ color: "#f59e0b" }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Bar: Liability vs Balance */}
              <div className="mt-4">
                <div className="mb-1 flex justify-between">
                  <Text as="p" size="xs" style={{ color: "var(--muted)" }}>
                    Utilization
                  </Text>
                  <Text as="p" size="xs" style={{ color: "var(--muted)" }}>
                    {tokenData.balance > BigInt(0)
                      ? Math.min(
                          100,
                          Math.round(
                            (Number(tokenData.liability) /
                              Number(tokenData.balance)) *
                              100,
                          ),
                        )
                      : 0}
                    %
                  </Text>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className={`h-full transition-all ${
                      isInsolvent
                        ? "bg-red-500"
                        : isLowRunway
                          ? "bg-amber-500"
                          : "bg-[var(--primary)]"
                    }`}
                    style={{
                      width: `${
                        tokenData.balance > BigInt(0)
                          ? Math.min(
                              100,
                              (Number(tokenData.liability) /
                                Number(tokenData.balance)) *
                                100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
