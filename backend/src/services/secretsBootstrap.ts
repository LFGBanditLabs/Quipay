import { vaultService } from "./vaultService";
import { keyRotationScheduler } from "./keyRotationScheduler";
import dotenv from "dotenv";
import {
  logServiceError,
  logServiceInfo,
  logServiceWarn,
} from "../audit/serviceLogger";

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
    await logServiceInfo("SecretsBootstrap", "Starting secrets initialization");

    await this.checkVaultHealth();
    await this.fetchAllSecrets();
    this.validateRequiredSecrets();

    if (this.isVaultAvailable) {
      this.startKeyRotationScheduler();
    } else {
      await logServiceWarn(
        "SecretsBootstrap",
        "Vault not available, using .env fallback. Key rotation disabled.",
      );
    }

    await logServiceInfo("SecretsBootstrap", "Secrets initialization complete");
  }

  private async checkVaultHealth(): Promise<void> {
    try {
      const vaultUrl = process.env.VAULT_ADDR;
      if (!vaultUrl) {
        await logServiceWarn(
          "SecretsBootstrap",
          "VAULT_ADDR not configured, using .env fallback",
        );
        this.isVaultAvailable = false;
        return;
      }

      this.isVaultAvailable = await vaultService.isHealthy();

      if (this.isVaultAvailable) {
        await logServiceInfo(
          "SecretsBootstrap",
          "Vault is healthy and available",
        );
      } else {
        await logServiceWarn(
          "SecretsBootstrap",
          "Vault health check failed, using .env fallback",
        );
      }
    } catch (error) {
      await logServiceWarn("SecretsBootstrap", "Failed to connect to Vault", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      this.isVaultAvailable = false;
    }
  }

  private async fetchAllSecrets(): Promise<void> {
    if (!this.isVaultAvailable) {
      await logServiceInfo(
        "SecretsBootstrap",
        "Using environment variables from .env file",
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
        await logServiceInfo("SecretsBootstrap", "Fetched secret", {
          secret_name: secretName,
          required,
        });
        return;
      }

      const envValue = process.env[secretName];
      if (envValue) {
        this.fetchedSecrets.set(secretName, envValue);
        await logServiceInfo(
          "SecretsBootstrap",
          required
            ? "Using .env fallback"
            : "Using .env fallback for optional secret",
          {
            secret_name: secretName,
            required,
          },
        );
        return;
      }

      if (required) {
        await logServiceError(
          "SecretsBootstrap",
          "Required secret not found in Vault or .env",
          new Error("Missing required secret"),
          {
            secret_name: secretName,
          },
        );
      } else {
        await logServiceWarn("SecretsBootstrap", "Optional secret not found", {
          secret_name: secretName,
        });
        this.fetchedSecrets.set(secretName, null);
      }
    } catch (error) {
      await logServiceError(
        "SecretsBootstrap",
        "Error fetching secret",
        error,
        {
          secret_name: secretName,
          required,
        },
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
      void logServiceError(
        "SecretsBootstrap",
        "Missing required secrets",
        new Error(missingSecrets.join(", ")),
        {
          missing_secrets: missingSecrets,
        },
      );
    }
  }

  private startKeyRotationScheduler(): void {
    const rotationEnabled = process.env.KEY_ROTATION_ENABLED === "true";

    if (rotationEnabled) {
      void logServiceInfo(
        "SecretsBootstrap",
        "Starting key rotation scheduler",
      );
      keyRotationScheduler.start().catch((error) => {
        void logServiceError(
          "SecretsBootstrap",
          "Failed to start key rotation scheduler",
          error,
        );
      });
      return;
    }

    void logServiceInfo(
      "SecretsBootstrap",
      "Key rotation scheduler disabled (KEY_ROTATION_ENABLED not set to true)",
    );
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
      await logServiceWarn(
        "SecretsBootstrap",
        "Cannot refresh secret - Vault not available",
        { secret_name: secretName },
      );
      return null;
    }

    await this.fetchSecret(secretName, false);
    return this.fetchedSecrets.get(secretName) || null;
  }

  async refreshAllSecrets(): Promise<void> {
    await logServiceInfo(
      "SecretsBootstrap",
      "Refreshing all secrets from Vault",
    );
    await this.fetchAllSecrets();
    await logServiceInfo("SecretsBootstrap", "Secrets refreshed");
  }
}

export const secretsBootstrap = new SecretsBootstrap();
