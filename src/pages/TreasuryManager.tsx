import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../hooks/useWallet";
import {
  buildDepositTx,
  buildVaultWithdrawTx,
  getAllVaultData,
  type TokenVaultData,
  PAYROLL_VAULT_CONTRACT_ID,
} from "../contracts/payroll_vault";
import { submitAndAwaitTx } from "../contracts/payroll_stream";
import { useNotification } from "../hooks/useNotification";
import { horizonUrl } from "../contracts/util";

// ─── Constants ────────────────────────────────────────────────────────────────

const STROOPS = 1e7;
const XLM_RESERVE = 1; // keep at least 1 XLM for fees

// ─── Fetch wallet balances from Horizon ──────────────────────────────────────

interface WalletBalances {
  XLM: number;
  USDC: number;
}

async function fetchWalletBalances(address: string): Promise<WalletBalances> {
  const USDC_ISSUER =
    "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
  try {
    const res = await fetch(`${horizonUrl}/accounts/${address}`);
    if (!res.ok) return { XLM: 0, USDC: 0 };
    const data = (await res.json()) as {
      balances: Array<{
        asset_type: string;
        asset_code?: string;
        asset_issuer?: string;
        balance: string;
      }>;
    };
    let xlm = 0,
      usdc = 0;
    for (const b of data.balances) {
      if (b.asset_type === "native") xlm = parseFloat(b.balance);
      if (b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER)
        usdc = parseFloat(b.balance);
    }
    return { XLM: xlm, USDC: usdc };
  } catch {
    return { XLM: 0, USDC: 0 };
  }
}

// Native XLM SAC and USDC on testnet
const TOKEN_MAP: Record<string, { address: string; label: string }> = {
  XLM: {
    address: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    label: "XLM (Native)",
  },
  USDC: {
    address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    label: "USDC",
  },
};

function fmt(n: number, d = 2) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

// ─── Transaction step overlay ─────────────────────────────────────────────────

function TxOverlay({ step }: { step: string }) {
  const labels: Record<string, [string, string]> = {
    building: ["Preparing transaction…", "Simulating on Stellar RPC"],
    signing: [
      "Check Freighter to sign",
      "Approve the transaction in your wallet",
    ],
    sending: [
      "Broadcasting to Stellar…",
      "Waiting for ledger confirmation (~5s)",
    ],
  };
  const [title, sub] = labels[step] ?? ["Processing…", ""];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#111] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400/10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" />
        </div>
        <p className="text-[16px] font-bold text-white mb-1">{title}</p>
        <p className="text-[13px] text-neutral-600">{sub}</p>
      </div>
    </div>
  );
}

// ─── Token vault card ─────────────────────────────────────────────────────────

