import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Pause,
  XCircle,
  Trophy,
  AlertTriangle,
  Clock,
  UserCheck,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Coins,
  FileSpreadsheet,
  Bell,
  Trash2,
} from "lucide-react";
import { formatRelativeTime } from "../lib/notificationRules";
import type { PersistedNotification } from "../providers/notificationStorage";

interface NotificationItemProps {
  notification: PersistedNotification;
  onRead: (id: string) => void;
  onRemove?: (id: string) => void;
  onClosePanel?: () => void;
}

interface TypeConfig {
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  badgeLabel: string;
}

const getTypeConfig = (type: string): TypeConfig => {
  switch (type) {
    case "stream.started":
    case "stream_started":
      return {
        icon: <Play className="h-4 w-4 fill-current" />,
        bgColor: "bg-yellow-500/10 border-yellow-500/20",
        textColor: "text-yellow-400",
        badgeLabel: "Stream Started",
      };

    case "stream.paused":
    case "stream_paused":
      return {
        icon: <Pause className="h-4 w-4 fill-current" />,
        bgColor: "bg-amber-500/10 border-amber-500/20",
        textColor: "text-amber-400",
        badgeLabel: "Stream Paused",
      };

    case "stream.resumed":
    case "stream_resumed":
      return {
        icon: <Play className="h-4 w-4" />,
        bgColor: "bg-emerald-500/10 border-emerald-500/20",
        textColor: "text-emerald-400",
        badgeLabel: "Stream Resumed",
      };

    case "stream.cancelled":
    case "stream_cancelled":
      return {
        icon: <XCircle className="h-4 w-4" />,
        bgColor: "bg-red-500/10 border-red-500/20",
        textColor: "text-red-400",
        badgeLabel: "Stream Cancelled",
      };

    case "earnings.milestone":
    case "earnings_milestone":
      return {
        icon: <Trophy className="h-4 w-4" />,
        bgColor: "bg-yellow-400/15 border-yellow-400/30",
        textColor: "text-yellow-300",
        badgeLabel: "Milestone",
      };

    case "vault.low_balance":
    case "vault_low_balance":
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        bgColor: "bg-rose-500/15 border-rose-500/30",
        textColor: "text-rose-400",
        badgeLabel: "Low Balance",
      };

    case "stream.ending_soon":
    case "stream_ending_soon":
      return {
        icon: <Clock className="h-4 w-4" />,
        bgColor: "bg-orange-500/10 border-orange-500/20",
        textColor: "text-orange-400",
        badgeLabel: "Ending Soon",
      };

    case "worker.joined":
    case "worker_joined":
      return {
        icon: <UserCheck className="h-4 w-4" />,
        bgColor: "bg-cyan-500/10 border-cyan-500/20",
        textColor: "text-cyan-400",
        badgeLabel: "Worker Joined",
      };

    case "deposit.confirmed":
    case "deposit_confirmed":
      return {
        icon: <ArrowDownLeft className="h-4 w-4" />,
        bgColor: "bg-green-500/10 border-green-500/20",
        textColor: "text-green-400",
        badgeLabel: "Deposit",
      };

    case "withdrawal.completed":
    case "withdrawal_completed":
      return {
        icon: <ArrowUpRight className="h-4 w-4" />,
        bgColor: "bg-blue-500/10 border-blue-500/20",
        textColor: "text-blue-400",
        badgeLabel: "Withdrawal",
      };

    case "batch.completed":
      return {
        icon: <FileSpreadsheet className="h-4 w-4" />,
        bgColor: "bg-purple-500/10 border-purple-500/20",
        textColor: "text-purple-400",
        badgeLabel: "Batch Payroll",
      };

    case "tx_confirmed":
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        bgColor: "bg-green-500/10 border-green-500/20",
        textColor: "text-green-400",
        badgeLabel: "Confirmed",
      };

    case "tx_failed":
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        bgColor: "bg-red-500/10 border-red-500/20",
        textColor: "text-red-400",
        badgeLabel: "Failed",
      };

    case "payroll_disbursed":
      return {
        icon: <Coins className="h-4 w-4" />,
        bgColor: "bg-yellow-500/10 border-yellow-500/20",
        textColor: "text-yellow-400",
        badgeLabel: "Payroll",
      };

    default:
      return {
        icon: <Bell className="h-4 w-4" />,
        bgColor: "bg-neutral-500/10 border-neutral-500/20",
        textColor: "text-neutral-400",
        badgeLabel: "Notification",
      };
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRead,
  onRemove,
  onClosePanel,
}) => {
  const navigate = useNavigate();
  const config = getTypeConfig(notification.type);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.read) {
      onRead(notification.id);
    }
    if (notification.actionUrl) {
      onClosePanel?.();
      void navigate(notification.actionUrl);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(notification.id);
  };

  return (
    <div
      role="listitem"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      className={`group relative flex items-start gap-3.5 px-4 py-3.5 border-b border-white/[0.06] transition-all cursor-pointer hover:bg-white/[0.04] last:border-0 ${
        !notification.read ? "bg-yellow-400/[0.02]" : "opacity-85"
      }`}
    >
      {/* Icon badge */}
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${config.bgColor} ${config.textColor}`}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${config.textColor}`}
          >
            {notification.title || config.badgeLabel}
          </span>
          <span className="text-[11px] text-neutral-500 whitespace-nowrap">
            {formatRelativeTime(notification.timestamp)}
          </span>
        </div>

        <p className="text-[13px] font-normal text-neutral-200 leading-snug break-words">
          {notification.message}
        </p>
      </div>

      {/* Unread dot indicator (blue) */}
      {!notification.read && (
        <span
          className="absolute right-3.5 top-4 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
          title="Unread"
        />
      )}

      {/* Delete / Dismiss button on hover */}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove notification"
          onClick={handleRemove}
          className="absolute right-2.5 bottom-2.5 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-lg bg-neutral-800/80 text-neutral-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export default NotificationItem;
