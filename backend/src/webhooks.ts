import { Router, Request, Response } from "express";
import crypto from "crypto";
import { validateRequest } from "./middleware/validation";
import {
  webhookRegistrationLimiter,
  standardRateLimiter,
} from "./middleware/rateLimiter";
import {
  webhookRegistrationSchema,
  webhookIdSchema,
} from "./schemas/webhooks.schema";
import { createProblemDetails } from "./middleware/errorHandler";

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[]; // e.g., ["withdrawal", "new_stream"]
  createdAt: Date;
}

// In-memory store for Webhook Subscriptions
export const webhookStore = new Map<string, WebhookSubscription>();

export const webhookRouter = Router();

/**
 * @api {post} /webhooks Register a new webhook
 * @apiDescription Subscribes an endpoint to receive real-time notifications for Quipay events.
 */
webhookRouter.post(
  "/",
  webhookRegistrationLimiter,
  validateRequest({ body: webhookRegistrationSchema }),
  (req: Request, res: Response) => {
    const { url, events } = req.body;

    // Default to all known events if not explicitly provided
    const subscribedEvents = events || ["withdrawal", "new_stream"];

    const id = crypto.randomUUID();

    const subscription: WebhookSubscription = {
      id,
      url,
      events: subscribedEvents,
      createdAt: new Date(),
    };

    webhookStore.set(id, subscription);

    res.status(201).json({
      message: "Webhook registered successfully.",
      subscription,
    });
  },
);

/**
 * @api {get} /webhooks List registered webhooks
 */
webhookRouter.get("/", standardRateLimiter, (req: Request, res: Response) => {
  const subscriptions = Array.from(webhookStore.values());
  res.json({ subscriptions });
});

/**
 * @api {delete} /webhooks/:id Remove a webhook
 */
webhookRouter.delete(
  "/:id",
  standardRateLimiter,
  validateRequest({ params: webhookIdSchema }),
  (req: Request, res: Response) => {
    const id = req.params.id as string;

    if (webhookStore.has(id)) {
      webhookStore.delete(id);
      res.json({ message: "Webhook deleted successfully." });
    } else {
      const problem = createProblemDetails({
        type: "not-found",
        title: "Webhook Not Found",
        status: 404,
        detail: `Webhook with ID '${id}' was not found`,
        instance: req.originalUrl,
      });
      res.status(404).json(problem);
    }
  },
);
