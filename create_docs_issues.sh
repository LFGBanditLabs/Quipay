#!/bin/bash

# Quipay Documentation Issues Creator
# Creates 12 high-detail professional documentation issues

REPO="LFGBanditLabs/Quipay"

echo "Creating 12 high-detail documentation issues for $REPO..."

gh issue create --repo $REPO --title "[Docs] Comprehensive Technical Design Document (TDD)" \
  --label "documentation,difficulty:medium" \
  --body "## Description
Develop a deep-dive Technical Design Document that expands on the implementation plan. This should serve as the blueprint for senior engineers working on the protocol.

## Tasks
- [ ] Document low-level logic flows for streaming accrual
- [ ] Create sequence diagrams for cross-contract calls
- [ ] Detail storage layout and indexing strategy
- [ ] Document authorization boundary logic between Treasury and Stream contracts

## Acceptance Criteria
- [ ] TDD is complete enough for an external developer to understand the internal mechanics
- [ ] Includes visual diagrams (Mermaid or similar)
- [ ] Approved by core tech leads"

gh issue create --repo $REPO --title "[Docs] Security Threat Model & Risk Assessment" \
  --label "documentation,security,difficulty:hard" \
  --body "## Description
Formalize a security threat model to identify potential attack vectors (reentrancy, timestamp manipulation, authorization bypass) and document the explicit mitigations implemented in the code.

## Tasks
- [ ] Identify trust boundaries in the multi-contract system
- [ ] Document potential Dos (Denial of Service) vectors regarding storage rental
- [ ] List all 'Admin-only' functions and their impact if keys are compromised
- [ ] Create a mitigation matrix for every identified high-priority risk

## Acceptance Criteria
- [ ] A living document exists that security auditors can review
- [ ] Mitigations are linked to specific lines of code or invariants"

gh issue create --repo $REPO --title "[Docs] Smart Contract Low-Level Specification" \
  --label "documentation,contract,difficulty:medium" \
  --body "## Description
Create a definitive technical specification for every smart contract entry-point, storage key, and data event.

