#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;
use payroll_vault::{PayrollVault, PayrollVaultClient};
use soroban_sdk::{testutils::Address as _, token, Address, Env};

#[derive(Arbitrary, Debug)]
pub enum FuzzAction {
    Initialize,
    Deposit { amount: i128 },
    Allocate { amount: i128 },
    Payout { amount: i128 },
    TransferAdmin { new_admin: bool },
}

fuzz_target!(|actions: Vec<FuzzAction>| {
    let env = Env::default();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let token_client = token::Client::new(&env, &token_id);

    // Initial minting
    env.mock_all_auths();
    let _ = token_admin_client.mint(&user, &1_000_000_000);

    let mut is_initialized = false;

    for action in actions {
        match action {
            FuzzAction::Initialize => {
                if !is_initialized {
                    let _ = client.initialize(&admin);
                    is_initialized = true;
                }
            }
            FuzzAction::Deposit { amount } => {
                if is_initialized && amount > 0 && amount <= 1_000_000_000 {
                    env.mock_all_auths();
                    let _ = client.deposit(&user, &token_id, &amount);
                }
            }
            FuzzAction::Allocate { amount } => {
                if is_initialized && amount > 0 {
                    env.mock_all_auths();
                    let _ = client.allocate_funds(&token_id, &amount);
                }
            }
            FuzzAction::Payout { amount } => {
                if is_initialized && amount > 0 {
                    let treasury = client.get_treasury_balance(&token_id);
                    let liability = client.get_total_liability(&token_id);
                    if amount <= treasury && amount <= liability {
                        env.mock_all_auths();
                        let _ = client.payout(&recipient, &token_id, &amount);
                    }
                }
            }
            FuzzAction::TransferAdmin { new_admin } => {
                if is_initialized {
                    env.mock_all_auths();
                    let new_addr = if new_admin { Address::generate(&env) } else { user.clone() };
                    let _ = client.transfer_admin(&new_addr);
                }
            }
        }

        // Perform invariant checks after each action
        if is_initialized {
            let treasury = client.get_treasury_balance(&token_id);
            let total_liability = client.get_total_liability(&token_id);
            let contract_token_balance = token_client.balance(&contract_id);
            
            // Invariant: Tracked treasury should always be <= actual token balance
            assert!(treasury <= contract_token_balance, "Treasury exceeded actual token balance");
            
            // Invariant: Treasury and Liability are non-negative
            assert!(treasury >= 0, "Treasury balance became negative");
            assert!(total_liability >= 0, "Total liability became negative");
        }
    }
});
