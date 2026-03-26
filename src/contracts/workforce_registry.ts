/**
 * workforce_registry.ts
 * ─────────────────────
 * Frontend bindings for the WorkforceRegistry Soroban contract.
 *
 * Exports
 * ───────
 * • WORKFORCE_REGISTRY_CONTRACT_ID  – contract address from env
 * • WorkerProfile                   – decoded WorkerProfile struct
 * • getWorkersByEmployer            – paginated list of active workers for an employer
 * • getWorkerProfile                – fetch a single worker's profile (or null)
 * • isWorkerRegistered              – check if a worker is registered
 * • buildSetStreamActiveTx          – build a set_stream_active transaction XDR
 */

import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { rpcUrl, networkPassphrase } from "./util";

// ─── Contract ID ──────────────────────────────────────────────────────────────

export const WORKFORCE_REGISTRY_CONTRACT_ID: string =
  (
    import.meta.env.VITE_WORKFORCE_REGISTRY_CONTRACT_ID as string | undefined
  )?.trim() ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Decoded shape of the on-chain WorkerProfile struct.
 * Address fields are decoded to Stellar G… strings.
 */
export interface WorkerProfile {
  wallet: string;
  preferred_token: string;
  metadata_hash: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRpcServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(rpcUrl, { allowHttp: true });
}

async function simulateContractRead<T>(
  sourceAddress: string,
  operation: xdr.Operation,
): Promise<T | null> {
  const server = getRpcServer();

  let source = await server.getAccount(sourceAddress).catch(() => null);
  if (!source && WORKFORCE_REGISTRY_CONTRACT_ID) {
    source = await server
      .getAccount(WORKFORCE_REGISTRY_CONTRACT_ID)
      .catch(() => null);
  }
  if (!source) return null;

  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase })
    .addOperation(operation)
    .setTimeout(10)
    .build();

  const response = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(response)) return null;

  const retval = (response as SorobanRpc.Api.SimulateTransactionSuccessResponse)
    .result?.retval;
  if (!retval) return null;

  const native = scValToNative(retval) as T | undefined;
  return native ?? null;
}

// ─── getWorkersByEmployer ─────────────────────────────────────────────────────

/**
 * Calls `get_workers_by_employer` on the WorkforceRegistry contract.
 * Returns the paginated list of active WorkerProfiles for the given employer.
 */
export async function getWorkersByEmployer(
  sourceAddress: string,
  employerAddress: string,
  start = 0,
  limit = 100,
): Promise<WorkerProfile[]> {
  if (!WORKFORCE_REGISTRY_CONTRACT_ID) return [];

  const contract = new Contract(WORKFORCE_REGISTRY_CONTRACT_ID);
  const result = await simulateContractRead<WorkerProfile[]>(
    sourceAddress,
    contract.call(
      "get_workers_by_employer",
      new Address(employerAddress).toScVal(),
      nativeToScVal(start, { type: "u32" }),
      nativeToScVal(limit, { type: "u32" }),
    ),
  );

  return result ?? [];
}

// ─── getWorkerProfile ─────────────────────────────────────────────────────────

/**
 * Calls `get_worker` on the WorkforceRegistry contract.
 * Returns the WorkerProfile for the given address, or null if unregistered.
 */
export async function getWorkerProfile(
  sourceAddress: string,
  workerAddress: string,
): Promise<WorkerProfile | null> {
  if (!WORKFORCE_REGISTRY_CONTRACT_ID) return null;

  const contract = new Contract(WORKFORCE_REGISTRY_CONTRACT_ID);
  return simulateContractRead<WorkerProfile>(
    sourceAddress,
    contract.call("get_worker", new Address(workerAddress).toScVal()),
  );
}

// ─── isWorkerRegistered ───────────────────────────────────────────────────────

/**
 * Calls `is_registered` on the WorkforceRegistry contract.
 * Returns true if the worker has a profile registered.
 */
export async function isWorkerRegistered(
  sourceAddress: string,
  workerAddress: string,
): Promise<boolean> {
  if (!WORKFORCE_REGISTRY_CONTRACT_ID) return false;

  const contract = new Contract(WORKFORCE_REGISTRY_CONTRACT_ID);
  const result = await simulateContractRead<boolean>(
    sourceAddress,
    contract.call("is_registered", new Address(workerAddress).toScVal()),
  );

  return result ?? false;
}

// ─── buildSetStreamActiveTx ───────────────────────────────────────────────────

/**
 * Builds and prepares a `set_stream_active` transaction.
 * Returns the base64-encoded prepared XDR ready for the employer to sign.
 *
 * @param employer - Employer's Stellar address (requires_auth)
 * @param worker   - Worker's Stellar address (must be registered)
 * @param active   - true to add the worker to the active roster, false to remove
 */
export async function buildSetStreamActiveTx(
  employer: string,
  worker: string,
  active: boolean,
): Promise<{ preparedXdr: string }> {
  if (!WORKFORCE_REGISTRY_CONTRACT_ID) {
    throw new Error(
      "VITE_WORKFORCE_REGISTRY_CONTRACT_ID is not set in environment variables.",
    );
  }

  const server = getRpcServer();
  const account = await server.getAccount(employer);
  const contract = new Contract(WORKFORCE_REGISTRY_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "set_stream_active",
        new Address(employer).toScVal(),
        new Address(worker).toScVal(),
        nativeToScVal(active, { type: "bool" }),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return { preparedXdr: prepared.toXDR() };
}
