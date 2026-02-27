import { Router, Request, Response } from "express";
import { AIGateway } from "./services/aiGateway";

export const aiRouter = Router();
const aiGateway = new AIGateway();

/**
 * @api {post} /ai/parse Parse a natural language command
 * @apiDescription Translates conversational text into a structured contract call.
 */
aiRouter.post("/parse", async (req: Request, res: Response) => {
  const { command } = req.body;

  if (!command || typeof command !== "string") {
    return res
      .status(400)
      .json({ error: "A valid command string is required." });
  }

  try {
    let result = await aiGateway.parseCommand(command);
    result = await aiGateway.verifyAndRefine(result);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /ai/execute Execute (or confirm) an AI-parsed command
 * @apiDescription In a real implementation, this would trigger the actual on-chain transaction.
 * For now, it serves as a placeholder for the confirmation flow.
 */
aiRouter.post("/execute", (req: Request, res: Response) => {
  const { intentId, confirmed } = req.body;

  if (!confirmed) {
    return res.json({
      status: "cancelled",
      message: "Transaction aborted by user.",
    });
  }

  // Placeholder for transaction execution logic
  res.json({
    status: "success",
    message: "Command sent to execution engine.",
    txHash: "SIMULATED_TX_HASH_" + Math.random().toString(36).substring(7),
  });
});
