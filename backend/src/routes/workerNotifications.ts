import { Router, Request, Response } from "express";
import {
  getWorkerNotificationSettings,
  upsertWorkerNotificationSettings,
} from "../db/queries";

export const workerNotificationsRouter = Router();

interface WorkerNotificationPreferenceResponse {
  worker: string;
  emailNotifications: boolean;
  browserPush: boolean;
  streamEvents: boolean;
  withdrawalReminders: boolean;
}

const DEFAULT_SETTINGS: Omit<WorkerNotificationPreferenceResponse, "worker"> = {
  emailNotifications: true,
  browserPush: true,
  streamEvents: true,
  withdrawalReminders: true,
};

const toResponse = async (
  worker: string,
): Promise<WorkerNotificationPreferenceResponse> => {
  const record = await getWorkerNotificationSettings(worker);

  return {
    worker,
    emailNotifications: record?.email_enabled ?? DEFAULT_SETTINGS.emailNotifications,
    browserPush: record?.in_app_enabled ?? DEFAULT_SETTINGS.browserPush,
    streamEvents:
      (record?.stream_ending_alerts ?? DEFAULT_SETTINGS.streamEvents) ||
      (record?.low_runway_alerts ?? DEFAULT_SETTINGS.streamEvents),
    withdrawalReminders:
      record?.cliff_unlock_alerts ?? DEFAULT_SETTINGS.withdrawalReminders,
  };
};

const validateWorker = (worker: string | undefined): worker is string =>
  Boolean(worker && worker.trim().length > 0);

workerNotificationsRouter.get(
  "/:worker",
  async (req: Request, res: Response): Promise<void> => {
    const { worker } = req.params;

    if (!validateWorker(worker)) {
      res.status(400).json({ ok: false, error: "Worker address is required" });
      return;
    }

    try {
      const data = await toResponse(worker);
      res.json({ ok: true, data });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load notification preferences";
      res.status(500).json({ ok: false, error: message });
    }
  },
);

workerNotificationsRouter.put(
  "/:worker",
  async (req: Request, res: Response): Promise<void> => {
    const { worker } = req.params;

    if (!validateWorker(worker)) {
      res.status(400).json({ ok: false, error: "Worker address is required" });
      return;
    }

    const {
      emailNotifications,
      browserPush,
      streamEvents,
      withdrawalReminders,
    } = req.body as Record<string, unknown>;

    const booleanFields = {
      emailNotifications,
      browserPush,
      streamEvents,
      withdrawalReminders,
    };

    const invalidField = Object.entries(booleanFields).find(
      ([, value]) => typeof value !== "boolean",
    );

    if (invalidField) {
      res.status(400).json({
        ok: false,
        error: `${invalidField[0]} must be a boolean`,
      });
      return;
    }

    try {
      await upsertWorkerNotificationSettings({
        worker,
        emailEnabled: emailNotifications as boolean,
        inAppEnabled: browserPush as boolean,
        cliffUnlockAlerts: withdrawalReminders as boolean,
        streamEndingAlerts: streamEvents as boolean,
        lowRunwayAlerts: streamEvents as boolean,
      });

      const data = await toResponse(worker);
      res.json({
        ok: true,
        message: "Notification preferences updated successfully",
        data,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update notification preferences";
      res.status(500).json({ ok: false, error: message });
    }
  },
);
