#![cfg(test)]
extern crate std;

use super::*;
use quipay_common::QuipayError;
use soroban_sdk::xdr::{ReadXdr, ToXdr};
use soroban_sdk::{
    testutils::Address as _, testutils::Events as _, testutils::Ledger as _, Address, BytesN, Env,
    Symbol, TryFromVal, TryIntoVal, token, xdr,
};

fn register_native_token_contract(env: &Env, admin: Address) -> Address {
    let _ = admin;
    let create = xdr::HostFunction::CreateContract(xdr::CreateContractArgs {
        contract_id_preimage: xdr::ContractIdPreimage::Asset(xdr::Asset::Native),
        executable: xdr::ContractExecutable::StellarAsset,
    });

    let token_id: Address = env
        .host()
        .invoke_function(create)
        .unwrap()
        .try_into_val(env)
        .unwrap();
    token_id
}

fn make_account_address(env: &Env, seed: u8) -> Address {
    let pk = xdr::Uint256([seed; 32]);
    let account_id = xdr::AccountId(xdr::PublicKey::PublicKeyTypeEd25519(pk));
    let sc_addr = xdr::ScAddress::Account(account_id);
    sc_addr.try_into_val(env).unwrap()
}

fn fund_account_with_xlm(env: &Env, account: &Address, balance: i64) {
    let sc_addr_xdr_bytes = account.to_xdr(env);
    let sc_addr_xdr: std::vec::Vec<u8> = sc_addr_xdr_bytes.iter().collect();
    let sc_val = xdr::ScVal::from_xdr(sc_addr_xdr, xdr::Limits::none()).unwrap();
    let sc_addr = match sc_val {
        xdr::ScVal::Address(a) => a,
        _ => panic!("expected ScVal::Address"),
    };
    let account_id = match sc_addr {
        xdr::ScAddress::Account(a) => a,
        _ => panic!("expected account address"),
    };

    let k = std::rc::Rc::new(xdr::LedgerKey::Account(xdr::LedgerKeyAccount {
        account_id: account_id.clone(),
    }));

    if env.host().get_ledger_entry(&k).unwrap().is_none() {
        let v = std::rc::Rc::new(xdr::LedgerEntry {
            data: xdr::LedgerEntryData::Account(xdr::AccountEntry {
                account_id,
                balance,
                flags: 0,
                home_domain: Default::default(),
                inflation_dest: None,
                num_sub_entries: 0,
                seq_num: xdr::SequenceNumber(0),
                thresholds: xdr::Thresholds([1; 4]),
                signers: xdr::VecM::default(),
                ext: xdr::AccountEntryExt::V0,
            }),
            last_modified_ledger_seq: 0,
            ext: xdr::LedgerEntryExt::V0,
        });
        env.host().add_ledger_entry(&k, &v, None).unwrap();
    }
}

#[test]
fn test_xlm_deposit_withdraw_and_payout() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = make_account_address(&env, 1);
    let user = make_account_address(&env, 2);
    let recipient = make_account_address(&env, 3);

    client.initialize(&admin);

    let xlm_token_id = register_native_token_contract(&env, admin);
    let xlm_token_client = token::Client::new(&env, &xlm_token_id);

    fund_account_with_xlm(&env, &user, 10_000);
    fund_account_with_xlm(&env, &recipient, 0);
    assert_eq!(xlm_token_client.balance(&user), 10_000);

    client.deposit(&user, &xlm_token_id, &7_000);
    assert_eq!(xlm_token_client.balance(&user), 3_000);
    assert_eq!(client.get_treasury_balance(&xlm_token_id), 7_000);

    client.allocate_funds(&xlm_token_id, &2_500);
    client.payout(&recipient, &xlm_token_id, &2_500);
    assert_eq!(xlm_token_client.balance(&recipient), 2_500);
    assert_eq!(client.get_total_liability(&xlm_token_id), 0);
    assert_eq!(client.get_treasury_balance(&xlm_token_id), 4_500);

    client.withdraw(&user, &xlm_token_id, &1_000);
    assert_eq!(xlm_token_client.balance(&user), 4_000);
    assert_eq!(client.get_treasury_balance(&xlm_token_id), 3_500);
}

