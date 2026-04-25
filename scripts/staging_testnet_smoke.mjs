import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sdk = require("@stellar/stellar-sdk");

const {
  Keypair,
  TransactionBuilder,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} = sdk;
const SorobanRpc = sdk.rpc;

const RPC_URL =
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";

const VAULT_ID = process.env.PAYROLL_VAULT_ID;
const STREAM_ID = process.env.PAYROLL_STREAM_ID;
const ADMIN_SECRET = process.env.TESTNET_DEPLOYER_SECRET;
const TOKEN_ID = process.env.TESTNET_TOKEN_CONTRACT_ID;
const STAGING_BACKEND_URL = process.env.STAGING_BACKEND_URL;

const MAX_RUNTIME_MS = 175_000;
const STREAM_DURATION_SECONDS = 70;
const ACCRUAL_WAIT_MS = 30_000;
const VAULT_DEPOSIT_AMOUNT = 8_000_000n;
const STREAM_RATE = 100_000n;

function requiredEnv(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function sanitizeUrl(value) {
  return value.replace(/\/+$/, "");
}

function toBigInt(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  throw new Error(`Cannot convert value to bigint: ${String(value)}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkHttp200(url, label) {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${label} returned status ${response.status}`);
  }
  console.log(`OK ${label} (${response.status})`);
}

async function main() {
  requiredEnv("PAYROLL_VAULT_ID", VAULT_ID);
  requiredEnv("PAYROLL_STREAM_ID", STREAM_ID);
  requiredEnv("TESTNET_DEPLOYER_SECRET", ADMIN_SECRET);
  requiredEnv("TESTNET_TOKEN_CONTRACT_ID", TOKEN_ID);
  requiredEnv("STAGING_BACKEND_URL", STAGING_BACKEND_URL);

  console.log("Starting staging testnet smoke test...");
  const startedAt = Date.now();

  const server = new SorobanRpc.Server(RPC_URL);
  const adminKey = Keypair.fromSecret(ADMIN_SECRET);
  const adminAddress = adminKey.publicKey();

  const ensureWithinRuntime = () => {
    const elapsed = Date.now() - startedAt;
    if (elapsed > MAX_RUNTIME_MS) {
      throw new Error(
        `Smoke test exceeded ${MAX_RUNTIME_MS}ms runtime budget (elapsed=${elapsed}ms)`,
      );
    }
  };

  const baseUrl = sanitizeUrl(STAGING_BACKEND_URL.trim());
  await checkHttp200(`${baseUrl}/health`, "backend /health");
  await checkHttp200(`${baseUrl}/stellar/health`, "backend /stellar/health");

  await server.getAccount(adminAddress);

  const submitInvoke = async ({ contractId, method, args, signer }) => {
    ensureWithinRuntime();

    const account = await server.getAccount(signer.publicKey());
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(signer);

    const sent = await server.sendTransaction(prepared);
    if (sent.status !== "PENDING") {
      throw new Error(
        `Transaction submission failed for ${method}: ${JSON.stringify(sent)}`,
      );
    }

    let result = await server.getTransaction(sent.hash);
    while (result.status === "NOT_FOUND" || result.status === "PENDING") {
      await sleep(1_000);
      ensureWithinRuntime();
      result = await server.getTransaction(sent.hash);
    }

    if (result.status !== "SUCCESS") {
      throw new Error(
        `Transaction failed for ${method}: ${JSON.stringify(result)}`,
      );
    }

    return result.returnValue ? scValToNative(result.returnValue) : null;
  };

  console.log("Configuring smoke-friendly stream constraints...");
  await submitInvoke({
    contractId: STREAM_ID,
    method: "set_min_stream_duration",
    args: [nativeToScVal(30n, { type: "u64" })],
    signer: adminKey,
  });

  await submitInvoke({
    contractId: STREAM_ID,
    method: "set_withdrawal_cooldown",
    args: [nativeToScVal(0n, { type: "u64" })],
    signer: adminKey,
  });

  console.log("Depositing funds into vault...");
  await submitInvoke({
    contractId: VAULT_ID,
    method: "deposit",
    args: [
      new Address(adminAddress).toScVal(),
      new Address(TOKEN_ID).toScVal(),
      nativeToScVal(VAULT_DEPOSIT_AMOUNT, { type: "i128" }),
    ],
    signer: adminKey,
  });

  ensureWithinRuntime();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const startTs = now + 5n;
  const endTs = startTs + BigInt(STREAM_DURATION_SECONDS);

  console.log("Creating stream on testnet...");
  const streamId = await submitInvoke({
    contractId: STREAM_ID,
    method: "create_stream",
    args: [
      new Address(adminAddress).toScVal(),
      new Address(adminAddress).toScVal(),
      new Address(TOKEN_ID).toScVal(),
      nativeToScVal(STREAM_RATE, { type: "i128" }),
      nativeToScVal(startTs, { type: "u64" }),
      nativeToScVal(startTs, { type: "u64" }),
      nativeToScVal(endTs, { type: "u64" }),
      xdr.ScVal.scvVoid(),
      xdr.ScVal.scvVoid(),
    ],
    signer: adminKey,
  });

  const streamIdBigInt = toBigInt(streamId);
  console.log(`Created stream id: ${streamIdBigInt}`);

  console.log("Waiting for stream accrual...");
  await sleep(ACCRUAL_WAIT_MS);
  ensureWithinRuntime();

  console.log("Withdrawing accrued amount...");
  const withdrawn = await submitInvoke({
    contractId: STREAM_ID,
    method: "withdraw",
    args: [
      nativeToScVal(streamIdBigInt, { type: "u64" }),
      new Address(adminAddress).toScVal(),
    ],
    signer: adminKey,
  });

  const withdrawnBigInt = toBigInt(withdrawn ?? 0n);
  if (withdrawnBigInt <= 0n) {
    throw new Error(
      `Expected positive withdrawn amount, got ${withdrawnBigInt}`,
    );
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`Withdrawn amount: ${withdrawnBigInt}`);
  console.log(`Smoke test succeeded in ${elapsedMs}ms.`);
}

Promise.race([
  main(),
  new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("Smoke test timed out before completion."));
    }, MAX_RUNTIME_MS + 1_000);
  }),
])
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
