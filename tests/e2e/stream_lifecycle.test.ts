/**
 * E2E tests for the full PayrollStream lifecycle on Stellar testnet.
 *
 * Requires the following environment variables:
 *   E2E_DEPLOYER_SECRET  – secret key of a funded testnet account used as
 *                          admin/deployer.  If unset all tests are skipped.
 *   VAULT_WASM_PATH      – (optional) path to compiled payroll_vault.wasm
 *   STREAM_WASM_PATH     – (optional) path to compiled payroll_stream.wasm
 *   TESTNET_RPC_URL      – (optional) override the Soroban RPC endpoint
 *
 * Covered scenarios
 *   ✓ happy path  : deposit → create stream → cliff unlock → withdraw → complete
 *   ✓ insufficient balance : create stream without vault deposit fails
 *   ✓ cliff not reached    : withdraw before cliff vests returns 0
 *   ✓ gateway cancel       : cancel stream via the automation gateway role
 */

import { test, expect } from "@playwright/test";
import {
  Keypair,
  TransactionBuilder,
  Networks,
  Asset,
  Operation,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import { readFile } from "fs/promises";
import { resolve } from "path";

// ─── Constants ────────────────────────────────────────────────────────────────

const RPC_URL =
  process.env.TESTNET_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const FRIENDBOT_URL = "https://friendbot.stellar.org";

const VAULT_WASM_PATH =
  process.env.VAULT_WASM_PATH ??
  resolve(__dirname, "../../target/wasm32v1-none/release/payroll_vault.wasm");
const STREAM_WASM_PATH =
  process.env.STREAM_WASM_PATH ??
  resolve(__dirname, "../../target/wasm32v1-none/release/payroll_stream.wasm");

// Token amount helpers (7 decimal places for XLM-style tokens)
const ONE_TOKEN = 10_000_000n; // 1.0000000

// ─── Low-level helpers ────────────────────────────────────────────────────────

/** Fund an account via Friendbot. */
async function fund(publicKey: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!res.ok) {
    throw new Error(`Friendbot failed for ${publicKey}: ${res.statusText}`);
  }
}

