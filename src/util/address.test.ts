import { expect, test, describe } from "bun:test";
import { shortenAddress } from "./address";

describe("shortenAddress", () => {
  test("should shorten a standard Stellar address", () => {
    const addr = "GA6HCMBLZZS5S7XCO3Z6S3CEOV7XW73O6Z7P7O6E5S5S7XCO3Z6S3C";
    expect(shortenAddress(addr)).toBe("GA6HCM...6S3C");
  });

  test("should shorten with custom character count", () => {
    const addr = "GA6HCMBLZZS5S7XCO3Z6S3CEOV7XW73O6Z7P7O6E5S5S7XCO3Z6S3C";
    expect(shortenAddress(addr, 6)).toBe("GA6HCM...3Z6S3C");
  });

  test("should return the original string if it is 12 characters or less", () => {
    const shortAddr = "ABCDEFGHIJKL";
    expect(shortenAddress(shortAddr)).toBe("ABCDEFGHIJKL");
  });

  test("should handle empty strings", () => {
    expect(shortenAddress("")).toBe("");
  });

  test("should handle null or undefined (as empty string)", () => {
    // @ts-expect-error - testing invalid input
    expect(shortenAddress(null)).toBe("");
    // @ts-expect-error - testing invalid input
    expect(shortenAddress(undefined)).toBe("");
  });
});
