import { rpc } from "@stellar/stellar-sdk";
import { getPool } from "./db/pool";
import { withAdvisoryLock } from "./utils/lock";
import {
  getLastSyncedLedger,
  updateSyncCursor,
  upsertStream,
  recordWithdrawal,
  getStreamById,
} from "./db/queries";
import { enqueueJob } from "./queue/asyncQueue";
import { serviceLogger } from "./audit/serviceLogger";
import { generateAndStoreProof } from "./services/proofService";
import { emitStreamEvent } from "./websocket/server";

const SOROBAN_RPC_URL =
  process.env.PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.QUIPAY_CONTRACT_ID || "";
// Optional: override the first ledger to backfill from (defaults to 0 = full history)
const SYNC_START_LEDGER = parseInt(process.env.SYNC_START_LEDGER || "0", 10);
const POLL_INTERVAL_MS = parseInt(process.env.SYNCER_POLL_MS || "10000", 10);
const BATCH_SIZE = 200; // max events per RPC call

const server = new rpc.Server(SOROBAN_RPC_URL);

let syncerStopping = false;
let syncerTimeoutId: NodeJS.Timeout | null = null;
let inFlightSyncCycle: Promise<number> | null = null;

// ─── Event parsers ────────────────────────────────────────────────────────────

/**
 * Best-effort parse of a Soroban XDR event into a structured record.
 * Returns null for unrecognised event types.
 */
const parseEvent = (
  event: rpc.Api.EventResponse,
): null | {
  kind:
    | "stream_created"
    | "withdrawal"
    | "stream_cancelled"
    | "stream_completed";
  data: Record<string, unknown>;
} => {
  try {
    const topics = event.topic;
    if (!topics || topics.length === 0) return null;

    const topicBase64 = topics[0].toXDR("base64");

    // Soroban events encode the function name / topic as a Symbol SCVal.
    // We do substring matching on the base64 for speed; a production
    // implementation would fully decode the XDR to a ScVal Symbol.
    const isCreate =
      topicBase64.includes("create") || topicBase64.includes("stream");
    const isWithdraw = topicBase64.includes("withdraw");
    const isCancel = topicBase64.includes("cancel");
    const isComplete = topicBase64.includes("complete");

    if (isComplete) {
      return {
        kind: "stream_completed",
        data: { raw: topicBase64, ledger: event.ledger },
      };
    }
    if (isCreate && !isWithdraw && !isCancel) {
      return {
        kind: "stream_created",
        data: { raw: topicBase64, ledger: event.ledger },
      };
    }
    if (isWithdraw) {
      return {
        kind: "withdrawal",
        data: { raw: topicBase64, ledger: event.ledger },
      };
    }
    if (isCancel) {
      return {
        kind: "stream_cancelled",
        data: { raw: topicBase64, ledger: event.ledger },
      };
    }
  } catch {
    // silently ignore malformed events
  }
  return null;
};

// ─── Batch ingest ─────────────────────────────────────────────────────────────

const ingestEvents = async (events: rpc.Api.EventResponse[]): Promise<void> => {
  for (const event of events) {
    const parsed = parseEvent(event);
    if (!parsed) continue;

    try {
      if (parsed.kind === "stream_created") {
        // In a real environment the XDR value would be fully decoded.
        // We insert a placeholder record so the stream row exists and
        // can be enriched by the live listener when data is available.
        await upsertStream({
          streamId: event.ledger, // placeholder until real XDR decode
          employer: (event.contractId as any).toString() || "",
          worker: (event.contractId as any).toString() || "",
          totalAmount: 0n,
          withdrawnAmount: 0n,
          startTs: 0,
          endTs: 0,
          status: "active",
          ledger: event.ledger,
        });

        // Emit WebSocket event
        emitStreamEvent(
          "stream_created",
          event.ledger.toString(),
          { ledger: event.ledger },
          (event.contractId as any).toString(),
          (event.contractId as any).toString(),
        );
      } else if (parsed.kind === "withdrawal") {
        await recordWithdrawal({
          streamId: event.ledger,
          worker: (event.contractId as any).toString() || "",
          amount: 0n,
          ledger: event.ledger,
          ledgerTs: event.ledger, // ledger timestamp approximation
        });

        // Emit WebSocket event
        emitStreamEvent(
          "withdrawal",
          event.ledger.toString(),
          {
            ledger: event.ledger,
            worker: (event.contractId as any).toString(),
          },
          undefined,
          (event.contractId as any).toString(),
        );
      } else if (parsed.kind === "stream_cancelled") {
        await upsertStream({
          streamId: event.ledger,
          employer: (event.contractId as any).toString() || "",
          worker: (event.contractId as any).toString() || "",
          totalAmount: 0n,
          withdrawnAmount: 0n,
          startTs: 0,
          endTs: 0,
          status: "cancelled",
          closedAt: event.ledger,
          ledger: event.ledger,
        });

        // Emit WebSocket event
        emitStreamEvent(
          "stream_cancelled",
          event.ledger.toString(),
          { ledger: event.ledger },
          (event.contractId as any).toString(),
          (event.contractId as any).toString(),
        );
      } else if (parsed.kind === "stream_completed") {
        await upsertStream({
          streamId: event.ledger,
          employer: (event.contractId as any).toString() || "",
          worker: (event.contractId as any).toString() || "",
          totalAmount: 0n,
          withdrawnAmount: 0n,
          startTs: 0,
          endTs: 0,
          status: "completed",
          closedAt: event.ledger,
          ledger: event.ledger,
        });

        // Emit WebSocket event
        emitStreamEvent(
          "stream_completed",
          event.ledger.toString(),
          { ledger: event.ledger },
          (event.contractId as any).toString(),
          (event.contractId as any).toString(),
        );

        // Generate and pin an IPFS payroll proof for this completed stream
        const streamRecord = await getStreamById(event.ledger);
        if (streamRecord) {
          void generateAndStoreProof(streamRecord);
        }
      }
    } catch (err: unknown) {
      await serviceLogger.error("Syncer", "Failed to ingest event", err, {
        event_type: parsed.kind,
        ledger_number: event.ledger,
        event_id: event.id,
      });
    }
  }
};

