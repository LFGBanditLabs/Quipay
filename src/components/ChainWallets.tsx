import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useFundStellarWallet } from "../hooks/useFundStellarWallet";
import { horizonUrl } from "../contracts/util";

const USDC_ISSUER = import.meta.env.PUBLIC_USDC_ISSUER ?? "";

/** Live Stellar balances (USDC + XLM) for a linked address, read from Horizon. */
async function fetchStellarBalance(
  address: string,
): Promise<{ usdc: number; xlm: number } | null> {
  try {
    const res = await fetch(`${horizonUrl}/accounts/${address}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      balances: Array<{
        asset_type: string;
        asset_code?: string;
        asset_issuer?: string;
        balance: string;
      }>;
    };
    let usdc = 0;
    let xlm = 0;
    for (const b of data.balances) {
      if (b.asset_type === "native") xlm = parseFloat(b.balance);
      if (b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER)
        usdc = parseFloat(b.balance);
    }
    return { usdc, xlm };
  } catch {
    return null;
  }
}

const ARC_RPC_URL =
  import.meta.env.VITE_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const ARC_USDC_ADDRESS =
  import.meta.env.VITE_ARC_USDC_ADDRESS ??
  "0x3600000000000000000000000000000000000000";

/** Live USDC balance (6dp) for an Arc/EVM address, via eth_call balanceOf. */
async function fetchArcUsdc(address: string): Promise<number | null> {
  try {
    const data = `0x70a08231000000000000000000000000${address
      .replace(/^0x/, "")
      .toLowerCase()}`;
    const res = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: ARC_USDC_ADDRESS, data }, "latest"],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string };
    if (!json.result || json.result === "0x") return 0;
    return Number(BigInt(json.result)) / 1e6;
  } catch {
    return null;
  }
}

const IS_TESTNET =
  ((import.meta.env.PUBLIC_STELLAR_NETWORK as string) ?? "").toUpperCase() !==
  "PUBLIC";

// Circle's multi-chain testnet USDC faucet (covers Stellar + Arc/EVM). We
// can't mint USDC ourselves — the issuer is Circle's — so this copies the
// address and opens the faucet for the user to request USDC.
const CIRCLE_FAUCET_URL = "https://faucet.circle.com/";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

type Chain = "stellar" | "arc";

interface LinkedWallet {
  chain: string;
  address: string;
  isPrimary: boolean;
}

const CHAINS: {
  id: Chain;
  label: string;
  placeholder: string;
  hint: string;
}[] = [
  {
    id: "stellar",
    label: "Stellar",
    placeholder: "G…",
    hint: "Your Stellar address (starts with G).",
  },
  {
    id: "arc",
    label: "Arc",
    placeholder: "0x…",
    hint: "Your Arc / EVM address (starts with 0x).",
  },
];

/**
 * Multi-chain wallet manager. Reads and writes the account_wallets table via
 * the backend (`GET/POST /api/accounts/wallets`), so an account can hold both
 * a Stellar and an Arc address for receiving/funding USDC streams.
 */
export default function ChainWallets({
  onToast,
  readOnly = false,
  manageHref,
}: {
  onToast?: (msg: string) => void;
  /** When true, only shows linked addresses — no input to add/edit. */
  readOnly?: boolean;
  /** Optional link (e.g. "/settings") shown when a chain isn't linked yet. */
  manageHref?: string;
}) {
  const { getAccessToken } = useAuth();
  const { fund, state: fundState, error: fundError } = useFundStellarWallet();
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [stellarBal, setStellarBal] = useState<{
    usdc: number;
    xlm: number;
  } | null>(null);
  const [arcUsdc, setArcUsdc] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<Chain, string>>({
    stellar: "",
    arc: "",
  });
  const [saving, setSaving] = useState<Chain | null>(null);
  const [error, setError] = useState<Record<Chain, string | null>>({
    stellar: null,
    arc: null,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/accounts/wallets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { wallets: LinkedWallet[] };
      setWallets(data.wallets ?? []);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const linkedFor = (chain: Chain) =>
    wallets.find((w) => w.chain === chain)?.address ?? null;

  const stellarAddr = linkedFor("stellar");
  const arcAddr = linkedFor("arc");

  // Live-read the Stellar wallet balance once linked, and after funding.
  const refreshBalance = useCallback(async () => {
    if (!stellarAddr) return;
    setStellarBal(await fetchStellarBalance(stellarAddr));
  }, [stellarAddr]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance, fundState]);

  // Live-read the Arc USDC balance once linked.
  useEffect(() => {
    if (!arcAddr) return;
    void fetchArcUsdc(arcAddr).then(setArcUsdc);
  }, [arcAddr]);

  async function save(chain: Chain) {
    const address = drafts[chain].trim();
    if (!address) return;
    setSaving(chain);
    setError((e) => ({ ...e, [chain]: null }));
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/accounts/wallets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ chain, address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not link wallet.");
      setDrafts((d) => ({ ...d, [chain]: "" }));
      await load();
      onToast?.(`${chain === "stellar" ? "Stellar" : "Arc"} wallet linked`);
    } catch (err) {
      setError((e) => ({
        ...e,
        [chain]: err instanceof Error ? err.message : "Something went wrong.",
      }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && (
        <p className="text-[13px] text-neutral-500">
          Link a wallet on each chain you want to receive or fund USDC on. You
          can add one address per chain.
        </p>
      )}

      {CHAINS.map((c) => {
        const linked = linkedFor(c.id);
        return (
          <div
            key={c.id}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: linked ? "#4ade80" : "#525252" }}
                />
                <span className="text-[14px] font-bold text-white">
                  {c.label}
                </span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: linked
                    ? "rgba(74,222,128,0.1)"
                    : "rgba(255,255,255,0.05)",
                  color: linked ? "#4ade80" : "#737373",
                }}
              >
                {linked ? "Linked" : "Not linked"}
              </span>
            </div>

            {loading ? (
              <p className="text-[13px] text-neutral-600">Loading…</p>
            ) : linked ? (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[13px] text-white break-all">
                  {linked}
                </p>
                {c.id === "stellar" && stellarBal && (
                  <div className="flex items-center gap-4 text-[13px]">
                    <span className="font-semibold text-white">
                      {stellarBal.usdc.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-neutral-500">USDC</span>
                    </span>
                    <span className="text-neutral-500">
                      {stellarBal.xlm.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      XLM
                    </span>
                  </div>
                )}
                {c.id === "arc" && arcUsdc !== null && (
                  <div className="text-[13px]">
                    <span className="font-semibold text-white">
                      {arcUsdc.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-neutral-500">USDC</span>
                    </span>
                  </div>
                )}
                {IS_TESTNET && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap gap-2">
                      {c.id === "stellar" && (
                        <button
                          onClick={() =>
                            void fund(linked).then((ok) => {
                              if (ok)
                                onToast?.(
                                  "Wallet funded (testnet XLM + USDC trustline)",
                                );
                            })
                          }
                          disabled={
                            fundState === "funding" || fundState === "trustline"
                          }
                          className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {fundState === "funding"
                            ? "Funding XLM…"
                            : fundState === "trustline"
                              ? "Adding USDC trustline…"
                              : fundState === "done"
                                ? "Funded ✓ — fund again"
                                : "Fund XLM + trustline"}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          void navigator.clipboard.writeText(linked);
                          window.open(
                            CIRCLE_FAUCET_URL,
                            "_blank",
                            "noopener,noreferrer",
                          );
                          onToast?.(
                            "Address copied — paste it into the Circle faucet",
                          );
                        }}
                        className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
                      >
                        Get testnet USDC ↗
                      </button>
                    </div>
                    {c.id === "stellar" &&
                      fundState === "error" &&
                      fundError && (
                        <p className="text-[11px] text-red-400">{fundError}</p>
                      )}
                    {c.id === "arc" && (
                      <p className="text-[11px] text-neutral-600">
                        On the faucet, choose the Arc / EVM network for this
                        address.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : readOnly ? (
              <p className="text-[13px] text-neutral-600">
                Not linked yet
                {manageHref ? (
                  <>
                    {" — "}
                    <a
                      href={manageHref}
                      className="text-yellow-400 no-underline hover:underline"
                    >
                      add in Settings
                    </a>
                  </>
                ) : null}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    value={drafts[c.id]}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                    }
                    placeholder={c.placeholder}
                    className="flex-1 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2.5 text-[13px] font-mono placeholder-neutral-600 focus:outline-none focus:border-yellow-400 transition-colors"
                  />
                  <button
                    onClick={() => void save(c.id)}
                    disabled={saving === c.id || !drafts[c.id].trim()}
                    className="rounded-lg bg-yellow-400 px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving === c.id ? "Linking…" : "Link"}
                  </button>
                </div>
                {error[c.id] ? (
                  <p className="text-[12px] text-red-400">{error[c.id]}</p>
                ) : (
                  <p className="text-[12px] text-neutral-600">{c.hint}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
