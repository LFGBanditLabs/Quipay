# Payroll Vault Contract

The Payroll Vault is the treasury contract for Quipay. It manages deposits, liability accounting, and payouts.

## Key Methods

### `initialize`

Initializes the vault with an admin.

```rust
pub fn initialize(e: Env, admin: Address) -> Result<(), QuipayError>
```

### `deposit`

Allows an employer to deposit funds into the treasury.

```rust
pub fn deposit(e: Env, from: Address, token: Address, amount: i128) -> Result<(), QuipayError>
```

### `set_authorized_contract`

Sets the address of the Payroll Stream contract allowed to allocate and release liabilities.

```rust
pub fn set_authorized_contract(e: Env, contract: Address)
```

### `get_treasury_balance`

Returns the current balance of a specific token in the treasury.

```rust
pub fn get_treasury_balance(e: Env, token: Address) -> i128
```

### `get_total_liability`

Returns the total liability (funds allocated to active streams) for a specific token.

```rust
pub fn get_total_liability(e: Env, token: Address) -> i128
```

## Solvency Invariant

The vault enforces that:
`Treasury Balance >= Total Liability`

When a stream is created in the `PayrollStream` contract, it calls `add_liability` in the vault. If the new liability would exceed the treasury balance, the transaction fails.
