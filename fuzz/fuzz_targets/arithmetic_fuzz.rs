#![no_main]

use libfuzzer_sys::fuzz_target;
use payroll_stream::stream_curve::{compute_vested, SpeedCurve};
use arbitrary::Arbitrary;

#[derive(Arbitrary, Debug)]
struct FuzzInput {
    elapsed: u64,
    duration: u64,
    total_amount: i128,
    curve_selector: u8,
}

fuzz_target!(|input: FuzzInput| {
    let curve = match input.curve_selector % 3 {
        0 => SpeedCurve::Linear,
        1 => SpeedCurve::FrontLoaded,
        2 => SpeedCurve::BackLoaded,
        _ => unreachable!(),
    };
    
    let vested = compute_vested(input.elapsed, input.duration, input.total_amount, curve);

    // Invariants
    if input.duration == 0 || input.total_amount <= 0 {
        assert_eq!(vested, input.total_amount.max(0));
    } else if input.elapsed == 0 {
        assert_eq!(vested, 0);
    } else if input.elapsed >= input.duration {
        assert_eq!(vested, input.total_amount);
    } else {
        assert!(vested >= 0);
        assert!(vested <= input.total_amount);
    }
});
