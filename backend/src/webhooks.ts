import { Router, Request, Response } from 'express';
import crypto from 'crypto';

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
webhookRouter.post('/', (req: Request, res: Response) => {
    const { url, events } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'A valid URL is required.' });
    }

    // Default to all known events if not explicitly provided
    const subscribedEvents = Array.isArray(events) && events.length > 0
        ? events
        : ['withdrawal', 'new_stream'];

    const id = crypto.randomUUID();

    const subscription: WebhookSubscription = {
        id,
        url,
        events: subscribedEvents,
        createdAt: new Date()
    };

    webhookStore.set(id, subscription);

    res.status(201).json({
        message: 'Webhook registered successfully.',
        subscription
    });
});

/**
 * @api {get} /webhooks List registered webhooks
 */
webhookRouter.get('/', (req: Request, res: Response) => {
    const subscriptions = Array.from(webhookStore.values());
    res.json({ subscriptions });
});

/**
 * @api {delete} /webhooks/:id Remove a webhook
 */
webhookRouter.delete('/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;

    if (webhookStore.has(id)) {
        webhookStore.delete(id);
        res.json({ message: 'Webhook deleted successfully.' });
    } else {
        res.status(404).json({ error: 'Webhook not found.' });
    }
});
