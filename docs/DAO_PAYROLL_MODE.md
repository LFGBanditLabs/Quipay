# DAO Payroll Mode

## Overview

DAO Payroll Mode enables multisig treasuries to require community governance approval for payroll stream creation. This feature provides a democratic layer of control while maintaining the security benefits of multisig signatures.

## Architecture

### Smart Contracts

#### 1. DAO Governance Contract (`contracts/dao_governance/`)
- **Purpose**: Manages proposal lifecycle, voting, and execution
- **Key Features**:
  - Proposal creation for various actions (CreateStream, CancelStream, etc.)
  - Configurable voting thresholds (1-10 signers)
  - Voting periods with execution delays
  - Proposal expiration and status tracking
  - Integration with PayrollStream contract

#### 2. Enhanced PayrollStream Contract
- **New Functions**:
  - `enable_dao_mode()` - Enable DAO governance mode
  - `disable_dao_mode()` - Disable DAO governance mode
  - `create_stream_via_governance()` - Create streams via approved proposals
- **Modified Behavior**:
  - `create_stream()` is blocked when DAO mode is enabled
  - Only DAO governance contract can create streams in DAO mode

### Frontend Components

#### 1. ProposalCreator (`src/components/ProposalCreator.tsx`)
- Comprehensive form for creating governance proposals
- Supports all proposal types with validation
- Real-time form feedback and error handling
- Integration with DAO governance contract

#### 2. VotingInterface (`src/components/VotingInterface.tsx`)
- Interactive voting interface with real-time status
- Vote for/against with optional reasoning
- Execution trigger for approved proposals
- Progress visualization and timeline display

#### 3. Enhanced GovernanceOverview (`src/pages/GovernanceOverview.tsx`)
- DAO mode toggle switch
- Proposal creation button (when DAO mode enabled)
- Integration with new components
- Unified interface for both multisig and DAO modes

## Proposal Types

| Type | Description | Payload |
|------|-------------|---------|
| CreateStream | Create a new payroll stream | employer, worker, token, rate, timestamps |
| CancelStream | Cancel an existing stream | stream_id |
| UpdateStream | Modify stream parameters | stream_id, new_rate, new_end_ts |
| Transfer | Transfer funds from treasury | token, amount, recipient |
| Upgrade | Upgrade smart contract | new_wasm_hash |
| AdminChange | Change admin address | new_admin |
| ThresholdChange | Change voting threshold | new_threshold |

## Workflow

### 1. Enable DAO Mode
```
Admin calls enable_dao_mode(governance_contract_address)
```

### 2. Create Proposal
```
1. Authorized signer submits proposal via ProposalCreator
2. Proposal enters voting period (default 7 days)
3. Signers vote for/against with optional reasoning
4. Proposal approved if votes_for >= threshold
```

### 3. Execute Proposal
```
1. After voting period + execution delay (default 24 hours)
2. Any authorized signer can execute approved proposal
3. Proposal actions are performed on-chain
4. Stream created/modified/cancelled as specified
```

## Configuration

### Environment Variables
```bash
# DAO Governance Contract
VITE_DAO_GOVERNANCE_CONTRACT_ID=your_governance_contract_id

# Stellar Network
VITE_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_STELLAR_RPC_URL=https://horizon-testnet.stellar.org
```

### Default Parameters
- **Voting Period**: 7 days (604,800 seconds)
- **Execution Delay**: 24 hours (86,400 seconds)
- **Default Threshold**: 2-of-N multisig
- **Min Threshold**: 1 signer
- **Max Threshold**: 10 signers

## Security Features

### 1. Access Control
- Only authorized signers can create proposals
- Proposal creation requires valid signer authentication
- Stream creation blocked when DAO mode enabled

### 2. Voting Security
- One vote per signer per proposal
- Vote tracking prevents double voting
- Transparent vote recording with timestamps

### 3. Execution Safety
- Execution delays prevent rushed decisions
- Only approved proposals can be executed
- Proposal expiration prevents stale proposals

### 4. Audit Trail
- Complete proposal lifecycle logging
- Vote records with reasoning
- Execution history with timestamps

## API Reference

### DAO Governance Contract

#### Initialization
```rust
pub fn init(
    env: Env,
    admin: Address,
    multisig_signers: Vec<Address>,
    payroll_stream_contract: Address,
) -> Result<(), QuipayError>
```

#### Proposal Management
```rust
pub fn create_proposal(
    env: Env,
    proposer: Address,
    proposal_type: ProposalType,
    title: String,
    description: String,
    payload: ProposalPayload,
) -> Result<u64, QuipayError>

pub fn vote(
    env: Env,
    voter: Address,
    proposal_id: u64,
    in_favor: bool,
    reason: Option<String>,
) -> Result<(), QuipayError>

pub fn execute_proposal(
    env: Env,
    executor: Address,
    proposal_id: u64,
) -> Result<(), QuipayError>
```