// ─── Core sync loop ────────────────────────────────────────────────────────────

const runSync = async (): Promise<number> => {
  const LOCK_ID_SYNCER = 888888;
  let latestLedger = 0;

  await withAdvisoryLock(
    LOCK_ID_SYNCER,
    async () => {
      const lastSynced = await getLastSyncedLedger(CONTRACT_ID || "default");
      const startLedger = Math.max(lastSynced + 1, SYNC_START_LEDGER + 1);

      const latestRes = await server.getLatestLedger();
      latestLedger = latestRes.sequence;

      if (startLedger > latestLedger) {
        return;
      }

      let cursor = startLedger;
      let totalIngested = 0;

      while (cursor <= latestLedger) {
        try {
          await enqueueJob(
            async () => {
              const eventsRes = await server.getEvents({
                startLedger: cursor,
                filters: CONTRACT_ID
                  ? [{ type: "contract", contractIds: [CONTRACT_ID] }]
                  : [],
                limit: BATCH_SIZE,
              });

              await ingestEvents(eventsRes.events);
              totalIngested += eventsRes.events.length;

              // Advance cursor past the batch inside the successful closure
              if (eventsRes.events.length > 0) {
                cursor =
                  eventsRes.events[eventsRes.events.length - 1].ledger + 1;
              } else {
                cursor = latestLedger + 1; // no more events
              }
            },
            {
              jobType: "ledger_sync_batch",
              payload: {
                startLedger: cursor,
                limit: BATCH_SIZE,
                contract: CONTRACT_ID,
              },
              maxRetries: 3,
              baseDelayMs: 3000,
            },
          );
        } catch (err: unknown) {
          // If enqueueJob fails after all retries (and goes to DLQ), we still advance the cursor
          // so the syncer isn't permanently stuck on a bad ledger batch.
          await serviceLogger.error(
            "Syncer",
            "Persistent error fetching events. Batch sent to DLQ and cursor advanced",
            err,
            {
              event_type: "ledger_sync_batch",
              ledger_number: cursor,
              batch_size: BATCH_SIZE,
            },
          );
          cursor += BATCH_SIZE; // Skip this batch to prevent halting the entire pipeline
        }
      }

      await updateSyncCursor(CONTRACT_ID || "default", latestLedger);

      if (totalIngested > 0) {
        await serviceLogger.info("Syncer", "Ingested events batch", {
          event_type: "sync_cycle_summary",
          ledger_number: latestLedger,
          total_ingested: totalIngested,
        });
      } else {
        await serviceLogger.info("Syncer", "No new events to ingest", {
          event_type: "sync_cycle_summary",
          ledger_number: latestLedger,
        });
      }
    },
    "event-syncer",
  );

  return latestLedger;
};

// ─── Public entry point ────────────────────────────────────────────────────────

export const startSyncer = async (): Promise<void> => {
  if (!getPool()) {
    await serviceLogger.warn(
      "Syncer",
      "Database not configured — syncer disabled",
      {
        event_type: "syncer_startup",
        ledger_number: null,
      },
    );
    return;
  }

  syncerStopping = false;

  await serviceLogger.info("Syncer", "Starting historical backfill", {
    event_type: "syncer_startup",
    ledger_number: null,
  });

  const poll = async () => {
    try {
      inFlightSyncCycle = runSync();
      await inFlightSyncCycle;
    } catch (err: unknown) {
      await serviceLogger.error(
        "Syncer",
        "Unhandled error in sync cycle",
        err,
        {
          event_type: "sync_cycle_error",
          ledger_number: null,
        },
      );
    } finally {
      inFlightSyncCycle = null;
    }

    if (syncerStopping) return;

    syncerTimeoutId = setTimeout(poll, POLL_INTERVAL_MS);
  };

  await poll();
};

export const stopSyncer = async (): Promise<void> => {
  syncerStopping = true;

  if (syncerTimeoutId) {
    clearTimeout(syncerTimeoutId);
    syncerTimeoutId = null;
  }

  if (inFlightSyncCycle) {
    await inFlightSyncCycle;
  }
};
