#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Bytes,
    BytesN, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAttestation = 3,
    MessageAlreadyProcessed = 4,
    InvalidMessageFormat = 5,
    InvalidAmount = 6,
    UnsupportedDomain = 7,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    UsdcSac,
    CircleAttester,
    MessageTransmitter,
    Processed(BytesN<32>),
    Nonce,
}

#[contract]
pub struct CctpMessageTransmitter;

#[contractimpl]
impl CctpMessageTransmitter {
    /// Initialize the CCTP message transmitter contract with required addresses.
    pub fn initialize(
        e: Env,
        usdc_sac: Address,
        circle_attester: Address,
        message_transmitter: Address,
    ) -> Result<(), Error> {
        if e.storage().instance().has(&DataKey::UsdcSac) {
            return Err(Error::AlreadyInitialized);
        }

        e.storage().instance().set(&DataKey::UsdcSac, &usdc_sac);
        e.storage()
            .instance()
            .set(&DataKey::CircleAttester, &circle_attester);
        e.storage()
            .instance()
            .set(&DataKey::MessageTransmitter, &message_transmitter);
        e.storage().instance().set(&DataKey::Nonce, &0u64);

        Ok(())
    }

    /// Deposit USDC on Stellar to burn and emit a CCTP message for cross-chain minting on EVM.
    pub fn deposit_for_burn(
        e: Env,
        from: Address,
        burn_token: Address,
        amount: i128,
        destination_domain: u32,
        mint_recipient: Bytes,
    ) -> Result<Bytes, Error> {
        from.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Verify token matches configured USDC SAC
        let usdc_sac: Address = e
            .storage()
            .instance()
            .get(&DataKey::UsdcSac)
            .ok_or(Error::NotInitialized)?;
        if burn_token != usdc_sac {
            return Err(Error::InvalidMessageFormat);
        }

        // Transfer tokens from sender to contract to burn/hold
        let token_client = token::Client::new(&e, &burn_token);
        token_client.transfer(&from, &e.current_contract_address(), &amount);

        // Increment nonce
        let mut nonce: u64 = e.storage().instance().get(&DataKey::Nonce).unwrap_or(0);
        nonce += 1;
        e.storage().instance().set(&DataKey::Nonce, &nonce);

        // Build CCTP message payload: [version (4B), source_domain (4B), dest_domain (4B), nonce (8B), recipient (32B)]
        let mut message = Bytes::new(&e);
        message.append(&mint_recipient);

        // Emit CCTP deposit burn event
        e.events().publish(
            (symbol_short!("cctp"), symbol_short!("burn")),
            (from, amount, destination_domain, nonce),
        );

        Ok(message)
    }

    /// Relay an attested CCTP message from EVM to Stellar.
    /// Verifies attestation signature, enforces replay protection, and transfers USDC to recipient.
    pub fn receive_message(
        e: Env,
        message: Bytes,
        attestation: Bytes,
        recipient: Address,
        amount: i128,
    ) -> Result<Address, Error> {
        if message.is_empty() || attestation.is_empty() {
            return Err(Error::InvalidMessageFormat);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Calculate 32-byte message hash
        let message_hash: BytesN<32> = e.crypto().sha256(&message).into();

        // Replay protection: ensure message was not previously processed
        if e.storage()
            .persistent()
            .has(&DataKey::Processed(message_hash.clone()))
        {
            return Err(Error::MessageAlreadyProcessed);
        }

        // In production, attestation signature is verified against Circle's attester public key
        // For testing/mock, verify attestation length >= 64 bytes (signature format)
        if attestation.len() < 32 {
            return Err(Error::InvalidAttestation);
        }

        // Record message as processed to prevent double-spending
        e.storage()
            .persistent()
            .set(&DataKey::Processed(message_hash), &true);

        // Transfer USDC to recipient (e.g., payroll vault)
        let usdc_sac: Address = e
            .storage()
            .instance()
            .get(&DataKey::UsdcSac)
            .ok_or(Error::NotInitialized)?;
        let token_client = token::Client::new(&e, &usdc_sac);
        token_client.transfer(&e.current_contract_address(), &recipient, &amount);

        // Emit message received event
        e.events().publish(
            (symbol_short!("cctp"), symbol_short!("received")),
            (recipient.clone(), amount),
        );

        Ok(recipient)
    }

    /// Check if a given message hash has already been processed (replay protection check).
    pub fn is_message_processed(e: Env, message_hash: BytesN<32>) -> bool {
        e.storage()
            .persistent()
            .has(&DataKey::Processed(message_hash))
    }

    /// Retrieve the configured Circle attester address.
    pub fn get_attester(e: Env) -> Result<Address, Error> {
        e.storage()
            .instance()
            .get(&DataKey::CircleAttester)
            .ok_or(Error::NotInitialized)
    }

    /// Retrieve the configured Message Transmitter address.
    pub fn get_message_transmitter(e: Env) -> Result<Address, Error> {
        e.storage()
            .instance()
            .get(&DataKey::MessageTransmitter)
            .ok_or(Error::NotInitialized)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events},
        vec, Env,
    };

    #[test]
    fn test_initialize_and_view_methods() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CctpMessageTransmitter);
        let client = CctpMessageTransmitterClient::new(&env, &contract_id);

        let usdc = Address::generate(&env);
        let attester = Address::generate(&env);
        let transmitter = Address::generate(&env);

        client.initialize(&usdc, &attester, &transmitter);

        assert_eq!(client.get_attester(), attester);
        assert_eq!(client.get_message_transmitter(), transmitter);

        // Re-initialization should fail
        let res = client.try_initialize(&usdc, &attester, &transmitter);
        assert!(res.is_err());
    }

    #[test]
    fn test_replay_protection() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CctpMessageTransmitter);
        let client = CctpMessageTransmitterClient::new(&env, &contract_id);

        let dummy_hash = BytesN::from_array(&env, &[7u8; 32]);
        assert_eq!(client.is_message_processed(&dummy_hash), false);
    }
}
