#!/bin/bash

# Quipay CI/CD Issues Creator
# Creates 7 high-detail professional CI/CD issues

REPO="LFGBanditLabs/Quipay"

echo "Creating CI/CD issues for $REPO..."

# Create a ci/cd label if it doesn't exist
gh label create "ci/cd" --description "Continuous Integration and Deployment" --color "0052cc" 2>/dev/null || echo "Label ci/cd already exists"

gh issue create --repo $REPO --title "[CI/CD] Set up GitHub Actions for Smart Contract Testing & Build" \
  --label "ci/cd,difficulty:medium" \
  --body "## Description
Implement a Continuous Integration (CI) pipeline to automatically build, lint, and test the Soroban smart contracts on every Pull Request and push to the main branch.

## Component
Smart Contracts / DevOps

## Difficulty
🟡 Medium

## Tasks
- [ ] Create \`.github/workflows/contracts-ci.yml\`
- [ ] Setup Rust toolchain with the \`wasm32-unknown-unknown\` target
- [ ] Add steps to run \`cargo clippy\` and \`cargo fmt --check\`
- [ ] Add step to run \`cargo test\` internally for all contract crates
- [ ] Build the \`.wasm\` artifacts to ensure compilation succeeds

## Acceptance Criteria
- [ ] PRs cannot be merged if the contract build or tests fail
- [ ] Build times are optimized using GitHub Actions caching for Rust

## Estimated Time
4-6 hours"

gh issue create --repo $REPO --title "[CI/CD] Set up GitHub Actions for Frontend CI (Lint, Typecheck, Build)" \
  --label "ci/cd,difficulty:easy" \
  --body "## Description
Implement a CI pipeline for the React/Vite frontend to catch TypeScript errors, styling issues, and build failures before they are merged.

## Component
Frontend / DevOps

## Difficulty
🟢 Easy

## Tasks
- [ ] Create \`.github/workflows/frontend-ci.yml\`
- [ ] Set up node.js environment (Node 20+)
- [ ] Add caching for \`npm\` dependencies
- [ ] Run \`npm run lint\` and \`npm run typecheck\`
- [ ] Run \`npm run build\` to verify production bundling

## Acceptance Criteria
- [ ] Any PR that introduces TypeScript errors is automatically blocked
- [ ] CI pipeline runs in under 3 minutes per PR

## Estimated Time
2-4 hours"

gh issue create --repo $REPO --title "[CI/CD] Automated Frontend Deployment to Vercel/Netlify" \
  --label "ci/cd,difficulty:easy" \
  --body "## Description
Set up Continuous Deployment (CD) for the frontend so that any code merged to the \`main\` branch automatically deploys to production, and PRs get preview deployments.

## Component
Frontend / DevOps

## Difficulty
🟢 Easy

## Tasks
- [ ] Connect the GitHub repository to the hosting provider (Vercel or Netlify)
- [ ] Configure build settings (\`npm run build\`, output directory: \`dist\`)
- [ ] Set up branch deployment rules (main -> production)
- [ ] Ensure Preview Environments are generated for every PR

## Acceptance Criteria
- [ ] Merging to main automatically updates the live website
- [ ] Developers can view PR changes through a preview URL before merging

## Estimated Time
1-2 hours"

gh issue create --repo $REPO --title "[CI/CD] Automated Smart Contract Deployment to Stellar Testnet" \
  --label "ci/cd,difficulty:hard" \
  --body "## Description
Automate the deployment and initialization of the Soroban smart contracts to the Stellar Testnet whenever changes are merged into the \`main\` branch.

## Component
Smart Contracts / DevOps

## Difficulty
🔴 Hard

## Tasks
- [ ] Create \`.github/workflows/deploy-contracts.yml\`
- [ ] Store Testnet deployer private keys securely in GitHub Secrets
- [ ] Script the deployment sequence using Stellar CLI or custom TS scripts
- [ ] Automatically update a registry file (e.g., \`testnet-addresses.json\`) with the new contract IDs and commit it back to the repo or publish it as an artifact.

## Acceptance Criteria
- [ ] The latest \`main\` branch code is always active on Testnet without manual intervention
- [ ] Private keys are securely handled and never exposed in logs

## Estimated Time
8-12 hours"

gh issue create --repo $REPO --title "[CI/CD] Integrate Automated Security Scanning for Rust Code" \
  --label "ci/cd,security,difficulty:medium" \
  --body "## Description
Integrate security auditing tools into the CI pipeline to automatically detect known vulnerabilities in Rust dependencies.

## Component
Security / DevOps

## Difficulty
🟡 Medium

## Tasks
- [ ] Create \`.github/workflows/security-audit.yml\`
- [ ] Integrate \`cargo audit\` to check for crates with reported vulnerabilities
- [ ] (Optional) Integrate \`cargo deny\` to enforce license compliance and ban specific unmaintained crates
- [ ] Set pipeline to fail if high-severity vulnerabilities are found

## Acceptance Criteria
- [ ] Vulnerable dependencies are blocked from entering the \`main\` branch
- [ ] Security checks run quickly and effectively

## Estimated Time
3-5 hours"

gh issue create --repo $REPO --title "[CI/CD] Enforce Branch Protection Rules and PR Templates" \
  --label "ci/cd,documentation,difficulty:easy" \
  --body "## Description
Configure the GitHub repository settings to enforce high code quality standards and prevent accidental pushes to production branches.

## Component
GitHub Repository

## Difficulty
🟢 Easy

## Tasks
- [ ] Create a thorough Pull Request template (\`PULL_REQUEST_TEMPLATE.md\`) requiring developers to list changes and testing steps
- [ ] Set up branch protection rules for \`main\`
  - [ ] Require pull request reviews before merging (min 1 approval)
  - [ ] Require status checks (Frontend & Contract CI) to pass before merging
  - [ ] Prevent force pushes to \`main\`

## Acceptance Criteria
- [ ] Code cannot reach \`main\` without passing tests and receiving a human review
- [ ] PR descriptions are standardized and detailed

## Estimated Time
1-2 hours"

gh issue create --repo $REPO --title "[CI/CD] Configure Dependabot for Automated Dependency Updates" \
  --label "ci/cd,difficulty:easy" \
  --body "## Description
Set up automated dependency management to ensure both the Node.js frontend and Rust smart contracts remain up-to-date with security patches and non-breaking upgrades.

## Component
DevOps

## Difficulty
🟢 Easy

## Tasks
- [ ] Add \`.github/dependabot.yml\` configuration file
- [ ] Configure update schedule (e.g., weekly) for \`npm\` ecosystems
- [ ] Configure update schedule for \`cargo\` ecosystems
- [ ] Define reviewers/assignees for automated PRs

## Acceptance Criteria
- [ ] Dependabot automatically opens PRs for outdated libraries
- [ ] CI runs against these PRs to ensure updates don't break the build

## Estimated Time
1-2 hours"

echo "✅ All CI/CD issues created successfully!"
