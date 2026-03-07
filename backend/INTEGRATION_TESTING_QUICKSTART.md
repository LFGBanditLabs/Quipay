# Integration Testing Quick Start Guide

## Prerequisites

1. **Docker**: Ensure Docker is installed and running

   ```bash
   docker --version
   # Should output: Docker version 20.x.x or higher
   ```

2. **Node.js**: Version 20 or higher
   ```bash
   node --version
   # Should output: v20.x.x or higher
   ```

## Installation

```bash
cd backend
npm install
```

This will install:

- `testcontainers`: Container orchestration
- `@testcontainers/postgresql`: PostgreSQL-specific container
- All other dependencies

## Running Tests

### All Tests (Unit + Integration)

```bash
npm test
```

### Integration Tests Only

```bash
npm run test:integration
```

### Unit Tests Only

```bash
npm run test:unit
```

### Watch Mode

```bash
npm run test:watch
```

## Quick Test Examples

### Example 1: Testing Database Writes

```typescript
it("should write audit log to database", async () => {
  const auditLogger = new AuditLogger(config);

  await auditLogger.info("Test message", {
    action_type: "system",
  });

  await auditLogger.shutdown();

  const result = await pool.query(
    "SELECT * FROM audit_logs WHERE message = $1",
    ["Test message"],
  );

  expect(result.rows).toHaveLength(1);
});
```

### Example 2: Testing Data Constraints

```typescript
it("should enforce NOT NULL constraint", async () => {
  await expect(
    pool.query(
      "INSERT INTO audit_logs (timestamp, log_level, message, action_type) VALUES (NULL, 'INFO', 'test', 'system')",
    ),
  ).rejects.toThrow();
});
```

### Example 3: Testing Complex Queries

```typescript
it("should calculate overall stats correctly", async () => {
  // Insert test data
  await upsertStream({
    streamId: 1,
    employer: "GEMPLOYER1",
    worker: "GWORKER1",
    totalAmount: BigInt(1000000000),
    withdrawnAmount: BigInt(200000000),
    startTs: Math.floor(Date.now() / 1000),
    endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
    status: "active",
    ledger: 1000,
  });

  // Query stats
  const stats = await getOverallStats();

  expect(stats.total_streams).toBe(1);
  expect(stats.active_streams).toBe(1);
  expect(stats.total_volume).toBe("1000000000");
});
```

## Troubleshooting

### Docker Not Running

**Error**: `Cannot connect to the Docker daemon`

**Solution**:

```bash
# Start Docker
sudo systemctl start docker

# Or on macOS
open -a Docker
```

### Port Already in Use

**Error**: `Port 5432 is already allocated`

**Solution**: Testcontainers uses random ports, but if you have PostgreSQL running locally:

```bash
# Stop local PostgreSQL
sudo systemctl stop postgresql

# Or on macOS
brew services stop postgresql
```

### Tests Timeout

**Error**: `Timeout - Async callback was not invoked within the 60000 ms timeout`

**Solution**: Increase timeout in test file:

```typescript
beforeAll(async () => {
  // ...
}, 90000); // Increase to 90 seconds
```

### Container Won't Stop

**Error**: Orphaned containers after tests

**Solution**:

```bash
# List all containers
docker ps -a

# Stop specific container
docker stop <container_id>

# Remove all stopped containers
docker container prune
```

## Verification

### Check Docker is Working

```bash
docker run hello-world
```

### Check Tests are Passing

```bash
npm run test:integration
```

Expected output:

```
PASS  src/__tests__/integration/auditLogger.integration.test.ts
PASS  src/__tests__/integration/analytics.integration.test.ts

Test Suites: 2 passed, 2 total
Tests:       40 passed, 40 total
```

## Next Steps

1. **Read Full Documentation**: See `CONTAINERIZED_TESTING_STRATEGY.md`
2. **Write Your Own Tests**: Use examples as templates
3. **Run in CI/CD**: Integrate with GitHub Actions
4. **Monitor Performance**: Track test execution times

## Common Commands

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run integration tests only
npm run test:integration

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- auditLogger.integration.test.ts

# Run in watch mode
npm run test:watch

# Clean up Docker
docker system prune -a
```

## Getting Help

- Check `CONTAINERIZED_TESTING_STRATEGY.md` for detailed documentation
- Review test examples in `src/__tests__/integration/`
- Consult [Testcontainers docs](https://testcontainers.com/)
- Open an issue on GitHub

## Success Checklist

- [ ] Docker installed and running
- [ ] Dependencies installed (`npm install`)
- [ ] All tests passing (`npm test`)
- [ ] Integration tests passing (`npm run test:integration`)
- [ ] No orphaned containers (`docker ps -a`)

You're ready to write integration tests! 🎉
