/**
 * evmBalances.ts
 * ──────────────
 * Reads USDC balances on EVM chains via public RPC endpoints.
 *
 * Uses viem's publicClient to call the ERC-20 balanceOf function
 * on the USDC contract for each supported chain. No wallet connection
 * needed — just a public RPC and an address.
 */

import { createPublicClient, http, formatUnits, type Address } from "viem";
import { mainnet, base, arbitrum, optimism } from "viem/chains";
import { getEvmChainConfig, type SupportedEvmChain } from "./evmAddresses";

// ─── Viem chain map ───────────────────────────────────────────────────────────

const VIEM_CHAINS = {
  ethereum: mainnet,
  base,
  arbitrum,
  optimism,
} as const;

// ─── ERC-20 balanceOf ABI ─────────────────────────────────────────────────────

const ERC20_BALANCE_ABI = [
  {
    type: "function" as const,
    name: "balanceOf",
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── Public client cache ──────────────────────────────────────────────────────

const clientCache = new Map<SupportedEvmChain, ReturnType<typeof createPublicClient>>();

function getClient(chain: SupportedEvmChain) {
  if (!clientCache.has(chain)) {
    const viemChain = VIEM_CHAINS[chain];
    clientCache.set(
      chain,
      createPublicClient({
        chain: viemChain,
        transport: http(),
      }),
    );
  }
  return clientCache.get(chain)!;
}

// ─── Read USDC balance ────────────────────────────────────────────────────────

/**
 * Reads the USDC balance for an address on a specific EVM chain.
 *
 * @param chain - The EVM chain to query
 * @param address - The EVM address (0x...) to check
 * @returns Balance in human-readable USDC (e.g., 1500.50)
 */
export async function readEvmUsdcBalance(
  chain: SupportedEvmChain,
  address: string,
): Promise<number> {
  const config = getEvmChainConfig(chain);
  const client = getClient(chain);

  try {
    const balance = await client.readContract({
      address: config.usdcAddress as Address,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address as Address],
    });

    // USDC has 6 decimals on all EVM chains
    return parseFloat(formatUnits(balance, 6));
  } catch {
    return 0;
  }
}

// ─── Read balances on all chains ──────────────────────────────────────────────

export interface EvmChainBalances {
  ethereum: number;
  base: number;
  arbitrum: number;
  optimism: number;
}

/**
 * Reads USDC balances on all supported EVM chains in parallel.
 *
 * @param address - The EVM address (0x...) to check
 * @returns Balances per chain in human-readable USDC
 */
export async function readAllEvmBalances(
  address: string,
): Promise<EvmChainBalances> {
  const chains: SupportedEvmChain[] = [
    "ethereum",
    "base",
    "arbitrum",
    "optimism",
  ];

  const results = await Promise.allSettled(
    chains.map((chain) => readEvmUsdcBalance(chain, address)),
  );

  return {
    ethereum:
      results[0].status === "fulfilled" ? results[0].value : 0,
    base: results[1].status === "fulfilled" ? results[1].value : 0,
    arbitrum:
      results[2].status === "fulfilled" ? results[2].value : 0,
    optimism:
      results[3].status === "fulfilled" ? results[3].value : 0,
  };
}
