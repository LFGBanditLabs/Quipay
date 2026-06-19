# Implementation Tasks: Invoice Generation and PDF Payslip Export

## Overview

This task list provides a step-by-step implementation plan for the PDF payslip generation feature. Each task builds on previous work and references specific requirements from the design document. Tasks marked with `*` are optional and can be skipped for faster MVP delivery.

## Tasks

- [x] 1. Set up database schema and storage infrastructure
  - Create database migrations for employer_branding and payslip_records tables
  - Set up S3 bucket with appropriate IAM permissions for logo storage
  - Configure Redis cache for branding settings
  - Add database indexes for performance optimization
  - _Requirements: 9.1, 9.2, 2.3_

- [x] 2. Implement BrandingService for logo and color management
  - [x] 2.1 Implement uploadLogo method with file validation
    - Validate file type (PNG, JPG, SVG) and size (under 2MB)
    - Upload to S3 with retry logic
    - Store logo URL and metadata in database
    - _Requirements: 2.2, 2.3_

  - [ ]\* 2.2 Write property test for image file validation
    - **Property 3: Image File Validation**
    - **Validates: Requirements 2.2**

  - [ ]\* 2.3 Write property test for logo storage and association
    - **Property 4: Logo Storage and Association**
    - **Validates: Requirements 2.3**

  - [x] 2.4 Implement updateColors method with hex validation
    - Validate hex color format (#RRGGBB)
    - Store colors in database
    - Invalidate cache on update
    - _Requirements: 3.2, 3.3_

  - [ ]\* 2.5 Write property test for hex color validation
    - **Property 7: Hex Color Validation**
    - **Validates: Requirements 3.2**

  - [ ]\* 2.6 Write property test for color persistence
    - **Property 8: Color Persistence and Retrieval**
    - **Validates: Requirements 3.3**

  - [x] 2.7 Implement getBranding method with caching
    - Query database for branding settings
    - Cache results in Redis
    - Return default colors if not set
    - _Requirements: 4.1, 3.3_

  - [x] 2.8 Implement deleteLogo method
    - Remove logo from S3
    - Update database record
    - Invalidate cache
    - _Requirements: 2.6_

  - [ ]\* 2.9 Write property test for logo removal
    - **Property 6: Logo Removal Round-Trip**
    - **Validates: Requirements 2.6**

  - [ ]\* 2.10 Write property test for logo replacement
    - **Property 5: Logo Replacement**
    - **Validates: Requirements 2.4**

- [x] 3. Implement SignatureService for cryptographic operations
  - [x] 3.1 Implement signPayslip method using Ed25519
    - Generate signature from payslip data
    - Use secure key storage (Vault/Secrets Manager)
    - Handle signing errors gracefully
    - _Requirements: 5.1, 5.2_

  - [ ]\* 3.2 Write property test for signature generation
    - **Property 10: Signature Generation**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 3.3 Implement verifySignature method
    - Verify signature against payslip data
    - Return boolean result
    - _Requirements: 6.2, 6.3_

  - [ ]\* 3.4 Write property test for signature verification round-trip
    - **Property 11: Signature Verification Round-Trip**
    - **Validates: Requirements 6.2, 6.3**

  - [ ]\* 3.5 Write property test for invalid signature detection
    - **Property 12: Invalid Signature Detection**
    - **Validates: Requirements 6.4**

  - [x] 3.6 Implement generateQRCode method
    - Generate QR code image from signature string
    - Return as Buffer for PDF embedding
    - _Requirements: 5.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement PDFGeneratorService for payslip creation
  - [x] 5.1 Set up PDFKit library and create basic template
    - Install and configure PDFKit
    - Create payslip layout structure
    - Add header, body, and footer sections
    - _Requirements: 1.3, 1.4_

  - [x] 5.2 Implement generatePayslip method with all required fields
    - Include worker address, employer address, payment amounts
    - Include stream period (start/end dates)
    - Include withdrawal history table
    - Include payslip ID and generation timestamp
    - _Requirements: 1.3, 1.4_

  - [ ]\* 5.3 Write property test for PDF content completeness
    - **Property 1: PDF Content Completeness**
    - **Validates: Requirements 1.3, 1.4**

  - [x] 5.4 Implement logo embedding in PDF
    - Fetch logo from S3 or cache
    - Embed in PDF header
    - Handle missing logo gracefully
    - _Requirements: 4.2_

  - [x] 5.5 Implement color theming in PDF
    - Apply primary and secondary colors to design elements
    - Use default colors when not set
    - _Requirements: 4.3_

  - [ ]\* 5.6 Write property test for branding application
    - **Property 9: Branding Application**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 5.7 Add signature and QR code to PDF
    - Embed QR code image
    - Add signature text string
    - Include verification instructions
    - _Requirements: 5.3, 5.4_

  - [x] 5.8 Implement graceful degradation for logo retrieval failures
    - Catch S3 errors
    - Log warning
    - Generate PDF without logo
    - _Requirements: 12.2_

  - [x] 5.9 Implement graceful degradation for signature generation failures
    - Catch crypto errors
    - Log warning
    - Generate PDF with "Signature unavailable" message
    - _Requirements: 12.3, 5.5_

  - [x]\* 5.10 Write unit tests for edge cases
    - Test empty withdrawal history
    - Test logo retrieval failure
    - Test signature generation failure
    - _Requirements: 12.2, 12.3_

- [ ] 6. Implement database queries for branding and payslips
  - [ ] 6.1 Create employer branding queries
    - upsertEmployerBranding (insert or update)
    - getEmployerBranding by address
    - deleteEmployerLogo by address
    - _Requirements: 2.3, 3.3, 2.6_

  - [ ] 6.2 Create payslip record queries
    - insertPayslipRecord with all fields
    - getPayslipByStreamId for idempotency
    - getPayslipBySignature for verification
    - queryPayslipRecords with filters (worker, employer, date range)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]\* 6.3 Write property test for payslip record persistence
    - **Property 18: Payslip Record Persistence**
    - **Validates: Requirements 9.1, 9.2**

  - [ ]\* 6.4 Write property test for payslip idempotency
    - **Property 19: Payslip Idempotency**
    - **Validates: Requirements 9.3**

  - [ ]\* 6.5 Write property test for query filtering
    - **Property 20: Payslip Query Filtering**
    - **Validates: Requirements 9.4**

  - [ ]\* 6.6 Write property test for soft-delete preservation
    - **Property 21: Soft-Delete Preservation**
    - **Validates: Requirements 9.5**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement payslip API endpoint
  - [ ] 8.1 Create GET /api/workers/:address/payslip/:streamId route
    - Set up Express route with authentication middleware
    - Extract address and streamId from params
    - _Requirements: 7.1_

  - [ ]\* 8.2 Write property test for authentication enforcement
    - **Property 13: Authentication Enforcement**
    - **Validates: Requirements 7.1, 8.6**

  - [ ] 8.3 Implement authorization check
    - Verify authenticated user matches worker address
    - Return 403 if mismatch
    - _Requirements: 7.2, 7.3_

  - [ ]\* 8.4 Write property test for authorization enforcement
    - **Property 14: Authorization Enforcement**
    - **Validates: Requirements 7.2, 7.3**

  - [ ] 8.5 Implement stream existence validation
    - Query database for stream
    - Return 404 if not found
    - _Requirements: 7.4_

  - [ ]\* 8.6 Write property test for stream existence validation
    - **Property 15: Stream Existence Validation**
    - **Validates: Requirements 7.4**

  - [ ] 8.7 Implement payslip generation or retrieval logic
    - Check if payslip already exists in database
    - If exists, return cached version
    - If not, fetch stream data and withdrawals
    - Fetch employer branding settings
    - Generate signature
    - Generate PDF
    - Store payslip record
    - _Requirements: 9.3, 1.2_

  - [ ] 8.8 Set proper HTTP response headers
    - Content-Type: application/pdf
    - Content-Disposition with filename
    - X-Payslip-ID header
    - X-Signature header
    - _Requirements: 7.6, 1.5_

  - [ ]\* 8.9 Write property test for PDF response headers
    - **Property 16: PDF Response Headers**
    - **Validates: Requirements 7.6**

  - [ ]\* 8.10 Write property test for filename format
    - **Property 2: Filename Format Consistency**
    - **Validates: Requirements 1.5**

  - [ ] 8.11 Implement error handling and logging
    - Catch PDF generation errors
    - Log with full context (stream ID, user, timestamp)
    - Return 500 with user-friendly message
    - Emit metrics
    - _Requirements: 12.1, 12.4, 12.5, 7.5_

  - [ ]\* 8.12 Write property test for error logging completeness
    - **Property 25: Error Logging Completeness**
    - **Validates: Requirements 12.1**

  - [ ]\* 8.13 Write property test for metrics emission
    - **Property 26: Metrics Emission**
    - **Validates: Requirements 12.5**

