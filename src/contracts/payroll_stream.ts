/**
 * payroll_stream.ts
 * ─────────────────
 * Frontend bindings for the PayrollStream Soroban contract.
 *
 * Exports
 * ───────
 * • PAYROLL_STREAM_CONTRACT_ID   – contract address from env
 * • ContractStream               – shape of the on-chain Stream struct
 * • ContractWithdrawalEvent      – shape of a decoded stream.withdrawn event
 * • CreateStreamParams           – parameter type for create_stream
 * • buildCreateStreamTx          – simulate + build a create_stream XDR
 * • checkTreasurySolvency        – reads PayrollVault.check_solvency
 * • getWithdrawable              – reads the withdrawable amount for a stream
 * • getStreamsByWorker           – list stream IDs for a worker address
 * • getStreamById                – fetch a single stream by ID
 * • getTokenSymbol               – resolve a token contract address to its symbol
 * • getWorkerWithdrawalEvents    – query withdrawal events for a worker
 * • submitAndAwaitTx             – submit a signed XDR and wait for confirmation
 */

import {
  Contract,
  rpc as SorobanRpc,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { rpcUrl, networkPassphrase } from "./util";

// ─── Contract ID ──────────────────────────────────────────────────────────────

export const PAYROLL_STREAM_CONTRACT_ID: string =
  (
    import.meta.env.VITE_PAYROLL_STREAM_CONTRACT_ID as string | undefined
  )?.trim() ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateStreamParams {
  /** Employer's Stellar public key (G…) */
  employer: string;
  /** Worker's Stellar public key (G…) */
  worker: string;
  /**
   * Token identifier – empty string for native XLM, or the full
   * "CODE:ISSUER" string for a Stellar asset.
   */
  token: string;
  /** Flow rate in stroops per second */
  rate: bigint;
  /** Total amount deposited into the stream in stroops */
  amount: bigint;
  /** Unix timestamp (seconds) for stream start */
  startTs: number;
  /** Unix timestamp (seconds) for stream end */
  endTs: number;
  /**
   * Optional 32-byte metadata hash (hex string) referencing an off-chain
   * record (e.g. IPFS CID or database key) with stream context such as
   * description, department, and payment type.
   */
  metadataHash?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRpcServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(rpcUrl, { allowHttp: true });
}

/**
 * Converts a token string to a ScVal suitable for the contract.
 * Empty string → native XLM address bytes.
 */
function tokenToScVal(token: string): xdr.ScVal {
  // Native XLM is represented as a zero-bytes contract address on Soroban
  if (!token || token === "native") {
    return nativeToScVal(null, { type: "address" });
  }
  // SAC (Stellar Asset Contract) — pass as address string
  return new Address(token).toScVal();
}

// ─── buildCreateStreamTx ─────────────────────────────────────────────────────

/**
 * Simulates and builds a `create_stream` transaction, returning the
 * base64-encoded prepared XDR ready for signing.
 */
export async function buildCreateStreamTx(
  params: CreateStreamParams,
): Promise<{ preparedXdr: string }> {
  if (!PAYROLL_STREAM_CONTRACT_ID) {
    throw new Error(
      "VITE_PAYROLL_STREAM_CONTRACT_ID is not set in environment variables.",
    );
  }

  const server = getRpcServer();
  const account = await server.getAccount(params.employer);

  const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "create_stream",
        new Address(params.employer).toScVal(),
        new Address(params.worker).toScVal(),
        tokenToScVal(params.token),
        nativeToScVal(params.rate, { type: "i128" }),
        nativeToScVal(params.amount, { type: "i128" }),
        nativeToScVal(BigInt(params.startTs), { type: "u64" }),
        nativeToScVal(BigInt(params.endTs), { type: "u64" }),
        params.metadataHash
          ? nativeToScVal(Buffer.from(params.metadataHash, "hex"), {
              type: "bytes",
            })
          : xdr.ScVal.scvVoid(),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return { preparedXdr: prepared.toXDR() };
}

// ─── buildCancelStreamTx ─────────────────────────────────────────────────────

/**
 * Simulates and builds a `cancel_stream` transaction, returning the
 * base64-encoded prepared XDR ready for signing.
 */
export async function buildCancelStreamTx(
  streamId: bigint,
  employer: string,
): Promise<{ preparedXdr: string }> {
  if (!PAYROLL_STREAM_CONTRACT_ID) {
    throw new Error(
      "VITE_PAYROLL_STREAM_CONTRACT_ID is not set in environment variables.",
    );
  }

  const server = getRpcServer();
  const account = await server.getAccount(employer);
  const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "cancel_stream",
        nativeToScVal(streamId, { type: "u64" }),
        new Address(employer).toScVal(),
        nativeToScVal(null), // For the 'to' option in Soroban which is an Option<Address> or something? Wait...
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return { preparedXdr: prepared.toXDR() };
}

// ─── checkTreasurySolvency ────────────────────────────────────────────────────

/**
 * Calls `check_solvency` on the PayrollVault contract to determine whether
 * the vault holds enough funds for the requested stream total.
 *
 * Returns `true` if the treasury is solvent, `false` otherwise.
 */
export async function checkTreasurySolvency(
  vaultContractId: string,
  tokenContractId: string,
  requiredAmount: bigint,
): Promise<boolean> {
  if (!vaultContractId) {
    // No vault configured — optimistically allow the user to proceed
    return true;
  }

  const server = getRpcServer();
  const contract = new Contract(vaultContractId);

  // We use a dummy source account for read-only simulation
  const dummySource = await server
    .getAccount(vaultContractId)
    .catch(() => null);
  if (!dummySource) return true;

  const tx = new TransactionBuilder(dummySource, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "check_solvency",
        tokenContractId
          ? new Address(tokenContractId).toScVal()
          : nativeToScVal(null, { type: "address" }),
        nativeToScVal(requiredAmount, { type: "i128" }),
      ),
    )
    .setTimeout(10)
    .build();

  const response = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(response)) {
    console.warn("Solvency simulation error:", response.error);
    return false;
  }

  const result = (response as SorobanRpc.Api.SimulateTransactionSuccessResponse)
    .result?.retval;
  if (!result) return true;

  return scValToNative(result) as boolean;
}

