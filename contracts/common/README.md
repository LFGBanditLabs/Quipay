# `quipay_common`

Shared helpers and error types used by Quipay contracts.

## Checked arithmetic helpers

The common crate now exports checked i128 helpers:

- `checked_add_i128`
- `checked_sub_i128`
- `checked_mul_i128`
- `checked_div_i128`

Each helper returns `Result<i128, QuipayError>` and maps failure conditions
(overflow/underflow/division by zero) to `QuipayError::ArithmeticOverflow`.
