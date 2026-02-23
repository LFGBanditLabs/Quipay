# Quipay: AI-Powered Decentralized Payroll

## 1. Project Overview

**Quipay** is an intelligent, autonomous payroll protocol on Stellar. It combines **Soroban streaming payments** with an **AI Agent** that manages your entire global workforce treasury.

**The Vision:** "Payroll on Autopilot."

- **AI-Managed Treasury:** "Hey Quipay, run payroll for February." -> The AI verifies balances, calculates amounts, and queues the transaction for your signature.
- **Top-Tier UI:** A "Glassmorphism" aesthetic with smooth animations.
- **Instant Cross-Border:** USDC streaming and payments to 180+ countries.

## 2. Technical Architecture

### A. The AI Agent (The Brain)

- **Tech Stack:** Vercel AI SDK + OpenAI/Anthropic + Stellar JS SDK.
- **Capabilities:**
  - **Drafting Transactions:** The AI constructs the Soroban XDR for the user to sign.
  - **Compliance Sentinel:** Scans recipient addresses against sanctions lists.

### B. Smart Contracts (Soroban)

- **`PayrollVault`**: Holds company funds.
- **`SalaryStream`**: Vesting logic.
- **`BatchPayment`**: Mass payout logic.

### C. Premium UI/UX (The Face)

- **Aesthetic:** "Glassmorphism," dark mode, Framer Motion animations.
- **Interactive:** The "Run Payroll" button is a chat with the Agent.

## 3. Drips Wave Strategy

We leverage Drips to build the AI and Protocol modularly.

#### Trivial (100 pts)

- **UI:** Create "Glass card" components.
- **Prompts:** Refine the system prompt for the AI Agent.

#### Medium (150 pts)

- **AI Tool:** Build a function `get_wallet_balance` for the AI.
- **Viz:** Create a React component visualizing salary streaming.

#### High (200 pts)

- **AI Logic:** Implement "Natural Language to XDR" builder.
- **Contracts:** Optimize `BatchPayment` for 1000+ users.

## 4. Repo Structure

```
/backend
  - (AI Agent & API)
/smart_contract
  - (Soroban Rust Code)
/frontend
  - (Next.js + AI SDK UI)
```
