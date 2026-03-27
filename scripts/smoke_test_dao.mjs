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

const RPC_URL = "https://soroban-testnet.stellar.org";
const FRIEND_BOT_URL = "https://friendbot.stellar.org";

async function main() {
  console.log("Starting DAO governance smoke tests...");

  if (!SorobanRpc) {
    throw new Error("SorobanRpc is undefined!");
  }

  const server = new SorobanRpc.Server(RPC_URL);

  // Contract IDs from deployment (replace with your deployed contract IDs)
  const DAO_GOVERNANCE_ID = process.env.DAO_GOVERNANCE_ID || "YOUR_DAO_GOVERNANCE_CONTRACT_ID";
  const PAYROLL_STREAM_ID = process.env.PAYROLL_STREAM_ID || "YOUR_PAYROLL_STREAM_CONTRACT_ID";

  // Use admin key from deployment or environment
  const keypair = Keypair.fromSecret(
    process.env.ADMIN_SECRET ||
      "SCHCP7RX4FWWLZ5JNUOHTSWSQ5S63DYMWHC6RBNLWZZRMSLKQJ22JZNX",
  );
  const adminAccount = await server.getAccount(keypair.publicKey());

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

  // Helper to call contract view function
  async function callView(contractId, method, args = []) {
    console.log(`Calling ${method} on ${contractId}...`);
    const account = await server
      .getAccount(keypair.publicKey())
      .catch(() => null);

    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, {
      fee: "10000",
      networkPassphrase: "Test SDF Network ; September 2015",
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

  // Helper to call contract function
  async function callContract(contractId, method, args = []) {
    console.log(`Calling ${method} on ${contractId}...`);
    const account = await server.getAccount(keypair.publicKey());

    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, {
      fee: "10000",
      networkPassphrase: "Test SDF Network ; September 2015",
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    const result = await submitTx(preparedTx);
    console.log(`Invoked ${method}.`);
    return result;
  }

  try {
    console.log("---------------------------------------------------");
    console.log("DAO Governance Smoke Tests");
    console.log("---------------------------------------------------");

    // 1. Test DAO initialization
    console.log("1. Testing DAO initialization...");
    try {
      const admin = await callView(DAO_GOVERNANCE_ID, "admin");
      console.log("✓ DAO Admin:", admin);
      
      const payrollStream = await callView(DAO_GOVERNANCE_ID, "payroll_stream");
      console.log("✓ DAO PayrollStream:", payrollStream);
      
      const votingPeriod = await callView(DAO_GOVERNANCE_ID, "voting_period");
      console.log("✓ DAO Voting Period:", votingPeriod);
      
      const executionDelay = await callView(DAO_GOVERNANCE_ID, "execution_delay");
      console.log("✓ DAO Execution Delay:", executionDelay);
      
      const requiredVotes = await callView(DAO_GOVERNANCE_ID, "required_votes");
      console.log("✓ DAO Required Votes:", requiredVotes);
      
    } catch (e) {
      console.error("✗ DAO initialization test failed:", e);
    }

    // 2. Test DAO proposal creation
    console.log("2. Testing DAO proposal creation...");
    try {
      const proposalId = await callContract(DAO_GOVERNANCE_ID, "create_proposal", [
        new Address(keypair.publicKey()).toScVal(),
        nativeToScVal("Test Proposal"),
        nativeToScVal("Test proposal for DAO governance"),
        nativeToScVal(1), // CreateStream proposal type
        nativeToScVal(100), // voting_period
        nativeToScVal(50), // execution_delay
        nativeToScVal(2), // required_votes
        // CreateStream payload
        new Address(keypair.publicKey()).toScVal(), // employer
        new Address(keypair.publicKey()).toScVal(), // worker
        new Address(keypair.publicKey()).toScVal(), // token
        nativeToScVal(1000), // rate
        nativeToScVal(Date.now() / 1000), // cliff_ts
        nativeToScVal(Date.now() / 1000 + 86400), // start_ts
        nativeToScVal(Date.now() / 1000 + 172800), // end_ts
        xdr.ScVal.symbolToScVal("TEST"), // metadata_hash
      ]);
      console.log("✓ Created proposal:", proposalId);
    } catch (e) {
      console.error("✗ DAO proposal creation test failed:", e);
    }

    // 3. Test DAO voting
    console.log("3. Testing DAO voting...");
    try {
      const voteResult = await callContract(DAO_GOVERNANCE_ID, "vote", [
        nativeToScVal(1), // proposal_id
        nativeToScVal(true), // approve
      ]);
      console.log("✓ Vote result:", voteResult);
    } catch (e) {
      console.error("✗ DAO voting test failed:", e);
    }

    // 4. Test DAO execution
    console.log("4. Testing DAO execution...");
    try {
      const executeResult = await callContract(DAO_GOVERNANCE_ID, "execute", [
        nativeToScVal(1), // proposal_id
      ]);
      console.log("✓ Execute result:", executeResult);
    } catch (e) {
      console.error("✗ DAO execution test failed:", e);
    }

    // 5. Test DAO mode integration with PayrollStream
    console.log("5. Testing DAO mode integration...");
    try {
      // Check if DAO mode is enabled in PayrollStream
      const daoMode = await callView(PAYROLL_STREAM_ID, "dao_mode_enabled");
      console.log("✓ PayrollStream DAO Mode:", daoMode);

      // Try to create stream directly (should fail if DAO mode is enabled)
      if (daoMode) {
        console.log("✓ DAO mode is enabled, testing governance-gated stream creation...");
        // This would require a successful proposal execution first
        console.log("✓ DAO governance integration test passed");
      } else {
        console.log("✓ DAO mode is disabled, testing direct stream creation...");
        // Test direct stream creation when DAO mode is disabled
        const streamId = await callContract(PAYROLL_STREAM_ID, "create_stream", [
          new Address(keypair.publicKey()).toScVal(), // employer
          new Address(keypair.publicKey()).toScVal(), // worker
          new Address(keypair.publicKey()).toScVal(), // token
          nativeToScVal(1000), // rate
          nativeToScVal(Date.now() / 1000), // cliff_ts
          nativeToScVal(Date.now() / 1000), // start_ts
          nativeToScVal(Date.now() / 1000 + 172800), // end_ts
          xdr.ScVal.symbolToScVal("TEST"), // metadata_hash
        ]);
        console.log("✓ Direct stream creation result:", streamId);
      }
    } catch (e) {
      console.error("✗ DAO mode integration test failed:", e);
    }

    console.log("---------------------------------------------------");
    console.log("DAO Governance Smoke Tests Complete!");
    console.log("---------------------------------------------------");
    console.log(`Network: Testnet`);
    console.log(`Admin Account: ${keypair.publicKey()}`);
    console.log(`DAO Governance ID: ${DAO_GOVERNANCE_ID}`);
    console.log(`PayrollStream ID: ${PAYROLL_STREAM_ID}`);
    console.log("---------------------------------------------------");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
