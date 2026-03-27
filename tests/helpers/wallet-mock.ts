import { Page } from "@playwright/test";

export const mockWallet = async (page: Page, address: string = "GB32J7Z46N43O365H7PQLO7E2Z5S6S6S6S6S6S6S6S6S6S6S6S6") => {
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
            getAddress: async () => ({ address: mockAddress }),
            getNetwork: async () => ({
                network: "TESTNET",
                networkPassphrase: "Test SDF Network ; September 2015"
            }),
            setWallet: () => { },
            signTransaction: async (tx: string) => ({ signedTx: tx }),
            disconnect: async () => { },
            openModal: async () => { },
            getIsConnected: async () => true,
        };
        (window as any).stk = mockKit;

        // Mock window.freighterApi if the app checks for it
        (window as any).freighterApi = {
            isConnected: async () => true,
            getAddress: async () => ({ address: mockAddress }),
            getNetwork: async () => "TESTNET",
            getNetworkPassphrase: async () => "Test SDF Network ; September 2015",
            signTransaction: async (tx: string) => tx,
        };
    }, address);
};
