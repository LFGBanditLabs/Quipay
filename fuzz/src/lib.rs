//! Fuzz targets for Quipay smart contracts
//!
//! This crate contains fuzz targets for testing:
//! - payroll_vault::deposit with arbitrary i128 amounts
//! - payroll_stream::create with arbitrary timestamps
//! - payroll_stream::claim with arbitrary vesting percentages

use arbitrary::Arbitrary;

/// Arbitrary deposit amount for vault fuzzing
#[derive(Arbitrary, Clone, Copy, Debug)]
pub struct FuzzAmount {
    /// i128 amount value (may be negative, overflow, etc.)
    pub amount: i128,
}

/// Arbitrary timestamps for stream fuzzing
#[derive(Arbitrary, Clone, Copy, Debug)]
pub struct FuzzTimestamps {
    /// Start timestamp (unix epoch seconds)
    pub start: u64,
    /// End timestamp (unix epoch seconds)
    pub end: u64,
}

/// Arbitrary claim parameters
#[derive(Arbitrary, Clone, Copy, Debug)]
pub struct FuzzClaimParams {
    /// Vesting percentage (0-100, but may exceed)
    pub percentage: u32,
    /// Stream ID
    pub stream_id: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fuzz_amount_bounds() {
        let amount = FuzzAmount { amount: i128::MAX };
        assert_eq!(amount.amount, i128::MAX);

        let amount = FuzzAmount { amount: i128::MIN };
        assert_eq!(amount.amount, i128::MIN);

        let amount = FuzzAmount { amount: 0 };
        assert_eq!(amount.amount, 0);
    }

    #[test]
    fn test_fuzz_timestamps() {
        let ts = FuzzTimestamps { start: 0, end: u64::MAX };
        assert_eq!(ts.start, 0);
        assert_eq!(ts.end, u64::MAX);
    }
}
