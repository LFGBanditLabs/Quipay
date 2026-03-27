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

        if (isConnected) {
          localStorage.setItem("walletId", JSON.stringify("mock-wallet"));
          localStorage.setItem("walletAddress", JSON.stringify(publicKey));
          localStorage.setItem("walletNetwork", JSON.stringify("TESTNET"));
          localStorage.setItem(
            "networkPassphrase",
            JSON.stringify("Test SDF Network ; September 2015"),
          );
        } else {
          localStorage.removeItem("walletId");
          localStorage.removeItem("walletAddress");
          localStorage.removeItem("walletNetwork");
          localStorage.removeItem("networkPassphrase");
        }
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
    await this.page.evaluate(
      ({ publicKey }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).mockWallet.isConnected = true;
        localStorage.setItem("walletId", JSON.stringify("mock-wallet"));
        localStorage.setItem("walletAddress", JSON.stringify(publicKey));
        localStorage.setItem("walletNetwork", JSON.stringify("TESTNET"));
        localStorage.setItem(
          "networkPassphrase",
          JSON.stringify("Test SDF Network ; September 2015"),
        );
      },
      { publicKey: this.publicKey },
    );
  }

  /**
   * Simulate wallet disconnection
   */
  async disconnect(): Promise<void> {
    await this.page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).mockWallet.isConnected = false;
      localStorage.removeItem("walletId");
      localStorage.removeItem("walletAddress");
      localStorage.removeItem("walletNetwork");
      localStorage.removeItem("networkPassphrase");
    });
  }

  /**
   * Get the mock public key
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}
