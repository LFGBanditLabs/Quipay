
dx: add local development seed script with realistic test data

Description
Summary
New contributors must manually create test data after running the dev environment. There is no seed script, making onboarding slow and error-prone.

Problem
No npm run seed or equivalent command
Developers spend 30+ minutes manually creating employers, workers, and streams
Inconsistent local state makes bug reproduction difficult
Proposed Solution
Write scripts/seed.ts using the Quipay SDK + Stellar testnet
Seed: 2 employer accounts, 5 worker accounts, 10 active streams, 3 expired streams
Output: wallet addresses and private keys to seed-output.json (gitignored)
Add to README.md under Getting Started
Acceptance Criteria
- [x] npm run seed creates consistent test data set
- [x] Seed is idempotent (re-running clears and recreates)
- [x] Seed output file documents all created accounts
- [x] Works on fresh Stellar testnet with testnet XLM faucet
- [x] Documented in CONTRIBUTING.md