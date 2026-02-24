import { AIGateway } from "../services/aiGateway";
import { jest } from "@jest/globals";
import OpenAI from "openai";

// Mock OpenAI
jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: jest.fn<any>().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    function: "create_stream",
                    params: {
                      worker: "Alice",
                      token: "USDC",
                      amount: "500",
                      duration_seconds: 2592000,
                      start_ts: 1700000000,
                    },
                    confidence: 0.95,
                    reasoning: "User wants to pay Alice 500 USDC over a month.",
                    needs_confirmation: true,
                  }),
                },
              },
            ],
          }),
        },
      },
    };
  });
});

describe("AIGateway", () => {
  let aiGateway: AIGateway;
  let mockOpenAI: any;

  beforeEach(() => {
    mockOpenAI = new OpenAI();
    aiGateway = new AIGateway(mockOpenAI);
  });

  test("should parse a valid payment command", async () => {
    const result = await aiGateway.parseCommand(
      "Pay Alice 500 USDC over 1 month",
    );

    expect(result.function).toBe("create_stream");
    expect(result.params.worker).toBe("Alice");
    expect(result.params.amount).toBe("500");
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  test("verifyAndRefine should handle missing parameters", async () => {
    const incompleteResponse: any = {
      function: "create_stream",
      params: { worker: "Alice" },
      confidence: 1.0,
      reasoning: "Incomplete",
      needs_confirmation: false,
    };

    const refined = await aiGateway.verifyAndRefine(incompleteResponse);

    expect(refined.confidence).toBeLessThan(1.0);
    expect(refined.needs_confirmation).toBe(true);
  });

  test("should handle ambiguous commands with unknown function", async () => {
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              function: "unknown",
              params: {},
              confidence: 0.2,
              reasoning: "Too vague.",
              needs_confirmation: false,
            }),
          },
        },
      ],
    });

    const result = await aiGateway.parseCommand("Hello");
    expect(result.function).toBe("unknown");
    expect(result.confidence).toBeLessThan(0.4);
  });
});
