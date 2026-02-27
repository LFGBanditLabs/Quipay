import { vaultService } from "./vaultService";
import { KeyRotationService } from "./keyRotation";
import { VaultClient } from "./vaultClient";
import dotenv from "dotenv";

dotenv.config();

export interface RotationJobConfig {
  checkIntervalMs: number;
  maxKeysPerBatch: number;
}

export class KeyRotationScheduler {
  private rotationService: KeyRotationService;
  private config: RotationJobConfig;
  private intervalId: NodeJS.Timeout | null;
  private isRunning: boolean;

  constructor(config?: Partial<RotationJobConfig>) {
    const client = new VaultClient({
      url: process.env.VAULT_ADDR || "http://localhost:8200",
      token: process.env.VAULT_TOKEN || "",
    });

    this.rotationService = new KeyRotationService(
      client,
      process.env.VAULT_SECRET_PATH || "quipay/keys",
      process.env.VAULT_MOUNT_POINT || "secret",
    );

    this.config = {
      checkIntervalMs: config?.checkIntervalMs || 24 * 60 * 60 * 1000,
      maxKeysPerBatch: config?.maxKeysPerBatch || 5,
    };

    this.intervalId = null;
    this.isRunning = false;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[KeyRotationScheduler] Scheduler already running");
      return;
    }

    console.log("[KeyRotationScheduler] Starting key rotation scheduler...");
    this.isRunning = true;

    await this.checkAndRotate();

    this.intervalId = setInterval(async () => {
      await this.checkAndRotate();
    }, this.config.checkIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[KeyRotationScheduler] Scheduler stopped");
  }

  private async checkAndRotate(): Promise<void> {
    try {
      console.log(
        "[KeyRotationScheduler] Checking for keys needing rotation...",
      );

      const keysNeedingRotation =
        await this.rotationService.getAllKeysNeedingRotation();

      if (keysNeedingRotation.length === 0) {
        console.log("[KeyRotationScheduler] No keys require rotation");
        return;
      }

      const keysToRotate = keysNeedingRotation.slice(
        0,
        this.config.maxKeysPerBatch,
      );

      for (const keyName of keysToRotate) {
        console.log(`[KeyRotationScheduler] Key ${keyName} needs rotation`);
        await this.triggerRotation(keyName);
      }
    } catch (error) {
      console.error(
        "[KeyRotationScheduler] Error during rotation check:",
        error,
      );
    }
  }

  async triggerRotation(keyName: string): Promise<boolean> {
    console.log(
      `[KeyRotationScheduler] Triggering rotation for key: ${keyName}`,
    );

    try {
      const newKey = this.generateNewKey();
      const success = await this.rotationService.rotateKey(keyName, newKey);

      if (success) {
        console.log(
          `[KeyRotationScheduler] Successfully rotated key: ${keyName}`,
        );
        await this.notifyRotation(keyName);
      } else {
        console.error(
          `[KeyRotationScheduler] Failed to rotate key: ${keyName}`,
        );
      }

      return success;
    } catch (error) {
      console.error(
        `[KeyRotationScheduler] Error rotating key ${keyName}:`,
        error,
      );
      return false;
    }
  }

  private generateNewKey(): string {
    const randomBytes = require("crypto").randomBytes(32);
    const secretKey =
      "S" +
      randomBytes
        .toString("base64")
        .replace(/[^A-Z0-9]/g, "")
        .substring(0, 55);
    return secretKey;
  }

  private async notifyRotation(keyName: string): Promise<void> {
    console.log(
      `[KeyRotationScheduler] Notifying about key rotation: ${keyName}`,
    );
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    config: RotationJobConfig;
    keysNeedingRotation: string[];
  }> {
    const keysNeedingRotation =
      await this.rotationService.getAllKeysNeedingRotation();

    return {
      isRunning: this.isRunning,
      config: { ...this.config },
      keysNeedingRotation,
    };
  }

  setCheckInterval(ms: number): void {
    this.config.checkIntervalMs = ms;
    if (this.isRunning) {
      this.stop().then(() => this.start());
    }
  }
}

export const keyRotationScheduler = new KeyRotationScheduler();
