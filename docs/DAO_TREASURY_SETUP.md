# DAO Treasury Vault Configuration Guide

This guide explains how to configure the Quipay Treasury Vault for decentralized autonomous organizations (DAOs) and enterprise clients using multi-signature (multisig) Stellar accounts.

## Overview

The Quipay Treasury Vault supports multi-signature Stellar accounts as the admin address, enabling decentralized governance for DAOs and enterprise payroll management. This ensures that critical treasury operations require consensus from multiple authorized signers.

## How Multisig Works with Quipay

### Stellar Network-Level Validation

When you use a multisig Stellar account as the Treasury Vault admin, the Stellar network validates signature thresholds **before** the transaction reaches the smart contract:

1. **Transaction Submission**: A transaction is created to call a Treasury Vault function (e.g., `payout`, `allocate_funds`)
2. **Network Validation**: Stellar checks that the transaction includes signatures from enough signers to meet the account's threshold
3. **Contract Execution**: If the threshold is met, the transaction proceeds to the contract, where `require_auth()` verifies the admin account authorized the transaction

### Example: 2-of-3 Multisig Setup

For a 2-of-3 multisig configuration:

- **3 Signers**: Three authorized members (e.g., DAO council members)
- **Threshold**: 2 signatures required
- **Security**: Any 2 of the 3 signers can authorize treasury operations

## Setting Up a Multisig Treasury Vault

### Step 1: Create a Multisig Stellar Account

Using the Stellar CLI or SDK, create a multisig account:

```bash
# Create the base account
stellar-cli account create --name dao-treasury

# Add signers (example: 3 council members)
stellar-cli account add-signer --account dao-treasury \
  --signer GABC123... --weight 1
stellar-cli account add-signer --account dao-treasury \
  --signer GXYZ789... --weight 1
stellar-cli account add-signer --account dao-treasury \
  --signer GDEF456... --weight 1

# Set threshold (2-of-3)
stellar-cli account set-thresholds --account dao-treasury \
  --low 2 --medium 2 --high 2
```

### Step 2: Initialize Treasury Vault with Multisig Admin

When deploying the Treasury Vault contract, initialize it with your multisig account address:

```rust
// In your deployment script
let multisig_admin = Address::from_string(&env, "GDAO123...");
client.initialize(&multisig_admin);
```

### Step 3: Configure Signer Weights and Thresholds

**Recommended Thresholds for DAOs:**

| DAO Size              | Recommended Setup | Use Case                                     |
| --------------------- | ----------------- | -------------------------------------------- |
| Small (3-5 members)   | 2-of-3 or 2-of-4  | Fast decision-making with security           |
| Medium (5-10 members) | 3-of-5 or 4-of-7  | Balanced security and efficiency             |
| Large (10+ members)   | 5-of-9 or 7-of-12 | High security, slower but more decentralized |

**Threshold Guidelines:**

- **Low Threshold**: 2-3 signatures for routine operations (payouts, allocations)
- **Medium Threshold**: 3-5 signatures for important changes (authorized contract updates)
- **High Threshold**: 5+ signatures for critical operations (admin transfer, upgrades)

### Step 4: Test Your Setup

Before deploying to mainnet, test your multisig configuration:

1. **Test on Testnet**: Deploy to Stellar testnet and verify multisig operations
2. **Verify Thresholds**: Ensure transactions fail with insufficient signatures
3. **Test All Functions**: Verify all admin functions work with multisig:
   - `allocate_funds`
   - `release_funds`
   - `payout`
   - `set_authorized_contract`
   - `transfer_admin`
   - `upgrade`

## Best Practices for DAO Treasury Management

### 1. Signer Selection

- **Diversity**: Choose signers from different roles (technical, financial, governance)
- **Geographic Distribution**: Distribute signers across time zones for availability
- **Key Management**: Use hardware wallets or secure key management for signer keys
- **Backup Signers**: Maintain backup signers in case primary signers become unavailable

### 2. Threshold Configuration

