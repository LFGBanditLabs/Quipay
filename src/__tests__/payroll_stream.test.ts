// ─── Bootstrap env before real module loads ───────────────────────────────────
process.env.VITE_PAYROLL_STREAM_CONTRACT_ID =
  "CCY6Z5U5V5G3X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5";

// Mock external dependencies before importing the module under test
const nativeToScValMock = jest
  .fn()
  .mockImplementation(
    (val: unknown, _opts?: unknown) => ({ val, opts: _opts }) as never,
  );

jest.mock("@stellar/stellar-sdk", () => ({
  nativeToScVal: nativeToScValMock,
  xdr: {
    ScVal: {
      scvSymbol: jest
        .fn()
        .mockImplementation((s: string) => `sym:${s}` as never),
      scvVoid: jest.fn().mockReturnValue("void" as never),
      scvMap: jest
        .fn()
        .mockImplementation(
          (entries: { key: string; val: unknown }[]) => entries as never,
        ),
      scvVec: jest.fn().mockImplementation((vals: unknown[]) => vals as never),
    },
    ScMapEntry: jest
      .fn()
      .mockImplementation(({ key, val }: { key: string; val: unknown }) => ({
        key,
        val,
      })),
  },
  Account: jest.fn().mockImplementation(() => ({})),
  Contract: jest.fn().mockImplementation(() => ({
    call: jest.fn().mockReturnValue("operation"),
  })),
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({}),
  })),
  Address: jest.fn().mockImplementation((addr: string) => ({
    toScVal: () => `addr:${addr}` as never,
  })),
  rpc: {
    Server: jest.fn().mockImplementation(() => ({
      getAccount: jest.fn().mockResolvedValue({}),
      prepareTransaction: jest.fn().mockResolvedValue({
        toXDR: () => "prepared-xdr",
      }),
    })),
  },
}));

jest.mock("../contracts/util", () => ({
  rpcUrl: "https://testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
}));

// ─── Imports (real module, resolved through the env transform) ────────────────

import {
  SlippageConfigError,
  DEFAULT_MAX_SLIPPAGE_BPS,
  buildBatchCreateStreamsTx,
  type BatchStreamEntry,
} from "../contracts/payroll_stream";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SlippageConfigError", () => {
  it("throws with a descriptive message containing the offending value", () => {
    const err = new SlippageConfigError(10000);
    expect(err).toBeInstanceOf(TypeError);
    expect(err.name).toBe("SlippageConfigError");
    expect(err.message).toContain("10000");
    expect(err.message).toContain("10");
  });

  it("includes the acceptable range in the message", () => {
    const err = new SlippageConfigError(-1);
    expect(err.message).toMatch(/0.*9999/i);
  });
});

describe("DEFAULT_MAX_SLIPPAGE_BPS", () => {
  it("is 100 (1 %)", () => {
    expect(DEFAULT_MAX_SLIPPAGE_BPS).toBe(100);
  });
});

describe("buildBatchCreateStreamsTx — validation", () => {
  const employer = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const baseEntry: BatchStreamEntry = {
    worker: "GBMISS7BICV3F3M5IVBMK25Y5F5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    rate: BigInt(1000),
    startTs: 1000000,
    endTs: 2000000,
    maxSlippageBps: 100,
  };

  it("rejects maxSlippageBps >= 10000 with SlippageConfigError", async () => {
    await expect(
      buildBatchCreateStreamsTx(employer, [
        { ...baseEntry, maxSlippageBps: 10000 },
      ]),
    ).rejects.toThrow(SlippageConfigError);
  });

  it("accepts maxSlippageBps < 10000", async () => {
    await expect(
      buildBatchCreateStreamsTx(employer, [
        { ...baseEntry, maxSlippageBps: 9999 },
      ]),
    ).resolves.toBeDefined();
  });

  it("rejects negative maxSlippageBps", async () => {
    await expect(
      buildBatchCreateStreamsTx(employer, [
        { ...baseEntry, maxSlippageBps: -1 },
      ]),
    ).rejects.toThrow(SlippageConfigError);
  });

  it("rejects non-integer maxSlippageBps", async () => {
    await expect(
      buildBatchCreateStreamsTx(employer, [
        { ...baseEntry, maxSlippageBps: 100.5 },
      ]),
    ).rejects.toThrow(SlippageConfigError);
  });
});

describe("buildBatchCreateStreamsTx — ScVal encoding", () => {
  const employer = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const baseEntry: BatchStreamEntry = {
    worker: "GBMISS7BICV3F3M5IVBMK25Y5F5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    rate: BigInt(1000),
    startTs: 1000000,
    endTs: 2000000,
    maxSlippageBps: 100,
  };

  beforeEach(() => {
    nativeToScValMock.mockClear();
  });

  it("encodes the given maxSlippageBps — not a hard-coded literal", async () => {
    await buildBatchCreateStreamsTx(employer, [
      { ...baseEntry, maxSlippageBps: 250 },
    ]);

    expect(nativeToScValMock).toHaveBeenCalledWith(250, { type: "u32" });
  });

  it("encodes a different value per entry in a multi-entry batch", async () => {
    await buildBatchCreateStreamsTx(employer, [
      { ...baseEntry, maxSlippageBps: 50 },
      { ...baseEntry, maxSlippageBps: 200 },
    ]);

    expect(nativeToScValMock).toHaveBeenCalledWith(50, { type: "u32" });
    expect(nativeToScValMock).toHaveBeenCalledWith(200, { type: "u32" });
  });
});
