import { useCallback, useState } from "react";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  ensureFundedAccount,
  horizonUrl,
  networkPassphrase,
} from "../contracts/util";

const USDC_ISSUER = import.meta.env.PUBLIC_USDC_ISSUER ?? "";

type FundState = "idle" | "funding" | "trustline" | "done" | "error";

/**
 * One-tap testnet funding for the Privy embedded Stellar wallet:
 *   1. Friendbot activates + funds the account with XLM (via ensureFundedAccount).
 *   2. A changeTrust op adds the USDC trustline, signed with the embedded
 *      wallet's key through Privy's signRawHash (Stellar = ed25519 over the
 *      transaction hash). No key ever leaves Privy.
 * Idempotent: if the trustline already exists, Horizon's op result is treated
 * as success.
 */
export function useFundStellarWallet() {
  const { signRawHash } = useSignRawHash();
  const [state, setState] = useState<FundState>("idle");
  const [error, setError] = useState<string | null>(null);

  const fund = useCallback(
    async (address: string): Promise<boolean> => {
      setError(null);
      try {
        if (!USDC_ISSUER) throw new Error("USDC issuer is not configured.");

        // 1. XLM via friendbot (creates the account if it doesn't exist).
        setState("funding");
        await ensureFundedAccount(address);

        // 2. USDC trustline, signed by the embedded wallet.
        setState("trustline");
        const server = new Horizon.Server(horizonUrl);
        const account = await server.loadAccount(address);

        // Skip if a USDC trustline is already present.
        const hasUsdc = account.balances.some(
          (b) =>
            "asset_code" in b &&
            b.asset_code === "USDC" &&
            "asset_issuer" in b &&
            b.asset_issuer === USDC_ISSUER,
        );
        if (hasUsdc) {
          setState("done");
          return true;
        }

        const tx = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase,
        })
          .addOperation(
            Operation.changeTrust({
              asset: new Asset("USDC", USDC_ISSUER),
            }),
          )
          .setTimeout(180)
          .build();

        // Stellar signs the 32-byte transaction hash with ed25519.
        const hashHex = tx.hash().toString("hex");
        const { signature } = await signRawHash({
          address,
          chainType: "stellar",
          hash: `0x${hashHex}`,
        });

        const sigBuf = Buffer.from(signature.replace(/^0x/, ""), "hex");
        const hint = Keypair.fromPublicKey(address).signatureHint();
        tx.signatures.push(
          new xdr.DecoratedSignature({ hint, signature: sigBuf }),
        );

        await server.submitTransaction(tx);
        setState("done");
        return true;
      } catch (err) {
        setState("error");
        setError(
          err instanceof Error ? err.message : "Funding failed. Try again.",
        );
        return false;
      }
    },
    [signRawHash],
  );

  return { fund, state, error };
}
