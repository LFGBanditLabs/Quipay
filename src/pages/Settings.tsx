import React, { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { SeoHelmet } from "../components/seo/SeoHelmet";

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
  const { address, disconnect } = useWallet();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [notifs, setNotifs] = useState({
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

  const copyAddress = () => {
    if (!address) return;
    void navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Settings
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Manage your Quipay account and preferences.
          </p>
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
            <SectionCard title="Wallet">
              {address ? (
                <div className="flex flex-col gap-4">
                  {/* Avatar + address */}
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[18px] font-black text-black"
                      style={{ backgroundColor: "#facc15" }}
                    >
                      {address.slice(1, 3).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-neutral-500 mb-0.5">
                        Connected wallet
                      </p>
                      <p className="font-mono text-[14px] text-white truncate">
                        {address}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={copyAddress}
                      className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      {copied ? "Copied!" : "Copy address"}
                    </button>
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white no-underline hover:bg-white/[0.08] transition-colors"
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
                      View on Explorer
                    </a>
                  </div>

                  <div className="border-t border-white/[0.05] pt-4">
                    <button
                      onClick={() => void disconnect()}
                      className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-2.5 text-[13px] font-semibold text-red-400 hover:bg-red-500/[0.12] transition-colors"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Disconnect wallet
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[14px] text-neutral-500">
                  No wallet connected.
                </p>
              )}
            </SectionCard>

            <SectionCard title="About Quipay">
              <div className="flex flex-col gap-3 text-[13px]">
                {[
                  { label: "Version", value: "Beta" },
                  { label: "Protocol", value: "Stellar + Soroban" },
                  { label: "Network", value: NETWORK },
                  {
                    label: "Repository",
                    value: "github.com/LFGBanditLabs/Quipay",
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-neutral-600">{label}</span>
                    <span className="font-medium text-white">{value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── Network & Contracts ── */}
        {activeTab === "network" && (
          <div className="flex flex-col gap-5">
            <SectionCard title="Network">
              <div className="flex flex-col gap-3 text-[13px]">
                {[
                  { label: "Network", value: NETWORK },
                  {
                    label: "RPC",
                    value:
                      (import.meta.env.PUBLIC_STELLAR_RPC_URL as string) ?? "—",
                  },
                  {
                    label: "Horizon",
                    value:
                      (import.meta.env.PUBLIC_STELLAR_HORIZON_URL as string) ??
                      "—",
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-4"
                  >
                    <span className="shrink-0 text-neutral-600">{label}</span>
                    <span className="font-mono text-[11px] text-white break-all text-right">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Deployed Contracts">
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
