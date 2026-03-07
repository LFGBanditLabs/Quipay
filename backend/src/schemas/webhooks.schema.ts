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
      (url) => {
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
          errorMap: () => ({ message: "Invalid event type" }),
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

export type WebhookRegistrationInput = z.infer<
  typeof webhookRegistrationSchema
>;
export type WebhookIdInput = z.infer<typeof webhookIdSchema>;
