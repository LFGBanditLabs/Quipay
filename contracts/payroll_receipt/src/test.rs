use soroban_sdk::{testutils::Address as _, Address, Env};
use payroll_receipt::{PayrollReceipt, ReceiptType};

#[test]
fn test_init() {
    let env = Env::default();
    let admin = Address::random(&env);
    
    PayrollReceipt::init(&env, admin.clone());
    
    // Verify admin is set
    assert_eq!(env.storage().instance().get(&super::DataKey::ADMIN), Some(admin));
}

#[test]
fn test_init_twice_fails() {
    let env = Env::default();
    let admin = Address::random(&env);
    
    PayrollReceipt::init(&env, admin.clone());
    
    // Second init should fail
    std::panic::catch_unwind(|| {
        PayrollReceipt::init(&env, admin);
    })
    .unwrap_err();
}

#[test]
fn test_mint_receipt() {
    let env = Env::default();
    let admin = Address::random(&env);
    let employer = Address::random(&env);
    let worker = Address::random(&env);
    let token = Address::random(&env);
    
    PayrollReceipt::init(&env, admin.clone());
    
    let receipt_id = PayrollReceipt::mint_receipt(
        &env,
        employer.clone(),
        worker.clone(),
        token,
        1000000, // 0.1 XLM
        123,
        1640995200, // Jan 1, 2022
        1643587200, // Feb 1, 2022
        ReceiptType::Completed,
    );
    
    assert_eq!(receipt_id, 1);
    
    // Verify receipt exists
    let receipt = PayrollReceipt::get_receipt(&env, receipt_id).unwrap();
    assert_eq!(receipt.id, receipt_id);
    assert_eq!(receipt.metadata.employer, employer);
    assert_eq!(receipt.metadata.worker, worker);
    assert_eq!(receipt.metadata.total_paid, 1000000);
    assert_eq!(receipt.metadata.stream_id, 123);
    assert_eq!(receipt.metadata.receipt_type, ReceiptType::Completed);
}

#[test]
fn test_mint_receipt_unauthorized() {
    let env = Env::default();
    let admin = Address::random(&env);
    let unauthorized = Address::random(&env);
    let employer = Address::random(&env);
    let worker = Address::random(&env);
    let token = Address::random(&env);
    
    PayrollReceipt::init(&env, admin);
    
    // Try to mint as unauthorized user
    env.set_invoker(&unauthorized);
    
    std::panic::catch_unwind(|| {
        PayrollReceipt::mint_receipt(
            &env,
            employer,
            worker,
            token,
            1000000,
            123,
            1640995200,
            1643587200,
            ReceiptType::Completed,
        );
    })
    .unwrap_err();
}

#[test]
fn test_mint_receipt_duplicate_stream() {
    let env = Env::default();
    let admin = Address::random(&env);
    let employer = Address::random(&env);
    let worker = Address::random(&env);
    let token = Address::random(&env);
    
    PayrollReceipt::init(&env, admin);
    
    // Mint first receipt
    let _receipt_id1 = PayrollReceipt::mint_receipt(
        &env,
        employer.clone(),
        worker.clone(),
        token,
        1000000,
        123, // Same stream ID
        1640995200,
        1643587200,
        ReceiptType::Completed,
    );
    
    // Try to mint second receipt for same stream
    std::panic::catch_unwind(|| {
        PayrollReceipt::mint_receipt(
            &env,
            employer,
            worker,
            token,
            2000000,
            123, // Same stream ID
            1640995200,
            1643587200,
            ReceiptType::Cancelled,
        );
    })
    .unwrap_err();
}

#[test]
fn test_get_receipts_by_worker() {
    let env = Env::default();
    let admin = Address::random(&env);
    let employer = Address::random(&env);
    let worker1 = Address::random(&env);
    let worker2 = Address::random(&env);
    let token = Address::random(&env);
    
    PayrollReceipt::init(&env, admin);
    
    // Mint receipts for worker1
    let receipt_id1 = PayrollReceipt::mint_receipt(
        &env,
        employer.clone(),
        worker1.clone(),
        token,
        1000000,
        123,
        1640995200,
        1643587200,
        ReceiptType::Completed,
    );
    
    let receipt_id2 = PayrollReceipt::mint_receipt(
        &env,
        employer.clone(),
        worker1.clone(),
        token,
        2000000,
        124,
        1640995200,
        1643587200,
        ReceiptType::Completed,
    );
    
    // Mint receipt for worker2
    let receipt_id3 = PayrollReceipt::mint_receipt(
        &env,
        employer,
        worker2,
        token,
        1500000,
        125,
        1640995200,
        1643587200,
        ReceiptType::Cancelled,
    );
    
    // Get receipts for worker1
    let worker1_receipts = PayrollReceipt::get_receipts_by_worker(&env, worker1);
    assert_eq!(worker1_receipts.len(), 2);
    assert!(worker1_receipts.contains(&receipt_id1));
    assert!(worker1_receipts.contains(&receipt_id2));
    assert!(!worker1_receipts.contains(&receipt_id3));
    
    // Get receipts for worker2
    let worker2_receipts = PayrollReceipt::get_receipts_by_worker(&env, worker2);
    assert_eq!(worker2_receipts.len(), 1);
    assert!(worker2_receipts.contains(&receipt_id3));
}

