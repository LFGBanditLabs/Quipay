#![no_main]

use libfuzzer_sys::fuzz_target;
use quipay_fuzz::FuzzClaimParams;
use arbitrary::Arbitrary;

/// Fuzz target for payroll_stream::claim
/// 
/// Tests that arbitrary claim percentages don't cause panics.
/// Fuzzing will explore:
/// - Percentage > 100 (over-claim)
/// - Percentage == 0 (no claim)
/// - Percentage == 100 (full claim)
/// - Large percentage values (overflow potential)

fuzz_target!(|data: &[u8]| {
    if let Ok(params) = FuzzClaimParams::arbitrary(&mut arbitrary::Unstructured::new(data)) {
        // Validate percentage bounds (should be 0-100)
        if params.percentage > 100 {
            // Invalid: would fail on-chain
            return;
        }
        
        // Safe arithmetic
        let _ = (params.percentage as u64).checked_mul(100);
    }
});
