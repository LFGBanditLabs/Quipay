# Contributing to Quipay

Thank you for your interest in contributing to Quipay! This guide covers everything you need to get started.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Format](#commit-format)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Smart Contracts](#smart-contracts)

## Prerequisites

| Tool        | Version | Purpose                       |
| ----------- | ------- | ----------------------------- |
| Node.js     | >= 22   | Frontend and backend runtime  |
| npm         | >= 10   | Package management            |
| Rust        | 1.89+   | Smart contract development    |
| Docker      | latest  | Local development environment |
| stellar-cli | latest  | Contract build and deployment |

Optional but recommended:

- [Freighter Wallet](https://www.freighter.app/) browser extension for testing wallet interactions

## Development Setup

### Quick Start (Docker)

The fastest way to get the full stack running:

```bash
# Clone the repository
git clone https://github.com/LFGBanditLabs/Quipay.git
cd Quipay

# Start the full stack (frontend + backend + database)
make dev
```

This runs `docker compose up --build`, which starts:

- Frontend at `http://localhost:5173`
- Backend API at `http://localhost:3000`
- PostgreSQL database with automatic migrations and seed data

### Manual Setup

If you prefer to run services individually:

**Frontend:**

```bash
# Install dependencies
npm install

# Set up pre-commit hooks
npm run prepare

# Copy environment config
cp .env.example .env

# Start the dev server
npm run dev
```

**Backend:**

```bash
cd backend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Run database migrations
npm run migration:run

# Seed the database
npm run seed

# Start the dev server
npm run dev
```

**Smart Contracts:**

```bash
# Install the wasm target
rustup target add wasm32v1-none

# Build all contracts
stellar contract build

# Run contract tests
cargo test
```

## Project Structure

```
Quipay/
  contracts/               # Soroban smart contracts (Rust)
    payroll_vault/         # Treasury management
    payroll_stream/        # Salary streaming
    workforce_registry/    # Worker profiles
    automation_gateway/    # AI agent routing
    common/                # Shared types and errors
  backend/                 # Express.js API server
    src/
      db/                  # Database schema, migrations, queries
      routes/              # API endpoints
      services/            # Business logic
      middleware/          # Auth, validation, rate limiting
  src/                     # React frontend (Vite)
    components/            # Reusable UI components
    pages/                 # Page-level components
    hooks/                 # Custom React hooks
    lib/                   # Utilities and contract clients
  infra/                   # Terraform infrastructure configs
  docs/                    # Documentation and runbooks
  tests/                   # End-to-end Playwright tests
```

## Development Workflow

1. **Find or create an issue** describing the work
2. **Fork the repository** and create a feature branch from `main`
3. **Make your changes** following the code style and testing guidelines
4. **Test locally** to verify everything works
5. **Submit a pull request** referencing the issue

### Branch Naming

Use descriptive branch names:

```
feat/stream-pause-resume
fix/treasury-balance-display
docs/api-reference-update
refactor/contract-error-types
```

## Testing

### Frontend

```bash
# Unit and snapshot tests
npm test

# Update snapshot baselines intentionally after UI changes
npm run test:update-snapshots

# End-to-end tests (requires dev server running)
npm run test:e2e

# Interactive test mode
npm run test:e2e:ui
```

Snapshot tests fail automatically in CI when rendered output diverges from the committed baseline. If a visual change is intentional, run `npm run test:update-snapshots`, review the generated snapshot diff, and include it in your pull request.

### Backend

```bash
cd backend

# Unit tests
npm run test:unit

# Integration tests (requires database)
npm run test:integration

# Watch mode
npm run test:watch
```

### Smart Contracts

```bash
# Run all contract tests
cargo test

# Run tests for a specific contract
cargo test -p payroll-stream
cargo test -p payroll-vault

# Run with output
cargo test -- --nocapture
```

## Code Style

### TypeScript (Frontend and Backend)

- **Prettier** handles formatting (runs automatically on commit via Husky)
- **ESLint** enforces linting rules (auto-fixable issues corrected on commit)
- Run `npm run format` to format manually
- Run `npm run lint` to check for issues

### Rust (Smart Contracts)

- Run `cargo fmt` before committing
- Run `cargo clippy -- -D warnings` to check for lint issues
- Use `Result<T, E>` for fallible operations
- Follow Soroban SDK patterns: `#[contractimpl]`, `Env`, `require_auth`

## Commit Format

Commit messages are **automatically validated** by [commitlint](https://commitlint.js.org/) via a Husky `commit-msg` hook. Non-conforming messages will be rejected locally and in CI.

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

### Valid Types

| Type       | When to use                                     |
| ---------- | ----------------------------------------------- |
| `feat`     | A new feature                                   |
| `fix`      | A bug fix                                       |
| `docs`     | Documentation only changes                      |
| `style`    | Formatting, whitespace (no logic change)        |
| `refactor` | Code change that is neither a fix nor a feature |
| `test`     | Adding or updating tests                        |
| `chore`    | Build tooling, dependencies, config             |
| `ci`       | CI/CD pipeline changes                          |
| `perf`     | Performance improvements                        |
| `revert`   | Reverting a previous commit                     |

### Rules

- Header max length: **100 characters**
- Subject must not use Start Case, PascalCase, or UPPER CASE
- Type must not be empty

### Examples

```
feat(streams): add pause and resume functionality
fix(vault): correct treasury balance calculation on withdrawal
docs(api): update stream creation endpoint documentation
test(contracts): add edge case tests for batch claims
ci(commitlint): enforce conventional commit messages
```

### Bypassing hooks (not recommended)

Use `--no-verify` sparingly — commits that bypass hooks will fail CI:

```bash
git commit --no-verify -m "wip"
```

## Pull Request Process

1. **Fill out the PR template** completely
2. **Reference the issue** using `Closes #issue-number`
3. **Ensure CI passes** - all checks must be green before review
4. **Keep PRs focused** - one logical change per PR
5. **Respond to review feedback** promptly

### PR Checklist

Before submitting, verify:

- [ ] Code follows the project's style guidelines
- [ ] Tests added or updated for the changes
- [ ] Documentation updated if needed
- [ ] No unrelated changes included
- [ ] Commit messages follow the conventional format
- [ ] CI checks pass locally

## Issue Guidelines

### Bug Reports

When reporting a bug, include:

- Steps to reproduce
- Expected vs actual behavior
- Browser/OS/Node version if relevant
- Screenshots or error logs

### Feature Requests

When requesting a feature, include:

- Problem statement (what is missing or painful)
- Proposed solution
- Acceptance criteria

## Smart Contracts

Contract changes require extra care due to their immutable nature once deployed.

### Before Submitting Contract Changes

- [ ] All existing tests pass (`cargo test`)
- [ ] New tests cover the change
- [ ] `cargo fmt` applied
- [ ] `cargo clippy -- -D warnings` is clean
- [ ] Consider upgrade implications if modifying storage layout
- [ ] Document any new error variants
- [ ] Verify `require_auth` is used for all privileged operations

### Testing Contract Changes

```bash
# Full test suite
cargo test

# With verbose output for debugging
cargo test -- --nocapture

# Specific test
cargo test test_name_here
```

## Pre-commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to automatically format and lint code before commits.

The pre-commit hook runs:

- **ESLint** with auto-fix for TypeScript files
- **Prettier** to format all files

### Bypassing Hooks (Emergency Use Only)

```bash
git commit --no-verify -m "Your commit message"
```

Use `--no-verify` sparingly. Commits that bypass hooks may fail CI checks.

## Architecture Decision Records (ADRs)

Significant architectural decisions are documented as ADRs in [`docs/adr/`](./docs/adr/).

### When to write an ADR

Write an ADR when you are making a decision that:

- Affects the overall structure of the system (contracts, backend, frontend).
- Introduces a new dependency or platform.
- Changes a security-relevant pattern (auth model, key management, fee handling).
- Will be hard or expensive to reverse later.

You do **not** need an ADR for routine bug fixes, UI tweaks, or adding tests.

### How to write an ADR

1. Copy [`docs/adr/0000-template.md`](./docs/adr/0000-template.md) to `docs/adr/ADR-NNN-short-title.md`.
2. Fill in all sections. Context and Consequences are mandatory.
3. Open a PR with status set to `Proposed`. It becomes `Accepted` when the PR merges.
4. Add an entry to [`docs/adr/README.md`](./docs/adr/README.md).

### ADR checklist (for PR reviewers)

- [ ] Context explains _why_ a decision was needed, not just what it is.
- [ ] Decision section starts with "We will…" or "We decided to…".
- [ ] Alternatives considered are listed with rejection rationale.
- [ ] Positive and Negative consequences are both filled in.
- [ ] Related ADRs are cross-linked.

## Questions?

Open a [GitHub Discussion](https://github.com/LFGBanditLabs/Quipay/discussions) or reach out in the issue tracker.