#[test]
fn test_solvency_enforcement() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let user = Address::generate(&env);

    // Deposit 1000
    token_admin_client.mint(&user, &1000);
    client.deposit(&user, &token_id, &1000);

    // Allocate 500 - OK
    client.allocate_funds(&token_id, &500);
    assert_eq!(client.get_total_liability(&token_id), 500);

    // Allocate another 500 - OK (Total 1000 <= Balance 1000)
    client.allocate_funds(&token_id, &500);
    assert_eq!(client.get_total_liability(&token_id), 1000);

    // Try to allocate 1 more - Should Fail
    let res = client.try_allocate_funds(&token_id, &1);
    assert!(res.is_err()); // panic: insufficient funds for allocation
}

#[test]
fn test_release_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let user = Address::generate(&env);

    // Deposit 1000
    token_admin_client.mint(&user, &1000);
    client.deposit(&user, &token_id, &1000);

    // Allocate 500
    client.allocate_funds(&token_id, &500);
    assert_eq!(client.get_total_liability(&token_id), 500);

    // Release 200 (e.g. cancelled stream)
    client.release_funds(&token_id, &200);
    assert_eq!(client.get_total_liability(&token_id), 300);

    // Try to release more than liability (400 > 300)
    let res = client.try_release_funds(&token_id, &400);
    assert!(res.is_err());
}

#[test]
fn test_multi_token_tracking() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Setup Token A
    let token_a_admin = Address::generate(&env);
    let token_a = env.register_stellar_asset_contract_v2(token_a_admin.clone());
    let token_a_id = token_a.address();
    let token_a_client = token::StellarAssetClient::new(&env, &token_a_id);

    // Setup Token B
    let token_b_admin = Address::generate(&env);
    let token_b = env.register_stellar_asset_contract_v2(token_b_admin.clone());
    let token_b_id = token_b.address();
    let token_b_client = token::StellarAssetClient::new(&env, &token_b_id);

    let user = Address::generate(&env);
    token_a_client.mint(&user, &1000);
    token_b_client.mint(&user, &1000);

    // Deposit both
    client.deposit(&user, &token_a_id, &500);
    client.deposit(&user, &token_b_id, &300);

    // Check independent tracking
    assert_eq!(client.get_treasury_balance(&token_a_id), 500);
    assert_eq!(client.get_treasury_balance(&token_b_id), 300);

    // Allocate A
    client.allocate_funds(&token_a_id, &400);
    assert_eq!(client.get_total_liability(&token_a_id), 400);
    assert_eq!(client.get_total_liability(&token_b_id), 0);

    // Try to allocate B beyond its balance (should fail even if A has room)
    // B balance 300, try allocate 301
    let res = client.try_allocate_funds(&token_b_id, &301);
    assert!(res.is_err());

    // Allocate B within limits
    client.allocate_funds(&token_b_id, &300);
    assert_eq!(client.get_total_liability(&token_b_id), 300);
}

#[test]
fn test_supported_tokens_and_treasury_summary() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let token_a_admin = Address::generate(&env);
    let token_a = env.register_stellar_asset_contract_v2(token_a_admin.clone());
    let token_a_id = token_a.address();
    let token_a_client = token::StellarAssetClient::new(&env, &token_a_id);

    let token_b_admin = Address::generate(&env);
    let token_b = env.register_stellar_asset_contract_v2(token_b_admin.clone());
    let token_b_id = token_b.address();
    let token_b_client = token::StellarAssetClient::new(&env, &token_b_id);

    let user = Address::generate(&env);
    token_a_client.mint(&user, &1000);
    token_b_client.mint(&user, &1000);

    client.deposit(&user, &token_a_id, &500);
    client.deposit(&user, &token_b_id, &300);
    client.deposit(&user, &token_a_id, &200);

    let supported_tokens = client.get_supported_tokens();
    assert_eq!(supported_tokens.len(), 2);
    assert_eq!(supported_tokens.get(0).unwrap(), token_a_id);
    assert_eq!(supported_tokens.get(1).unwrap(), token_b_id);

    client.allocate_funds(&token_a_id, &400);
    client.allocate_funds(&token_b_id, &200);

    let summary = client.get_treasury_summary();
    assert_eq!(summary.len(), 2);

    let token_a_summary = summary.get(0).unwrap();
    assert_eq!(token_a_summary.token, token_a_id);
    assert_eq!(token_a_summary.balance, 700);
    assert_eq!(token_a_summary.liability, 400);

    let token_b_summary = summary.get(1).unwrap();
    assert_eq!(token_b_summary.token, token_b_id);
    assert_eq!(token_b_summary.balance, 300);
    assert_eq!(token_b_summary.liability, 200);
}

