import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sdk = require("@stellar/stellar-sdk");
const {
  Keypair,
  TransactionBuilder,
  Networks,
  Address,
  Contract,
  scValToNative,
} = sdk;
const SorobanRpc = sdk.rpc;

const RPC_URL =
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";

// Contract IDs from deployment — set via environment variables
const VAULT_ID = process.env.VAULT_CONTRACT_ID;
const STREAM_ID = process.env.STREAM_CONTRACT_ID;

if (!VAULT_ID || !STREAM_ID) {
  console.error(
    "Missing required env vars: VAULT_CONTRACT_ID, STREAM_CONTRACT_ID",
  );
  process.exit(1);
}

// Admin key for simulation — must be provided via ADMIN_SECRET env var
if (!process.env.ADMIN_SECRET) {
  console.error("Missing required env var: ADMIN_SECRET");
  process.exit(1);
}
const adminKey = Keypair.fromSecret(process.env.ADMIN_SECRET);

async function main() {
  console.log("Starting smoke tests...");
  const server = new SorobanRpc.Server(RPC_URL);

  async function callView(contractId, method, args = []) {
    console.log(`Calling ${method} on ${contractId}...`);
    const adminAccount = await server.getAccount(adminKey.publicKey());

    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(adminAccount, {
      fee: "10000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const simulated = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      throw new Error(`Simulation failed: ${simulated.error}`);
    }

    if (!simulated.result) {
      throw new Error("No result from simulation");
    }

    // Parse result
    const result = scValToNative(simulated.result.retval);
    return result;
  }

  // 1. Check Vault Version
  try {
    const version = await callView(VAULT_ID, "get_version");
    console.log("Vault Version:", version);
    if (version.major !== 1) throw new Error("Unexpected version");
  } catch (e) {
    console.error("Vault check failed:", e);
  }

  // 2. Check Stream Paused Status
  try {
    const isPaused = await callView(STREAM_ID, "is_paused");
    console.log("Stream Paused:", isPaused);
    if (isPaused !== false) throw new Error("Stream should not be paused");
  } catch (e) {
    console.error("Stream check failed:", e);
  }

  console.log("Smoke tests complete.");
}

main().catch(console.error);
