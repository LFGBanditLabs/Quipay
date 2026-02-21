#![cfg(test)]
extern crate std;

use crate::{PayrollVault, PayrollVaultClient};
use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env};
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::token::StellarAssetClient;

fn create_token_contract<'a>(env: &Env, admin: &Address) -> (Address, StellarAssetClient<'a>, TokenClient<'a>) {
    let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
    let stellar_asset_client = StellarAssetClient::new(env, &contract_id.address());
    let token_client = TokenClient::new(env, &contract_id.address());
    (contract_id.address(), stellar_asset_client, token_client)
}

#[derive(Clone, Debug)]
pub enum VaultAction {
    Deposit(i128),
    Payout(i128),
}

fn vault_action_strategy() -> impl Strategy<Value = VaultAction> {
    prop_oneof![
        (1i128..1_000_000_000i128).prop_map(VaultAction::Deposit),
        (1i128..1_000_000_000i128).prop_map(VaultAction::Payout),
    ]
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(500))]
    #[test]
    fn fuzz_vault_core_invariant(actions in prop::collection::vec(vault_action_strategy(), 1..50)) {
        let env = Env::default();
        env.mock_all_auths_allowing_non_root_auth();

        let admin = Address::generate(&env);
        let contract_id = env.register(PayrollVault, ());
        let client = PayrollVaultClient::new(&env, &contract_id);
        
        client.initialize(&admin);

        let token_admin = Address::generate(&env);
        let (token_id, stellar_asset_client, _token_client) = create_token_contract(&env, &token_admin);
        
        let user = Address::generate(&env);
        // Mint a large sum to the user so deposits don't fail structurally from empty balances
        stellar_asset_client.mint(&user, &100_000_000_000_000i128);

        for action in actions {
            match action {
                VaultAction::Deposit(amount) => {
                    // We catch unwind because some deposits could technically exceed i128 theoretically in massive sequential runs natively
                    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        client.deposit(&user, &token_id, &amount);
                    }));
                },
                VaultAction::Payout(amount) => {
                    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        client.payout(&user, &token_id, &amount);
                    }));
                }
            }

            // CORE INVARIANT: Total Treasury Balance >= Total System Liability
            let treasury = client.get_treasury_balance(&token_id);
            let liability = client.get_total_liability(&token_id);
            
            assert!(treasury >= liability, "INVARIANT VIOLATION: Treasury Balance ({}) is less than Total System Liability ({})", treasury, liability);
            assert!(treasury >= 0, "Treasury balance fell below zero: {}", treasury);
        }
    }
}
