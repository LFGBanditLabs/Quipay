# ADR-003: Automation Gateway Authorization Model

## Status

Accepted

## Context

Quipay aims to enable AI-powered automation for payroll operations, allowing employers to delegate tasks like:

- Creating recurring payment streams
- Canceling streams when employment ends
- Rebalancing treasury allocations
- Monitoring solvency and triggering alerts

However, granting AI agents direct access to treasury funds poses significant security risks:

- **Compromised Agents**: A hacked AI agent could drain the entire treasury
- **Buggy Automation**: Logic errors could create incorrect payment streams
- **Unauthorized Actions**: Agents might exceed their intended permissions
- **Accountability**: Need clear audit trails of which agent performed which action

We needed an authorization model that:

1. Allows employers to delegate specific actions to AI agents
2. Prevents agents from performing unauthorized operations
3. Maintains clear accountability and audit trails
4. Supports fine-grained permission control
5. Enables revocation of agent access

## Decision

We will implement an **Automation Gateway** contract that acts as an authorization layer between AI agents and the core protocol contracts (PayrollStream, PayrollVault).

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Agent (Backend)                     │
│  • Monitors treasury health                                 │
│  • Schedules recurring payments                             │
│  • Executes authorized actions                              │
└─────────────────────────────────────────────────────────────┘
                            ↓ (requires auth)
┌─────────────────────────────────────────────────────────────┐
│                   AutomationGateway                         │
│  • Verifies agent permissions                               │
│  • Routes authorized calls to protocol contracts            │
│  • Emits audit events                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓ (authorized calls)
┌─────────────────────────────────────────────────────────────┐
│              PayrollStream / PayrollVault                   │
│  • Accepts calls from gateway on behalf of employer         │
│  • Validates gateway authorization                          │
└─────────────────────────────────────────────────────────────┘
```

### Permission Model

The gateway defines granular permissions:

```rust
pub enum Permission {
    ExecutePayroll = 1,      // Create/cancel streams
    ManageTreasury = 2,      // Deposit/withdraw funds
    RegisterAgent = 3,       // Add new agents (admin-only)
    CreateStream = 4,        // Create payment streams
    CancelStream = 5,        // Cancel existing streams
    RebalanceTreasury = 6,   // Optimize fund allocation
}
```

Each agent is registered with a specific set of permissions:

```rust
pub struct Agent {
    pub address: Address,
    pub permissions: Vec<Permission>,
    pub registered_at: u64,
}
```

### Authorization Flow

1. **Agent Registration** (Admin-only):

   ```rust
   gateway.register_agent(
       agent_address,
       vec![Permission::CreateStream, Permission::CancelStream]
   )
   ```

2. **Action Execution** (Agent):

   ```rust
   // Agent calls gateway with their signature
   gateway.agent_create_stream(
       agent,           // Agent's address (requires auth)
       employer,        // Employer on whose behalf to act
       worker,
       token,
       rate,
       cliff_ts,
       start_ts,
       end_ts
   )
   ```

3. **Gateway Verification**:

   ```rust
   // Gateway checks agent permissions
   require!(
       is_authorized(agent, Permission::CreateStream),
       QuipayError::InsufficientPermissions
   );

   // Gateway calls PayrollStream on behalf of employer
   payroll_stream.create_stream_via_gateway(
       employer, worker, token, rate, cliff_ts, start_ts, end_ts
   )
   ```

4. **Protocol Validation**:

   ```rust
   // PayrollStream verifies caller is authorized gateway
   let gateway = get_gateway()?;
   gateway.require_auth();

   // Proceeds with stream creation
   ```

### Key Design Principles

- **Least Privilege**: Agents only receive permissions they need
- **Explicit Authorization**: Every action requires agent signature + permission check
- **Employer Control**: Only employer (admin) can register/revoke agents
- **Audit Trail**: All gateway actions emit events with agent and employer addresses
- **Revocable Access**: Employer can revoke agent at any time

## Consequences

### Positive

- **Security**: Agents cannot directly access treasury funds or protocol contracts
- **Granular Control**: Employers grant only specific permissions to each agent
- **Accountability**: Clear audit trail of which agent performed which action
- **Flexibility**: New permissions can be added without changing core contracts
- **Revocability**: Employers can instantly revoke agent access
- **Multi-Agent Support**: Multiple agents can operate with different permission sets

### Negative

- **Additional Contract**: Adds deployment and maintenance overhead
- **Gas Overhead**: Extra contract call for authorization check
- **Complexity**: Developers must understand three-layer architecture (agent → gateway → protocol)
- **Setup Required**: Employers must explicitly register agents before automation works

### Mitigations

- **Gas Overhead**: Authorization check is O(1) and minimal compared to security benefits
- **Documentation**: This ADR and inline comments explain the authorization flow
- **Setup Automation**: Backend provides scripts to register agents during deployment
- **Testing**: Integration tests verify end-to-end authorization flow

## Security Considerations

### Threat: Compromised Agent Key

**Mitigation**: Agent can only perform actions within granted permissions. Cannot drain treasury or modify other employers' streams.

### Threat: Gateway Contract Bug

**Mitigation**: Gateway is minimal and focused solely on authorization. Separate security audit before mainnet.

### Threat: Permission Escalation

**Mitigation**: Only employer (admin) can grant permissions. Agents cannot self-grant permissions.

### Threat: Replay Attacks

**Mitigation**: Stellar's built-in sequence numbers prevent transaction replay.

## Examples

### Example 1: Payroll Automation Agent

```rust
// Employer registers agent with stream management permissions
gateway.register_agent(
    agent_address,
    vec![Permission::CreateStream, Permission::CancelStream]
);

// Agent creates monthly salary stream
gateway.agent_create_stream(
    agent_address,
    employer_address,
    worker_address,
    usdc_token,
    rate_per_second,
    cliff_ts,
    start_ts,
    end_ts
);
```

### Example 2: Treasury Monitoring Agent

```rust
// Employer registers agent with read-only monitoring
gateway.register_agent(
    monitor_agent,
    vec![] // No write permissions
);

// Agent can query but not modify
let health = payroll_stream.get_stream_health(stream_id);
// Cannot create/cancel streams
```

### Example 3: Revoking Compromised Agent

```rust
// Employer immediately revokes agent access
gateway.revoke_agent(compromised_agent_address);

// Agent can no longer perform any actions
// Existing streams continue unaffected
```

## Related Decisions

- [ADR-001: Vault-Stream Separation Pattern](./ADR-001-vault-stream-separation.md) - Gateway extends authorization pattern
- [ADR-004: Backend Monitoring Architecture](./ADR-004-backend-monitoring-architecture.md) - Backend agents use gateway for automation

## References

- `contracts/automation_gateway/src/lib.rs` - Gateway implementation
- `backend/src/stellarListener.ts` - Backend agent integration
- [Security Threat Model](../SECURITY_THREAT_MODEL.md) - Detailed threat analysis
