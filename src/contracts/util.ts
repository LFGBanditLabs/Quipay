import { z } from "zod";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import { Network, NetworkType } from "../debug/types/types";

const envSchema = z.object({
  PUBLIC_STELLAR_NETWORK: z.enum([
    "PUBLIC",
    "FUTURENET",
    "TESTNET",
    "LOCAL",
    "STANDALONE", // deprecated in favor of LOCAL
  ] as const),
  PUBLIC_STELLAR_NETWORK_PASSPHRASE: z.nativeEnum(WalletNetwork),
  PUBLIC_STELLAR_RPC_URL: z.string(),
  PUBLIC_STELLAR_HORIZON_URL: z.string(),
});

const parsed = envSchema.safeParse(import.meta.env);

const env: z.infer<typeof envSchema> = parsed.success
  ? parsed.data
  : {
      PUBLIC_STELLAR_NETWORK: "LOCAL",
      PUBLIC_STELLAR_NETWORK_PASSPHRASE: WalletNetwork.STANDALONE,
      PUBLIC_STELLAR_RPC_URL: "http://localhost:8000/rpc",
      PUBLIC_STELLAR_HORIZON_URL: "http://localhost:8000",
    };

export const stellarNetwork =
  env.PUBLIC_STELLAR_NETWORK === "STANDALONE"
    ? "LOCAL"
    : env.PUBLIC_STELLAR_NETWORK;
export const networkPassphrase = env.PUBLIC_STELLAR_NETWORK_PASSPHRASE;

const stellarEncode = (str: string) => {
  return str.replace(/\//g, "//").replace(/;/g, "/;");
};

export const labPrefix = () => {
  switch (stellarNetwork) {
    case "LOCAL":
      return `http://localhost:8000/lab/transaction-dashboard?$=network$id=custom&label=Custom&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
    case "PUBLIC":
      return `https://lab.stellar.org/transaction-dashboard?$=network$id=mainnet&label=Mainnet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
    case "TESTNET":
      return `https://lab.stellar.org/transaction-dashboard?$=network$id=testnet&label=Testnet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
    case "FUTURENET":
      return `https://lab.stellar.org/transaction-dashboard?$=network$id=futurenet&label=Futurenet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
    default:
      return `https://lab.stellar.org/transaction-dashboard?$=network$id=testnet&label=Testnet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
  }
};

// NOTE: needs to be exported for contract files in this directory
export const rpcUrl = env.PUBLIC_STELLAR_RPC_URL;

export const horizonUrl = env.PUBLIC_STELLAR_HORIZON_URL;

const networkToId = (network: string): NetworkType => {
  switch (network) {
    case "PUBLIC":
      return "mainnet";
    case "TESTNET":
      return "testnet";
    case "FUTURENET":
      return "futurenet";
    default:
      return "custom";
  }
};

export const network: Network = {
  id: networkToId(stellarNetwork),
  label: stellarNetwork.toLowerCase(),
  passphrase: networkPassphrase,
  rpcUrl: rpcUrl,
  horizonUrl: horizonUrl,
};

// ─── Account funding ──────────────────────────────────────────────────────────

const friendbotUrl = (address: string): string | null => {
  switch (stellarNetwork) {
    case "TESTNET":
      return `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`;
    case "FUTURENET":
      return `https://friendbot-futurenet.stellar.org?addr=${encodeURIComponent(address)}`;
    case "LOCAL":
      return `${horizonUrl}/friendbot?addr=${encodeURIComponent(address)}`;
    default:
      // Mainnet has no friendbot — accounts must be funded with real XLM.
      // TODO(roadmap): employer-sponsored reserves so workers start from zero.
      return null;
  }
};

async function accountExists(address: string): Promise<boolean> {
  const res = await fetch(`${horizonUrl}/accounts/${address}`);
  if (res.ok) return true;
  if (res.status === 404) return false;
  throw new Error(`Horizon account lookup failed (${res.status})`);
}

/**
 * Ensures the given account exists on the ledger before it's used as a
 * transaction source. On testnet/futurenet/local, an unfunded account is
 * funded automatically via friendbot so first-time users never hit a
 * "account not found" dead end.
 */
export async function ensureFundedAccount(address: string): Promise<void> {
  if (await accountExists(address)) return;

  const url = friendbotUrl(address);
  if (!url) {
    throw new Error(
      "Your wallet isn't activated on the Stellar network yet. Send at least 1 XLM to your address to activate it, then try again.",
    );
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Automatic funding failed (${res.status}). Please try again.`,
    );
  }

  // Friendbot's transaction is usually visible immediately, but confirm once
  // so the follow-up getAccount() call doesn't race it.
  if (!(await accountExists(address))) {
    await new Promise((r) => setTimeout(r, 2000));
    if (!(await accountExists(address))) {
      throw new Error(
        "Funding submitted but the account isn't visible yet — try again in a moment.",
      );
    }
  }
}
