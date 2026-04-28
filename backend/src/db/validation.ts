import { z } from "zod";
import { DatabaseError } from "../errors/AppError";

/**
 * Schema for validating OverallStats query results.
 * Ensures data from the database matches expected structure.
 */
export const overallStatsSchema = z.object({
  total_streams: z.union([z.string(), z.number()]),
  active_streams: z.union([z.string(), z.number()]),
  completed_streams: z.union([z.string(), z.number()]),
  cancelled_streams: z.union([z.string(), z.number()]),
  total_volume: z.string(),
  total_withdrawn: z.string(),
});

/**
 * Validates a database row against a Zod schema.
 * Throws a DatabaseError if validation fails.
 * 
 * @param queryName - Name of the query for error reporting
 * @param row - The row data to validate
 * @param schema - Zod schema to validate against
 * @returns The validated and typed row
 * @throws DatabaseError if validation fails
 */
export function validateRow<T>(
  queryName: string,
  row: unknown,
  schema: z.ZodSchema<T>,
): T {
  try {
    return schema.parse(row);
  } catch (error) {
    const errorMessage =
      error instanceof z.ZodError
        ? (error as z.ZodError).issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
        : error instanceof Error
          ? error.message
          : String(error);

    throw new DatabaseError(
      `Schema validation failed for ${queryName}: ${errorMessage}`,
    );
  }
}
