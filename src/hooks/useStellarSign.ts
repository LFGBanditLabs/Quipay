import { useCallback } from "react";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import {
  Keypair,
  TransactionBuilder,
  type Transaction,
  xdr,
} from "@stellar/stellar-sdk";
import { networkPassphrase } from "../contracts/util";

/**
 * Signs a prepared Stellar/Soroban transaction (given as XDR) with the user's
 * Privy embedded wallet and returns the signed XDR — ready for
 * submitAndAwaitTx. Stellar signs the 32-byte transaction hash with ed25519;
 * Privy's signRawHash produces exactly that. The key never leaves Privy.
 *
 * This is the single signing path for every on-chain write the embedded
 * wallet makes (deposit, create stream, etc.).
 */
export function useStellarSign() {
  const { signRawHash } = useSignRawHash();

  const signXdr = useCallback(
    async (preparedXdr: string, address: string): Promise<string> => {
      const tx = TransactionBuilder.fromXDR(
        preparedXdr,
        networkPassphrase,
      ) as Transaction;

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

      return tx.toXDR();
    },
    [signRawHash],
  );

  return { signXdr };
}
