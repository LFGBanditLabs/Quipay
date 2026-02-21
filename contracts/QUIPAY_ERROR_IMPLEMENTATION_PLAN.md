# QuipayError Implementation Plan

## Overview

This document outlines the implementation plan for replacing generic panics and asserts with a robust custom error enum across all Quipay smart contracts. This will provide off-chain clients (frontend and AI agent) with machine-readable error codes to handle failures gracefully.

## Current State Analysis

### Existing Error Patterns

After analyzing the three contracts, I identified the following error patterns:

#### Automation Gateway Contract

- `panic!("Already initialized")` - Line 35
- `panic!("Agent not authorized for this action")` - Line 80
- `.expect("Not initialized")` - Lines 43, 58, 88

#### Payroll Stream Contract

- `panic!("already initialized")` - Line 19
- `panic!("protocol is paused")` - Line 62
- `.expect("not initialized")` - Line 28

#### Payroll Vault Contract

- `panic!("already initialized")` - Line 43
- `panic!("deposit amount must be positive")` - Line 115
- `panic!("payout amount must be positive")` - Line 131
- `panic!("insufficient treasury balance")` - Line 140
- `.expect("not initialized")` - Lines 67, 96, 101, 106, 127
- `.expect("version not set")` - Line 71

### Error Categories Identified

1. **Initialization Errors**: Already initialized, not initialized
2. **Authorization Errors**: Unauthorized access, insufficient permissions
3. **Validation Errors**: Invalid amounts, invalid parameters
4. **State Errors**: Protocol paused, insufficient balance
5. **System Errors**: Version not set, storage errors

## Implementation Strategy

### Phase 1: Create Shared Error Infrastructure

#### 1.1 Create Common Contracts Directory Structure

```
contracts/
├── common/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       └── error.rs
├── automation_gateway/
├── payroll_stream/
└── payroll_vault/
```

#### 1.2 Define QuipayError Enum

The error enum will include:

- `AlreadyInitialized` - Contract already initialized
- `NotInitialized` - Contract not initialized
- `Unauthorized` - Caller not authorized
- `InsufficientPermissions` - Agent lacks specific permission
- `InvalidAmount` - Amount must be positive
- `InsufficientBalance` - Insufficient treasury balance
- `ProtocolPaused` - Protocol is currently paused
- `VersionNotSet` - Version information not available
- `StorageError` - General storage operation failure
- `InvalidAddress` - Invalid address provided
- `StreamNotFound` - Payroll stream does not exist
- `StreamExpired` - Payroll stream has expired
- `Custom(String)` - For custom error messages

#### 1.3 Error Code Mapping

Each error variant will have a corresponding error code for frontend consumption:

```rust
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum QuipayErrorCode {
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
    Custom = 1999,
}
```

### Phase 2: Contract Updates

#### 2.1 Automation Gateway Contract Updates

- Update `init()` to return `Result<(), QuipayError>`
- Update `register_agent()` to return `Result<(), QuipayError>`
- Update `revoke_agent()` to return `Result<(), QuipayError>`
- Update `execute_automation()` to return `Result<(), QuipayError>`
- Update `get_admin()` to return `Result<Address, QuipayError>`

#### 2.2 Payroll Stream Contract Updates

- Update `init()` to return `Result<(), QuipayError>`
- Update `set_paused()` to return `Result<(), QuipayError>`
- Update `create_stream()` to return `Result<(), QuipayError>`
- Update `withdraw()` to return `Result<(), QuipayError>`
- Update `cancel_stream()` to return `Result<(), QuipayError>`
- Update `require_not_paused()` to return `Result<(), QuipayError>`

#### 2.3 Payroll Vault Contract Updates

- Update `initialize()` to return `Result<(), QuipayError>`
- Update `upgrade()` to return `Result<(), QuipayError>`
- Update `get_version()` to return `Result<VersionInfo, QuipayError>`
- Update `get_admin()` to return `Result<Address, QuipayError>`
- Update `transfer_admin()` to return `Result<(), QuipayError>`
- Update `deposit()` to return `Result<(), QuipayError>`
- Update `payout()` to return `Result<(), QuipayError>`