#[test]
fn test_get_receipts_by_employer() {
    let env = Env::default();
    let admin = Address::random(&env);
    let employer1 = Address::random(&env);
    let employer2 = Address::random(&env);
    let worker = Address::random(&env);
    let token = Address::random(&env);
    
    PayrollReceipt::init(&env, admin);
    
    // Mint receipts for employer1
    let receipt_id1 = PayrollReceipt::mint_receipt(
        &env,
        employer1.clone(),
        worker.clone(),
        token,
        1000000,
        123,
        1640995200,
        1643587200,
        ReceiptType::Completed,
    );
    
    let receipt_id2 = PayrollReceipt::mint_receipt(
        &env,
        employer1.clone(),
        worker.clone(),
        token,
        2000000,
        124,
        1640995200,
        1643587200,
        ReceiptType::Completed,
    );
    
    // Mint receipt for employer2
    let receipt_id3 = PayrollReceipt::mint_receipt(
        &env,
        employer2,
        worker,
        token,
        1500000,
        125,
        1640995200,
        1643587200,
        ReceiptType::Cancelled,
    );
    
    // Get receipts for employer1
    let employer1_receipts = PayrollReceipt::get_receipts_by_employer(&env, employer1);
    assert_eq!(employer1_receipts.len(), 2);
    assert!(employer1_receipts.contains(&receipt_id1));
    assert!(employer1_receipts.contains(&receipt_id2));
    assert!(!employer1_receipts.contains(&receipt_id3));
}

#[test]
fn test_get_receipt_by_stream() {
    let env = Env::default();
    let admin = Address::random(&env);
    let employer = Address::random(&env);
    let worker = Address::random(&env);
    let token = Address::random(&env);
    
    PayrollReceipt::init(&env, admin);
    
    let receipt_id = PayrollReceipt::mint_receipt(
        &env,
        employer,
        worker,
        token,
        1000000,
        123,
        1640995200,
        1643587200,
        ReceiptType::Completed,
    );
    
    // Get receipt by stream ID
    let found_receipt_id = PayrollReceipt::get_receipt_by_stream(&env, 123);
    assert_eq!(found_receipt_id, Some(receipt_id));
    
    // Test non-existent stream
    let not_found = PayrollReceipt::get_receipt_by_stream(&env, 999);
    assert_eq!(not_found, None);
}

#[test]
fn test_verify_receipt() {
    let env = Env::default();
    let admin = Address::random(&env);
    let employer = Address::random(&env);
    let worker = Address::random(&env);
    let token = Address::random(&env);
    
    PayrollReceipt::init(&env, admin);
    
    let receipt_id = PayrollReceipt::mint_receipt(
        &env,
        employer,
        worker,
        token,
        1000000,
        123,
        1640995200,
        1643587200,
        ReceiptType::Completed,
    );
    
    // Verify existing receipt
    assert!(PayrollReceipt::verify_receipt(&env, receipt_id));
    
    // Verify non-existent receipt
    assert!(!PayrollReceipt::verify_receipt(&env, 999));
}

#[test]
fn test_get_receipt_metadata() {
    let env = Env::default();
    let admin = Address::random(&env);
    let employer = Address::random(&env);
    let worker = Address::random(&env);
    let token = Address::random(&env);
    
    PayrollReceipt::init(&env, admin);
    
    let receipt_id = PayrollReceipt::mint_receipt(
        &env,
        employer.clone(),
        worker.clone(),
        token.clone(),
        1000000,
        123,
        1640995200,
        1643587200,
        ReceiptType::Completed,
    );
    
    let metadata = PayrollReceipt::get_receipt_metadata(&env, receipt_id).unwrap();
    assert_eq!(metadata.employer, employer);
    assert_eq!(metadata.worker, worker);
    assert_eq!(metadata.token, token);
    assert_eq!(metadata.total_paid, 1000000);
    assert_eq!(metadata.stream_id, 123);
    assert_eq!(metadata.receipt_type, ReceiptType::Completed);
    
    // Test non-existent receipt
    let not_found = PayrollReceipt::get_receipt_metadata(&env, 999);
    assert_eq!(not_found, None);
}
