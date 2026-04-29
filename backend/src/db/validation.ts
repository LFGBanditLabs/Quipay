import { z } from "zod";
import { DatabaseError } from "../errors/AppError";

/**
 * Custom error for database schema validation failures.
 * Includes structured error details without exposing raw data.
 */
export class DatabaseValidationError extends DatabaseError {
  constructor(
    message: string,
    public readonly query: string,
    public readonly issues: z.ZodError["issues"],
  ) {
    super(message);
    this.name = "DatabaseValidationError";
  }
}

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
 * Throws a DatabaseValidationError if validation fails.
 * 
 * @param queryName - Name of the query for error reporting
 * @param row - The row data to validate
 * @param schema - Zod schema to validate against
 * @returns The validated and typed row
 * @throws DatabaseValidationError if validation fails
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

    throw new DatabaseValidationError(
      `Schema validation failed for ${queryName}: ${errorMessage}`,
      queryName,
      error instanceof z.ZodError ? error.issues : [],
    );
  }
}

/**
 * Validates multiple database rows against a Zod schema.
 * Throws a DatabaseValidationError if any row fails validation.
 * 
 * @param queryName - Name of the query for error reporting
 * @param rows - Array of row data to validate
 * @param schema - Zod schema to validate each row against
 * @returns Array of validated and typed rows
 * @throws DatabaseValidationError if any row fails validation
 */
export function validateRows<T>(
  queryName: string,
  rows: unknown[],
  schema: z.ZodSchema<T>,
): T[] {
  try {
    return rows.map((_row, index) => {
      try {
        return schema.parse(_row);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issuesWithIndex = error.issues.map((issue) => ({
            ...issue,
            path: [`row[${index}]`, ...issue.path],
          }));
          const errorMessage = issuesWithIndex
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join("; ");
          throw new DatabaseValidationError(
            `Schema validation failed for ${queryName}: ${errorMessage}`,
            queryName,
            issuesWithIndex,
          );
        }
        throw error;
      }
    });
  } catch (error) {
    if (error instanceof DatabaseValidationError) throw error;
    if (error instanceof z.ZodError) {
      const issuesWithIndex = error.issues.map((issue) => ({
        ...issue,
        path: [`row[0]`, ...issue.path],
      }));
      
      const errorMessage = issuesWithIndex
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");

      throw new DatabaseValidationError(
        `Schema validation failed for ${queryName}: ${errorMessage}`,
        queryName,
        issuesWithIndex,
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    throw new DatabaseValidationError(
      `Schema validation failed for ${queryName}: ${errorMessage}`,
      queryName,
      [],
    );
  }
}