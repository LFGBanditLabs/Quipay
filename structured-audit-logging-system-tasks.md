# Implementation Plan: Structured Audit Logging System

## Overview

This implementation plan creates a comprehensive audit logging system for the Quipay backend automation engine. The system will capture all automated actions (stream creation, contract interactions, monitoring, scheduling) in structured JSON format with persistent PostgreSQL storage, automatic redaction of sensitive data, and query/export capabilities.

The implementation follows a bottom-up approach: core logging infrastructure first, then storage and redaction, followed by integration with existing services, and finally query/export functionality.

## Tasks

- [x] 1. Set up core audit logging infrastructure
  - [x] 1.1 Create AuditLogger class with core logging methods
    - Create `backend/src/audit/auditLogger.ts` with AuditLogger class
    - Implement core methods: `log()`, `info()`, `warn()`, `error()`
    - Implement log entry validation and formatting
    - Add ISO 8601 timestamp generation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]\* 1.2 Write property test for valid JSON output
    - **Property 1: Valid JSON Output**
    - **Validates: Requirements 1.1, 1.6**

  - [ ]\* 1.3 Write property test for complete log entry structure
    - **Property 2: Complete Log Entry Structure**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

  - [x] 1.4 Create TypeScript interfaces and types
    - Define LogEntry, LogLevel, AuditLoggerConfig interfaces
    - Define parameter interfaces: StreamCreationParams, ContractInteractionParams, SchedulerEventParams, MonitorEventParams
    - Create `backend/src/audit/types.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]\* 1.5 Write unit tests for core logging methods
    - Test info(), warn(), error() methods with various inputs
    - Test log entry validation and defaults
    - Test timestamp format validation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Implement persistent log storage with PostgreSQL
  - [x] 2.1 Create database schema for audit logs
    - Add audit_logs table creation to `backend/src/db/schema.sql`
    - Create indexes for timestamp, log_level, employer, action_type, context
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 2.2 Implement async write queue and database persistence
    - Add write queue management to AuditLogger
    - Implement `enqueueWrite()` and `flushQueue()` methods
    - Implement `writeToDatabase()` using existing PostgreSQL pool
    - Add periodic flush mechanism with configurable interval
    - _Requirements: 5.1, 5.6, 9.1, 9.2_

  - [ ]\* 2.3 Write property test for log persistence round trip
    - **Property 11: Log Persistence Round Trip**
    - **Validates: Requirements 5.1**

  - [ ]\* 2.4 Write unit tests for database persistence
    - Test successful writes to database
    - Test write queue management
    - Test flush mechanism
    - _Requirements: 5.1, 5.6, 9.1_

- [x] 3. Implement redaction engine for sensitive data
  - [x] 3.1 Create RedactionEngine class
    - Create `backend/src/audit/redactionEngine.ts`
    - Implement `redact()` method with recursive object/array handling
    - Implement `redactString()` for pattern-based redaction
    - Implement `redactObject()` for field-based redaction
    - Add patterns for private keys (G + 55 chars), JWT tokens, seed phrases
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]\* 3.2 Write property test for private key redaction
    - **Property 22: Private Key Redaction**
    - **Validates: Requirements 10.1**

  - [ ]\* 3.3 Write property test for seed phrase redaction
    - **Property 23: Seed Phrase Redaction**
    - **Validates: Requirements 10.2**

  - [ ]\* 3.4 Write property test for authentication token redaction
    - **Property 24: Authentication Token Redaction**
    - **Validates: Requirements 10.3**

  - [ ]\* 3.5 Write property test for selective redaction preservation
    - **Property 25: Selective Redaction Preservation**
    - **Validates: Requirements 10.4**

  - [ ]\* 3.6 Write property test for custom field redaction
    - **Property 26: Custom Field Redaction**
    - **Validates: Requirements 10.5**

  - [ ]\* 3.7 Write property test for redaction format consistency
    - **Property 27: Redaction Format Consistency**
    - **Validates: Requirements 10.6**

  - [x] 3.8 Integrate RedactionEngine into AuditLogger
    - Add RedactionEngine instance to AuditLogger
    - Apply redaction before writing to queue
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]\* 3.9 Write unit tests for redaction engine
    - Test private key redaction with various formats
    - Test seed phrase detection (12 and 24 words)
    - Test JWT token redaction
    - Test preservation of transaction hashes and addresses
    - Test custom field redaction configuration
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 4. Checkpoint - Ensure core logging infrastructure works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement specialized logging methods
  - [ ] 5.1 Implement logStreamCreation method
    - Add `logStreamCreation()` to AuditLogger
    - Handle both success and failure cases
    - Include all required context fields: employer, worker, token, amount, duration, streamId, transactionHash, blockNumber
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]\* 5.2 Write property test for stream creation logging
    - **Property 3: Stream Creation Logging**
    - **Validates: Requirements 2.1, 2.6**

  - [ ]\* 5.3 Write property test for stream creation context completeness
    - **Property 4: Stream Creation Context Completeness**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

  - [ ] 5.4 Implement logContractInteraction method
    - Add `logContractInteraction()` to AuditLogger
    - Handle initiation and completion logging
    - Include contract address, function name, parameters, transaction result
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]\* 5.5 Write property test for contract interaction logging
    - **Property 6: Contract Interaction Logging**
    - **Validates: Requirements 3.2, 3.5, 3.6**

  - [ ]\* 5.6 Write property test for contract interaction context completeness
    - **Property 7: Contract Interaction Context Completeness**
    - **Validates: Requirements 3.3, 3.4**

  - [ ] 5.7 Implement logSchedulerEvent method
    - Add `logSchedulerEvent()` to AuditLogger
    - Handle task_started, task_completed, task_failed events
    - Include task name, execution time, employer
    - _Requirements: 8.1, 8.2, 8.4, 8.6_

  - [ ]\* 5.8 Write property test for scheduler event logging
    - **Property 19: Scheduler Event Logging**
    - **Validates: Requirements 8.1, 8.2, 8.4, 8.6**

  - [ ] 5.9 Implement logMonitorEvent method
    - Add `logMonitorEvent()` to AuditLogger
    - Include balance, liabilities, runway days, alert status, check type
    - Use WARN level for issues detected
    - _Requirements: 8.3, 8.5_

  - [ ]\* 5.10 Write property test for monitor event logging
    - **Property 20: Monitor Event Logging**
    - **Validates: Requirements 8.3, 8.5**

  - [ ]\* 5.11 Write unit tests for specialized logging methods
    - Test logStreamCreation with success and failure cases
    - Test logContractInteraction with various parameters
    - Test logSchedulerEvent for all event types
    - Test logMonitorEvent with different check types
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.2, 3.3, 3.4, 3.5, 3.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 6. Implement error handling and resilience
  - [ ] 6.1 Add error context capture for all error logs
    - Enhance `error()` method to capture stack traces
    - Include input data that caused the error
    - Include error code/type
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]\* 6.2 Write property test for error logging level
    - **Property 8: Error Logging Level**
    - **Validates: Requirements 4.1**

  - [ ]\* 6.3 Write property test for error context in contract interactions
    - **Property 9: Error Context for Contract Interactions**
    - **Validates: Requirements 4.6**

  - [ ]\* 6.4 Write property test for error log completeness
    - **Property 10: Error Log Completeness**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  - [ ] 6.5 Implement write failure buffering and retry
    - Add in-memory buffer for failed writes (max 1000 entries)
    - Implement retry mechanism with exponential backoff
    - Add fallback to console.error when buffer is full
    - _Requirements: 9.6_

  - [ ]\* 6.6 Write property test for write failure buffering
    - **Property 21: Write Failure Buffering**
    - **Validates: Requirements 9.6**

  - [ ]\* 6.7 Write unit tests for error handling
    - Test error log with complete stack trace
    - Test error context capture for contract interactions
    - Test buffer overflow handling
    - Test retry mechanism
    - Test fallback to console
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 9.6_

- [x] 7. Implement configuration and log level management
  - [x] 7.1 Create configuration loader
    - Create `backend/src/audit/config.ts`
    - Load configuration from environment variables
    - Provide sensible defaults for all config values
    - Validate numeric configurations
    - _Requirements: 7.1, 7.4, 7.5_

  - [x] 7.2 Implement log level filtering
    - Add minimum log level check in `log()` method
    - Skip logging for entries below minimum level
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]\* 7.3 Write property test for log level filtering
    - **Property 17: Log Level Filtering**
    - **Validates: Requirements 7.2, 7.3**

  - [x] 7.4 Implement runtime log level updates
    - Add `setMinLogLevel()` method
    - Allow updates without restart
    - _Requirements: 7.6_

  - [ ]\* 7.5 Write property test for runtime log level updates
    - **Property 18: Runtime Log Level Updates**
    - **Validates: Requirements 7.6**

  - [ ]\* 7.6 Write unit tests for configuration
    - Test configuration loading from environment
    - Test default values for invalid config
    - Test log level filtering at different levels
    - Test runtime log level updates
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 8. Checkpoint - Ensure logging system is robust and configurable
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create logging middleware for Express
  - [x] 9.1 Implement createLoggingMiddleware function
    - Create `backend/src/audit/middleware.ts`
    - Implement Express middleware that intercepts contract interaction requests
    - Log request initiation before handler execution
    - Capture response and log completion/failure
    - Include duration measurement
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]\* 9.2 Write property test for middleware interception order
    - **Property 5: Middleware Interception Order**
    - **Validates: Requirements 3.1**

  - [ ]\* 9.3 Write unit tests for logging middleware
    - Test middleware logs before handler execution
    - Test successful request logging
    - Test failed request logging
    - Test duration measurement
    - Test context extraction from request
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 10. Integrate audit logging with existing services
  - [x] 10.1 Integrate with stream creation service
    - Add AuditLogger instance to stream creation service
    - Call `logStreamCreation()` for all stream creation operations
    - Handle both success and failure cases
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 10.2 Integrate with scheduler service
    - Add AuditLogger instance to `backend/src/scheduler/scheduler.ts`
    - Call `logSchedulerEvent()` for task lifecycle events
    - Log task_started, task_completed, task_failed events
    - _Requirements: 8.1, 8.2, 8.4, 8.6_

  - [x] 10.3 Integrate with monitor service
    - Add AuditLogger instance to `backend/src/monitor/monitor.ts`
    - Call `logMonitorEvent()` for monitoring checks
    - Log when issues are detected
    - _Requirements: 8.3, 8.5_

  - [x] 10.4 Add logging middleware to Express app
    - Import and apply logging middleware in `backend/src/index.ts`
    - Apply before contract interaction routes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]\* 10.5 Write integration tests for service integration
    - Test stream creation logging in real service context
    - Test scheduler integration with actual tasks
    - Test monitor integration with actual checks
    - Test middleware integration with Express app
    - _Requirements: 2.1, 3.1, 8.1, 8.3_

- [x] 11. Implement log query and export functionality
  - [x] 11.1 Create LogQueryService class
    - Create `backend/src/audit/queryService.ts`
    - Implement `query()` method with filter support
    - Support filtering by timestamp range, log_level, employer, action_type
    - Support pagination with limit and offset
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [ ]\* 11.2 Write property test for query result filtering accuracy
    - **Property 12: Query Result Filtering Accuracy**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

  - [x] 11.3 Implement export functionality
    - Add `export()` method to LogQueryService
    - Support JSON and CSV formats
    - Filter by employer, date range, log_level
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]\* 11.4 Write property test for export employer isolation
    - **Property 13: Export Employer Isolation**
    - **Validates: Requirements 6.1**

  - [ ]\* 11.5 Write property test for export format validity
    - **Property 14: Export Format Validity**
    - **Validates: Requirements 6.2**

  - [ ]\* 11.6 Write property test for export filtering consistency
    - **Property 15: Export Filtering Consistency**
    - **Validates: Requirements 6.3, 6.4**

  - [ ]\* 11.7 Write property test for export data completeness
    - **Property 16: Export Data Completeness**
    - **Validates: Requirements 6.5**

  - [x] 11.8 Add query and export methods to AuditLogger
    - Integrate LogQueryService into AuditLogger
    - Expose `query()` and `export()` methods
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]\* 11.9 Write unit tests for query and export
    - Test query with various filter combinations
    - Test pagination
    - Test export in JSON format
    - Test export in CSV format
    - Test export performance with 10,000 entries
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 12. Implement log rotation and compression
  - [ ] 12.1 Create LogRotationManager class
    - Create `backend/src/audit/rotationManager.ts`
    - Implement `checkRotation()` method
    - Implement `rotate()` method to archive old logs
    - Move logs older than 7 days to archive tables
    - _Requirements: 9.3, 9.4_

  - [ ] 12.2 Implement archive compression
    - Add `compressArchive()` method using pg_dump and gzip
    - Implement `cleanupOldArchives()` to remove archives older than retention period
    - _Requirements: 9.4, 9.5_

  - [ ] 12.3 Integrate rotation manager with AuditLogger
    - Add periodic rotation checks
    - Trigger rotation when size threshold reached
    - _Requirements: 9.3, 9.4, 9.5_

  - [ ]\* 12.4 Write unit tests for log rotation
    - Test rotation trigger at size threshold
    - Test archive creation
    - Test cleanup of old archives
    - Test retention period enforcement
    - _Requirements: 9.3, 9.4, 9.5_

- [ ] 13. Create API endpoints for log access
  - [ ] 13.1 Create audit log routes
    - Create `backend/src/routes/auditLogs.ts`
    - Add GET /api/audit-logs endpoint for querying
    - Add GET /api/audit-logs/export endpoint for exporting
    - Add authentication/authorization middleware
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_

  - [ ] 13.2 Wire audit log routes into Express app
    - Import and mount audit log routes in `backend/src/index.ts`
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_

  - [ ]\* 13.3 Write integration tests for API endpoints
    - Test query endpoint with various filters
    - Test export endpoint with different formats
    - Test authentication/authorization
    - Test error responses
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_

- [ ] 14. Set up property-based testing infrastructure
  - [ ] 14.1 Install and configure fast-check
    - Add fast-check to package.json
    - Configure Jest to run property tests
    - Create test utilities for generating random log data
    - _Requirements: All properties_

  - [ ] 14.2 Create property test helpers
    - Create `backend/src/audit/__tests__/generators.ts`
    - Implement arbitraries for LogEntry, contexts, configurations
    - Implement helper functions for property test assertions
    - _Requirements: All properties_

- [ ] 15. Final checkpoint - Complete system integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Documentation and environment configuration
  - [x] 16.1 Add environment variables to .env.example
    - Document all audit logging configuration options
    - Provide sensible defaults
    - _Requirements: 7.1, 7.4_

  - [x] 16.2 Update backend README with audit logging documentation
    - Document audit logging features
    - Provide usage examples
    - Document API endpoints
    - Document configuration options
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Integration tests ensure proper wiring with existing services
- The implementation uses TypeScript throughout
- PostgreSQL is used for persistent storage (existing infrastructure)
- All sensitive data is automatically redacted before logging
