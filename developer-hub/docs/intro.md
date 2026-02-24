# Introduction to Quipay

Quipay is a decentralized payroll infrastructure built on Stellar using Soroban smart contracts. It enables employers to automate workforce payments using programmable streaming payment contracts and AI-assisted treasury management.

## Key Features

- **continuous Salary Streaming**: Payroll is paid out in real-time, ledger by ledger.
- **Autonomous Treasury Management**: AI agents can monitor and optimize treasury solvency.
- **Workforce Registry**: Centralized on-chain registry for worker payment preferences and metadata.
- **AI Automation Gateway**: Secure framework for authorizing off-chain AI agents to trigger on-chain payroll actions.

## Protocol Architecture

The protocol consists of four core smart contracts:

1. **Payroll Stream**: Manages the lifecycle of payroll streams, including creation, vesting, and withdrawal.
2. **Payroll Vault**: Custodies employer funds and enforces solvency invariants.
3. **Workforce Registry**: Stores worker profiles and payment metadata.
4. **Automation Gateway**: Authorizes and routes actions from AI-driven automation agents.
