# Rate Limiting and Payload Validation Implementation

## Overview

This document describes the implementation of rate limiting and payload validation for the Quipay backend API to protect against DDoS attacks and malformed payloads.

## Features Implemented

### 1. Rate Limiting

Rate limiting is implemented using `express-rate-limit` with optional Redis backing for distributed deployments.

#### Rate Limit Tiers

- **Standard Rate Limiter**: 100 requests per 15 minutes per IP
  - Applied to: General API endpoints, Slack commands, Discord interactions
- **Strict Rate Limiter**: 20 requests per 15 minutes per IP
  - Applied to: AI endpoints (expensive OpenAI API calls)
- **Webhook Registration Limiter**: 5 requests per hour per IP
  - Applied to: Webhook registration endpoint

#### Redis Support

- If `REDIS_URL` is configured, rate limiting uses Redis for distributed tracking
- Falls back to in-memory store if Redis is not available
- Supports multi-instance deployments with shared rate limit state

#### Response Format

When rate limit is exceeded, returns HTTP 429 with RFC 7807 Problem Details:

```json
{
  "type": "https://quipay.io/errors/rate-limit-exceeded",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "You have exceeded the rate limit. Please try again later.",
  "instance": "/api/endpoint",
  "retryAfter": "900"
}
```

### 2. Payload Validation

Payload validation is implemented using Zod schemas for type-safe validation at the edge.

#### Validated Endpoints

1. **Webhooks** (`/webhooks`)
   - POST: Validates URL format, HTTPS requirement (production), event types, array limits
   - DELETE: Validates UUID format for webhook ID

2. **AI Gateway** (`/ai`)
   - POST `/parse`: Validates command length, sanitizes suspicious patterns (XSS, script injection)
   - POST `/execute`: Validates intentId and boolean confirmation

3. **Slack** (`/slack`)
   - POST `/command`: Validates Slack command payload structure and text length

4. **Discord** (`/discord`)
   - POST `/interactions`: Validates Discord interaction structure and types

#### Validation Features

- **Type Safety**: Zod provides compile-time and runtime type checking
- **Sanitization**: Rejects payloads with suspicious patterns (script tags, javascript: protocol, eval)
- **Length Limits**: Enforces maximum lengths to prevent memory exhaustion
- **Format Validation**: Validates URLs, UUIDs, enums, and other formats
- **Custom Error Messages**: Provides clear, actionable error messages

#### Response Format

When validation fails, returns HTTP 400 with RFC 7807 Problem Details:

```json
{
  "type": "https://quipay.io/errors/validation-error",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/api/endpoint",
  "errors": [
    {
      "field": "url",
      "message": "Invalid URL format",
      "code": "invalid_string"
    }
  ]
}
```

### 3. RFC 7807 Problem Details

All error responses follow RFC 7807 Problem Details format for consistency:

- **type**: URI reference identifying the problem type
- **title**: Short, human-readable summary
- **status**: HTTP status code
- **detail**: Human-readable explanation
- **instance**: URI reference identifying the specific occurrence
- **Additional properties**: Context-specific data (e.g., validation errors, retry-after)

### 4. Security Enhancements

- **Payload Size Limits**: JSON and URL-encoded payloads limited to 1MB
- **XSS Prevention**: AI commands sanitized for script injection attempts
- **HTTPS Enforcement**: Webhook URLs must use HTTPS in production
- **Input Sanitization**: All inputs validated and sanitized before processing

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Redis Configuration (optional - for distributed rate limiting)
# If not set, rate limiting will use in-memory store
REDIS_URL=redis://localhost:6379
```

### Dependencies

Added to `package.json`:

```json
{
  "dependencies": {
    "express-rate-limit": "^7.5.0",
    "ioredis": "^5.4.2",
    "rate-limit-redis": "^4.2.0",
    "zod": "^3.24.1"
  }
}
```

## Installation

```bash
cd backend
npm install
```

## Usage

### Running the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Testing

```bash
npm test
```

## File Structure

```
backend/src/
├── middleware/
│   ├── rateLimiter.ts       # Rate limiting configuration
│   ├── validation.ts        # Validation middleware factory
│   └── errorHandler.ts      # RFC 7807 error handlers
├── schemas/
│   ├── webhooks.schema.ts   # Webhook validation schemas
│   ├── ai.schema.ts         # AI endpoint validation schemas
│   ├── slack.schema.ts      # Slack command validation schemas
│   └── discord.schema.ts    # Discord interaction validation schemas
└── __tests__/
    └── rateLimitingValidation.test.ts  # Validation tests
```

## API Changes

### Before

```typescript
// No rate limiting
// Manual validation
app.post("/webhooks", (req, res) => {
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "A valid URL is required." });
  }
  // ...
});
```

### After

```typescript
// With rate limiting and validation
app.post(
  "/webhooks",
  webhookRegistrationLimiter,
  validateRequest({ body: webhookRegistrationSchema }),
  (req, res) => {
    // Validated and rate-limited
    // ...
  },
);
```

## Monitoring

Rate limit headers are included in all responses:

- `RateLimit-Limit`: Maximum requests allowed in window
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Time when the rate limit resets (Unix timestamp)
- `Retry-After`: Seconds to wait before retrying (when rate limited)

## Future Enhancements

1. **API Key-Based Rate Limiting**: Track limits by API key instead of IP
2. **Dynamic Rate Limits**: Adjust limits based on user tier or subscription
3. **Rate Limit Analytics**: Track and visualize rate limit hits
4. **Allowlist/Blocklist**: IP-based allowlist for trusted sources
5. **Distributed Tracing**: Integrate with observability tools

## Testing Rate Limits

### Manual Testing

```bash
# Test rate limiting
for i in {1..25}; do
  curl -X POST http://localhost:3001/ai/parse \
    -H "Content-Type: application/json" \
    -d '{"command":"test"}' \
    -w "\nStatus: %{http_code}\n"
done
```

### Expected Behavior

- First 20 requests: HTTP 200
- Requests 21+: HTTP 429 with Problem Details response

## Troubleshooting

### Redis Connection Issues

If Redis is unavailable:

- Rate limiter automatically falls back to in-memory store
- Check logs for: `[RateLimiter] Redis connection error`
- Verify `REDIS_URL` environment variable

### Validation Errors

If validation fails unexpectedly:

- Check the `errors` array in the response for specific field issues
- Verify payload structure matches schema requirements
- Review schema definitions in `backend/src/schemas/`

## References

- [RFC 7807 - Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807)
- [express-rate-limit Documentation](https://github.com/express-rate-limit/express-rate-limit)
- [Zod Documentation](https://zod.dev/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
