import { buildPayrollSocketQuery } from "../payrollSocketAuth";

describe("buildPayrollSocketQuery", () => {
  it("uses the Privy access token for the socket query", () => {
    expect(buildPayrollSocketQuery("privy-token")).toEqual({
      token: "privy-token",
    });
  });

  it("trims tokens before connecting", () => {
    expect(buildPayrollSocketQuery("  privy-token  ")).toEqual({
      token: "privy-token",
    });
  });

  it("does not produce a dummy token when auth is unavailable", () => {
    expect(buildPayrollSocketQuery(null)).toBeNull();
    expect(buildPayrollSocketQuery("")).toBeNull();
    expect(buildPayrollSocketQuery("   ")).toBeNull();
  });
});
