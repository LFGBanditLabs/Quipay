/**
 * Playwright fixtures for mocking Stellar wallet interactions
 */

import { test as base, Page } from "@playwright/test";

export interface WalletFixtures {
  mockWallet: MockWallet;
}

export interface MockWallet {
  address: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  mockSignTransaction: (shouldSucceed?: boolean) => Promise<void>;
  mockContractCall: (
    contractId: string,
    method: string,
    response: any,
  ) => Promise<void>;
}

/**
 * Creates a mock wallet fixture for testing
 */
export const test = base.extend<WalletFixtures>({
  mockWallet: async ({ page }, use) => {
    const mockAddress =
      "GBTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABC";

    const wallet: MockWallet = {
      address: mockAddress,

      async connect() {
        await page.addInitScript((address) => {
          // Mock Freighter API
          (window as any).freighter = {
            isConnected: async () => true,
            getPublicKey: async () => address,
            signTransaction: async (xdr: string) => ({
              signedTxXdr: xdr, // Return same XDR for testing
            }),
            getNetwork: async () => "TESTNET",
            getNetworkDetails: async () => ({
              network: "TESTNET",
              networkPassphrase: "Test SDF Network ; September 2015",
            }),
          };

          // Mock wallet connection state
          localStorage.setItem("wallet_connected", "true");
          localStorage.setItem("wallet_address", address);
        }, mockAddress);
      },

      async disconnect() {
        await page.evaluate(() => {
          localStorage.removeItem("wallet_connected");
          localStorage.removeItem("wallet_address");
          delete (window as any).freighter;
        });
      },

      async mockSignTransaction(shouldSucceed = true) {
        await page.evaluate((succeed) => {
          if (!(window as any).freighter) {
            (window as any).freighter = {};
          }

          (window as any).freighter.signTransaction = async (xdr: string) => {
            if (!succeed) {
              throw new Error("User rejected transaction");
            }
            return { signedTxXdr: xdr };
          };
        }, shouldSucceed);
      },

      async mockContractCall(contractId, method, response) {
        await page.evaluate(
          ({ contractId, method, response }) => {
            // Mock Soroban RPC responses
            const originalFetch = window.fetch;
            window.fetch = async (url: any, options: any) => {
              if (
                typeof url === "string" &&
                url.includes("soroban-testnet.stellar.org")
              ) {
                const body = JSON.parse(options?.body || "{}");

                // Mock simulateTransaction
                if (body.method === "simulateTransaction") {
                  return new Response(
                    JSON.stringify({
                      jsonrpc: "2.0",
                      id: body.id,
                      result: {
                        transactionData: "",
                        minResourceFee: "100",
                        cost: { cpuInsns: "0", memBytes: "0" },
                        latestLedger: 1000,
                        results: [
                          {
                            auth: [],
                            xdr: btoa(JSON.stringify(response)),
                          },
                        ],
                      },
                    }),
                  );
                }

                // Mock sendTransaction
                if (body.method === "sendTransaction") {
                  return new Response(
                    JSON.stringify({
                      jsonrpc: "2.0",
                      id: body.id,
                      result: {
                        status: "PENDING",
                        hash: "mock_tx_hash_" + Date.now(),
                      },
                    }),
                  );
                }

                // Mock getTransaction
                if (body.method === "getTransaction") {
                  return new Response(
                    JSON.stringify({
                      jsonrpc: "2.0",
                      id: body.id,
                      result: {
                        status: "SUCCESS",
                        ledger: 1000,
                        createdAt: Date.now(),
                        applicationOrder: 1,
                        feeBump: false,
                        envelopeXdr: "",
                        resultXdr: "",
                        resultMetaXdr: "",
                      },
                    }),
                  );
                }

                // Mock getLatestLedger
                if (body.method === "getLatestLedger") {
                  return new Response(
                    JSON.stringify({
                      jsonrpc: "2.0",
                      id: body.id,
                      result: {
                        id: "mock_ledger_id",
                        protocolVersion: 20,
                        sequence: 1000,
                      },
                    }),
                  );
                }
              }

              return originalFetch(url, options);
            };
          },
          { contractId, method, response },
        );
      },
    };

    await use(wallet);
  },
});

export { expect } from "@playwright/test";