// ─── getWithdrawable ─────────────────────────────────────────────────────────

/**
 * Calls `get_withdrawable` on the PayrollStream contract to get the
 * amount currently available for the worker to withdraw.
 *
 * Returns the amount as a bigint, or null if the stream is not found.
 */
export async function getWithdrawable(
  streamId: bigint,
): Promise<bigint | null> {
  if (!PAYROLL_STREAM_CONTRACT_ID) return null;

  const server = getRpcServer();
  const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);

  // Use the contract ID itself as a dummy source for simulation
  const dummySource = await server
    .getAccount(PAYROLL_STREAM_CONTRACT_ID)
    .catch(() => null);
  if (!dummySource) return null;

  const tx = new TransactionBuilder(dummySource, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "get_withdrawable",
        nativeToScVal(streamId, { type: "u64" }),
      ),
    )
    .setTimeout(10)
    .build();

  const response = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(response)) {
    return null;
  }

  const result = (response as SorobanRpc.Api.SimulateTransactionSuccessResponse)
    .result?.retval;
  if (!result) return null;

  return scValToNative(result) as bigint | null;
}

// ─── submitAndAwaitTx ─────────────────────────────────────────────────────────

/**
 * Submits a signed transaction XDR to the Soroban RPC and polls until
 * it is confirmed (SUCCESS) or fails.
 *
 * Returns the transaction hash on success.
 */