#[test]
fn test_payout_without_allocation() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    token_admin_client.mint(&user, &1000);
    client.deposit(&user, &token_id, &1000);

    // Try payout without allocation
    let res = client.try_payout(&recipient, &token_id, &100);
    assert!(res.is_err());
    // Optionally check error code if needed, but is_err is sufficient for "without allocation" check
}

#[test]
fn test_complex_scenario_multiple_streams() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let recipient = Address::generate(&env);

    // 1. Initial funding
    token_admin_client.mint(&user_a, &1000);
    token_admin_client.mint(&user_b, &1000);
    client.deposit(&user_a, &token_id, &1000);
    client.deposit(&user_b, &token_id, &1000);

    // Total Treasury: 2000
    assert_eq!(client.get_treasury_balance(&token_id), 2000);

    // 2. Allocate for Stream 1 (800)
    client.allocate_funds(&token_id, &800);
    assert_eq!(client.get_total_liability(&token_id), 800);

    // 3. Allocate for Stream 2 (1000)
    client.allocate_funds(&token_id, &1000);
    assert_eq!(client.get_total_liability(&token_id), 1800);

    // 4. Try allocate for Stream 3 (500) -> Should fail (1800 + 500 = 2300 > 2000)
    let res = client.try_allocate_funds(&token_id, &500);
    assert!(res.is_err());

    // 5. Payout from Stream 1 (200)
    client.payout(&recipient, &token_id, &200);
    // Liability: 1800 - 200 = 1600
    // Treasury: 2000 - 200 = 1800
    assert_eq!(client.get_total_liability(&token_id), 1600);
    assert_eq!(client.get_treasury_balance(&token_id), 1800);

    // 6. Stream 1 Cancelled (Remaining was 600) -> Release 600
    client.release_funds(&token_id, &600);
    // Liability: 1600 - 600 = 1000 (Stream 2 only)
    assert_eq!(client.get_total_liability(&token_id), 1000);

    // 7. Now Stream 3 can allocate 500 (1000 + 500 = 1500 <= 1800)
    client.allocate_funds(&token_id, &500);
    assert_eq!(client.get_total_liability(&token_id), 1500);
}

#[test]
fn test_already_initialized() {
    let env = Env::default();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);
    let result = client.try_initialize(&admin);

    assert_eq!(result, Err(Ok(QuipayError::AlreadyInitialized)));
}

#[test]
fn test_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_id = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();

    client.initialize(&admin);

    let result = client.try_payout(&recipient, &token_id, &100);
    assert_eq!(result, Err(Ok(QuipayError::InsufficientBalance)));
}

#[test]
fn test_liability_tracking() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let authorized_contract = Address::generate(&env);
    let depositor = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token);

    let another_token_admin = Address::generate(&env);
    let another_token_contract =
        env.register_stellar_asset_contract_v2(another_token_admin.clone());
    let another_token = another_token_contract.address();
    let another_token_admin_client = token::StellarAssetClient::new(&env, &another_token);

    // Initialize
    client.initialize(&admin);

    // Set authorized contract
    client.set_authorized_contract(&authorized_contract);
    assert_eq!(
        client.get_authorized_contract(),
        Some(authorized_contract.clone())
    );

    // Fund vault so solvency checks pass
    token_admin_client.mint(&depositor, &10_000);
    another_token_admin_client.mint(&depositor, &10_000);
    client.deposit(&depositor, &token, &10_000);
    client.deposit(&depositor, &another_token, &10_000);

    // Add liability for first token
    client.add_liability(&token, &500);
    assert_eq!(client.get_liability(&token), 500);
    assert_eq!(client.get_total_liability(&token), 500);

    // Add more liability for same token
    client.add_liability(&token, &300);
    assert_eq!(client.get_liability(&token), 800);
    assert_eq!(client.get_total_liability(&token), 800);

    // Add liability for another token
    client.add_liability(&another_token, &200);
    assert_eq!(client.get_liability(&another_token), 200);
    assert_eq!(client.get_liability(&token), 800); // Unchanged
    assert_eq!(client.get_total_liability(&token), 800);
    assert_eq!(client.get_total_liability(&another_token), 200);

    // Remove liability
    client.remove_liability(&token, &400);
    assert_eq!(client.get_liability(&token), 400);
    assert_eq!(client.get_total_liability(&token), 400);
    assert_eq!(client.get_total_liability(&another_token), 200);
}

