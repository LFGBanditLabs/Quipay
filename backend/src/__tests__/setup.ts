/**
 * Jest Setup File
 * Global configuration for all tests including testcontainers
 */

import { setupTestDatabase, teardownTestDatabase } from "./__tests__/helpers/testcontainer";

jest.setTimeout(60000);

let testDbInitialized = false;

beforeAll(async () => {
  if (!testDbInitialized) {
    await setupTestDatabase();
    testDbInitialized = true;
  }
}, 60000);

afterAll(async () => {
  await teardownTestDatabase();
}, 30000);

afterEach(async () => {
  const { cleanTestDatabase } = await import("./__tests__/helpers/testcontainer");
  await cleanTestDatabase();
});

if (process.env.SUPPRESS_TEST_LOGS === "true") {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
