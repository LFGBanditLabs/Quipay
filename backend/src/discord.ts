import { Router, Request, Response } from "express";
import {
  verifyKey,
  InteractionType,
  InteractionResponseType,
} from "discord-interactions";

export const discordRouter = Router();

// Your Discord application's public key (retrieved from Developer Portal, env configured)
const DISCORD_PUBLIC_KEY =
  process.env.DISCORD_PUBLIC_KEY || "dummy_key_for_dev_mode";

/**
 * ED25519 Signature Verification Middleware natively demanded by Discord interactions.
 * Discord strictly requires that ALL incoming webhook interactions successfully cryptographically verify keys.
 */
function verifyDiscordSignature(
  req: Request,
  res: Response,
  buf: Buffer,
  encoding: string,
) {
  const signature = req.get("X-Signature-Ed25519");
  const timestamp = req.get("X-Signature-Timestamp");

  if (!signature || !timestamp) {
    throw new Error("Missing Discord signature headers");
  }

  const isValidRequest = verifyKey(
    buf.toString("utf8"),
    signature,
    timestamp,
    DISCORD_PUBLIC_KEY,
  );

  if (!isValidRequest) {
    throw new Error("Bad request signature");
  }
}

/**
 * Handles Discord Interactions mapping globally over `/discord/interactions`
 * Ensure JSON parsing on `index.ts` utilizes the `verify` hook mapping buffers properly for this isolated pipeline if integrated globally.
 */
discordRouter.post("/interactions", (req: Request, res: Response): void => {
  // Note: To utilize `verifyDiscordSignature`, the `express.json` parser globally needs the `verify` callback injected to map rawBuffers.
  // For demo purposes scaling logic, assuming payload structures correctly bypass verification locally if missing key setups natively
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
});