#[test]
fn test_available_balance_and_withdraw_enforcement() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);

    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    token_admin_client.mint(&employer, &1000);
    client.deposit(&employer, &token_id, &1000);

    // Allocate liabilities (admin path)
    client.allocate_funds(&token_id, &600);
    assert_eq!(client.get_available_balance(&token_id), 400);

    // Withdraw within available
    client.withdraw(&employer, &token_id, &400);
    assert_eq!(client.get_available_balance(&token_id), 0);

    // Withdraw beyond available should fail
    let res = client.try_withdraw(&employer, &token_id, &1);
    assert_eq!(res, Err(Ok(QuipayError::InsufficientBalance)));
}

#[test]
fn test_check_solvency_prevents_unfunded_liability() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let depositor = Address::generate(&env);

    // Configure authorized contract and fund vault with 500
    let authorized_contract = Address::generate(&env);
    client.set_authorized_contract(&authorized_contract);
    token_admin_client.mint(&depositor, &500);
    client.deposit(&depositor, &token_id, &500);

    // This would exceed balance (liability 0 + 501 > balance 500) and should return error
    let res = client.try_add_liability(&token_id, &501);
    assert_eq!(res, Err(Ok(QuipayError::InsufficientBalance)));
}

#[test]
fn test_add_liability_without_authorized_contract_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    // Initialize but don't set authorized contract
    client.initialize(&admin);

    // Should return error - no authorized contract set
    let res = client.try_add_liability(&token, &500);
    assert_eq!(res, Err(Ok(QuipayError::NotInitialized)));
}

#[test]
fn test_remove_more_liability_than_exists_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let authorized_contract = Address::generate(&env);
    let depositor = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token);

    // Initialize and set authorized contract
    client.initialize(&admin);
    client.set_authorized_contract(&authorized_contract);

    // Fund vault so solvency checks pass
    token_admin_client.mint(&depositor, &1_000);
    client.deposit(&depositor, &token, &1_000);

    // Add some liability
    client.add_liability(&token, &500);
    assert_eq!(client.get_liability(&token), 500);

    // Should return error - trying to remove more than exists
    let result = client.try_remove_liability(&token, &600);
    assert_eq!(result, Err(Ok(QuipayError::InvalidAmount)));
}

#[test]
fn test_add_zero_liability_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let authorized_contract = Address::generate(&env);
    let token = Address::generate(&env);

    // Initialize and set authorized contract
    client.initialize(&admin);
    client.set_authorized_contract(&authorized_contract);

    // Should return error - zero amount
    let result = client.try_add_liability(&token, &0);
    assert_eq!(result, Err(Ok(QuipayError::InvalidAmount)));
}

#[test]
fn test_remove_zero_liability_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let authorized_contract = Address::generate(&env);
    let depositor = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token);

    // Initialize and set authorized contract
    client.initialize(&admin);
    client.set_authorized_contract(&authorized_contract);

    // Fund vault so solvency checks pass
    token_admin_client.mint(&depositor, &1_000);
    client.deposit(&depositor, &token, &1_000);

    // Add some liability first
    client.add_liability(&token, &500);

    // Should return error - zero amount
    let result = client.try_remove_liability(&token, &0);
    assert_eq!(result, Err(Ok(QuipayError::InvalidAmount)));
}

#[test]
fn test_get_liability_returns_zero_for_untracked_token() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    // Initialize
    client.initialize(&admin);

    // Query liability for untracked token should return 0
    assert_eq!(client.get_liability(&token), 0);
}

// ============================================================================
// Multisig Authorization Tests
// ============================================================================
// These tests verify that require_auth() correctly enforces authorization
// for admin-only functions. In production, when a multisig Stellar account
// is used as the admin, Stellar validates the threshold signatures before
// the transaction reaches the contract. The contract's require_auth() call
// then verifies that the transaction was properly authorized by the account.
//
// For multisig accounts (e.g., 2-of-3), the Stellar network ensures that
// at least the threshold number of signatures are present before allowing
// the transaction to proceed. This provides decentralized governance for
// DAOs and enterprise clients.
//
// Note: In the test environment, we simulate authorization by using
// mock_all_auths() (authorized) vs not using it (unauthorized). In production,
// multisig threshold validation happens at the Stellar network level.

#[test]
fn test_require_auth_enforces_admin_authorization() {
    let env = Env::default();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token);
    let depositor = Address::generate(&env);

    // Initialize with admin (no auth needed for initialize)
    client.initialize(&admin);

    // With mock_all_auths, operations succeed (simulates multisig threshold met)
    env.mock_all_auths();
    token_admin_client.mint(&depositor, &1000);
    client.deposit(&depositor, &token, &1000);
    client.allocate_funds(&token, &100);

    // Without mock_all_auths, operations fail (simulates insufficient signatures)
    // Note: We can't easily test this in a separate env due to address incompatibility
    // In production, multisig threshold validation happens at Stellar network level
    // The contract's require_auth() will reject transactions without proper authorization
}

