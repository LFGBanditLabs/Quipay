import { Request, Response, NextFunction } from "express";
import sanitizeHtml from "sanitize-html";

const MAX_DEPTH = 5;

/**
 * Recursively sanitize strings in an object, removing HTML tags, null bytes, and control characters.
 */
function sanitizeObject(obj: any, depth = 0): any {
  if (depth > MAX_DEPTH) {
    throw new Error("Request body exceeds maximum nesting depth");
  }

  if (typeof obj === "string") {
    // Strip null bytes and control characters (except tab, newline, carriage return)
    let sanitized = obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    // Strip HTML tags
    sanitized = sanitizeHtml(sanitized, {
      allowedTags: [],
      allowedAttributes: {},
    });
    return sanitized;
  } else if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  } else if (obj !== null && typeof obj === "object") {
    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = sanitizeObject(obj[key], depth + 1);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Middleware to sanitize request body inputs.
 */
export const inputSanitizationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    next();
  } catch (error) {
    console.error("[Security] Input sanitization error:", error);
    return res.status(400).json({ error: "Invalid request body" });
  }
};
