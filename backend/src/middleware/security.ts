import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { verifyKey } from "discord-interactions";
import { secretsBootstrap } from "../services/secretsBootstrap";

/**
 * Extended Request interface to include rawBody
 */
export interface SecureRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Middleware to verify Discord interaction signatures.
 * Discord sends signatures in 'x-signature-ed25519' and 'x-signature-timestamp' headers.
 */
export const verifyDiscordSignature = (
  req: SecureRequest,
  res: Response,
  next: NextFunction,
) => {
  const publicKey = secretsBootstrap.getSecret("DISCORD_PUBLIC_KEY");

  if (!publicKey) {
    console.error("[Security] ❌ DISCORD_PUBLIC_KEY not configured");
    return res.status(500).json({ error: "Security configuration missing" });
  }

  const signature = req.get("X-Signature-Ed25519");
  const timestamp = req.get("X-Signature-Timestamp");

  if (!signature || !timestamp || !req.rawBody) {
    return res.status(401).json({ error: "Missing signature headers or body" });
  }

  try {
    const isValidRequest = verifyKey(
      req.rawBody,
      signature,
      timestamp,
      publicKey,
    );

    if (!isValidRequest) {
      console.warn("[Security] ⚠️ Invalid Discord signature");
      return res.status(401).json({ error: "Invalid request signature" });
    }

    next();
  } catch (error) {
    console.error("[Security] Error verifying Discord signature:", error);
    return res.status(401).json({ error: "Signature verification failed" });
  }
};

/**
 * Middleware to verify Slack request signatures.
 * Slack uses HMAC-SHA256 with a shared secret.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export const verifySlackSignature = (
  req: SecureRequest,
  res: Response,
  next: NextFunction,
) => {
  const signingSecret = secretsBootstrap.getSecret("SLACK_SIGNING_SECRET");

  if (!signingSecret) {
    console.error("[Security] ❌ SLACK_SIGNING_SECRET not configured");
    return res.status(500).json({ error: "Security configuration missing" });
  }

  const signature = req.get("X-Slack-Signature");
  const timestamp = req.get("X-Slack-Request-Timestamp");

  if (!signature || !timestamp || !req.rawBody) {
    return res
      .status(401)
      .json({ error: "Missing Slack signature headers or body" });
  }

  // Prevent replay attacks (5 minute window)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp, 10)) > 300) {
    console.warn("[Security] ⚠️ Slack request timestamp too old");
    return res.status(401).json({ error: "Request expired" });
  }

  try {
    const sigBasestring = `v0:${timestamp}:${req.rawBody.toString("utf8")}`;
    const hmac = crypto.createHmac("sha256", signingSecret);
    const mySignature = `v0=${hmac.update(sigBasestring).digest("hex")}`;

    // Constant-time comparison to prevent timing attacks
    if (
      crypto.timingSafeEqual(
        Buffer.from(mySignature, "utf8"),
        Buffer.from(signature, "utf8"),
      )
    ) {
      next();
    } else {
      console.warn("[Security] ⚠️ Invalid Slack signature");
      return res.status(401).json({ error: "Invalid request signature" });
    }
  } catch (error) {
    console.error("[Security] Error verifying Slack signature:", error);
    return res.status(401).json({ error: "Signature verification failed" });
  }
};