#### Query Functions
```rust
pub fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, QuipayError>
pub fn get_all_proposals(env: Env) -> Result<Vec<Proposal>, QuipayError>
pub fn get_pending_proposals(env: Env) -> Result<Vec<Proposal>, QuipayError>
pub fn stream_requires_governance(env: Env, stream_id: u64) -> Result<bool, QuipayError>
```

### Frontend Service

#### Mock DAO Service (`src/util/daoService.ts`)
```typescript
// Create proposal
await mockDaoService.createProposal(
  proposer,
  ProposalType.CreateStream,
  title,
  description,
  payload
);

// Vote on proposal
await mockDaoService.vote(voter, proposalId, inFavor, reason);

// Execute proposal
await mockDaoService.executeProposal(executor, proposalId);
```

## Integration Guide

### 1. Contract Deployment
```bash
# Deploy DAO governance contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/dao_governance.wasm \
  --source your_admin_address \
  --network testnet

# Enable DAO mode on PayrollStream
stellar contract invoke \
  --id your_payroll_stream_contract \
  --source your_admin_address \
  --function enable_dao_mode \
  --arg your_governance_contract_address
```

### 2. Frontend Integration
```typescript
import { mockDaoService, ProposalType } from '../util/daoService';
import ProposalCreator from '../components/ProposalCreator';
import VotingInterface from '../components/VotingInterface';

// Use in your components
const handleProposalCreate = async (values) => {
  const proposalId = await mockDaoService.createProposal(
    userAddress,
    values.proposalType,
    values.title,
    values.description,
    payload
  );
  // Handle success
};
```

## Testing

### Unit Tests
```bash
# Run DAO governance contract tests
cargo test -p dao_governance

# Run PayrollStream integration tests
cargo test -p payroll_stream --features dao_mode
```

### Frontend Tests
```bash
# Run component tests
npm test -- --testPathPattern=ProposalCreator
npm test -- --testPathPattern=VotingInterface
```

## Migration Guide

### From Multisig to DAO Mode

1. **Deploy DAO Governance Contract**
   ```bash
   stellar contract deploy --wasm dao_governance.wasm --source admin_address
   ```

2. **Initialize DAO**
   ```bash
   stellar contract invoke \
     --id governance_contract \
     --function init \
     --arg admin_address \
     --arg "[signer1,signer2,signer3]" \
     --arg payroll_stream_contract
   ```

3. **Enable DAO Mode**
   ```bash
   stellar contract invoke \
     --id payroll_stream_contract \
     --function enable_dao_mode \
     --arg governance_contract_address
   ```

4. **Update Frontend Configuration**
   ```typescript
   // Set environment variables
   VITE_DAO_GOVERNANCE_CONTRACT_ID=your_contract_id
   ```

### Reverting to Multisig Mode

1. **Disable DAO Mode**
   ```bash
   stellar contract invoke \
     --id payroll_stream_contract \
     --function disable_dao_mode \
     --source admin_address
   ```

2. **Remove DAO Contract References**
   - Clear environment variables
   - Remove frontend integration

## Troubleshooting

### Common Issues

1. **Proposal Creation Fails**
   - Verify caller is authorized signer
   - Check DAO mode is enabled
   - Ensure valid proposal payload

2. **Voting Not Working**
   - Check voting period is active
   - Verify signer hasn't already voted
   - Ensure proposal is still pending

3. **Execution Fails**
   - Verify proposal is approved
   - Check execution delay has passed
   - Ensure proposal hasn't expired

### Debug Tips

1. **Check Contract State**
   ```rust
   // Query proposal status
   dao_governance::get_proposal(proposal_id)
   
   // Check DAO mode
   payroll_stream::is_dao_mode_enabled()
   ```

2. **Monitor Events**
   - Watch for `PROPOSAL_CREATED` events
   - Monitor `PROPOSAL_EXECUTED` events
   - Track voting progress

3. **Frontend Debugging**
   - Use browser dev tools for network requests
   - Check console for error messages
   - Verify environment variables

## Future Enhancements

### Planned Features
- [ ] Quadratic voting mechanism
- [ ] Delegated voting
- [ ] Proposal templates
- [ ] Advanced voting strategies
- [ ] Cross-chain governance
- [ ] Time-locked proposals

### Community Contributions
- [ ] Governance token integration
- [ ] Reputation-based voting
- [ ] Automated proposal execution
- [ ] Mobile voting interface

## Support

For questions or issues related to DAO Payroll Mode:

1. Check the [troubleshooting guide](#troubleshooting)
2. Review the [API reference](#api-reference)
3. Open an issue on the GitHub repository
4. Join the community Discord for real-time support

---

**Note**: This feature is currently in beta. Please test thoroughly before using in production environments.
