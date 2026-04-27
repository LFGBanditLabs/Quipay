import {
  instrumentStellarRpc,
  stellarRpcDuration,
  stellarRpcErrorTotal,
} from "../metrics";

describe("instrumentStellarRpc (#933)", () => {
  beforeEach(() => {
    stellarRpcDuration.reset();
    stellarRpcErrorTotal.reset();
  });

  it("records a success observation in the duration histogram", async () => {
    const result = await instrumentStellarRpc(
      "simulateTransaction",
      async () => {
        return { ok: true };
      },
    );

    expect(result).toEqual({ ok: true });

    const metric = await stellarRpcDuration.get();
    const successSamples = metric.values.filter(
      (v) =>
        v.metricName === "stellar_rpc_duration_seconds_count" &&
        v.labels.method === "simulateTransaction" &&
        v.labels.status === "success",
    );
    expect(successSamples.length).toBeGreaterThan(0);
    expect(successSamples[0]?.value).toBe(1);
  });

  it("records a failure observation and increments the error counter", async () => {
    const fail = instrumentStellarRpc("getLatestLedger", async () => {
      throw new TypeError("network down");
    });

    await expect(fail).rejects.toThrow("network down");

    const durationMetric = await stellarRpcDuration.get();
    const errorSamples = durationMetric.values.filter(
      (v) =>
        v.metricName === "stellar_rpc_duration_seconds_count" &&
        v.labels.method === "getLatestLedger" &&
        v.labels.status === "error",
    );
    expect(errorSamples.length).toBeGreaterThan(0);

    const errorCounter = await stellarRpcErrorTotal.get();
    const counterSample = errorCounter.values.find(
      (v) =>
        v.labels.method === "getLatestLedger" && v.labels.error === "TypeError",
    );
    expect(counterSample?.value).toBe(1);
  });

  it("labels error class as 'UnknownError' when a non-Error value is thrown", async () => {
    const fail = instrumentStellarRpc("simulateTransaction", async () => {
      throw "string thrown by some library";
    });

    await expect(fail).rejects.toBe("string thrown by some library");

    const errorCounter = await stellarRpcErrorTotal.get();
    const counterSample = errorCounter.values.find(
      (v) =>
        v.labels.method === "simulateTransaction" &&
        v.labels.error === "UnknownError",
    );
    expect(counterSample?.value).toBe(1);
  });
});
