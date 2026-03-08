import axios from "axios";
import { webhookStore, WebhookSubscription } from "./webhooks";
import { metricsManager } from "./metrics";
import { logger } from "./utils/logger";
import { getCurrentCorrelationId } from "./middleware/correlationId";

// Maximum attempts for exponential backoff retries
const MAX_RETRIES = 3;

/**
 * Sends a notification payload to all webhook URLs subscribed to the event type.
 */
export const sendWebhookNotification = async (
  eventType: string,
  payload: any,
) => {
  const subscriptions = Array.from(webhookStore.values()).filter((sub) =>
    sub.events.includes(eventType),
  );

  if (subscriptions.length === 0) {
    return;
  }

  logger.info(
    `[Webhooks] Sending event '${eventType}' to ${subscriptions.length} subscribers...`,
    { eventType, subscriptionCount: subscriptions.length },
  );

  const deliveryPromises = subscriptions.map((sub) =>
    attemptDelivery(sub, eventType, payload, 1),
  );
  await Promise.allSettled(deliveryPromises);
};

/**
 * Attempts delivery to a single webhook, utilizing exponential backoff retry logic on failure.
 */
const attemptDelivery = async (
  sub: WebhookSubscription,
  eventType: string,
  payload: any,
  attemptNumber: number,
): Promise<void> => {
  try {
    const startTime = Date.now();

    // Dynamically override payloads resolving Webhook destinations formatting chat bot payloads automatically
    let outgoingPayload: any = {
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    };

    if (sub.url.includes("discord.com/api/webhooks")) {
      outgoingPayload = {
        embeds: [
          {
            title: `Quipay Notification: ${eventType.toUpperCase()}`,
            description: `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
            color: 0x5865f2,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } else if (sub.url.includes("hooks.slack.com")) {
      outgoingPayload = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `Quipay Notification: ${eventType.toUpperCase()}`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "```" + JSON.stringify(payload, null, 2) + "```",
            },
          },
        ],
      };
    }

    // Add correlation ID to outgoing payload if available
    const correlationId = getCurrentCorrelationId();
    if (correlationId) {
      outgoingPayload.correlationId = correlationId;
    }

    await axios.post(sub.url, outgoingPayload, {
      timeout: 5000, // 5 seconds timeout
      headers: {
        'X-Correlation-ID': correlationId || '',
      },
    });

    const latency = (Date.now() - startTime) / 1000;
    metricsManager.trackTransaction("success", latency);

    logger.info(
      `[Webhooks] ✅ Successfully delivered '${eventType}' to ${sub.url}`,
      { eventType, url: sub.url, latency },
    );
  } catch (error: any) {
    logger.error(
      `[Webhooks] ❌ Failed to deliver '${eventType}' to ${sub.url} (Attempt ${attemptNumber}/${MAX_RETRIES}). Error: ${error.message}`,
      { eventType, url: sub.url, attemptNumber, error },
    );

    if (attemptNumber < MAX_RETRIES) {
      const delayMs = Math.pow(2, attemptNumber) * 1000; // 2s, 4s backoff
      logger.info(
        `[Webhooks] Scheduled retry for ${sub.url} in ${delayMs}ms...`,
        { url: sub.url, delayMs, attemptNumber },
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return attemptDelivery(sub, eventType, payload, attemptNumber + 1);
    } else {
      logger.error(
        `[Webhooks] 🚫 Exhausted retries for ${sub.url}. Delivery permanently failed.`,
        { url: sub.url, eventType },
      );
      metricsManager.trackTransaction("failure", 0);
    }
  }
};
