#![cfg(test)]
extern crate std;
use super::*;
use crate::test::setup;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec, Address, Env,
};

#[test]
fn test_scheduled_pause() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _, _, _) = setup(&env);

    env.ledger().set_timestamp(0);
    client.set_paused(&true);

    assert!(!client.is_paused());
    assert_eq!(client.get_scheduled_pause(), Some(86400));

    env.ledger().set_timestamp(86399);
    assert!(!client.is_paused());

    env.ledger().set_timestamp(86400);
    assert!(client.is_paused());
}

#[test]
fn test_cancel_scheduled_pause() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _, _, _) = setup(&env);

    env.ledger().set_timestamp(0);
    client.set_paused(&true);
    assert_eq!(client.get_scheduled_pause(), Some(86400));

    client.cancel_pause();
    assert_eq!(client.get_scheduled_pause(), None);

    env.ledger().set_timestamp(90000);
    assert!(!client.is_paused());
}

#[test]
fn test_emergency_pause() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _, _, _) = setup(&env);

    let e1 = Address::generate(&env);
    let e2 = Address::generate(&env);
    let e3 = Address::generate(&env);
    client.set_emergency_multisig(&vec![&env, e1.clone(), e2.clone(), e3.clone()]);

    client.emergency_pause(&e1);
    assert!(!client.is_paused());

    // Same caller twice shouldn't trigger
    client.emergency_pause(&e1);
    assert!(!client.is_paused());

    client.emergency_pause(&e2);
    assert!(client.is_paused());
    assert_eq!(client.get_scheduled_pause(), None);
}

#[test]
fn test_resume_clears_all() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _, _, _) = setup(&env);

    client.set_paused(&true);
    assert!(client.get_scheduled_pause().is_some());

    client.set_paused(&false);
    assert!(!client.is_paused());
    assert!(client.get_scheduled_pause().is_none());
}
