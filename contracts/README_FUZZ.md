# Fuzz Testing Guide

This guide explains how to run fuzz targets for Quipay smart contracts.

## Overview

Fuzz testing helps find edge cases and potential bugs in critical contract functions:
- `payroll_vault::deposit` - arbitrary i128 amounts
- `payroll_stream::create` - arbitrary start/end timestamps
- `payroll_stream::claim` - arbitrary vesting percentages

## Prerequisites

- Rust 1.89+
- Cargo installed
- Project built at least once

## Running Fuzz Tests Locally

### Install Cargo Fuzz (one-time)

```bash
cargo install cargo-fuzz
```

### Run All Fuzz Targets

```bash
cd fuzz
cargo fuzz run # interactive mode
```

### Run Specific Fuzz Target

```bash
cd fuzz
cargo fuzz run fuzz_vault_deposit
cargo fuzz run fuzz_stream_create
cargo fuzz run fuzz_stream_claim
```

### Run with Timeout

```bash
# Run for 60 seconds, then stop
timeout 60 cargo fuzz run fuzz_vault_deposit
```

### Run with Limited Memory

```bash
# Fuzz with max 4GB of memory
cargo fuzz run fuzz_vault_deposit -- -max_len=10000
```

## CI Integration

The fuzz targets are run in CI with a 60-second timeout:

```bash
cargo fuzz run fuzz_vault_deposit -- -max_total_time=60
cargo fuzz run fuzz_stream_create -- -max_total_time=60
cargo fuzz run fuzz_stream_claim -- -max_total_time=60
```

The CI workflow will fail if any fuzz target crashes, overflows, or panics.

## Interpreting Results

### Success

```
#123456 NEW cov: 456 ft: 789 corp: 12 exec/s: 1234
```

Fuzz is finding new code paths and exploring the function space.

### Crash or Panic

```
ERROR: libFuzzer encountered a crash:
...
SUMMARY: libFuzzer: crash on unknown (slow unit)
```

If fuzzing finds a crash:
1. The crashing input is saved to `artifacts/`
2. Run the failing input again with `-artifact_prefix=artifacts/`
3. Inspect and fix the underlying bug
4. Re-run fuzzing to verify the fix

### Integer Overflow

```
runtime error: signed integer overflow
```

Fuzz detected an unchecked arithmetic operation. Common causes:
- Adding two i128 values without bounds checking
- Multiplying percentages or amounts without overflow protection

Fix: Use `checked_*` methods or implement overflow-safe arithmetic.

## Regression Testing

Fuzz artifacts are saved in `proptest-regressions/` and `artifacts/`:

```bash
# Run regression tests (includes previous crashes)
cargo test

# Run only fuzz targets
cargo fuzz run fuzz_vault_deposit
```

Regression tests ensure we don't re-introduce bugs that fuzzing found.

## Tips

### Speed Up Fuzzing

- Minimize corpus: `cargo fuzz cmin fuzz_vault_deposit`
- Use release mode: `cargo fuzz run --release fuzz_vault_deposit`
- Increase workers: `cargo fuzz run fuzz_vault_deposit -- -workers=8`

### Reduce Noise

- Filter warnings: `cargo fuzz run fuzz_vault_deposit 2>&1 | grep -v "warning"`
- Suppress stdout: `cargo fuzz run fuzz_vault_deposit -- -max_len=100 > /dev/null`

### Debug Specific Input

If you have a crashing input file:

```bash
cargo fuzz run fuzz_vault_deposit /path/to/crashing-input
```

The fuzzer will immediately execute the crashing input and pause at the error.

## What the Fuzz Targets Test

### fuzz_vault_deposit

Tests the deposit function with arbitrary i128 amounts:
- Overflow scenarios (i128::MAX)
- Underflow scenarios (i128::MIN)
- Zero amounts
- Negative amounts (should be rejected)
- Near-boundary values

### fuzz_stream_create

Tests stream creation with arbitrary start/end timestamps:
- Start > end (invalid)
- Start == end (invalid)
- Large gaps (duration overflows)
- Timestamp epoch boundaries
- Current time edge cases

### fuzz_stream_claim

Tests claim function with arbitrary percentages:
- Percentage > 100 (over-claim)
- Percentage == 0 (no claim)
- Percentage == 100 (full claim)
- Large percentage values
- Rounding edge cases

## Common Issues

### "command not found: cargo fuzz"

Install cargo-fuzz: `cargo install cargo-fuzz`

### "failed to build target fuzz"

Ensure the fuzz workspace member is in `Cargo.toml`:
```toml
[workspace]
members = ["contracts/*", "fuzz"]
```

### "integer overflow in metadata"

This is likely during build. Check that dependencies are compatible with fuzzing.

### Fuzz runs forever

Press `Ctrl+C` to stop. The fuzzer prints progress every few seconds.

## References

- [cargo-fuzz documentation](https://rust-fuzz.github.io/book/cargo-fuzz.html)
- [libFuzzer options](https://llvm.org/docs/LibFuzzer/#options)
- [Soroban testing guide](https://developers.stellar.org/learn/smart-contracts)