- [ ] 9. Implement branding API endpoints
  - [ ] 9.1 Create POST /api/employers/:address/branding/logo route
    - Set up route with multipart/form-data support
    - Add authentication middleware
    - Validate employer address matches authenticated user
    - _Requirements: 8.1, 8.6_

  - [ ] 9.2 Implement logo upload handler
    - Extract file from request
    - Validate file type and size
    - Call BrandingService.uploadLogo
    - Return logo URL and metadata
    - _Requirements: 8.2_

  - [ ] 9.3 Create PUT /api/employers/:address/branding/colors route
    - Set up route with JSON body
    - Add authentication middleware
    - Validate employer address matches authenticated user
    - _Requirements: 8.3, 8.6_

  - [ ] 9.4 Implement color update handler
    - Extract colors from request body
    - Call BrandingService.updateColors
    - Return updated settings
    - _Requirements: 8.4_

  - [ ] 9.5 Create GET /api/employers/:address/branding route
    - Set up route with authentication
    - Call BrandingService.getBranding
    - Return all branding settings
    - _Requirements: 8.5_

  - [ ]\* 9.6 Write property test for branding API response completeness
    - **Property 17: Branding API Response Completeness**
    - **Validates: Requirements 8.2, 8.4, 8.5**

  - [ ] 9.7 Create DELETE /api/employers/:address/branding/logo route
    - Set up route with authentication
    - Call BrandingService.deleteLogo
    - Return success response
    - _Requirements: 2.6_

