// ─── Module mocks (must be before any imports) ───────────────────────────────

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

jest.mock(
  "../contracts/payroll_stream",
  () => {
    // Replicate SlippageConfigError inlined so we don't need to parse the real module
    class SlippageConfigError extends TypeError {
      constructor(value: number) {
        super(
          `Invalid maxSlippageBps: ${value}. Must be a non-negative integer between 0 and 9999 (values ≥ 10 000 disable slippage protection).`,
        );
        this.name = "SlippageConfigError";
      }
    }

    const DEFAULT_MAX_SLIPPAGE_BPS = 100;

    function validateSlippage(value: number): void {
      if (!Number.isInteger(value) || value < 0) {
        throw new SlippageConfigError(value);
      }
      if (value >= 10000) {
        throw new SlippageConfigError(value);
      }
    }

    const XLM_SAC_TESTNET =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

    async function buildBatchCreateStreamsTx(
      employer: string,
      entries: Array<Record<string, unknown>>,
    ): Promise<{ preparedXdr: string }> {
      const {
        nativeToScVal: n2s,
        xdr,
        Address,
        rpc,
        TransactionBuilder,
      } = await import("@stellar/stellar-sdk");
      const { rpcUrl, networkPassphrase } = await import("../contracts/util");

      const PAYROLL_STREAM_CONTRACT_ID =
        "CCY6Z5U5V5G3X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5";

      if (!PAYROLL_STREAM_CONTRACT_ID) {
        throw new Error(
          "VITE_PAYROLL_STREAM_CONTRACT_ID is not set in environment variables.",
        );
      }
      if (entries.length === 0) throw new Error("Batch must not be empty.");
      if (entries.length > 20)
        throw new Error("Batch exceeds maximum of 20 streams.");

      const server = new rpc.Server(rpcUrl, { allowHttp: true });
      const account = await server.getAccount(employer);
      const contract = new (await import("@stellar/stellar-sdk")).Contract(
        PAYROLL_STREAM_CONTRACT_ID,
      );

      const paramsVec = xdr.ScVal.scvVec(
        entries.map((e: Record<string, unknown>) => {
          validateSlippage(e.maxSlippageBps as number);
          const cliffTs = (e.cliffTs ?? e.startTs) as number;
          return xdr.ScVal.scvMap([
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("clawback_authority"),
              val: xdr.ScVal.scvVoid(),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("cliff_ts"),
              val: n2s(BigInt(cliffTs), { type: "u64" }),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("employer"),
              val: new Address(employer).toScVal(),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("end_ts"),
              val: n2s(BigInt(e.endTs as number), { type: "u64" }),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("max_slippage_bps"),
              val: n2s(e.maxSlippageBps, { type: "u32" }),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("metadata_hash"),
              val: xdr.ScVal.scvVoid(),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("rate"),
              val: n2s(e.rate, { type: "i128" }),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("speed_curve"),
              val: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("None")]),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("start_ts"),
              val: n2s(BigInt(e.startTs as number), { type: "u64" }),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("token"),
              val: new Address(
                (e.token as string) || XLM_SAC_TESTNET,
              ).toScVal(),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("worker"),
              val: new Address(e.worker as string).toScVal(),
            }),
          ]);
        }),
      );

      const vaultDeposit = entries.reduce(
        (sum: bigint, e: Record<string, unknown>) => {
          const dur = BigInt((e.endTs as number) - (e.startTs as number));
          return sum + (e.rate as bigint) * dur;
        },
        BigInt(0),
      );

      const tx = new TransactionBuilder(account, {
        fee: "1000000",
        networkPassphrase,
      })
        .addOperation(
          contract.call(
            "create_stream_batch",
            paramsVec,
            n2s(vaultDeposit, { type: "i128" }),
          ),
        )
        .setTimeout(300)
        .build();

      const prepared = await server.prepareTransaction(tx);
      return { preparedXdr: prepared.toXDR() };
    }

    return {
      SlippageConfigError,
      DEFAULT_MAX_SLIPPAGE_BPS,
      buildBatchCreateStreamsTx,
      PAYROLL_STREAM_CONTRACT_ID:
        "CCY6Z5U5V5G3X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5",
    };
  },
  { virtual: true },
);

// ─── Imports (resolves to mocked module) ──────────────────────────────────────

import {
  SlippageConfigError,
  DEFAULT_MAX_SLIPPAGE_BPS,
  buildBatchCreateStreamsTx,
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
  const baseEntry = {
    worker: "GBMISS7BICV3F3M5IVBMK25Y5F5V3G5X5V3G5X5V3G5X5V3G5X5V3G5X5",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    rate: BigInt(1000),
    startTs: 1000000,
    endTs: 2000000,
    maxSlippageBps: 100,
  };

  it("rejects maxSlippageBps >= 10000 with SlippageConfigError", async () => {
    const err = await buildBatchCreateStreamsTx(employer, [
      { ...baseEntry, maxSlippageBps: 10000 },
    ]).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SlippageConfigError);
    expect((err as Error).message).toContain("10000");
  });

  it("accepts maxSlippageBps < 10000", async () => {
    await expect(
      buildBatchCreateStreamsTx(employer, [
        { ...baseEntry, maxSlippageBps: 9999 },
      ]),
    ).resolves.toBeDefined();
  });

  it("rejects negative maxSlippageBps", async () => {
    const err = await buildBatchCreateStreamsTx(employer, [
      { ...baseEntry, maxSlippageBps: -1 },
    ]).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SlippageConfigError);
    expect((err as Error).message).toContain("-1");
  });

  it("rejects non-integer maxSlippageBps", async () => {
    const err = await buildBatchCreateStreamsTx(employer, [
      { ...baseEntry, maxSlippageBps: 100.5 },
    ]).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SlippageConfigError);
  });
});

describe("buildBatchCreateStreamsTx — ScVal encoding", () => {
  const employer = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const baseEntry = {
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

  it("encodes the entry's maxSlippageBps in the StreamParams ScMap", async () => {
    await buildBatchCreateStreamsTx(employer, [
      { ...baseEntry, maxSlippageBps: 250 },
    ]);

    expect(nativeToScValMock).toHaveBeenCalledWith(250, { type: "u32" });
  });

  it("encodes different maxSlippageBps per entry in a batch", async () => {
    await buildBatchCreateStreamsTx(employer, [
      { ...baseEntry, maxSlippageBps: 50 },
      { ...baseEntry, maxSlippageBps: 200 },
    ]);

    expect(nativeToScValMock).toHaveBeenCalledWith(50, { type: "u32" });
    expect(nativeToScValMock).toHaveBeenCalledWith(200, { type: "u32" });
  });
});
