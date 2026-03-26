# Quipay Contract Deployment Guide (Stellar CLI)

This runbook documents the full deployment flow for Quipay Soroban contracts using the official `stellar` CLI.

Contracts covered:

- `payroll_vault`
- `payroll_stream`
- `automation_gateway`

---

## 1) Prerequisites

### 1.1 Install toolchain

1. Install Rust + wasm target:

```bash
rustup target add wasm32-unknown-unknown
```

2. Install Stellar CLI (follow your OS package method from official docs), then verify:

```bash
stellar --version
stellar contract --help
```

3. (Optional but recommended) install Binaryen for manual optimization:

```bash
wasm-opt --version
```

### 1.2 Repository bootstrap

From repo root:

```bash
cargo build --workspace
```

---

## 2) Configure networks and identity

### 2.1 Add network configs (one-time per workstation)

```bash
stellar network add testnet \
   --rpc-url https://soroban-testnet.stellar.org \
   --network-passphrase "Test SDF Network ; September 2015"

stellar network add mainnet \
   --rpc-url https://mainnet.sorobanrpc.com \
   --network-passphrase "Public Global Stellar Network ; September 2015"
```

### 2.2 Create/import deployer identity

```bash
stellar keys generate quipay-deployer
stellar keys use quipay-deployer
```

For testnet only, fund deployer:

```bash
stellar keys fund quipay-deployer --network testnet
```

For mainnet, fund externally and verify the address:

```bash
stellar keys public-key quipay-deployer
```

---

## 3) Build contract WASM

You can use either path below.

### Option A: Stellar CLI build (recommended)

```bash
stellar contract build --package payroll_vault --profile release --out-dir target/wasm
stellar contract build --package payroll_stream --profile release --out-dir target/wasm
stellar contract build --package automation_gateway --profile release --out-dir target/wasm
```

### Option B: Cargo + manual optimization

```bash
RUSTFLAGS="-C target-feature=-reference-types" cargo build --target wasm32-unknown-unknown --release --package payroll_vault
RUSTFLAGS="-C target-feature=-reference-types" cargo build --target wasm32-unknown-unknown --release --package payroll_stream
RUSTFLAGS="-C target-feature=-reference-types" cargo build --target wasm32-unknown-unknown --release --package automation_gateway

wasm-opt -O2 --enable-bulk-memory --disable-reference-types target/wasm32-unknown-unknown/release/payroll_vault.wasm -o target/wasm32-unknown-unknown/release/payroll_vault.wasm
wasm-opt -O2 --enable-bulk-memory --disable-reference-types target/wasm32-unknown-unknown/release/payroll_stream.wasm -o target/wasm32-unknown-unknown/release/payroll_stream.wasm
wasm-opt -O2 --enable-bulk-memory --disable-reference-types target/wasm32-unknown-unknown/release/automation_gateway.wasm -o target/wasm32-unknown-unknown/release/automation_gateway.wasm
```

---

## 4) Deploy and initialize contracts

Set target network once for command examples:

```bash
export NETWORK=testnet
export SOURCE=quipay-deployer
export ADMIN=$(stellar keys public-key "$SOURCE")
```

### 4.1 Deploy PayrollVault

```bash
VAULT_ID=$(stellar contract deploy \
   --network "$NETWORK" \
   --source-account "$SOURCE" \
   --wasm target/wasm32-unknown-unknown/release/payroll_vault.wasm \
   --alias payroll_vault)

stellar contract invoke \
   --network "$NETWORK" \
   --source-account "$SOURCE" \
   --id "$VAULT_ID" \
   -- initialize --admin "$ADMIN"
```

### 4.2 Deploy PayrollStream

```bash
STREAM_ID=$(stellar contract deploy \
   --network "$NETWORK" \
   --source-account "$SOURCE" \
   --wasm target/wasm32-unknown-unknown/release/payroll_stream.wasm \
   --alias payroll_stream)

stellar contract invoke \
   --network "$NETWORK" \
   --source-account "$SOURCE" \
   --id "$STREAM_ID" \
   -- init --admin "$ADMIN"
```

### 4.3 Deploy AutomationGateway

