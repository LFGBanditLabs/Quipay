/**
 * Tests for src/notifier/notifier.ts
 *
 * We mock axios so no real HTTP calls are made.
 */

jest.mock("axios");
import axios from "axios";
import { sendTreasuryAlert } from "../../src/notifier/notifier";

const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("sendTreasuryAlert", () => {
  it("no-ops when ALERT_WEBHOOK_URL is not set", async () => {
    const original = process.env.ALERT_WEBHOOK_URL;
    delete process.env.ALERT_WEBHOOK_URL;

    await sendTreasuryAlert("EMPLOYER_A", 1000, 5000, 3.5, 5_000_000);
    expect(mockedPost).not.toHaveBeenCalled();

    process.env.ALERT_WEBHOOK_URL = original;
  });

  it("POSTs correct payload when ALERT_WEBHOOK_URL is set", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://example.com/hook";
    mockedPost.mockResolvedValueOnce({ status: 200 } as any);

    await sendTreasuryAlert(
      "EMPLOYER_B",
      1_000_000,
      10_000_000,
      2.5,
      5_000_000,
    );

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [url, body, opts] = mockedPost.mock.calls[0];
    expect(url).toBe("https://example.com/hook");
    expect(body).toMatchObject({
      event: "treasury_low_balance",
      employer: "EMPLOYER_B",
      balance: 1_000_000,
      liabilities: 10_000_000,
      runway_days: 2.5,
      threshold: 5_000_000,
    });
    expect(body).toHaveProperty("timestamp");
    expect(opts).toMatchObject({ timeout: 5_000 });

    delete process.env.ALERT_WEBHOOK_URL;
  });

  it("handles axios errors gracefully without throwing", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://example.com/hook";
    mockedPost.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw
    await expect(
      sendTreasuryAlert("EMPLOYER_C", 500, 20_000, 0.5, 5_000_000),
    ).resolves.toBeUndefined();

    delete process.env.ALERT_WEBHOOK_URL;
  });

  it("sends null runway_days when liabilities=0 (unlimited runway)", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://example.com/hook";
    mockedPost.mockResolvedValueOnce({ status: 200 } as any);

    await sendTreasuryAlert("EMPLOYER_D", 9_000_000, 0, null, 5_000_000);

    const [, body] = mockedPost.mock.calls[0];
    expect(body.runway_days).toBeNull();

    delete process.env.ALERT_WEBHOOK_URL;
  });
});
