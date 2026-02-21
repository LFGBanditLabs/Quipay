# Quipay Deployment Guide (Stellar Testnet)

## Overview

This document outlines the deployment of the Quipay Payroll contracts (`payroll_vault` and `payroll_stream`) to the Stellar Testnet.

## Deployed Contracts (Testnet)

| Contract          | ID                                                         | Description                                       |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| **PayrollVault**  | `CCVIZ7256UFV2TKVTQ6ANU6S75IFFSXMLJOXOXW5QZOUXBTWDIRXGEUJ` | Holds funds and manages liabilities.              |
| **PayrollStream** | `CAQ5IXSFW74FXUZ6M7OURK36JFEGTJ5NC5GITPRSZBSY2FWOTRVAGVPV` | Manages streaming logic and interacts with Vault. |

## Admin Account

- **Public Key**: `GA6X4XIIDK7SFBZA33YHEIRIIEJC7AX7LJLZJSRTCEZOUVWHZCA6FJJD`
- **Network**: Testnet

## Deployment Steps

1. **Build Contracts**
   Target `wasm32-unknown-unknown` and disable reference types for compatibility.

   ```bash
   RUSTFLAGS="-C target-feature=-reference-types" cargo build --target wasm32-unknown-unknown --release --package payroll_vault
   RUSTFLAGS="-C target-feature=-reference-types" cargo build --target wasm32-unknown-unknown --release --package payroll_stream
   ```

2. **Optimize WASM**
   Use `wasm-opt` to optimize and ensure compatibility (disable reference types, enable bulk memory).

   ```bash
   wasm-opt -O2 --enable-bulk-memory --disable-reference-types target/wasm32-unknown-unknown/release/payroll_vault.wasm -o target/wasm32-unknown-unknown/release/payroll_vault.wasm
   wasm-opt -O2 --enable-bulk-memory --disable-reference-types target/wasm32-unknown-unknown/release/payroll_stream.wasm -o target/wasm32-unknown-unknown/release/payroll_stream.wasm
   ```

3. **Deploy Scripts**
   Use `scripts/deploy.mjs` to upload WASM, create contract instances, and initialize them.
   - Uploads WASM.
   - Creates contract instances.
   - Initializes `PayrollVault` with admin.
   - Initializes `PayrollStream` with admin.
   - Sets `PayrollVault` address in `PayrollStream`.
   - Authorizes `PayrollStream` in `PayrollVault`.

4. **Configuration**
   Update `environments.toml` with the new contract IDs under `[staging.contracts]`.

## Verification

Run `scripts/smoke_test.mjs` to verify deployment:

- Checks `PayrollVault` version.
- Checks `PayrollStream` paused status.

## Troubleshooting

- **WASM Validation Errors**: Ensure `wasm-opt` is used with `--disable-reference-types` if the network requires it.
- **Soroban SDK Version**: Downgraded to `21.2.0` for compatibility with current testnet/tools in this environment.
