use soroban_sdk::contracterror;

/// Result type alias for Quipay contracts
pub type QuipayResult<T> = Result<T, QuipayError>;

/// Comprehensive error enum for Quipay contracts
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum QuipayError {
    AlreadyInitialized = 1001,
    NotInitialized = 1002,
    Unauthorized = 1003,
    InsufficientPermissions = 1004,
    InvalidAmount = 1005,
    InsufficientBalance = 1006,
    ProtocolPaused = 1007,
    VersionNotSet = 1008,
    StorageError = 1009,
    InvalidAddress = 1010,
    StreamNotFound = 1011,
    StreamExpired = 1012,
    AgentNotFound = 1013,
    InvalidToken = 1014,
    TransferFailed = 1015,
    UpgradeFailed = 1016,
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

    #[test]
    fn test_error_conversion() {
        let error = QuipayError::InsufficientBalance;
        let code: u32 = error as u32;
        assert_eq!(code, 1006);

        let soroban_error: SorobanError = error.into();
        assert_eq!(soroban_error, SorobanError::from_contract_error(1006));
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
