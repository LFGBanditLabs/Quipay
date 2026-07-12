import React, { useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { SeoHelmet } from "../components/seo/SeoHelmet";
import ChainWallets from "../components/ChainWallets";
import { useQuipayId } from "../hooks/useQuipayId";

// ─── Contract IDs ─────────────────────────────────────────────────────────────

const CONTRACTS = [
  {
    label: "PayrollVault",
    id: (import.meta.env.VITE_PAYROLL_VAULT_CONTRACT_ID as string) ?? "",
  },
  {
    label: "PayrollStream",
    id: (import.meta.env.VITE_PAYROLL_STREAM_CONTRACT_ID as string) ?? "",
  },
  {
    label: "WorkforceRegistry",
    id: (import.meta.env.VITE_WORKFORCE_REGISTRY_CONTRACT_ID as string) ?? "",
  },
];

const NETWORK = (import.meta.env.PUBLIC_STELLAR_NETWORK as string) ?? "LOCAL";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TabId = "profile" | "network" | "notifications";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-[14px] text-neutral-300 group-hover:text-white transition-colors">
        {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full border transition-colors ${
          checked ? "border-yellow-400/40" : "border-white/[0.1]"
        }`}
        style={{
          backgroundColor: checked ? "rgba(250,204,21,0.15)" : "transparent",
        }}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
          style={{ backgroundColor: checked ? "#facc15" : "#404040" }}
        />
      </button>
    </label>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6">
      <h3 className="mb-5 text-[15px] font-bold text-white">{title}</h3>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const Settings: React.FC = () => {
  const { quipayId, email: qpEmail } = useQuipayId();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [toast, setToast] = useState<string | null>(null);

  const [notifs, setNotifs] = useLocalStorage("quipay:settings:notifs", {
    streamCreated: true,
    streamCompleted: true,
    withdrawalReady: true,
    lowTreasury: true,
    txConfirmed: false,
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "profile", label: "Profile & Wallet" },
    { id: "network", label: "Network & Contracts" },
    { id: "notifications", label: "Notifications" },
  ];

  return (
    <>
      <SeoHelmet
        title="Settings · Quipay"
        description="App settings"
        path="/settings"
        robots="noindex,nofollow"
      />

      <div className="px-6 py-8 sm:px-8 sm:py-10 max-w-[860px]">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Settings
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Manage your Quipay account and preferences.
          </p>
        </div>

        {/* Quipay ID — always visible; employers add workers by this ID */}
        <div className="mb-8 flex items-center justify-between rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.05] px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-yellow-400/80">
              Your Quipay ID
            </p>
            <p className="mt-0.5 font-mono text-[20px] font-bold text-white">
              {quipayId ?? "…"}
            </p>
            {qpEmail && (
              <p className="text-[12px] text-neutral-500">{qpEmail}</p>
            )}
          </div>
          <button
            onClick={() => {
              if (quipayId) {
                void navigator.clipboard.writeText(quipayId);
                showToast("Quipay ID copied");
              }
            }}
            disabled={!quipayId}
            className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
          >
            Copy
          </button>
        </div>

        {/* Tab bar */}
        <div className="mb-8 flex gap-1 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-all ${
                activeTab === t.id
                  ? "text-black"
                  : "text-neutral-500 hover:text-white"
              }`}
              style={activeTab === t.id ? { backgroundColor: "#facc15" } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Profile & Wallet ── */}
        {activeTab === "profile" && (
          <div className="flex flex-col gap-5">
            <SectionCard title="Wallets">
              <ChainWallets onToast={showToast} />
            </SectionCard>
          </div>
        )}

        {/* ── Network & Contracts ── */}
        {activeTab === "network" && (
          <div className="flex flex-col gap-5">
            <SectionCard title="Chains">
              <p className="mb-4 text-[13px] text-neutral-500">
                Quipay settles USDC payroll across two chains. Stellar is live;
                Arc (EVM) support is being wired in.
              </p>
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-[13px] font-bold text-white">
                      Stellar (Soroban)
                    </span>
                    <span className="ml-auto rounded-full bg-green-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
                      Live
                    </span>
                  </div>
                  {[
                    { label: "Network", value: NETWORK },
                    {
                      label: "RPC",
                      value:
                        (import.meta.env.PUBLIC_STELLAR_RPC_URL as string) ??
                        "—",
                    },
                    {
                      label: "Horizon",
                      value:
                        (import.meta.env
                          .PUBLIC_STELLAR_HORIZON_URL as string) ?? "—",
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-4 text-[12px]"
                    >
                      <span className="shrink-0 text-neutral-600">{label}</span>
                      <span className="font-mono text-[11px] text-white break-all text-right">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-400" />
                    <span className="text-[13px] font-bold text-white">
                      Arc (EVM)
                    </span>
                    <span className="ml-auto rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                      In progress
                    </span>
                  </div>
                  <p className="text-[12px] text-neutral-500">
                    EVM-compatible USDC settlement. Link an Arc address under
                    Profile &amp; Wallet to be ready when funding goes live.
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Deployed Contracts (Stellar)">
              <div className="flex flex-col gap-3">
                {CONTRACTS.map(({ label, id }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-bold text-neutral-400">
                        {label}
                      </span>
                      <button
                        onClick={() => {
                          void navigator.clipboard.writeText(id);
                          showToast(`${label} address copied`);
                        }}
                        className="text-[11px] text-neutral-700 hover:text-yellow-400 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="font-mono text-[11px] text-neutral-600 break-all">
                      {id || "Not configured"}
                    </p>
                    {id && (
                      <a
                        href={`https://stellar.expert/explorer/testnet/contract/${id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-[10px] no-underline transition-colors"
                        style={{ color: "#facc15" }}
                      >
                        View on Stellar Expert ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── Notifications ── */}
        {activeTab === "notifications" && (
          <div className="flex flex-col gap-5">
            <SectionCard title="In-App Notifications">
              <div className="flex flex-col gap-5">
                <Toggle
                  label="Stream created"
                  checked={notifs.streamCreated}
                  onChange={(v) => {
                    setNotifs((n) => ({ ...n, streamCreated: v }));
                    showToast("Preference saved");
                  }}
                />
                <Toggle
                  label="Stream completed"
                  checked={notifs.streamCompleted}
                  onChange={(v) => {
                    setNotifs((n) => ({ ...n, streamCompleted: v }));
                    showToast("Preference saved");
                  }}
                />
                <Toggle
                  label="Funds available to withdraw"
                  checked={notifs.withdrawalReady}
                  onChange={(v) => {
                    setNotifs((n) => ({ ...n, withdrawalReady: v }));
                    showToast("Preference saved");
                  }}
                />
                <Toggle
                  label="Low treasury warning"
                  checked={notifs.lowTreasury}
                  onChange={(v) => {
                    setNotifs((n) => ({ ...n, lowTreasury: v }));
                    showToast("Preference saved");
                  }}
                />
                <Toggle
                  label="Transaction confirmed"
                  checked={notifs.txConfirmed}
                  onChange={(v) => {
                    setNotifs((n) => ({ ...n, txConfirmed: v }));
                    showToast("Preference saved");
                  }}
                />
              </div>
            </SectionCard>

            <SectionCard title="Notification History">
              <p className="text-[13px] text-neutral-500">
                Notifications are stored locally in your browser. They
                auto-clear after 7 days.
              </p>
            </SectionCard>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-green-500/20 bg-[#111] px-5 py-4 shadow-2xl">
          <svg
            className="h-4 w-4 shrink-0 text-green-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-[13px] font-semibold text-green-400">
            {toast}
          </span>
        </div>
      )}
    </>
  );
};

export default Settings;