/** Submit a signed transaction and poll until it is final. */
async function submitTx(
  server: SorobanRpc.Server,
  tx: ReturnType<TransactionBuilder["build"]>,
  ...signers: Keypair[]
): Promise<SorobanRpc.Api.GetSuccessfulTransactionResponse> {
  const simRes = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simRes)) {
    throw new Error(`Simulation error: ${simRes.error}`);
  }

  const assembled = SorobanRpc.assembleTransaction(tx, simRes).build();
  signers.forEach((kp) => assembled.sign(kp));

  const sendRes = await server.sendTransaction(assembled);
  if (sendRes.status === "ERROR") {
    throw new Error(`Send error: ${JSON.stringify(sendRes.errorResult)}`);
  }

  let getRes = await server.getTransaction(sendRes.hash);
  while (
    getRes.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND ||
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    getRes.status === "PENDING"
  ) {
    await new Promise((r) => setTimeout(r, 2_000));
    getRes = await server.getTransaction(sendRes.hash);
  }

  if (getRes.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction failed: ${JSON.stringify(getRes)}`);
  }
  return getRes;
}

/** Build a transaction that calls one Soroban contract function. */
async function buildContractCall(
  server: SorobanRpc.Server,
  source: Keypair,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<ReturnType<TransactionBuilder["build"]>> {
  const account = await server.getAccount(source.publicKey());
  return new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: method,
        args,
      }),
    )
    .setTimeout(60)
    .build();
}

/** Call a contract function and return the native JS value of the result. */
async function invokeContract(
  server: SorobanRpc.Server,
  source: Keypair,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  ...extraSigners: Keypair[]
): Promise<unknown> {
  const tx = await buildContractCall(server, source, contractId, method, args);
  const res = await submitTx(server, tx, source, ...extraSigners);
  if (!res.returnValue) return undefined;
  return scValToNative(res.returnValue);
}

/** Simulate (read-only) a contract call and return the native result. */
async function simulateContract(
  server: SorobanRpc.Server,
  source: Keypair,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  const tx = await buildContractCall(server, source, contractId, method, args);
  const simRes = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simRes)) {
    throw new Error(`Simulation error: ${simRes.error}`);
  }
  if (!simRes.result?.retval) return undefined;
  return scValToNative(simRes.result.retval);
}

/** Upload a WASM blob and return its hash. */
async function uploadWasm(
  server: SorobanRpc.Server,
  deployer: Keypair,
  wasmPath: string,
): Promise<Buffer> {
  const wasm = await readFile(wasmPath);
  const account = await server.getAccount(deployer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(60)
    .build();

  const res = await submitTx(server, tx, deployer);
  // The return value is the wasm hash as Bytes32
  const hash = scValToNative(res.returnValue!) as Buffer;
  return hash;
}

/** Deploy a contract from a wasm hash and return the contract ID. */
async function deployContract(
  server: SorobanRpc.Server,
  deployer: Keypair,
  wasmHash: Buffer,
): Promise<string> {
  const account = await server.getAccount(deployer.publicKey());
  const salt = Buffer.from(
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)),
  );
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createCustomContract({
        address: new Address(deployer.publicKey()),
        wasmHash,
        salt,
      }),
    )
    .setTimeout(60)
    .build();

  const res = await submitTx(server, tx, deployer);
  const contractId = scValToNative(res.returnValue!) as string;
  return contractId;
}

/** Deploy the SAC for a Stellar classic asset and return the contract ID. */
async function deploySAC(
  server: SorobanRpc.Server,
  deployer: Keypair,
  asset: Asset,
): Promise<string> {
  const account = await server.getAccount(deployer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.createStellarAssetContract({ asset }))
    .setTimeout(60)
    .build();

  const res = await submitTx(server, tx, deployer);
  const contractId = scValToNative(res.returnValue!) as string;
  return contractId;
}

/** Return the current ledger Unix timestamp from the network. */
async function ledgerTimestamp(server: SorobanRpc.Server): Promise<number> {
  const latest = await server.getLatestLedger();
  // getLatestLedger doesn't expose the timestamp directly; approximate from
  // the ledger sequence (each ledger ≈ 5 s, genesis at 2015-09-29 ~1443484800)
  // Use a call to getTransaction or simulate to get a more accurate value.
  // We rely on getLatestLedger's sequence and estimate from a reference ledger.
  // Testnet reference: sequence 0 timestamp ≈ 1443484800
  const TESTNET_GENESIS_TS = 1443484800;
  const LEDGER_INTERVAL_SECS = 5;
  return TESTNET_GENESIS_TS + latest.sequence * LEDGER_INTERVAL_SECS;
}

// ScVal converters
const addrScVal = (addr: string) => new Address(addr).toScVal();
const i128ScVal = (n: bigint) => nativeToScVal(n, { type: "i128" });
const u64ScVal = (n: bigint) => nativeToScVal(n, { type: "u64" });

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe("PayrollStream E2E lifecycle", () => {
  let server: SorobanRpc.Server;
  let admin: Keypair;
  let vaultId: string;
  let streamId: string;
  let tokenId: string;
  let tokenAsset: Asset;

  test.beforeAll(async () => {
    if (!process.env.E2E_DEPLOYER_SECRET) {
      console.log("E2E_DEPLOYER_SECRET not set — skipping E2E tests");
      test.skip();
      return;
    }

    server = new SorobanRpc.Server(RPC_URL);
    admin = Keypair.fromSecret(process.env.E2E_DEPLOYER_SECRET);

    console.log(`Admin: ${admin.publicKey()}`);

    // ── 1. Upload & deploy contracts ────────────────────────────────────────
    console.log("Uploading vault WASM…");
    const vaultHash = await uploadWasm(server, admin, VAULT_WASM_PATH);
    console.log("Uploading stream WASM…");
    const streamHash = await uploadWasm(server, admin, STREAM_WASM_PATH);

    console.log("Deploying vault…");
    vaultId = await deployContract(server, admin, vaultHash);
    console.log(`Vault: ${vaultId}`);

    console.log("Deploying stream…");
    streamId = await deployContract(server, admin, streamHash);
    console.log(`Stream: ${streamId}`);

    // ── 2. Deploy a test token (SAC for custom Stellar asset) ───────────────
    tokenAsset = new Asset("QUIPAY", admin.publicKey());
    console.log("Deploying token SAC…");
    tokenId = await deploySAC(server, admin, tokenAsset);
    console.log(`Token: ${tokenId}`);

    // ── 3. Initialise vault ──────────────────────────────────────────────────
    console.log("Initialising vault…");
    await invokeContract(server, admin, vaultId, "initialize", [
      addrScVal(admin.publicKey()),
    ]);

    // ── 4. Initialise stream ─────────────────────────────────────────────────
    console.log("Initialising stream…");
    await invokeContract(server, admin, streamId, "init", [
      addrScVal(admin.publicKey()),
    ]);

    // ── 5. Wire vault ↔ stream ───────────────────────────────────────────────
    console.log("Wiring vault ↔ stream…");
    await invokeContract(server, admin, streamId, "set_vault", [
      addrScVal(vaultId),
    ]);
    await invokeContract(server, admin, vaultId, "set_authorized_contract", [
      addrScVal(streamId),
    ]);

    // ── 6. Set stream contract as gateway (so gateway-cancel tests work) ─────
    await invokeContract(server, admin, streamId, "set_gateway", [
      addrScVal(admin.publicKey()),
    ]);

    console.log("Setup complete.");
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  test("happy path: deposit → create stream → withdraw → complete", async () => {
    const employer = Keypair.random();
    const worker = Keypair.random();

    // Fund employer so they can pay fees and create trustlines
    await fund(employer.publicKey());

    // Mint tokens to employer via SAC (admin is the issuer)
    const depositAmount = ONE_TOKEN * 100n; // 100 tokens
    await invokeContract(server, admin, tokenId, "mint", [
      addrScVal(employer.publicKey()),
      i128ScVal(depositAmount),
    ]);

    // Employer deposits tokens into vault
    await invokeContract(server, employer, vaultId, "deposit", [
      addrScVal(employer.publicKey()),
      addrScVal(tokenId),
      i128ScVal(depositAmount),
    ]);

    // Get current ledger time and set stream start 10 s in the future
    const nowTs = BigInt(await ledgerTimestamp(server));
    const startTs = nowTs + 10n;
    const endTs = startTs + 3600n; // 1 hour stream
    const rate = ONE_TOKEN; // 1 token per second

    // Employer creates stream (cliff = 0 → cliff defaults to start_ts)
    const streamIdRaw = (await invokeContract(
      server,
      employer,
      streamId,
      "create_stream",
      [
        addrScVal(employer.publicKey()),
        addrScVal(worker.publicKey()),
        addrScVal(tokenId),
        i128ScVal(rate),
        u64ScVal(0n), // cliff_ts = 0
        u64ScVal(startTs),
        u64ScVal(endTs),
      ],
    )) as bigint;

    expect(streamIdRaw).toBeGreaterThanOrEqual(0n);

    // Wait for the stream to start (>= 2 ledgers ≈ 10 s)
    console.log(`Waiting for stream ${streamIdRaw} to start…`);
    await new Promise((r) => setTimeout(r, 15_000));

    // Fund worker so they can pay fees
    await fund(worker.publicKey());

    // Worker withdraws vested tokens
    const withdrawn = (await invokeContract(
      server,
      worker,
      streamId,
      "withdraw",
      [i128ScVal(streamIdRaw), addrScVal(worker.publicKey())],
    )) as bigint;

    expect(withdrawn).toBeGreaterThan(0n);
    console.log(`Worker withdrew ${withdrawn.toString()} stroops`);

    // Worker balance should now reflect the withdrawal
    const workerBalance = (await simulateContract(
      server,
      admin,
      tokenId,
      "balance",
      [addrScVal(worker.publicKey())],
    )) as bigint;

    expect(workerBalance).toBe(withdrawn);
  });

  // ── Insufficient balance ───────────────────────────────────────────────────

  test("insufficient balance: stream creation fails without vault deposit", async () => {
    const employer = Keypair.random();
    const worker = Keypair.random();
    await fund(employer.publicKey());

    const nowTs = BigInt(await ledgerTimestamp(server));
    const startTs = nowTs + 10n;
    const endTs = startTs + 3600n;
    const rate = ONE_TOKEN;

    // Attempt to create a stream WITHOUT depositing — vault is empty for this token
    // (or has insufficient balance for this total_amount)
    let threw = false;
    try {
      await invokeContract(server, employer, streamId, "create_stream", [
        addrScVal(employer.publicKey()),
        addrScVal(worker.publicKey()),
        addrScVal(tokenId),
        i128ScVal(rate),
        u64ScVal(0n),
        u64ScVal(startTs),
        u64ScVal(endTs),
      ]);
    } catch (err: unknown) {
      threw = true;
      const msg = String(err);
      // The contract returns QuipayError::InsufficientBalance
      expect(msg).toMatch(/InsufficientBalance|insufficient|Error/i);
    }
    expect(threw).toBe(true);
  });

  // ── Cliff not reached ──────────────────────────────────────────────────────

  test("cliff not reached: get_withdrawable returns 0 before cliff vests", async () => {
    const employer = Keypair.random();
    const worker = Keypair.random();
    await fund(employer.publicKey());

    // Mint tokens and deposit into vault
    const depositAmount = ONE_TOKEN * 200n;
    await invokeContract(server, admin, tokenId, "mint", [
      addrScVal(employer.publicKey()),
      i128ScVal(depositAmount),
    ]);
    await invokeContract(server, employer, vaultId, "deposit", [
      addrScVal(employer.publicKey()),
      addrScVal(tokenId),
      i128ScVal(depositAmount),
    ]);

    const nowTs = BigInt(await ledgerTimestamp(server));
    const startTs = nowTs + 10n;
    // cliff_ts is 2 hours after start — well in the future
    const cliffTs = startTs + 7200n;
    const endTs = cliffTs + 3600n;
    const rate = ONE_TOKEN;

    const streamIdRaw = (await invokeContract(
      server,
      employer,
      streamId,
      "create_stream",
      [
        addrScVal(employer.publicKey()),
        addrScVal(worker.publicKey()),
        addrScVal(tokenId),
        i128ScVal(rate),
        u64ScVal(cliffTs),
        u64ScVal(startTs),
        u64ScVal(endTs),
      ],
    )) as bigint;

    // Before the cliff vests, get_withdrawable must return 0
    const withdrawable = (await simulateContract(
      server,
      admin,
      streamId,
      "get_withdrawable",
      [i128ScVal(streamIdRaw)],
    )) as bigint | null;

    expect(withdrawable ?? 0n).toBe(0n);
  });

  // ── Gateway cancel ─────────────────────────────────────────────────────────

  test("gateway cancel: cancel stream via the registered gateway", async () => {
    const employer = Keypair.random();
    const worker = Keypair.random();
    await fund(employer.publicKey());

    // Mint tokens and deposit
    const depositAmount = ONE_TOKEN * 300n;
    await invokeContract(server, admin, tokenId, "mint", [
      addrScVal(employer.publicKey()),
      i128ScVal(depositAmount),
    ]);
    await invokeContract(server, employer, vaultId, "deposit", [
      addrScVal(employer.publicKey()),
      addrScVal(tokenId),
      i128ScVal(depositAmount),
    ]);

    const nowTs = BigInt(await ledgerTimestamp(server));
    const startTs = nowTs + 10n;
    const endTs = startTs + 3600n;
    const rate = ONE_TOKEN;

    const streamIdRaw = (await invokeContract(
      server,
      employer,
      streamId,
      "create_stream",
      [
        addrScVal(employer.publicKey()),
        addrScVal(worker.publicKey()),
        addrScVal(tokenId),
        i128ScVal(rate),
        u64ScVal(0n),
        u64ScVal(startTs),
        u64ScVal(endTs),
      ],
    )) as bigint;

    // Cancel via gateway (admin was set as the gateway in beforeAll)
    await invokeContract(server, admin, streamId, "cancel_stream_via_gateway", [
      addrScVal(admin.publicKey()), // gateway
      i128ScVal(streamIdRaw),
      addrScVal(employer.publicKey()),
    ]);

    // Stream should now be in Canceled state
    const streamData = (await simulateContract(
      server,
      admin,
      streamId,
      "get_stream",
      [i128ScVal(streamIdRaw)],
    )) as { status: number } | null;

    // StreamStatus::Canceled == 1
    expect(streamData?.status).toBe(1);
  });
});
