## What

Improves the local development seed script to be fully idempotent, crash-free, and execute seamlessly without interactive prompts.

## Why

This PR addresses the issues identified with the recently added seed script, which was failing to execute cleanly and not adhering to the idempotency requirement. Resolving this ensures a smooth onboarding experience for new contributors setting up their local test environment.

Closes # <!-- Add issue number here -->

## Changes

- **Updated seed script in `package.json` to use `npx --yes tsx`**: Prevents `npx` from pausing execution with interactive installation prompts without modifying dependencies, resolving CI package-lock sync errors.
- **Fixed `GetTransactionStatus` Enum Crash**: Replaced the deprecated `SorobanRpc.Api.GetTransactionStatus` enum in `scripts/seed.ts` with correct string literals (`"NOT_FOUND"`, `"PENDING"`, `"SUCCESS"`) to be compatible with `@stellar/stellar-sdk` v14+.
- **Implemented True Idempotency**: Updated `scripts/seed.ts` to read `seed-output.json` on subsequent runs and reuse existing keypairs instead of continuously generating new, orphaned Stellar accounts.
- **Removed Duplicate Declarations**: Cleaned up a duplicate constant declaration (`outPath`) in the seed script.
- **Updated `issue.md`**: Fixed acceptance criteria formatting to use standard markdown checkboxes and marked them as complete.

## Testing

- [x] Existing tests pass
- [ ] New tests added (if applicable)
- [x] Manually tested locally

## Checklist

- [x] Code follows project style guidelines
- [x] Commit messages use conventional format
- [x] No unrelated changes included
- [x] Documentation updated (if applicable)
- [ ] Contract changes reviewed for security implications (if applicable)
