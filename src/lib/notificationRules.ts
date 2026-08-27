/**
 * notificationRules.ts
 * ────────────────────
 * Rules, thresholds, and event-to-notification mapping for Quipay real-time notifications.
 */

export type StreamEventType =
  | "stream.started"
  | "stream.paused"
  | "stream.resumed"
  | "stream.cancelled"
  | "earnings.milestone"
  | "vault.low_balance"
  | "stream.ending_soon"
  | "worker.joined"
  | "deposit.confirmed"
  | "withdrawal.completed"
  | "batch.completed"
  // Legacy / UI types
  | "tx_confirmed"
  | "tx_failed"
  | "stream_started"
  | "stream_completed"
  | "payroll_disbursed";

export interface StreamEvent {
  type: StreamEventType;
  streamId?: string;
  employerAddress?: string;
  workerAddress?: string;
  amount?: string | number;
  token?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface NotificationPayload {
  id: string;
  type: StreamEventType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_MILESTONE_THRESHOLDS = [100, 500, 1000, 5000];

export const truncateAddress = (address?: string): string => {
  if (!address) return "Employer";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
};

export const getMilestoneStorageKey = (
  workerAddress: string,
  date = new Date(),
): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `quipay.milestones.${workerAddress || "guest"}.${year}-${month}`;
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

/**
 * Checks if current cumulative earnings for this month cross any milestone thresholds
 * that have not yet been triggered in the current month.
 */
export function checkAndTriggerMilestones(
  workerAddress: string,
  currentTotalEarned: number,
  thresholds: number[] = DEFAULT_MILESTONE_THRESHOLDS,
  storage: StorageLike | null = typeof window !== "undefined"
    ? window.localStorage
    : null,
): number[] {
  if (
    !workerAddress ||
    !Number.isFinite(currentTotalEarned) ||
    currentTotalEarned <= 0
  ) {
    return [];
  }

  const storageKey = getMilestoneStorageKey(workerAddress);
  let triggered: number[] = [];

  if (storage) {
    try {
      const raw = storage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          triggered = parsed.filter(
            (v): v is number => typeof v === "number" && Number.isFinite(v),
          );
        }
      }
    } catch {
      triggered = [];
    }
  }

  const newlyTriggered: number[] = [];
  const sortedThresholds = [...thresholds].sort((a, b) => a - b);

  for (const threshold of sortedThresholds) {
    if (currentTotalEarned >= threshold && !triggered.includes(threshold)) {
      newlyTriggered.push(threshold);
      triggered.push(threshold);
    }
  }

  if (newlyTriggered.length > 0 && storage) {
    try {
      storage.setItem(storageKey, JSON.stringify(triggered));
    } catch {
      // Ignore storage write errors (e.g. quota exceeded)
    }
  }

  return newlyTriggered;
}

/**
 * Checks if the vault balance is below 2 weeks (14 days) of total monthly burn rate.
 */
export function isVaultBalanceLow(
  availableBalance: number,
  monthlyBurnRate: number,
): boolean {
  if (
    !Number.isFinite(availableBalance) ||
    !Number.isFinite(monthlyBurnRate) ||
    monthlyBurnRate <= 0
  ) {
    return false;
  }
  const twoWeeksBurnRate = (monthlyBurnRate / 30) * 14;
  return availableBalance < twoWeeksBurnRate;
}

/**
 * Checks if a stream end timestamp is within `daysThreshold` days from now.
 */
export function isStreamEndingSoon(
  endDate: string | number | Date,
  daysThreshold = 7,
): boolean {
  const endMs =
    typeof endDate === "number"
      ? endDate > 1e11
        ? endDate
        : endDate * 1000
      : new Date(endDate).getTime();

  if (!Number.isFinite(endMs)) return false;

  const now = Date.now();
  const diffDays = (endMs - now) / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= daysThreshold;
}

/**
 * Formats relative time (e.g. "just now", "2m ago", "1h ago", "yesterday", "3d ago").
 */
export function formatRelativeTime(timestamp: number | string): string {
  const timeMs =
    typeof timestamp === "number"
      ? timestamp > 1e11
        ? timestamp
        : timestamp * 1000
      : new Date(timestamp).getTime();

  if (!Number.isFinite(timeMs)) return "recently";

  const diffSec = Math.floor((Date.now() - timeMs) / 1000);
  if (diffSec < 45) return "just now";
  if (diffSec < 90) return "1m ago";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) return "1h ago";
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  if (diffMonths < 12) return `${diffMonths} months ago`;

  return `${Math.floor(diffDays / 365)}y ago`;
}

/**
 * Maps a StreamEvent into a NotificationPayload with title, message, and navigation URL.
 */
