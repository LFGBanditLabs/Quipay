#![cfg(test)]

use crate::{PayrollVault, PayrollVaultClient};
use soroban_sdk::{testutils::Address as _, token, Address, Env};

pub fn run_fuzz_iteration(
    env: &Env,
    admin: &Address,
    user: &Address,
    recipient: &Address,
    token_id: &Address,
    amount: i128,
    action: u8,
) {
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(env, &contract_id);
    client.initialize(admin);

    let token_admin_client = token::StellarAssetClient::new(env, token_id);
    let token_client = token::Client::new(env, token_id);

    // Initial setup
    token_admin_client.mint(user, &1000000);

    match action % 2 {
        0 => {
            // Deposit
            if amount > 0 && amount <= 1000000 {
                env.mock_all_auths();
                let _ = client.deposit(user, token_id, &amount);
                
                // Invariant: Contract balance should reflect deposit
                assert!(token_client.balance(&contract_id) >= amount);
                assert_eq!(client.get_treasury_balance(token_id), amount);
            }
        }
        1 => {
            // Payout (Requires deposit and allocation first)
            let deposit_amount = 1000;
            env.mock_all_auths();
            let _ = client.deposit(user, token_id, &deposit_amount);
            let _ = client.allocate_funds(token_id, &deposit_amount);

            if amount > 0 && amount <= deposit_amount {
                let _ = client.payout(recipient, token_id, &amount);
                
                // Invariants
                assert_eq!(client.get_total_liability(token_id), deposit_amount - amount);
                assert_eq!(client.get_treasury_balance(token_id), deposit_amount - amount);
                assert_eq!(token_client.balance(recipient), amount);
            }
        }
        _ => {}
    }
}

#[test]
fn test_manual_fuzz() {
    use rand::{Rng, thread_rng};

    // Run 1000 "real" random iterations to simulate intensive fuzzing
    let mut rng = thread_rng();
    for _ in 0..1000 {
        let env = Env::default();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let recipient = Address::generate(&env);
        
        // Setup token
        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_id = token_contract.address();

        let amount: i128 = rng.gen_range(1..100000);
        let action: u8 = rng.gen_range(0..2);
        run_fuzz_iteration(&env, &admin, &user, &recipient, &token_id, amount, action);
    }
}