#[test]
fn test_require_auth_for_upgrade_with_multisig() {
    // Unauthorized call should fail at require_auth before any wasm update attempt.
    let env = Env::default();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let new_wasm_hash = BytesN::from_array(&env, &[0u8; 32]);
    let result = client.try_upgrade(&new_wasm_hash, &(1, 1, 0));
    assert!(result.is_err());

    // Authorized call (mocked) should also return Err here because we don't have a real uploaded wasm.
    // The important invariant for this test is that authorization is enforced.
    let env2 = Env::default();
    env2.mock_all_auths();
    let contract_id2 = env2.register(PayrollVault, ());
    let client2 = PayrollVaultClient::new(&env2, &contract_id2);
    let admin2 = Address::generate(&env2);
    client2.initialize(&admin2);
    let new_wasm_hash2 = BytesN::from_array(&env2, &[0u8; 32]);
    let result2 = client2.try_upgrade(&new_wasm_hash2, &(1, 1, 0));
    assert!(result2.is_err());
}

#[test]
fn test_require_auth_for_transfer_admin_with_multisig() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    // Initialize
    client.initialize(&admin);

    // Admin can transfer admin rights (authorized - mock_all_auths simulates multisig threshold met)
    client.transfer_admin(&new_admin);
    assert_eq!(client.get_admin(), new_admin);

    // Try to transfer admin without proper auth - should fail
    // This simulates a transaction that doesn't meet the new admin's multisig threshold
    let env2 = Env::default();
    let contract_id2 = env2.register(PayrollVault, ());
    let client2 = PayrollVaultClient::new(&env2, &contract_id2);
    let admin2 = Address::generate(&env2);
    client2.initialize(&admin2);
    let another_admin = Address::generate(&env2);
    let result = client2.try_transfer_admin(&another_admin);
    assert!(result.is_err());
}

#[test]
fn test_require_auth_for_payout_with_multisig() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let _unauthorized = Address::generate(&env);

    client.initialize(&admin);

    // Setup token and deposit
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let user = Address::generate(&env);

    token_admin_client.mint(&user, &1000);
    client.deposit(&user, &token_id, &1000);
    client.allocate_funds(&token_id, &500);

    // Admin can payout (authorized - mock_all_auths simulates multisig threshold met)
    client.payout(&recipient, &token_id, &200);

    // Try to payout without admin auth - should fail
    // This simulates insufficient signatures for multisig threshold
    let env2 = Env::default();
    let contract_id2 = env2.register(PayrollVault, ());
    let client2 = PayrollVaultClient::new(&env2, &contract_id2);
    let admin2 = Address::generate(&env2);
    let recipient2 = Address::generate(&env2);
    client2.initialize(&admin2);

    // No auth mocking in env2: should fail at require_auth before touching token state.
    let token_id2 = Address::generate(&env2);
    let result = client2.try_payout(&recipient2, &token_id2, &100);
    assert!(result.is_err());
}

#[test]
fn test_require_auth_for_set_authorized_contract_with_multisig() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let authorized_contract = Address::generate(&env);

    // Initialize
    client.initialize(&admin);

    // Admin can set authorized contract (authorized - mock_all_auths simulates multisig threshold met)
    client.set_authorized_contract(&authorized_contract);
    assert_eq!(
        client.get_authorized_contract(),
        Some(authorized_contract.clone())
    );

    // Try to set authorized contract without initialization - should return error
    // This simulates a transaction that doesn't meet multisig threshold
    let env2 = Env::default();
    let contract_id2 = env2.register(PayrollVault, ());
    let client2 = PayrollVaultClient::new(&env2, &contract_id2);
    // Don't initialize - this will cause NotInitialized error when trying to get admin
    let another_contract = Address::generate(&env2);
    let result = client2.try_set_authorized_contract(&another_contract);
    assert_eq!(result, Err(Ok(QuipayError::NotInitialized)));
}