### Phase 3: Testing Strategy

#### 3.1 Unit Test Updates

- Update existing `#[should_panic]` tests to verify `Result::Err` variants
- Add new tests for each error variant
- Test error code extraction and frontend compatibility

#### 3.2 Integration Tests

- Create tests that simulate frontend error handling
- Verify error codes are machine-readable
- Test error propagation across contract calls

### Phase 4: Frontend Integration

#### 4.1 Error Code Mapping

Create a frontend error mapping utility:

```typescript
export const QUIPAY_ERROR_CODES = {
  ALREADY_INITIALIZED: 1001,
  NOT_INITIALIZED: 1002,
  UNAUTHORIZED: 1003,
  INSUFFICIENT_PERMISSIONS: 1004,
  INVALID_AMOUNT: 1005,
  INSUFFICIENT_BALANCE: 1006,
  PROTOCOL_PAUSED: 1007,
  VERSION_NOT_SET: 1008,
  STORAGE_ERROR: 1009,
  INVALID_ADDRESS: 1010,
  STREAM_NOT_FOUND: 1011,
  STREAM_EXPIRED: 1012,
  CUSTOM: 1999,
} as const;
```

#### 4.2 Error Handling Components

- Update `ErrorResponse.tsx` to handle QuipayError codes
- Create user-friendly error messages for each error code
- Implement retry logic where appropriate

## Implementation Details

### Error Conversion Traits

```rust
impl From<QuipayError> for soroban_sdk::Error {
    fn from(error: QuipayError) -> Self {
        soroban_sdk::Error::from_contract_error(error as u32)
    }
}

impl From<QuipayError> for u32 {
    fn from(error: QuipayError) -> Self {
        error as u32
    }
}
```

### Helper Macros

```rust
macro_rules! require {
    ($condition:expr, $error:expr) => {
        if !$condition {
            return Err($error);
        }
    };
}
```

### Storage Helper Functions

```rust
fn get_admin<T: soroban_sdk::storage::Storage>(storage: &T) -> Result<Address, QuipayError> {
    storage.get(&DataKey::Admin).ok_or(QuipayError::NotInitialized)
}
```

## Acceptance Criteria Verification

### ✅ Frontend Error Distinction

The implementation will enable the frontend to distinguish between:

- "Insufficient Balance" (Error code 1006)
- "Unauthorized" (Error code 1003)
- "Stream Expired" (Error code 1012)

### ✅ Code Readability and Standardization

- All contracts will use consistent error handling patterns
- Error variants will be self-documenting
- Helper functions will reduce code duplication

### ✅ Unit Test Coverage

- Each error variant will have corresponding unit tests
- Tests will verify correct error code propagation
- Integration tests will validate frontend error handling

## Migration Strategy

### Backward Compatibility

- Error codes will be stable and versioned
- Existing panic messages will be preserved in error descriptions
- Gradual migration approach allows incremental updates

### Rollout Plan

1. Deploy common error module
2. Update contracts one by one
3. Update frontend error handling
4. Remove deprecated panic-based error handling

## Risks and Mitigations

### Risk: Contract Size Increase

**Mitigation**: Use efficient error representation and minimize error variant count

### Risk: Breaking Changes

**Mitigation**: Maintain backward compatibility during transition period

### Risk: Testing Complexity

**Mitigation**: Comprehensive test suite with automated error verification

## Timeline Estimate

- **Phase 1**: 2-3 days (Common error infrastructure)
- **Phase 2**: 4-5 days (Contract updates)
- **Phase 3**: 2-3 days (Testing)
- **Phase 4**: 2-3 days (Frontend integration)

**Total Estimated Time**: 10-14 days

## Success Metrics

1. **Zero panic-based errors** in production contracts
2. **100% test coverage** for error scenarios
3. **Frontend can handle** all error codes gracefully
4. **Reduced debugging time** due to clear error messages
5. **Improved user experience** with actionable error feedback

This implementation plan provides a comprehensive approach to replacing generic panics with a robust error handling system that meets all acceptance criteria and provides long-term maintainability.