- [ ] 10. Implement signature verification API endpoint
  - [ ] 10.1 Create POST /api/verify-signature route
    - Set up route (no authentication required)
    - Extract signature from request body
    - _Requirements: 6.1_

  - [ ] 10.2 Implement verification handler
    - Look up payslip by signature
    - Call SignatureService.verifySignature
    - Return verification result with payslip details
    - Handle not found case
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement PayslipDownloadButton React component
  - [ ] 12.1 Create component with TypeScript interface
    - Define props: streamId, workerAddress, className, callbacks
    - Set up component structure
    - _Requirements: 10.1_

  - [ ] 12.2 Implement API call to payslip endpoint
    - Use fetch or axios to call GET /api/workers/:address/payslip/:streamId
    - Handle authentication token
    - _Requirements: 10.2_

  - [ ] 12.3 Implement state management for loading, success, error
    - Add state for loading, error message
    - Transition through states: idle → loading → success/error → idle
    - _Requirements: 10.3, 10.4_

  - [ ]\* 12.4 Write property test for component state transitions
    - **Property 22: Component State Transitions**
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**

  - [ ] 12.5 Implement file download trigger
    - Create blob from response
    - Trigger browser download
    - _Requirements: 10.5_

  - [ ]\* 12.6 Write unit tests for component
    - Test button renders correctly
    - Test loading state display
    - Test error message display
    - Test success callback
    - _Requirements: 10.2, 10.3, 10.4, 10.5_

- [ ] 13. Implement BrandingSettings React component
  - [ ] 13.1 Create component layout with logo and color sections
    - Define props: employerAddress, onSave callback
    - Create form structure
    - _Requirements: 11.1_

  - [ ] 13.2 Implement logo upload with preview
    - Add file input
    - Show preview before saving
    - Validate file client-side
    - _Requirements: 11.2, 2.5_

  - [ ] 13.3 Implement color pickers for primary and secondary colors
    - Add color input fields
    - Validate hex format client-side
    - _Requirements: 11.3_

  - [ ] 13.4 Add live preview of payslip with branding
    - Show mock payslip with current branding
    - Update preview reactively on changes
    - _Requirements: 11.3, 2.5_

  - [ ]\* 13.5 Write property test for branding preview reactivity
    - **Property 23: Branding Preview Reactivity**
    - **Validates: Requirements 11.2, 11.3**

  - [ ] 13.6 Implement save functionality
    - Call branding API endpoints
    - Show success/error feedback
    - _Requirements: 11.4_

  - [ ]\* 13.7 Write property test for branding save operation
    - **Property 24: Branding Save Operation**
    - **Validates: Requirements 11.4**

  - [ ] 13.8 Fetch and display existing branding settings on load
    - Call GET /api/employers/:address/branding
    - Populate form with existing values
    - _Requirements: 11.5_

  - [ ]\* 13.9 Write unit tests for component
    - Test component renders with existing settings
    - Test logo upload flow
    - Test color picker changes
    - Test save button
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 14. Implement SignatureVerification React component
  - [ ] 14.1 Create verification form
    - Define props: onVerificationComplete callback
    - Add input field for signature
    - Add submit button
    - _Requirements: 6.1_

  - [ ] 14.2 Implement verification API call
    - Call POST /api/verify-signature
    - Handle response
    - _Requirements: 6.2_

  - [ ] 14.3 Display verification results
    - Show success message with payslip details for valid signatures
    - Show warning for invalid signatures
    - Show not found message for unknown signatures
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]\* 14.4 Write unit tests for component
    - Test form submission
    - Test valid signature display
    - Test invalid signature warning
    - Test not found message
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 15. Integrate components into existing dashboards
  - [ ] 15.1 Add PayslipDownloadButton to WorkerDashboard
    - Import component
    - Add to stream card or detail view
    - Pass streamId and workerAddress props
    - _Requirements: 1.1_

  - [ ] 15.2 Add BrandingSettings to employer settings page
    - Import component
    - Add to settings navigation
    - Pass employerAddress prop
    - _Requirements: 2.1_

  - [ ] 15.3 Add SignatureVerification page to app routing
    - Create new route
    - Add navigation link
    - _Requirements: 6.1_

