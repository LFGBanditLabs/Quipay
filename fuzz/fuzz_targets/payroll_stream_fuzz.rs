#![no_main]

use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use payroll_stream::{PayrollStream, PayrollStreamClient, StreamStatus};
use soroban_sdk::{Address, Env, testutils::Address as _, testutils::Ledger};

mod dummy_vault {
    use soroban_sdk::{Address, Env, contract, contractimpl};

    #[contract]
    pub struct DummyVault;

    #[contractimpl]
    impl DummyVault {
        pub fn check_solvency(_env: Env, _token: Address, _additional_liability: i128) -> bool {
            true
        }
        pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn remove_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn payout_liability(_env: Env, _to: Address, _token: Address, _amount: i128) {}
    }
}

#[derive(Arbitrary, Debug)]
enum StreamAction {
    Create {
        rate: i128,
        cliff_offset: i32,
        start_offset: i32,
        duration: i32,
    },
    Withdraw {
        stream_selector: u8,
        caller_selector: u8,
        time_advance: u16,
    },
    Extend {
        stream_selector: u8,
        additional_amount: i128,
        end_delta: i32,
    },
}

#[derive(Clone)]
struct KnownStream {
    id: u64,
    employer: Address,
    worker: Address,
    token: Address,
}

fn is_create_valid(
    rate: i128,
    cliff_ts: u64,
    start_ts: u64,
    end_ts: u64,
    now: u64,
    max_duration: u64,
) -> bool {
    if rate <= 0 {
        return false;
    }
    if end_ts <= start_ts {
        return false;
    }
    if start_ts < now {
        return false;
    }
    if end_ts.saturating_sub(start_ts) > max_duration {
        return false;
    }
    let effective_cliff = if cliff_ts <= start_ts {
        start_ts
    } else {
        cliff_ts
    };
    if effective_cliff > end_ts {
        return false;
    }

    let duration = end_ts.saturating_sub(start_ts);
    rate.checked_mul(duration as i128).is_some()
}

fuzz_target!(|actions: Vec<StreamAction>| {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);

    client.init(&admin);
    client.set_vault(&vault_id);
    client.set_cancellation_grace_period(&0u64);
    client.set_withdrawal_cooldown(&0u64);

    let max_duration = client.get_max_stream_duration();

    let mut now = 1_700_000_000u64;
    env.ledger().set_timestamp(now);

    let mut streams: Vec<KnownStream> = Vec::new();

    for action in actions {
        match action {
            StreamAction::Create {
                rate,
                cliff_offset,
                start_offset,
                duration,
            } => {
                let employer = Address::generate(&env);
                let worker = Address::generate(&env);
                let token = Address::generate(&env);

                let start_ts = if start_offset >= 0 {
                    now.saturating_add(start_offset as u64)
                } else {
                    now.saturating_sub(start_offset.unsigned_abs() as u64)
                };

                let end_ts = if duration >= 0 {
                    start_ts.saturating_add(duration as u64)
                } else {
                    start_ts.saturating_sub(duration.unsigned_abs() as u64)
                };

                let cliff_ts = if cliff_offset >= 0 {
                    start_ts.saturating_add(cliff_offset as u64)
                } else {
                    start_ts.saturating_sub(cliff_offset.unsigned_abs() as u64)
                };

                let result = client.try_create_stream(
                    &employer,
                    &worker,
                    &token,
                    &rate,
                    &cliff_ts,
                    &start_ts,
                    &end_ts,
                    &None,
                );

                let expected_valid =
                    is_create_valid(rate, cliff_ts, start_ts, end_ts, now, max_duration);

                if expected_valid {
                    assert!(
                        matches!(result, Ok(Ok(_))),
                        "valid create_stream input returned Err"
                    );
                    if let Ok(Ok(stream_id)) = result {
                        streams.push(KnownStream {
                            id: stream_id,
                            employer,
                            worker,
                            token,
                        });
                    }
                } else {
                    assert!(result.is_err(), "invalid create_stream input returned Ok");
                }
            }
            StreamAction::Withdraw {
                stream_selector,
                caller_selector,
                time_advance,
            } => {
                if streams.is_empty() {
                    continue;
                }

                now = now.saturating_add(time_advance as u64);
                env.ledger().set_timestamp(now);

                let index = (stream_selector as usize) % streams.len();
                let target = streams[index].clone();

                let caller = if caller_selector % 2 == 0 {
                    target.worker.clone()
                } else {
                    Address::generate(&env)
                };

                let before = client.get_stream(&target.id);
                let result = client.try_withdraw(&target.id, &caller);

                if let Some(stream) = before {
                    let should_err = caller != stream.worker
                        || stream.status == StreamStatus::Canceled
                        || stream.status == StreamStatus::Completed;

                    if should_err {
                        assert!(
                            !matches!(result, Ok(Ok(_))),
                            "invalid withdraw input returned Ok"
                        );
                    } else {
                        assert!(
                            matches!(result, Ok(Ok(_))),
                            "valid withdraw input returned Err"
                        );
                    }
                }
            }
            StreamAction::Extend {
                stream_selector,
                additional_amount,
                end_delta,
            } => {
                if streams.is_empty() {
                    continue;
                }

                let index = (stream_selector as usize) % streams.len();
                let target = streams[index].clone();

                let before = client.get_stream(&target.id);
                if let Some(stream) = before {
                    let new_end_time = if end_delta >= 0 {
                        stream.end_ts.saturating_add(end_delta as u64)
                    } else {
                        stream.end_ts.saturating_sub(end_delta.unsigned_abs() as u64)
                    };

                    let result =
                        client.try_extend_stream(&target.id, &additional_amount, &new_end_time);

                    let amount_ok = additional_amount >= 0
                        && stream.total_amount.checked_add(additional_amount).is_some();
                    let should_succeed = stream.status == StreamStatus::Active
                        && new_end_time >= stream.end_ts
                        && amount_ok;

                    if should_succeed {
                        assert!(
                            matches!(result, Ok(Ok(()))),
                            "valid extend_stream input returned Err"
                        );
                    } else {
                        assert!(
                            !matches!(result, Ok(Ok(()))),
                            "invalid extend_stream input returned Ok"
                        );
                    }
                }
            }
        }

        // Invariant checks for all known streams that still exist.
        for item in &streams {
            if let Some(stream) = client.get_stream(&item.id) {
                assert_eq!(stream.employer, item.employer);
                assert_eq!(stream.worker, item.worker);
                assert_eq!(stream.token, item.token);
                assert!(stream.total_amount >= 0, "stream total became negative");
                assert!(
                    stream.withdrawn_amount >= 0,
                    "withdrawn amount became negative"
                );
                assert!(
                    stream.withdrawn_amount <= stream.total_amount,
                    "withdrawn exceeds total amount"
                );
            }
        }
    }
});
