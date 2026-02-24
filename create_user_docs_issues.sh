#!/bin/bash

# Quipay User-Centric Documentation Issues Creator
# Creates 12 high-detail professional user-facing documentation issues

REPO="LFGBanditLabs/Quipay"

echo "Creating 12 high-detail user-facing documentation issues for $REPO..."

gh issue create --repo $REPO --title "[Docs] Step-by-Step Guide: Setting Up Your Employer Treasury" \
  --label "documentation,difficulty:easy" \
  --body "## Description
Create a definitive, beginner-friendly guide for employers to set up their first Treasury. This document should serve as the primary onboarding resource for platform administrators.

## Component
User Documentation / Employer Onboarding

## Difficulty
🟢 Easy

## Tasks
- [ ] Document the process of connecting a Stellar wallet (Freighter).
- [ ] Create instructions for the 'Initialize Treasury' on-chain call.
- [ ] Detail the process of depositing XLM and other Stellar Assets (USDC).
- [ ] Explain the 'Available Balance' concept and how it relates to liabilities.
- [ ] Include clear warning signs for 'Low Solvency' and how to resolve them.

## Acceptance Criteria
- [ ] A non-technical employer can successfully fund their first payroll.
- [ ] Guide includes 'Pro-Tips' for secure key management.
- [ ] Clear screenshots or step-by-step UI markers are defined.

## Estimated Time
6-8 hours"

gh issue create --repo $REPO --title "[Docs] Tutorial: Creating and Managing Payroll Streams" \
  --label "documentation,difficulty:medium" \
  --body "## Description
Develop a comprehensive tutorial on how to use the Payroll Streaming engine. This is for employers who need to start, monitor, and cancel salary flows.

## Component
User Documentation / Payroll Engine

## Difficulty
🟡 Medium

## Tasks
- [ ] Explain the difference between 'Rate per Second' and 'Total Monthly Salary'.
- [ ] Step-by-step guide for filling out the 'Create Stream' form.
- [ ] Document how to monitor active streams in the dashboard.
- [ ] Create a guide on when and how to safely cancel a stream.
- [ ] Detail the final payout mechanics that occur upon cancellation.

## Acceptance Criteria
- [ ] Employers understand the math behind second-by-second accrual.
- [ ] Clear instructions for handling workers with multiple payment tokens.

## Estimated Time
8-10 hours"

gh issue create --repo $REPO --title "[Docs] Worker Quickstart: Claiming Your Real-Time Salary" \
  --label "documentation,difficulty:easy" \
  --body "## Description
Create a high-energy, simple guide for workers joining a Quipay payroll stream. Focus on the 'Real-Time' benefit and ease of withdrawal.

## Component
User Documentation / Worker Onboarding

## Difficulty
🟢 Easy

## Tasks
- [ ] Guide on connecting a worker wallet.
- [ ] Instructions for viewing 'Accrued' vs 'Withdrawable' earnings.
- [ ] Step-by-step for performing a withdrawal (The 'Cash Out' moment).
- [ ] How to view payment history and verify transactions on-chain.

## Acceptance Criteria
- [ ] Workers feel confident and excited about getting paid every second.
- [ ] Zero confusion between 'accrued' and 'withdrawn' amounts.

## Estimated Time
4-6 hours"

gh issue create --repo $REPO --title "[Docs] Guide: Advanced Treasury Solvency & Risk Management" \
  --label "documentation,security,difficulty:medium" \
  --body "## Description
A guide for finance teams and treasury managers on how to maintain a 100% solvent payroll system using Quipay's risk tools.

## Component
User Documentation / Risk Management

## Difficulty
🟡 Medium

## Tasks
- [ ] Define 'Solvency Invariants' in plain English for finance professionals.
- [ ] Guide on interpreting the 'Liability Ledger'.
- [ ] Instructions for setting up automated low-balance alerts.
- [ ] Best practices for treasury rebalancing and asset allocation.

## Acceptance Criteria
- [ ] Finance teams understand why a transaction might be blocked (solvency check).
- [ ] Clear path to resolution for any 'Treasury Exhaustion' warnings.

## Estimated Time
10-12 hours"

gh issue create --repo $REPO --title "[Docs] Tutorial: Automating Payroll with the AI Agent" \
  --label "documentation,backend,difficulty:medium" \
  --body "## Description
Document how employers can 'set and forget' their payroll using the off-chain AI Automation agent.

## Component
User Documentation / AI Automation

## Difficulty
🟡 Medium

## Tasks
- [ ] Guide on authorizing an AI agent via the Automation Gateway.
- [ ] How to set up recurring payroll schedules for a workforce.
- [ ] Instructions for 'Conversational Payroll' (Natural Language commands).
- [ ] Security guide on 'Permission Revocation' for agents.

## Acceptance Criteria
- [ ] Employers can safely delegate automation to the AI agent.
- [ ] Clear understanding of the 'Confirmation Step' required for high-value actions.

## Estimated Time
10-14 hours"

gh issue create --repo $REPO --title "[Docs] Help Center: Frequently Asked Questions (FAQ)" \
  --label "documentation,difficulty:easy" \
  --body "## Description
Compile an exhaustive list of common questions and troubleshooting steps into a searchable Help Center.