- [ ] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Set up monitoring and alerting
  - [ ] 17.1 Implement metrics emission
    - Add counters for success/error rates
    - Add histograms for latency
    - Emit metrics for all operations
    - _Requirements: 12.5_

  - [ ] 17.2 Create monitoring dashboards
    - PDF generation success rate
    - PDF generation latency (p50, p95, p99)
    - Branding upload success rate
    - Signature verification success rate
    - Error rates by type
    - _Requirements: 12.5_

  - [ ] 17.3 Configure alerts
    - Alert on error rate > 5% over 5 minutes
    - Alert on p95 latency > 5 seconds
    - Alert on signature generation failure rate > 1%
    - _Requirements: 12.5_

- [ ] 18. Write integration tests for end-to-end flows
  - [ ]\* 18.1 Write integration test for payslip generation flow
    - Create stream in test database
    - Upload employer logo
    - Request payslip via API
    - Verify PDF is generated
    - Verify database record is created
    - Request payslip again and verify cached version returned
    - _Requirements: 1.2, 9.3_

  - [ ]\* 18.2 Write integration test for branding upload flow
    - Upload logo via API
    - Verify file stored in S3
    - Verify database record created
    - Generate payslip and verify logo included
    - _Requirements: 2.2, 2.3, 4.2_

  - [ ]\* 18.3 Write integration test for signature verification flow
    - Generate payslip with signature
    - Submit signature to verification endpoint
    - Verify correct details returned
    - Test with tampered signature
    - _Requirements: 6.2, 6.3, 6.4_

- [ ] 19. Documentation and deployment preparation
  - [ ] 19.1 Write API documentation
    - Document all endpoints with OpenAPI/Swagger
    - Include request/response examples
    - Document error codes
    - _Requirements: 7.1, 8.1_

  - [ ] 19.2 Create user guides
    - Worker guide: How to download payslips
    - Employer guide: How to set up branding
    - Guide: How to verify payslip signatures
    - _Requirements: 1.1, 2.1, 6.1_

  - [ ] 19.3 Perform security review
    - Review file upload security
    - Review signature implementation
    - Check for injection vulnerabilities
    - Verify authentication/authorization
    - _Requirements: 2.2, 5.1, 7.1, 8.6_

  - [ ] 19.4 Conduct performance testing
    - Load test with 100 concurrent users
    - Verify p95 latency < 3 seconds
    - Test with various file sizes and data volumes
    - _Requirements: Performance NFR_

  - [ ] 19.5 Deploy to staging environment
    - Run database migrations
    - Deploy backend services
    - Deploy frontend changes
    - Verify all functionality works
    - _Requirements: All_

  - [ ] 19.6 Conduct user acceptance testing
    - Test worker payslip download flow
    - Test employer branding setup flow
    - Test signature verification flow
    - Gather feedback
    - _Requirements: All_

- [ ] 20. Final checkpoint and production deployment
  - Ensure all tests pass, ask the user if questions arise.
  - Deploy to production following rollout strategy
  - Monitor for 48 hours post-launch
  - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (26 total)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- All 26 correctness properties from the design document are covered
