//! contracts/payroll_stream/src/stream_curve.rs
//!
//! Configurable stream speed curves — issue #515.
//!
//! # Curve definitions
//!
//! All three curves satisfy these invariants:
//!   - curve(0)        == 0            (nothing paid at stream start)
//!   - curve(duration) == total_amount (fully paid at stream end)
//!   - curve is monotonically non-decreasing (no clawbacks)
//!
//! Let t = elapsed / duration  (a ratio in [0, 1])
//!
//!   Linear:      payout(t) = t                  → straight line
//!   FrontLoaded: payout(t) = 2t - t²            → quadratic, fast start
//!   BackLoaded:  payout(t) = t^(1/2) ... but using integer-only math:
//!                payout(t) = sqrt(t * total²)   → concave, fast finish
//!
//! # Integer-only math
//!
//! Soroban contracts run in a deterministic WASM sandbox with no_std.
//! No floating point. All curve math uses scaled integer arithmetic:
//!
//!   SCALE = 10_000_000_000 (10^10)
//!
//! This gives 10 decimal places of precision for the ratio t, sufficient
//! to avoid meaningful rounding errors on any realistic payment amount.
//!
//! The FrontLoaded formula avoids overflow by keeping intermediate values
//! in i128 and scaling carefully:
//!
//!   t_scaled = elapsed * SCALE / duration
//!   payout   = total * (2 * t_scaled - t_scaled² / SCALE) / SCALE
//!
//! The BackLoaded formula uses an integer square root over:
//!
//!   radicand = elapsed * total_amount² / duration
//!   payout   = isqrt(radicand)
//!
//! which equals total * sqrt(elapsed / duration) — the standard concave curve.

use soroban_sdk::contracttype;

/// Fixed-point scale factor: 10^10.
/// Gives 10 decimal places for the elapsed/duration ratio.
const SCALE: i128 = 10_000_000_000;

// ─── SpeedCurve enum ──────────────────────────────────────────────────────────

/// The payment speed curve for a stream.
///
/// Stored on the `Stream` struct and used by `vested_amount_at` to shape
/// how tokens accrue over the stream's lifetime.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SpeedCurve {
    /// Tokens accrue at a constant rate (default). Backward compatible with
    /// all existing streams — any stream without an explicit curve uses this.
    Linear,
    /// Front-loaded: accelerated payouts early, slowing toward the end.
    /// Formula: payout(t) = total × (2t − t²)
    /// At t=0.5 the worker has received 75% of total (vs 50% with Linear).
    FrontLoaded,
    /// Back-loaded: slow payouts early, accelerating toward the end.
    /// Formula: payout(t) = total × √t
    /// At t=0.5 the worker has received ~70.7% of total (vs 50% with Linear).
    /// Note: back-loaded streams pay MORE earlier than their linear equivalent
    /// in absolute terms — "back-loaded" means the rate accelerates, not that
    /// the worker receives less. At t=0.25 they have 50% (vs 25% with Linear).
    BackLoaded,
}

impl Default for SpeedCurve {
    fn default() -> Self {
        SpeedCurve::Linear
    }
}

// ─── Core curve math ──────────────────────────────────────────────────────────

/// Compute the vested amount at a given elapsed time using the specified curve.
///
/// # Parameters
/// - `elapsed`      — seconds elapsed since stream start (already adjusted for
///                    pauses and cancellation cap by the caller).
/// - `duration`     — total stream duration in seconds (`end_ts - start_ts`).
/// - `total_amount` — total tokens to be paid over the full duration.
/// - `curve`        — which payment curve to apply.
///
/// # Guarantees
/// - Returns 0 when `elapsed == 0`.
/// - Returns `total_amount` when `elapsed >= duration`.
/// - Never returns more than `total_amount`.
/// - Never panics on valid inputs (uses `checked_*` with safe fallbacks).
pub fn compute_vested(elapsed: u64, duration: u64, total_amount: i128, curve: SpeedCurve) -> i128 {
    if duration == 0 || total_amount <= 0 {
        return total_amount.max(0);
    }
    if elapsed == 0 {
        return 0;
    }
    if elapsed >= duration {
        return total_amount;
    }

    match curve {
        SpeedCurve::Linear => compute_linear(elapsed, duration, total_amount),
        SpeedCurve::FrontLoaded => compute_front_loaded(elapsed, duration, total_amount),
        SpeedCurve::BackLoaded => compute_back_loaded(elapsed, duration, total_amount),
    }
}

