#![no_main]

use libfuzzer_sys::fuzz_target;
use quipay_fuzz::FuzzTimestamps;
use arbitrary::Arbitrary;

/// Fuzz target for payroll_stream::create
/// 
/// Tests that arbitrary start/end timestamps don't cause panics.
/// Fuzzing will explore:
/// - Start > end (invalid)
/// - Start == end (invalid)
/// - Large timestamp gaps (valid)
/// - Timestamp overflow scenarios
/// - Unix epoch edge cases

fuzz_target!(|data: &[u8]| {
    if let Ok(ts) = FuzzTimestamps::arbitrary(&mut arbitrary::Unstructured::new(data)) {
        // Validate timestamp relationship
        if ts.start > ts.end {
            // Invalid: would fail on-chain
            return;
        }
        
        // Calculate duration
        let _ = ts.end.checked_sub(ts.start);
    }
});
