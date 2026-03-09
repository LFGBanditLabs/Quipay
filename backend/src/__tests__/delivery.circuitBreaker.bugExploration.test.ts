/**
 * Bug Condition Exploration Test for Circuit Breaker Delivery Fix
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bug exists:
 * - Discord/Slack webhook deliveries bypass circuit breaker metrics
 * - Slow webhook responses are NOT interrupted by circuit breaker timeout
 */

jest.mock("axios");
jest.mock("../db/pool", () => ({
  getPool: jest.fn(() => ({})),
}));
jest.mock("../db/queries", () => ({
  createWebhookOutboundEvent: jest.fn().mockResolvedValue(undefined),
  getWebhookOutboundEventById: jest.fn(),
  insertWebhookOutboundAttempt: jest.fn().mockResolvedValue(undefined),
  updateWebhookOutboundEventAfterAttempt: jest
    .fn()
    .mockResolvedValue(undefined),
}));

import axios from "axios";
import { sendWebhookNotification } from "../delivery";
import { webhookStore } from "../webhooks";
import { metricsManager } from "../metrics";

const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;

describe("Bug Condition Exploration: Circuit Breaker Bypass", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webhookStore.clear();
  });

  describe("Property 1: Bug Condition - Circuit Breaker Bypass", () => {
    it("EXPECTED TO FAIL: Discord webhook deliveries should use circuit breaker and appear in metrics", async () => {
      // Setup Discord webhook subscription
      webhookStore.set("discord-sub", {
        id: "discord-sub",
        ownerId: "merchant-1",
        url: "https://discord.com/api/webhooks/123456789/abcdefghijk",
        events: ["payment.completed"],
        createdAt: new Date(),
      });

      // Mock successful Discord response
      mockedPost.mockResolvedValueOnce({
        status: 204,
        data: "",
      } as any);

      // Send webhook notification
      await sendWebhookNotification("payment.completed", { amount: 100 });

      // Get circuit breaker metrics after delivery
      const metricsAfter = await metricsManager.register.metrics();

      // EXPECTED BEHAVIOR: Circuit breaker metrics should show activity for "discord" service
      // BUG: On unfixed code, this will FAIL because direct axios.post() bypasses circuit breaker
      expect(metricsAfter).toContain('service="http:discord"');
      expect(metricsAfter).toMatch(/quipay_circuit_breaker_events_total.*service="http:discord".*event="success"/);
    });

    it("EXPECTED TO FAIL: Slack webhook deliveries should use circuit breaker and appear in metrics", async () => {
      // Setup Slack webhook subscription
      webhookStore.set("slack-sub", {
        id: "slack-sub",
        ownerId: "merchant-2",
        url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX",
        events: ["payment.completed"],
        createdAt: new Date(),
      });

      // Mock successful Slack response
      mockedPost.mockResolvedValueOnce({
        status: 200,
        data: { ok: true },
      } as any);

      // Send webhook notification
      await sendWebhookNotification("payment.completed", { amount: 200 });

      // Get circuit breaker metrics
      const metrics = await metricsManager.register.metrics();

      // EXPECTED BEHAVIOR: Circuit breaker metrics should show activity for "slack" service
      // BUG: On unfixed code, this will FAIL because direct axios.post() bypasses circuit breaker
      expect(metrics).toContain('service="http:slack"');
      expect(metrics).toMatch(/quipay_circuit_breaker_events_total.*service="http:slack".*event="success"/);
    });

    it("EXPECTED TO FAIL: Generic webhook URLs should use circuit breaker with http_external classification", async () => {
      // Setup generic webhook subscription
      webhookStore.set("generic-sub", {
        id: "generic-sub",
        ownerId: "merchant-3",
        url: "https://example.com/webhook",
        events: ["payment.completed"],
        createdAt: new Date(),
      });

      // Mock successful response
      mockedPost.mockResolvedValueOnce({
        status: 200,
        data: { received: true },
      } as any);

      // Send webhook notification
      await sendWebhookNotification("payment.completed", { amount: 300 });

      // Get circuit breaker metrics
      const metrics = await metricsManager.register.metrics();

      // EXPECTED BEHAVIOR: Circuit breaker metrics should show activity for "http_external" service
      // BUG: On unfixed code, this will FAIL because direct axios.post() bypasses circuit breaker
      expect(metrics).toContain('service="http:http_external"');
      expect(metrics).toMatch(/quipay_circuit_breaker_events_total.*service="http:http_external".*event="success"/);
    });

    it("EXPECTED TO FAIL: Slow webhook responses should be interrupted by circuit breaker timeout", async () => {
      // Setup webhook subscription
      webhookStore.set("slow-sub", {
        id: "slow-sub",
        ownerId: "merchant-4",
        url: "https://slow-service.com/webhook",
        events: ["payment.completed"],
        createdAt: new Date(),
      });

      // Mock slow response (10 seconds delay)
      mockedPost.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ status: 200, data: { ok: true } } as any);
          }, 10000);
        });
      });

      const startTime = Date.now();
      
      // Send webhook notification
      await sendWebhookNotification("payment.completed", { amount: 400 });

      const duration = Date.now() - startTime;

      // EXPECTED BEHAVIOR: Circuit breaker should timeout after ~8000ms (CB_TIMEOUT_MS default)
      // BUG: On unfixed code, this will FAIL because direct axios.post() waits for full axios timeout (5000ms)
      // or the full 10s response time, not the circuit breaker timeout
      expect(duration).toBeLessThan(9000); // Should timeout around 8000ms, not wait 10000ms

      // Check that timeout event was recorded in metrics
      const metrics = await metricsManager.register.metrics();
      expect(metrics).toMatch(/quipay_circuit_breaker_events_total.*event="timeout"/);
    }, 15000); // Increase test timeout to 15s

    it("EXPECTED TO FAIL: Multiple failures should trigger circuit breaker to open state", async () => {
      // Setup webhook subscription
      webhookStore.set("failing-sub", {
        id: "failing-sub",
        ownerId: "merchant-5",
        url: "https://discord.com/api/webhooks/999/failing",
        events: ["payment.completed"],
        createdAt: new Date(),
      });

      // Mock multiple failures (5xx errors)
      mockedPost.mockResolvedValue({
        status: 503,
        data: { error: "Service Unavailable" },
      } as any);

      // Send multiple webhook notifications to trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        await sendWebhookNotification("payment.completed", { amount: i });
      }

      // Get circuit breaker metrics
      const metrics = await metricsManager.register.metrics();

      // EXPECTED BEHAVIOR: Circuit breaker should open after threshold failures
      // BUG: On unfixed code, this will FAIL because direct axios.post() bypasses circuit breaker
      // so the circuit never opens and no "open" event is recorded
      expect(metrics).toMatch(/quipay_circuit_breaker_events_total.*service="http:discord".*event="open"/);
      expect(metrics).toMatch(/quipay_circuit_breaker_state.*service="http:discord".*\s+1/); // State = 1 (open)
    });
  });
});
