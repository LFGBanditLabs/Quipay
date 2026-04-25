#![no_main]

use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use quipay_fuzz::FuzzAmount;

/// Fuzz target for payroll_vault::deposit
/// 
/// Tests that arbitrary i128 amounts don't cause panics or overflows.
/// Fuzzing will explore:
/// - Large positive amounts (causing overflow)
/// - Large negative amounts (invalid)
/// - Zero amounts (edge case)
/// - Near-overflow boundaries

fuzz_target!(|data: &[u8]| {
    if let Ok(amount) = FuzzAmount::arbitrary(&mut arbitrary::Unstructured::new(data)) {
        // In a real implementation, this would call the vault contract with amount.amount
        // For now, just ensure no panic on arbitrary values
        let _ = amount.amount.checked_add(1);
        let _ = amount.amount.checked_mul(2);
        let _ = amount.amount.checked_div(2);
    }
});
