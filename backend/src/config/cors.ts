import { CorsOptions } from "cors";

export const DEFAULT_ALLOWED_ORIGINS = [
  "https://app.quipay.io",
  "https://staging.quipay.app",
  "http://localhost:3000",
];

export class CorsForbiddenError extends Error {
  public readonly status = 403;

  constructor(message = "Not allowed by CORS") {
    super(message);
    this.name = "CorsForbiddenError";
  }
}

export function getAllowedOrigins(
  rawAllowedOrigins = process.env.ALLOWED_ORIGINS,
): string[] {
  if (!rawAllowedOrigins || rawAllowedOrigins.trim().length === 0) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return rawAllowedOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function createCorsOptions(allowedOrigins: string[]): CorsOptions {
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl/Postman/native apps).
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new CorsForbiddenError());
    },
    credentials: true,
  };
}
