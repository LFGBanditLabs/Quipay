import React, { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { SeoHelmet } from "../components/seo/SeoHelmet";

// ─── Vault contract reads ──────────────────────────────────────────────────────

import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  scValToNative,
} from "@stellar/stellar-sdk";
import { rpcUrl, networkPassphrase } from "../contracts/util";

const VAULT_ID =
  (import.meta.env.VITE_PAYROLL_VAULT_CONTRACT_ID as string) ?? "";

async function vaultRead<T>(
  method: string,
  ...args: Parameters<typeof Contract.prototype.call>[1][]
): Promise<T | null> {
  if (!VAULT_ID) return null;
  try {
    const server = new SorobanRpc.Server(rpcUrl, { allowHttp: true });
    const source = await server.getAccount(VAULT_ID).catch(() => null);
    if (!source) return null;
    const contract = new Contract(VAULT_ID);
    const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase })
      .addOperation(contract.call(method, ...args))
      .setTimeout(10)
      .build();
    const res = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(res)) return null;
    const retval = res.result?.retval;
    return retval ? (scValToNative(retval) as T) : null;
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(a: string) {
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.04] last:border-0">
      <span className="shrink-0 text-[13px] text-neutral-500">{label}</span>
      <span
        className={`text-right text-[13px] font-medium text-white ${mono ? "font-mono text-[11px] text-neutral-400 break-all" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const GovernanceOverview: React.FC = () => {
  const { address } = useWallet();

  const [admin, setAdmin] = useState<string | null>(null);
  const [signers, setSigners] = useState<string[]>([]);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!VAULT_ID) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    void (async () => {
      const [a, s, t] = await Promise.all([
        vaultRead<string>("get_admin"),
        vaultRead<string[]>("get_signers"),
        vaultRead<number>("get_threshold"),
      ]);
      setAdmin(a);
      setSigners(Array.isArray(s) ? s : []);
      setThreshold(t ?? null);
      setLoading(false);
    })();
  }, []);

  const isAdmin = address && admin && address === admin;
  const isSingleSig = threshold === 1 && signers.length <= 1;

  return (
    <>
      <SeoHelmet
        title="Governance · Quipay"
        description="Vault security and governance"
        path="/governance"
        robots="noindex,nofollow"
      />

      <div className="px-6 py-8 sm:px-8 sm:py-10 max-w-[860px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Vault Security
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Control who can manage the payroll vault and set multi-signature
            requirements.
          </p>
        </div>

        {/* What is governance */}
        <div className="mb-8 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6">
          <h2 className="mb-3 text-[15px] font-bold text-white">
            What is Vault Governance?
          </h2>
          <div className="flex flex-col gap-3 text-[13px] text-neutral-500 leading-relaxed">
            <p>
              The <strong className="text-white">PayrollVault</strong> holds the
              funds that back all payment streams. Governance controls who can
              deposit, withdraw, and manage those funds.
            </p>
            <p>
              For a single employer (you), the vault is controlled by your
              wallet — <strong className="text-white">1-of-1</strong>. For DAOs
              or companies with multiple approvers, you can add signers and
              require M-of-N signatures for large withdrawals.
            </p>
            <p>
              Adding signers protects against a single compromised key draining
              the payroll fund.
            </p>
          </div>
        </div>

        {/* Vault info */}
        <div className="mb-6 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-white">
              Vault Configuration
            </h2>
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" />
            )}
          </div>

          {!VAULT_ID ? (
            <p className="text-[13px] text-neutral-600">
              Vault contract not configured. Set{" "}
              <code className="font-mono text-yellow-400">
                VITE_PAYROLL_VAULT_CONTRACT_ID
              </code>{" "}
              in your .env file.
            </p>
          ) : loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg bg-white/[0.04]"
                />
              ))}
            </div>
          ) : (
            <div>
              <InfoRow
                label="Vault contract"
                value={shortAddr(VAULT_ID)}
                mono
              />
              <InfoRow
                label="Admin"
                value={admin ? shortAddr(admin) : "—"}
                mono
              />
              <InfoRow
                label="Signers"
                value={
                  signers.length === 0
                    ? "None added"
                    : `${signers.length} signer${signers.length > 1 ? "s" : ""}`
                }
              />
              <InfoRow
                label="Threshold"
                value={
                  threshold !== null
                    ? `${threshold}-of-${Math.max(signers.length, 1)} signatures`
                    : "—"
                }
              />
              <InfoRow
                label="Security model"
                value={
                  isSingleSig
                    ? "Single signature (admin only)"
                    : `Multi-signature (${threshold} required)`
                }
              />
            </div>
          )}
        </div>

        {/* Current role */}
        {address && !loading && (
          <div
            className={`mb-6 rounded-2xl border p-5 ${
              isAdmin
                ? "border-yellow-400/20 bg-yellow-400/[0.05]"
                : "border-white/[0.07] bg-[#0a0a0a]"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isAdmin ? "bg-yellow-400/20" : "bg-white/[0.06]"}`}
              >
                {isAdmin ? (
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5 text-neutral-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-[14px] font-bold text-white">
                  {isAdmin
                    ? "You are the vault admin"
                    : "You are not the vault admin"}
                </p>
                <p className="text-[12px] text-neutral-500 mt-0.5">
                  {isAdmin
                    ? "You can add signers, set thresholds, and manage vault security."
                    : `The admin is ${admin ? shortAddr(admin) : "unknown"}. Contact them to change vault settings.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Signers list */}
        {signers.length > 0 && (
          <div className="mb-6 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <p className="text-[14px] font-bold text-white">
                Authorized Signers
              </p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {signers.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-black"
                    style={{ backgroundColor: "#facc15" }}
                  >
                    {i + 1}
                  </div>
                  <span className="font-mono text-[12px] text-neutral-400 break-all">
                    {s}
                  </span>
                  {s === address && (
                    <span className="ml-auto shrink-0 rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                      You
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin actions */}
        {isAdmin && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6">
            <h2 className="mb-2 text-[15px] font-bold text-white">
              Admin Actions
            </h2>
            <p className="mb-5 text-[13px] text-neutral-500">
              These actions change the vault security model. Use with caution.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://lab.stellar.org/r/testnet/contract/${VAULT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white no-underline hover:bg-white/[0.08] transition-colors"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open in Stellar Lab
              </a>
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${VAULT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white no-underline hover:bg-white/[0.08] transition-colors"
              >
                View on Explorer ↗
              </a>
            </div>
            <p className="mt-4 text-[12px] text-neutral-700">
              To add signers or change the threshold, use Stellar Lab to invoke{" "}
              <code className="font-mono text-neutral-500">add_signer</code> or{" "}
              <code className="font-mono text-neutral-500">set_threshold</code>{" "}
              on the vault contract.
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default GovernanceOverview;