- **Start Conservative**: Begin with higher thresholds (e.g., 3-of-5) and adjust based on experience
- **Separate Thresholds**: Use different thresholds for different operation types if needed
- **Emergency Procedures**: Establish procedures for emergency threshold adjustments

### 3. Operational Security

- **Multi-Signature Wallets**: Store signer keys in separate, secure locations
- **Transaction Monitoring**: Monitor all treasury operations for unauthorized activity
- **Regular Audits**: Periodically audit signer access and threshold configurations
- **Rotation Policy**: Rotate signers periodically to maintain security

### 4. Governance Integration

- **Proposal Process**: Integrate Treasury Vault operations with your DAO's proposal system
- **Voting Requirements**: Require on-chain votes before executing treasury operations
- **Transparency**: Publish treasury operations for community visibility
- **Emergency Powers**: Define clear procedures for emergency treasury access

## Example: DAO Payroll Workflow

### Scenario: Monthly Payroll Execution

1. **Proposal**: DAO members vote on a proposal to execute monthly payroll
2. **Transaction Building**: A council member builds the transaction calling `payout()` for each employee
3. **Signing**: At least 2 of 3 council members sign the transaction
4. **Submission**: The transaction is submitted to Stellar
5. **Network Validation**: Stellar validates that 2 signatures meet the threshold
6. **Contract Execution**: Treasury Vault verifies admin authorization and executes payout

### Code Example

```rust
// Example: Building a multisig transaction for payout
let env = Env::default();
let vault_client = PayrollVaultClient::new(&env, &vault_contract_id);

// Transaction must be signed by at least 2 of 3 multisig signers
// This is handled at the Stellar network level before reaching the contract
vault_client.payout(&employee_address, &token_address, &salary_amount);
```

## Security Considerations

### ✅ What Multisig Protects Against

- **Single Point of Failure**: No single compromised key can drain the treasury
- **Insider Threats**: Requires consensus from multiple authorized parties
- **Key Loss**: Other signers can still authorize operations if one key is lost
- **Unauthorized Access**: Transactions without sufficient signatures are rejected

### ⚠️ What to Watch For

- **Threshold Too Low**: If threshold is too low (e.g., 1-of-3), security is reduced
- **Key Compromise**: If multiple signer keys are compromised, the treasury is at risk
- **Signer Availability**: If signers are unavailable, operations may be delayed
- **Social Engineering**: Attackers may attempt to trick signers into authorizing malicious transactions

## Troubleshooting

### Transaction Fails with "Authorization Required"

**Problem**: Transaction is rejected even though you have the admin address.

**Solution**:

- Verify that enough signers have signed the transaction to meet the threshold
- Check that signer weights sum to at least the threshold value
- Ensure all signatures are valid and correspond to authorized signers

### Cannot Execute Operations

**Problem**: Operations that should work are failing.

**Solution**:

- Verify the multisig account is correctly set as the admin: `get_admin()`
- Check that transaction includes signatures from authorized signers
- Confirm threshold is set correctly on the Stellar account

### Need to Change Admin

**Problem**: You need to transfer admin to a new multisig account.

**Solution**:

- Current admin (with sufficient signatures) must call `transfer_admin(new_admin)`
- The new admin can be another multisig account
- Ensure the new multisig account is properly configured before transfer

## Additional Resources

- [Stellar Multisig Documentation](https://developers.stellar.org/docs/encyclopedia/multisig)
- [Soroban Authorization Guide](https://developers.stellar.org/docs/build/smart-contracts/guides/authorization)
- [Quipay Contract Documentation](../README.md)
- [Security Best Practices](SECURITY.md)

## Support

For questions or issues with multisig setup:

- Open an issue on [GitHub](https://github.com/LFGBanditLabs/Quipay/issues)
- Review the [contract tests](../contracts/payroll_vault/src/test.rs) for examples
- Check the [PRD](PRD.md) for protocol details

---

**Last Updated**: 2025-01-XX  
**Contract Version**: 1.0.0
