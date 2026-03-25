import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Router } from "express";
import express from "express";

// ─── OpenAPI definition ───────────────────────────────────────────────────────
const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "Quipay Automation Engine API",
    version: "1.0.0",
    description:
      "REST API for the Quipay payroll automation backend. Covers health, metrics, scheduler, treasury monitor, webhooks, Slack/Discord integrations, AI command parsing, analytics, and admin RBAC endpoints.",
    contact: {
      name: "Quipay Team",
      url: "https://github.com/bakarezainab/Quipay",
    },
    license: {
      name: "ISC",
    },
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Local development server",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "JWT token required for admin endpoints. Supply via `Authorization: Bearer <token>`.",
      },
    },
    schemas: {
      // ── Shared ──────────────────────────────────────────────────────────
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Descriptive error message" },
        },
      },
      OkFalseResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: false },
          error: { type: "string" },
        },
      },
      // ── Health ──────────────────────────────────────────────────────────
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          uptime: { type: "string", example: "120s" },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2026-03-08T12:00:00.000Z",
          },
          version: { type: "string", example: "1.0.0" },
          service: {
            type: "string",
            example: "quipay-automation-engine",
          },
        },
      },
      // ── Scheduler ───────────────────────────────────────────────────────
      SchedulerStatusResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          timestamp: { type: "string", format: "date-time" },
          jobs: {
            type: "array",
            items: { type: "object" },
          },
        },
      },
      // ── Monitor ─────────────────────────────────────────────────────────
      EmployerTreasuryStatus: {
        type: "object",
        properties: {
          employer: { type: "string" },
          balance: { type: "number" },
          liabilities: { type: "number" },
          daily_burn_rate: { type: "number" },
          runway_days: { type: "number", nullable: true },
          funds_exhaustion_date: { type: "string", nullable: true },
          alert_sent: { type: "boolean" },
        },
      },
      MonitorStatusResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          employers: {
            type: "array",
            items: { $ref: "#/components/schemas/EmployerTreasuryStatus" },
          },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      // ── Webhook ─────────────────────────────────────────────────────────
      WebhookSubscription: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "d290f1ee-6c54-4b01-90e6-d701748f0851",
          },
          url: {
            type: "string",
            format: "uri",
            example: "https://example.com/hooks/quipay",
          },
          events: {
            type: "array",
            items: { type: "string" },
            example: ["withdrawal", "new_stream"],
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      RegisterWebhookRequest: {
        type: "object",
        required: ["url"],
        properties: {
          url: {
            type: "string",
            format: "uri",
            description: "The HTTPS endpoint that will receive event payloads.",
            example: "https://example.com/hooks/quipay",
          },
          events: {
            type: "array",
            items: { type: "string" },
            description:
              "List of event types to subscribe to. Defaults to all events if omitted.",
            example: ["withdrawal"],
          },
        },
      },
      // ── AI ──────────────────────────────────────────────────────────────
      AiParseRequest: {
        type: "object",
        required: ["command"],
        properties: {
          command: {
            type: "string",
            description: "Natural language payroll command.",
            example: "Pay Alice 500 USDC monthly",
          },
        },
      },
      AiExecuteRequest: {
        type: "object",
        required: ["intentId", "confirmed"],
        properties: {
          intentId: {
            type: "string",
            description: "The intent ID returned by /ai/parse.",
            example: "intent_abc123",
          },
          confirmed: {
            type: "boolean",
            description: "Set to true to execute, false to cancel.",
          },
        },
      },
      // ── Analytics ───────────────────────────────────────────────────────
      AnalyticsSummaryData: {
        type: "object",
        description: "Overall platform statistics.",
        properties: {
          total_streams: { type: "integer", example: 512 },
          active_streams: { type: "integer", example: 320 },
          completed_streams: { type: "integer", example: 150 },
          cancelled_streams: { type: "integer", example: 42 },
          total_volume: { type: "string", example: "4250000000" },
          total_withdrawn: { type: "string", example: "3100000000" },
        },
      },
      StreamRecord: {
        type: "object",
        properties: {
          stream_id: { type: "integer" },
          employer: { type: "string" },
          worker: { type: "string" },
          total_amount: { type: "string" },
          withdrawn_amount: { type: "string" },
          start_ts: { type: "integer" },
          end_ts: { type: "integer" },
          status: {
            type: "string",
            enum: ["active", "completed", "cancelled"],
          },
          closed_at: { type: "integer", nullable: true },
          ledger_created: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      TrendPoint: {
        type: "object",
        properties: {
          bucket: { type: "string", example: "2026-03-08" },
          volume: { type: "string", example: "12000" },
          stream_count: { type: "integer" },
          withdrawal_count: { type: "integer" },
        },
      },
      WithdrawalRecord: {
        type: "object",
        properties: {
          id: { type: "integer" },
          stream_id: { type: "integer" },
          worker: { type: "string" },
          amount: { type: "string" },
          ledger: { type: "integer" },
          ledger_ts: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      AddressStatsData: {
        type: "object",
        properties: {
          address: { type: "string" },
          total_streams: { type: "integer" },
          active_streams: { type: "integer" },
          completed_streams: { type: "integer" },
          cancelled_streams: { type: "integer" },
          total_volume: { type: "string" },
          total_withdrawn: { type: "string" },
          recentWithdrawals: {
            type: "array",
            items: { $ref: "#/components/schemas/WithdrawalRecord" },
          },
        },
      },
      DLQItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          job_type: { type: "string" },
          payload: { type: "object", additionalProperties: true },
          error_stack: { type: "string", nullable: true },
          context: { type: "object", additionalProperties: true },
          status: {
            type: "string",
            enum: ["pending", "replayed", "discarded"],
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      DLQListResponse: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/DLQItem" },
          },
        },
      },
      AdminRequestedByResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          requestedBy: { $ref: "#/components/schemas/AdminUserInfo" },
        },
      },
      AdminRequestedByBodyResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          requestedBy: { $ref: "#/components/schemas/AdminUserInfo" },
          body: { type: "object", additionalProperties: true },
        },
      },
      // ── Admin ───────────────────────────────────────────────────────────
      AdminUserInfo: {
        type: "object",
        properties: {
          id: { type: "string" },
          role: { type: "integer", example: 2 },
          email: { type: "string", nullable: true },
        },
      },
    },
  },
  paths: {
    // ─── System ─────────────────────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        description:
          "Returns the operational status, uptime, and version of the automation engine.",
        operationId: "getHealth",
        responses: {
          200: {
            description: "Service is healthy.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/metrics": {
      get: {
        tags: ["System"],
        summary: "Prometheus metrics",
        description:
          "Exports transaction processing metrics (counts, rates, latency) in Prometheus exposition format.",
        operationId: "getMetrics",
        responses: {
          200: {
            description: "Prometheus-formatted metrics text.",
            content: { "text/plain": { schema: { type: "string" } } },
          },
          500: { description: "Metrics collection error." },
        },
      },
    },
    "/scheduler/status": {
      get: {
        tags: ["Scheduler"],
        summary: "Scheduler status",
        description:
          "Returns the status of the payroll scheduler and all active cron jobs.",
        operationId: "getSchedulerStatus",
        responses: {
          200: {
            description: "Scheduler status returned.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SchedulerStatusResponse",
                },
              },
            },
          },
        },
      },
    },
    "/monitor/status": {
      get: {
        tags: ["Monitor"],
        summary: "Treasury monitor status",
        description:
          "Runs a treasury health check cycle and returns the result for all tracked employer addresses.",
        operationId: "getMonitorStatus",
        responses: {
          200: {
            description: "Monitor cycle completed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MonitorStatusResponse" },
              },
            },
          },
          500: {
            description: "Monitor cycle failed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    // ─── Webhooks ────────────────────────────────────────────────────────────
    "/webhooks": {
      post: {
        tags: ["Webhooks"],
        summary: "Register a webhook",
        description:
          "Subscribe an HTTPS endpoint to receive real-time event notifications (e.g., new payroll streams, withdrawals).",
        operationId: "registerWebhook",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterWebhookRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Webhook registered.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    subscription: {
                      $ref: "#/components/schemas/WebhookSubscription",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Invalid request — missing or malformed URL.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      get: {
        tags: ["Webhooks"],
        summary: "List registered webhooks",
        description: "Returns all currently active webhook subscriptions.",
        operationId: "listWebhooks",
        responses: {
          200: {
            description: "List of subscriptions.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    subscriptions: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/WebhookSubscription",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/webhooks/{id}": {
      delete: {
        tags: ["Webhooks"],
        summary: "Delete a webhook",
        description: "Removes a webhook subscription by its UUID.",
        operationId: "deleteWebhook",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Webhook subscription ID.",
          },
        ],
        responses: {
          200: {
            description: "Webhook deleted.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                },
              },
            },
          },
          404: {
            description: "Webhook not found.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    // ─── Slack ───────────────────────────────────────────────────────────────
    "/slack/command": {
      post: {
        tags: ["Integrations"],
        summary: "Slack slash command handler",
        description:
          "Handles `/quipay` slash commands sent from Slack. Supports the `status` sub-command which returns current treasury balance and liability.",
        operationId: "slackCommand",
        requestBody: {
          description:
            "Slack sends `application/x-www-form-urlencoded`; pass `text` as the command sub-command string.",
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    description: "The sub-command text (e.g., `status`).",
                    example: "status",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Slack Block Kit JSON response.",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    // ─── Discord ─────────────────────────────────────────────────────────────
    "/discord/interactions": {
      post: {
        tags: ["Integrations"],
        summary: "Discord interactions webhook",
        description:
          "Handles Discord interaction payloads (PING and APPLICATION_COMMAND). Supports the `status` slash command.",
        operationId: "discordInteractions",
        parameters: [
          {
            name: "X-Signature-Ed25519",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "ED25519 signature provided by Discord.",
          },
          {
            name: "X-Signature-Timestamp",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "Timestamp used for signature verification.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  type: {
                    type: "integer",
                    description: "Interaction type (1 = PING, 2 = command).",
                    example: 2,
                  },
                  id: { type: "string" },
                  data: {
                    type: "object",
                    properties: { name: { type: "string", example: "status" } },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Interaction response.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          400: {
            description: "Unknown or invalid interaction.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    // ─── AI ──────────────────────────────────────────────────────────────────
    "/ai/parse": {
      post: {
        tags: ["AI Gateway"],
        summary: "Parse a natural language command",
        description:
          "Translates a conversational payroll instruction into a structured contract-call intent.",
        operationId: "aiParse",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AiParseRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Parsed intent object.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          400: {
            description: "Missing or invalid command string.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "AI gateway error.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/ai/execute": {
      post: {
        tags: ["AI Gateway"],
        summary: "Execute an AI-parsed command",
        description:
          "Confirms or cancels an AI-parsed intent. When `confirmed` is `true`, the intent is forwarded to the transaction execution engine.",
        operationId: "aiExecute",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AiExecuteRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Execution result or cancellation acknowledgement.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: { type: "string" },
                    txHash: {
                      type: "string",
                      example: "SIMULATED_TX_HASH_abc123",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    // ─── Analytics ───────────────────────────────────────────────────────────
    "/analytics/summary": {
      get: {
        tags: ["Analytics"],
        summary: "Overall platform summary",
        description:
          "Returns aggregate stream counts, total payroll volume, and total withdrawals. Results are cached for 5 minutes.",
        operationId: "getAnalyticsSummary",
        responses: {
          200: {
            description: "Summary data.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    data: {
                      $ref: "#/components/schemas/AnalyticsSummaryData",
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Database query error.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseResponse" },
              },
            },
          },
          503: {
            description: "Analytics unavailable — DATABASE_URL not configured.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/analytics/streams": {
      get: {
        tags: ["Analytics"],
        summary: "List payroll streams",
        description:
          "Paginated list of payroll streams. Filter by `employer` or `worker` Stellar address, and optionally by `status`.",
        operationId: "listStreams",
        parameters: [
          {
            name: "employer",
            in: "query",
            schema: { type: "string" },
            description: "Employer Stellar address filter.",
          },
          {
            name: "worker",
            in: "query",
            schema: { type: "string" },
            description: "Worker Stellar address filter.",
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["active", "completed", "cancelled"],
            },
            description: "Stream status filter.",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50, maximum: 200 },
            description: "Number of results to return (max 200).",
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0 },
            description: "Pagination offset.",
          },
        ],
        responses: {
          200: {
            description: "Paginated stream list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/StreamRecord" },
                    },
                    meta: {
                      type: "object",
                      properties: {
                        limit: { type: "integer" },
                        offset: { type: "integer" },
                        count: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          503: { description: "Database not configured." },
        },
      },
    },
    "/analytics/trends": {
      get: {
        tags: ["Analytics"],
        summary: "Payroll volume trends",
        description:
          "Time-series payroll volume data, optionally filtered by address. Results are cached for 5 minutes.",
        operationId: "getAnalyticsTrends",
        parameters: [
          {
            name: "address",
            in: "query",
            schema: { type: "string" },
            description:
              "Optional Stellar address to scope trends to a single employer/worker.",
          },
          {
            name: "granularity",
            in: "query",
            schema: {
              type: "string",
              enum: ["daily", "weekly"],
              default: "daily",
            },
            description: "Aggregation granularity.",
          },
        ],
        responses: {
          200: {
            description: "Trend data points.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TrendPoint" },
                    },
                    meta: {
                      type: "object",
                      properties: {
                        granularity: { type: "string", example: "daily" },
                      },
                    },
                  },
                },
              },
            },
          },
          503: { description: "Database not configured." },
        },
      },
    },
    "/analytics/employers/{address}": {
      get: {
        tags: ["Analytics"],
        summary: "Employer stats",
        description:
          "Returns payroll statistics for a specific employer Stellar address. Cached for 1 minute.",
        operationId: "getEmployerStats",
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The employer's Stellar account address.",
          },
        ],
        responses: {
          200: {
            description: "Employer analytics data.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/AddressStatsData" },
                  },
                },
              },
            },
          },
          503: { description: "Database not configured." },
        },
      },
    },
    "/analytics/workers/{address}": {
      get: {
        tags: ["Analytics"],
        summary: "Worker stats",
        description:
          "Returns payroll statistics for a specific worker Stellar address. Cached for 1 minute.",
        operationId: "getWorkerStats",
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The worker's Stellar account address.",
          },
        ],
        responses: {
          200: {
            description: "Worker analytics data.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/AddressStatsData" },
                  },
                },
              },
            },
          },
          503: { description: "Database not configured." },
        },
      },
    },
    // ─── Admin ───────────────────────────────────────────────────────────────
    "/admin/me": {
      get: {
        tags: ["Admin"],
        summary: "Get current authenticated user",
        description:
          "Returns the identity of the currently authenticated user based on their JWT token.",
        operationId: "adminGetMe",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Authenticated user info.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/AdminUserInfo" },
                  },
                },
              },
            },
          },
          401: { description: "Missing or invalid JWT token." },
        },
      },
    },
    "/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "List all users (admin only)",
        description:
          "Returns a paginated list of all registered users. Requires the `admin` or `superadmin` role.",
        operationId: "adminListUsers",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "User list.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AdminRequestedByResponse",
                },
              },
            },
          },
          401: { description: "Unauthenticated." },
          403: { description: "Insufficient role." },
        },
      },
    },
    "/admin/analytics": {
      get: {
        tags: ["Admin"],
        summary: "Aggregated analytics (admin only)",
        description:
          "Returns aggregated platform analytics visible to admin users.",
        operationId: "adminGetAnalytics",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Analytics data.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AdminRequestedByResponse",
                },
              },
            },
          },
          401: { description: "Unauthenticated." },
          403: { description: "Insufficient role." },
        },
      },
    },
    "/admin/users/{id}/suspend": {
      post: {
        tags: ["Admin"],
        summary: "Suspend a user (superadmin only)",
        description:
          "Suspends a user account by ID. Requires the `superadmin` role.",
        operationId: "adminSuspendUser",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "User ID to suspend.",
          },
        ],
        responses: {
          200: {
            description: "User suspended.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AdminRequestedByResponse",
                },
              },
            },
          },
          401: { description: "Unauthenticated." },
          403: { description: "Insufficient role." },
        },
      },
    },
    "/admin/users/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Delete a user (superadmin only)",
        description:
          "Permanently deletes a user account. Requires the `superadmin` role. This action is irreversible.",
        operationId: "adminDeleteUser",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "User ID to delete.",
          },
        ],
        responses: {
          200: {
            description: "User deleted.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AdminRequestedByResponse",
                },
              },
            },
          },
          401: { description: "Unauthenticated." },
          403: { description: "Insufficient role." },
        },
      },
    },
    "/admin/scheduler/override": {
      get: {
        tags: ["Admin"],
        summary: "View scheduler override queue (admin only)",
        description: "Returns all pending manual payroll override jobs.",
        operationId: "adminGetSchedulerOverride",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Override queue.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AdminRequestedByResponse",
                },
              },
            },
          },
          401: { description: "Unauthenticated." },
          403: { description: "Insufficient role." },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "Create a manual payroll override (superadmin only)",
        description:
          "Queues a manual payroll override for immediate execution. Requires the `superadmin` role.",
        operationId: "adminCreateSchedulerOverride",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description:
                  "Override payload — contents depend on the stream being overridden.",
                example: { streamId: "str_001", amount: "1000", token: "USDC" },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Override applied.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AdminRequestedByBodyResponse",
                },
              },
            },
          },
          401: { description: "Unauthenticated." },
          403: { description: "Insufficient role." },
        },
      },
    },
    "/admin/dlq": {
      get: {
        tags: ["Admin"],
        summary: "List DLQ items (admin only)",
        description: "Returns all pending Dead Letter Queue items.",
        operationId: "adminListDlqItems",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0 },
          },
        ],
        responses: {
          200: {
            description: "DLQ items list.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DLQListResponse" },
              },
            },
          },
          401: { description: "Unauthenticated." },
          403: { description: "Insufficient role." },
          500: {
            description: "Failed to fetch DLQ items.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/admin/dlq/{id}/replay": {
      post: {
        tags: ["Admin"],
        summary: "Replay a DLQ item (superadmin only)",
        description: "Manually replays a terminally failed job from the DLQ.",
        operationId: "adminReplayDlqItem",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "DLQ item replayed.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AdminRequestedByResponse",
                },
              },
            },
          },
          400: { description: "DLQ item already processed or invalid." },
          401: { description: "Unauthenticated." },
          403: { description: "Insufficient role." },
          404: {
            description: "DLQ item not found.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "Failed to replay DLQ item.",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/admin/dlq/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Discard a DLQ item (superadmin only)",
        description:
          "Permanently discards a DLQ item from the Dead Letter Queue.",
        operationId: "adminDiscardDlqItem",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "DLQ item discarded.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                },
              },
            },
          },
          401: { description: "Unauthenticated." },
          403: { description: "Insufficient role." },
          500: { description: "Failed to discard DLQ item." },
        },
      },
    },
    // ─── Test ────────────────────────────────────────────────────────────────
    "/test/simulate-tx": {
      post: {
        tags: ["Testing"],
        summary: "Simulate a transaction (test only)",
        description:
          "Records a mock transaction into the metrics system for testing dashboards and alerting pipelines.",
        operationId: "testSimulateTx",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["success", "failure"],
                    default: "success",
                  },
                  latency: {
                    type: "number",
                    description: "Simulated transaction latency in seconds.",
                    example: 0.5,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Transaction tracked.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    "/test/concurrent-tx": {
      post: {
        tags: ["Testing"],
        summary: "Concurrent nonce stress test (test only)",
        description:
          "Requests 50 concurrent sequence numbers from the NonceManager to validate the queue-based bottleneck fix.",
        operationId: "testConcurrentTx",
        responses: {
          200: {
            description: "All nonces generated successfully.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: { type: "string" },
                    durationMs: { type: "integer", example: 230 },
                    nonces: {
                      type: "array",
                      items: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Nonce generation failed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: "System", description: "Health, uptime, and metrics endpoints." },
    {
      name: "Scheduler",
      description: "Payroll job scheduler status and control.",
    },
    {
      name: "Monitor",
      description: "Treasury health monitoring for employer wallets.",
    },
    {
      name: "Webhooks",
      description: "Subscribe external endpoints to Quipay events.",
    },
    {
      name: "Integrations",
      description: "Slack and Discord bot integration handlers.",
    },
    {
      name: "AI Gateway",
      description:
        "Natural language command parsing and on-chain execution gateway.",
    },
    {
      name: "Analytics",
      description:
        "Payroll stream analytics, trends, and per-address statistics.",
    },
    {
      name: "Admin",
      description: "RBAC-protected admin and super-admin management endpoints.",
    },
    {
      name: "Testing",
      description:
        "Development-only endpoints for stress testing and metric simulation.",
    },
  ],
};

// Build the final OpenAPI spec (swagger-jsdoc used for future inline JSDoc expansion)
const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  // Routes are fully described above in the definition; no file-scanning needed.
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);

// Build Express router that serves the Swagger UI at /docs
const docsRouter: Router = express.Router();

docsRouter.use("/", swaggerUi.serve);
docsRouter.get(
  "/",
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Quipay API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "list",
      filter: true,
    },
  }),
);

// Also expose the raw JSON spec at /docs/spec.json
docsRouter.get("/spec.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

export { docsRouter };
