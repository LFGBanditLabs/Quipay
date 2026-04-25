use soroban_sdk::{contracttype, Address, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamEvent {
    pub event_type: Symbol,
    pub timestamp: u64,
    pub amount: i128,
    pub actor: Address,
}