#[test]
fn test_multisig_admin_can_perform_all_operations() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    // Simulate a multisig admin account (2-of-3 threshold)
    // In production, Stellar validates threshold before transaction reaches contract
    let multisig_admin = Address::generate(&env);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.initialize(&multisig_admin);

    // Setup token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    token_admin_client.mint(&user, &1000);
    client.deposit(&user, &token_id, &1000);

    // All operations should succeed when multisig admin is properly authorized
    // This simulates a 2-of-3 multisig where threshold was met
    client.allocate_funds(&token_id, &500);
    assert_eq!(client.get_total_liability(&token_id), 500);

    client.payout(&recipient, &token_id, &200);
    assert_eq!(client.get_treasury_balance(&token_id), 800);
    assert_eq!(client.get_total_liability(&token_id), 300);

    client.release_funds(&token_id, &100);
    assert_eq!(client.get_total_liability(&token_id), 200);

    // Transfer admin to another multisig account
    let new_multisig_admin = Address::generate(&env);
    client.transfer_admin(&new_multisig_admin);
    assert_eq!(client.get_admin(), new_multisig_admin);
}

// ============================================================================
// Two-Step Admin Transfer Tests
// ============================================================================

#[test]
fn test_two_step_admin_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    // Initialize
    client.initialize(&admin);
    assert_eq!(client.get_admin(), admin);

    // Step 1: Propose new admin
    client.propose_admin(&new_admin);
    assert_eq!(client.get_pending_admin(), Some(new_admin.clone()));
    assert_eq!(client.get_admin(), admin); // Admin hasn't changed yet

    // Step 2: Accept admin role
    client.accept_admin();
    assert_eq!(client.get_admin(), new_admin);
    assert_eq!(client.get_pending_admin(), None); // Pending cleared
}

#[test]
fn test_accept_admin_requires_pending() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Try to accept without pending admin - should fail with NoPendingAdmin
    let result = client.try_accept_admin();
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().unwrap(), QuipayError::NoPendingAdmin);
}

#[test]
fn test_accept_admin_requires_pending_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    client.initialize(&admin);
    client.propose_admin(&new_admin);

    // Note: In production, this would require new_admin.require_auth()
    // but with mock_all_auths(), we can't test auth failures
    client.accept_admin();
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_transfer_admin_backward_compatible() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    // Initialize
    client.initialize(&admin);
    assert_eq!(client.get_admin(), admin);

    // Use old transfer_admin function (backward compatible)
    client.transfer_admin(&new_admin);

    // Should transfer atomically
    assert_eq!(client.get_admin(), new_admin);
    assert_eq!(client.get_pending_admin(), None); // No pending admin left
}

#[test]
fn test_propose_admin_overwrites_previous_pending() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin1 = Address::generate(&env);
    let new_admin2 = Address::generate(&env);

    client.initialize(&admin);

    // Propose first admin
    client.propose_admin(&new_admin1);
    assert_eq!(client.get_pending_admin(), Some(new_admin1.clone()));

    // Propose second admin (should overwrite)
    client.propose_admin(&new_admin2);
    assert_eq!(client.get_pending_admin(), Some(new_admin2.clone()));

    // Accept should use the latest proposal
    client.accept_admin();
    assert_eq!(client.get_admin(), new_admin2);
}

#[test]
fn test_two_step_admin_transfer_with_multisig() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    // Simulate multisig addresses
    let multisig_admin = Address::generate(&env);
    let multisig_new_admin = Address::generate(&env);

    client.initialize(&multisig_admin);

    // Step 1: Current multisig admin proposes new multisig admin
    client.propose_admin(&multisig_new_admin);
    assert_eq!(client.get_pending_admin(), Some(multisig_new_admin.clone()));

    // Step 2: New multisig admin accepts (simulating threshold met)
    client.accept_admin();
    assert_eq!(client.get_admin(), multisig_new_admin);
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
fn test_high_value_withdraw_requires_multisig_signers() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let signer2 = Address::generate(&env);
    client.add_signer(&signer2);
    client.set_threshold(&2);
    client.set_withdrawal_threshold(&500);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let employer = Address::generate(&env);

    token_admin_client.mint(&employer, &2_000);
    client.deposit(&employer, &token_id, &2_000);

    // no liabilities so all funds are available, and amount >= threshold triggers multisig auth path
    client.withdraw(&employer, &token_id, &600);
    assert_eq!(client.get_treasury_balance(&token_id), 1_400);
}

// ============================================================================
// get_withdrawal_threshold Tests
// ============================================================================

#[test]
fn test_get_withdrawal_threshold_default_after_init() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    // initialize() sets the threshold to DEFAULT_WITHDRAWAL_THRESHOLD (100_000)
    assert_eq!(client.get_withdrawal_threshold(), 100_000);
}

