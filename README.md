<div align="center">
  <img src="public/quipay-logo-yellow.png" width="96" height="96" alt="Quipay Logo" />
  <h1>Quipay</h1>
  <p><strong>Real-time payroll streaming on Stellar</strong></p>

[![License](https://img.shields.io/badge/License-Apache%202.0-facc15?style=flat-square&labelColor=000)](LICENSE)
[![Built on Stellar](https://img.shields.io/badge/Built%20on-Stellar-facc15?style=flat-square&labelColor=000&logo=stellar&logoColor=white)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Contracts-Soroban-facc15?style=flat-square&labelColor=000)](https://soroban.stellar.org)
[![Issues](https://img.shields.io/github/issues/LFGBanditLabs/Quipay?style=flat-square&labelColor=000&color=facc15)](https://github.com/LFGBanditLabs/Quipay/issues)

[Overview](#overview) · [Features](#features) · [Architecture](#architecture) · [Quick Start](#quick-start) · [Contributing](#contributing)

</div>

---

## Overview

Quipay is an open-source payroll streaming protocol built on [Stellar](https://stellar.org). Instead of monthly salary cycles, workers earn continuously — every second, in real time, straight to their wallet.

Employers set up a payment stream once. The Soroban smart contract handles the rest: accrual, escrow, and instant withdrawal — no intermediaries, no waiting, no friction.

```
Employer deposits → Stream contract → Worker withdraws anytime
```

### Why Quipay?

|                | Traditional Payroll   | Quipay          |
| -------------- | --------------------- | --------------- |
| **Settlement** | 30 days               | Per second      |
| **Fees**       | 1–3% + wire fees      | ~$0.001         |
| **Custody**    | Bank holds funds      | On-chain escrow |
| **Withdrawal** | Payday only           | Anytime         |
| **Coverage**   | Bank account required | Stellar wallet  |

---

## Features

### For Employers

- **Payment Streams** — Set up continuous salary accrual with cliff dates and flow rates
- **Treasury Management** — Fund and monitor your payroll vault in one place
- **Workforce Registry** — Add workers, track streams, and manage your team
- **Payroll Dashboard** — Real-time visibility into active streams and total liabilities
- **Stream Templates** — Save and reuse common payment configurations
- **Governance** — Multi-sig support for DAOs and decentralized teams

### For Workers

- **Withdraw Anytime** — Access your earned balance at any moment — no waiting
- **Live Earnings** — Watch your balance grow in real time, per second
- **Stream Timeline** — Full visual history of your payment stream lifecycle
- **Payslip Downloads** — Generate verifiable PDF payslips on demand
- **Multi-Stream** — Manage income from multiple employers in one dashboard

---

## Architecture

### Smart Contracts (Soroban / Rust)

| Contract            | Purpose                                         | Status           |
| ------------------- | ----------------------------------------------- | ---------------- |
| `PayrollStream`     | Streaming logic, cliff dates, flow rate accrual | 🚧 In Progress   |
| `TreasuryVault`     | Employer escrow and liability tracking          | ✅ Base Complete |
| `WorkforceRegistry` | Worker profiles and payment preferences         | 📋 Planned       |
| `AutomationGateway` | AI agent authorization and execution routing    | 📋 Planned       |

### Stack

```
┌─────────────────────────────────────────────┐
│         Frontend  (Vite + React 18)         │
│  TypeScript · Tailwind CSS · Freighter SDK  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Smart Contracts  (Soroban / Rust)      │
│  PayrollStream · TreasuryVault · Registry   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Stellar Blockchain                │
│     3–5s finality · ~$0.001 per tx          │
└─────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://www.rust-lang.org/tools/install) 1.79+
- [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)

### Run locally

```bash
# Clone
git clone --depth 1 https://github.com/LFGBanditLabs/Quipay.git
cd Quipay

# Install dependencies
npm install

# Generate test data (optional)
npm run seed

# Start dev server
npm run dev
```

Frontend runs at **http://localhost:5173**

### Full stack with Docker

```bash
# Starts Postgres, Redis, Stellar Quickstart, backend, and frontend
make dev
```

| Service            | Port |
| ------------------ | ---- |
| Frontend           | 5173 |
| Backend API        | 3001 |
| Stellar Quickstart | 8000 |
| PostgreSQL         | 5432 |

Wait for the backend to log `✅ Services initialized` before connecting.

### Run tests

```bash
# Smart contract tests
cargo test

# Frontend unit tests
npm test

# E2E tests
npx playwright test
```

---

## Environment Variables

Copy `.env.example` to `.env` and adjust:

| Variable                     | Default                     | Description                     |
| ---------------------------- | --------------------------- | ------------------------------- |
| `PUBLIC_STELLAR_NETWORK`     | `LOCAL`                     | `LOCAL` · `TESTNET` · `MAINNET` |
| `PUBLIC_STELLAR_RPC_URL`     | `http://localhost:8000/rpc` | Soroban RPC endpoint            |
| `PUBLIC_STELLAR_HORIZON_URL` | `http://localhost:8000`     | Stellar Horizon endpoint        |
| `VITE_SITE_URL`              | `https://quipay.app`        | Canonical URL for metadata      |
| `VITE_API_BASE_URL`          | `http://localhost:3001`     | Backend API base URL            |

> When running via `make dev`, `VITE_API_BASE_URL` is injected automatically from `docker-compose.yml`.

---

## Project Structure

```
Quipay/
├── contracts/
│   ├── payroll_stream/       # Streaming payment logic
│   ├── payroll_vault/        # Treasury vault
│   ├── workforce_registry/   # Worker profiles (planned)
│   └── automation_gateway/   # AI authorization (planned)
├── backend/                  # Node.js webhook & DLQ service
│   ├── src/
│   │   ├── db/dlq.ts         # Dead Letter Queue management
│   │   ├── delivery.ts       # Webhook delivery service
│   │   ├── workers/          # Retry workers
│   │   └── tests/            # Integration tests
│   └── README.md             # Backend documentation
├── src/
│   ├── components/           # Reusable UI components
│   ├── pages/                # App pages (Dashboard, Stream, Settings…)
│   ├── hooks/                # Custom React hooks
│   └── contracts/            # Generated TypeScript contract clients
├── packages/                 # Auto-generated Stellar bindings
├── docs/                     # Architecture and design docs
└── environments.toml         # Network configurations
```

---

## Security

Payroll infrastructure requires the highest security bar. Quipay enforces:

- **Solvency invariants** — treasury balance ≥ total liabilities, checked on every state change
- **Strict authorization** — all fund movements require explicit caller verification
- **Double-withdrawal prevention** — safe accounting state machine prevents duplicate payouts
- **Timestamp validation** — cliff and stream time bounds validated against ledger time
- **Multi-sig ready** — TreasuryVault supports multi-signature Stellar accounts
- **Pre-mainnet audit** — full formal security review scheduled before mainnet launch

Found a vulnerability? See [SECURITY.md](SECURITY.md). Full analysis in the [Security Threat Model](docs/SECURITY_THREAT_MODEL.md).

---

## Roadmap

| Phase       | Milestone                            | Target  | Status         |
| ----------- | ------------------------------------ | ------- | -------------- |
| **Phase 1** | Core Protocol — streaming + treasury | Q1 2026 | 🚧 In Progress |
| **Phase 2** | AI Automation gateway                | Q2 2026 | 📋 Planned     |
| **Phase 3** | Compliance, reporting, payslips      | Q3 2026 | 📋 Planned     |
| **Phase 4** | Enterprise features + security audit | Q4 2026 | 📋 Planned     |

Track progress on the [GitHub Issues board](https://github.com/LFGBanditLabs/Quipay/issues).

---

## Contributing

Quipay is fully open source and welcomes contributions of all kinds.

```bash
# Fork → clone → branch
git checkout -b feat/your-feature

# Make changes, then open a PR against main
```

- 🐛 [Report a bug](https://github.com/LFGBanditLabs/Quipay/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/LFGBanditLabs/Quipay/issues/new?template=feature_request.md)
- 💻 [Good first issues](https://github.com/LFGBanditLabs/Quipay/labels/good%20first%20issue)

Read the [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before opening a PR.

---

## Documentation

| Doc                                                    | Description                              |
| ------------------------------------------------------ | ---------------------------------------- |
| [Product Requirements](docs/PRD.md)                    | Full product spec and user stories       |
| [Design Document](docs/design.md)                      | Technical architecture and system design |
| [Security Threat Model](docs/SECURITY_THREAT_MODEL.md) | Formal risk analysis and mitigations     |
| [DAO Treasury Setup](docs/DAO_TREASURY_SETUP.md)       | Multisig configuration for DAOs          |

---

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <img src="public/quipay-logo-yellow.png" width="36" alt="Quipay" />
  <br/>
  <sub>Built on Stellar · Open Source · Non-custodial</sub>
  <br/><br/>

[![Stars](https://img.shields.io/github/stars/LFGBanditLabs/Quipay?style=flat-square&labelColor=000&color=facc15)](https://github.com/LFGBanditLabs/Quipay/stargazers)
[![Forks](https://img.shields.io/github/forks/LFGBanditLabs/Quipay?style=flat-square&labelColor=000&color=facc15)](https://github.com/LFGBanditLabs/Quipay/network/members)

</div>