function VaultCard({ v }: { v: TokenVaultData }) {
  const bal = Number(v.balance ?? 0) / STROOPS;
  const liab = Number(v.liability ?? 0) / STROOPS;
  const avail = Math.max(0, bal - liab);
  const pct = bal > 0 ? Math.min(100, (liab / bal) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[14px] font-bold text-white">{v.tokenSymbol}</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
            pct > 85
              ? "bg-red-500/10 text-red-400"
              : pct > 60
                ? "bg-yellow-400/10 text-yellow-400"
                : "bg-green-500/10 text-green-400"
          }`}
        >
          {pct > 85 ? "Critical" : pct > 60 ? "Low runway" : "Healthy"}
        </span>
      </div>

      <div className="flex flex-col gap-2 text-[13px] mb-4">
        <div className="flex justify-between">
          <span className="text-neutral-500">Vault balance</span>
          <span className="font-bold text-white">
            {fmt(bal)} {v.tokenSymbol}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Stream liability</span>
          <span className="font-semibold text-red-400">
            {fmt(liab)} {v.tokenSymbol}
          </span>
        </div>
        <div className="border-t border-white/[0.05] pt-2 flex justify-between">
          <span className="text-neutral-500">Available</span>
          <span className="font-bold" style={{ color: "#facc15" }}>
            {fmt(avail)} {v.tokenSymbol}
          </span>
        </div>
      </div>

      {/* Commitment bar */}
      <div>
        <div className="mb-1 flex justify-between text-[10px] text-neutral-700">
          <span>Committed to streams</span>
          <span>{pct.toFixed(1)}%</span>
        </div>
        <div className="h-[4px] w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor:
                pct > 85 ? "#ef4444" : pct > 60 ? "#facc15" : "#22c55e",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TreasuryManager: React.FC = () => {
  const { address, signTransaction } = useWallet();
  const { addNotification } = useNotification();

  const [vaultData, setVaultData] = useState<TokenVaultData[]>([]);
  const [walletBal, setWalletBal] = useState<WalletBalances>({
    XLM: 0,
    USDC: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [txStep, setTxStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [action, setAction] = useState<"deposit" | "withdraw">("deposit");
  const [token, setToken] = useState("XLM");
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, bal] = await Promise.all([
        address
          ? getAllVaultData(
              Object.entries(TOKEN_MAP).map(([sym]) => ({
                token: TOKEN_MAP[sym].address,
                tokenSymbol: sym,
                monthlyBurnRate: BigInt(0),
              })),
              address,
            )
          : Promise.resolve([]),
        address
          ? fetchWalletBalances(address)
          : Promise.resolve({ XLM: 0, USDC: 0 }),
      ]);
      setVaultData(data);
      setWalletBal(bal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vault data");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (!address || !signTransaction || !amount) return;
    const amtNum = parseFloat(amount);
    if (!amtNum || amtNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    // Validate against wallet balance for deposits
    if (action === "deposit") {
      const walletMax =
        token === "XLM"
          ? Math.max(0, walletBal.XLM - XLM_RESERVE)
          : walletBal.USDC;
      if (amtNum > walletMax) {
        setError(
          `Insufficient wallet balance. You have ${fmt(walletBal[token as keyof WalletBalances])} ${token}` +
            (token === "XLM" ? ` (keeping ${XLM_RESERVE} XLM for fees)` : "") +
            `. Max deposit: ${fmt(walletMax)} ${token}.`,
        );
        return;
      }
    }

    const tokenAddr = TOKEN_MAP[token]?.address ?? "";
    const amtStroops = BigInt(Math.round(amtNum * STROOPS));

    setError(null);
    try {
      setTxStep("building");
      const { preparedXdr } =
        action === "deposit"
          ? await buildDepositTx(address, tokenAddr, amtStroops)
          : await buildVaultWithdrawTx(address, address, tokenAddr, amtStroops);

      setTxStep("signing");
      const { signedTxXdr } = await signTransaction(preparedXdr, {
        networkPassphrase: import.meta.env
          .PUBLIC_STELLAR_NETWORK_PASSPHRASE as string,
      });

      setTxStep("sending");
      await submitAndAwaitTx(signedTxXdr);

      addNotification(
        `${action === "deposit" ? "Deposited" : "Withdrew"} ${fmt(amtNum)} ${token}`,
        "success",
      );
      setAmount("");
      void load(); // refresh balances
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setTxStep("");
    }
  };

  // Selected token's current vault state
  const selectedVault = vaultData.find((v) => v.tokenSymbol === token);
  const vaultBal = selectedVault
    ? Number(selectedVault.balance ?? 0) / STROOPS
    : 0;
  const vaultLiab = selectedVault
    ? Number(selectedVault.liability ?? 0) / STROOPS
    : 0;
  const vaultAvail = Math.max(0, vaultBal - vaultLiab);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10">
          <svg
            className="h-8 w-8 text-yellow-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h2 className="text-[20px] font-bold text-white mb-2">
          Connect your wallet
        </h2>
        <p className="text-[14px] text-neutral-500">
          Connect to manage your payroll treasury.
        </p>
      </div>
    );
  }

  return (
    <>
      {txStep && <TxOverlay step={txStep} />}

      <div className="px-6 py-8 sm:px-8 sm:py-10 max-w-[960px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Treasury
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Deposit funds to back your payment streams. Withdraw surplus at any
            time.
          </p>
        </div>

        {/* How it works */}
        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-5">
          <p className="mb-3 text-[13px] font-bold text-white">
            How the vault works
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-[12px]">
            {[
              {
                step: "1",
                label: "Deposit",
                desc: "Transfer XLM or USDC into the vault. This funds your active payment streams.",
              },
              {
                step: "2",
                label: "Stream",
                desc: "The vault holds the funds in escrow. Workers earn from it per second.",
              },
              {
                step: "3",
                label: "Withdraw",
                desc: "Any balance above your stream liabilities can be withdrawn back to your wallet.",
              },
            ].map(({ step, label, desc }) => (
              <div key={step} className="flex gap-3">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-black"
                  style={{ backgroundColor: "#facc15" }}
                >
                  {step}
                </div>
                <div>
                  <p className="font-bold text-white mb-0.5">{label}</p>
                  <p className="text-neutral-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vault balances */}
        {isLoading ? (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl bg-white/[0.04]"
              />
            ))}
          </div>
        ) : vaultData.length > 0 ? (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {vaultData.map((v) => (
              <VaultCard key={v.tokenSymbol} v={v} />
            ))}
          </div>
        ) : (
          <div className="mb-8 rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-8 text-center">
            <p className="text-[14px] text-neutral-600">
              No vault data. Deposit funds to get started.
            </p>
          </div>
        )}

        {/* Action form */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6">
          {/* Deposit / Withdraw tabs */}
          <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.07] bg-black p-1">
            {(["deposit", "withdraw"] as const).map((a) => (
              <button
                key={a}
                onClick={() => {
                  setAction(a);
                  setError(null);
                  setAmount("");
                }}
                className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold capitalize transition-all ${
                  action === a
                    ? "text-black"
                    : "text-neutral-500 hover:text-white"
                }`}
                style={action === a ? { backgroundColor: "#facc15" } : {}}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Token selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-white">
                Token
              </label>
              <select
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setError(null);
                }}
                className="w-full rounded-xl border border-white/[0.1] bg-black px-4 py-3 text-[14px] text-white focus:border-yellow-400/40 focus:outline-none"
              >
                {Object.entries(TOKEN_MAP).map(([sym, { label }]) => (
                  <option key={sym} value={sym}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-white">
                Amount
                {action === "deposit" && (
                  <span className="ml-2 text-[11px] font-normal text-neutral-600">
                    Wallet: {fmt(walletBal[token as keyof WalletBalances])}{" "}
                    {token}
                    {token === "XLM" && ` (keep ${XLM_RESERVE} for fees)`}
                  </span>
                )}
                {action === "withdraw" && (
                  <span className="ml-2 text-[11px] font-normal text-neutral-600">
                    Available: {fmt(vaultAvail)} {token}
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-white/[0.1] bg-black px-4 py-3 pr-16 text-[14px] text-white placeholder:text-neutral-700 focus:border-yellow-400/40 focus:outline-none focus:ring-1 focus:ring-yellow-400/20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-neutral-600">
                  {token}
                </span>
              </div>
            </div>
          </div>

          {/* Quick fill for deposit */}
          {action === "deposit" &&
            walletBal[token as keyof WalletBalances] > 0 && (
              <div className="mt-2 flex gap-2">
                {[25, 50, 75].map((pct) => {
                  const walletMax =
                    token === "XLM"
                      ? Math.max(0, walletBal.XLM - XLM_RESERVE)
                      : walletBal.USDC;
                  return (
                    <button
                      key={pct}
                      onClick={() =>
                        setAmount(((walletMax * pct) / 100).toFixed(2))
                      }
                      className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-neutral-500 hover:text-white transition-colors"
                    >
                      {pct}%
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    const max =
                      token === "XLM"
                        ? Math.max(0, walletBal.XLM - XLM_RESERVE)
                        : walletBal.USDC;
                    setAmount(max.toFixed(2));
                  }}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-neutral-500 hover:text-white transition-colors"
                >
                  Max
                </button>
              </div>
            )}

          {/* Quick fill for withdraw */}
          {action === "withdraw" && vaultAvail > 0 && (
            <div className="mt-2 flex gap-2">
              {[25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() =>
                    setAmount(((vaultAvail * pct) / 100).toFixed(2))
                  }
                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-neutral-500 hover:text-white transition-colors"
                >
                  {pct}%
                </button>
              ))}
              <button
                onClick={() => setAmount(vaultAvail.toFixed(2))}
                className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-neutral-500 hover:text-white transition-colors"
              >
                Max
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[12px] text-red-400 break-all">
              {error}
            </div>
          )}

          {/* Warning for deposit exceeding wallet balance */}
          {action === "deposit" &&
            !error &&
            (() => {
              const max =
                token === "XLM"
                  ? Math.max(0, walletBal.XLM - XLM_RESERVE)
                  : walletBal.USDC;
              return (
                parseFloat(amount) > max && (
                  <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[12px] text-red-400">
                    Exceeds wallet balance. You have{" "}
                    {fmt(walletBal[token as keyof WalletBalances])} {token}
                    {token === "XLM"
                      ? ` — keeping ${XLM_RESERVE} XLM for fees, max deposit: ${fmt(max)} XLM`
                      : ""}
                    .
                  </div>
                )
              );
            })()}

          {/* Warning for withdraw exceeding available */}
          {action === "withdraw" &&
            parseFloat(amount) > vaultAvail &&
            !error && (
              <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-4 py-3 text-[12px] text-yellow-400">
                Amount exceeds available balance ({fmt(vaultAvail)} {token}).
                Reduce or withdraw max.
              </div>
            )}

          {/* Submit */}
          <button
            onClick={() => void handleSubmit()}
            disabled={!amount || parseFloat(amount) <= 0 || !!txStep}
            className="mt-5 w-full rounded-xl py-3.5 text-[15px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#facc15" }}
          >
            {action === "deposit"
              ? `Deposit ${amount || "0"} ${token} to Vault`
              : `Withdraw ${amount || "0"} ${token} from Vault`}
          </button>

          <p className="mt-3 text-center text-[11px] text-neutral-700">
            {action === "deposit"
              ? "Funds are transferred on-chain to the vault contract and immediately available to back streams."
              : "Only available balance (above stream liabilities) can be withdrawn."}
          </p>
        </div>

        {/* Vault contract info */}
        {PAYROLL_VAULT_CONTRACT_ID && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.05] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <span className="font-mono text-[11px] text-neutral-600">
                {PAYROLL_VAULT_CONTRACT_ID.slice(0, 8)}…
                {PAYROLL_VAULT_CONTRACT_ID.slice(-6)}
              </span>
            </div>
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${PAYROLL_VAULT_CONTRACT_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] no-underline transition-colors hover:underline"
              style={{ color: "#facc15" }}
            >
              View on Explorer ↗
            </a>
          </div>
        )}
      </div>
    </>
  );
};

export default TreasuryManager;
