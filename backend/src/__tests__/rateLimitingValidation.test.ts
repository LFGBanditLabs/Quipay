import { describe, it, expect, beforeEach } from "@jest/globals";
import { createProblemDetails } from "../middleware/errorHandler";
import {
  webhookRegistrationSchema,
  webhookIdSchema,
} from "../schemas/webhooks.schema";
import {
  aiParseCommandSchema,
  aiExecuteCommandSchema,
} from "../schemas/ai.schema";
import { slackCommandSchema } from "../schemas/slack.schema";
import { discordInteractionSchema } from "../schemas/discord.schema";

describe("Payload Validation Schemas", () => {
  describe("Webhook Registration Schema", () => {
    it("should validate correct webhook registration", () => {
      const validData = {
        url: "https://example.com/webhook",
        events: ["withdrawal", "new_stream"],
      };

      const result = webhookRegistrationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid URL", () => {
      const invalidData = {
        url: "not-a-url",
        events: ["withdrawal"],
      };

      const result = webhookRegistrationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject URL that is too long", () => {
      const invalidData = {
        url: "https://example.com/" + "a".repeat(3000),
        events: ["withdrawal"],
      };

      const result = webhookRegistrationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid event types", () => {
      const invalidData = {
        url: "https://example.com/webhook",
        events: ["invalid_event"],
      };

      const result = webhookRegistrationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should allow optional events field", () => {
      const validData = {
        url: "https://example.com/webhook",
      };

      const result = webhookRegistrationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("Webhook ID Schema", () => {
    it("should validate correct UUID", () => {
      const validData = {
        id: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = webhookIdSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const invalidData = {
        id: "not-a-uuid",
      };

      const result = webhookIdSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("AI Parse Command Schema", () => {
    it("should validate correct command", () => {
      const validData = {
        command: "Pay Alice 100 USDC",
      };

      const result = aiParseCommandSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject empty command", () => {
      const invalidData = {
        command: "",
      };

      const result = aiParseCommandSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject command that is too long", () => {
      const invalidData = {
        command: "a".repeat(1001),
      };

      const result = aiParseCommandSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject command with script tags", () => {
      const invalidData = {
        command: "<script>alert('xss')</script>",
      };

      const result = aiParseCommandSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject command with javascript protocol", () => {
      const invalidData = {
        command: "javascript:alert('xss')",
      };

      const result = aiParseCommandSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("AI Execute Command Schema", () => {
    it("should validate correct execution request", () => {
      const validData = {
        intentId: "intent-123",
        confirmed: true,
      };

      const result = aiExecuteCommandSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject missing intentId", () => {
      const invalidData = {
        confirmed: true,
      };

      const result = aiExecuteCommandSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject non-boolean confirmed", () => {
      const invalidData = {
        intentId: "intent-123",
        confirmed: "yes",
      };

      const result = aiExecuteCommandSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Slack Command Schema", () => {
    it("should validate correct Slack command", () => {
      const validData = {
        text: "status",
        user_id: "U123456",
        channel_id: "C123456",
      };

      const result = slackCommandSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject text that is too long", () => {
      const invalidData = {
        text: "a".repeat(501),
      };

      const result = slackCommandSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should allow empty text with default", () => {
      const validData = {};

      const result = slackCommandSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe("");
      }
    });
  });

  describe("Discord Interaction Schema", () => {
    it("should validate correct Discord interaction", () => {
      const validData = {
        id: "123456789",
        type: 2,
        token: "interaction-token",
        data: {
          name: "status",
        },
      };

      const result = discordInteractionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid interaction type", () => {
      const invalidData = {
        id: "123456789",
        type: 99,
        token: "interaction-token",
      };

      const result = discordInteractionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject missing required fields", () => {
      const invalidData = {
        id: "123456789",
      };

      const result = discordInteractionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe("RFC 7807 Problem Details", () => {
  it("should create proper problem details structure", () => {
    const problem = createProblemDetails({
      type: "validation-error",
      title: "Bad Request",
      status: 400,
      detail: "Request validation failed",
      instance: "/api/test",
    });

    expect(problem).toHaveProperty("type");
    expect(problem).toHaveProperty("title");
    expect(problem).toHaveProperty("status");
    expect(problem).toHaveProperty("detail");
    expect(problem).toHaveProperty("instance");
    expect(problem.type).toContain("https://");
    expect(problem.status).toBe(400);
  });

  it("should include additional properties", () => {
    const problem = createProblemDetails({
      type: "validation-error",
      title: "Bad Request",
      status: 400,
      detail: "Request validation failed",
      instance: "/api/test",
      errors: [{ field: "email", message: "Invalid email" }],
    });

    expect(problem).toHaveProperty("errors");
    expect(problem.errors).toHaveLength(1);
  });
});
