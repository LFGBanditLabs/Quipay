import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Wizard, { WizardStep } from "../components/Wizard";
import { useNotification } from "../hooks/useNotification";
import { SeoHelmet } from "../components/seo/SeoHelmet";

const STORAGE_KEY = "quipay_stream_draft_v2";

// ─── Field component ──────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, required, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="flex items-center gap-1 text-[15px] font-semibold text-white">
      {label}
      {required && <span style={{ color: "#facc15" }}>*</span>}
    </label>
    {children}
    {hint && <p className="text-[11px] text-neutral-600">{hint}</p>}
  </div>
);

const inputCls = `w-full rounded-xl border border-white/[0.1] bg-black px-4 py-3 text-[14px] text-white placeholder:text-neutral-700
  focus:border-yellow-400/40 focus:outline-none focus:ring-1 focus:ring-yellow-400/20 transition-colors`;

const selectCls = `w-full rounded-xl border border-white/[0.1] bg-black px-4 py-3 text-[14px] text-white
  focus:border-yellow-400/40 focus:outline-none focus:ring-1 focus:ring-yellow-400/20 transition-colors`;

// ─── Steps ────────────────────────────────────────────────────────────────────

interface FormData {
  workerAddress: string;
  workerName: string;
  token: string;
  amount: string;
  frequency: string;
  startDate: string;
  endDate: string;
  enableCliff: boolean;
  cliffDate: string;
  notes: string;
}

