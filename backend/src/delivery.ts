import axios from "axios";
import { webhookStore, WebhookSubscription } from "./webhooks";
import { metricsManager } from "./metrics";

// Maximum attempts for exponential backoff retries
const MAX_RETRIES = 3;

import { enqueueJob } from "./queue/asyncQueue";

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
    `[Webhooks] Enqueueing event '${eventType}' to ${subscriptions.length} subscribers...`,
  );

  for (const sub of subscriptions) {
    enqueueJob(
      () => attemptDelivery(sub, eventType, payload),
      {
        jobType: "webhook_delivery",
        payload: { eventType, subUrl: sub.url, originalPayload: payload },
        context: { url: sub.url },
        maxRetries: 3,
        baseDelayMs: 2000,
      }
    ).catch(() => { }); // catch handled internal to enqueueJob
  }
};

/**
 * Attempts delivery to a single webhook, throwing an error if it fails
 * so the asyncQueue can automatically retry or send it to the DLQ.
 */
const attemptDelivery = async (
  sub: WebhookSubscription,
  eventType: string,
  payload: any,
): Promise<void> => {
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

  try {
    await axios.post(sub.url, outgoingPayload, {
      timeout: 5000, // 5 seconds timeout
    });

    const latency = (Date.now() - startTime) / 1000;
    metricsManager.trackTransaction("success", latency);

    console.log(
      `[Webhooks] ✅ Successfully delivered '${eventType}' to ${sub.url}`,
    );
  } catch (err: any) {
    // We throw the error heavily to the wrapper so that enqueueJob does the retry
    metricsManager.trackTransaction("failure", 0);
    throw new Error(`Delivery to ${sub.url} failed: ${err.message}`);
  }
};