```bash
GATEWAY_ID=$(stellar contract deploy \
   --network "$NETWORK" \
   --source-account "$SOURCE" \
   --wasm target/wasm32-unknown-unknown/release/automation_gateway.wasm \
   --alias automation_gateway)

stellar contract invoke \
   --network "$NETWORK" \
   --source-account "$SOURCE" \
   --id "$GATEWAY_ID" \
   -- init --admin "$ADMIN"
```

---

## 5) Wire contract dependencies (required)

### 5.1 Set vault address in stream contract

`payroll_stream::set_vault(vault: Address)`

```bash
stellar contract invoke \
   --network "$NETWORK" \
   --source-account "$SOURCE" \
   --id "$STREAM_ID" \
   -- set_vault --vault "$VAULT_ID"
```

### 5.2 Set authorized contract in vault

`payroll_vault::set_authorized_contract(contract: Address)`

```bash
stellar contract invoke \
   --network "$NETWORK" \
   --source-account "$SOURCE" \
   --id "$VAULT_ID" \
   -- set_authorized_contract --contract "$STREAM_ID"
```

### 5.3 (Optional) Set gateway in stream

`payroll_stream::set_gateway(gateway: Address)`

```bash
stellar contract invoke \
   --network "$NETWORK" \
   --source-account "$SOURCE" \
   --id "$STREAM_ID" \
   -- set_gateway --gateway "$GATEWAY_ID"
```

---

## 6) Post-deploy verification

Quick checks:

```bash
stellar contract invoke --network "$NETWORK" --source-account "$SOURCE" --id "$VAULT_ID" -- get_version
stellar contract invoke --network "$NETWORK" --source-account "$SOURCE" --id "$STREAM_ID" -- is_paused
stellar contract invoke --network "$NETWORK" --source-account "$SOURCE" --id "$STREAM_ID" -- get_vault
```

Project smoke tests:

```bash
node scripts/smoke_test.mjs
node scripts/smoke_test_gateway.mjs
```

---

## 7) Environment registration

Update [environments.toml](../environments.toml) with deployed IDs:

- Testnet → `[staging.contracts]`
- Mainnet → `[production.contracts]`

Also update any runtime `.env` values used by backend/frontend (for example `QUIPAY_CONTRACT_ID`).

---

## 8) Testnet contract address table

Current staging/testnet addresses:

| Contract          | Contract ID                                                | Notes                                    |
| ----------------- | ---------------------------------------------------------- | ---------------------------------------- |
| PayrollVault      | `CCVIZ7256UFV2TKVTQ6ANU6S75IFFSXMLJOXOXW5QZOUXBTWDIRXGEUJ` | Liability and treasury control           |
| PayrollStream     | `CAQ5IXSFW74FXUZ6M7OURK36JFEGTJ5NC5GITPRSZBSY2FWOTRVAGVPV` | Stream creation/withdraw/cancel          |
| AutomationGateway | `CDYO5HXZ7K5XP2U52DW5PCYRTG6NVXDG525ZFYVRGOKD6BRERM44AVRO` | Agent authorization + automation routing |
| WorkforceRegistry | `CBUSAUR4GSZVJMSUEPD6WSB6PKDAAATSPUUMCZU7HFU4P6ID45H7F547` | Worker registry                          |

---

## 9) Mainnet-specific checklist

Before running with `NETWORK=mainnet`:

1. Use hardware/secure signing identity (no plaintext secret in shell history).
2. Confirm production RPC endpoint and policy limits.
3. Run dry-run checks on testnet with the exact same wasm artifacts.
4. Double-check admin address and ownership model.
5. Execute dependency wiring in this order:
   - `set_vault` on stream
   - `set_authorized_contract` on vault
   - optional `set_gateway` on stream
6. Store transaction hashes and final contract IDs in release notes.

---

## 10) Troubleshooting

- WASM validation errors: rebuild with compatible flags and re-run `stellar contract build --optimize`.
- `init`/`initialize` fails with already-initialized errors: verify you are invoking the correct, newly deployed contract ID.
- Authorization failures on wiring calls: confirm `--source-account` is the same admin used during init.
