/**
 * evmAddresses.ts
 * ────────────────
 * EVM chain configuration for cross-chain USDC withdrawals via CCTP.
 *
 * Contains USDC contract addresses, CCTP message transmitter addresses,
 * and block explorer URLs for each supported destination chain.
 */

export type SupportedEvmChain = "ethereum" | "base" | "arbitrum" | "optimism";

export interface EvmChainConfig {
  /** Display name */
  name: string;
  /** Chain ID (for wallet switching) */
  chainId: number;
  /** Native token symbol */
  nativeSymbol: string;
  /** USDC contract address on this chain */
  usdcAddress: string;
  /** CCTP Message Transmitter contract address */
  cctpMessageTransmitter: string;
  /** Block explorer base URL for tx links */
  explorerUrl: string;
  /** Block explorer name for UI labels */
  explorerName: string;
}

// ─── Chain Configurations ─────────────────────────────────────────────────────

const EVM_CHAINS: Record<SupportedEvmChain, EvmChainConfig> = {
  ethereum: {
    name: "Ethereum",
    chainId: 1,
    nativeSymbol: "ETH",
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    cctpMessageTransmitter: "0xAD09768cB16C74Fc5E66a01442107DaEE58aBB05",
    explorerUrl: "https://etherscan.io/tx/",
    explorerName: "Etherscan",
  },
  base: {
    name: "Base",
    chainId: 8453,
    nativeSymbol: "ETH",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    cctpMessageTransmitter: "0x096356f4d52663f3AF2F898F4af7aaFaF9C07B8F",
    explorerUrl: "https://basescan.org/tx/",
    explorerName: "BaseScan",
  },
  arbitrum: {
    name: "Arbitrum",
    chainId: 42161,
    nativeSymbol: "ETH",
    usdcAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    cctpMessageTransmitter: "0x096356f4d52663f3AF2F898F4af7aaFaF9C07B8F",
    explorerUrl: "https://arbiscan.io/tx/",
    explorerName: "Arbiscan",
  },
  optimism: {
    name: "Optimism",
    chainId: 10,
    nativeSymbol: "ETH",
    usdcAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    cctpMessageTransmitter: "0x096356f4d52663f3AF2F898F4af7aaFaF9C07B8F",
    explorerUrl: "https://optimistic.etherscan.io/tx/",
    explorerName: "Optimism Etherscan",
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const SUPPORTED_EVM_CHAINS: SupportedEvmChain[] = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
];

export function getEvmChainConfig(chain: SupportedEvmChain): EvmChainConfig {
  return EVM_CHAINS[chain];
}

export function getExplorerTxUrl(
  chain: SupportedEvmChain,
  txHash: string,
): string {
  return `${EVM_CHAINS[chain].explorerUrl}${txHash}`;
}

/**
 * Validates a manual EVM address input.
 * Returns null if valid, or an error message if invalid.
 */
export function validateEvmAddress(address: string): string | null {
  if (!address) return "Address is required";
  if (!address.startsWith("0x")) return "Address must start with 0x";
  if (address.length !== 42) return "Address must be 42 characters long";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return "Invalid hex characters";
  return null;
}