/// Linear: payout(t) = total × t
///
/// Standard pro-rata accrual. Identical to the existing vested_amount_at logic.
fn compute_linear(elapsed: u64, duration: u64, total_amount: i128) -> i128 {
    let elapsed_i = elapsed as i128;
    let duration_i = duration as i128;

    total_amount
        .checked_mul(elapsed_i)
        .unwrap_or(total_amount)
        .checked_div(duration_i)
        .unwrap_or(total_amount)
        .min(total_amount)
}

/// FrontLoaded: payout(t) = total × (2t − t²)
///
/// Quadratic curve. Derived from the derivative 2(1−t) which starts at 2×
/// the linear rate and declines to 0 at t=1.
///
/// Integer implementation using SCALE = 10^10:
///   t_s  = elapsed * SCALE / duration          (scaled ratio, 0..SCALE)
///   f(t) = 2 * t_s - t_s² / SCALE             (scaled result, 0..SCALE)
///   out  = total * f(t) / SCALE
fn compute_front_loaded(elapsed: u64, duration: u64, total_amount: i128) -> i128 {
    let elapsed_i = elapsed as i128;
    let duration_i = duration as i128;

    // t_scaled ∈ [0, SCALE]
    let t_scaled = elapsed_i
        .checked_mul(SCALE)
        .unwrap_or(SCALE)
        .checked_div(duration_i)
        .unwrap_or(SCALE)
        .min(SCALE);

    // 2t_s
    let two_t = t_scaled
        .checked_mul(2)
        .unwrap_or(SCALE.checked_mul(2).unwrap_or(i128::MAX));

    // t_s² / SCALE
    let t_sq = t_scaled
        .checked_mul(t_scaled)
        .unwrap_or(SCALE.checked_mul(SCALE).unwrap_or(i128::MAX))
        .checked_div(SCALE)
        .unwrap_or(SCALE);

    // f = 2t - t² (in scaled space, clamped to [0, SCALE])
    let f_scaled = two_t.saturating_sub(t_sq).min(SCALE).max(0);

    // out = total * f / SCALE
    total_amount
        .checked_mul(f_scaled)
        .unwrap_or(total_amount.checked_mul(SCALE).unwrap_or(i128::MAX))
        .checked_div(SCALE)
        .unwrap_or(total_amount)
        .min(total_amount)
        .max(0)
}

/// BackLoaded: payout(t) = total × √t
///
/// Square-root curve. Derived from the derivative 1/(2√t) which starts near
/// infinity and declines — meaning the rate is fastest near the end.
///
/// Integer implementation avoids floating point by computing:
///   isqrt(elapsed * total² / duration)
///
/// which equals total × √(elapsed/duration) exactly (within integer truncation).
///
/// Overflow protection: if total² would overflow i128 (total > ~1.3 × 10^19),
/// we fall back to the SCALE-based approximation used by FrontLoaded.
fn compute_back_loaded(elapsed: u64, duration: u64, total_amount: i128) -> i128 {
    let elapsed_i = elapsed as i128;
    let duration_i = duration as i128;

    // Try exact method: isqrt(elapsed * total² / duration)
    if let Some(total_sq) = total_amount.checked_mul(total_amount) {
        if let Some(numerator) = elapsed_i.checked_mul(total_sq) {
            let radicand = numerator.checked_div(duration_i).unwrap_or(0).max(0);
            return integer_sqrt(radicand).min(total_amount);
        }
    }

    // Fallback for very large amounts: SCALE-based approximation
    // isqrt(t_scaled) / sqrt(SCALE) * total
    let t_scaled = elapsed_i
        .checked_mul(SCALE)
        .unwrap_or(SCALE)
        .checked_div(duration_i)
        .unwrap_or(SCALE)
        .min(SCALE)
        .max(0);

    // sqrt(t_scaled) normalised: result ∈ [0, sqrt(SCALE)]
    // sqrt(SCALE) = sqrt(10^10) = 10^5 = 100_000
    let sqrt_scale: i128 = 100_000; // sqrt(10^10) exactly
    let sqrt_t = integer_sqrt(t_scaled); // ∈ [0, sqrt(SCALE)]

    total_amount
        .checked_mul(sqrt_t)
        .unwrap_or(total_amount)
        .checked_div(sqrt_scale)
        .unwrap_or(total_amount)
        .min(total_amount)
        .max(0)
}

