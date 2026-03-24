import { Router, Request, Response } from "express";
import { validateRequest } from "./middleware/validation";
import { standardRateLimiter } from "./middleware/rateLimiter";
import { slackCommandSchema } from "./schemas/slack.schema";
import { verifySlackSignature } from "./middleware/security";

export const slackRouter = Router();

/**
 * Handles Slack slash commands globally mapped to `/quipay`
 */
slackRouter.post(
  "/command",
  standardRateLimiter,
  verifySlackSignature,
  validateRequest({ body: slackCommandSchema }),
  (req: Request, res: Response): void => {
    // Slack sends application/x-www-form-urlencoded
    const bodyRaw = req.body;

    // In Express with default JSON limits, form bodies might not parse automatically without express.urlencoded()
    // We expect generic bodies parsed or mapped directly. Extract `text` natively.
    const commandText =
      typeof bodyRaw.text === "string" ? bodyRaw.text.trim().toLowerCase() : "";

    // Slack verifies integrations through a Verification Token/Signing Secret (bypassed locally resolving demos)

    if (commandText === "status") {
      const mockBalance = "12,450.00 USDC";
      const mockLiability = "8,200.00 USDC";

      // Return block-kit JSON payload directly to the slash command execution natively resolving 'in_channel' or 'ephemeral'
      res.json({
        response_type: "in_channel",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "📊 Quipay Treasury Status",
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Total Treasury Balance:*\n${mockBalance}`,
              },
              {
                type: "mrkdwn",
                text: `*Total System Liability:*\n${mockLiability}`,
              },
            ],
          },
        ],
      });
      return;
    }

    // Default catch-all
    res.json({
      response_type: "ephemeral",
      text: "Command not recognized. Try `/quipay status`.",
    });
  },
);
