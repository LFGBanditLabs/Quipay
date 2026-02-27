//! Benchmark suite for PayrollStream critical functions.
//! Tracks instruction (gas) usage for create_stream and withdraw to detect performance regressions.
//!
//! Run with `BENCHMARK_REPORT=1 cargo test -p payroll_stream --lib benchmark` to generate report.

#![cfg(test)]
extern crate std;

use std::string::ToString;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env,
};

mod bench_vault {
    use soroban_sdk::{contract, contractimpl, Address, Env};
    #[contract]
    pub struct DummyVault;
    #[contractimpl]
    impl DummyVault {
        pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}
    }
}

fn bench_setup(env: &Env) -> (PayrollStreamClient, Address, Address, Address) {
    let admin = Address::generate(env);
    let employer = Address::generate(env);
    let worker = Address::generate(env);
    let token = Address::generate(env);
    let vault_id = env.register_contract(None, bench_vault::DummyVault);
    let stream_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(env, &stream_id);
    client.init(&admin);
    client.set_vault(&vault_id);
    env.ledger().with_mut(|li| li.timestamp = 0);
    (client, employer, worker, token)
}

/// Measures instruction count for create_stream.
/// Reports via cost_estimate() when invocation metering is enabled (default in test Env).
#[test]
fn benchmark_create_stream_instruction_count() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let (client, employer, worker, token) = bench_setup(&env);

    let _ = client.create_stream(&employer, &worker, &token, &100i128, &0u64, &0u64, &100u64);

    let resources = env.cost_estimate().resources();
    let instructions = resources.instructions;
    std::println!("[BENCHMARK] create_stream instructions: {}", instructions);

    if let Ok(dir) = std::env::var("BENCHMARK_REPORT") {
        if !dir.is_empty() {
            write_benchmark_report(&env, "create_stream", instructions, None);
        }
    }
}

/// Measures instruction count for withdraw (after creating one stream and advancing time).
#[test]
fn benchmark_withdraw_instruction_count() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let (client, employer, worker, token) = bench_setup(&env);

    let stream_id = client.create_stream(&employer, &worker, &token, &100i128, &0u64, &0u64, &100u64);
    env.ledger().with_mut(|li| li.timestamp = 50);

    let _ = client.withdraw(&stream_id, &worker);

    let resources = env.cost_estimate().resources();
    let instructions = resources.instructions;
    std::println!("[BENCHMARK] withdraw instructions: {}", instructions);

    if let Ok(dir) = std::env::var("BENCHMARK_REPORT") {
        if !dir.is_empty() {
            write_benchmark_report(&env, "withdraw", instructions, None);
        }
    }
}

/// Writes a single benchmark result to the report file.
/// If BENCHMARK_REPORT is a directory path, writes there; otherwise uses current dir.
fn write_benchmark_report(_env: &Env, name: &str, instructions: i64, _extra: Option<i64>) {
    let path = std::env::var("BENCHMARK_REPORT").unwrap_or_else(|_| ".".to_string());
    let file_path = std::path::Path::new(&path).join("benchmark-results.json");
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let key = name.to_string() + "_instructions";
    let content = "{\"".to_string()
        + &key
        + "\":"
        + &instructions.to_string()
        + ",\"timestamp\":"
        + &ts.to_string()
        + ",\"env\":\"test\"}";
    if let Err(e) = std::fs::write(&file_path, content) {
        std::eprintln!("[BENCHMARK] Warning: could not write report: {}", e);
    } else {
        std::println!("[BENCHMARK] Report written to {:?}", file_path);
    }
}

/// Full benchmark run: measures both create_stream and withdraw, writes combined report.
#[test]
fn benchmark_full_report() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (client, employer, worker, token) = bench_setup(&env);
    let stream_id = client.create_stream(&employer, &worker, &token, &100i128, &0u64, &0u64, &100u64);
    let create_instructions = env.cost_estimate().resources().instructions;

    env.ledger().with_mut(|li| li.timestamp = 50);
    let _ = client.withdraw(&stream_id, &worker);
    let withdraw_instructions = env.cost_estimate().resources().instructions;

    std::println!("[BENCHMARK] create_stream instructions: {}", create_instructions);
    std::println!("[BENCHMARK] withdraw instructions: {}", withdraw_instructions);

    if let Ok(ref dir) = std::env::var("BENCHMARK_REPORT") {
        if !dir.is_empty() {
            let path = std::path::Path::new(dir);
            let _ = std::fs::create_dir_all(path);
            let file_path = path.join("benchmark-results.json");
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let content = "{\"create_stream_instructions\":".to_string()
                + &create_instructions.to_string()
                + ",\"withdraw_instructions\":"
                + &withdraw_instructions.to_string()
                + ",\"timestamp\":"
                + &ts.to_string()
                + ",\"env\":\"test\"}";
            if let Err(e) = std::fs::write(&file_path, content) {
                std::eprintln!("[BENCHMARK] Warning: could not write report: {}", e);
            } else {
                std::println!("[BENCHMARK] Full report written to {:?}", file_path);
            }

            let md_path = path.join("BENCHMARKS.md");
            let md = "# PayrollStream benchmark report\n\n"
                .to_string()
                + "Generated at timestamp: "
                + &ts.to_string()
                + "\n\n## Instruction count per call\n\n"
                + "| Function       | Instructions |\n"
                + "|----------------|--------------|\n"
                + "| create_stream  | "
                + &create_instructions.to_string()
                + "           |\n"
                + "| withdraw       | "
                + &withdraw_instructions.to_string()
                + "           |\n\n"
                + "*Measured in test env with invocation metering. Production costs may differ.*\n";
            let _ = std::fs::write(&md_path, md);
        }
    }
}
