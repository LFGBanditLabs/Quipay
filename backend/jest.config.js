/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts", "**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/*.d.ts"],
  coverageDirectory: "coverage",
  verbose: true,
  // Increase timeout for integration tests with containers
  testTimeout: 60000,
  // Run tests serially to avoid container conflicts
  maxWorkers: 1,
  // Setup files
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  // Force exit after tests complete (for integration tests with containers)
  forceExit: true,
};
