use crate::{QuipayError, QuipayResult};

pub fn checked_add_i128(a: i128, b: i128) -> QuipayResult<i128> {
    a.checked_add(b).ok_or(QuipayError::ArithmeticOverflow)
}

pub fn checked_sub_i128(a: i128, b: i128) -> QuipayResult<i128> {
    a.checked_sub(b).ok_or(QuipayError::ArithmeticOverflow)
}

pub fn checked_mul_i128(a: i128, b: i128) -> QuipayResult<i128> {
    a.checked_mul(b).ok_or(QuipayError::ArithmeticOverflow)
}

pub fn checked_div_i128(a: i128, b: i128) -> QuipayResult<i128> {
    a.checked_div(b).ok_or(QuipayError::ArithmeticOverflow)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checked_helpers_fail_safely() {
        assert_eq!(
            checked_add_i128(i128::MAX, 1),
            Err(QuipayError::ArithmeticOverflow)
        );
        assert_eq!(
            checked_sub_i128(i128::MIN, 1),
            Err(QuipayError::ArithmeticOverflow)
        );
        assert_eq!(
            checked_mul_i128(i128::MAX, 2),
            Err(QuipayError::ArithmeticOverflow)
        );
        assert_eq!(checked_div_i128(1, 0), Err(QuipayError::ArithmeticOverflow));
    }
}
