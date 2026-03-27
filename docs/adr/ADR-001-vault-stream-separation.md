# ADR-001: Vault-Stream Separation Pattern

## Status

Accepted

## Context

Quipay is a decentralized payroll protocol that enables continuous salary streaming on the Stellar blockchain. The system needs to manage two critical concerns:

1. **Treasury Management**: Securely holding employer funds and tracking financial liabilities
2. **Payment Streaming**: Computing time-based salary accrual and enabling worker withdrawals

Early in the design phase, we faced a decision: should we implement a monolithic contract that handles both treasury custody and streaming logic, or separate these concerns into distinct contracts?

Key considerations:

- **Security**: Treasury funds represent the highest-value target for attacks. Any vulnerability in streaming logic could compromise the entire treasury.
- **Upgradeability**: Streaming algorithms may need refinement (e.g., different vesting curves, cliff periods) without risking treasury funds.
- **Complexity**: Combining custody and computation logic in one contract increases code complexity and audit surface area.
- **Reusability**: A generic vault could potentially serve multiple payment contracts beyond just streaming payroll.
- **Gas Efficiency**: Cross-contract calls on Stellar/Soroban have minimal overhead compared to monolithic contract complexity.

## Decision

We will implement a **separation of concerns** architecture with two distinct smart contracts:

### PayrollVault Contract

**Responsibilities:**

- Custody of employer treasury funds
- Tracking total liabilities (amount owed to workers)
- Enforcing solvency invariants (balance ≥ liabilities)
- Executing payouts to workers
- Admin-controlled fund management (deposits, withdrawals)

**Key Design Principles:**

- Minimal attack surface - only essential treasury operations
- Persistent storage survives contract upgrades
- Multisig support for DAO/enterprise treasuries
- 48-hour timelock for contract upgrades

### PayrollStream Contract

**Responsibilities:**

- Creating and managing payment streams
- Computing time-based salary accrual
- Tracking per-stream withdrawal history
- Handling stream lifecycle (active, canceled, completed)
- Coordinating with vault for liability tracking

**Key Design Principles:**

- Stateless computation of vested amounts
- Authorized to call vault's `add_liability` and `payout_liability` functions
- Can be upgraded independently of vault

### Integration Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                     PayrollStream                           │
│  • create_stream() → vault.add_liability()                  │
│  • withdraw() → vault.payout_liability()                    │
│  • cancel_stream() → vault.remove_liability()               │
└─────────────────────────────────────────────────────────────┘
                            ↓ (authorized calls)
┌─────────────────────────────────────────────────────────────┐
│                      PayrollVault                           │
│  • Holds employer funds                                     │
│  • Enforces: balance ≥ liabilities                          │
│  • Only authorized contract can modify liabilities          │
└─────────────────────────────────────────────────────────────┘
```

The vault authorizes the stream contract via `set_authorized_contract()`, allowing it to modify liabilities without requiring admin signatures for every withdrawal.

## Consequences

### Positive

- **Enhanced Security**: Treasury logic is isolated from streaming computation. A bug in stream calculations cannot directly drain the vault.
- **Independent Upgrades**: Streaming algorithms can be improved without touching treasury custody code.
- **Clearer Audit Scope**: Security auditors can focus on vault contract as the highest-priority target.
- **Flexible Authorization**: The vault can authorize multiple payment contracts (future: one-time payments, milestone-based payouts).
- **Reduced Complexity**: Each contract has a single, well-defined responsibility.
- **Better Testing**: Contracts can be tested independently with mocked dependencies.

### Negative

- **Cross-Contract Overhead**: Each withdrawal requires two contract calls (stream → vault), slightly increasing gas costs.
- **Deployment Complexity**: Two contracts must be deployed and linked correctly (vault must authorize stream).
- **State Synchronization**: Liability tracking must remain consistent between contracts (mitigated by atomic transactions).
- **Learning Curve**: New contributors must understand the interaction pattern between contracts.

### Mitigations

- **Gas Overhead**: Soroban's efficient cross-contract calls make this negligible compared to security benefits.
- **Deployment**: Automated deployment scripts handle contract linking and authorization.
- **Synchronization**: All liability modifications happen within atomic transactions, preventing inconsistencies.
- **Documentation**: This ADR and inline code comments explain the separation pattern.

## Related Decisions

- [ADR-002: Time-Based Stream Computation](./ADR-002-time-based-stream-computation.md) - Explains how streams calculate vested amounts
- [ADR-003: Automation Gateway Authorization Model](./ADR-003-automation-gateway-authorization.md) - Extends authorization pattern to AI agents

## References

- `contracts/payroll_vault/src/lib.rs` - Vault implementation
- `contracts/payroll_stream/src/lib.rs` - Stream implementation
- [Security Threat Model](../SECURITY_THREAT_MODEL.md) - Detailed security analysis
