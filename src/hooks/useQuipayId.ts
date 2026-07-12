import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * The caller's Quipay ID (e.g. "QP100000003") + email, from the backend.
 * Every account has one, minted on first login. Surfaced on Settings and the
 * dashboard so users can find and share it (employers add workers by QP ID).
 */
export function useQuipayId() {
  const { getAccessToken, authenticated } = useAuth();
  const [quipayId, setQuipayId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/api/accounts/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          quipayId: string;
          email: string | null;
        };
        if (!cancelled) {
          setQuipayId(data.quipayId);
          setEmail(data.email);
        }
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  return { quipayId, email };
}
