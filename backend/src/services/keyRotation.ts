import { VaultClient } from "./vaultClient";

export interface RotationConfig {
  rotationPeriodDays: number;
  gracePeriodDays: number;
}

export interface RotationMetadata {
  keyName: string;
  lastRotated: string;
  rotationVersion: number;
  nextRotationDue: string;
}

export class KeyRotationService {
  private client: VaultClient;
  private secretPath: string;
  private mountPoint: string;
  private rotationConfig: RotationConfig;

  constructor(
    client: VaultClient,
    secretPath: string,
    mountPoint: string,
    config?: Partial<RotationConfig>,
  ) {
    this.client = client;
    this.secretPath = secretPath;
    this.mountPoint = mountPoint;
    this.rotationConfig = {
      rotationPeriodDays: config?.rotationPeriodDays || 30,
      gracePeriodDays: config?.gracePeriodDays || 7,
    };
  }

  async rotateKey(keyName: string, newKey: string): Promise<boolean> {
    try {
      const timestamp = new Date().toISOString();
      const metadataPath = `${this.secretPath}/metadata/${keyName}`;

      await this.client.writeSecret(
        `${this.secretPath}/${keyName}`,
        { value: newKey },
        this.mountPoint,
      );

      await this.client.writeSecret(
        metadataPath,
        {
          last_rotated: timestamp,
          rotation_version:
            ((await this.getRotationStatus(keyName))?.version || 0) + 1,
          next_rotation_due: this.calculateNextRotationDate(timestamp),
        },
        this.mountPoint,
      );

      console.log(`[KeyRotation] Successfully rotated key: ${keyName}`);
      return true;
    } catch (error) {
      console.error(`[KeyRotation] Failed to rotate key ${keyName}:`, error);
      return false;
    }
  }

  async getRotationStatus(
    keyName: string,
  ): Promise<{ lastRotated: string | null; version: number } | null> {
    try {
      const metadataPath = `${this.secretPath}/metadata/${keyName}`;
      const metadata = await this.client.readSecret(
        metadataPath,
        this.mountPoint,
      );

      if (!metadata?.data?.data) {
        return { lastRotated: null, version: 0 };
      }

      return {
        lastRotated: metadata.data.data.last_rotated || null,
        version: metadata.data.data.rotation_version || 0,
      };
    } catch {
      return { lastRotated: null, version: 0 };
    }
  }

  async needsRotation(keyName: string): Promise<boolean> {
    try {
      const status = await this.getRotationStatus(keyName);

      if (!status || !status.lastRotated) {
        return true;
      }

      const lastRotatedDate = new Date(status.lastRotated);
      const nextRotationDate = new Date(lastRotatedDate);
      nextRotationDate.setDate(
        nextRotationDate.getDate() + this.rotationConfig.rotationPeriodDays,
      );

      return new Date() >= nextRotationDate;
    } catch {
      return true;
    }
  }

  async getAllKeysNeedingRotation(): Promise<string[]> {
    try {
      const secrets = await this.client.listSecrets(
        this.secretPath,
        this.mountPoint,
      );
      const keysNeedingRotation: string[] = [];

      for (const secret of secrets) {
        if (await this.needsRotation(secret)) {
          keysNeedingRotation.push(secret);
        }
      }

      return keysNeedingRotation;
    } catch {
      return [];
    }
  }

  private calculateNextRotationDate(fromDate: string): string {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + this.rotationConfig.rotationPeriodDays);
    return date.toISOString();
  }

  setRotationPeriod(days: number): void {
    this.rotationConfig.rotationPeriodDays = days;
  }

  setGracePeriod(days: number): void {
    this.rotationConfig.gracePeriodDays = days;
  }

  getRotationConfig(): RotationConfig {
    return { ...this.rotationConfig };
  }
}
