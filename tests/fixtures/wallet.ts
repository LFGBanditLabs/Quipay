/**
 * Mock Wallet Fixture for Playwright Tests
 * Simulates Stellar wallet connection and transaction signing
 */

import { Page } from "@playwright/test";

export interface MockWalletOptions {
  publicKey?: string;
  isConnected?: boolean;
  shouldFailTransaction?: boolean;
}

export class MockWallet {
  private page: Page;
  private publicKey: string;
  private isConnected: boolean;
  private shouldFailTransaction: boolean;

  constructor(page: Page, options: MockWalletOptions = {}) {
    this.page = page;
    this.publicKey =
      options.publicKey || "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    this.isConnected = options.isConnected ?? true;
    this.shouldFailTransaction = options.shouldFailTransaction ?? false;
  }

  /**
   * Mock wallet connection in the browser context
   */
  async setup(): Promise<void> {
    await this.page.addInitScript(
      ({ publicKey, isConnected, shouldFailTransaction }) => {
        // Mock the wallet provider
        (window as any).mockWallet = {
          publicKey,
          isConnected,
          shouldFailTransaction,

          connect: async () => {
            if (!isConnected) {
              throw new Error("User rejected connection");
            }
            return { publicKey };
          },

          disconnect: async () => {
            (window as any).mockWallet.isConnected = false;
          },

          signTransaction: async (xdr: string) => {
            if (shouldFailTransaction) {
              throw new Error("User rejected transaction");
            }
            return xdr; // Return the same XDR (mocked)
          },

          signAuthEntry: async () => {
            return "mocked-auth-entry";
          },
        };

        // Mock the wallet kit
        (window as any).StellarWalletsKit = class {
          async openModal() {
            return (window as any).mockWallet.connect();
          }

          async disconnect() {
            return (window as any).mockWallet.disconnect();
          }

          async sign(xdr: string) {
            return (window as any).mockWallet.signTransaction(xdr);
          }
        };
      },
      {
        publicKey: this.publicKey,
        isConnected: this.isConnected,
        shouldFailTransaction: this.shouldFailTransaction,
      },
    );
  }

  /**
   * Simulate wallet connection
   */
  async connect(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).mockWallet.isConnected = true;
    });
  }

  /**
   * Simulate wallet disconnection
   */
  async disconnect(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).mockWallet.isConnected = false;
    });
  }

  /**
   * Get the mock public key
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}
