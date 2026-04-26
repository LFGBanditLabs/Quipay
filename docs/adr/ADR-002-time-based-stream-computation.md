# ADR-002: Time-Based Stream Computation vs Epoch-Based

## Status

Accepted

## Context

Quipay enables continuous salary streaming where workers accrue earnings every second and can withdraw at any time. The system needs to compute how much a worker has earned ("vested amount") at any given moment.

We evaluated two approaches for calculating vested amounts:

### Option 1: Epoch-Based Accounting

Track discrete payment periods (epochs) and update balances at fixed intervals:

```rust
struct Stream {
    amount_per_epoch: i128,
    last_settled_epoch: u64,
    // ... other fields
}

fn settle_epoch(stream: &mut Stream, current_epoch: u64) {
    let epochs_passed = current_epoch - stream.last_settled_epoch;
    stream.vested_amount += epochs_passed * stream.amount_per_epoch;
    stream.last_settled_epoch = current_epoch;
}
```

**Pros:**

- Predictable gas costs (fixed computation per epoch)
- Simpler mental model (discrete payment periods)
- Easier to implement batch processing

**Cons:**

- Requires periodic settlement transactions (gas costs for employers)
- Workers can only withdraw at epoch boundaries
- Adds complexity for handling partial epochs
- Not truly "continuous" streaming

### Option 2: Time-Based Computation

Calculate vested amount on-demand using elapsed time:

```rust
struct Stream {
    rate: i128,           // tokens per second
    start_ts: u64,
    end_ts: u64,
    cliff_ts: u64,
    withdrawn_amount: i128,
}

fn vested_amount(stream: &Stream, now: u64) -> i128 {
    if now < stream.cliff_ts {
        return 0;
    }
    let elapsed = min(now, stream.end_ts) - stream.start_ts;
    let total_vested = stream.rate * elapsed;
    min(total_vested, stream.total_amount)
}
```

**Pros:**

- True continuous streaming (workers earn every second)
- No settlement transactions required (zero ongoing gas costs)
- Stateless computation (pure function of time)
- Workers can withdraw at any moment
- Simpler contract state (no epoch tracking)

**Cons:**

- Timestamp manipulation risk (mitigated by Stellar's consensus)
- Requires careful handling of time edge cases

## Decision

We will use **time-based stream computation** with per-second accrual rates.

### Implementation Details

Each stream stores:

- `rate`: Tokens earned per second (i128)
- `start_ts`: Stream start timestamp (u64)
- `end_ts`: Stream end timestamp (u64)
- `cliff_ts`: Vesting cliff timestamp (u64, optional)
- `total_amount`: Total tokens to be streamed (i128)
- `withdrawn_amount`: Tokens already withdrawn (i128)

Vested amount calculation:

```rust
pub fn vested_amount(stream: &Stream, now: u64) -> i128 {
    // Before cliff: nothing vested
    if now < stream.cliff_ts {
        return 0;
    }

    // Calculate elapsed time since start
    let effective_time = core::cmp::min(now, stream.end_ts);
    let elapsed = effective_time.saturating_sub(stream.start_ts);

    // Compute vested amount: rate * elapsed_seconds
    let vested = stream.rate
        .checked_mul(i128::from(elapsed as i64))
        .unwrap_or(stream.total_amount);

    // Cap at total stream amount
    core::cmp::min(vested, stream.total_amount)
}
```

Withdrawable amount:

```rust
pub fn get_withdrawable(stream: &Stream, now: u64) -> i128 {
    let vested = vested_amount(stream, now);
    vested.checked_sub(stream.withdrawn_amount).unwrap_or(0)
}
```

### Timestamp Source

We use `env.ledger().timestamp()` which provides:

- Consensus-validated timestamps (cannot be manipulated by individual nodes)
- Monotonically increasing values (guaranteed by Stellar protocol)
- Second-level precision (sufficient for payroll use cases)

## Consequences

### Positive

- **True Continuous Streaming**: Workers earn tokens every second, not just at epoch boundaries.
- **Zero Ongoing Costs**: No settlement transactions required. Employers only pay gas when creating/canceling streams.
- **Instant Withdrawals**: Workers can withdraw at any time without waiting for epoch settlement.
- **Simpler State**: No epoch tracking, settlement queues, or batch processing logic.
- **Predictable Behavior**: Pure function of time makes testing and reasoning easier.
- **Gas Efficiency**: Vested amount calculation is O(1) regardless of stream duration.

### Negative

- **Timestamp Dependency**: System relies on blockchain timestamps being accurate and monotonic (acceptable risk on Stellar).
- **Precision Limits**: Per-second granularity means very small rates may round to zero (mitigated by using stroops/smallest token units).
- **Edge Case Handling**: Must carefully handle start_ts = end_ts, cliff periods, and withdrawal timing.

### Mitigations

- **Timestamp Validation**: Contract validates `start_ts < end_ts` and `cliff_ts <= end_ts` on stream creation.
- **Overflow Protection**: All arithmetic uses checked operations to prevent overflow/underflow.
- **Rate Validation**: Contract requires `rate > 0` to prevent zero-earning streams.
- **Comprehensive Tests**: Unit tests cover edge cases (zero elapsed time, cliff periods, completed streams).

## Examples

### Example 1: Simple Monthly Salary

```
Salary: 3,000 USDC/month (30 days)
Rate: 3000 / (30 * 86400) = 0.001157407 USDC/second

After 15 days:
  elapsed = 15 * 86400 = 1,296,000 seconds
  vested = 0.001157407 * 1,296,000 = 1,500 USDC
```

### Example 2: Cliff Vesting

```
Salary: 12,000 USDC/year
Cliff: 90 days
Rate: 12000 / (365 * 86400) = 0.000380517 USDC/second

After 60 days: vested = 0 (before cliff)
After 90 days: vested = 0.000380517 * (90 * 86400) = 2,958.90 USDC
After 180 days: vested = 0.000380517 * (180 * 86400) = 5,917.81 USDC
```

## Related Decisions

- [ADR-001: Vault-Stream Separation Pattern](./ADR-001-vault-stream-separation.md) - Explains contract architecture
- [ADR-004: Backend Monitoring Architecture](./ADR-004-backend-monitoring-architecture.md) - Uses time-based calculations for runway projections

## References

- `contracts/payroll_stream/src/lib.rs` - Stream implementation with `vested_amount()` function
- `contracts/payroll_stream/src/test.rs` - Comprehensive time-based calculation tests
- [Stellar Ledger Timestamps](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/ledgers) - Timestamp consensus mechanism
