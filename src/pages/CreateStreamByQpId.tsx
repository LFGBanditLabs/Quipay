import { useEffect, useState } from "react";
import {
  Asset,
  Address,
  Contract,
  nativeToScVal,
  rpc as SorobanRpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { useAuth } from "../hooks/useAuth";
import { useStellarAccount } from "../hooks/useStellarAccount";
import { useStellarSign } from "../hooks/useStellarSign";
import { submitAndAwaitTx } from "../contracts/payroll_stream";
import { networkPassphrase, rpcUrl } from "../contracts/util";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const USDC_ISSUER = import.meta.env.PUBLIC_USDC_ISSUER ?? "";
const STREAM_CONTRACT = import.meta.env.VITE_PAYROLL_STREAM_CONTRACT_ID ?? "";
const STROOPS = 1e7; // USDC uses 7 decimals on Stellar
const USDC_SAC = USDC_ISSUER
  ? new Asset("USDC", USDC_ISSUER).contractId(networkPassphrase)
  : "";

/**
 * Builds a create_stream tx matching the DEPLOYED contract's 9-arg signature
 * (employer, worker, token, rate, cliff_ts, start_ts, end_ts, metadata?,
 * speed_curve?). The shared buildCreateStreamTx helper is stale — it sends an
 * `amount` where the contract expects `cliff_ts` and omits speed_curve.
 */
async function buildCreateStream(args: {
  employer: string;
  worker: string;
  token: string;
  rate: bigint;
  startTs: number;
  endTs: number;
}): Promise<string> {
  const server = new SorobanRpc.Server(rpcUrl, { allowHttp: true });
  const account = await server.getAccount(args.employer);
  const c = new Contract(STREAM_CONTRACT);
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      c.call(
        "create_stream",
        new Address(args.employer).toScVal(),
        new Address(args.worker).toScVal(),
        new Address(args.token).toScVal(),
        nativeToScVal(args.rate, { type: "i128" }),
        nativeToScVal(BigInt(args.startTs), { type: "u64" }), // cliff_ts = start (no cliff)
        nativeToScVal(BigInt(args.startTs), { type: "u64" }),
        nativeToScVal(BigInt(args.endTs), { type: "u64" }),
        xdr.ScVal.scvVoid(), // metadata_hash: None
        xdr.ScVal.scvVoid(), // speed_curve: None
      ),
    )
    .setTimeout(300)
    .build();
  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

interface Resolved {
  quipayId: string;
  email: string | null;
  walletStellar: string | null;
}

interface RosterWorker {
  worker_address: string;
  quipay_id: string | null;
  email: string | null;
  full_name: string;
  job_title: string;
}

export default function CreateStreamByQpId() {
  const { getAccessToken } = useAuth();
  const { address: employer } = useStellarAccount();
  const { signXdr } = useStellarSign();

  const [roster, setRoster] = useState<RosterWorker[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [qpId, setQpId] = useState("");
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [looking, setLooking] = useState(false);
  const [amount, setAmount] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Load the employer's existing roster so they can pick a worker they've
  // already added instead of re-typing a QP ID.
  useEffect(() => {
    void (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/api/employers/employees`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { employees?: RosterWorker[] };
        setRoster(data.employees ?? []);
      } catch {
        // non-fatal
      }
    })();
  }, [getAccessToken]);

  function pickWorker(w: RosterWorker) {
    setError(null);
    setResolved({
      quipayId: w.quipay_id ?? w.full_name,
      email: w.email,
      walletStellar: w.worker_address,
    });
  }

  async function lookup() {
    setError(null);
    setResolved(null);
    const id = qpId.trim().toUpperCase();
    if (!/^QP\d+$/.test(id)) {
      setError("Enter a valid QP ID (e.g. QP100000042).");
      return;
    }
    setLooking(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/accounts/lookup/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed.");
      if (!data.walletStellar) {
        throw new Error(
          "That employee has no Stellar wallet yet — they need to open the app once.",
        );
      }
      setResolved(data as Resolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLooking(false);
    }
  }

  async function create() {
    setError(null);
    setOkMsg(null);
    if (!employer) {
      setError("Your wallet isn't ready yet.");
      return;
    }
    if (!resolved?.walletStellar) {
      setError("Look up an employee by QP ID first.");
      return;
    }
    if (!USDC_SAC) {
      setError("USDC is not configured for this network.");
      return;
    }
    const amt = parseFloat(amount);
    const days = parseInt(durationDays, 10);
    if (!(amt > 0)) return setError("Enter an amount greater than 0.");
    if (!(days > 0)) return setError("Enter a duration in days.");

    setBusy(true);
    try {
      const durationSecs = BigInt(days * 24 * 60 * 60);
      const amountStroops = BigInt(Math.round(amt * STROOPS));
      // Per-second rate; recompute the exact total so rate*duration == amount
      // (avoids on-chain rounding/solvency mismatches).
      const rate = amountStroops / durationSecs;
      if (rate <= 0n)
        throw new Error("Amount is too small for that duration — increase it.");
      const exactAmount = rate * durationSecs;
      const startTs = Math.floor(Date.now() / 1000) + 60; // small buffer
      const endTs = startTs + Number(durationSecs);

      const preparedXdr = await buildCreateStream({
        employer,
        worker: resolved.walletStellar,
        token: USDC_SAC,
        rate,
        startTs,
        endTs,
      });
      const signed = await signXdr(preparedXdr, employer);
      const hash = await submitAndAwaitTx(signed);
      setOkMsg(
        `Stream created for ${resolved.quipayId} — ${(Number(exactAmount) / STROOPS).toFixed(2)} USDC over ${days} days. Tx ${hash.slice(0, 8)}…`,
      );
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create stream failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10 max-w-[640px]">
      <div className="mb-8">
        <h1 className="text-[24px] font-bold text-white tracking-tight">
          Create a payroll stream
        </h1>
        <p className="mt-1 text-[14px] text-neutral-500">
          Pay an employee continuously in USDC from your vault. Pick them from
          your workers.
        </p>
      </div>

      {/* Step 1 — pick an employee */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6 mb-5">
        <label className="block text-neutral-400 text-xs mb-2.5 font-medium uppercase tracking-wide">
          Employee
        </label>

        {roster.length > 0 ? (
          <div className="flex flex-col gap-2">
            {roster.map((w) => {
              const selected = resolved?.walletStellar === w.worker_address;
              return (
                <button
                  key={w.worker_address}
                  onClick={() => pickWorker(w)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                    selected
                      ? "border-yellow-400/50 bg-yellow-400/[0.08]"
                      : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] font-bold text-white">
                      {w.quipay_id ?? w.full_name}
                    </p>
                    <p className="truncate text-[12px] text-neutral-500">
                      {w.email ? `${w.email} · ` : ""}
                      {w.job_title}
                    </p>
                  </div>
                  {selected && (
                    <span className="text-[12px] font-semibold text-yellow-400">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-neutral-500">
            No workers yet — add one from Workforce, or enter a QP ID below.
          </p>
        )}

        {/* Manual QP ID — for someone not on the roster yet */}
        <button
          onClick={() => setShowManual((v) => !v)}
          className="mt-3 text-[12px] font-semibold text-neutral-500 hover:text-white transition-colors"
        >
          {showManual ? "− Hide QP ID entry" : "+ Enter a QP ID instead"}
        </button>
        {showManual && (
          <div className="mt-2 flex gap-2">
            <input
              value={qpId}
              onChange={(e) => setQpId(e.target.value)}
              placeholder="QP100000042"
              className="flex-1 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2.5 text-[14px] font-mono placeholder-neutral-600 focus:outline-none focus:border-yellow-400 transition-colors"
            />
            <button
              onClick={() => void lookup()}
              disabled={looking || !qpId.trim()}
              className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {looking ? "Finding…" : "Find"}
            </button>
          </div>
        )}

        {resolved && (
          <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/[0.06] px-4 py-3">
            <p className="text-[13px] font-semibold text-white">
              Paying {resolved.quipayId}
              {resolved.email ? (
                <span className="text-neutral-400"> · {resolved.email}</span>
              ) : null}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-neutral-500 break-all">
              {resolved.walletStellar}
            </p>
          </div>
        )}
      </div>

      {/* Step 2 — amount + duration */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6 mb-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
              Total amount (USDC)
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="1000"
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2.5 text-[14px] placeholder-neutral-600 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
              Duration (days)
            </label>
            <input
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              inputMode="numeric"
              placeholder="30"
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2.5 text-[14px] placeholder-neutral-600 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-[13px] text-red-400 rounded-xl bg-red-950/40 border border-red-800/50 px-4 py-3">
          {error}
        </p>
      )}
      {okMsg && (
        <p className="mb-4 text-[13px] text-green-400 rounded-xl bg-green-950/40 border border-green-800/50 px-4 py-3">
          {okMsg}
        </p>
      )}

      <button
        onClick={() => void create()}
        disabled={busy || !resolved || !employer}
        className="w-full rounded-xl bg-yellow-400 py-3 text-[15px] font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? "Creating stream…" : "Create stream"}
      </button>
      <p className="mt-3 text-[12px] text-neutral-600 text-center">
        Streams pay out from your vault balance. Make sure the vault holds at
        least the total amount.
      </p>
    </div>
  );
}
