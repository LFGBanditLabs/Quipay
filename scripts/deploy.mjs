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
  console.log("Starting deployment...");

  if (!SorobanRpc) {
    throw new Error("SorobanRpc is undefined!");
  }

  const server = new SorobanRpc.Server(RPC_URL);

  // 1. Generate and fund a new keypair
  const keypair = Keypair.random();
  console.log(`Generated keypair: ${keypair.publicKey()}`);
  console.log(`Secret: ${keypair.secret()}`);

  console.log("Funding account...");
  const response = await fetch(`${FRIEND_BOT_URL}?addr=${keypair.publicKey()}`);
  if (!response.ok) {
    throw new Error(`Failed to fund account: ${response.statusText}`);
  }
  console.log("Account funded.");

  // Helper to submit transaction
  async function submitTx(tx) {
    tx.sign(keypair);
    let sendResp = await server.sendTransaction(tx);
    if (sendResp.status !== "PENDING") {
      throw new Error(`Transaction failed: ${JSON.stringify(sendResp)}`);
    }

    let statusResp = await server.getTransaction(sendResp.hash);
    while (
      statusResp.status === "NOT_FOUND" ||
      statusResp.status === "PENDING"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      statusResp = await server.getTransaction(sendResp.hash);
    }

    if (statusResp.status === "SUCCESS") {
      return statusResp;
    } else {
      throw new Error(`Transaction failed: ${JSON.stringify(statusResp)}`);
    }
  }

  // Helper to upload contract code
  async function uploadContract(wasmPath) {
    console.log(`Uploading ${wasmPath}...`);
    const wasm = await readFile(wasmPath);

    const account = await server.getAccount(keypair.publicKey());
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

    // Prepare transaction to get footprint
    const preparedTx = await server.prepareTransaction(tx);

    // Sign and submit
    const result = await submitTx(preparedTx);

    if (!result.returnValue) {
      throw new Error("No return value from upload");
    }

    // Parse ScVal to native
    const hash = scValToNative(result.returnValue);
    // hash should be a Buffer or Uint8Array.
    console.log(`Uploaded. Hash: ${hash.toString("hex")}`);
    return hash;
  }

  // Helper to create contract
  async function createContract(wasmHash) {
    console.log(
      `Creating contract instance for hash ${wasmHash.toString("hex")}...`,
    );
    const account = await server.getAccount(keypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "10000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.createCustomContract({
          wasmHash,
          address: new Address(keypair.publicKey()), // Deployer address
          salt: Buffer.alloc(32).fill(Math.floor(Math.random() * 256)), // Random salt
        }),
      )
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    const result = await submitTx(preparedTx);

    // Return value is the contract address (Address)
    const address = scValToNative(result.returnValue);
    console.log(`Created contract at: ${address}`);
    return address;
  }

  // Helper to invoke contract
  async function invokeContract(contractId, method, args) {
    console.log(`Invoking ${method} on ${contractId}...`);
    const account = await server.getAccount(keypair.publicKey());
    const contract = new Contract(contractId);

    const tx = new TransactionBuilder(account, {
      fee: "10000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    const result = await submitTx(preparedTx);
    console.log(`Invoked ${method}.`);
    return result;
  }

  // 2. Upload and deploy PayrollVault
  const vaultWasmHash = await uploadContract(
    "target/wasm32-unknown-unknown/release/payroll_vault.wasm",
  );
  const vaultId = await createContract(vaultWasmHash);

  // 3. Initialize PayrollVault
  // fn initialize(e: Env, admin: Address)
  await invokeContract(vaultId, "initialize", [
    new Address(keypair.publicKey()).toScVal(),
  ]);

  // 4. Upload and deploy PayrollStream
  const streamWasmHash = await uploadContract(
    "target/wasm32-unknown-unknown/release/payroll_stream.wasm",
  );
  const streamId = await createContract(streamWasmHash);

  // 5. Initialize PayrollStream
  // fn init(env: Env, admin: Address)
  await invokeContract(streamId, "init", [
    new Address(keypair.publicKey()).toScVal(),
  ]);

  // 6. Set Vault in PayrollStream
  // fn set_vault(env: Env, vault: Address)
  await invokeContract(streamId, "set_vault", [new Address(vaultId).toScVal()]);

  // 7. Authorize PayrollStream in PayrollVault
  // fn set_authorized_contract(e: Env, contract: Address)
  await invokeContract(vaultId, "set_authorized_contract", [
    new Address(streamId).toScVal(),
  ]);

  console.log("---------------------------------------------------");
  console.log("Deployment Complete!");
  console.log(`Network: Testnet`);
  console.log(`Admin Account: ${keypair.publicKey()}`);
  console.log(`Admin Secret: ${keypair.secret()}`);
  console.log(`PayrollVault ID: ${vaultId}`);
  console.log(`PayrollStream ID: ${streamId}`);
  console.log("---------------------------------------------------");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
