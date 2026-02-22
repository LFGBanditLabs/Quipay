import { NonceManager } from "../services/nonceManager";
import { Horizon } from "@stellar/stellar-sdk";
import { jest } from "@jest/globals";

// Mock Horizon Server
jest.mock("@stellar/stellar-sdk", () => {
  return {
    Horizon: {
      Server: jest.fn().mockImplementation(() => {
        return {
          loadAccount: jest.fn<any>().mockResolvedValue({
            sequence: "100",
          }),
        };
      }),
    },
  };
});

describe("NonceManager", () => {
  let nonceManager: NonceManager;
  const testAccountId =
    "GAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

  beforeEach(() => {
    nonceManager = new NonceManager(testAccountId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should initialize and fetch the current sequence limit", async () => {
    await nonceManager.initialize();
    const state = nonceManager.getCurrentState();
    expect(state.currentSequence).toBe("100");
    expect(state.availableNonces).toEqual([]);
  });

  test("getNonce should increment sequence sequentially", async () => {
    const nonce1 = await nonceManager.getNonce();
    const nonce2 = await nonceManager.getNonce();
    const nonce3 = await nonceManager.getNonce();

    expect(nonce1).toBe("101");
    expect(nonce2).toBe("102");
    expect(nonce3).toBe("103");
  });

  test("should handle concurrent getNonce requests perfectly sequentially", async () => {
    const numRequests = 50;

    // Fire 50 requests at the exact same time
    const promises = Array.from({ length: numRequests }).map(() =>
      nonceManager.getNonce(),
    );
    const nonces = await Promise.all(promises);

    // Verify we got 50 distinct sequential numbers starting from 101 to 150
    const expectedNonces = Array.from({ length: numRequests }).map((_, i) =>
      (101 + i).toString(),
    );
    expect(nonces).toEqual(expectedNonces);
  });

  test("should reuse released nonces before incrementing the main sequence", async () => {
    const _n1 = await nonceManager.getNonce(); // 101
    const _n2 = await nonceManager.getNonce(); // 102
    const _n3 = await nonceManager.getNonce(); // 103

    // Simulate transaction 102 failing due to network error and releasing the nonce
    nonceManager.releaseNonce("102");

    const state1 = nonceManager.getCurrentState();
    expect(state1.availableNonces).toEqual(["102"]);
    expect(state1.currentSequence).toBe("103");

    // The next request should be given 102, not 104
    const n4 = await nonceManager.getNonce();
    expect(n4).toBe("102");

    // And the request after that goes back to incrementing the main sequence
    const n5 = await nonceManager.getNonce();
    expect(n5).toBe("104");
  });

  test("should sort released nonces if multiple fail to ensure lowest gap is filled first", async () => {
    await nonceManager.getNonce(); // 101
    await nonceManager.getNonce(); // 102
    await nonceManager.getNonce(); // 103
    await nonceManager.getNonce(); // 104

    // 104 fails first, then 102 fails
    nonceManager.releaseNonce("104");
    nonceManager.releaseNonce("102");

    // Next requests should get 102, then 104
    expect(await nonceManager.getNonce()).toBe("102");
    expect(await nonceManager.getNonce()).toBe("104");
    expect(await nonceManager.getNonce()).toBe("105");
  });
});