const TOKENS = ["USDC", "XLM", "EURC", "AQUA"];
const FREQUENCIES = [
  { value: "per_second", label: "Per second (streaming)" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

// Step 1 — Worker details
function StepWorker({
  data,
  onChange,
}: {
  data: FormData;
  onChange: (d: Partial<FormData>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Worker Name"
        required
        hint="Display name shown in your payroll dashboard"
      >
        <input
          className={inputCls}
          placeholder="e.g. Alice Chen"
          value={data.workerName}
          onChange={(e) => onChange({ workerName: e.target.value })}
        />
      </Field>

      <Field
        label="Stellar Wallet Address"
        required
        hint="The G... address that will receive the stream"
      >
        <input
          className={`${inputCls} font-mono`}
          placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
          value={data.workerAddress}
          onChange={(e) => onChange({ workerAddress: e.target.value })}
        />
      </Field>

      <Field
        label="Notes"
        hint="Optional — role, department, or contract reference"
      >
        <textarea
          className={`${inputCls} resize-none`}
          rows={3}
          placeholder="e.g. Senior Engineer · Engineering team"
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}

// Step 2 — Stream config
function StepStream({
  data,
  onChange,
}: {
  data: FormData;
  onChange: (d: Partial<FormData>) => void;
}) {
  const ratePerSecond =
    data.frequency === "per_second"
      ? parseFloat(data.amount) || 0
      : data.frequency === "hourly"
        ? (parseFloat(data.amount) || 0) / 3600
        : data.frequency === "daily"
          ? (parseFloat(data.amount) || 0) / 86400
          : data.frequency === "weekly"
            ? (parseFloat(data.amount) || 0) / (86400 * 7)
            : data.frequency === "monthly"
              ? (parseFloat(data.amount) || 0) / (86400 * 30)
              : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Token" required>
          <select
            className={selectCls}
            value={data.token}
            onChange={(e) => onChange({ token: e.target.value })}
          >
            {TOKENS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Frequency" required>
          <select
            className={selectCls}
            value={data.frequency}
            onChange={(e) => onChange({ frequency: e.target.value })}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label={`Amount (${data.token})`}
        required
        hint={
          data.amount && ratePerSecond > 0
            ? `≈ ${ratePerSecond.toFixed(7)} ${data.token}/sec`
            : "Enter the payment amount"
        }
      >
        <input
          type="number"
          min="0"
          step="0.01"
          className={`${inputCls} font-mono`}
          placeholder="0.00"
          value={data.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date" required>
          <input
            type="date"
            className={inputCls}
            value={data.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </Field>
        <Field label="End Date" hint="Leave blank for open-ended">
          <input
            type="date"
            className={inputCls}
            value={data.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </Field>
      </div>

      {/* Cliff option */}
      <div className="rounded-xl border border-white/[0.07] bg-black p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <div
            onClick={() => onChange({ enableCliff: !data.enableCliff })}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
              data.enableCliff
                ? "border-yellow-400 bg-yellow-400"
                : "border-white/[0.2] bg-transparent"
            }`}
          >
            {data.enableCliff && (
              <svg
                className="h-3 w-3 text-black"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline
                  points="20 6 9 17 4 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <div>
            <p className="text-[15px] font-semibold text-white">
              Enable cliff period
            </p>
            <p className="text-[11px] text-neutral-600">
              Tokens accumulate but can't be claimed until the cliff date
            </p>
          </div>
        </label>
        {data.enableCliff && (
          <div className="mt-4">
            <Field label="Cliff Date" required>
              <input
                type="date"
                className={inputCls}
                value={data.cliffDate}
                onChange={(e) => onChange({ cliffDate: e.target.value })}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

// Step 3 — Review
function StepReview({ data }: { data: FormData }) {
  const ratePerSecond =
    data.frequency === "per_second"
      ? parseFloat(data.amount) || 0
      : data.frequency === "hourly"
        ? (parseFloat(data.amount) || 0) / 3600
        : data.frequency === "daily"
          ? (parseFloat(data.amount) || 0) / 86400
          : data.frequency === "weekly"
            ? (parseFloat(data.amount) || 0) / (86400 * 7)
            : (parseFloat(data.amount) || 0) / (86400 * 30);

  const rows = [
    { label: "Worker", value: data.workerName || "—" },
    {
      label: "Wallet",
      value: data.workerAddress
        ? `${data.workerAddress.slice(0, 8)}...${data.workerAddress.slice(-6)}`
        : "—",
      mono: true,
    },
    { label: "Token", value: data.token },
    {
      label: "Amount",
      value: `${data.amount || "0"} ${data.token}`,
      mono: true,
    },
    {
      label: "Frequency",
      value:
        FREQUENCIES.find((f) => f.value === data.frequency)?.label ??
        data.frequency,
    },
    {
      label: "Rate / second",
      value: `${ratePerSecond.toFixed(7)} ${data.token}/sec`,
      mono: true,
      accent: true,
    },
    { label: "Start date", value: data.startDate || "Immediately" },
    { label: "End date", value: data.endDate || "Open-ended" },
    {
      label: "Cliff",
      value: data.enableCliff ? data.cliffDate || "—" : "None",
    },
    ...(data.notes ? [{ label: "Notes", value: data.notes }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-neutral-500">
        Review the details below before creating the stream. Once submitted, it
        will be executed on-chain via Soroban.
      </p>

      <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.07] bg-black overflow-hidden">
        {rows.map(({ label, value, mono, accent }) => (
          <div
            key={label}
            className="flex items-center justify-between px-4 py-3"
          >
            <p className="text-[12px] text-neutral-600">{label}</p>
            <p
              className={`text-[13px] font-semibold text-right max-w-xs truncate ${mono ? "font-mono" : ""}`}
              style={accent ? { color: "#facc15" } : { color: "#fff" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-yellow-400/15 bg-yellow-400/[0.05] p-4">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-[12px] leading-relaxed text-neutral-500">
          This will initiate a Soroban transaction requiring your wallet
          signature. Ensure your treasury has sufficient balance to cover the
          stream duration.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CreateStream: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addNotification, addStreamNotification } = useNotification();

  const [showRestoreBanner, setShowRestoreBanner] = useState(() =>
    typeof window !== "undefined"
      ? !!sessionStorage.getItem(STORAGE_KEY)
      : false,
  );
  const [hasRestored, setHasRestored] = useState(false);

  const [data, setData] = useState<FormData>({
    workerAddress: "",
    workerName: "",
    token: "USDC",
    amount: "",
    frequency: "monthly",
    startDate: "",
    endDate: "",
    enableCliff: false,
    cliffDate: "",
    notes: "",
  });

  const update = (patch: Partial<FormData>) =>
    setData((d) => ({ ...d, ...patch }));

  const step1Valid =
    data.workerName.trim().length > 0 &&
    data.workerAddress.startsWith("G") &&
    data.workerAddress.length >= 56;
  const step2Valid = parseFloat(data.amount) > 0 && data.startDate.length > 0;

  // Persist draft
  useEffect(() => {
    if (!hasRestored) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hasRestored]);

  const restoreDraft = () => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setData(JSON.parse(saved));
      setHasRestored(true);
      setShowRestoreBanner(false);
      addNotification("Draft restored", "success");
    }
  };

  const handleComplete = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    addNotification("Payment stream created successfully!", "success");
    addStreamNotification("stream_created", {
      message: `Created stream for ${data.workerName || "worker"}.`,
    });
    void navigate("/dashboard");
  };

  const steps: WizardStep[] = [
    {
      title: "Worker Details",
      component: <StepWorker data={data} onChange={update} />,
      isValid: step1Valid,
    },
    {
      title: "Stream Configuration",
      component: <StepStream data={data} onChange={update} />,
      isValid: step2Valid,
    },
    {
      title: "Review & Confirm",
      component: <StepReview data={data} />,
    },
  ];

  return (
    <>
      <SeoHelmet
        title="Create Stream · Quipay"
        description="Set up a new payroll stream for a team member on Stellar."
        path="/create-stream"
        robots="noindex,nofollow"
      />

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[22px] font-bold text-white tracking-tight">
            {t("dashboard.create_new_stream")}
          </h1>
          <p className="mt-1 text-[13px] text-neutral-500">
            Stream continuous payments to a worker's Stellar wallet in real
            time.
          </p>
        </div>

        {/* Draft restore banner */}
        {showRestoreBanner && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.05] px-5 py-4">
            <div className="flex items-center gap-3">
              <svg
                className="h-4 w-4 shrink-0 text-yellow-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p className="text-[15px] font-medium text-white">
                You have an unsaved draft from a previous session.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={restoreDraft}
                className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-black transition-colors hover:opacity-90"
                style={{ backgroundColor: "#facc15" }}
              >
                Restore
              </button>
              <button
                onClick={() => {
                  sessionStorage.removeItem(STORAGE_KEY);
                  setShowRestoreBanner(false);
                }}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <Wizard
          steps={steps}
          onComplete={handleComplete}
          onCancel={() => void navigate("/dashboard")}
        />
      </div>
    </>
  );
};

export default CreateStream;
