#![cfg(test)]
extern crate std;

use super::*;
use quipay_common::QuipayError;
use soroban_sdk::{Address, Env, Vec, testutils::Address as _, token};

#[test]
fn test_multisig_withdrawal_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let guardian_1 = Address::generate(&env);
    let guardian_2 = Address::generate(&env);
    let guardian_3 = Address::generate(&env);

    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let token_client = token::Client::new(&env, &token_id);

    // Setup guardians: 2-of-3
    let mut guardians = Vec::new(&env);
    guardians.push_back(guardian_1.clone());
    guardians.push_back(guardian_2.clone());
    guardians.push_back(guardian_3.clone());
    client.set_guardians(&guardians, &2);

    // Set threshold for token: 1000
    client.set_token_withdrawal_threshold(&token_id, &1000);

    // Fund vault
    token_admin_client.mint(&employer, &5000);
    client.deposit(&employer, &token_id, &5000);

    // 1. Below threshold (UX preserved)
    client.withdraw(&employer, &token_id, &500);
    assert_eq!(token_client.balance(&employer), 500);
    assert_eq!(client.get_treasury_balance(&token_id), 4500);

    // 2. Above threshold (Blocked)
    let res = client.try_withdraw(&employer, &token_id, &2000);
    assert_eq!(res, Err(Ok(QuipayError::LargeWithdrawalRequiresApproval)));

    // 3. Propose withdrawal
    let id = client.propose_withdrawal(&employer, &token_id, &2000, &recipient);
    assert_eq!(id, 0);

    let pending = client.get_pending_withdrawal(&id).unwrap();
    assert_eq!(pending.amount, 2000);
    assert_eq!(pending.approvals.len(), 0);

    // 4. Partial approval
    client.approve_withdrawal(&guardian_1, &id);
    let pending = client.get_pending_withdrawal(&id).unwrap();
    assert_eq!(pending.approvals.len(), 1);
    assert_eq!(token_client.balance(&recipient), 0); // Not executed yet

    // 5. Quorum auto-execute
    client.approve_withdrawal(&guardian_2, &id);
    assert_eq!(client.get_pending_withdrawal(&id), None); // Removed after execution
    assert_eq!(token_client.balance(&recipient), 2000);
    assert_eq!(client.get_treasury_balance(&token_id), 2500);

    // 6. Test Cancel
    let id_2 = client.propose_withdrawal(&employer, &token_id, &1500, &recipient);
    assert_eq!(id_2, 1);
    client.approve_withdrawal(&guardian_1, &id_2);
    
    // Unauthorized cancel
    let res_cancel = client.try_cancel_withdrawal(&guardian_2, &id_2);
    assert!(res_cancel.is_err());
    
    // Proposer cancel
    client.cancel_withdrawal(&employer, &id_2);
    assert_eq!(client.get_pending_withdrawal(&id_2), None);
}

#[test]
fn test_multisig_errors() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let guardian = Address::generate(&env);
    let non_guardian = Address::generate(&env);

    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    token::StellarAssetClient::new(&env, &token_id).mint(&employer, &10000);
    client.deposit(&employer, &token_id, &10000);
    client.set_token_withdrawal_threshold(&token_id, &1000);

    let mut guardians = Vec::new(&env);
    guardians.push_back(guardian.clone());
    client.set_guardians(&guardians, &1);

    let id = client.propose_withdrawal(&employer, &token_id, &5000, &employer);

    // Not a guardian
    let res = client.try_approve_withdrawal(&non_guardian, &id);
    assert_eq!(res, Err(Ok(QuipayError::NotGuardian)));

    // Double approval
    guardians.push_back(Address::generate(&env));
    client.set_guardians(&guardians, &2); // Increase threshold to prevent auto-exec
    let id2 = client.propose_withdrawal(&employer, &token_id, &4000, &employer);
    client.approve_withdrawal(&guardian, &id2);
    let res2 = client.try_approve_withdrawal(&guardian, &id2);
    assert_eq!(res2, Err(Ok(QuipayError::AlreadyApproved)));
}
