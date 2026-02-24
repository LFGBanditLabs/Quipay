# Payroll Stream Contract

The Payroll Stream contract is the core execution engine of Quipay. It handles the creation of payment streams that vest over time.

## Key Methods

### `init`

Initializes the contract with an admin address.

```rust
pub fn init(env: Env, admin: Address) -> Result<(), QuipayError>
```

### `create_stream`

Creates a new payroll stream for a worker.

```rust
pub fn create_stream(
    env: Env,
    employer: Address,
    worker: Address,
    token: Address,
    rate: i128,
    cliff_ts: u64,
    start_ts: u64,
    end_ts: u64,
) -> u64
```

- **employer**: Address of the entity funding the stream. Requires authentication.
- **worker**: Address of the recipient.
- **token**: Address of the Soroban token to be streamed.
- **rate**: Amount of token streamed per second.
- **cliff_ts**: Timestamp before which no funds can be withdrawn.
- **start_ts**: Timestamp when the stream begins.
- **end_ts**: Timestamp when the stream ends.

### `withdraw`

Withdraws vested funds from a stream. Usually called by the worker.

```rust
pub fn withdraw(env: Env, stream_id: u64, worker: Address) -> i128
```

### `cancel_stream`

Cancels an active stream. Any unvested funds are returned to the employer's liability allocation in the vault.

```rust
pub fn cancel_stream(env: Env, stream_id: u64, employer: Address)
```

## JS/TS Example

Using the Quipay JS SDK (or direct Soroban RPC):

```typescript
import { Contract, networks, address } from "@stellar/stellar-sdk";

const payrollStream = new Contract("CONTRACT_ID");

// Create a stream
async function createStream() {
  const tx = await payrollStream.call("create_stream", {
    employer: "GB...",
    worker: "GD...",
    token: "CA...",
    rate: 1000000n, // 1 unit per second (assuming 7 decimals)
    cliff_ts: 0n,
    start_ts: BigInt(Math.floor(Date.now() / 1000) + 60),
    end_ts: BigInt(Math.floor(Date.now() / 1000) + 3600),
  });
  // Sign and submit tx...
}
```

_Note: The arguments must match the order in the Rust contract implementation._
