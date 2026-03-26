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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).mockWallet = {
          publicKey,
          isConnected,
          shouldFailTransaction,

          // eslint-disable-next-line @typescript-eslint/require-await
          connect: async () => {
            if (!isConnected) {
              throw new Error("User rejected connection");
            }
            return { publicKey };
          },

          // eslint-disable-next-line @typescript-eslint/require-await
          disconnect: async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).mockWallet.isConnected = false;
          },

          // eslint-disable-next-line @typescript-eslint/require-await
          signTransaction: async (xdr: string) => {
            if (shouldFailTransaction) {
              throw new Error("User rejected transaction");
            }
            return xdr; // Return the same XDR (mocked)
          },

          // eslint-disable-next-line @typescript-eslint/require-await
          signAuthEntry: async () => {
            return "mocked-auth-entry";
          },
        };

        // Mock the wallet kit
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).StellarWalletsKit = class {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/require-await
          async openModal(): Promise<any> {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (window as any).mockWallet.connect();
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/require-await
          async disconnect(): Promise<any> {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (window as any).mockWallet.disconnect();
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/require-await
          async sign(xdr: string): Promise<any> {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).mockWallet.isConnected = true;
    });
  }

  /**
   * Simulate wallet disconnection
   */
  async disconnect(): Promise<void> {
    await this.page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
