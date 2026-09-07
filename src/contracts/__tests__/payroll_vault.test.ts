jest.mock("../util", () => ({
  rpcUrl: "https://rpc.test",
  networkPassphrase: "Test SDF Network ; September 2015",
}));

jest.mock("../../lib/tokenAddresses", () => ({
  getXlmSacAddress: () => "CXLM",
}));

jest.mock("../payroll_stream", () => ({
  getStreamsByEmployer: jest.fn(),
}));

import { calculateEmployerTokenLiability } from "../payroll_vault";
import type { ContractStream } from "../payroll_stream";

const employer = "GEMPLOYER";
const worker = "GWORKER";
const usdcToken = "CUSDC";
const xlmToken = "CXLM";

function makeStream(overrides: Partial<ContractStream>): ContractStream {
  return {
    employer,
    worker,
    token: usdcToken,
    rate: BigInt(1),
    cliff_ts: BigInt(0),
    start_ts: BigInt(0),
    end_ts: BigInt(100),
    total_amount: BigInt(0),
    withdrawn_amount: BigInt(0),
    last_withdrawal_ts: BigInt(0),
    status: 0,
    created_at: BigInt(0),
    closed_at: BigInt(0),
    ...overrides,
  };
}

describe("calculateEmployerTokenLiability", () => {
  it("sums remaining active and paused streams for the requested token", () => {
    const liability = calculateEmployerTokenLiability(
      [
        makeStream({
          total_amount: BigInt(100),
          withdrawn_amount: BigInt(25),
          status: 0,
        }),
        makeStream({
          total_amount: BigInt(50),
          withdrawn_amount: BigInt(10),
          status: 3,
        }),
      ],
      usdcToken,
    );

    expect(liability).toBe(BigInt(115));
  });

  it("ignores other tokens and closed streams", () => {
    const liability = calculateEmployerTokenLiability(
      [
        makeStream({ token: xlmToken, total_amount: BigInt(500), status: 0 }),
        makeStream({ total_amount: BigInt(100), status: 1 }),
        makeStream({ total_amount: BigInt(200), status: 2 }),
        makeStream({ total_amount: BigInt(30), status: 0 }),
      ],
      usdcToken,
    );

    expect(liability).toBe(BigInt(30));
  });

  it("does not create negative liability for over-withdrawn stream data", () => {
    const liability = calculateEmployerTokenLiability(
      [
        makeStream({
          total_amount: BigInt(75),
          withdrawn_amount: BigInt(100),
          status: 0,
        }),
      ],
      usdcToken,
    );

    expect(liability).toBe(BigInt(0));
  });
});
