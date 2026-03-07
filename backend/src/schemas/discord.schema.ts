import { z } from "zod";

/**
 * Schema for Discord interaction payload
 * Discord sends JSON payloads with specific structure
 */
export const discordInteractionSchema = z.object({
  id: z.string(),
  application_id: z.string().optional(),
  type: z.number().int().min(1).max(5), // InteractionType enum values
  data: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      type: z.number().optional(),
      options: z.array(z.any()).optional(),
    })
    .optional(),
  guild_id: z.string().optional(),
  channel_id: z.string().optional(),
  member: z.any().optional(),
  user: z.any().optional(),
  token: z.string(),
  version: z.number().optional(),
  message: z.any().optional(),
});

export type DiscordInteractionInput = z.infer<typeof discordInteractionSchema>;
