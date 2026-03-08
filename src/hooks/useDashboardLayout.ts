import { useCallback, useState } from "react";
import { Layout } from "react-grid-layout";

export type WidgetId =
  | "burn-rate"
  | "active-streams"
  | "treasury-status"
  | "ai-agent-logs";

export type UserRole = "manager" | "auditor";

const STORAGE_KEY = "quipay-dashboard-layout";

const DEFAULT_LAYOUTS: Record<UserRole, Layout[]> = {
  manager: [
    { i: "burn-rate", x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
    { i: "active-streams", x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
    { i: "treasury-status", x: 0, y: 4, w: 6, h: 4, minW: 3, minH: 3 },
    { i: "ai-agent-logs", x: 6, y: 4, w: 6, h: 4, minW: 3, minH: 3 },
  ],
  auditor: [
    { i: "treasury-status", x: 0, y: 0, w: 8, h: 4, minW: 3, minH: 3 },
    { i: "burn-rate", x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    { i: "ai-agent-logs", x: 0, y: 4, w: 12, h: 4, minW: 3, minH: 3 },
    { i: "active-streams", x: 0, y: 8, w: 6, h: 4, minW: 3, minH: 3 },
  ],
};

const PINNED_KEY = "quipay-dashboard-pinned";

const DEFAULT_PINNED: Record<UserRole, WidgetId[]> = {
  manager: ["burn-rate", "active-streams", "treasury-status", "ai-agent-logs"],
  auditor: ["treasury-status", "burn-rate", "ai-agent-logs", "active-streams"],
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export function useDashboardLayout(role: UserRole = "manager") {
  const [layouts, setLayouts] = useState<Record<UserRole, Layout[]>>(() =>
    load(STORAGE_KEY, DEFAULT_LAYOUTS),
  );

  const [pinnedWidgets, setPinnedWidgets] = useState<
    Record<UserRole, WidgetId[]>
  >(() => load(PINNED_KEY, DEFAULT_PINNED));

  const layout = layouts[role];
  const pinned = pinnedWidgets[role];

  const onLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      setLayouts((prev) => {
        const updated = { ...prev, [role]: newLayout };
        save(STORAGE_KEY, updated);
        return updated;
      });
    },
    [role],
  );

  const togglePin = useCallback(
    (widgetId: WidgetId) => {
      setPinnedWidgets((prev) => {
        const current = prev[role];
        const updated = current.includes(widgetId)
          ? current.filter((id) => id !== widgetId)
          : [...current, widgetId];
        const next = { ...prev, [role]: updated };
        save(PINNED_KEY, next);
        return next;
      });
    },
    [role],
  );

  const resetLayout = useCallback(() => {
    setLayouts((prev) => {
      const updated = { ...prev, [role]: DEFAULT_LAYOUTS[role] };
      save(STORAGE_KEY, updated);
      return updated;
    });
    setPinnedWidgets((prev) => {
      const updated = { ...prev, [role]: DEFAULT_PINNED[role] };
      save(PINNED_KEY, updated);
      return updated;
    });
  }, [role]);

  return { layout, pinned, onLayoutChange, togglePin, resetLayout };
}
