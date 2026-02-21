#![cfg(test)]
extern crate std;

use crate::{PayrollStream, PayrollStreamClient};
use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env};

fn time_leap_strategy() -> impl Strategy<Value = u64> {
    0u64..50_000_000u64
}

fn action_strategy() -> impl Strategy<Value = u32> {
    0u32..2u32
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(500))]
    #[test]
    fn fuzz_stream_invariant(
        total_amount in 1i128..1_000_000_000_000i128, 
        start_offset in 10u64..10_000u64, 
        duration in 1u64..31_536_000u64, // Streams up to 1 year
        time_leaps in prop::collection::vec(time_leap_strategy(), 1..50),
        actions in prop::collection::vec(action_strategy(), 1..50)
    ) {
        let env = Env::default();
        env.mock_all_auths_allowing_non_root_auth();

        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let worker = Address::generate(&env);
        let _token = Address::generate(&env);
        
        let contract_id = env.register(PayrollStream, ());
        let client = PayrollStreamClient::new(&env, &contract_id);
        
        client.init(&admin);
        
        let initial_time = 1_000_000_000u64;
        env.ledger().set_timestamp(initial_time);
        
        let start_ts = initial_time.saturating_add(start_offset);
        let end_ts = start_ts.saturating_add(duration);

        // We need to set the vault because create_stream calls allocate_funds on it
        // Since this is a proptest for stream invariants, we might need to mock the vault or use a real one.
        // But the previous code didn't use a vault. 
        // Wait, the previous code FAILED because it was missing arguments.
        // AND create_stream NOW requires a vault to be set because of the multi-token integration.
        
        // If we use the real PayrollStream contract, it WILL call vault_client.allocate_funds.
        // So we MUST have a vault set up, or the contract will panic with "vault not set" or "allocate_funds failed".
        
        // This proptest seems to have been written before the vault integration or for a simpler version.
        // To fix this properly, we need to deploy a vault (or mock it) and set it.
        // Given we are in the same workspace, we can deploy the real PayrollVault.
        
        // However, deploying the real vault requires registering it.
        // And we need to initialize it.
        
        use payroll_vault::{PayrollVault, PayrollVaultClient};
        let vault_id = env.register(PayrollVault, ());
        let vault_client = PayrollVaultClient::new(&env, &vault_id);
        vault_client.initialize(&contract_id); // Initialize vault with stream as admin
        client.set_vault(&vault_id);
        
        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token = token_contract.address();
        let token_client = soroban_sdk::token::StellarAssetClient::new(&env, &token);
        
        // Mint to employer
        token_client.mint(&employer, &total_amount);
        
        // Employer deposits to vault
        vault_client.deposit(&employer, &token, &total_amount);

        let stream_id = client.create_stream(&employer, &worker, &token, &total_amount, &start_ts, &end_ts);
        
        let mut current_time = initial_time;
        let steps = std::cmp::min(time_leaps.len(), actions.len());

        for i in 0..steps {
            current_time = current_time.saturating_add(time_leaps[i]);
            env.ledger().set_timestamp(current_time);

            if actions[i] == 0 {
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    client.withdraw(&stream_id, &worker);
                }));
            } else {
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    client.cancel_stream(&stream_id, &employer);
                }));
            }

            if let Some(stream) = client.get_stream(&stream_id) {
                let withdrawn = stream.withdrawn_amount;
                let total = stream.total_amount;
                
                let is_closed = (stream.status_bits & 2) != 0 || (stream.status_bits & 4) != 0;
                let effective_now = if is_closed { stream.closed_at } else { current_time };
                
                let accrued = if effective_now <= stream.start_ts {
                    0
                } else if effective_now >= stream.end_ts {
                    total
                } else {
                    let elapsed = effective_now - stream.start_ts;
                    let duration = stream.end_ts - stream.start_ts;
                    (total * (elapsed as i128)) / (duration as i128)
                };

                // STREAM INVARIANT: Withdrawn <= Accrued <= Total Stream Value
                assert!(withdrawn <= accrued, "INVARIANT VIOLATION: Withdrawn ({}) > Accrued ({})", withdrawn, accrued);
                assert!(accrued <= total, "INVARIANT VIOLATION: Accrued ({}) > Total ({})", accrued, total);
                assert!(withdrawn >= 0, "Withdrawn is negative: {}", withdrawn);
            }
        }
    }
}
