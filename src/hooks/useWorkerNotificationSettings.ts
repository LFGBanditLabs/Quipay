import { useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export interface WorkerNotificationSettings {
  emailNotifications: boolean;
  browserPush: boolean;
  streamEvents: boolean;
  withdrawalReminders: boolean;
}

const DEFAULT_SETTINGS: WorkerNotificationSettings = {
  emailNotifications: true,
  browserPush: true,
  streamEvents: true,
  withdrawalReminders: true,
};

export const useWorkerNotificationSettings = (
  workerAddress: string | undefined,
) => {
  const [settings, setSettings] =
    useState<WorkerNotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!workerAddress) {
      setSettings(DEFAULT_SETTINGS);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/worker-notifications/${encodeURIComponent(workerAddress)}`,
      );

      if (!res.ok) {
        throw new Error("Failed to load notification preferences");
      }

      const json = (await res.json()) as {
        ok: boolean;
        data?: WorkerNotificationSettings;
        error?: string;
      };

      if (!json.ok || !json.data) {
        throw new Error(json.error || "Failed to load notification preferences");
      }

      setSettings(json.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load notification preferences",
      );
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, [workerAddress]);

  const saveSettings = useCallback(async () => {
    if (!workerAddress) {
      throw new Error("Connect a worker wallet to save preferences");
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/worker-notifications/${encodeURIComponent(workerAddress)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settings),
        },
      );

      const json = (await res.json()) as {
        ok: boolean;
        data?: WorkerNotificationSettings;
        error?: string;
      };

      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || "Failed to save notification preferences");
      }

      setSettings(json.data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save notification preferences";
      setError(message);
      throw new Error(message);
    } finally {
      setIsSaving(false);
    }
  }, [settings, workerAddress]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    setSettings,
    isLoading,
    isSaving,
    error,
    saveSettings,
    refetch: fetchSettings,
  };
};
