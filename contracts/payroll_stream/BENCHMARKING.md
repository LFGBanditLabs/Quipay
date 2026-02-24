# PayrollStream benchmarking

This directory contains a benchmarking suite for critical contract functions to track gas (instruction) usage and prevent performance regressions.

## Benchmarked functions

- **create_stream** – instruction count for creating one stream (includes vault `add_liability` call).
- **withdraw** – instruction count for one withdrawal (after stream exists and time has advanced).

## Running benchmarks locally

Run all benchmark tests (instruction counts are printed):

```bash
cargo test -p payroll_stream --lib benchmark
```

Generate a report (JSON + markdown) into a directory:

```bash
mkdir -p benchmark-out
BENCHMARK_REPORT=$(pwd)/benchmark-out cargo test -p payroll_stream --lib benchmark_full_report -- --nocapture
```

Then inspect:

- `benchmark-out/benchmark-results.json` – machine-readable instruction counts and timestamp.
- `benchmark-out/BENCHMARKS.md` – human-readable table.

## CI/CD

The workflow `.github/workflows/benchmarks.yml` runs on:

- **Pull requests** that touch `contracts/payroll_stream/**` or the workflow file.
- **Pushes to `main`** that touch `contracts/payroll_stream/**`.

It runs the benchmarks and:

1. Writes a **gas usage** table to the job summary (visible on the PR and run).
2. Uploads **benchmark-results** and the log as workflow artifacts.

So every relevant PR shows instruction counts for `create_stream` and `withdraw`, and you can download the JSON report from the artifacts.

## Regressions

The workflow does not currently fail the build on regression. You can:

- Manually compare the **Instructions** table in the job summary with a previous run or main.
- Add a baseline file (e.g. `benchmark-baseline.json` on `main`) and a step that fails if current instructions exceed the baseline by a threshold (e.g. 20%).

Measurements use the Soroban test env with invocation metering; production costs may differ slightly.
