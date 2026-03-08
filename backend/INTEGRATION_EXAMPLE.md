# Rate Limiting and Validation Integration Example

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment (Optional)

```bash
cp .env.example .env
# Edit .env and add Redis URL if using Redis:
# REDIS_URL=redis://localhost:6379
```

### 3. Start the Server

```bash
npm run dev
```

## Testing the Implementation

### Test 1: Valid Webhook Registration

```bash
curl -X POST http://localhost:3001/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhook",
    "events": ["withdrawal", "new_stream"]
  }'
```

**Expected Response (201):**

```json
{
  "message": "Webhook registered successfully.",
  "subscription": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "url": "https://example.com/webhook",
    "events": ["withdrawal", "new_stream"],
    "createdAt": "2024-03-07T12:00:00.000Z"
  }
}
```

### Test 2: Invalid Webhook URL (Validation Error)

```bash
curl -X POST http://localhost:3001/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "not-a-valid-url",
    "events": ["withdrawal"]
  }'
```

**Expected Response (400):**

```json
{
  "type": "https://quipay.io/errors/validation-error",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/webhooks",
  "errors": [
    {
      "field": "url",
      "message": "Invalid URL format",
      "code": "invalid_string"
    }
  ]
}
```

### Test 3: Rate Limiting (Webhook Registration)

```bash
# Run this 6 times quickly
for i in {1..6}; do
  echo "Request $i:"
  curl -X POST http://localhost:3001/webhooks \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://example.com/webhook'$i'",
      "events": ["withdrawal"]
    }' \
    -w "\nHTTP Status: %{http_code}\n\n"
done
```

**Expected Behavior:**

- Requests 1-5: HTTP 201 (Success)
- Request 6: HTTP 429 (Rate Limited)

**Rate Limited Response (429):**

```json
{
  "type": "https://quipay.io/errors/rate-limit-exceeded",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "You have exceeded the rate limit. Please try again later.",
  "instance": "/webhooks",
  "retryAfter": "3600"
}
```

### Test 4: AI Command with XSS Attempt (Validation Error)

```bash
curl -X POST http://localhost:3001/ai/parse \
  -H "Content-Type: application/json" \
  -d '{
    "command": "<script>alert(\"xss\")</script>"
  }'
```

**Expected Response (400):**

```json
{
  "type": "https://quipay.io/errors/validation-error",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/ai/parse",
  "errors": [
    {
      "field": "command",
      "message": "Command contains invalid or suspicious content",
      "code": "custom"
    }
  ]
}
```

### Test 5: Valid AI Command

```bash
curl -X POST http://localhost:3001/ai/parse \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Pay Alice 100 USDC"
  }'
```

**Expected Response (200):**

```json
{
  "intent": "payment",
  "recipient": "Alice",
  "amount": "100",
  "currency": "USDC"
}
```

### Test 6: AI Rate Limiting (Strict)

```bash
# Run this 25 times quickly to test strict rate limiting
for i in {1..25}; do
  echo "Request $i:"
  curl -X POST http://localhost:3001/ai/parse \
    -H "Content-Type: application/json" \
    -d '{"command":"test command '$i'"}' \
    -w "\nHTTP Status: %{http_code}\n"
done
```

**Expected Behavior:**

- Requests 1-20: HTTP 200 (Success)
- Requests 21+: HTTP 429 (Rate Limited)

### Test 7: Invalid UUID in Webhook Deletion

```bash
curl -X DELETE http://localhost:3001/webhooks/invalid-uuid
```

**Expected Response (400):**

```json
{
  "type": "https://quipay.io/errors/validation-error",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/webhooks/invalid-uuid",
  "errors": [
    {
      "field": "id",
      "message": "Invalid webhook ID format",
      "code": "invalid_string"
    }
  ]
}
```

### Test 8: Check Rate Limit Headers

```bash
curl -X POST http://localhost:3001/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/test"}' \
  -v 2>&1 | grep -i ratelimit
```

**Expected Headers:**

```
< RateLimit-Limit: 5
< RateLimit-Remaining: 4
< RateLimit-Reset: 1678195200
```

## Monitoring Rate Limits

### Check Current Rate Limit Status

All responses include rate limit headers:

- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Unix timestamp when limit resets

### Redis Monitoring (if using Redis)

```bash
# Connect to Redis
redis-cli

# Check rate limit keys
KEYS rl:*

# Check specific key TTL
TTL rl:standard:127.0.0.1

# Check key value
GET rl:standard:127.0.0.1
```

## Error Response Format

All errors follow RFC 7807 Problem Details format:

```typescript
interface ProblemDetails {
  type: string; // URI identifying the problem type
  title: string; // Short, human-readable summary
  status: number; // HTTP status code
  detail: string; // Human-readable explanation
  instance: string; // URI of the specific occurrence
  [key: string]: any; // Additional context (e.g., errors, retryAfter)
}
```

## Rate Limit Configuration

| Endpoint                 | Limit        | Window     | Limiter Type         |
| ------------------------ | ------------ | ---------- | -------------------- |
| `/webhooks` (POST)       | 5 requests   | 1 hour     | Webhook Registration |
| `/webhooks` (GET/DELETE) | 100 requests | 15 minutes | Standard             |
| `/ai/*`                  | 20 requests  | 15 minutes | Strict               |
| `/slack/*`               | 100 requests | 15 minutes | Standard             |
| `/discord/*`             | 100 requests | 15 minutes | Standard             |
| Other endpoints          | 100 requests | 15 minutes | Standard             |

## Validation Rules Summary

### Webhooks

- URL: Must be valid URL, max 2048 chars, HTTPS in production
- Events: Array of valid event types, 1-10 items
- ID: Must be valid UUID v4

### AI Commands

- Command: 1-1000 chars, no script tags, no javascript: protocol
- IntentId: 1-100 chars
- Confirmed: Must be boolean

### Slack Commands

- Text: Max 500 chars
- All fields optional with defaults

### Discord Interactions

- Type: Integer 1-5
- ID and Token: Required strings

## Production Considerations

1. **Redis Setup**: Use Redis in production for distributed rate limiting
2. **HTTPS**: Webhook URLs must use HTTPS in production
3. **Monitoring**: Monitor rate limit hits and adjust limits as needed
4. **Logging**: All validation errors and rate limit hits are logged
5. **API Keys**: Consider implementing API key-based rate limiting for authenticated users

## Troubleshooting

### Rate Limits Not Working

- Check if Redis is running (if configured)
- Verify environment variables are loaded
- Check server logs for rate limiter initialization

### Validation Errors

- Review the `errors` array in the response
- Check schema definitions in `backend/src/schemas/`
- Verify request payload structure

### Redis Connection Issues

- System falls back to in-memory store automatically
- Check `REDIS_URL` environment variable
- Verify Redis is accessible from the application
