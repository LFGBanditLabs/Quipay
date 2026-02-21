import axios from "axios";
import { webhookStore, WebhookSubscription } from "./webhooks";
import { metricsManager } from "./metrics";

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

  console.log(
    `[Webhooks] Sending event '${eventType}' to ${subscriptions.length} subscribers...`,
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

    await axios.post(sub.url, outgoingPayload, {
      timeout: 5000, // 5 seconds timeout
    });

    const latency = (Date.now() - startTime) / 1000;
    metricsManager.trackTransaction("success", latency);

    console.log(
      `[Webhooks] ✅ Successfully delivered '${eventType}' to ${sub.url}`,
    );
  } catch (error: any) {
    console.error(
      `[Webhooks] ❌ Failed to deliver '${eventType}' to ${sub.url} (Attempt ${attemptNumber}/${MAX_RETRIES}). Error: ${error.message}`,
    );

    if (attemptNumber < MAX_RETRIES) {
      const delayMs = Math.pow(2, attemptNumber) * 1000; // 2s, 4s backoff
      console.log(
        `[Webhooks] Scheduled retry for ${sub.url} in ${delayMs}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return attemptDelivery(sub, eventType, payload, attemptNumber + 1);
    } else {
      console.error(
        `[Webhooks] 🚫 Exhausted retries for ${sub.url}. Delivery permanently failed.`,
      );
      metricsManager.trackTransaction("failure", 0);
    }
  }
};
