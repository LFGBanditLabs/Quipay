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
  webhookOutboundEventIdSchema,
  webhookOutboundEventListQuerySchema,
} from "./schemas/webhooks.schema";
import { createProblemDetails } from "./middleware/errorHandler";
import {
  authenticateRequest,
  requireUser,
  AuthenticatedRequest,
} from "./middleware/rbac";
import {
  getWebhookOutboundEventByIdForOwner,
  listWebhookOutboundEventsByOwner,
} from "./db/queries";
import { retryWebhookEvent } from "./delivery";
import { verifyQuipaySignature } from "./middleware/security";

export interface WebhookSubscription {
  id: string;
  ownerId: string;
  url: string;
  events: string[]; // e.g., ["withdrawal", "new_stream"]
  createdAt: Date;
}

// In-memory store for Webhook Subscriptions
export const webhookStore = new Map<string, WebhookSubscription>();

export const webhookRouter = Router();

webhookRouter.post(
  "/inbound",
  standardRateLimiter,
  verifyQuipaySignature,
  (req: Request, res: Response) => {
    res.status(200).json({ received: true });
  },
);

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

    const ownerId =
      (req.headers["x-user-id"] as string | undefined) || "anonymous";

    // Default to all known events if not explicitly provided
    const subscribedEvents = events || ["withdrawal", "new_stream"];

    const id = crypto.randomUUID();

    const subscription: WebhookSubscription = {
      id,
      ownerId,
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
 * @api {get} /webhooks/outbound/events List outbound webhook events for the authenticated merchant
 */
webhookRouter.get(
  "/outbound/events",
  authenticateRequest,
  requireUser,
  validateRequest({ query: webhookOutboundEventListQuerySchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { page, limit } = (req as any).query as {
      page: number;
      limit: number;
    };
    const offset = (Number(page) - 1) * Number(limit);
    const events = await listWebhookOutboundEventsByOwner({
      ownerId: req.user.id,
      limit: Number(limit),
      offset,
    });

    res.json({ events, page: Number(page), limit: Number(limit) });
  },
);

/**
 * @api {post} /webhooks/outbound/events/:id/replay Manually replay a specific webhook event
 */
webhookRouter.post(
  "/outbound/events/:id/replay",
  authenticateRequest,
  requireUser,
  validateRequest({ params: webhookOutboundEventIdSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const id = (req as any).params.id as string;
    const ev = await getWebhookOutboundEventByIdForOwner({
      eventId: id,
      ownerId: req.user.id,
    });
    if (!ev) {
      const problem = createProblemDetails({
        type: "not-found",
        title: "Webhook Event Not Found",
        status: 404,
        detail: `Webhook outbound event with ID '${id}' was not found`,
        instance: (req as any).originalUrl,
      });
      return res.status(404).json(problem);
    }

    await retryWebhookEvent(id);
    res.status(202).json({ message: "Replay scheduled", id });
  },
);

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
