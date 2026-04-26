use soroban_sdk::contracterror;

/// Result type alias for Quipay contracts
pub type QuipayResult<T> = Result<T, QuipayError>;

/// Comprehensive error enum for Quipay contracts.
///
/// All variants are stable `u32` identifiers that are part of the on-chain ABI.
/// Once a code is deployed it must not change. New variants must use the next
/// available number.
///
/// See `docs/error-codes.md` for the full table with recovery guidance.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum QuipayError {
    // ── Initialisation ────────────────────────────────────────────────────────
    /// `initialize()` was called on a contract that is already initialised.
    AlreadyInitialized = 1001,
    /// An operation was attempted before `initialize()` was called.
    NotInitialized = 1002,

    // ── Authorization ─────────────────────────────────────────────────────────
    /// The transaction signer did not pass `require_auth` for the required account.
    Unauthorized = 1003,
    /// The caller is authenticated but does not have the required role (e.g. not an admin).
    InsufficientPermissions = 1004,

    // ── Funds & Balances ──────────────────────────────────────────────────────
    /// Amount was zero or negative; all amounts must be strictly positive.
    InvalidAmount = 1005,
    /// Requested amount exceeds available funds in the vault.
    InsufficientBalance = 1006,

    // ── Protocol State ────────────────────────────────────────────────────────
    /// The protocol is paused by an admin; no state-changing operations are allowed.
    ProtocolPaused = 1007,
    /// The contract version storage entry is missing; the contract needs to be (re-)deployed.
    VersionNotSet = 1008,
    /// A Soroban storage read or write failed unexpectedly.
    StorageError = 1009,

    // ── Input Validation ──────────────────────────────────────────────────────
    /// A provided address is not a valid Stellar account or contract ID.
    InvalidAddress = 1010,
    /// No stream exists for the given stream ID.
    StreamNotFound = 1011,
    /// The stream's end time has passed and it can no longer be modified.
    StreamExpired = 1012,
    /// The automation agent address is not registered in the gateway.
    AgentNotFound = 1013,
    /// The token address is not recognised or not allowlisted.
    InvalidToken = 1014,

    // ── Operations ────────────────────────────────────────────────────────────
    /// An underlying Stellar asset transfer failed.
    TransferFailed = 1015,
    /// A WASM upgrade invocation failed.
    UpgradeFailed = 1016,
    /// The caller is not the designated worker for this stream.
    NotWorker = 1017,
    /// The stream was already cancelled or completed.
    StreamClosed = 1018,
    /// The caller is not the employer who created this stream.
    NotEmployer = 1019,
    /// An operation requires the stream to be closed, but it is still active.
    StreamNotClosed = 1020,
    WithdrawalNotFound = 1021,
    AlreadyApproved = 1022,
    NotGuardian = 1023,
    LargeWithdrawalRequiresApproval = 1024,
    WithdrawalCooldownActive = 1025,
    Custom = 1999,
}

/// Macro for requiring a condition to be true, returning an error if false
#[macro_export]
macro_rules! require {
    ($condition:expr, $error:expr) => {
        if !$condition {
            return Err($error);
        }
    };
}

/// Macro for validating positive amounts
#[macro_export]
macro_rules! require_positive_amount {
    ($amount:expr) => {
        if $amount <= 0 {
            return Err(QuipayError::InvalidAmount);
        }
    };
}

/// Helper functions for common operations
pub struct QuipayHelpers;

impl QuipayHelpers {
    /// Validate amount is positive
    pub fn validate_positive_amount(amount: i128) -> QuipayResult<()> {
        if amount <= 0 {
            return Err(QuipayError::InvalidAmount);
        }
        Ok(())
    }

    /// Check sufficient balance
    pub fn check_sufficient_balance(current: i128, required: i128) -> QuipayResult<()> {
        if required > current {
            return Err(QuipayError::InsufficientBalance);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Error;

    #[test]
    fn test_error_conversion() {
        let error = QuipayError::InsufficientBalance;
        let code: u32 = error as u32;
        assert_eq!(code, 1006);

        let soroban_error: Error = error.into();
        assert_eq!(soroban_error, Error::from_contract_error(1006));
    }

    #[test]
    fn test_helper_functions() {
        assert!(QuipayHelpers::validate_positive_amount(100).is_ok());
        assert!(QuipayHelpers::validate_positive_amount(0).is_err());
        assert!(QuipayHelpers::validate_positive_amount(-1).is_err());

        assert!(QuipayHelpers::check_sufficient_balance(100, 50).is_ok());
        assert!(QuipayHelpers::check_sufficient_balance(50, 100).is_err());
    }
}
