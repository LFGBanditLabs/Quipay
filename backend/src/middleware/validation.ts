import { Request, Response, NextFunction } from "express";
import { z, ZodError, ZodSchema } from "zod";
import { createProblemDetails } from "./errorHandler";

/**
 * Middleware factory for validating request payloads using Zod schemas
 * Validates body, query, or params based on provided schemas
 */
export function validateRequest(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body if schema provided
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      // Validate query if schema provided
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as any;
      }

      // Validate params if schema provided
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as any;
      }

      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const validationErrors = error.issues.map((err: z.ZodIssue) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        const problem = createProblemDetails({
          type: "validation-error",
          title: "Bad Request",
          status: 400,
          detail: "Request validation failed",
          instance: req.originalUrl,
          errors: validationErrors,
        });

        return res.status(400).json(problem);
      }

      // Pass other errors to global error handler
      next(error);
    }
  };
}

/**
 * Common validation schemas for reuse across endpoints
 */
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid({ message: "Invalid UUID format" }),

  // URL validation
  url: z.string().url({ message: "Invalid URL format" }),

  // Non-empty string
  nonEmptyString: z
    .string()
    .refine((val: string) => val.length > 0, {
      message: "String cannot be empty",
    })
    .trim(),

  // Positive integer
  positiveInt: z.number().int().positive(),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