## Tasks
- [ ] Document all \`pub\` functions with parameters and return types
- [ ] Describe storage keys and their lifetime (Persistent vs Temporary)
- [ ] Document event schema for off-chain indexers
- [ ] Define error code meanings (QuipayError enum reference)

## Acceptance Criteria
- [ ] Serves as the 'Source of Truth' for the contract client generation
- [ ] Fully comprehensive coverage of all 4 contracts"

gh issue create --repo $REPO --title "[Docs] User Guide: Employer Treasury Management" \
  --label "documentation,difficulty:easy" \
  --body "## Description
Write a step-by-step guide for employers on how to manage their funds securely within the Quipay protocol.

## Tasks
- [ ] Guide for initial treasury initialization
- [ ] Instructions for depositing different Stellar assets
- [ ] Explanation of 'Available Balance' vs 'Total Balance'
- [ ] Troubleshooting common transaction failures (solvency issues)

## Acceptance Criteria
- [ ] Non-technical employers can fund their payroll without support
- [ ] Includes screenshots or UI walkthroughs"

gh issue create --repo $REPO --title "[Docs] User Guide: Worker Earnings & Streaming" \
  --label "documentation,difficulty:easy" \
  --body "## Description
Create a helpful guide for workers to understand how real-time streaming works and how to withdraw their earnings.

## Tasks
- [ ] Explain the accrual process (earnings per second)
- [ ] Step-by-step on connecting wallets and claiming funds
- [ ] Guide on tracking multiple streams from different employers

## Acceptance Criteria
- [ ] Clear, encouraging language for workers
- [ ] Focuses on the 'Real-Time' benefit of the platform"

gh issue create --repo $REPO --title "[Docs] Governance Guide: Decentralized Treasury Control" \
  --label "documentation,security,difficulty:medium" \
  --body "## Description
Document how DAOs and multi-signature teams should configure and manage their Quipay protocols for maximum security.

## Tasks
- [ ] Best practices for multisig threshold configurations
- [ ] Guide on using the Automation Gateway with team-governed agents
- [ ] Disaster recovery steps for compromised keys

## Acceptance Criteria
- [ ] Professional guide for enterprise and DAO clients
- [ ] Focuses on protocol safety and decentralized governance"

gh issue create --repo $REPO --title "[Docs] Integration Guide: Building Custom AI Agents" \
  --label "documentation,backend,difficulty:medium" \
  --body "## Description
Provide external developers with the knowledge needed to build their own AI agents that interact with the Automation Gateway.

## Tasks
- [ ] Document the Agent-Gateway handshake protocol
- [ ] Provide example code for authorizing a new agent
- [ ] List available commands (create, cancel, rebalance) with schemas

## Acceptance Criteria
- [ ] A developer can build and connect a custom agent in under 2 hours
- [ ] Includes code snippets in TypeScript and Python"

gh issue create --repo $REPO --title "[Docs] Compliance & Audit Trail Documentation" \
  --label "documentation,difficulty:medium" \
  --body "## Description
Explain how to use Quipay's on-chain and off-chain logs for regulatory compliance and financial auditing.

## Tasks
- [ ] Detail how to verify transactions on the Stellar Explorer
- [ ] Guide for extracting CSV/PDF reports for tax reporting
- [ ] Technical guide on audit trail immutability

## Acceptance Criteria
- [ ] Financial auditors can verify payroll integrity
- [ ] Useful for teams in regulated jurisdictions"

gh issue create --repo $REPO --title "[Docs] Contributor & Coding Style Guide" \
  --label "documentation,difficulty:easy" \
  --body "## Description
Establish clear standards for contributors to ensure the codebase remains maintainable and secure.

## Tasks
- [ ] Define Rust/Soroban coding standards (clippy, formatting)
- [ ] Define React/TypeScript frontend patterns
- [ ] Documentation requirements for new PRs
- [ ] Testing requirements (minimum coverage)

## Acceptance Criteria
- [ ] New contributors know exactly how to format and test their code
- [ ] Reduces overhead for core code reviewers"

gh issue create --repo $REPO --title "[Docs] System Architecture Overview (Visual)" \
  --label "documentation,difficulty:medium" \
  --body "## Description
Create a set of high-quality architectural diagrams showing the full stack from Stellar Ledger to Frontend UI.

## Tasks
- [ ] C4 System Context Diagram
- [ ] Component Diagram for the Smart Contract module
- [ ] Sequence diagram for 'The Life of a Stream'
- [ ] Data flow diagram for AI Agent monitoring

## Acceptance Criteria
- [ ] Diagrams used in README and technical docs
- [ ] Professionally rendered and easy to read"

gh issue create --repo $REPO --title "[Docs] Protocol Litepaper" \
  --label "documentation,difficulty:hard" \
  --body "## Description
Write a high-level conceptual document (Litepaper) that explains the Quipay value proposition to partners, investors, and the community.

## Tasks
- [ ] Explain the 'Autonomous Payroll' concept
- [ ] Highlight Stellar/Soroban advantages (speed, cost)
- [ ] Describe the protocol's economic and trust model
- [ ] Outline the vision for the future of global work

## Acceptance Criteria
- [ ] Professional marketing/technical híbrido document
- [ ] Suitable for inclusion in project pitches"

gh issue create --repo $REPO --title "[Docs] Audit Readiness Documentation" \
  --label "documentation,security,difficulty:hard" \
  --body "## Description
Prepare all necessary documentation, proof of work, and formal specifications for an external smart contract audit.

## Tasks
- [ ] Consolidate all architectural decisions
- [ ] List all security invariants and their test results
- [ ] Provide a 'guided tour' for auditors through the codebase
- [ ] Document known limitations or out-of-scope items

## Acceptance Criteria
- [ ] Significantly reduces the time/cost of a professional audit
- [ ] Shows high institutional rigor and transparency"

echo "✅ All 12 high-detail documentation issues created successfully!"
