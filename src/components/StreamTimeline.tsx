import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { WorkerStream, WithdrawalRecord } from "../hooks/useStreams";

interface TimelineEvent {
  id: string;
  type: "created" | "cliff" | "withdrawal" | "completed" | "cancelled";
  date: number; // timestamp ms
  title: string;
  description: string;
  txHash?: string;
  icon: string;
  color: string;
}

interface StreamTimelineProps {
  stream: WorkerStream;
  withdrawals: WithdrawalRecord[];
}

export const StreamTimeline: React.FC<StreamTimelineProps> = ({
  stream,
  withdrawals,
}) => {
  const { t } = useTranslation();

  const events = useMemo(() => {
    const list: TimelineEvent[] = [];

    // Created
    list.push({
      id: "created",
      type: "created",
      date: stream.startTime * 1000,
      title: t("timeline.created_title", "Stream Created"),
      description: t("timeline.created_desc", {
        defaultValue: `Allocated ${stream.totalAmount} ${stream.tokenSymbol}`,
      }),
      icon: "✨",
      color: "bg-indigo-500 text-white",
    });

    // Cliff
    if (stream.cliffTime > stream.startTime) {
      list.push({
        id: "cliff",
        type: "cliff",
        date: stream.cliffTime * 1000,
        title: t("timeline.cliff_title", "Cliff Date"),
        description: t("timeline.cliff_desc", {
          defaultValue: "Earnings began streaming",
        }),
        icon: "🔓",
        color: "bg-amber-500 text-white",
      });
    }

    // Withdrawals
    withdrawals.forEach((w, i) => {
      list.push({
        id: w.id || `withdrawal-${i}`,
        type: "withdrawal",
        date: new Date(w.date).getTime(),
        title: t("timeline.withdrawal_title", { defaultValue: "Withdrawal" }),
        description: `${w.amount} ${w.tokenSymbol}`,
        txHash: w.txHash,
        icon: "💸",
        color: "bg-emerald-500 text-white",
      });
    });

    // Final state (Completed or Cancelled)
    if (stream.status === 2) {
      // Completed
      const lastWth = list
        .filter((e) => e.type === "withdrawal")
        .sort((a, b) => b.date - a.date)[0];
      // eslint-disable-next-line react-hooks/purity
      const closedTime = lastWth ? lastWth.date + 1000 : Date.now();

      list.push({
        id: "completed",
        type: "completed",
        date: closedTime,
        title: t("timeline.completed_title", {
          defaultValue: "Stream Completed",
        }),
        description: t("timeline.completed_desc", {
          defaultValue: "All funds streamed",
        }),
        icon: "✅",
        color: "bg-blue-500 text-white",
      });
    } else if (stream.status === 1) {
      list.push({
        id: "cancelled",
        type: "cancelled",
        // eslint-disable-next-line react-hooks/purity
        date: Date.now(),
        title: t("timeline.cancelled_title", {
          defaultValue: "Stream Cancelled",
        }),
        description: t("timeline.cancelled_desc", {
          defaultValue: "Stream was cancelled by employer",
        }),
        icon: "❌",
        color: "bg-red-500 text-white",
      });
    }

    return list.sort((a, b) => a.date - b.date);
  }, [stream, withdrawals, t]);

  return (
    <div className="mt-6 pt-6 border-t border-[var(--border)]">
      <h4 className="text-[15px] font-semibold mb-6 flex items-center gap-2 text-[var(--text)]">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--muted)]"
        >
          <path d="M12 2v20" />
          <path d="m9 15 3 3 3-3" />
          <path d="m9 9 3-3 3 3" />
        </svg>
        Stream History
      </h4>
      <div className="relative pl-4 space-y-6">
        {/* Connecting line */}
        <div className="absolute left-[31px] top-6 bottom-4 w-px bg-[var(--border)]"></div>

        {events.map((ev) => (
          <div key={ev.id} className="relative flex gap-4">
            <div
              className={`z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ring-4 ring-[var(--surface-subtle)] shadow ${ev.color}`}
            >
              <span className="text-[12px] leading-none">{ev.icon}</span>
            </div>
            <div className="flex flex-col pt-1">
              <span className="text-xs text-[var(--muted)] font-mono mb-1">
                {new Date(ev.date).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-sm font-semibold text-[var(--text)]">
                {ev.title}
              </span>
              <span className="text-sm text-[var(--muted)] mt-0.5">
                {ev.description}
              </span>
              {ev.txHash && (
                <a
                  href={`#${ev.txHash}`}
                  className="text-xs font-mono text-emerald-500/80 hover:text-emerald-500 hover:underline mt-1 break-all"
                  target="_blank"
                  rel="noreferrer"
                >
                  {ev.txHash.slice(0, 8)}...{ev.txHash.slice(-8)}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
