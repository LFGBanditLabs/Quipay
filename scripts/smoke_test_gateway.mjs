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
const GATEWAY_ID = "CDYO5HXZ7K5XP2U52DW5PCYRTG6NVXDG525ZFYVRGOKD6BRERM44AVRO";

// Admin key for simulation
// Secret: SD5WWX22AS4JHL7O6Z2XVUYTC52JTMHHAY3PUDNYSUBGIRZRZUB4GSYH
const adminKey = Keypair.fromSecret(
  process.env.ADMIN_SECRET ||
    "SD5WWX22AS4JHL7O6Z2XVUYTC52JTMHHAY3PUDNYSUBGIRZRZUB4GSYH",
);

async function main() {
  console.log("Starting AutomationGateway smoke tests...");
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

  // 1. Check Admin
  try {
    const admin = await callView(GATEWAY_ID, "get_admin");
    console.log("Gateway Admin:", admin);
    if (admin !== adminKey.publicKey()) throw new Error("Unexpected admin");
  } catch (e) {
    console.error("Gateway check failed:", e);
    process.exit(1);
  }

  console.log("Smoke tests complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
