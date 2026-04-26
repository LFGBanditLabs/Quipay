import {
  __resetJobStoreForTest,
  createEnrichmentJob,
  getJob,
  setJobError,
  setJobResult,
} from "../services/aiJobStore";

describe("aiJobStore (#929)", () => {
  beforeEach(() => {
    __resetJobStoreForTest();
  });

  it("creates jobs in 'pending' state with a unique id", () => {
    const a = createEnrichmentJob();
    const b = createEnrichmentJob();

    expect(a.status).toBe("pending");
    expect(b.status).toBe("pending");
    expect(a.id).not.toBe(b.id);
    expect(getJob(a.id)?.status).toBe("pending");
  });

  it("setJobResult marks the job 'succeeded' and stores the result", () => {
    const job = createEnrichmentJob();
    setJobResult(job.id, { intent: "transfer" });

    const updated = getJob(job.id);
    expect(updated?.status).toBe("succeeded");
    expect(updated?.result).toEqual({ intent: "transfer" });
    expect(updated?.error).toBeUndefined();
  });

  it("setJobError marks the job 'failed' / 'timed_out' with a message", () => {
    const job = createEnrichmentJob();
    setJobError(job.id, "timed_out", "AI gateway timed out after 30000ms");

    const updated = getJob(job.id);
    expect(updated?.status).toBe("timed_out");
    expect(updated?.error).toBe("AI gateway timed out after 30000ms");
  });

  it("returns undefined for unknown job ids", () => {
    expect(getJob("does-not-exist")).toBeUndefined();
  });

  it("setJobResult on unknown id is a no-op", () => {
    expect(() => setJobResult("missing", { foo: "bar" })).not.toThrow();
    expect(getJob("missing")).toBeUndefined();
  });
});
