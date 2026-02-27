# Automation Gateway Contract

The Automation Gateway is the security bridge between off-chain AI agents and on-chain payroll execution.

## Key Methods

### `register_agent`

Whitelists an AI agent with specific permissions. Only the admin can call this.

```rust
pub fn register_agent(
    env: Env,
    agent_address: Address,
    permissions: Vec<Permission>
) -> Result<(), QuipayError>
```

### `is_authorized`

Checks if an agent is authorized to perform a specific action.

```rust
pub fn is_authorized(env: Env, agent_address: Address, action: Permission) -> bool
```

### `execute_automation`

Routes an automated action through the gateway. Verifies that the agent has the required permissions.

```rust
pub fn execute_automation(
    env: Env,
    agent: Address,
    action: Permission,
    data: Bytes
) -> Result<(), QuipayError>
```

## Permissions

Agents can be granted the following permissions:

- `ExecutePayroll` (1): Ability to trigger payroll withdrawals or stream updates.
- `ManageTreasury` (2): Ability to rebalance or optimize treasury funds.
- `RegisterAgent` (3): Ability to register other agents (reserved for super-admins).
