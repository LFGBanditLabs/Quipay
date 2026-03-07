import { VaultClient } from "./vaultClient";
import { KeyRotationService } from "./keyRotation";
import dotenv from "dotenv";

dotenv.config();

export interface VaultConfig {
  url: string;
  token: string;
  secretPath: string;
  mountPoint: string;
}

export interface SecretResult {
  data: {
    [key: string]: string;
  };
  metadata: {
    created_time: string;
    destruction_time: string;
    expired: boolean;
    version: number;
  };
}

export class VaultService {
  private client: VaultClient;
  private rotationService: KeyRotationService;
  private secretPath: string;
  private mountPoint: string;

  constructor(config?: VaultConfig) {
    this.client = new VaultClient({
      url: config?.url || process.env.VAULT_ADDR || "http://localhost:8200",
      token: config?.token || process.env.VAULT_TOKEN || "",
    });
    this.secretPath =
      config?.secretPath || process.env.VAULT_SECRET_PATH || "quipay/keys";
    this.mountPoint =
      config?.mountPoint || process.env.VAULT_MOUNT_POINT || "secret";
    this.rotationService = new KeyRotationService(
      this.client,
      this.secretPath,
      this.mountPoint,
    );
  }

  async getSecret(key: string): Promise<string | null> {
    try {
      const secret = await this.client.readSecret(
        `${this.secretPath}/${key}`,
        this.mountPoint,
      );
      return secret?.data?.data?.value || null;
    } catch (error) {
      console.error(`[VaultService] Failed to retrieve secret ${key}:`, error);
      return null;
    }
  }

  async setSecret(key: string, value: string): Promise<boolean> {
    try {
      await this.client.writeSecret(
        `${this.secretPath}/${key}`,
        { value },
        this.mountPoint,
      );
      return true;
    } catch (error) {
      console.error(`[VaultService] Failed to set secret ${key}:`, error);
      return false;
    }
  }

  async deleteSecret(key: string): Promise<boolean> {
    try {
      await this.client.deleteSecret(
        `${this.secretPath}/${key}`,
        this.mountPoint,
      );
      return true;
    } catch (error) {
      console.error(`[VaultService] Failed to delete secret ${key}:`, error);
      return false;
    }
  }

  async listSecrets(): Promise<string[]> {
    try {
      const secrets = await this.client.listSecrets(
        this.secretPath,
        this.mountPoint,
      );
      return secrets || [];
    } catch (error) {
      console.error("[VaultService] Failed to list secrets:", error);
      return [];
    }
  }

  async rotateKey(keyName: string, newKey: string): Promise<boolean> {
    return this.rotationService.rotateKey(keyName, newKey);
  }

  async getRotationStatus(
    keyName: string,
  ): Promise<{ lastRotated: string | null; version: number } | null> {
    return this.rotationService.getRotationStatus(keyName);
  }

  async isHealthy(): Promise<boolean> {
    return this.client.healthCheck();
  }

  async getPolicy(policyName: string): Promise<string | null> {
    try {
      return await this.client.readPolicy(policyName);
    } catch (error) {
      console.error(
        `[VaultService] Failed to retrieve policy ${policyName}:`,
        error,
      );
      return null;
    }
  }

  async createPolicy(
    policyName: string,
    policyRules: string,
  ): Promise<boolean> {
    try {
      await this.client.createPolicy(policyName, policyRules);
      return true;
    } catch (error) {
      console.error(
        `[VaultService] Failed to create policy ${policyName}:`,
        error,
      );
      return false;
    }
  }
}

export const vaultService = new VaultService();
