# Quipay

<div align="center">

![Quipay Banner](https://img.shields.io/badge/Quipay-Payroll%20on%20Autopilot-blue?style=for-the-badge)

**Autonomous Payroll Infrastructure on Stellar**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Stellar](https://img.shields.io/badge/Built%20on-Stellar-7D00FF?logo=stellar)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Smart%20Contracts-Soroban-00D4FF)](https://soroban.stellar.org)

[Features](#-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## 📖 Overview

Quipay is a decentralized payroll protocol enabling **continuous salary streaming**, **automated treasury management**, and **AI-powered payroll operations** on the Stellar blockchain. Built for the future of work, Quipay eliminates traditional payroll friction through programmable smart contracts and intelligent automation.

### Why Quipay?

- **🌍 Global** - Borderless payments in any Stellar asset
- **⚡ Real-Time** - Workers access earnings continuously, not monthly
- **🤖 Autonomous** - AI agents handle scheduling and optimization
- **🔒 Secure** - Treasury solvency enforced on-chain
- **📊 Transparent** - All transactions verifiable and auditable

---

## ✨ Features

### For Employers

- **Continuous Payment Streams** - Set up recurring salaries that accrue per second
- **Treasury Solvency Management** - Automatic balance verification prevents overspending
- **Multi-Token Support** - Pay in XLM, USDC, or any Stellar asset
- **AI Automation** - Intelligent agents handle payroll scheduling and treasury optimization
- **Compliance Ready** - Built-in audit trails and payment verification

### For Workers

- **Instant Access** - Withdraw earned salary anytime, no waiting for payday
- **Real-Time Earnings** - See your balance grow every second
- **Flexible Withdrawals** - Partial or full payouts on demand
- **Multi-Stream Support** - Manage multiple income sources in one place
- **Payment History** - Complete transaction transparency

---

## 🏗️ Architecture

Quipay uses a modular smart contract architecture for security, scalability, and maintainability:

### Smart Contracts

| Contract              | Purpose                                           | Status            |
| --------------------- | ------------------------------------------------- | ----------------- |
| **PayrollStream**     | Continuous salary streaming & accrual calculation | 🚧 In Development |
| **TreasuryVault**     | Employer fund custody with liability accounting   | ✅ Base Complete  |
| **WorkforceRegistry** | Worker profiles & payment preferences             | 📋 Planned        |
| **AutomationGateway** | AI agent authorization & execution routing        | 📋 Planned        |

### Technology Stack

```
┌─────────────────────────────────────────────┐
│           Frontend (Vite + React)           │
│   • Wallet Integration (Freighter)         │
│   • Real-time Earnings Display             │
│   • Dashboard & Analytics                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Smart Contracts (Soroban/Rust)        │
│   • PayrollStream                          │
│   • TreasuryVault                          │
│   • WorkforceRegistry                      │
│   • AutomationGateway                      │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Stellar Blockchain                  │
│   • Asset Transfers                        │
│   • Ledger State                           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│       AI Treasury Agent (Node.js)           │
│   • Payroll Scheduling                     │
│   • Solvency Monitoring                    │
│   • Risk Detection                         │
└─────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Rust** 1.79+ ([Install](https://www.rust-lang.org/tools/install))
- **Node.js** 22+ ([Install](https://nodejs.org/))
- **Stellar CLI** ([Install Guide](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup))
- **Scaffold Stellar CLI** ([Install](https://github.com/theahaco/scaffold-stellar))

### Installation

```bash
# Clone the repository
git clone https://github.com/LFGBanditLabs/Quipay.git
cd Quipay

# Install dependencies
npm install

# Start development server
npm start
```

The development server will:

1. ✅ Compile Soroban smart contracts
2. ✅ Deploy to local Stellar sandbox
3. ✅ Generate TypeScript client bindings
4. ✅ Launch frontend at **http://localhost:5173**

### Running Tests

```bash
# Test all contracts
cargo test

# Test specific contract
cd contracts/payroll_vault
cargo test

# Frontend tests
npm test
```

---

## 📁 Project Structure

```
Quipay/
├── contracts/              # Soroban smart contracts
│   ├── payroll_stream/    # Streaming payment logic
│   ├── payroll_vault/     # Treasury management
│   ├── workforce_registry/ # Worker profiles (planned)
│   └── automation_gateway/ # AI authorization (planned)
├── src/                   # React frontend application
│   ├── components/        # Reusable UI components
│   ├── pages/             # Application pages
│   ├── contracts/         # Generated contract clients
│   └── hooks/             # Custom React hooks
├── backend/               # Node.js AI agent (planned)
├── packages/              # Generated TypeScript bindings
├── docs/                  # Documentation
│   ├── PRD.md            # Product Requirements
│   └── design.md         # Technical design
└── environments.toml      # Network configurations
```

---

## 📚 Documentation

- **[Product Requirements (PRD)](docs/PRD.md)** - Complete product specification
- **[DAO Treasury Setup Guide](docs/DAO_TREASURY_SETUP.md)** - Multisig configuration for DAOs and enterprise clients
- **[Implementation Plan](.gemini/antigravity/brain/2a2ff1d1-92c4-44ca-9e86-2bf558a85165/implementation_plan.md)** - Technical architecture & roadmap
- **[Design Document](docs/design.md)** - System design overview
- **[GitHub Issues](https://github.com/LFGBanditLabs/Quipay/issues)** - Development tasks & progress

---

## 💼 Use Cases

<table>
<tr>
<td width="50%">

### DAOs & Protocol Teams

Transparent contributor compensation with automated scheduling and multi-sig control. [See DAO Setup Guide →](docs/DAO_TREASURY_SETUP.md)

</td>
<td width="50%">

### Remote-First Companies

Global payroll without intermediaries, supporting 100+ countries and multiple currencies

</td>
</tr>
<tr>
<td>

### Web3 Startups

Compliant contractor payments with built-in audit trails and flexible payment terms

</td>
<td>

### Freelance Platforms

Enable workers to access earnings instantly as they complete work milestones

</td>
</tr>
</table>

---

## 🛠️ Development Status

**Current Phase:** MVP Development (Phase 1)

### Completed ✅

- [x] Project initialization with Scaffold Stellar
- [x] Basic PayrollVault contract (deposit/payout)
- [x] Comprehensive PRD and technical documentation
- [x] 40+ GitHub issues with detailed specifications
- [x] Development environment setup

### In Progress 🚧

- [ ] PayrollStream contract (streaming logic)
- [ ] Treasury liability tracking
- [ ] Frontend wallet integration
- [ ] Real-time earnings calculator

### Planned 📋

- [ ] AI automation gateway
- [ ] Worker registry
- [ ] Analytics dashboard
- [ ] Testnet deployment
- [ ] Security audit

Track our progress: [View Task Board](https://github.com/LFGBanditLabs/Quipay/issues)

---

## 🔐 Security

Security is paramount for payroll infrastructure. Quipay implements:

- ✅ **Solvency Invariants** - Treasury balance ≥ liabilities enforced on-chain
- ✅ **Authorization Checks** - Strict access control on all fund movements
- ✅ **Multisig Support** - Treasury Vault supports multi-signature Stellar accounts for decentralized governance
- ✅ **Double-Withdrawal Prevention** - Safe accounting prevents duplicate payouts
- ✅ **Timestamp Validation** - Protection against manipulation attacks
- ✅ **Formal Auditing** - Pre-mainnet security review (planned Phase 4)

**Found a vulnerability?** See our [Security Policy](SECURITY.md)

---

## 🤝 Contributing

We welcome contributions! Quipay is building the future of payroll infrastructure.

### Ways to Contribute

- 🐛 **Report Bugs** - [Open an issue](https://github.com/LFGBanditLabs/Quipay/issues/new)
- 💡 **Suggest Features** - Share your ideas
- 📝 **Improve Documentation** - Help others understand Quipay
- 💻 **Submit PRs** - Check our [good first issues](https://github.com/LFGBanditLabs/Quipay/labels/good%20first%20issue)

See our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md)

---

## 📊 Roadmap

| Phase       | Milestone                            | Timeline | Status         |
| ----------- | ------------------------------------ | -------- | -------------- |
| **Phase 1** | Core Protocol (Streaming + Treasury) | Q1 2026  | 🚧 In Progress |
| **Phase 2** | AI Automation Integration            | Q2 2026  | 📋 Planned     |
| **Phase 3** | Compliance & Reporting               | Q3 2026  | 📋 Planned     |
| **Phase 4** | Enterprise Features                  | Q4 2026  | 📋 Planned     |

---

## 📜 License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-LFGBanditLabs%2FQuipay-181717?logo=github)](https://github.com/LFGBanditLabs/Quipay)
[![Stellar](https://img.shields.io/badge/Stellar-Learn%20More-7D00FF?logo=stellar)](https://stellar.org)
[![Soroban Docs](https://img.shields.io/badge/Soroban-Documentation-00D4FF)](https://developers.stellar.org/docs/build/smart-contracts)
[![Issues](https://img.shields.io/github/issues/LFGBanditLabs/Quipay)](https://github.com/LFGBanditLabs/Quipay/issues)

</div>

---

<div align="center">

**Built with ❤️ on Stellar**

_Empowering the future of work, one stream at a time_

[⭐ Star us on GitHub](https://github.com/LFGBanditLabs/Quipay) • [🐦 Follow updates](#) • [💬 Join our community](#)

</div>
