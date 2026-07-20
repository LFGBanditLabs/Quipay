import { useCallback, useEffect, useState } from "react";
import { Asset } from "@stellar/stellar-sdk";
import { useAuth } from "../hooks/useAuth";
import { useStellarSign } from "../hooks/useStellarSign";
import { buildDepositTx, getVaultData } from "../contracts/payroll_vault";
import { submitAndAwaitTx } from "../contracts/payroll_stream";
import { horizonUrl, networkPassphrase } from "../contracts/util";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const USDC_ISSUER = import.meta.env.PUBLIC_USDC_ISSUER ?? "";
const STROOPS = 1e7; // USDC uses 7 decimals on Stellar

// USDC's Soroban contract (SAC) address, derived from the classic asset.
const USDC_SAC = USDC_ISSUER
  ? new Asset("USDC", USDC_ISSUER).contractId(networkPassphrase)
  : "";

async function fetchWalletUsdc(address: string): Promise<number> {
  try {
    const res = await fetch(`${horizonUrl}/accounts/${address}`);
    if (!res.ok) return 0;
    const data = (await res.json()) as {
      balances: Array<{
        asset_code?: string;
        asset_issuer?: string;
        balance: string;
      }>;
    };
    const b = data.balances.find(
      (x) => x.asset_code === "USDC" && x.asset_issuer === USDC_ISSUER,
    );
    return b ? parseFloat(b.balance) : 0;
  } catch {
    return 0;
  }
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Wallet → vault funding. Reads the employer's linked Stellar address, shows
 * the liquid wallet USDC balance next to the amount deposited into the payroll
 * vault, and lets them deposit — signed by the Privy embedded wallet.
 */
export default function VaultFunding({
  onToast,
}: {
  onToast?: (msg: string) => void;
}) {
  const { getAccessToken } = useAuth();
  const { signXdr } = useStellarSign();

  const [stellarAddr, setStellarAddr] = useState<string | null>(null);
  const [walletUsdc, setWalletUsdc] = useState<number | null>(null);
  const [vaultUsdc, setVaultUsdc] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the linked Stellar address for this account.
  useEffect(() => {
    void (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/api/accounts/wallets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          wallets: Array<{ chain: string; address: string }>;
        };
        const s = data.wallets.find((w) => w.chain === "stellar");
        if (s) setStellarAddr(s.address);
      } catch {
        // non-fatal
      }
    })();
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    if (!stellarAddr || !USDC_SAC) return;
    const [w, v] = await Promise.all([
      fetchWalletUsdc(stellarAddr),
      getVaultData(USDC_SAC, "USDC", stellarAddr).catch(() => null),
    ]);
    setWalletUsdc(w);
    setVaultUsdc(v ? Number(v.balance) / STROOPS : 0);
  }, [stellarAddr]);

  useEffect(() => {
    // refresh() only setState after awaits — not synchronous in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function deposit() {
    setError(null);
    const amt = parseFloat(amount);
    if (!stellarAddr) return;
    if (!USDC_SAC) {
      setError("USDC is not configured for this network.");
      return;
    }
    if (!(amt > 0)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (walletUsdc !== null && amt > walletUsdc) {
      setError(`You only have ${fmt(walletUsdc)} USDC in your wallet.`);
      return;
    }
    setBusy(true);
    try {
      const stroops = BigInt(Math.round(amt * STROOPS));
      const { preparedXdr } = await buildDepositTx(
        stellarAddr,
        USDC_SAC,
        stroops,
      );
      const signed = await signXdr(preparedXdr, stellarAddr);
      await submitAndAwaitTx(signed);
      setAmount("");
      await refresh();
      onToast?.(`Deposited ${fmt(amt)} USDC into the vault`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Wallet (available)
          </p>
          <p className="mt-1 text-[20px] font-bold text-white">
            {walletUsdc === null ? "…" : fmt(walletUsdc)}{" "}
            <span className="text-[13px] font-medium text-neutral-500">
              USDC
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Vault (payroll)
          </p>
          <p className="mt-1 text-[20px] font-bold text-white">
            {vaultUsdc === null ? "…" : fmt(vaultUsdc)}{" "}
            <span className="text-[13px] font-medium text-neutral-500">
              USDC
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Amount to deposit"
            className="flex-1 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2.5 text-[14px] placeholder-neutral-600 focus:outline-none focus:border-yellow-400 transition-colors"
          />
          <button
            onClick={() => void deposit()}
            disabled={busy || !stellarAddr}
            className="rounded-lg bg-yellow-400 px-5 py-2.5 text-[14px] font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Depositing…" : "Deposit"}
          </button>
        </div>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <p className="text-[12px] text-neutral-600">
          Moves USDC from your wallet into the payroll vault. Streams pay out
          from the vault balance.
        </p>
      </div>
    </div>
  );
}
