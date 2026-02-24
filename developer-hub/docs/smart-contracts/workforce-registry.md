# Workforce Registry Contract

The Workforce Registry stores metadata and payment preferences for workers on Quipay.

## Key Methods

### `register_worker`

Registers a new worker profile.

```rust
pub fn register_worker(
    e: Env,
    worker: Address,
    preferred_token: Address,
    metadata_hash: String,
)
```

- **worker**: The address of the worker. Requires authentication.
- **preferred_token**: The token the worker prefers to be paid in.
- **metadata_hash**: A hash (e.g., IPFS CID) pointing to off-chain worker data (e.g., name, role, etc.).

### `update_worker`

Updates an existing worker profile.

```rust
pub fn update_worker(
    e: Env,
    worker: Address,
    preferred_token: Address,
    metadata_hash: String,
)
```

### `get_worker`

Retrieves a worker's profile.

```rust
pub fn get_worker(e: Env, worker: Address) -> Option<WorkerProfile>
```

## Worker Profile Struct

```rust
pub struct WorkerProfile {
    pub wallet: Address,
    pub preferred_token: Address,
    pub metadata_hash: String,
}
```
