/**
 * Mock Wallet Fixture for Playwright Tests
 *
 * Simulates Stellar wallet connection, transaction signing,
 * balance queries, and stream data for automated E2E testing.
 */

import { Page } from "@playwright/test";

export interface MockWalletOptions {
  publicKey?: string;
  isConnected?: boolean;
  shouldFailTransaction?: boolean;
  /** XLM balance in stroops (default: 100_0000000 = 100 XLM) */
  xlmBalance?: string;
  /** USDC balance in stroops (default: 50000_0000000 = 50,000 USDC) */
  usdcBalance?: string;
  /** Simulated network latency in ms (default: 0) */
  latencyMs?: number;
}

export interface MockStreamData {
  id: number;
  employerAddress: string;
  employeeAddress: string;
  employeeName: string;
  tokenSymbol: string;
  totalAmount: number;
  claimedAmount: number;
  flowRate: string;
  startDate: string;
  endDate: string;
  totalStreamed: string;
  status: "active" | "paused" | "completed" | "cancelled";
}

/** Default test address following Stellar's 56-char G… format */
export const TEST_PUBLIC_KEY =
  "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

/** Default worker address for stream creation tests */
export const TEST_WORKER_KEY =
  "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";

/**
 * Generates deterministic mock streams for testing dashboards and withdrawals.
 */
export function createMockStreams(
  employerAddress: string,
  count = 3,
): MockStreamData[] {
  const names = [
    "Alice Chen",
    "Bob Martinez",
    "Carol Wu",
    "Dan Okafor",
    "Eva Rossi",
  ];
  const tokens = ["USDC", "XLM", "USDC", "USDC", "XLM"];

  return Array.from({ length: count }, (_, i) => ({
    id: 1001 + i,
    employerAddress,
    employeeAddress: `GEMP${String(i).padStart(52, "0")}`,
    employeeName: names[i % names.length],
    tokenSymbol: tokens[i % tokens.length],
    totalAmount: (i + 1) * 10000_0000000,
    claimedAmount: (i + 1) * 2000_0000000,
    flowRate: `0.00${i + 3}`,
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    totalStreamed: `${(i + 1) * 8000}`,
    status: i === 2 ? "paused" : "active",
  }));
}

export class MockWallet {
  private page: Page;
  private publicKey: string;
  private isConnected: boolean;
  private shouldFailTransaction: boolean;
  private xlmBalance: string;
  private usdcBalance: string;
  private latencyMs: number;

  constructor(page: Page, options: MockWalletOptions = {}) {
    this.page = page;
    this.publicKey = options.publicKey || TEST_PUBLIC_KEY;
    this.isConnected = options.isConnected ?? true;
    this.shouldFailTransaction = options.shouldFailTransaction ?? false;
    this.xlmBalance = options.xlmBalance || "100.0000000";
    this.usdcBalance = options.usdcBalance || "50000.0000000";
    this.latencyMs = options.latencyMs ?? 0;
  }

  /**
   * Inject the mock wallet into the browser context before any page scripts run.
   */
  async setup(): Promise<void> {
    await this.page.addInitScript(
      ({
        publicKey,
        isConnected,
        shouldFailTransaction,
        xlmBalance,
        usdcBalance,
        latencyMs,
      }) => {
        const delay = (ms: number) =>
          ms > 0
            ? new Promise<void>((r) => setTimeout(r, ms))
            : Promise.resolve();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__QUIPAY_TEST_MODE__ = true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).mockWallet = {
          publicKey,
          isConnected,
          shouldFailTransaction,

          connect: async () => {
            await delay(latencyMs);
            if (!isConnected) {
              throw new Error("User rejected connection");
            }
            return { publicKey };
          },

          disconnect: async () => {
            await delay(latencyMs);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).mockWallet.isConnected = false;
          },

          signTransaction: async (xdr: string) => {
            await delay(latencyMs);
            if (shouldFailTransaction) {
              throw new Error("User rejected transaction");
            }
            return xdr;
          },

          // eslint-disable-next-line @typescript-eslint/require-await
          signAuthEntry: async () => "mocked-auth-entry",

          getBalances: async () => {
            await delay(latencyMs);
            return {
              xlm: { balance: xlmBalance },
              usdc: { balance: usdcBalance },
            };
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
        xlmBalance: this.xlmBalance,
        usdcBalance: this.usdcBalance,
        latencyMs: this.latencyMs,
      },
    );
  }

  /**
   * Inject mock API responses so that pages fetching from Horizon/Soroban
   * get deterministic data without hitting the network.
   */
  async mockContractAPI(streams?: MockStreamData[]): Promise<void> {
    const mockStreams = streams || createMockStreams(this.publicKey);

    await this.page.route("**/soroban-rpc*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { status: "SUCCESS" },
        }),
      });
    });

    await this.page.route(
      "**/horizon-testnet.stellar.org/**",
      async (route) => {
        const url = route.request().url();

        if (url.includes("/accounts/")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: this.publicKey,
              account_id: this.publicKey,
              sequence: "123456789",
              balances: [
                {
                  balance: this.xlmBalance,
                  asset_type: "native",
                },
                {
                  balance: this.usdcBalance,
                  asset_type: "credit_alphanum4",
                  asset_code: "USDC",
                  asset_issuer:
                    "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
                },
              ],
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ _embedded: { records: [] } }),
          });
        }
      },
    );

    // Expose mock streams so tests can reference them
    await this.page.addInitScript((data) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__mockStreams = data;
    }, mockStreams);
  }

  /** Simulate wallet connection at runtime */
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

  /** Simulate wallet disconnection at runtime */
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

  getPublicKey(): string {
    return this.publicKey;
  }
}
