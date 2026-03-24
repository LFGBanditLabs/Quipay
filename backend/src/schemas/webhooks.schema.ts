import { z } from "zod";

/**
 * Schema for webhook registration
 */
export const webhookRegistrationSchema = z.object({
  url: z
    .string()
    .url({ message: "Invalid URL format" })
    .max(2048, { message: "URL too long (max 2048 characters)" })
    .refine(
      (url: string) => {
        // Ensure HTTPS in production
        if (process.env.NODE_ENV === "production") {
          return url.startsWith("https://");
        }
        return true;
      },
      { message: "HTTPS is required in production" },
    ),
  events: z
    .array(
      z.enum(
        ["withdrawal", "new_stream", "stream_cancelled", "payment_failed"],
        {
          message: "Invalid event type",
        },
      ),
    )
    .min(1, { message: "At least one event must be specified" })
    .max(10, { message: "Maximum 10 events allowed" })
    .optional(),
});

/**
 * Schema for webhook ID parameter
 */
export const webhookIdSchema = z.object({
  id: z.string().uuid({ message: "Invalid webhook ID format" }),
});

export const webhookOutboundEventIdSchema = z.object({
  id: z.string().uuid({ message: "Invalid webhook event ID format" }),
});

export const webhookOutboundEventListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type WebhookRegistrationInput = z.infer<
  typeof webhookRegistrationSchema
>;
export type WebhookIdInput = z.infer<typeof webhookIdSchema>;
export type WebhookOutboundEventIdInput = z.infer<
  typeof webhookOutboundEventIdSchema
>;
export type WebhookOutboundEventListQueryInput = z.infer<
  typeof webhookOutboundEventListQuerySchema
>;
