use crate::{PayrollVault, PayrollVaultClient, StateKey};
use quipay_common::QuipayError;
use soroban_sdk::{
    Address, Env, Vec,
    testutils::{Address as _, Ledger},
};

#[test]
fn test_duplicate_signers_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollVault);
    let client = PayrollVaultClient::new(&env, &contract_id);

    // Initialize the vault
    client.initialize(&admin);

    // Propose an upgrade first
    let new_wasm_hash = soroban_sdk::BytesN::from_array(&env, &[0u8; 32]);
    client.propose_upgrade(&new_wasm_hash, &(2, 0, 0));

    // Fast forward time past the timelock (48 hours)
    env.ledger()
        .set_timestamp(env.ledger().timestamp() + (48 * 60 * 60) + 1);

    // Manually create a duplicate signer list to test the deduplication check
    let mut signers = Vec::new(&env);
    signers.push_back(admin.clone());
    signers.push_back(signer1.clone());
    signers.push_back(signer1.clone()); // Duplicate!
    signers.push_back(signer2.clone());

    // Manually set the signers list with duplicates
    env.as_contract(&contract_id, || {
        env.storage().persistent().set(&StateKey::Signers, &signers);
        env.storage().persistent().set(&StateKey::Threshold, &2u32);
    });

    // Try to execute the upgrade which requires multisig auth
    // This should fail due to duplicate signers
    let result = client.try_execute_upgrade(&(2, 0, 0));

    // The operation should fail with DuplicateSigner error
    assert!(result.is_err());
    match result {
        Err(Ok(err)) => {
            assert_eq!(err, QuipayError::DuplicateSigner);
        }
        _ => panic!("Expected DuplicateSigner error"),
    }
}

#[test]
fn test_unique_signers_accepted() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollVault);
    let client = PayrollVaultClient::new(&env, &contract_id);

    // Initialize the vault
    client.initialize(&admin);

    // Add unique signers
    client.add_signer(&signer1);
    client.add_signer(&signer2);

    // Set threshold to 2
    client.set_threshold(&2);

    // Verify signers are unique
    let signers = client.get_signers();
    assert_eq!(signers.len(), 3); // admin + signer1 + signer2

    // Verify no duplicates
    let mut i = 0;
    while i < signers.len() {
        let signer_i = signers.get(i).unwrap();
        let mut j = i + 1;
        while j < signers.len() {
            let signer_j = signers.get(j).unwrap();
            assert_ne!(signer_i, signer_j, "Found duplicate signer");
            j += 1;
        }
        i += 1;
    }
}

#[test]
fn test_add_duplicate_signer_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollVault);
    let client = PayrollVaultClient::new(&env, &contract_id);

    // Initialize the vault
    client.initialize(&admin);

    // Add signer1
    client.add_signer(&signer1);

    // Try to add signer1 again - should fail
    let result = client.try_add_signer(&signer1);
    assert!(result.is_err());

    // Verify error is AlreadySigner
    match result {
        Err(Ok(err)) => {
            assert_eq!(err, QuipayError::AlreadySigner);
        }
        _ => panic!("Expected AlreadySigner error"),
    }
}

#[test]
fn test_multisig_threshold_with_unique_signers() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let token = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollVault);
    let client = PayrollVaultClient::new(&env, &contract_id);

    // Initialize the vault
    client.initialize(&admin);

    // Add unique signers
    client.add_signer(&signer1);
    client.add_signer(&signer2);

    // Set threshold to 2 (requires 2 out of 3 signers)
    client.set_threshold(&2);

    // This should succeed with unique signers
    client.set_authorized_contract(&token);

    // Verify the authorized contract was set
    let authorized = client.get_authorized_contract();
    assert_eq!(authorized, Some(token));
}
