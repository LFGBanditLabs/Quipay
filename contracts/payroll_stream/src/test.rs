#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, Env, token};
use payroll_vault::{PayrollVault, PayrollVaultClient};

fn create_token_contract<'a>(e: &Env, admin: &Address) -> token::Client<'a> {
    let contract = e.register_stellar_asset_contract_v2(admin.clone());
    token::Client::new(e, &contract.address())
}

struct TestSetup<'a> {
    env: Env,
    stream_client: PayrollStreamClient<'a>,
    vault_client: PayrollVaultClient<'a>,
    token_client: token::Client<'a>,
    #[allow(dead_code)]
    token_admin: Address,
    #[allow(dead_code)]
    admin: Address,
    employer: Address,
    worker: Address,
    token_address: Address,
}

fn setup_test<'a>() -> TestSetup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token_admin = Address::generate(&env);

    // Deploy Token
    let token_client = create_token_contract(&env, &token_admin);
    let token_address = token_client.address.clone();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    // Deploy PayrollVault
    // We register the contract using the imported struct
    let vault_id = env.register(PayrollVault, ());
    let vault_client = PayrollVaultClient::new(&env, &vault_id);

    // Deploy PayrollStream
    let stream_id = env.register(PayrollStream, ());
    let stream_client = PayrollStreamClient::new(&env, &stream_id);

    // Initialize Vault with Stream as Admin so Stream can allocate/payout
    vault_client.initialize(&stream_id);

    // Initialize Stream with Admin and set Vault
    stream_client.init(&admin);
    stream_client.set_vault(&vault_id);

    // Mint tokens to employer
    token_admin_client.mint(&employer, &10000);

    // Employer deposits to Vault (so there is balance for allocation)
    // Note: deposit requires 'from' auth, and we mocked all auths.
    vault_client.deposit(&employer, &token_address, &10000);

    TestSetup {
        env,
        stream_client,
        vault_client,
        token_client,
        token_admin,
        admin,
        employer,
        worker,
        token_address,
    }
}

#[test]
fn test_pause_mechanism() {
    let setup = setup_test();
    let client = setup.stream_client;

    // 1. Initial state: not paused
    assert!(!client.is_paused());
    client.create_stream(&setup.employer, &setup.worker, &setup.token_address, &1000, &0u64, &10u64); 

    // 2. Admin pauses the protocol
    client.set_paused(&true);
    assert!(client.is_paused());
}

#[test]
#[should_panic(expected = "protocol is paused")]
fn test_create_stream_paused() {
    let setup = setup_test();
    let client = setup.stream_client;

    client.set_paused(&true);
    client.create_stream(&setup.employer, &setup.worker, &setup.token_address, &1000, &0u64, &10u64);
}

#[test]
#[should_panic(expected = "protocol is paused")]
fn test_withdraw_paused() {
    let setup = setup_test();
    let client = setup.stream_client;
    
    // Create stream first
    let stream_id = client.create_stream(&setup.employer, &setup.worker, &setup.token_address, &1000, &0u64, &10u64);

    client.set_paused(&true);
    client.withdraw(&stream_id, &setup.worker);
}

#[test]
#[should_panic(expected = "protocol is paused")]
fn test_cancel_stream_paused() {
    let setup = setup_test();
    let client = setup.stream_client;

    // Create stream first
    let stream_id = client.create_stream(&setup.employer, &setup.worker, &setup.token_address, &1000, &0u64, &10u64);

    client.set_paused(&true);
    client.cancel_stream(&stream_id, &setup.employer);
}

#[test]
fn test_unpause_resumes_operations() {
    let setup = setup_test();
    let client = setup.stream_client;

    client.set_paused(&true);
    assert!(client.is_paused());

    client.set_paused(&false);
    assert!(!client.is_paused());
    client.create_stream(&setup.employer, &setup.worker, &setup.token_address, &1000, &0u64, &10u64);
}

#[test]
fn test_stream_lifecycle_integration() {
    let setup = setup_test();
    let env = setup.env;
    let client = setup.stream_client;
    let vault = setup.vault_client;
    let token_address = setup.token_address;

    // Set retention to 0 for easier cleanup testing
    client.set_retention_secs(&0u64);

    // 1. Create Stream (1000 tokens)
    // Time = 0
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&setup.employer, &setup.worker, &token_address, &1000, &0u64, &10u64);

    // Verify Vault Liability
    assert_eq!(vault.get_total_liability(&token_address), 1000);
    assert_eq!(vault.get_treasury_balance(&token_address), 10000);

    // 2. Withdraw half way (Time = 5)
    env.ledger().with_mut(|li| { li.timestamp = 5; });
    let withdrawn_1 = client.withdraw(&stream_id, &setup.worker);
    assert_eq!(withdrawn_1, 500);

    // Verify Vault State
    // Liability reduced by 500, Balance reduced by 500
    assert_eq!(vault.get_total_liability(&token_address), 500);
    assert_eq!(vault.get_treasury_balance(&token_address), 9500);
    // Worker should have 500 tokens
    assert_eq!(setup.token_client.balance(&setup.worker), 500);

    // 3. Withdraw remaining (Time = 10)
    env.ledger().with_mut(|li| { li.timestamp = 10; });
    let withdrawn_2 = client.withdraw(&stream_id, &setup.worker);
    assert_eq!(withdrawn_2, 500);

    // Verify Vault State
    assert_eq!(vault.get_total_liability(&token_address), 0);
    assert_eq!(vault.get_treasury_balance(&token_address), 9000);
    assert_eq!(setup.token_client.balance(&setup.worker), 1000);

    let stream = client.get_stream(&stream_id).unwrap();
    assert!(stream.withdrawn_amount >= stream.total_amount);

    // 4. Cleanup
    client.cleanup_stream(&stream_id);
    assert!(client.get_stream(&stream_id).is_none());
}

#[test]
fn test_cancel_stream_integration() {
    let setup = setup_test();
    let env = setup.env;
    let client = setup.stream_client;
    let vault = setup.vault_client;
    let token_address = setup.token_address;

    // 1. Create Stream (1000 tokens)
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&setup.employer, &setup.worker, &token_address, &1000, &0u64, &10u64);

    assert_eq!(vault.get_total_liability(&token_address), 1000);

    // 2. Withdraw partial (Time = 2, 200 tokens)
    env.ledger().with_mut(|li| { li.timestamp = 2; });
    let withdrawn = client.withdraw(&stream_id, &setup.worker);
    assert_eq!(withdrawn, 200);

    assert_eq!(vault.get_total_liability(&token_address), 800);
    assert_eq!(vault.get_treasury_balance(&token_address), 9800);

    // 3. Cancel Stream
    client.cancel_stream(&stream_id, &setup.employer);

    // Verify Vault Liability released
    // Remaining was 800. Cancel should release it.
    assert_eq!(vault.get_total_liability(&token_address), 0);
    // Balance remains 9800 (employer can withdraw it from vault manually, not tested here)
    assert_eq!(vault.get_treasury_balance(&token_address), 9800);

    // 4. Verify Stream Closed
    let stream = client.get_stream(&stream_id).unwrap();
    // Status bits for Canceled = 1 (bit 1)
    assert!((stream.status_bits & (1 << 1)) != 0);
}
