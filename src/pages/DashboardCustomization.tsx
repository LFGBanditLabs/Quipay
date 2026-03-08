import { useState } from "react";
import { ReactGridLayout } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import {
  useDashboardLayout,
  UserRole,
  WidgetId,
} from "../hooks/useDashboardLayout";
import WidgetCard from "../components/dashboard/WidgetCard";
import BurnRateChart from "../components/dashboard/widgets/BurnRateChart";
import ActiveStreamsList from "../components/dashboard/widgets/ActiveStreamsList";
import TreasuryStatus from "../components/dashboard/widgets/TreasuryStatus";
import AIAgentLogs from "../components/dashboard/widgets/AIAgentLogs";

const WIDGET_CONFIG: Record<
  WidgetId,
  { title: string; icon: string; component: React.ComponentType }
> = {
  "burn-rate": {
    title: "Burn Rate",
    icon: "🔥",
    component: BurnRateChart,
  },
  "active-streams": {
    title: "Active Streams",
    icon: "⚡",
    component: ActiveStreamsList,
  },
  "treasury-status": {
    title: "Treasury Status",
    icon: "🏦",
    component: TreasuryStatus,
  },
  "ai-agent-logs": {
    title: "AI Agent Logs",
    icon: "🤖",
    component: AIAgentLogs,
  },
};

const ALL_WIDGET_IDS = Object.keys(WIDGET_CONFIG) as WidgetId[];

export default function DashboardCustomization() {
  const [role, setRole] = useState<UserRole>("manager");
  const [editMode, setEditMode] = useState(false);
  const { layout, pinned, onLayoutChange, togglePin, resetLayout } =
    useDashboardLayout(role);

  const visibleWidgets = ALL_WIDGET_IDS.filter((id) => pinned.includes(id));
  const visibleLayout = layout.filter((l) =>
    visibleWidgets.includes(l.i as WidgetId),
  );

  return (
    <div className="min-h-screen bg-[#0d0d18] px-4 py-8 sm:px-8">
      {/* Page header */}
      <div className="mx-auto mb-8 max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="bg-linear-to-r from-indigo-400 to-pink-400 bg-clip-text text-2xl font-bold text-transparent">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-white/40">
              Customize your workspace layout
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Role switcher */}
            <div className="flex overflow-hidden rounded-lg border border-white/10 bg-white/5 text-sm">
              {(["manager", "auditor"] as UserRole[]).map((r) => (
                <button
                  key={r}
                  id={`role-${r}`}
                  onClick={() => setRole(r)}
                  className={`px-4 py-1.5 capitalize transition-colors ${
                    role === r
                      ? "bg-indigo-600 text-white"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Edit mode toggle */}
            <button
              id="edit-mode-toggle"
              onClick={() => setEditMode((v) => !v)}
              className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-all ${
                editMode
                  ? "border-indigo-500 bg-indigo-600/30 text-indigo-300"
                  : "border-white/10 bg-white/5 text-white/60 hover:text-white"
              }`}
            >
              {editMode ? "✓ Done Editing" : "✏️ Edit Layout"}
            </button>

            {/* Reset */}
            {editMode && (
              <button
                id="reset-layout"
                onClick={resetLayout}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/50 transition-colors hover:text-white"
              >
                ↺ Reset
              </button>
            )}
          </div>
        </div>

        {editMode && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-2.5 text-sm text-indigo-300">
            <span>✨</span>
            <span>
              Drag widgets to reorder, resize from the corner, or use the 📌
              button to pin/unpin.
            </span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl">
        <ReactGridLayout
          layout={visibleLayout}
          cols={12}
          rowHeight={60}
          width={1200}
          onLayoutChange={(newLayout: Layout[]) => onLayoutChange(newLayout)}
          isDraggable={editMode}
          isResizable={editMode}
          margin={[16, 16]}
        >
          {visibleWidgets.map((id) => {
            const config = WIDGET_CONFIG[id];
            const Component = config.component;
            return (
              <div key={id}>
                <WidgetCard
                  id={id}
                  title={config.title}
                  icon={config.icon}
                  editMode={editMode}
                  pinned={pinned.includes(id)}
                  onTogglePin={togglePin}
                >
                  <Component />
                </WidgetCard>
              </div>
            );
          })}
        </ReactGridLayout>

        {/* Hidden/unpinned widgets list */}
        {editMode && ALL_WIDGET_IDS.some((id) => !pinned.includes(id)) && (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-4">
            <p className="mb-3 text-sm font-medium text-white/40">
              Hidden Widgets
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_WIDGET_IDS.filter((id) => !pinned.includes(id)).map((id) => (
                <button
                  key={id}
                  id={`add-widget-${id}`}
                  onClick={() => togglePin(id)}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 transition-colors hover:border-indigo-500/40 hover:text-white"
                >
                  <span>{WIDGET_CONFIG[id].icon}</span>
                  <span>{WIDGET_CONFIG[id].title}</span>
                  <span className="text-indigo-400">+</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
