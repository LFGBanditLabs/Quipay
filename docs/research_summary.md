# Research Summary

## 1. Drips Wave

- **Eligibility**: Open to individuals 18+ who are not in sanctioned jurisdictions.
- **Rewards**:
  - Based on a "Points" system.
  - Exchange rate to tokens/fiat is determined by the Association.
  - KYC/KYB is required to claim rewards.
- **Prohibited Activities**:
  - Low-effort contributions (e.g., trivial typo fixes).
  - **Unverified AI-Generated Code**: Submitting LLM-generated code that is "low quality, untested, or not understood" is explicitly prohibited. **Action Item**: We must ensure all AI-generated code for Quipay is rigorously tested and understood.
  - Creating multiple accounts to manipulate points.

## 2. Stellar Community Fund (SCF) v7

- **Tracks**:
  1.  **Integration Track**: For integrating existing building blocks (wallets, anchors).
  2.  **Open Track**: For financial protocols and novel use cases. **Quipay fits here.**
  3.  **RFP Track**: For specific ecosystem needs (tooling, infra).
- **Funding Structure**:
  - 10% on Award.
  - 20% on MVP (Mid-development).
  - 30% on Testnet (Advanced readiness).
  - 40% on Mainnet + UX Readiness.
- **Requirement**: "Mainnet deployment alone is no longer sufficient — funded projects must be usable, discoverable, and positioned for adoption."

## 3. Soroban Development

- **Setup**: Requires `rustup`, `stellar-cli`.
- **Project Structure**:
  - Standard Rust project layout for contracts (`Cargo.toml`, `src/lib.rs`).
  - Frontend interaction via generated TypeScript bindings from the contract XDR.
- **Implication for Quipay**:
  - The proposed structure in `docs/design.md` (`/smart_contract`, `/frontend`, `/backend`) aligns well with standard patterns.
  - We should ensure `smart_contract` is a valid Rust workspace.

## 4. Next Steps

- Validate `smart_contract` folder setup.
- Define specific "Verification" steps for AI-generated code to comply with Drips Wave rules.
