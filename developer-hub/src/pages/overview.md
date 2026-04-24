---
title: Protocol Overview
---

# Quipay Protocol Overview

Quipay is an autonomous payroll streaming protocol on Stellar Soroban. It enables continuous, second-by-second salary accrual settled on-chain — no banks, no delays, no intermediaries.

## Core Contracts

| Contract              | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| **PayrollStream**     | Streams salary from employer treasury to worker wallet in real time       |
| **PayrollVault**      | Custodian for employer funds with on-chain solvency enforcement           |
| **WorkforceRegistry** | Decentralized worker profile and preferred-token registry                 |
| **AutomationGateway** | Permissioned agent framework for AI-driven payroll automation _(Phase 2)_ |
| **DAOGovernance**     | On-chain governance for protocol parameter updates _(Phase 3)_            |

## How It Works

1. Employer funds the **PayrollVault** with USDC, XLM, or any Stellar asset
2. Employer creates a **PayrollStream** specifying worker address, rate, and start time
3. Worker accrues salary every second — claimable at any time
4. Treasury solvency is enforced on-chain: streams pause automatically if funds run low

## Developer Resources

- [Quick Start](../docs/getting-started)
- [Contract Reference](../docs/contracts)
- [REST API](../docs/api)
- [GitHub](https://github.com/LFGBanditLabs/Quipay)
