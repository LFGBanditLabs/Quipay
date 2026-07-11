import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export const LoginButton = () => {
  const { ready, authenticated, email, login, logout, getAccessToken } =
    useAuth();
  const [quipayId, setQuipayId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!authenticated) {
        if (!cancelled) setQuipayId(null);
        return;
      }
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/api/accounts/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { quipayId: string };
        if (!cancelled) setQuipayId(data.quipayId);
      } catch {
        // Non-fatal — the user is still logged in even if this fetch fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={() => void login()}
        disabled={!ready}
        className="rounded-full border border-white/15 px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ready ? "Log in" : "Loading…"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-end leading-tight">
        <span className="text-[13px] font-bold text-white">
          {quipayId ?? "…"}
        </span>
        {email && <span className="text-[11px] text-neutral-500">{email}</span>}
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-full border border-white/15 px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-white/10"
      >
        Log out
      </button>
    </div>
  );
};
