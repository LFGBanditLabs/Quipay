import { Page } from "@playwright/test";

export const mockWallet = async (
  page: Page,
  address: string = "GB32J7Z46N43O365H7PQLO7E2Z5S6S6S6S6S6S6S6S6S6S6S6S6",
) => {
  await page.addInitScript((mockAddress) => {
    const mockStorage = {
      walletId: "freighter",
      walletAddress: mockAddress,
      walletNetwork: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
    };

    for (const [key, value] of Object.entries(mockStorage)) {
      localStorage.setItem(key, JSON.stringify(value));
    }

    // Mock kit methods if it exists on window or we create it
    const mockKit = {
      getAddress: () => Promise.resolve({ address: mockAddress }),
      getNetwork: () =>
        Promise.resolve({
          network: "TESTNET",
          networkPassphrase: "Test SDF Network ; September 2015",
        }),
      setWallet: () => {},
      signTransaction: (tx: string) => Promise.resolve({ signedTx: tx }),
      disconnect: () => Promise.resolve(),
      openModal: () => Promise.resolve(),
      getIsConnected: () => Promise.resolve(true),
    };

    // Use bracket notation to avoid unsafe member access on window
    (window as Record<string, unknown>).stk = mockKit;

    // Mock window.freighterApi if the app checks for it
    (window as Record<string, unknown>).freighterApi = {
      isConnected: () => Promise.resolve(true),
      getAddress: () => Promise.resolve({ address: mockAddress }),
      getNetwork: () => Promise.resolve("TESTNET"),
      getNetworkPassphrase: () =>
        Promise.resolve("Test SDF Network ; September 2015"),
      signTransaction: (tx: string) => Promise.resolve(tx),
    };
  }, address);
};
