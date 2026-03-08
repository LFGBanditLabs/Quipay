import { vaultService } from "./vaultService";
import { keyRotationScheduler } from "./keyRotationScheduler";
import dotenv from "dotenv";

dotenv.config();

export interface SecretsConfig {
  required: string[];
  optional: string[];
}

const DEFAULT_SECRETS_CONFIG: SecretsConfig = {
  required: ["DATABASE_URL", "OPENAI_API_KEY", "STELLAR_RPC_URL"],
  optional: [
    "DISCORD_BOT_TOKEN",
    "DISCORD_PUBLIC_KEY",
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "REDIS_URL",
    "HOT_WALLET_SECRET",
  ],
};

export class SecretsBootstrap {
  private secretsConfig: SecretsConfig;
  private fetchedSecrets: Map<string, string | null>;
  private isVaultAvailable: boolean;

  constructor(config?: Partial<SecretsConfig>) {
    this.secretsConfig = {
      required: config?.required || DEFAULT_SECRETS_CONFIG.required,
      optional: config?.optional || DEFAULT_SECRETS_CONFIG.optional,
    };
    this.fetchedSecrets = new Map();
    this.isVaultAvailable = false;
  }

  async initialize(): Promise<void> {
    console.log("[SecretsBootstrap] Starting secrets initialization...");

    await this.checkVaultHealth();

    await this.fetchAllSecrets();

    this.validateRequiredSecrets();

    if (this.isVaultAvailable) {
      this.startKeyRotationScheduler();
    } else {
      console.warn(
        "[SecretsBootstrap] Vault not available, using .env fallback. Key rotation disabled.",
      );
    }

    console.log("[SecretsBootstrap] Secrets initialization complete");
  }

  private async checkVaultHealth(): Promise<void> {
    try {
      const vaultUrl = process.env.VAULT_ADDR;
      if (!vaultUrl) {
        console.warn(
          "[SecretsBootstrap] VAULT_ADDR not configured, using .env fallback",
        );
        this.isVaultAvailable = false;
        return;
      }

      this.isVaultAvailable = await vaultService.isHealthy();

      if (this.isVaultAvailable) {
        console.log("[SecretsBootstrap] ✅ Vault is healthy and available");
      } else {
        console.warn(
          "[SecretsBootstrap] ⚠️ Vault health check failed, using .env fallback",
        );
      }
    } catch (error) {
      console.warn(
        "[SecretsBootstrap] ⚠️ Failed to connect to Vault:",
        error instanceof Error ? error.message : "Unknown error",
      );
      this.isVaultAvailable = false;
    }
  }

  private async fetchAllSecrets(): Promise<void> {
    if (!this.isVaultAvailable) {
      console.log(
        "[SecretsBootstrap] Using environment variables from .env file",
      );
      for (const secretName of this.secretsConfig.required) {
        const value = process.env[secretName] || null;
        this.fetchedSecrets.set(secretName, value);
      }
      for (const secretName of this.secretsConfig.optional) {
        const value = process.env[secretName] || null;
        this.fetchedSecrets.set(secretName, value);
      }
      return;
    }

    for (const secretName of this.secretsConfig.required) {
      await this.fetchSecret(secretName, true);
    }

    for (const secretName of this.secretsConfig.optional) {
      await this.fetchSecret(secretName, false);
    }
  }

  private async fetchSecret(
    secretName: string,
    required: boolean,
  ): Promise<void> {
    try {
      const secret = await vaultService.getSecret(secretName.toLowerCase());

      if (secret) {
        this.fetchedSecrets.set(secretName, secret);
        console.log(`[SecretsBootstrap] ✅ Fetched secret: ${secretName}`);
      } else if (required) {
        const envValue = process.env[secretName];
        if (envValue) {
          this.fetchedSecrets.set(secretName, envValue);
          console.log(
            `[SecretsBootstrap] ✅ Using .env fallback for: ${secretName}`,
          );
        } else {
          console.error(
            `[SecretsBootstrap] ❌ Required secret not found in Vault or .env: ${secretName}`,
          );
        }
      } else {
        const envValue = process.env[secretName];
        if (envValue) {
          this.fetchedSecrets.set(secretName, envValue);
          console.log(
            `[SecretsBootstrap] ✅ Using .env fallback for optional: ${secretName}`,
          );
        } else {
          console.warn(
            `[SecretsBootstrap] ⚠️ Optional secret not found: ${secretName}`,
          );
          this.fetchedSecrets.set(secretName, null);
        }
      }
    } catch (error) {
      console.error(
        `[SecretsBootstrap] Error fetching secret ${secretName}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      if (required) {
        const envValue = process.env[secretName];
        this.fetchedSecrets.set(secretName, envValue || null);
      }
    }
  }

  private validateRequiredSecrets(): void {
    const missingSecrets: string[] = [];

    for (const secretName of this.secretsConfig.required) {
      const value = this.fetchedSecrets.get(secretName);
      if (!value) {
        missingSecrets.push(secretName);
      }
    }

    if (missingSecrets.length > 0) {
      console.error(
        `[SecretsBootstrap] ❌ Missing required secrets:`,
        missingSecrets.join(", "),
      );
    }
  }

  private startKeyRotationScheduler(): void {
    const rotationEnabled = process.env.KEY_ROTATION_ENABLED === "true";

    if (rotationEnabled) {
      console.log("[SecretsBootstrap] Starting key rotation scheduler...");
      keyRotationScheduler.start().catch((error) => {
        console.error(
          "[SecretsBootstrap] Failed to start key rotation scheduler:",
          error instanceof Error ? error.message : "Unknown error",
        );
      });
    } else {
      console.log(
        "[SecretsBootstrap] Key rotation scheduler disabled (KEY_ROTATION_ENABLED not set to true)",
      );
    }
  }

  getSecret(secretName: string): string | null {
    return this.fetchedSecrets.get(secretName) || null;
  }

  getAllSecrets(): Map<string, string | null> {
    return new Map(this.fetchedSecrets);
  }

  isVaultHealthy(): boolean {
    return this.isVaultAvailable;
  }

  async refreshSecret(secretName: string): Promise<string | null> {
    if (!this.isVaultAvailable) {
      console.warn(
        "[SecretsBootstrap] Cannot refresh secret - Vault not available",
      );
      return null;
    }

    await this.fetchSecret(secretName, false);
    return this.fetchedSecrets.get(secretName) || null;
  }

  async refreshAllSecrets(): Promise<void> {
    console.log("[SecretsBootstrap] Refreshing all secrets from Vault...");
    await this.fetchAllSecrets();
    console.log("[SecretsBootstrap] Secrets refreshed");
  }
}

export const secretsBootstrap = new SecretsBootstrap();
