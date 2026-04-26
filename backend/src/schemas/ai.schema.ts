import { z } from "zod";

/**
 * Schema for AI command parsing
 */
export const aiParseCommandSchema = z.object({
  command: z
    .string()
    .min(1, { message: "Command cannot be empty" })
    .max(1000, { message: "Command too long (max 1000 characters)" })
    .trim()
    .refine(
      (cmd: string) => {
        // Basic sanitization - reject commands with suspicious patterns
        const suspiciousPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+=/i, // event handlers
          /eval\(/i,
        ];
        return !suspiciousPatterns.some((pattern) => pattern.test(cmd));
      },
      { message: "Command contains invalid or suspicious content" },
    ),
});

/**
 * Schema for AI command execution
 */
export const aiExecuteCommandSchema = z.object({
  intentId: z
    .string()
    .min(1, { message: "Intent ID is required" })
    .max(100, { message: "Intent ID too long" }),
  confirmed: z.boolean({
    message: "Confirmation status is required and must be a boolean",
  }),
});

export type AiParseCommandInput = z.infer<typeof aiParseCommandSchema>;
export type AiExecuteCommandInput = z.infer<typeof aiExecuteCommandSchema>;
