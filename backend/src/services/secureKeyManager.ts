import { vaultService, VaultService } from "./vaultService";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

export interface SecureKeyConfig {
  keyName: string;
  requireRotationCheck: boolean;
  maxRotationGracePeriodDays: number;
}

export class SecureKeyManager {
  private vaultService: VaultService;
  private keyConfigs: Map<string, SecureKeyConfig>;
  private cachedKeys: Map<string, { keypair: Keypair; cachedAt: number }>;
  private cacheTTL: number;

  constructor(vaultServiceInstance?: VaultService) {
    this.vaultService = vaultServiceInstance || vaultService;
    this.keyConfigs = new Map();
    this.cachedKeys = new Map();
    this.cacheTTL = 5 * 60 * 1000;
  }

  registerKey(keyName: string, config?: Partial<SecureKeyConfig>): void {
    this.keyConfigs.set(keyName, {
      keyName,
      requireRotationCheck: config?.requireRotationCheck ?? true,
      maxRotationGracePeriodDays: config?.maxRotationGracePeriodDays ?? 7,
    });
  }

  async getSigningKeypair(keyName: string): Promise<Keypair | null> {
    const cached = this.cachedKeys.get(keyName);
    if (cached && Date.now() - cached.cachedAt < this.cacheTTL) {
      return cached.keypair;
    }

    const config = this.keyConfigs.get(keyName);
    if (!config) {
      console.warn(
        `[SecureKeyManager] Key ${keyName} not registered, registering now`,
      );
      this.registerKey(keyName);
    }

    if (config?.requireRotationCheck) {
      const status = await this.vaultService.getRotationStatus(keyName);
      if (status?.lastRotated) {
        const lastRotated = new Date(status.lastRotated);
        const gracePeriodEnd = new Date(lastRotated);
        gracePeriodEnd.setDate(
          gracePeriodEnd.getDate() + (config.maxRotationGracePeriodDays || 7),
        );

        if (new Date() > gracePeriodEnd) {
          throw new Error(`Key ${keyName} has exceeded rotation grace period`);
        }
      }
    }

    const privateKey = await this.vaultService.getSecret(keyName);
    if (!privateKey) {
      console.error(
        `[SecureKeyManager] Failed to retrieve key ${keyName} from Vault`,
      );
      return null;
    }

    try {
      const keypair = Keypair.fromSecret(privateKey);
      this.cachedKeys.set(keyName, { keypair, cachedAt: Date.now() });
      return keypair;
    } catch (error) {
      console.error(
        `[SecureKeyManager] Invalid private key for ${keyName}:`,
        error,
      );
      return null;
    }
  }

  async signTransaction(
    keyName: string,
    transactionXDR: string,
    networkPassphrase: string,
  ): Promise<string> {
    const keypair = await this.getSigningKeypair(keyName);
    if (!keypair) {
      throw new Error(`Failed to get signing keypair for ${keyName}`);
    }

    const transaction = TransactionBuilder.fromXDR(
      transactionXDR,
      networkPassphrase,
    );
    transaction.sign(keypair);
    return transaction.toXDR();
  }

  clearCache(keyName?: string): void {
    if (keyName) {
      this.cachedKeys.delete(keyName);
    } else {
      this.cachedKeys.clear();
    }
  }

  setCacheTTL(ttlMs: number): void {
    this.cacheTTL = ttlMs;
  }

  async healthCheck(): Promise<boolean> {
    return this.vaultService.isHealthy();
  }
}

export const secureKeyManager = new SecureKeyManager();
