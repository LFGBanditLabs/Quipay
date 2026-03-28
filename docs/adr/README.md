# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for Quipay. ADRs document significant architectural decisions made during the development of the project, including the context, rationale, and consequences of each decision.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences. ADRs help new contributors understand why certain design choices were made and provide a historical record of the project's evolution.

## ADR Format

Each ADR follows this structure:

- **Title**: A short, descriptive name for the decision
- **Status**: Current state (Proposed, Accepted, Deprecated, Superseded)
- **Context**: The situation that led to this decision
- **Decision**: What was decided and why
- **Consequences**: The positive and negative outcomes of this decision

## Index

- [ADR-001: Vault-Stream Separation Pattern](./ADR-001-vault-stream-separation.md)
- [ADR-002: Time-Based Stream Computation](./ADR-002-time-based-stream-computation.md)
- [ADR-003: Automation Gateway Authorization Model](./ADR-003-automation-gateway-authorization.md)
- [ADR-004: Backend Monitoring Architecture](./ADR-004-backend-monitoring-architecture.md)
- [ADR-005: Stellar Network and Soroban Platform Selection](./ADR-005-stellar-network-selection.md)

## Creating a New ADR

1. Copy [0000-template.md](./0000-template.md) to a new file named `ADR-NNN-short-title.md` where `NNN` is the next sequential number.
2. Fill in every section. The **Context** and **Consequences** sections are the most important.
3. Set the status to `Proposed` and open a PR. Change to `Accepted` once merged.
4. Add an entry to the index above in this README.
5. Reference the ADR from any relevant code using an inline comment, e.g. `// See docs/adr/ADR-001-vault-stream-separation.md`.
