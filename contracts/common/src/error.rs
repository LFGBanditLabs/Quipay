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
    /// `end_ts` is not strictly after `start_ts`.
    InvalidTimeRange = 1021,
    /// `cliff_ts` is outside the `[start_ts, end_ts]` range.
    InvalidCliff = 1022,
    /// `start_ts` is earlier than the current ledger close time.
    StartTimeInPast = 1023,
    /// An arithmetic operation overflowed `i128`.
    Overflow = 1024,
    /// Checked arithmetic operation failed (overflow, underflow, or division by zero).
    ArithmeticOverflow = 1048,
    /// Stream release halted due to slippage beyond tolerated basis points.
    SlippageExceeded = 1049,

    // ── Compliance ────────────────────────────────────────────────────────────
    /// The minimum retention period for funds has not elapsed.
    RetentionNotMet = 1025,
    /// The calculated protocol fee exceeds the configured cap.
    FeeTooHigh = 1026,
    /// The address has been blacklisted by the protocol admin.
    AddressBlacklisted = 1027,

    // ── Registry ─────────────────────────────────────────────────────────────
    /// Worker address is not registered in the workforce registry.
    WorkerNotFound = 1028,
    /// Batch operation exceeds the maximum allowed batch size.
    BatchTooLarge = 1029,

    // ── Admin & Governance ────────────────────────────────────────────────────
    /// `accept_admin` was called but no admin transfer is in progress.
    NoPendingAdmin = 1030,
    /// The caller is not the address that was proposed as new admin.
    NotPendingAdmin = 1031,

    // ── Multi-sig ─────────────────────────────────────────────────────────────
    /// The signer key is not in the multi-sig set.
    SignerNotFound = 1032,
    /// The key is already registered as a signer.
    AlreadySigner = 1033,
    /// Multi-sig threshold is zero or exceeds the signer count.
    InvalidThreshold = 1034,
    /// Not enough signers have approved the operation.
    InsufficientSignatures = 1035,
    /// Multi-sig operation attempted with an empty signer set.
    NoSigners = 1036,

    // ── Timelocks & Cooldowns ─────────────────────────────────────────────────
    /// Withdrawal was attempted before the cooldown period elapsed.
    WithdrawalCooldown = 1037,
    /// A grace-period timelock is still active (e.g. for upgrades or drains).
    GracePeriodActive = 1038,
    /// The same signer address appears more than once in a batch.
    DuplicateSigner = 1039,
    /// `execute_drain` was called but no drain was initiated.
    NoDrainPending = 1040,
    /// The drain timelock has not yet expired.
    DrainTimelockActive = 1041,
    /// The employer address has reached its active stream limit.
    StreamLimitReached = 1042,
    /// The stream duration is less than the configured minimum.
    DurationTooShort = 1043,

    // ── Receipts ──────────────────────────────────────────────────────────────
    /// No receipt exists for the given receipt ID.
    ReceiptNotFound = 1044,
    /// Downstream contract calls are temporarily blocked by a circuit breaker.
    CircuitOpen = 1045,

    // ── Cancellation & Governance ─────────────────────────────────────────────
    /// Cancellation attempted before the minimum notice period elapsed.
    CancellationTooEarly = 1046,
    /// Proposal execution failed due to insufficient quorum.
    QuorumNotMet = 1047,

    // ── Catch-all ─────────────────────────────────────────────────────────────
    /// A custom error condition not covered by the above codes.
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
