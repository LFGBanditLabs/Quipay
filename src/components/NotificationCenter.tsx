import React from "react";

export interface ProtocolAlert {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const levelTone: Record<ProtocolAlert["level"], string> = {
  critical: "border-red-500/50 bg-red-500/10 text-red-600",
  warning: "border-amber-500/50 bg-amber-500/10 text-amber-600",
  info: "border-indigo-500/40 bg-indigo-500/10 text-indigo-500",
};

const NotificationCenter: React.FC<{ alerts: ProtocolAlert[] }> = ({
  alerts,
}) => {
  if (alerts.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-border bg-(--surface) p-4">
      <h3 className="mb-3 text-sm font-semibold">Notification Center</h3>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <article
            key={alert.id}
            className={`rounded-lg border p-3 ${levelTone[alert.level]}`}
          >
            <p className="text-sm font-semibold">{alert.title}</p>
            <p className="text-xs opacity-90">{alert.message}</p>
            {alert.actionLabel && alert.onAction && (
              <button
                className="mt-2 rounded-md border border-current px-2 py-1 text-xs"
                onClick={alert.onAction}
              >
                {alert.actionLabel}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export default NotificationCenter;
