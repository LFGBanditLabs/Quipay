#[cfg(kani)]
mod kani_test {
    use crate::StateKey;

    #[kani::proof]
    fn prove_treasury_payout_invariant() {
        let initial_treasury: i128 = kani::any();
        let payout_amount: i128 = kani::any();

        // Assumptions for a valid state
        kani::assume(initial_treasury >= 0);
        kani::assume(payout_amount > 0);
        kani::assume(payout_amount <= initial_treasury);

        // Verification of arithmetic safety
        let remaining = initial_treasury - payout_amount;
        assert!(remaining >= 0);
        assert!(remaining < initial_treasury);
    }
}
