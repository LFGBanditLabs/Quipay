import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface OnboardResult {
  employer: {
    employer_id: string;
    business_name: string;
    verification_status: "pending" | "verified" | "rejected";
    stellar_address: string;
  };
  status: string;
  chain: {
    stellarAddress: string;
    existingStreams: number;
    vaultBalance: number;
  };
}

const COUNTRIES = [
  { code: "NG", label: "Nigeria" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "GH", label: "Ghana" },
  { code: "KE", label: "Kenya" },
  { code: "ZA", label: "South Africa" },
  { code: "IN", label: "India" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
];

export default function EmployerOnboarding() {
  const { address } = useWallet();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    businessName: "",
    registrationNumber: "",
    countryCode: "",
    contactName: "",
    contactEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardResult | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) {
      setError("Connect your wallet first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/employers/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": address,
          "x-user-role": "user",
        },
        credentials: "include",
        body: JSON.stringify({ ...form, stellarAddress: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Onboarding failed.");
      setResult(data as OnboardResult);
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : null) ?? "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-8 space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {result.status === "verified" ? "✅" : "⏳"}
            </span>
            <div>
              <h2 className="text-white font-semibold text-lg">
                {result.status === "verified" ? "Verified!" : "Pending Review"}
              </h2>
              <p className="text-neutral-400 text-sm">
                {result.employer.business_name}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-neutral-800 p-4 space-y-3">
            <p className="text-neutral-400 text-xs uppercase tracking-wide font-medium">
              On-chain summary
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Stellar address</span>
              <span className="text-white font-mono text-xs truncate max-w-[180px]">
                {result.chain.stellarAddress}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Existing streams</span>
              <span className="text-white">{result.chain.existingStreams}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Vault balance</span>
              <span className="text-white">
                {result.chain.vaultBalance.toFixed(2)} USDC
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              void navigate("/dashboard");
            }}
            className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-semibold text-black hover:bg-yellow-300 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-8 space-y-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Business onboarding</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Complete KYB to start creating payroll streams.
          </p>
        </div>

        {/* Wallet address pill */}
        <div className="rounded-xl bg-neutral-800 px-4 py-3 flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-neutral-400 text-xs">Connected wallet</p>
            <p className="text-white font-mono text-xs truncate">
              {address ?? "No wallet connected"}
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
              Business name *
            </label>
            <input
              name="businessName"
              value={form.businessName}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={200}
              placeholder="Acme Corp"
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 text-white px-4 py-3 text-sm placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
              Registration number *
            </label>
            <input
              name="registrationNumber"
              value={form.registrationNumber}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={100}
              placeholder="RC-1234567"
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 text-white px-4 py-3 text-sm placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
              Country *
            </label>
            <select
              name="countryCode"
              value={form.countryCode}
              onChange={handleChange}
              required
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-yellow-400 transition-colors appearance-none"
            >
              <option value="" disabled>
                Select country
              </option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
              Contact name
            </label>
            <input
              name="contactName"
              value={form.contactName}
              onChange={handleChange}
              maxLength={120}
              placeholder="John Doe"
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 text-white px-4 py-3 text-sm placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
              Contact email
            </label>
            <input
              name="contactEmail"
              value={form.contactEmail}
              onChange={handleChange}
              type="email"
              maxLength={320}
              placeholder="john@acme.com"
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 text-white px-4 py-3 text-sm placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm rounded-xl bg-red-950/40 border border-red-800/50 px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !address}
            className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
      </div>
    </div>
  );
}
