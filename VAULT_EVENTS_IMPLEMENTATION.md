# Payroll Vault Structured Events Implementation

## Overview

This document outlines the implementation of structured contract events for the `payroll_vault` contract to enable on-chain event indexing and analytics.

## Changes Required

### 1. Add Event Struct Definitions

Add these event definitions after the `#[contract] pub struct PayrollVault;` line in `contracts/payroll_vault/src/lib.rs`:

```rust
/// Event emitted when funds are deposited into the vault
#[contractevent]
#[derive(Clone, Debug)]
pub struct VaultDeposited {
    /// Address of the employer/depositor
    pub employer: Address,
    /// Token address
    pub token: Address,
    /// Amount deposited
    pub amount: i128,
}

/// Event emitted when funds are withdrawn from the vault
#[contractevent]
#[derive(Clone, Debug)]
pub struct VaultWithdrawn {
    /// Address of the recipient/withdrawer
    pub employer: Address,
    /// Token address
    pub token: Address,
    /// Amount withdrawn
    pub amount: i128,
}

/// Event emitted when protocol fees are collected
#[contractevent]
#[derive(Clone, Debug)]
pub struct VaultFeeCollected {
    /// Address of the beneficiary of collected fees
    pub employer: Address,
    /// Token address
    pub token: Address,
    /// Fee amount collected
    pub fee_amount: i128,
}
```

### 2. Update Event Emission in `deposit()` Function

In the `deposit()` function (around line 662), replace the generic event:

```rust
// OLD: Generic symbol-based event
e.events().publish(
    (
        symbol_short!("vault"),
        symbol_short!("deposited"),
        from.clone(),
        token.clone(),
    ),
    (amount, new_total),
);
```

With the structured event:

```rust
// NEW: Structured event
let event = VaultDeposited {
    employer: from.clone(),
    token: token.clone(),
    amount,
};
e.events().publish(event);
```

### 3. Update Event Emission in `withdraw()` Function

In the `withdraw()` function (around line 745), replace:

```rust
// OLD: Generic symbol-based event
e.events().publish(
    (
        symbol_short!("vault"),
        symbol_short!("withdrawn"),
        to.clone(),
        token.clone(),
    ),
    (amount, new_total),
);
```

With:

```rust
// NEW: Structured event
let event = VaultWithdrawn {
    employer: to.clone(),
    token: token.clone(),
    amount,
};
e.events().publish(event);
```

### 4. Add Fee Collection Function

If not already present, add a new public function to emit fee collection events. This function should:
- Require admin authorization
- Update fees collected (tracked in contract state)
- Emit the VaultFeeCollected event

```rust
/// Collect accumulated protocol fees
/// Requires admin authorization
pub fn collect_fees(
    e: Env, 
    token: Address, 
    fee_amount: i128
) -> Result<(), QuipayError> {
    let admin: Address = e
        .storage()
        .persistent()
        .get(&StateKey::Admin)
        .ok_or(QuipayError::NotInitialized)?;
    admin.require_auth();
    
    require_positive_amount!(fee_amount)?;
    
    // Update collected fees state (implement if needed)
    // ...
    
    // Emit structured event
    let event = VaultFeeCollected {
        employer: admin.clone(),
        token: token.clone(),
        fee_amount,
    };
    e.events().publish(event);
    
    Ok(())
}
```

## Testing

### Snapshot Tests

Create snapshot tests in `contracts/payroll_vault/src/test.rs`:

```rust
#[test]
fn test_vault_deposited_event() {
    let (env, vault, admin, token_id) = setup();
    
    let employer = Address::generate(&env);
    let amount = 1000;
    
    // Perform deposit
    vault.deposit(&employer, &token_id, &amount);
    
    // Check event was published
    let events = env.events().all();
    assert!(!events.is_empty());
    
    // Snapshot test for event structure
    insta::assert_debug_snapshot!(events.last().unwrap());
}

#[test]
fn test_vault_withdrawn_event() {
    let (env, vault, admin, token_id) = setup();
    
    let recipient = Address::generate(&env);
    let amount = 1000;
    
    // Setup: deposit first
    vault.deposit(&admin, &token_id, &amount);
    
    // Perform withdrawal
    vault.withdraw(&recipient, &token_id, &amount);
    
    // Snapshot test for event structure
    let events = env.events().all();
    insta::assert_debug_snapshot!(events.last().unwrap());
}

#[test]
fn test_vault_fee_collected_event() {
    let (env, vault, admin, token_id) = setup();
    
    let fee_amount = 100;
    
    // Collect fees
    vault.collect_fees(&admin, &token_id, &fee_amount);
    
    // Snapshot test for event structure
    let events = env.events().all();
    insta::assert_debug_snapshot!(events.last().unwrap());
}
```

### Event Format Verification

Events emitted should be queryable by indexers. The structured format provides:
- Clear event topic (contract + event name)
- Strong typing for parameters
- ABI-compatible encoding for external tools

## Implementation Order

1. Add event struct definitions (no functional changes)
2. Update deposit() to emit structured event
3. Update withdraw() to emit structured event
4. Add collect_fees() function with event emission
5. Add snapshot tests
6. Update contract documentation

## Verification

After implementation, verify that:
- Events are published synchronously after successful state mutations
- Events include all required fields (employer, token, amount/fee_amount)
- Events are NOT published on error paths (before state mutation or after recovery)
- Snapshot tests pass and document expected event format
- Indexers can parse and process the events

## Documentation Updates

Update `contracts/payroll_vault/README.md` to document:
- Event types and when they're emitted
- Event field meanings
- Examples of subscribing to events
- Integration with Soroban indexers (e.g., Stellar Horizon)
