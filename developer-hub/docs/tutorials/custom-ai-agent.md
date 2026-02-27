# How to build a custom AI agent

AI agents in Quipay are off-chain services authorized to execute on-chain payroll actions. Typical tasks include triggering scheduled payroll, rebalancing treasury funds, or alerting employers about low balances.

## Prerequisites

- A Stellar account for the agent.
- Access to a Soroban RPC node.
- Admin access to the Quipay `AutomationGateway` contract (to register your agent).

## Step 1: Set up the Agent Account

Create a new Stellar account that will be used by your agent. You will need the secret key to sign transactions.

```typescript
import { Keypair } from "@stellar/stellar-sdk";

const agentKeypair = Keypair.random();
console.log("PublicKey:", agentKeypair.publicKey());
console.log("SecretKey:", agentKeypair.secret());
```

## Step 2: Register the Agent

The Quipay administrator must register your agent's public key in the `AutomationGateway` contract.

```rust
// Authorized via admin
automation_gateway.register_agent(
    agent_address,
    vec![Permission::ExecutePayroll, Permission::ManageTreasury]
);
```

## Step 3: Implement Agent Logic

Your agent should monitor the state of the protocol and take action when necessary. Here is a simplified Node.js example using the Stellar SDK.

```typescript
import {
  Contract,
  Keypair,
  networks,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const AGENT_SECRET = "S...";
const agentKeypair = Keypair.fromSecret(AGENT_SECRET);
const GATEWAY_ID = "CA...";

async function triggerAutomation(action: number, data: any) {
  const gateway = new Contract(GATEWAY_ID);

  // Build the transaction
  const tx = await gateway.call("execute_automation", {
    agent: agentKeypair.publicKey(),
    action: action,
    data: data, // encoded as Bytes
  });

  // Sign and submit...
}

// Example: Check treasury every hour
setInterval(async () => {
  const balance = await getTreasuryBalance();
  const liability = await getTotalLiability();

  if (balance < liability * 1.1) {
    console.warn("Treasury low! Triggering optimization...");
    await triggerAutomation(2, Buffer.from([])); // ManageTreasury
  }
}, 3600000);
```

## AI-Driven Automation

For a truly autonomous experience, you can integrate your agent with Large Language Models (LLMs) like OpenAI's GPT-4 or Anthropic's Claude.

### Use Case: Natural Language Payroll

1. **User request**: "Run payroll for the engineering team for February."
2. **AI Agent**:
   - Fetches "engineering team" list from `WorkforceRegistry`.
   - Checks `PayrollVault` for solvency.
   - Constructs `create_stream` transactions for each worker.
   - Sends the prepared XDR to the employer for approval/signature.

### Example: Tool Calling with Vercel AI SDK

You can define "tools" that your AI agent can call to interact with the Quipay protocol.

```typescript
import { tool } from "ai";
import { z } from "zod";

export const quipayTools = {
  createPayrollStream: tool({
    description: "Creates a new payroll stream for a worker",
    parameters: z.object({
      worker: z.string().describe("The Stellar address of the worker"),
      rate: z.number().describe("The amount to stream per second"),
      durationDays: z.number().describe("How many days the stream should last"),
    }),
    execute: async ({ worker, rate, durationDays }) => {
      // Logic to build and return XDR or trigger AutomationGateway
      return { status: "success", message: "Stream transaction prepared" };
    },
  }),
};
```

## Security Best Practices

1. **Least Privilege**: Only grant the agent the permissions it absolutely needs.
2. **Fund the Agent**: Ensure the agent has enough XLM to pay for transaction fees.
3. **Secret Management**: Use Environment Variables or a Vault to store the agent's secret key. Never hardcode it.
4. **Monitoring**: Log all agent actions and set up alerts for transaction failures.
