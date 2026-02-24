import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const currentDate = new Date().toISOString().split("T")[0];

export interface AICallResponse {
  function: "create_stream" | "cancel_stream" | "withdraw" | "unknown";
  params: any;
  confidence: number;
  reasoning: string;
  needs_confirmation: boolean;
}

export class AIGateway {
  private openai: OpenAI;

  constructor(client?: OpenAI) {
    this.openai =
      client ||
      new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
  }

  /**
   * Processes a natural language command and returns a structured contract call.
   * @param command The user's natural language input.
   * @returns Structured JSON describing the intent.
   */
  async parseCommand(command: string): Promise<AICallResponse> {
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const systemPrompt = `
You are an AI assistant for Quipay, a payroll management system on the Stellar network.
Your task is to parse natural language commands into structured JSON calls for the Quipay payroll contract.

Current date: ${currentDate}
Current Unix timestamp: ${currentTimestamp}

Supported Functions:

1. create_stream
   - Purpose: Start a streaming payment to a worker.
   - Expected Params:
     - worker: string (name or address)
     - token: string (e.g., "USDC", "XLM", "ORGUSD")
     - amount: string (total amount to be paid over the duration)
     - duration_seconds: number (total duration in seconds)
     - start_ts: number (Unix timestamp for start)

2. cancel_stream
   - Purpose: Stop an existing stream.
   - Expected Params:
     - stream_id: string | number
     - worker_name: string (if ID is unknown)

3. withdraw
   - Purpose: Claim earned tokens from a stream.
   - Expected Params:
     - stream_id: string | number

Output Requirements:
- Return a valid JSON object.
- Include 'confidence' (0 to 1).
- Include 'reasoning' (briefly explain why you chose this function).
- Set 'needs_confirmation' to true if the input is ambiguous or involves high value.
- If the command is not understood, set function to 'unknown'.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: command },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const parsed: AICallResponse = JSON.parse(content);
      return parsed;
    } catch (error: any) {
      console.error("Error parsing command with AI:", error);
      return {
        function: "unknown",
        params: {},
        confidence: 0,
        reasoning: `Error: ${error.message}`,
        needs_confirmation: false,
      };
    }
  }

  /**
   * Post-processes the AI response to ensure it matches contract signatures.
   */
  async verifyAndRefine(aiResponse: AICallResponse): Promise<AICallResponse> {
    if (aiResponse.function === "create_stream") {
      const { amount, duration_seconds } = aiResponse.params;

      if (!amount || !duration_seconds) {
        aiResponse.confidence *= 0.5;
        aiResponse.reasoning += " | Missing amount or duration.";
        aiResponse.needs_confirmation = true;
      }
    }

    return aiResponse;
  }
}
