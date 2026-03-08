/**
 * Centralized schema exports
 */

export {
  webhookRegistrationSchema,
  webhookIdSchema,
  type WebhookRegistrationInput,
  type WebhookIdInput,
} from "./webhooks.schema";

export {
  aiParseCommandSchema,
  aiExecuteCommandSchema,
  type AiParseCommandInput,
  type AiExecuteCommandInput,
} from "./ai.schema";

export { slackCommandSchema, type SlackCommandInput } from "./slack.schema";

export {
  discordInteractionSchema,
  type DiscordInteractionInput,
} from "./discord.schema";
