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

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

// Contract IDs from deployment
const VAULT_ID = "CCVIZ7256UFV2TKVTQ6ANU6S75IFFSXMLJOXOXW5QZOUXBTWDIRXGEUJ";
const STREAM_ID = "CAQ5IXSFW74FXUZ6M7OURK36JFEGTJ5NC5GITPRSZBSY2FWOTRVAGVPV";

// Admin key (public is enough for view, but we need to sign tx for invocation even if it's a view?
// No, for simulateTransaction we don't need to sign if we don't submit?
// Actually, to call a contract function we usually construct a transaction and simulate it.)
// We can use a random keypair for simulation source.
const keypair = Keypair.random();

async function main() {
  console.log("Starting smoke tests...");
  const server = new SorobanRpc.Server(RPC_URL);

  async function callView(contractId, method, args = []) {
    console.log(`Calling ${method} on ${contractId}...`);
    const account = await server
      .getAccount(keypair.publicKey())
      .catch(() => null);

    // If account doesn't exist (it's random), we can still simulate?
    // Usually we need a valid sequence number.
    // Let's use the friendbot to fund it first to be safe, or use the admin key from deployment.
    // Using admin key from deployment output (replace with your secret)
    const adminKey = Keypair.fromSecret(
      process.env.ADMIN_SECRET ||
        "SCHCP7RX4FWWLZ5JNUOHTSWSQ5S63DYMWHC6RBNLWZZRMSLKQJ22JZNX",
    );
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
