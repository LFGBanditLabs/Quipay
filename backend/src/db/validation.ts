import { ZodError, ZodSchema } from "zod";

/**
 * Thrown when a database row fails runtime Zod validation against the schema
 * a query expected (#930).
 *
 * The originating ZodError is exposed as `cause` so logs / Sentry / structured
 * error handlers can surface field-level details. The plain `message` is safe
 * to render in HTTP responses since it does not include the offending row data.
 */
export class DatabaseValidationError extends Error {
  public readonly query: string;
  public readonly issues: ZodError["issues"];

  constructor(query: string, zodError: ZodError) {
    super(
      `Database row failed runtime validation for query "${query}": ${zodError.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ")}`,
    );
    this.name = "DatabaseValidationError";
    this.query = query;
    this.issues = zodError.issues;
    Object.setPrototypeOf(this, DatabaseValidationError.prototype);
  }
}

/**
 * Validate every row of a query result against `schema`. Returns the parsed
 * (and therefore strongly-typed) rows. Throws `DatabaseValidationError` on the
 * first row that does not match — the row itself is not embedded in the error
 * message to keep PII out of logs.
 *
 * Use this for query results that cross a trust boundary (HTTP response, async
 * job payload, audit log) so a Drizzle/SQL drift surfaces as a structured
 * 5xx instead of an `undefined` propagating into the response shape.
 */
export function validateRows<T>(
  queryName: string,
  rows: unknown[],
  schema: ZodSchema<T>,
): T[] {
  return rows.map((row, index) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      // Prefix path with the row index so the error pinpoints which row failed.
      const reissued = result.error.issues.map((issue) => ({
        ...issue,
        path: [`row[${index}]`, ...issue.path],
      }));
      throw new DatabaseValidationError(queryName, {
        ...result.error,
        issues: reissued,
      } as ZodError);
    }
    return result.data;
  });
}

export function validateRow<T>(
  queryName: string,
  row: unknown,
  schema: ZodSchema<T>,
): T {
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new DatabaseValidationError(queryName, result.error);
  }
  return result.data;
}