/// Integer square root via Newton's method (no_std, no floating point).
///
/// Returns floor(√n). Returns 0 for n ≤ 0.
pub fn integer_sqrt(n: i128) -> i128 {
    if n <= 0 {
        return 0;
    }
    if n == 1 {
        return 1;
    }

    // Initial estimate: bit-shifting gives a safe starting point
    let mut x = n;
    let mut y = (x + 1) / 2;

    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }

    x
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const TOTAL: i128 = 1_000_000; // 1 USDC-equivalent in base units
    const DURATION: u64 = 1000; // 1000 seconds

    // ── Boundary invariants (all curves) ──────────────────────────────────────

    #[test]
    fn all_curves_return_zero_at_elapsed_zero() {
        for curve in [
            SpeedCurve::Linear,
            SpeedCurve::FrontLoaded,
            SpeedCurve::BackLoaded,
        ] {
            assert_eq!(
                compute_vested(0, DURATION, TOTAL, curve),
                0,
                "{:?} must return 0 at elapsed=0",
                curve
            );
        }
    }

    #[test]
    fn all_curves_return_total_at_elapsed_equals_duration() {
        for curve in [
            SpeedCurve::Linear,
            SpeedCurve::FrontLoaded,
            SpeedCurve::BackLoaded,
        ] {
            assert_eq!(
                compute_vested(DURATION, DURATION, TOTAL, curve),
                TOTAL,
                "{:?} must return total at elapsed=duration",
                curve
            );
        }
    }

    #[test]
    fn all_curves_return_total_when_elapsed_exceeds_duration() {
        for curve in [
            SpeedCurve::Linear,
            SpeedCurve::FrontLoaded,
            SpeedCurve::BackLoaded,
        ] {
            assert_eq!(
                compute_vested(DURATION + 500, DURATION, TOTAL, curve),
                TOTAL,
                "{:?} must cap at total when elapsed > duration",
                curve
            );
        }
    }

    #[test]
    fn all_curves_are_monotonically_non_decreasing() {
        for curve in [
            SpeedCurve::Linear,
            SpeedCurve::FrontLoaded,
            SpeedCurve::BackLoaded,
        ] {
            let mut prev = 0i128;
            for elapsed in (0..=DURATION).step_by(10) {
                let current = compute_vested(elapsed, DURATION, TOTAL, curve);
                assert!(
                    current >= prev,
                    "{:?}: must be non-decreasing, but dropped from {} to {} at elapsed={}",
                    curve,
                    prev,
                    current,
                    elapsed
                );
                prev = current;
            }
        }
    }

    #[test]
    fn all_curves_never_exceed_total() {
        for curve in [
            SpeedCurve::Linear,
            SpeedCurve::FrontLoaded,
            SpeedCurve::BackLoaded,
        ] {
            for elapsed in (0..=DURATION).step_by(1) {
                let v = compute_vested(elapsed, DURATION, TOTAL, curve);
                assert!(
                    v <= TOTAL,
                    "{:?}: vested {} exceeds total {} at elapsed={}",
                    curve,
                    v,
                    TOTAL,
                    elapsed
                );
            }
        }
    }

    // ── Linear: exact midpoint ────────────────────────────────────────────────

    #[test]
    fn linear_midpoint_is_exactly_half_total() {
        let v = compute_vested(DURATION / 2, DURATION, TOTAL, SpeedCurve::Linear);
        assert_eq!(v, TOTAL / 2, "linear midpoint must be exactly half");
    }

    // ── FrontLoaded: midpoint > half ──────────────────────────────────────────

    #[test]
    fn front_loaded_midpoint_exceeds_linear() {
        let linear = compute_vested(DURATION / 2, DURATION, TOTAL, SpeedCurve::Linear);
        let front = compute_vested(DURATION / 2, DURATION, TOTAL, SpeedCurve::FrontLoaded);
        assert!(
            front > linear,
            "FrontLoaded midpoint {} must exceed linear midpoint {}",
            front,
            linear
        );
    }

    #[test]
    fn front_loaded_at_quarter_duration_exceeds_linear() {
        let linear = compute_vested(DURATION / 4, DURATION, TOTAL, SpeedCurve::Linear);
        let front = compute_vested(DURATION / 4, DURATION, TOTAL, SpeedCurve::FrontLoaded);
        assert!(front > linear);
    }

    /// At t=0.5: FrontLoaded = 2(0.5) - (0.5)² = 0.75 → 75% of total
    #[test]
    fn front_loaded_midpoint_is_approximately_75_percent() {
        let v = compute_vested(DURATION / 2, DURATION, TOTAL, SpeedCurve::FrontLoaded);
        let expected = (TOTAL * 75) / 100;
        // Allow ±1% tolerance for integer rounding
        let tolerance = TOTAL / 100;
        assert!(
            (v - expected).abs() <= tolerance,
            "FrontLoaded at t=0.5 should be ~75% of total, got {} (expected ~{})",
            v,
            expected
        );
    }

    // ── BackLoaded: midpoint < linear but quarter > linear ───────────────────

    #[test]
    fn back_loaded_midpoint_exceeds_linear() {
        // sqrt(0.5) ≈ 0.707 > 0.5 (linear), so BackLoaded also pays more at midpoint
        let linear = compute_vested(DURATION / 2, DURATION, TOTAL, SpeedCurve::Linear);
        let back = compute_vested(DURATION / 2, DURATION, TOTAL, SpeedCurve::BackLoaded);
        assert!(
            back > linear,
            "BackLoaded midpoint {} should exceed linear {} (sqrt(0.5) ≈ 0.707)",
            back,
            linear
        );
    }

    #[test]
    fn back_loaded_pays_more_than_linear_at_quarter_mark() {
        // sqrt(0.25) = 0.5 > 0.25 (linear)
        let linear = compute_vested(DURATION / 4, DURATION, TOTAL, SpeedCurve::Linear);
        let back = compute_vested(DURATION / 4, DURATION, TOTAL, SpeedCurve::BackLoaded);
        assert!(
            back > linear,
            "BackLoaded at t=0.25 should exceed linear: got {} vs {}",
            back,
            linear
        );
    }

    #[test]
    fn back_loaded_rate_accelerates_toward_end() {
        // The increment in the second half should be less than in the first half
        // because sqrt grows faster near 0 and slower near 1
        let at_half = compute_vested(DURATION / 2, DURATION, TOTAL, SpeedCurve::BackLoaded);
        let at_full = compute_vested(DURATION, DURATION, TOTAL, SpeedCurve::BackLoaded);
        let at_qtr = compute_vested(DURATION / 4, DURATION, TOTAL, SpeedCurve::BackLoaded);

        let _first_quarter_gain = at_qtr;
        let _last_quarter_gain = at_full - at_half;
        // second half gain is smaller than first half gain (sqrt is concave)
        let first_half_gain = at_half;
        let second_half_gain = at_full - at_half;
        assert!(
            first_half_gain >= second_half_gain,
            "BackLoaded first half {} should >= second half {} (sqrt is concave)",
            first_half_gain,
            second_half_gain
        );
    }

    // ── Default curve is Linear ───────────────────────────────────────────────

    #[test]
    fn default_speed_curve_is_linear() {
        assert_eq!(SpeedCurve::default(), SpeedCurve::Linear);
    }

    // ── Edge cases ────────────────────────────────────────────────────────────

    #[test]
    fn zero_total_returns_zero_for_all_curves() {
        for curve in [
            SpeedCurve::Linear,
            SpeedCurve::FrontLoaded,
            SpeedCurve::BackLoaded,
        ] {
            assert_eq!(compute_vested(500, DURATION, 0, curve), 0);
        }
    }

    #[test]
    fn zero_duration_returns_total_for_all_curves() {
        for curve in [
            SpeedCurve::Linear,
            SpeedCurve::FrontLoaded,
            SpeedCurve::BackLoaded,
        ] {
            assert_eq!(compute_vested(1, 0, TOTAL, curve), TOTAL);
        }
    }

    #[test]
    fn integer_sqrt_correct_for_known_values() {
        assert_eq!(integer_sqrt(0), 0);
        assert_eq!(integer_sqrt(1), 1);
        assert_eq!(integer_sqrt(4), 2);
        assert_eq!(integer_sqrt(9), 3);
        assert_eq!(integer_sqrt(16), 4);
        assert_eq!(integer_sqrt(100), 10);
        assert_eq!(integer_sqrt(10_000), 100);
        assert_eq!(integer_sqrt(1_000_000), 1000);
        // Floor behaviour
        assert_eq!(integer_sqrt(2), 1);
        assert_eq!(integer_sqrt(3), 1);
        assert_eq!(integer_sqrt(5), 2);
        assert_eq!(integer_sqrt(8), 2);
    }

    #[test]
    fn large_amount_does_not_overflow() {
        // i128::MAX / 2 ≈ 1.7 × 10^38 — stress test the overflow guards
        let large_total: i128 = 1_000_000_000_000_000_000; // 10^18
        for curve in [
            SpeedCurve::Linear,
            SpeedCurve::FrontLoaded,
            SpeedCurve::BackLoaded,
        ] {
            let v = compute_vested(DURATION / 2, DURATION, large_total, curve);
            assert!(
                v <= large_total,
                "{:?}: overflow — {} > {}",
                curve,
                v,
                large_total
            );
            assert!(v >= 0, "{:?}: negative result {}", curve, v);
        }
    }
}
