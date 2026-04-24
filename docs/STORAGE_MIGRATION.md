# Contract Storage Migration Strategy

This document describes how Quipay handles on-chain storage migrations for upgradeable Soroban contracts.

## Why This Exists

Soroban storage keys are part of a contract's long-lived state. If a future contract version changes the shape of a stored struct but keeps reading the same storage key, old bytes can be deserialized with the new layout and produce corrupted values.

To avoid that, Quipay now treats storage layout changes as schema migrations.

## Current Pattern

For `PayrollStream`:

- `DataKey::StorageVersion` tracks the active storage schema version.
- Versioned persistent keys are used for stream-related records:
  - `StreamV2(...)`
  - `LastWithdrawalV2(...)`
  - `DisputeV2(...)`
  - `ReceiptByIdV2(...)`
  - `ReceiptByStreamV2(...)`
- Fresh deployments initialize storage at the current schema version.
- Legacy deployments without `StorageVersion` are treated as schema `v1`.

## Lazy Migration Flow

On the first invocation after an upgrade:

1. The contract checks `StorageVersion`.
2. If the version is older than the current schema, it copies legacy records into the new versioned keys.
3. Worker and employer indexes are rebuilt from the migrated streams.
4. Receipt and dispute mappings are copied into their versioned locations.
5. `StorageVersion` is updated to the current schema version.

This makes the migration atomic at transaction scope: if anything fails, the invocation reverts and the contract stays on the previous schema.

## Rules For Future Upgrades

When changing any stored struct or storage layout:

1. Add a new schema version constant.
2. Introduce new versioned keys instead of reusing the old keys.
3. Add a migration function from the previous schema to the new one.
4. Keep read/write helpers centralized so business logic never touches raw legacy keys directly.
5. Add a test that seeds legacy storage and proves the new code migrates it correctly.

## Operational Guidance

- Run migration-aware contract tests before publishing a new WASM.
- Expect the first post-upgrade transaction to do extra work because it may execute the migration.
- Prefer a low-risk admin transaction immediately after upgrade if you want to warm the contract and complete migration before user traffic hits it.
