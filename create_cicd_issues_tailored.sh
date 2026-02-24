#!/bin/bash

# Quipay Tailored CI/CD Issues Creator
# Creates 7 high-detail professional CI/CD issues based on the local stack

REPO="LFGBanditLabs/Quipay"

echo "Creating targeted CI/CD issues for $REPO..."

# Ensure label exists
gh label create "ci/cd" --description "Continuous Integration and Deployment" --color "0052cc" 2>/dev/null || true

gh issue create --repo $REPO --title "[CI/CD] GitHub Action: Soroban Smart Contract Build & Test" \
  --label "ci/cd,contract,difficulty:medium" \
  --body "## Description
Implement a CI pipeline to build, lint, and test the Rust-based Soroban contracts in the \`contracts/\` directory.

## Current Context
The project uses Soroban smart contracts. We need to ensure the \`wasm32-unknown-unknown\` target compiles successfully and all \`cargo test\` suites pass before merging.

## Tasks
- [ ] Create \`.github/workflows/contracts.yml\`
- [ ] Setup Rust toolchain and target \`wasm32-unknown-unknown\`
- [ ] Add caching for \`~/.cargo/registry\` and \`target/\`
- [ ] Step: Run \`cargo clippy\` and \`cargo fmt --check\`
- [ ] Step: Run \`cargo test\` across all contract members
- [ ] Step: Run \`cargo build --target wasm32-unknown-unknown --release\` to build the WASM artifacts

## Acceptance Criteria
- [ ] PRs changing Rust code require this check to pass
- [ ] Build times are optimized via caching"

gh issue create --repo $REPO --title "[CI/CD] GitHub Action: Vite + React Frontend Validation" \
  --label "ci/cd,frontend,difficulty:easy" \
  --body "## Description
Implement a CI pipeline to validate the Vite React frontend. It should check formatting, run linting, verify TypeScript types, and ensure the production bundle builds successfully.

## Current Context
The project uses Vite, React, TypeScript, and ESLint/Prettier (configured via package.json). It also uses npm workspaces (\`packages/*\`).

## Tasks
- [ ] Create \`.github/workflows/frontend.yml\`
- [ ] Use \`actions/setup-node\` with Node 20
- [ ] Cache npm dependencies
- [ ] Run \`npm ci\`
- [ ] Step: \`npm run lint\`
- [ ] Step: \`npm run format\` (check mode)
- [ ] Step: \`npm run build\` (which triggers \`tsc -b && vite build\`)

## Acceptance Criteria
- [ ] Any TypeScript or ESLint errors block the PR
- [ ] The Vite build succeeds without failing on dynamic imports or missing workspace packages"

gh issue create --repo $REPO --title "[CI/CD] Automated Preview Deployments (Frontend)" \
  --label "ci/cd,frontend,difficulty:medium" \
  --body "## Description
Set up PR Preview deployments for the frontend so reviewers can visually test the app before merging.

## Current Context
The frontend is a static Vite build in the root \`package.json\`.

## Tasks
- [ ] Connect the repo to Vercel, Netlify, or Cloudflare Pages
- [ ] Configure the build command as \`npm run build\` and output dir as \`dist\`
- [ ] Ensure environment variables (like Soroban RPC URLs) are injected into the preview environments (e.g., using Testnet defaults)

## Acceptance Criteria
- [ ] A bot comments on every PR with a temporary preview URL
- [ ] The preview environment successfully loads the dApp interface"

gh issue create --repo $REPO --title "[CI/CD] GitHub Action: Backend Node.js Services Check" \
  --label "ci/cd,backend,difficulty:easy" \
  --body "## Description
Validate the codebase within the \`backend/\` directory to ensure the AI agent and server code compiles and lints correctly.

## Current Context
The repository contains a \`backend/\` folder for off-chain automation. 

## Tasks
- [ ] Create \`.github/workflows/backend.yml\`
- [ ] Run \`npm ci\` inside the \`backend\` directory
- [ ] Run linting and unit tests for the backend code
- [ ] Enforce test coverage minimums if tests exist

## Acceptance Criteria
- [ ] Backend PRs block on test failures
- [ ] Node version used in CI matches the production runtime"

gh issue create --repo $REPO --title "[CI/CD] Husky Pre-commit Hooks Optimization" \
  --label "ci/cd,difficulty:easy" \
  --body "## Description
The repo has \`husky\` and \`lint-staged\` configured in \`package.json\`. Ensure it's working flawlessly for all team members.

## Current Context
There is a \`prepare: \"husky\"\` script and \`lint-staged\` running eslint and prettier.

## Tasks
- [ ] Verify the \`.husky/pre-commit\` file exists and correctly triggers \`npx lint-staged\`
- [ ] Test that committing a badly formatted file is successfully blocked and/or auto-fixed
- [ ] Add instructions to the CONTRIBUTING.md for bypassing hooks in emergencies (\`--no-verify\`)

## Acceptance Criteria
- [ ] All commits made locally are auto-formatted by Prettier
- [ ] Commits with unfixable ESLint errors are rejected"

gh issue create --repo $REPO --title "[CI/CD] Automated Contract Deployment Workflow (Testnet)" \
  --label "ci/cd,contract,difficulty:hard" \
  --body "## Description
Create a workflow that can be manually dispatched (or run on branch merge) to deploy the Soroban contracts to the Stellar Testnet.

## Tasks
- [ ] Create \`.github/workflows/deploy-testnet.yml\` with \`workflow_dispatch\` trigger
- [ ] Add a step to install the Stellar CLI
- [ ] Securely store a funding/deployer private key in GitHub Secrets (\`TESTNET_DEPLOYER_SECRET\`)
- [ ] Add steps to compile, deploy, and initialize the contracts on Testnet
- [ ] Output the deployed Contract IDs to the workflow summary

## Acceptance Criteria
- [ ] Authorized developers can deploy to Testnet via a click in the GitHub Actions UI
- [ ] Secrets are never leaked into the logs"

gh issue create --repo $REPO --title "[CI/CD] Require Status Checks and Branch Protection" \
  --label "ci/cd,difficulty:medium" \
  --body "## Description
Configure the \`main\` branch settings in GitHub to require our new CI pipelines before a merge is allowed.

## Current Context
Now that we have Frontend, Backend, and Contract GitHub Actions, we need to enforce them.

## Tasks
- [ ] Go to Repo Settings -> Branches -> Add branch protection rule for \`main\`
- [ ] Enable \"Require pull request reviews before merging\" (1 approval)
- [ ] Enable \"Require status checks to pass before merging\"
- [ ] Select the Frontend, Backend, and Contract CI jobs as required

## Acceptance Criteria
- [ ] It is impossible to push directly to \`main\`
- [ ] It is impossible to merge a PR if the CI jobs fail"

echo "✅ All tailored CI/CD issues created successfully!"
