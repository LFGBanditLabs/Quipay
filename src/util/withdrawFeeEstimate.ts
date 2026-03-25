/**
 * Builds a PayrollStream `withdraw` invocation and runs Soroban simulation
 * to estimate network fees before the user signs.
 */

import {
  Contract,
  TransactionBuilder,
  Address,
  nativeToScVal,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";
import { networkPassphrase, rpcUrl } from "../contracts/util";
import { PAYROLL_STREAM_CONTRACT_ID } from "../contracts/payroll_stream";
import {
  simulateTransaction,
  type CurrentBalance,
  type SimulationResult,
} from "./simulationUtils";

const SOROBAN_TX_FEE = "1000000";

export function isWithdrawFeeEstimateAvailable(): boolean {
  return Boolean(PAYROLL_STREAM_CONTRACT_ID?.trim());
}

/**
 * Simulates `withdraw(stream_id, worker)` against the configured PayrollStream contract.
 * Uses the same RPC URL as the rest of the app (`PUBLIC_STELLAR_RPC_URL`).
 */
export async function simulatePayrollStreamWithdrawFee(
  workerPublicKey: string,
  streamId: number,
  currentBalances: CurrentBalance[],
): Promise<SimulationResult> {
  const contractId = PAYROLL_STREAM_CONTRACT_ID?.trim();
  if (!contractId) {
    return {
      status: "error",
      estimatedFeeStroops: 0,
      estimatedFeeXLM: 0,
      balanceChanges: [],
      errorMessage:
        "VITE_PAYROLL_STREAM_CONTRACT_ID is not set; cannot estimate withdrawal fee.",
      restoreRequired: false,
    };
  }

  const server = new SorobanRpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
  });

  const account = await server.getAccount(workerPublicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: SOROBAN_TX_FEE,
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "withdraw",
        nativeToScVal(BigInt(streamId), { type: "u64" }),
        new Address(workerPublicKey).toScVal(),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return simulateTransaction(prepared, currentBalances, rpcUrl);
}