export async function submitAndAwaitTx(signedTxXdr: string): Promise<string> {
  const server = getRpcServer();
  const tx = TransactionBuilder.fromXDR(
    signedTxXdr,
    networkPassphrase,
  ) as Transaction;

  const sendResponse = await server.sendTransaction(tx);

  if (sendResponse.status === "ERROR") {
    throw new Error(
      `Transaction submission failed: ${JSON.stringify(sendResponse.errorResult)}`,
    );
  }

  const hash = sendResponse.hash;

  // Poll for confirmation
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    const statusResponse = await server.getTransaction(hash);

    if (statusResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return hash;
    }

    if (statusResponse.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain. Hash: ${hash}`);
    }

    // PENDING / NOT_FOUND — wait and retry
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error(
    `Transaction confirmation timed out after ${maxAttempts}s. Hash: ${hash}`,
  );
}

// ─── ContractStream types ─────────────────────────────────────────────────────

/**
 * Shape of the Stream struct as returned by the PayrollStream contract,
 * decoded from ScVal → native JS values.
 */
export interface ContractStream {
  employer: string;
  worker: string;
  /** Soroban contract address of the token (SAC or custom). */
  token: string;
  /** Flow rate in stroops (smallest token unit) per second. */
  rate: bigint;
  cliff_ts: bigint;
  start_ts: bigint;
  end_ts: bigint;
  total_amount: bigint;
  withdrawn_amount: bigint;
  last_withdrawal_ts: bigint;
  /** 0 = Active, 1 = Canceled, 2 = Completed */
  status: number;
  created_at: bigint;
  closed_at: bigint;
  /**
   * Optional 32-byte metadata hash (as a Buffer/Uint8Array) referencing an
   * off-chain record with stream context (description, department, payment type).
   */
  metadata_hash?: Uint8Array;
}

export interface ContractWithdrawalEvent {
  streamId: bigint;
  amount: bigint;
  token: string;
  ledgerClosedAt: string;
  txHash: string;
}

// ─── simulateContractRead ─────────────────────────────────────────────────────

async function simulateContractRead<T>(
  sourceAddress: string,
  operation: xdr.Operation,
): Promise<T | null> {
  const server = getRpcServer();

  let source = await server.getAccount(sourceAddress).catch(() => null);
  if (!source && PAYROLL_STREAM_CONTRACT_ID) {
    source = await server
      .getAccount(PAYROLL_STREAM_CONTRACT_ID)
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

// ─── getStreamsByWorker ───────────────────────────────────────────────────────

/**
 * Calls `get_streams_by_worker` on the PayrollStream contract and returns the
 * list of stream IDs owned by `workerAddress`.
 */
export async function getStreamsByWorker(
  workerAddress: string,
  offset?: number,
  limit?: number,
): Promise<bigint[]> {
  if (!PAYROLL_STREAM_CONTRACT_ID) return [];

  const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);
  const ids = await simulateContractRead<bigint[]>(
    workerAddress,
    contract.call(
      "get_streams_by_worker",
      new Address(workerAddress).toScVal(),
      nativeToScVal(offset !== undefined ? offset : null),
      nativeToScVal(limit !== undefined ? limit : null),
    ),
  );

  return ids ?? [];
}

// ─── getStreamsByEmployer ───────────────────────────────────────────────────────

/**
 * Calls `get_streams_by_employer` on the PayrollStream contract and returns the
 * list of stream IDs created by `employerAddress`.
 */
export async function getStreamsByEmployer(
  employerAddress: string,
  offset?: number,
  limit?: number,
): Promise<bigint[]> {
  if (!PAYROLL_STREAM_CONTRACT_ID) return [];

  const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);
  const ids = await simulateContractRead<bigint[]>(
    employerAddress,
    contract.call(
      "get_streams_by_employer",
      new Address(employerAddress).toScVal(),
      nativeToScVal(offset !== undefined ? offset : null),
      nativeToScVal(limit !== undefined ? limit : null),
    ),
  );

  return ids ?? [];
}

// ─── getStreamById ────────────────────────────────────────────────────────────

/**
 * Calls `get_stream` on the PayrollStream contract and returns the decoded
 * `ContractStream`, or `null` if the stream does not exist.
 */
export async function getStreamById(
  sourceAddress: string,
  streamId: bigint,
): Promise<ContractStream | null> {
  if (!PAYROLL_STREAM_CONTRACT_ID) return null;

  const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);
  return simulateContractRead<ContractStream>(
    sourceAddress,
    contract.call("get_stream", nativeToScVal(streamId, { type: "u64" })),
  );
}

// ─── getStreamMetadata ────────────────────────────────────────────────────────

/**
 * Calls `get_stream_metadata` on the PayrollStream contract and returns the
 * 32-byte metadata hash as a hex string, or `null` if none is set.
 * The hash references an off-chain record (IPFS or database) with stream context.
 */
export async function getStreamMetadata(
  sourceAddress: string,
  streamId: bigint,
): Promise<string | null> {
  if (!PAYROLL_STREAM_CONTRACT_ID) return null;

  const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);
  const result = await simulateContractRead<Uint8Array>(
    sourceAddress,
    contract.call(
      "get_stream_metadata",
      nativeToScVal(streamId, { type: "u64" }),
    ),
  );

  if (!result) return null;
  return Buffer.from(result).toString("hex");
}

// ─── getTokenSymbol ───────────────────────────────────────────────────────────

const _tokenSymbolCache = new Map<string, string>();

/**
 * Calls `symbol()` on any SEP-41-compatible token contract (SAC or custom).
 * Results are cached in-memory.  Falls back to a truncated address on error.
 */
export async function getTokenSymbol(
  sourceAddress: string,
  tokenAddress: string,
): Promise<string> {
  const cached = _tokenSymbolCache.get(tokenAddress);
  if (cached) return cached;

  try {
    const server = getRpcServer();
    let source = await server.getAccount(sourceAddress).catch(() => null);
    if (!source && PAYROLL_STREAM_CONTRACT_ID) {
      source = await server
        .getAccount(PAYROLL_STREAM_CONTRACT_ID)
        .catch(() => null);
    }
    if (!source) return tokenAddress.slice(0, 6);

    const tokenContract = new Contract(tokenAddress);
    const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase })
      .addOperation(tokenContract.call("symbol"))
      .setTimeout(10)
      .build();

    const response = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(response)) {
      return tokenAddress.slice(0, 6);
    }

    const retval = (
      response as SorobanRpc.Api.SimulateTransactionSuccessResponse
    ).result?.retval;
    if (!retval) return tokenAddress.slice(0, 6);

    const sym = (scValToNative(retval) as string) || tokenAddress.slice(0, 6);
    _tokenSymbolCache.set(tokenAddress, sym);
    return sym;
  } catch {
    return tokenAddress.slice(0, 6);
  }
}

// ─── getWorkerWithdrawalEvents ────────────────────────────────────────────────

/**
 * Queries the Soroban RPC for `stream.withdrawn` events emitted for the given
 * worker address over the last ~24 hours (17 280 ledgers at 5 s/ledger).
 *
 * Events where the decoded worker topic does not match `workerAddress` are
 * silently discarded, so the returned list is always scoped to that worker.
 */
export async function getWorkerWithdrawalEvents(
  workerAddress: string,
): Promise<ContractWithdrawalEvent[]> {
  if (!PAYROLL_STREAM_CONTRACT_ID) return [];

  const server = getRpcServer();
  try {
    const { sequence: latestLedger } = await server.getLatestLedger();
    const startLedger = Math.max(1, latestLedger - 17280);

    const symStream = nativeToScVal("stream", { type: "symbol" }).toXDR(
      "base64",
    );
    const symWithdrawn = nativeToScVal("withdrawn", { type: "symbol" }).toXDR(
      "base64",
    );

    const response = await server.getEvents({
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [PAYROLL_STREAM_CONTRACT_ID],
          topics: [[symStream, symWithdrawn, "*", "*"]],
        },
      ],
      limit: 200,
    });

    const results: ContractWithdrawalEvent[] = [];

    for (const ev of response.events) {
      try {
        if (ev.topic.length < 4) continue;

        const workerFromEvent = scValToNative(ev.topic[3]) as string;
        if (workerFromEvent !== workerAddress) continue;

        const streamId = scValToNative(ev.topic[2]) as bigint;
        const [amount, token] = scValToNative(ev.value) as [bigint, string];

        results.push({
          streamId,
          amount,
          token,
          ledgerClosedAt: ev.ledgerClosedAt,
          txHash: ev.txHash,
        });
      } catch {
        continue;
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ─── buildBatchCreateStreamsTx ────────────────────────────────────────────────

/**
 * A single entry in a batch stream creation request.
 * Mirrors the on-chain `StreamParams` struct.
 */
export interface BatchStreamEntry {
  worker: string;
  token: string;
  /** Flow rate in stroops per second */
  rate: bigint;
  /** Unix timestamp (seconds) for stream start */
  startTs: number;
  /** Unix timestamp (seconds) for stream end */
  endTs: number;
  /** Optional cliff timestamp — defaults to startTs if omitted */
  cliffTs?: number;
}

/**
 * Simulates and builds a `batch_create_streams` transaction.
 *
 * All entries must share the same employer (the connected wallet).
 * Solvency for the total batch amount must be validated before calling this
 * via `checkTreasurySolvency`.
 *
 * Returns the base64-encoded prepared XDR ready for signing.
 */
export async function buildBatchCreateStreamsTx(
  employer: string,
  entries: BatchStreamEntry[],
): Promise<{ preparedXdr: string }> {
  if (!PAYROLL_STREAM_CONTRACT_ID) {
    throw new Error(
      "VITE_PAYROLL_STREAM_CONTRACT_ID is not set in environment variables.",
    );
  }
  if (entries.length === 0) throw new Error("Batch must not be empty.");
  if (entries.length > 20)
    throw new Error("Batch exceeds maximum of 20 streams.");

  const server = getRpcServer();
  const account = await server.getAccount(employer);
  const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);

  // Build the Vec<StreamParams> ScVal
  const paramsVec = xdr.ScVal.scvVec(
    entries.map((e) => {
      const cliffTs = e.cliffTs ?? e.startTs;
      return xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("employer"),
          val: new Address(employer).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("worker"),
          val: new Address(e.worker).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("token"),
          val: tokenToScVal(e.token),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("rate"),
          val: nativeToScVal(e.rate, { type: "i128" }),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("cliff_ts"),
          val: nativeToScVal(BigInt(cliffTs), { type: "u64" }),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("start_ts"),
          val: nativeToScVal(BigInt(e.startTs), { type: "u64" }),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("end_ts"),
          val: nativeToScVal(BigInt(e.endTs), { type: "u64" }),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("metadata_hash"),
          val: xdr.ScVal.scvVoid(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("speed_curve"),
          // MaybeSpeedCurve::None
          val: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("None")]),
        }),
      ]);
    }),
  );

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(contract.call("batch_create_streams", paramsVec))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return { preparedXdr: prepared.toXDR() };
}
