import { rawToUnitNumber, rawToUnitString } from "../stroops";

describe("rawToUnitNumber", () => {
  it("converts small stroops amounts the same as plain division", () => {
    expect(rawToUnitNumber(15_000_000n, 7)).toBe(1.5);
    expect(rawToUnitNumber(0n, 7)).toBe(0);
  });

  it("stays exact for a 1.5M token treasury, well past the naive Number(bigint) ceiling", () => {
    // 1,500,000 tokens at 7 decimals = 15,000,000,000,000 stroops.
    // Number(15_000_000_000_000n) is already exact, but the naive
    // `Number(raw) / 1e7` path used to be the only thing standing between
    // this and much larger, actually-unsafe amounts.
    const raw = 15_000_000_000_000n;
    expect(rawToUnitNumber(raw, 7)).toBe(1_500_000);
  });

  it("remains precise for treasuries far above Number.MAX_SAFE_INTEGER stroops", () => {
    // 2,000,000,000 tokens (2 billion) at 7 decimals — the stroops value
    // itself (2e16) is well past Number.MAX_SAFE_INTEGER (~9.007e15), so
    // `Number(raw)` alone would already round before any division happened.
    const raw = 20_000_000_000_000_000n;
    expect(Number.isSafeInteger(Number(raw))).toBe(false);
    expect(rawToUnitNumber(raw, 7)).toBe(2_000_000_000);
  });

  it("handles negative amounts", () => {
    expect(rawToUnitNumber(-15_000_000n, 7)).toBe(-1.5);
  });

  it("preserves fractional remainders", () => {
    expect(rawToUnitNumber(1_234_567n, 7)).toBeCloseTo(0.1234567, 7);
  });
});

describe("rawToUnitString", () => {
  it("formats an exact decimal string with full precision", () => {
    expect(rawToUnitString(15_000_000_001n, 7)).toBe("1500.0000001");
  });

  it("pads short remainders with leading zeros", () => {
    expect(rawToUnitString(10_000_001n, 7)).toBe("1.0000001");
  });

  it("stays exact for amounts beyond Number.MAX_SAFE_INTEGER", () => {
    const raw = 9_007_199_254_740_991n * 10_000_000n; // 9,007,199,254,740,991 tokens
    expect(rawToUnitString(raw, 7)).toBe("9007199254740991.0000000");
  });

  it("handles negative amounts", () => {
    expect(rawToUnitString(-15_000_000n, 7)).toBe("-1.5000000");
  });

  it("handles zero", () => {
    expect(rawToUnitString(0n, 7)).toBe("0.0000000");
  });
});
