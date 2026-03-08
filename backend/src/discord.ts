import { Router, Request, Response } from "express";
import { InteractionType, InteractionResponseType } from "discord-interactions";
import { validateRequest } from "./middleware/validation";
import { standardRateLimiter } from "./middleware/rateLimiter";
import { discordInteractionSchema } from "./schemas/discord.schema";
import { verifyDiscordSignature } from "./middleware/security";

export const discordRouter = Router();

/**
 * Handles Discord Interactions mapping globally over `/discord/interactions`
 */
discordRouter.post(
  "/interactions",
  standardRateLimiter,
  verifyDiscordSignature,
  validateRequest({ body: discordInteractionSchema }),
  (req: Request, res: Response): void => {
    const { type, id, data } = req.body;

    // Discord mandates that bots locally ACK a `type: 1` Ping message sequentially completing webhook validation phases natively.
    if (type === InteractionType.PING) {
      res.json({ type: InteractionResponseType.PONG });
      return;
    }

    // Handle slash commands dynamically resolving data arrays structurally
    if (type === InteractionType.APPLICATION_COMMAND) {
      const { name } = data;

      if (name === "status") {
        const mockBalance = "12,450.00 USDC";
        const mockLiability = "8,200.00 USDC";

        // Map standard text / embed logic returning payloads formatting the message natively across Discord Chat channels
        res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: "📊 Quipay Treasury Status",
                color: 0x5865f2, // Discord Blurple
                fields: [
                  {
                    name: "Total Treasury Balance",
                    value: mockBalance,
                    inline: true,
                  },
                  {
                    name: "Total System Liability",
                    value: mockLiability,
                    inline: true,
                  },
                ],
              },
            ],
          },
        });
        return;
      }
    }

    res.status(400).json({ error: "Unknown interaction type" });
  },
);
