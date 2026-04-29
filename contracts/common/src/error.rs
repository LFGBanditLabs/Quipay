use soroban_sdk::{Error, InvokeError, xdr};

/// Result type alias for Quipay contracts
pub type QuipayResult<T> = Result<T, QuipayError>;

/// Comprehensive error enum for Quipay contracts.
///
/// All variants are stable `u32` identifiers that are part of the on-chain ABI.
/// Once a code is deployed it must not change. New variants must use the next
/// available number.
///
/// See `docs/error-codes.md` for the full table with recovery guidance.
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
    /// The stream is still active and cannot be closed yet.
    StreamNotClosed = 1054,
    /// The caller is not the employer who created this stream.
    NotEmployer = 1019,
    /// An operation was attempted on a non-existent withdrawal request.
    WithdrawalNotFound = 1021,
    AlreadyApproved = 1022,
    NotGuardian = 1023,
    LargeWithdrawalRequiresApproval = 1024,
    WithdrawalCooldownActive = 1025,
    /// An arithmetic overflow or underflow occurred during a contract operation.
    ArithmeticOverflow = 1026,
    AddressBlacklisted = 1027,
    AlreadyBurned = 1028,
    AlreadySigner = 1029,
    BatchTooLarge = 1030,
    CancellationTooEarly = 1031,
    DrainTimelockActive = 1032,
    DuplicateSigner = 1033,
    DurationTooShort = 1034,
    FeeTooHigh = 1035,
    GracePeriodActive = 1036,
    InsufficientSignatures = 1037,
    InvalidCliff = 1038,
    InvalidThreshold = 1039,
    InvalidTimeRange = 1040,
    NoDrainPending = 1041,
    NoPendingAdmin = 1042,
    NoSigners = 1043,
    Overflow = 1044,
    QuorumNotMet = 1045,
    ReceiptNotFound = 1046,
    RetentionNotMet = 1047,
    SignerNotFound = 1048,
    StartTimeInPast = 1049,
    StreamLimitReached = 1050,
    StreamNotActive = 1051,
    WithdrawalCooldown = 1052,
    WorkerNotFound = 1053,
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

impl From<QuipayError> for Error {
    #[inline(always)]
    fn from(error: QuipayError) -> Error {
        (&error).into()
    }
}

impl From<&QuipayError> for Error {
    #[inline(always)]
    fn from(error: &QuipayError) -> Error {
        Error::from_contract_error(*error as u32)
    }
}

impl From<QuipayError> for InvokeError {
    #[inline(always)]
    fn from(error: QuipayError) -> InvokeError {
        (&error).into()
    }
}

impl From<&QuipayError> for InvokeError {
    #[inline(always)]
    fn from(error: &QuipayError) -> InvokeError {
        InvokeError::Contract(*error as u32)
    }
}

impl TryFrom<Error> for QuipayError {
    type Error = Error;

    #[inline(always)]
    fn try_from(error: Error) -> Result<Self, Error> {
        if error.is_type(xdr::ScErrorType::Contract) {
            match error.get_code() {
                1001 => Ok(QuipayError::AlreadyInitialized),
                1002 => Ok(QuipayError::NotInitialized),
                1003 => Ok(QuipayError::Unauthorized),
                1004 => Ok(QuipayError::InsufficientPermissions),
                1005 => Ok(QuipayError::InvalidAmount),
                1006 => Ok(QuipayError::InsufficientBalance),
                1007 => Ok(QuipayError::ProtocolPaused),
                1008 => Ok(QuipayError::VersionNotSet),
                1009 => Ok(QuipayError::StorageError),
                1010 => Ok(QuipayError::InvalidAddress),
                1011 => Ok(QuipayError::StreamNotFound),
                1012 => Ok(QuipayError::StreamExpired),
                1013 => Ok(QuipayError::AgentNotFound),
                1014 => Ok(QuipayError::InvalidToken),
                1015 => Ok(QuipayError::TransferFailed),
                1016 => Ok(QuipayError::UpgradeFailed),
                1017 => Ok(QuipayError::NotWorker),
                1018 => Ok(QuipayError::StreamClosed),
                1019 => Ok(QuipayError::NotEmployer),
                1054 => Ok(QuipayError::StreamNotClosed),
                1021 => Ok(QuipayError::WithdrawalNotFound),
                1022 => Ok(QuipayError::AlreadyApproved),
                1023 => Ok(QuipayError::NotGuardian),
                1024 => Ok(QuipayError::LargeWithdrawalRequiresApproval),
                1025 => Ok(QuipayError::WithdrawalCooldownActive),
                1026 => Ok(QuipayError::ArithmeticOverflow),
                1027 => Ok(QuipayError::AddressBlacklisted),
                1028 => Ok(QuipayError::AlreadyBurned),
                1029 => Ok(QuipayError::AlreadySigner),
                1030 => Ok(QuipayError::BatchTooLarge),
                1031 => Ok(QuipayError::CancellationTooEarly),
                1032 => Ok(QuipayError::DrainTimelockActive),
                1033 => Ok(QuipayError::DuplicateSigner),
                1034 => Ok(QuipayError::DurationTooShort),
                1035 => Ok(QuipayError::FeeTooHigh),
                1036 => Ok(QuipayError::GracePeriodActive),
                1037 => Ok(QuipayError::InsufficientSignatures),
                1038 => Ok(QuipayError::InvalidCliff),
                1039 => Ok(QuipayError::InvalidThreshold),
                1040 => Ok(QuipayError::InvalidTimeRange),
                1041 => Ok(QuipayError::NoDrainPending),
                1042 => Ok(QuipayError::NoPendingAdmin),
                1043 => Ok(QuipayError::NoSigners),
                1044 => Ok(QuipayError::Overflow),
                1045 => Ok(QuipayError::QuorumNotMet),
                1046 => Ok(QuipayError::ReceiptNotFound),
                1047 => Ok(QuipayError::RetentionNotMet),
                1048 => Ok(QuipayError::SignerNotFound),
                1049 => Ok(QuipayError::StartTimeInPast),
                1050 => Ok(QuipayError::StreamLimitReached),
                1051 => Ok(QuipayError::StreamNotActive),
                1052 => Ok(QuipayError::WithdrawalCooldown),
                1053 => Ok(QuipayError::WorkerNotFound),
                1999 => Ok(QuipayError::Custom),
                _ => Err(error),
            }
        } else {
            Err(error)
        }
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