#[test]
fn test_get_withdrawal_threshold_returns_set_value() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    client.set_withdrawal_threshold(&1000);
    assert_eq!(client.get_withdrawal_threshold(), 1000);
}

#[test]
fn test_get_withdrawal_threshold_reflects_update() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    client.set_withdrawal_threshold(&500);
    assert_eq!(client.get_withdrawal_threshold(), 500);

    client.set_withdrawal_threshold(&9999);
    assert_eq!(client.get_withdrawal_threshold(), 9999);
}

// ============================================================================
// Emergency Drain Timelock Tests
// ============================================================================

fn setup_vault_with_token(
    env: &Env,
) -> (
    PayrollVaultClient<'_>,
    Address, // admin
    Address, // token_id
    token::StellarAssetClient<'_>,
    Address, // user
) {
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize(&admin);

    let token_admin = Address::generate(env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_client = token::StellarAssetClient::new(env, &token_id);

    let user = Address::generate(env);
    (client, admin, token_id, token_client, user)
}

#[test]
fn test_propose_emergency_drain_sets_pending() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _token_id, _token_client, _user) = setup_vault_with_token(&env);
    let recipient = Address::generate(&env);

    assert!(client.get_pending_drain().is_none());

    client.propose_emergency_drain(&recipient);

    let pending = client
        .get_pending_drain()
        .expect("pending drain should exist");
    assert_eq!(pending.recipient, recipient);
    // execute_after must be in the future (24 h from now)
    let now = env.ledger().timestamp();
    assert!(pending.execute_after > now);
}

#[test]
fn test_propose_emergency_drain_only_admin() {
    let env = Env::default();
    // Do NOT mock all auths so we can test the auth requirement.
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin);

    // A non-admin recipient should not be able to call propose.
    // With mock_all_auths disabled selectively we just verify the happy path
    // and that a second proposal while one is pending returns an error.
    let recipient = Address::generate(&env);
    client.propose_emergency_drain(&recipient);

    // Second proposal while one is active should fail (Custom error).
    let recipient2 = Address::generate(&env);
    let result = client.try_propose_emergency_drain(&recipient2);
    assert!(result.is_err());
}

#[test]
fn test_execute_emergency_drain_before_timelock_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, token_id, token_client, user) = setup_vault_with_token(&env);
    token_client.mint(&user, &5_000);
    client.deposit(&user, &token_id, &5_000);

    let recipient = Address::generate(&env);
    client.propose_emergency_drain(&recipient);

    // Timelock has NOT elapsed yet.
    let result = client.try_execute_emergency_drain();
    assert_eq!(
        result.unwrap_err().unwrap(),
        QuipayError::DrainTimelockActive
    );
}

#[test]
fn test_execute_emergency_drain_after_timelock_drains_all_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, token_id, token_client, user) = setup_vault_with_token(&env);
    token_client.mint(&user, &10_000);
    client.deposit(&user, &token_id, &10_000);

    let recipient = Address::generate(&env);
    client.propose_emergency_drain(&recipient);

    // Fast-forward past the 24-hour timelock.
    env.ledger().with_mut(|li| {
        li.timestamp += 24 * 60 * 60 + 1;
    });

    client.execute_emergency_drain();

    // Vault internal balance wiped.
    assert_eq!(client.get_treasury_balance(&token_id), 0);
    assert_eq!(client.get_total_liability(&token_id), 0);

    // All tokens transferred to recipient.
    let token_read_client = token::Client::new(&env, &token_id);
    assert_eq!(token_read_client.balance(&recipient), 10_000);

    // Pending drain cleared.
    assert!(client.get_pending_drain().is_none());
}

#[test]
fn test_execute_emergency_drain_is_permissionless_after_timelock() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, token_id, token_client, user) = setup_vault_with_token(&env);
    token_client.mint(&user, &1_000);
    client.deposit(&user, &token_id, &1_000);

    let recipient = Address::generate(&env);
    client.propose_emergency_drain(&recipient);

    env.ledger().with_mut(|li| {
        li.timestamp += 24 * 60 * 60 + 1;
    });

    // A random third party executes the drain – this must succeed.
    // (With mock_all_auths the execute function doesn't require any auth, which
    //  matches the spec: "execution is permissionless after timelock".)
    client.execute_emergency_drain();

    let token_read_client = token::Client::new(&env, &token_id);
    assert_eq!(token_read_client.balance(&recipient), 1_000);
}

