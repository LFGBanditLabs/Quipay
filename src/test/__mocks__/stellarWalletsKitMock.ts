export enum WalletNetwork {
  PUBLIC = "Public Global Stellar Network ; September 2015",
  TESTNET = "Test SDF Network ; September 2015",
  FUTURENET = "Test SDF Future Network ; October 2022",
  SANDBOX = "Local Sandbox Stellar Network ; September 2022",
  STANDALONE = "Standalone Network ; February 2017",
}

export enum ModuleType {
  HW_WALLET = "HW_WALLET",
  HOT_WALLET = "HOT_WALLET",
  BRIDGE_WALLET = "BRIDGE_WALLET",
  AIR_GAPED_WALLET = "AIR_GAPED_WALLET",
}

export class StellarWalletsKit {
  constructor() {}
  setNetwork = () => {};
  getNetwork = async () => ({
    network: "TESTNET",
    networkPassphrase: WalletNetwork.TESTNET,
  });
  getAddress = async () => ({
    address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  });
  openModal = () => {};
  disconnect = async () => {};
}
