# Smart Contract Documentation

This document provides a detailed overview of the smart contracts that power the Quipay protocol.

## 📜 PayrollStream

The `PayrollStream` contract manages continuous salary streaming and accrual calculations.

### Storage Keys

| Key             | Type      | Description                                                    |
| --------------- | --------- | -------------------------------------------------------------- |
| `Admin`         | `Address` | The address with administrative privileges.                    |
| `Paused`        | `bool`    | Indicates whether the protocol is currently paused.            |
| `NextStreamId`  | `u64`     | The ID to be assigned to the next created stream.              |
| `RetentionSecs` | `u64`     | The duration cancelled/completed stream data is kept on-chain. |

### Contract Functions

#### `init(admin: Address)`

Initializes the contract with an administrative address. Panics if already initialized.

#### `set_paused(paused: bool)`

Enables or disables the protocol's pause state. Only callable by the `Admin`.

#### `create_stream(employer: Address, worker: Address, amount: i128, start_ts: u64, end_ts: u64) -> u64`

Creates a new payroll stream between an employer and a worker.

- **Employer**: Must authorize the transaction.
- **Amount**: Total amount to be streamed.
- **Returns**: A unique `stream_id`.

#### `withdraw(stream_id: u64, worker: Address) -> i128`

Allows a worker to withdraw their vested salary from a specific stream.

- **Worker**: Must authorize the transaction.
- **Returns**: The amount withdrawn.

#### `cancel_stream(stream_id: u64, employer: Address)`

Allows an employer to cancel an active stream. Vested funds remain withdrawable by the worker.

#### `cleanup_stream(stream_id: u64)`

Removes cancelled or completed stream data from persistent storage after the `RetentionSecs` period has passed.

---

## 🏦 PayrollVault (TreasuryVault)

The `PayrollVault` contract manages employer fund custody and liability accounting.

### Storage Keys

| Key               | Type          | Description                                  |
| ----------------- | ------------- | -------------------------------------------- |
| `Admin`           | `Address`     | The address with administrative privileges.  |
| `Version`         | `VersionInfo` | Tracked contract version for upgrades.       |
| `TreasuryBalance` | `i128`        | Total funds held for all payroll operations. |
| `TotalLiability`  | `i128`        | Total accrued amount owed to recipients.     |

### Contract Functions

#### `initialize(admin: Address)`

Sets up the contract with an admin and initializes balances.

#### `deposit(from: Address, token: Address, amount: i128)`

Deposits funds into the treasury.

- **From**: The address providing the funds (requires auth).

#### `payout(to: Address, token: Address, amount: i128)`

Withdraws funds from the treasury to a recipient address. Only callable by the `Admin`.

#### `upgrade(new_wasm_hash: BytesN<32>, new_version: (u32, u32, u32))`

Upgrades the contract's logic while preserving storage. Only callable by the `Admin`.

---

## 🤖 AutomationGateway

The `AutomationGateway` manages AI agent authorization and execution routing.

### Permissions

- `ExecutePayroll` (1)
- `ManageTreasury` (2)
- `RegisterAgent` (3)

### Contract Functions

#### `register_agent(agent_address: Address, permissions: Vec<Permission>)`

Authorizes an AI agent to perform specific actions. Only callable by the `Admin`.

#### `revoke_agent(agent_address: Address)`

Revokes all authorizations for a specific agent.

#### `is_authorized(agent_address: Address, action: Permission) -> bool`

Checks if an agent has the required permission for an action.

#### `execute_automation(agent: Address, action: Permission, data: Bytes)`

Routes an automated action if the agent is authorized.

---

## 📋 WorkforceRegistry (Planned)

The `WorkforceRegistry` will manage worker profiles and payment preferences.

### Planned Functions

- `register_worker(address: Address, profile_cid: Bytes)`
- `update_preferences(address: Address, preferred_token: Address)`
- `get_worker_profile(address: Address) -> Profile`
