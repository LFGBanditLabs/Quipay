# SECURITY THREAT MODEL

This document outlines the formal threat model for the **Quipay** protocol, identifying potential risks, mitigation strategies, and trust boundaries as we prepare for mainnet launch.

## 🛡️ Risk Assessment & Mitigation Strategies

### 1. Reentrancy Risks

**Risk Description:**
Although Soroban provides built-in protection against certain types of reentrancy, complex cross-contract calls (especially during `withdraw` or `payout` operations) could potentially be exploited to double-spend or drain the treasury if the contract state is not updated before external interactions.

**Mitigation Strategy:**

- **Checks-Effects-Interactions Pattern:** All Quipay contracts follow the CEI pattern strictly. State changes (e.g., updating `TreasuryBalance`, `TotalLiability`, or stream data) must occur _before_ any external token transfers or cross-contract calls.
- **Mutual Exclusion:** For sensitive operations, the protocol utilizes Soroban's authentication framework to ensure single-threaded execution within the context of a specific caller.

### 2. Authorization Bypass

**Risk Description:**
An attacker might attempt to call administrative functions (`set_paused`, `upgrade`, `payout`) or act on behalf of another user (`create_stream`, `withdraw`) by bypassing identity verification.

**Mitigation Strategy:**

- **Native Authentication:** Every sensitive entry point uses `address.require_auth()` to verify the caller's signature.
- **Granular Permissions:** The `AutomationGateway` implements a bitmask-based permission system (`ExecutePayroll`, `ManageTreasury`, `RegisterAgent`). Agents only receive the minimum permissions necessary for their tasks.
- **Strict Role-Based Access Control (RBAC):** Admin-only functions are explicitly guarded by checking the stored `Admin` address.

### 3. Arithmetic Overflow

**Risk Description:**
Calculating vested amounts in `PayrollStream` involve multiplying large time durations by salary rates. An arithmetic overflow could lead to incorrect payouts or permanent locking of funds.

**Mitigation Strategy:**

- **Checked Math:** All calculations use Rust's checked arithmetic (`checked_add`, `checked_mul`, `checked_div`).
- **Precision Management:** Salaries and treasury balances are stored using `i128` to provide sufficient headroom for massive payrolls and long-term streams without precision loss or overflow.

### 4. Front-Running

**Risk Description:**
Attackers might monitor the Stellar ledger for pending transactions and attempt to front-run them (e.g., rushing a `withdraw` before an employer can `cancel_stream`).

**Mitigation Strategy:**

- **Deterministic Logic:** The `withdraw` logic calculates vesting based on the current ledger timestamp at the moment of execution, ensuring that even if a transaction is slightly delayed, the math remains fair.
- **Admin Controls:** `cancel_stream` and `cleanup_stream` are restricted to authorized addresses, preventing public griefing or unauthorized state manipulation.

### 5. Admin Key Compromise

**Risk Description:**
The `Admin` address has ultimate control over treasury payouts, contract upgrades, and AI agent registration. A compromise of this key would be catastrophic.

**Mitigation Strategy:**

- **Multi-Signature Control:** On mainnet, the `Admin` address will be a Stellar multi-sig account or a Smart Contract DAO, requiring multiple independent signatures for sensitive actions.
- **Upgrade Deadlines:** Contract upgrades are handled via `upgrade` function which, in a production environment, should be behind a time-lock to allow users to exit if they disagree with changes.
- **AI Agent Revocation:** A compromised AI agent can be instantly blocked via the `revoke_agent` function in `AutomationGateway`.

## 🏗️ Assumptions & Trust Boundaries

### Known Assumptions

- **Stellar Network Integrity:** We assume the underlying Stellar network and Soroban runtime are secure and maintain Byzantine Fault Tolerance.
- **Oracle Accuracy:** We assume that if any external price feeds or data sources are integrated, they are reliable (though currently, Quipay is self-contained).
- **Admin Integrity:** We assume the `Admin` entity (DAO or Multi-sig) acts in the best interest of the protocol.

### Trust Boundaries

| Boundary              | Description                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **User/Contract**     | Every user is responsible for their own signing key. The contract trusts nothing outside `require_auth()`.                           |
| **AI Agent/Protocol** | AI Agents are _partially trusted_ within their assigned permissions but cannot exceed the bounds defined by the `AutomationGateway`. |
| **Treasury Vault**    | The `PayrollVault` trusts the `Admin` and authorized agents to sign off on payouts.                                                  |
| **Token Contracts**   | Quipay trusts the standard Soroban Token Interface (SAC) for fund transfers.                                                         |
