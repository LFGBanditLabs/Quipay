# Quipay Backend

The Quipay automation engine — an Express/TypeScript API server that orchestrates payroll streams on the Stellar/Soroban network. It exposes a REST API, a Socket.IO WebSocket server, and a suite of background workers that keep on-chain state in sync with the PostgreSQL database.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [Architecture Overview](#architecture-overview)
4. [Key Environment Variables](#key-environment-variables)
5. [Testing](#testing)
6. [Useful Scripts](#useful-scripts)

---

## Prerequisites

| Dependency | Minimum version | Notes |
|---|---|---|
| **Node.js** | 22 (LTS) | Matches the `node:22-alpine` Docker image |
| **npm** | 10+ | Bundled with Node 22 |
| **PostgreSQL** | 16 | Schema is in `src/db/schema.sql`; migrations via Drizzle Kit |
| **Redis** | 7 *(optional)* | Required only for distributed rate-limiting. Falls back to in-memory if `REDIS_URL` is absent |
| **Docker + Docker Compose** | 24+ | For the containerised stack and integration-test containers |
| **TypeScript** | 5.8 | Installed as a dev dependency — no global install needed |

> **Stellar / Soroban access** — A Soroban-compatible RPC endpoint is required at runtime (`STELLAR_RPC_URL`). The public testnet endpoint (`https://soroban-testnet.stellar.org`) works for local development and is the default.

---

## Local Setup

### 1. Clone and install

```bash
git clone git@github.com:Wilfred007/Quipay.git
cd Quipay/backend
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in at least the required values (see [Key Environment Variables](#key-environment-variables)). For a minimal local setup you only need `DATABASE_URL`; every other variable has a safe development default.

### 3. Start PostgreSQL

**Option A — Docker (recommended)**

```bash
docker run --rm \
  -e POSTGRES_DB=quipay \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:16-alpine
```

**Option B — local install**

```bash
createdb quipay
```

Then set `DATABASE_URL=postgresql://user:password@localhost:5432/quipay` in your `.env`.

### 4. Run database migrations

```bash
# Generate migration SQL from the Drizzle schema (only needed after schema changes)
npm run migration:generate

# Apply all pending migrations
npm run migrate
```

### 5. (Optional) Seed the database

```bash
npm run seed
```

### 6. Start the development server

```bash
npm run dev
```

The server starts on `http://localhost:3001` by default (`PORT` env var). Hot-reloading is provided by `ts-node-dev`.

**Verify it is running:**

```bash
curl http://localhost:3001/health
```

You should receive a JSON body with `"status":"ok"`.

### Docker Compose (full stack)

If a `docker-compose.yml` is present at the repo root, the entire stack (backend + PostgreSQL + Redis) can be started with:

```bash
docker compose up --build
```

The backend `Dockerfile` exposes port `3001` and performs a health check against `/health`.

---

## Architecture Overview

The backend is composed of **one HTTP/WebSocket process** and **five background subsystems** that are all started inside the same Node.js process on boot.

```
┌──────────────────────────────────────────────────────────┐
│                     Express HTTP Server                   │
│  REST API · Swagger UI (/api-docs) · Metrics (/metrics)  │
│  Health (/health) · Webhooks · Admin · Analytics         │
└───────────────────────┬──────────────────────────────────┘
                        │ attaches to same http.Server
┌───────────────────────▼──────────────────────────────────┐
│               Socket.IO WebSocket Server                  │
│  JWT-authenticated · rooms: employer / worker / stream   │
│  Events: stream_created, withdrawal, stream_cancelled…   │
└──────────────────────────────────────────────────────────┘

Background workers (started after HTTP server is listening)
┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
│  Scheduler   │ │   Monitor    │ │   Event Indexer      │
│ (scheduler/) │ │ (monitor/)   │ │ (services/eventIndex)│
└──────────────┘ └──────────────┘ └──────────────────────┘
┌──────────────┐ ┌──────────────────────────────────────┐
│    Syncer    │ │      Stellar Listener (real-time)    │
│ (syncer.ts)  │ │         (stellarListener.ts)         │
└──────────────┘ └──────────────────────────────────────┘
```

### Scheduler (`src/scheduler/scheduler.ts`)

Reads `payroll_schedules` from PostgreSQL and registers a `node-cron` task for each active schedule. Every `SCHEDULER_POLL_MS` (default **60 s**) it reconciles the in-memory job map against the DB — adding new jobs, removing cancelled ones, and rescheduling cron-expression changes. It also runs:

- **Webhook retry runner** — polls `webhook_outbound_events` every `WEBHOOK_RETRY_POLL_MS` (default **10 s**) and retries failed deliveries in batches.
- **Worker notification crons** — checks cliff unlocks (`*/30 * * * *`), low treasury runway (`0 */2 * * *`), and ending streams (`0 * * * *`).

All payroll execution tasks use PostgreSQL advisory locks to prevent duplicate processing across horizontal replicas.

### Monitor (`src/monitor/monitor.ts`)

Runs a treasury health cycle every `MONITOR_INTERVAL_MS` (default **5 min**). For every employer it:

1. Fetches treasury balances and active stream liabilities.
2. Calculates **daily burn rate** and **runway days**.
3. Fires a `sendTreasuryAlert` notification when runway < `TREASURY_RUNWAY_ALERT_DAYS` (default **7**).
4. Persists a snapshot row to `treasury_monitor_log` and the audit log.

The `/monitor/status` endpoint manually triggers one cycle and returns the result (protected by rate-limiting and an optional bearer token).

### Event Indexer / Stellar Listener (`src/services/eventIndexer.ts`, `src/stellarListener.ts`)

Two complementary Soroban event ingestion paths:

- **Stellar Listener** — real-time poll every **5 s** against the Soroban RPC for new ledger events. Parses topics, classifies them (`withdrawal`, `new_stream`), and fans out webhook notifications. Falls back to simulated events every 15 s when `QUIPAY_CONTRACT_ID` is not set.
- **Event Indexer** — driven by `startEventIndexer` from `services/eventIndexer.ts`; handles backfill and structured persistence.

### Syncer (`src/syncer.ts`)

Historical backfill engine. Reads the last synced ledger from `sync_cursors`, fetches Soroban events in batches of 200, upserts stream/withdrawal rows via `db/queries`, and advances the cursor. Batches are enqueued through `queue/asyncQueue` with up to 3 retries; failed batches go to the dead-letter queue and the cursor is advanced to avoid a permanent stall. Emits WebSocket events for each ingested record.

The syncer polls every `SYNCER_POLL_MS` (default **10 s**) and uses an advisory lock (`888888`) so only one replica processes events at a time.

### WebSocket Server (`src/websocket/server.ts`)

Socket.IO server mounted on the same HTTP server at path `/socket.io`. Clients authenticate via a JWT passed in `socket.handshake.auth.token`. After auth, clients are placed into rooms:

| Room pattern | Receives |
|---|---|
| `employer:<id>` | All stream events for that employer |
| `worker:<address>` | All stream events for that worker |
| `stream:<id>` | Events for a specific stream |
| `admin` | All events (admin role) |

Clients can also subscribe/unsubscribe to individual streams with `subscribe:stream` / `unsubscribe:stream` events.

---

## Key Environment Variables

Full list with defaults in [`backend/.env.example`](.env.example). The most important variables are documented below.

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP listen port |
| `ALLOWED_ORIGINS` | *(see example)* | Comma-separated CORS whitelist. **Required in production** — the server exits at startup if missing when `NODE_ENV=production` |
| `NODE_ENV` | — | `development` disables certain strict guards (e.g. `HOT_WALLET_ACCOUNT` placeholder check) |

### Database

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string, e.g. `postgresql://user:password@localhost:5432/quipay` |

### Stellar / Soroban

| Variable | Default | Description |
|---|---|---|
| `STELLAR_NETWORK` | `TESTNET` | `TESTNET` or `PUBLIC` |
| `STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `PUBLIC_STELLAR_RPC_URL` | same as above | Used by the syncer and listener |
| `QUIPAY_CONTRACT_ID` | — | Soroban contract address. When absent, the listener runs in simulation mode |
| `HOT_WALLET_ACCOUNT` | — | Stellar account for the nonce manager. **Required outside development** |
| `AUTOMATION_GATEWAY_ADDRESS` | — | On-chain automation gateway contract address |
| `PAYROLL_STREAM_ADDRESS` | — | On-chain payroll stream contract address |
| `SYNC_START_LEDGER` | `0` | Ledger to begin historical backfill from (0 = full history) |

### Redis (optional)

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | — | Redis connection URL. When unset, rate-limiting uses an in-memory store |

### Scheduler tuning

| Variable | Default | Description |
|---|---|---|
| `SCHEDULER_POLL_MS` | `60000` | How often the scheduler reconciles active jobs (ms) |
| `WEBHOOK_RETRY_POLL_MS` | `10000` | How often failed webhooks are retried (ms) |
| `WEBHOOK_RETRY_BATCH_SIZE` | `50` | Max webhook events retried per cycle |
| `MONITOR_INTERVAL_MS` | `300000` | Treasury monitor cycle interval (ms) |
| `TREASURY_RUNWAY_ALERT_DAYS` | `7` | Runway threshold that triggers a treasury alert |
| `SYNCER_POLL_MS` | `10000` | Syncer poll interval (ms) |

### Secrets / Vault

| Variable | Default | Description |
|---|---|---|
| `VAULT_ADDR` | `http://localhost:8200` | HashiCorp Vault address |
| `VAULT_TOKEN` | — | Vault token |
| `VAULT_SECRET_PATH` | `quipay/keys` | Path to secrets in Vault |
| `KEY_ROTATION_ENABLED` | `false` | Enable the key rotation scheduler |

### Notifications / Integrations

| Variable | Description |
|---|---|
| `SENDGRID_API_KEY` | SendGrid API key for email delivery |
| `SENDGRID_FROM_EMAIL` | Sender address (default `noreply@quipay.com`) |
| `DISCORD_PUBLIC_KEY` | Discord slash-command verification key |
| `SLACK_SIGNING_SECRET` | Slack webhook signing secret |
| `OPENAI_API_KEY` | OpenAI API key used by the `/ai` router |
| `KYB_API_URL` / `KYB_API_KEY` | External KYB provider. When absent, a deterministic mock verifier is used |

### WebSocket

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `dev-secret-key-change-in-production` | Secret used to verify WebSocket JWTs. **Must be changed in production** |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin for Socket.IO |

---

## Testing

### Unit tests

Run all unit tests (excludes integration suites):

```bash
npm test
# or explicitly
npm run test:unit
```

Tests live alongside source files as `*.test.ts` files or inside `src/__tests__/`. Jest is configured in `jest.config.js` with `ts-jest` and a 60-second timeout to accommodate slower container starts.

Tests run **serially** (`maxWorkers: 1`) to avoid port or container conflicts.

### Integration tests

Integration tests spin up a real PostgreSQL instance using **Testcontainers** (`@testcontainers/postgresql`). Docker must be running.

```bash
npm run test:integration
```

The `TestDatabase` helper in `src/__tests__/helpers/testcontainer.ts` manages the container lifecycle:

- `setupTestDatabase()` — call in `beforeAll()`. Starts a `postgres:16-alpine` container (or re-uses an existing `DATABASE_URL` if set), applies `src/db/schema.sql`.
- `cleanTestDatabase()` — call in `afterEach()` to truncate all tables for test isolation.
- `teardownTestDatabase()` — call in `afterAll()` to stop the container.

**Example integration test scaffold:**

```typescript
import {
  setupTestDatabase,
  cleanTestDatabase,
  teardownTestDatabase,
} from '../helpers/testcontainer';

beforeAll(async () => {
  await setupTestDatabase();
});

afterEach(async () => {
  await cleanTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});
```

#### Testcontainers requirements

- Docker daemon must be running and reachable by the current user.
- On macOS with Docker Desktop, ensure **"Allow the default Docker socket to be used"** is enabled in Docker Desktop → Settings → Advanced.
- On CI, set `DOCKER_HOST` or use the `testcontainers.properties` approach if the Docker socket is non-standard.
- If you already have a PostgreSQL instance you'd like to use instead, set `DATABASE_URL` before running — the helper will skip container creation and use that connection directly.

### Watch mode

```bash
npm run test:watch
```

---

## Useful Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output (`dist/index.js`) |
| `npm run migrate` | Apply pending Drizzle migrations |
| `npm run migrate:status` | Show migration status |
| `npm run migrate:rollback` | Roll back the last migration |
| `npm run migration:generate` | Generate a new migration from schema changes |
| `npm run migration:push` | Push schema directly (dev only) |
| `npm run seed` | Seed the database with sample data |
