/**
 * cctp_deposit.ts
 * ───────────────
 * EVM-side CCTP deposit bindings.
 *
 * Builds transactions for:
 * 1. ERC-20 `approve` — allow the Token Messenger to spend USDC
 * 2. `depositForBurn` — burn USDC on the source chain and emit a CCTP message
 *
 * The attestation + Stellar mint is handled by cctp.ts (attestation polling)
 * and the Stellar Message Transmitter contract (receive_message).
 */

import { encodeFunctionData, type Address, type Hex } from "viem";
import {
  getEvmChainConfig,
  STELLAR_CCTP_DOMAIN,
  type SupportedEvmChain,
} from "../lib/evmAddresses";

// ─── Minimal ABIs ─────────────────────────────────────────────────────────────

const ERC20_APPROVE_ABI = [
  {
    type: "function" as const,
    name: "approve",
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const DEPOSIT_FOR_BURN_ABI = [
  {
    type: "function" as const,
    name: "depositForBurn",
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [{ name: "", type: "uint64" }],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvmTxRequest {
  /** Target contract address */
  to: Address;
  /** Encoded calldata */
  data: Hex;
  /** Value in wei (always 0 for CCTP calls) */
  value: bigint;
  /** Chain ID for wallet switching */
  chainId: number;
}

// ─── Stellar address → bytes32 ────────────────────────────────────────────────

/**
 * Encodes a Stellar address (G...) as a bytes32 value for CCTP's mintRecipient.
 *
 * CCTP expects the recipient as a 32-byte value. For Stellar, we encode the
 * raw ed25519 public key bytes (32 bytes from the G... address) into bytes32.
 *
 * The Stellar address is a base32-encoded ed25519 public key. We decode it
 * and take the 32-byte raw key.
 */
export function stellarAddressToBytes32(stellarAddress: string): Hex {
  // Stellar addresses are base32 (alphabet: A-Z2-7), 56 chars.
  // The raw payload is 32 bytes (ed25519 public key).
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  // Remove any whitespace
  const addr = stellarAddress.trim();

  // Decode base32 manually — each char is 5 bits
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const ch of addr) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error(`Invalid Stellar address character: ${ch}`);
    }
    value = (value << 5) | idx;
    bits += 5;

    while (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  // The 32-byte ed25519 key is bytes 1..33 (byte 0 is the version byte 0x30)
  const rawKey = bytes.slice(1, 33);
  if (rawKey.length !== 32) {
    throw new Error(
      `Stellar address decoded to ${rawKey.length} bytes, expected 32`,
    );
  }

  return `0x${Buffer.from(rawKey).toString("hex")}` as Hex;
}

// ─── Build approve tx ─────────────────────────────────────────────────────────

/**
 * Builds an ERC-20 `approve` transaction to allow the CCTP Token Messenger
 * to spend USDC on the source chain.
 *
 * Must be submitted and confirmed before `buildDepositForBurnTx`.
 */
export function buildApproveTx(
  chain: SupportedEvmChain,
  amount: bigint,
): EvmTxRequest {
  const config = getEvmChainConfig(chain);

  return {
    to: config.usdcAddress as Address,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [config.cctpTokenMessenger as Address, amount],
    }),
    value: 0n,
    chainId: config.chainId,
  };
}

// ─── Build depositForBurn tx ──────────────────────────────────────────────────

/**
 * Builds a CCTP `depositForBurn` transaction.
 *
 * This burns USDC on the source EVM chain and creates a CCTP message
 * that will be attested by Circle and minted on Stellar.
 *
 * @param chain - Source EVM chain
 * @param amount - USDC amount in smallest unit (6 decimals)
 * @param stellarRecipient - Stellar address (G...) to receive minted USDC
 * @param maxFee - Maximum fee for the CCTP transfer (in USDC smallest unit).
 *                 Set to 0 for fast transfers (CCTP v2 default).
 * @param minFinalityThreshold - Minimum finality threshold. 1 = fast transfer.
 */
export function buildDepositForBurnTx(
  chain: SupportedEvmChain,
  amount: bigint,
  stellarRecipient: string,
  maxFee: bigint = 0n,
  minFinalityThreshold: number = 1,
): EvmTxRequest {
  const config = getEvmChainConfig(chain);
  const mintRecipient = stellarAddressToBytes32(stellarRecipient);

  // destinationCaller is bytes32(0) — anyone can call receiveMessage on Stellar
  const destinationCaller =
    "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

  return {
    to: config.cctpTokenMessenger as Address,
    data: encodeFunctionData({
      abi: DEPOSIT_FOR_BURN_ABI,
      functionName: "depositForBurn",
      args: [
        amount,
        STELLAR_CCTP_DOMAIN,
        mintRecipient,
        config.usdcAddress as Address,
        destinationCaller,
        maxFee,
        minFinalityThreshold,
      ],
    }),
    value: 0n,
    chainId: config.chainId,
  };
}
