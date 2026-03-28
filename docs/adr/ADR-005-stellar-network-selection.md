# ADR-005: Stellar Network and Soroban Smart Contract Platform Selection

## Status

Accepted

## Context

Quipay is a continuous payroll streaming protocol requiring the following from its underlying blockchain:

1. **Sub-cent transaction fees** — workers may withdraw small accumulated amounts frequently; high fees would erode earnings.
2. **Fast finality** — payroll is time-sensitive; 3–5 second ledger close times are required so workers see updated balances quickly.
3. **USDC support** — USDC is the dominant stable token for payroll; native support is required.
4. **Smart contract programmability** — streaming logic, cliff-vesting schedules, and multi-sig treasury controls must be on-chain.
5. **No MEV / front-running risk** — Stellar's deterministic fee market eliminates front-running attacks on withdrawal transactions.

Alternatives evaluated:

| Platform          | Finality | Avg. Fee | USDC         | Smart Contracts | Notes                                                 |
| ----------------- | -------- | -------- | ------------ | --------------- | ----------------------------------------------------- |
| Ethereum (L1)     | ~12 s    | $1–20    | Yes (ERC-20) | Solidity        | Fees prohibitive for small withdrawals                |
| Polygon PoS       | ~2 s     | ~$0.01   | Yes          | Solidity        | Centralised sequencer risk; bridge trust assumptions  |
| Solana            | ~0.4 s   | ~$0.0005 | Yes          | Rust/Anchor     | Outage history; no built-in account model for payroll |
| Stellar + Soroban | ~5 s     | ~$0.0001 | Yes (native) | Rust (Soroban)  | Purpose-built for payments; Stellar DEX liquidity     |

## Decision

We will build Quipay exclusively on the **Stellar network** using **Soroban smart contracts** (Rust, `#[no_std]`).

**Rationale:**

- Stellar is purpose-built for cross-border payments. Its fee market is predictable: a minimum base fee of 100 stroops (~$0.00001) with no gas price auctions.
- Soroban (Stellar's smart contract layer, GA since 2024) provides Rust-based contracts with deterministic gas metering, WASM execution, and a rich SDK.
- Circle's USDC is available as a Stellar asset with deep liquidity on the Stellar DEX, removing bridge risk.
- The `stellar-cli` toolchain and Soroban RPC simplify development, deployment, and client-side simulation.
- Stellar's built-in multi-signature account model extends naturally to the multi-sig treasury requirements in Quipay's PayrollVault.

## Consequences

### Positive

- **Minimal fees** make frequent micro-withdrawals economically viable.
- **Fast finality (~5 s)** keeps the UI responsive without polling tricks.
- **Native USDC** eliminates bridge smart-contract risk.
- **No MEV** removes front-running as a security concern.
- **Soroban's resource model** (CPU instructions, read/write bytes) makes gas costs predictable and auditable.

### Negative

- **Ecosystem size**: Stellar has fewer developers and tooling than Ethereum, which narrows the hiring pool.
- **Soroban maturity**: Soroban reached GA in late 2023/2024; the ecosystem is still maturing (fewer audited libraries, smaller community).
- **Interoperability**: Users on EVM chains must bridge assets to interact with Quipay.
- **No EVM compatibility**: All contract code must be written in Rust targeting `wasm32`; Solidity skills don't transfer directly.

### Mitigations

- **Ecosystem size**: Comprehensive documentation, ADRs, and inline comments lower onboarding friction.
- **Soroban maturity**: The `contracts/common` crate centralises shared security primitives (errors, auth helpers) to compensate for fewer third-party libraries.
- **Interoperability**: Future roadmap includes a Stellar ↔ EVM bridge integration using the Automation Gateway contract.
- **No EVM**: Rust is a widely known systems language; Soroban SDK patterns are documented in `docs/CONTRACTS.md`.

## Related Decisions

- [ADR-001: Vault-Stream Separation Pattern](./ADR-001-vault-stream-separation.md) — contract architecture enabled by Soroban's cross-contract call model.
- [ADR-002: Time-Based Stream Computation](./ADR-002-time-based-stream-computation.md) — uses Stellar ledger timestamps for vesting calculations.
- [ADR-003: Automation Gateway Authorization Model](./ADR-003-automation-gateway-authorization.md) — uses Stellar's `require_auth` for AI-agent authorization.

## References

- [Stellar Docs — Soroban](https://developers.stellar.org/docs/smart-contracts)
- [Soroban SDK](https://docs.rs/soroban-sdk)
- [Circle USDC on Stellar](https://www.circle.com/en/usdc-multichain/stellar)
- `contracts/common/src/error.rs` — shared error primitives
- `docs/SECURITY_THREAT_MODEL.md` — full threat model including network-layer risks
