import { ReactNode } from "react";
import { WidgetId } from "../../hooks/useDashboardLayout";

interface Props {
  id: WidgetId;
  title: string;
  icon: string;
  editMode: boolean;
  pinned: boolean;
  onTogglePin: (id: WidgetId) => void;
  children: ReactNode;
}

export default function WidgetCard({
  id,
  title,
  icon,
  editMode,
  pinned,
  onTogglePin,
  children,
}: Props) {
  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${
        editMode
          ? "cursor-grab active:cursor-grabbing border-indigo-500/40 shadow-[0_0_0_2px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/20"
          : "border-white/10 hover:border-white/20"
      } bg-[rgba(17,17,27,0.7)] backdrop-blur-md`}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>

        {editMode && (
          <div className="flex items-center gap-1.5">
            <button
              id={`pin-${id}`}
              onClick={() => onTogglePin(id)}
              title={pinned ? "Unpin widget" : "Pin widget"}
              className={`rounded-full p-1 text-xs transition-colors ${
                pinned
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              📌
            </button>
            <span className="cursor-grab text-white/20 select-none">⠿</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>

      {/* Edit mode overlay hint */}
      {editMode && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-indigo-500/3" />
      )}
    </div>
  );
}