export function mapEventToNotification(
  event: StreamEvent,
  context?: { currentUserAddress?: string; isEmployer?: boolean },
): NotificationPayload {
  const isEmployer =
    context?.isEmployer ??
    (context?.currentUserAddress &&
      event.employerAddress &&
      context.currentUserAddress.toLowerCase() ===
        event.employerAddress.toLowerCase());

  const employerName = truncateAddress(event.employerAddress);
  const workerName = truncateAddress(event.workerAddress);
  const amountStr =
    event.amount !== undefined ? Number(event.amount).toLocaleString() : "";
  const tokenStr = event.token || "USDC";

  let title = "Notification";
  let message = "You have a new update";
  let actionUrl: string | undefined = undefined;

  switch (event.type) {
    case "stream.started":
    case "stream_started":
      if (isEmployer) {
        title = "Stream Started";
        message = `Started streaming ${amountStr ? `${amountStr} ${tokenStr}/month` : "payroll"} to ${workerName}`;
      } else {
        title = "Stream Started";
        message = `${employerName} started streaming ${amountStr ? `${amountStr} ${tokenStr}/month` : "funds"} to you`;
      }
      actionUrl = event.streamId ? `/stream/${event.streamId}` : "/dashboard";
      break;

    case "stream.paused":
      if (isEmployer) {
        title = "Stream Paused";
        message = `Paused payroll stream for ${workerName}`;
      } else {
        title = "Stream Paused";
        message = `${employerName} paused your stream`;
      }
      actionUrl = event.streamId ? `/stream/${event.streamId}` : "/dashboard";
      break;

    case "stream.resumed":
      if (isEmployer) {
        title = "Stream Resumed";
        message = `Resumed payroll stream for ${workerName}`;
      } else {
        title = "Stream Resumed";
        message = `${employerName} resumed your stream`;
      }
      actionUrl = event.streamId ? `/stream/${event.streamId}` : "/dashboard";
      break;

    case "stream.cancelled":
      if (isEmployer) {
        title = "Stream Cancelled";
        message = `Cancelled payroll stream for ${workerName}`;
      } else {
        title = "Stream Cancelled";
        message = `${employerName} cancelled your stream. Remaining balance withdrawn to your wallet.`;
      }
      actionUrl = event.streamId ? `/stream/${event.streamId}` : "/withdraw";
      break;

    case "earnings.milestone":
      title = "Earnings Milestone";
      message = `You've earned ${amountStr || "1,000"} ${tokenStr} this month!`;
      actionUrl = "/dashboard";
      break;

    case "vault.low_balance":
      title = "Vault Balance Low";
      message = "Vault balance is below 2 weeks of total burn rate";
      actionUrl = "/treasury";
      break;

    case "stream.ending_soon": {
      const daysLeft = (event.metadata?.daysLeft as number | undefined) ?? 7;
      title = "Stream Ending Soon";
      message = isEmployer
        ? `Stream for ${workerName} ends in ${daysLeft} days`
        : `Your payroll stream ends in ${daysLeft} days`;
      actionUrl = event.streamId ? `/stream/${event.streamId}` : "/dashboard";
      break;
    }

    case "worker.joined":
      title = "Employee Joined";
      message = `${workerName} accepted your invite and joined the workforce`;
      actionUrl = "/address-book";
      break;

    case "deposit.confirmed":
      if (isEmployer) {
        title = "Treasury Deposit Confirmed";
        message = `${amountStr ? `${amountStr} ${tokenStr}` : "Funds"} deposited into payroll vault`;
      } else {
        title = "Large Deposit Received";
        message = `${amountStr ? `${amountStr} ${tokenStr}` : "Funds"} deposited into the payroll vault by your employer`;
      }
      actionUrl = isEmployer ? "/treasury" : "/dashboard";
      break;

    case "withdrawal.completed":
      title = "Withdrawal Completed";
      message = `Withdrew ${amountStr ? `${amountStr} ${tokenStr}` : "funds"} to your Stellar wallet`;
      actionUrl = "/withdraw";
      break;

    case "batch.completed": {
      const successCount = (event.metadata?.successCount as number) ?? 0;
      const totalCount = (event.metadata?.totalCount as number) ?? successCount;
      title = "Batch Import Completed";
      message = `Bulk payroll: ${successCount}/${totalCount} streams created successfully`;
      actionUrl = "/dashboard";
      break;
    }

    case "tx_confirmed":
      title = "Transaction Confirmed";
      message =
        (event.metadata?.message as string) ||
        "The transaction was confirmed successfully.";
      actionUrl = "/dashboard";
      break;

    case "tx_failed":
      title = "Transaction Failed";
      message =
        (event.metadata?.message as string) ||
        "The transaction could not be completed.";
      actionUrl = "/dashboard";
      break;

    case "stream_completed":
      title = "Stream Completed";
      message = "A payroll stream has reached completion.";
      actionUrl = event.streamId ? `/stream/${event.streamId}` : "/dashboard";
      break;

    case "payroll_disbursed":
      title = "Payroll Disbursed";
      message = "Payroll funds were disbursed successfully.";
      actionUrl = "/treasury";
      break;

    default:
      title = "Notification";
      message = (event.metadata?.message as string) || "Stream event received";
      break;
  }

  const id = `notif-${event.type.replace(/\./g, "_")}-${event.timestamp}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    type: event.type,
    title,
    message,
    timestamp: event.timestamp || Date.now(),
    read: false,
    actionUrl,
    dedupeKey:
      (event.metadata?.dedupeKey as string | undefined) ||
      (event.streamId ? `${event.type}:${event.streamId}` : undefined),
    metadata: event.metadata,
  };
}
