import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sdk = require("@stellar/stellar-sdk");
const {
  Keypair,
  TransactionBuilder,
  Networks,
  xdr,
  Address,
  Contract,
  Operation,
  nativeToScVal,
  scValToNative,
} = sdk;
const SorobanRpc = sdk.rpc;
import { readFile } from "fs/promises";

const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const RPC_URL = "https://soroban-testnet.stellar.org";
const FRIEND_BOT_URL = "https://friendbot.stellar.org";

async function main() {
  console.log("Starting AutomationGateway deployment...");

  const server = new SorobanRpc.Server(RPC_URL);

  // 1. Generate and fund a new keypair
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  console.log(`Generated keypair: ${publicKey}`);
  console.log(`Secret: ${keypair.secret()}`);

  console.log("Funding account...");
  const response = await fetch(`${FRIEND_BOT_URL}?addr=${publicKey}`);
  if (!response.ok) {
    throw new Error(`Failed to fund account: ${response.statusText}`);
  }
  console.log("Account funded.");

  // Helper to submit transaction
  async function submitTx(tx) {
    tx.sign(keypair);
    // Send transaction
    let sendResp = await server.sendTransaction(tx);

    // Check initial response status
    if (sendResp.status === "ERROR") {
      console.error(
        "Transaction Submission Error:",
        JSON.stringify(sendResp, null, 2),
      );
      throw new Error(
        `Transaction failed at submission: ${sendResp.errorResultXdr}`,
      );
    }

    // Poll for status
    let statusResp = await server.getTransaction(sendResp.hash);
    while (statusResp.status === "NOT_FOUND") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      statusResp = await server.getTransaction(sendResp.hash);
    }

    if (statusResp.status === "SUCCESS") {
      return statusResp;
    } else {
      console.error(
        "Transaction Execution Error:",
        JSON.stringify(statusResp, null, 2),
      );
      throw new Error(`Transaction failed: ${statusResp.status}`);
    }
  }

  // Helper to upload contract code
  async function uploadContract(wasmPath) {
    console.log(`Uploading ${wasmPath}...`);
    const wasm = await readFile(wasmPath);

    let account = await server.getAccount(publicKey);
    const tx = new TransactionBuilder(account, {
      fee: "10000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.uploadContractWasm({
          wasm,
        }),
      )
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    const result = await submitTx(preparedTx);

    if (!result.returnValue) {
      throw new Error("No return value from upload");
    }

    const hash = scValToNative(result.returnValue);
    console.log(`Uploaded. Hash: ${hash.toString("hex")}`);
    return hash;
  }

  // Helper to create contract instance
  async function createContract(wasmHash) {
    console.log(
      `Creating contract instance for hash ${wasmHash.toString("hex")}...`,
    );
    let account = await server.getAccount(publicKey);
    const tx = new TransactionBuilder(account, {
      fee: "10000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.createCustomContract({
          wasmHash: wasmHash,
          address: new Address(publicKey),
        }),
      )
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    const result = await submitTx(preparedTx);

    if (!result.returnValue) {
      throw new Error("No return value from create");
    }

    const address = scValToNative(result.returnValue);
    // address should be a string (Address object in native representation often string)
    // Actually scValToNative for Address returns a string "C..."
    console.log(`Created contract at: ${address.toString()}`);
    return address.toString();
  }

  // Helper to invoke init
  async function invokeInit(contractId) {
    console.log(`Invoking init on ${contractId}...`);
    let account = await server.getAccount(publicKey);
    const contract = new Contract(contractId);

    const tx = new TransactionBuilder(account, {
      fee: "10000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("init", new Address(publicKey).toScVal()))
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    await submitTx(preparedTx);
    console.log("Invoked init.");
  }

  // Deploy AutomationGateway
  const gatewayWasmHash = await uploadContract(
    "target/wasm32-unknown-unknown/release/automation_gateway.wasm",
  );
  const gatewayId = await createContract(gatewayWasmHash);
  await invokeInit(gatewayId);

  console.log("---------------------------------------------------");
  console.log("Deployment Complete!");
  console.log("Network: Testnet");
  console.log(`Admin Account: ${publicKey}`);
  console.log(`Admin Secret: ${keypair.secret()}`);
  console.log(`AutomationGateway ID: ${gatewayId}`);
  console.log("---------------------------------------------------");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