## Component
User Documentation / Support

## Difficulty
🟢 Easy

## Tasks
- [ ] List FAQs on: Wallet connection, Gas fees, XLM requirements, Token support.
- [ ] Troubleshooting: 'Transaction Failed', 'Account not funded', 'Invalid Address'.
- [ ] Security FAQ: 'Is my money safe?', 'Who controls the keys?'.

## Acceptance Criteria
- [ ] Reduces common support requests.
- [ ] Searchable and categorized for quick access.

## Estimated Time
6-8 hours"

gh issue create --repo $REPO --title "[Docs] Guide: Tax & Compliance Reporting" \
  --label "documentation,difficulty:medium" \
  --body "## Description
Professional guide on how to extract and use data from Quipay for financial audits and tax filings.

## Component
User Documentation / Compliance

## Difficulty
🟡 Medium

## Tasks
- [ ] Instructions for downloading CSV and PDF payroll summaries.
- [ ] How to map on-chain transactions to local currency for accounting.
- [ ] Guide for external auditors on verifying the immutable payment ledger.

## Acceptance Criteria
- [ ] Accountants can easily ingest Quipay data into standard software (Quickbooks, etc.).
- [ ] Clear audit trail documentation provided.

## Estimated Time
8-12 hours"

gh issue create --repo $REPO --title "[Docs] Developer Tutorial: Building Your First Quipay Integration" \
  --label "documentation,difficulty:hard" \
  --body "## Description
Create a 'Hello World' style tutorial for developers wanting to build on top of or integrate with the Quipay protocol.

## Component
Developer Documentation / SDK

## Difficulty
🔴 Hard

## Tasks
- [ ] Setting up the development environment (Stellar CLI, Rust).
- [ ] Calling the \`register_worker\` function from a script.
- [ ] Subscribing to payroll events via webhooks.
- [ ] Basic troubleshooting for contract client generation.

## Acceptance Criteria
- [ ] An external developer can complete a basic integration in 60 minutes.
- [ ] Code examples are copy-paste ready and tested.

## Estimated Time
12-16 hours"

gh issue create --repo $REPO --title "[Docs] Guide: DAO & Multisig Protocol Management" \
  --label "documentation,security,difficulty:medium" \
  --body "## Description
A specialized guide for decentralized organizations on how to manage Quipay through collective governance.

## Component
User Documentation / DAO Governance

## Difficulty
🟡 Medium

## Tasks
- [ ] Guide on initializing a treasury with a multisig owner.
- [ ] Instructions for approving 'Payroll Proposals' in the UI.
- [ ] Best practices for distributed treasury responsibility.

## Acceptance Criteria
- [ ] DAOs understand how to use Quipay without a single point of failure.
- [ ] Compatible with major Stellar multisig tools.

## Estimated Time
8-10 hours"

gh issue create --repo $REPO --title "[Docs] Visual Guide: Understanding the Quipay Dashboard" \
  --label "documentation,difficulty:easy" \
  --body "## Description
Create a visual overview of the application interface, explaining every chart, button, and indicator.

## Component
User Documentation / UI Reference

## Difficulty
🟢 Easy

## Tasks
- [ ] Create an annotated map of the Employer Dashboard.
- [ ] Create an annotated map of the Worker Dashboard.
- [ ] Explain 'Real-time Trends' vs 'Historical Summaries'.
- [ ] Define the meaning of every status badge (Active, Warning, Completed).

## Acceptance Criteria
- [ ] Users feel oriented within seconds of logging in.
- [ ] UI terms are consistently defined and explained.

## Estimated Time
6-8 hours"

gh issue create --repo $REPO --title "[Docs] Guide: Security Best Practices for On-Chain Payroll" \
  --label "documentation,security,difficulty:medium" \
  --body "## Description
A vital security guide for all users on how to protect their assets and identity while using decentralized payroll.

## Component
User Documentation / Security

## Difficulty
🟡 Medium

## Tasks
- [ ] Hardware wallet integration guide.
- [ ] Phishing awareness and verification of contract addresses.
- [ ] Guidance on 'Signature Request' hygiene.
- [ ] Data privacy: What is shared on-chain vs off-chain.

## Acceptance Criteria
- [ ] Users understand their responsibility in a self-custodial system.
- [ ] Clear, actionable security tips provided.

## Estimated Time
8-10 hours"

gh issue create --repo $REPO --title "[Docs] Protocol Litepaper: The Future of Autonomous Work" \
  --label "documentation,difficulty:hard" \
  --body "## Description
Write a conceptual whitepaper/litepaper that explains the 'Quipay Method'—why second-by-second payroll is the future of the global economy.

## Component
Documentation / Concept

## Difficulty
🔴 Hard

## Tasks
- [ ] Detail the economic advantages of streaming payments for liquidity.
- [ ] Explain the trustless nature of automated solvency.
- [ ] Outline the long-term vision for the Quipay ecosystem.

## Acceptance Criteria
- [ ] High-level strategic document suitable for partners and the web3 community.
- [ ] Clear, visionary language that defines the project's 'Big Idea'.

## Estimated Time
15-20 hours"

echo "✅ All 12 user-centric documentation issues created successfully!"