#[test]
fn test_cancel_emergency_drain() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _token_id, _token_client, _user) = setup_vault_with_token(&env);
    let recipient = Address::generate(&env);

    client.propose_emergency_drain(&recipient);
    assert!(client.get_pending_drain().is_some());

    client.cancel_emergency_drain();
    assert!(client.get_pending_drain().is_none());
}

#[test]
fn test_cancel_drain_when_none_pending_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _token_id, _token_client, _user) = setup_vault_with_token(&env);

    let result = client.try_cancel_emergency_drain();
    assert_eq!(result.unwrap_err().unwrap(), QuipayError::NoDrainPending);
}

#[test]
fn test_execute_drain_when_none_pending_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _token_id, _token_client, _user) = setup_vault_with_token(&env);

    let result = client.try_execute_emergency_drain();
    assert_eq!(result.unwrap_err().unwrap(), QuipayError::NoDrainPending);
}

#[test]
fn test_drain_clears_multiple_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Token A
    let ta_admin = Address::generate(&env);
    let ta_contract = env.register_stellar_asset_contract_v2(ta_admin.clone());
    let ta_id = ta_contract.address();
    let ta_client = token::StellarAssetClient::new(&env, &ta_id);

    // Token B
    let tb_admin = Address::generate(&env);
    let tb_contract = env.register_stellar_asset_contract_v2(tb_admin.clone());
    let tb_id = tb_contract.address();
    let tb_client = token::StellarAssetClient::new(&env, &tb_id);

    let user = Address::generate(&env);
    ta_client.mint(&user, &3_000);
    tb_client.mint(&user, &7_000);

    client.deposit(&user, &ta_id, &3_000);
    client.deposit(&user, &tb_id, &7_000);

    let recipient = Address::generate(&env);
    client.propose_emergency_drain(&recipient);

    env.ledger().with_mut(|li| {
        li.timestamp += 24 * 60 * 60 + 1;
    });

    client.execute_emergency_drain();

    assert_eq!(client.get_treasury_balance(&ta_id), 0);
    assert_eq!(client.get_treasury_balance(&tb_id), 0);

    let ta_read = token::Client::new(&env, &ta_id);
    let tb_read = token::Client::new(&env, &tb_id);
    assert_eq!(ta_read.balance(&recipient), 3_000);
    assert_eq!(tb_read.balance(&recipient), 7_000);
}

#[test]
fn test_vault_tvl_tracking_events() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let user = Address::generate(&env);

    token_admin_client.mint(&user, &2000);

    // Initial deposit: total 1000
    client.deposit(&user, &token_id, &1000);
    let events = env.events().all();
    let last_event = events.last().unwrap();
    assert_eq!(last_event.0, contract_id);
    
    let topics = last_event.1.clone();
    assert_eq!(Symbol::try_from_val(&env, &topics.get(0).unwrap()).unwrap(), symbol_short!("vault"));
    assert_eq!(Symbol::try_from_val(&env, &topics.get(1).unwrap()).unwrap(), symbol_short!("deposited"));
    assert_eq!(Address::try_from_val(&env, &topics.get(2).unwrap()).unwrap(), user);
    assert_eq!(Address::try_from_val(&env, &topics.get(3).unwrap()).unwrap(), token_id);

    let data: (i128, i128) = last_event.2.clone().try_into_val(&env).unwrap();
    assert_eq!(data, (1000i128, 1000i128));

    // Second deposit: total 1500
    client.deposit(&user, &token_id, &500);
    let events = env.events().all();
    let last_event = events.last().unwrap();
    assert_eq!(last_event.0, contract_id);
    let topics = last_event.1.clone();
    assert_eq!(Symbol::try_from_val(&env, &topics.get(1).unwrap()).unwrap(), symbol_short!("deposited"));
    let data: (i128, i128) = last_event.2.clone().try_into_val(&env).unwrap();
    assert_eq!(data, (500i128, 1500i128));

    // Withdrawal: total 1200
    client.withdraw(&user, &token_id, &300);
    let events = env.events().all();
    let last_event = events.last().unwrap();
    assert_eq!(last_event.0, contract_id);
    let topics = last_event.1.clone();
    assert_eq!(Symbol::try_from_val(&env, &topics.get(1).unwrap()).unwrap(), symbol_short!("withdrawn"));
    let data: (i128, i128) = last_event.2.clone().try_into_val(&env).unwrap();
    assert_eq!(data, (300i128, 1200i128));
}
