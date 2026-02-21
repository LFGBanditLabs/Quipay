# Quipay Deployment Guide (Stellar Testnet)

## Overview

This document outlines the deployment of the Quipay Payroll contracts (`payroll_vault` and `payroll_stream`) to the Stellar Testnet.

## Deployed Contracts (Testnet)

| Contract              | ID                                                         | Description                                       |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| **PayrollVault**      | `CCVIZ7256UFV2TKVTQ6ANU6S75IFFSXMLJOXOXW5QZOUXBTWDIRXGEUJ` | Holds funds and manages liabilities.              |
| **PayrollStream**     | `CAQ5IXSFW74FXUZ6M7OURK36JFEGTJ5NC5GITPRSZBSY2FWOTRVAGVPV` | Manages streaming logic and interacts with Vault. |
| **AutomationGateway** | `CDYO5HXZ7K5XP2U52DW5PCYRTG6NVXDG525ZFYVRGOKD6BRERM44AVRO` | Manages AI agents and automated actions.          |

## Admin Account

- **Public Key**: `GA6X4XIIDK7SFBZA33YHEIRIIEJC7AX7LJLZJSRTCEZOUVWHZCA6FJJD`
- **Network**: Testnet

## Admin Account (AutomationGateway)

- **Public Key**: `GBJ75QYS3EBGMEGPT3SUB4LRK4SSTTTRIPCFFLRU2PJL5BRIGRANCRK7`
- **Network**: Testnet

## Deployment Steps

1. **Build Contracts**
   Target `wasm32-unknown-unknown` and disable reference types for compatibility.

   ```bash
   RUSTFLAGS="-C target-feature=-reference-types" cargo build --target wasm32-unknown-unknown --release --package payroll_vault
   RUSTFLAGS="-C target-feature=-reference-types" cargo build --target wasm32-unknown-unknown --release --package payroll_stream
   RUSTFLAGS="-C target-feature=-reference-types" cargo build --target wasm32-unknown-unknown --release --package automation_gateway
   ```

2. **Optimize WASM**
   Use `wasm-opt` to optimize and ensure compatibility (disable reference types, enable bulk memory).

   ```bash
   wasm-opt -O2 --enable-bulk-memory --disable-reference-types target/wasm32-unknown-unknown/release/payroll_vault.wasm -o target/wasm32-unknown-unknown/release/payroll_vault.wasm
   wasm-opt -O2 --enable-bulk-memory --disable-reference-types target/wasm32-unknown-unknown/release/payroll_stream.wasm -o target/wasm32-unknown-unknown/release/payroll_stream.wasm
   wasm-opt -O2 --enable-bulk-memory --disable-reference-types target/wasm32-unknown-unknown/release/automation_gateway.wasm -o target/wasm32-unknown-unknown/release/automation_gateway.wasm
   ```

3. **Deploy Scripts**
   Use `scripts/deploy.mjs` for Payroll contracts and `scripts/deploy_gateway.mjs` for AutomationGateway.
   - `scripts/deploy.mjs`: Deploys and initializes PayrollVault and PayrollStream.
   - `scripts/deploy_gateway.mjs`: Deploys and initializes AutomationGateway.

4. **Configuration**
   Update `environments.toml` with the new contract IDs under `[staging.contracts]`.

## Verification

Run `scripts/smoke_test.mjs` to verify deployment:

- Checks `PayrollVault` version.
- Checks `PayrollStream` paused status.

## Troubleshooting

- **WASM Validation Errors**: Ensure `wasm-opt` is used with `--disable-reference-types` if the network requires it.
- **Soroban SDK Version**: Downgraded to `21.2.0` for compatibility with current testnet/tools in this environment.
