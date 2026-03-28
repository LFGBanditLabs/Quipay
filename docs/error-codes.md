# Quipay Error Codes

All Quipay smart contracts share a single error enum defined in `contracts/common/src/error.rs`. Errors are represented as `u32` values and returned as Soroban contract errors (`soroban_sdk::Error`).

## Reading an error on-chain

When a Soroban invocation fails with a contract error, the numeric code is available in the simulation or transaction result. Match the code against the table below to understand the cause and apply the correct recovery action.

```rust
// Rust: pattern match on contract result
match result {
    Err(QuipayError::InsufficientBalance) => { /* ... */ }
    _ => {}
}
```

```ts
// TypeScript: inspect the numeric code from the RPC response
if (error.code === 1006) {
  /* InsufficientBalance */
}
```

---

## Error Table

| Code                   | Name                      | Description                                                              | Recovery Action                                                         |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Initialisation**     |                           |                                                                          |
| 1001                   | `AlreadyInitialized`      | Contract `initialize()` was called a second time.                        | Do not call `initialize` on a contract that is already set up.          |
| 1002                   | `NotInitialized`          | An operation was attempted before `initialize()` was called.             | Call `initialize` first, then retry.                                    |
| **Authorization**      |                           |                                                                          |
| 1003                   | `Unauthorized`            | Caller did not pass `require_auth` for the required account.             | Ensure the transaction is signed by the correct key.                    |
| 1004                   | `InsufficientPermissions` | Caller is authenticated but lacks the required role (e.g. not an admin). | Use an account with the appropriate role.                               |
| **Funds & Balances**   |                           |                                                                          |
| 1005                   | `InvalidAmount`           | Amount was zero or negative.                                             | Send a strictly positive amount.                                        |
| 1006                   | `InsufficientBalance`     | Requested amount exceeds available funds.                                | Check balance first; reduce the amount or top up the vault.             |
| **Protocol State**     |                           |                                                                          |
| 1007                   | `ProtocolPaused`          | The protocol is paused by an admin.                                      | Wait for the admin to unpause; check governance channels.               |
| 1008                   | `VersionNotSet`           | Contract version storage entry is missing.                               | Re-deploy or upgrade the contract through the admin flow.               |
| 1009                   | `StorageError`            | A Soroban storage read or write failed unexpectedly.                     | Retry the transaction; if persistent, report as a bug.                  |
| **Input Validation**   |                           |                                                                          |
| 1010                   | `InvalidAddress`          | A provided address is not a valid Stellar account or contract ID.        | Verify the address with `stellar-cli` before submitting.                |
| 1014                   | `InvalidToken`            | The token address is not recognised or not allowlisted.                  | Use a supported token (USDC, XLM) as documented in `docs/CONTRACTS.md`. |
| 1021                   | `InvalidTimeRange`        | `end_ts` is not strictly after `start_ts`.                               | Ensure start and end timestamps are ordered correctly.                  |
| 1022                   | `InvalidCliff`            | `cliff_ts` is outside the `[start_ts, end_ts]` range.                    | Keep the cliff timestamp within the stream's active window.             |
| 1023                   | `StartTimeInPast`         | `start_ts` is earlier than the current ledger close time.                | Use a start timestamp in the future (or the current ledger).            |
| **Streams**            |                           |                                                                          |
| 1011                   | `StreamNotFound`          | No stream exists for the given stream ID.                                | Confirm the stream ID with `get_stream_by_id` before operating on it.   |
| 1012                   | `StreamExpired`           | Stream's end time has passed and it can no longer be modified.           | No recovery; the stream has ended naturally.                            |
| 1017                   | `NotWorker`               | Caller is not the designated worker for this stream.                     | Use the worker's key to sign withdrawal transactions.                   |
| 1018                   | `StreamClosed`            | Stream was already cancelled or completed.                               | Check stream status before calling cancel or withdraw.                  |
| 1019                   | `NotEmployer`             | Caller is not the employer who created this stream.                      | Use the employer's key to sign stream management operations.            |
| 1020                   | `StreamNotClosed`         | An operation requires the stream to be closed but it is still active.    | Cancel or wait for the stream to complete first.                        |
| **Arithmetic**         |                           |                                                                          |
| 1024                   | `Overflow`                | An arithmetic operation overflowed `i128`.                               | Reduce the amount or duration; report as a bug if unexpected.           |
| **Agents & Signers**   |                           |                                                                          |
| 1013                   | `AgentNotFound`           | The automation agent address is not registered.                          | Register the agent via `automation_gateway::register_agent` first.      |
| 1032                   | `SignerNotFound`          | A signer key is not in the multi-sig set.                                | Add the key with `add_signer` before referencing it.                    |
| 1033                   | `AlreadySigner`           | The key is already in the multi-sig set.                                 | No action needed; the signer is already registered.                     |
| 1034                   | `InvalidThreshold`        | Multi-sig threshold is zero or exceeds the signer count.                 | Set a threshold in the range `[1, signer_count]`.                       |
| 1035                   | `InsufficientSignatures`  | Not enough signers have approved the operation.                          | Collect additional signatures before submitting.                        |
| 1036                   | `NoSigners`               | Multi-sig operation attempted with an empty signer set.                  | Add at least one signer before requiring multi-sig.                     |
| 1039                   | `DuplicateSigner`         | The same signer address appears more than once in a batch.               | Remove duplicates from the signer list.                                 |
| **Admin & Governance** |                           |                                                                          |
| 1030                   | `NoPendingAdmin`          | `accept_admin` was called but no admin transfer is in progress.          | Initiate admin transfer with `propose_admin` first.                     |
| 1031                   | `NotPendingAdmin`         | Caller is not the address that was proposed as new admin.                | The correct pending admin must call `accept_admin`.                     |
| **Compliance**         |                           |                                                                          |
| 1025                   | `RetentionNotMet`         | Minimum retention period for funds has not elapsed.                      | Wait for the retention period to pass before withdrawing.               |
| 1026                   | `FeeTooHigh`              | Calculated protocol fee exceeds the configured cap.                      | Adjust fee parameters or reduce the transaction size.                   |
| 1027                   | `AddressBlacklisted`      | Address has been blacklisted by the protocol admin.                      | Contact the admin if you believe this is an error.                      |
| **Operations**         |                           |                                                                          |
| 1028                   | `WorkerNotFound`          | Worker address is not registered in the workforce registry.              | Register the worker with `workforce_registry::register_worker`.         |
| 1029                   | `BatchTooLarge`           | Batch operation exceeds the maximum allowed batch size.                  | Split the batch into smaller chunks.                                    |
| 1037                   | `WithdrawalCooldown`      | Withdrawal was attempted before the cooldown period elapsed.             | Wait for the cooldown window to pass before retrying.                   |
| 1038                   | `GracePeriodActive`       | A grace-period timelock is still active (e.g. for upgrades or drains).   | Wait for the grace period to expire.                                    |
| 1040                   | `NoDrainPending`          | `execute_drain` was called but no drain was initiated.                   | Call `initiate_drain` first, then wait for the timelock.                |
| 1041                   | `DrainTimelockActive`     | The drain timelock has not yet expired.                                  | Wait for the timelock duration to elapse before executing.              |
| **Miscellaneous**      |                           |                                                                          |
| 1015                   | `TransferFailed`          | An underlying Stellar asset transfer failed.                             | Check recipient account exists and can receive the token.               |
| 1016                   | `UpgradeFailed`           | WASM upgrade invocation failed.                                          | Verify the new WASM hash and that the caller is the admin.              |
| 1999                   | `Custom`                  | A custom error condition not covered by the above codes.                 | Inspect the surrounding context or contract logs for details.           |

---

## Adding a new error code

1. Add the variant to `QuipayError` in `contracts/common/src/error.rs` with the next available `u32` value.
2. Add a Rust doc comment (`///`) describing the condition.
3. Add a row to the table above with a description and recovery action.
4. Update any match statements in calling contracts that use `_` or exhaustive patterns.

> **Important**: Error codes are part of the on-chain ABI. Once deployed, an existing code's numeric value must never change; only new codes may be added.
