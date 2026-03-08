import { z } from "zod";

/**
 * Schema for Slack command payload
 * Slack sends application/x-www-form-urlencoded data
 */
export const slackCommandSchema = z.object({
  token: z.string().optional(), // Slack verification token (deprecated, use signing secret)
  team_id: z.string().optional(),
  team_domain: z.string().optional(),
  channel_id: z.string().optional(),
  channel_name: z.string().optional(),
  user_id: z.string().optional(),
  user_name: z.string().optional(),
  command: z.string().optional(),
  text: z
    .string()
    .max(500, { message: "Command text too long" })
    .optional()
    .default(""),
  response_url: z.string().url().optional(),
  trigger_id: z.string().optional(),
});

export type SlackCommandInput = z.infer<typeof slackCommandSchema>;
