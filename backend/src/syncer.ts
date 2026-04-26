import { rpc, xdr, scValToNative } from "@stellar/stellar-sdk";
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

type StreamEventKind = "stream_created" | "stream_cancelled" | "funds_withdrawn";

interface SyncedStreamEvent {
  kind: StreamEventKind;
  streamId: number;
  employerAddress: string;
  workerAddress: string;
  tokenAddress?: string;
  totalAmount?: bigint;
  startTs?: number;
  endTs?: number;
  withdrawnAmount?: bigint;
}

const toBase64Xdr = (value: { toXDR: (format: "base64") => string }): string =>
  value.toXDR("base64");

const decodeScVal = (value: unknown): xdr.ScVal | null => {
  try {
    if (
      value &&
      typeof value === "object" &&
      "toXDR" in value &&
      typeof (value as any).toXDR === "function"
    ) {
      return xdr.ScVal.fromXDR(toBase64Xdr(value as any), "base64");
    }

    if (typeof value === "string" && value.length > 0) {
      return xdr.ScVal.fromXDR(value, "base64");
    }
  } catch {
    // best effort decode
  }
  return null;
};

const scValNative = (value: unknown): unknown => {
  const decoded = decodeScVal(value);
  if (!decoded) return null;
  try {
    return scValToNative(decoded);
  } catch {
    return null;
  }
};

const symbolFromTopic = (topic: unknown): string | null => {
  const decoded = decodeScVal(topic);
  if (!decoded) return null;
  try {
    if (decoded.switch() !== xdr.ScValType.scvSymbol()) return null;
    return decoded.sym()?.toString() ?? null;
  } catch {
    return null;
  }
};

const u64FromTopic = (topic: unknown): number | null => {
  const decoded = decodeScVal(topic);
  if (!decoded) return null;
  try {
    if (decoded.switch() !== xdr.ScValType.scvU64()) return null;
    const value = decoded.u64();
    const asString =
      typeof (value as any)?.toString === "function"
        ? (value as any).toString()
        : String(value);
    const n = Number(asString);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

const stringFromTopic = (topic: unknown): string | null => {
  const native = scValNative(topic);
  if (typeof native === "string") return native;
  return native && typeof (native as any).toString === "function"
    ? (native as any).toString()
    : null;
};

const asBigInt = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(value);
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "string" && value.length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const decodeStreamEvent = (event: rpc.Api.EventResponse): SyncedStreamEvent | null => {
  const topics = event.topic as unknown[];
  if (!topics || topics.length < 2) return null;

  const topicRoot = symbolFromTopic(topics[0]);
  if (topicRoot !== "stream") return null;

  const action = symbolFromTopic(topics[1]);
  if (!action) return null;

  const valueNative = scValNative((event as any).value);
  const valueArray = Array.isArray(valueNative) ? valueNative : null;

  if (action === "created") {
    if (topics.length < 4 || !valueArray || valueArray.length < 5) return null;

    const workerAddress = stringFromTopic(topics[2]);
    const employerAddress = stringFromTopic(topics[3]);
    const streamId = asNumber(valueArray[0]);
    const tokenAddress = valueArray[1] ? String(valueArray[1]) : undefined;
    const rate = asBigInt(valueArray[2]);
    const startTs = asNumber(valueArray[3]);
    const endTs = asNumber(valueArray[4]);

    if (
      !workerAddress ||
      !employerAddress ||
      streamId === null ||
      startTs === null ||
      endTs === null ||
      !rate
    ) {
      return null;
    }

    const duration = BigInt(Math.max(0, endTs - startTs));
    const totalAmount = rate * duration;

    return {
      kind: "stream_created",
      streamId,
      employerAddress,
      workerAddress,
      tokenAddress,
      totalAmount,
      startTs,
      endTs,
    };
  }

  if (action === "withdrawn") {
    if (topics.length < 4 || !valueArray || valueArray.length < 1) return null;
    const streamId = u64FromTopic(topics[2]);
    const workerAddress = stringFromTopic(topics[3]);
    const withdrawnAmount = asBigInt(valueArray[0]);
    const tokenAddress = valueArray[1] ? String(valueArray[1]) : undefined;

    if (streamId === null || !workerAddress || !withdrawnAmount) return null;

    return {
      kind: "funds_withdrawn",
      streamId,
      employerAddress: "",
      workerAddress,
      tokenAddress,
      withdrawnAmount,
    };
  }

  if (action === "canceled") {
    if (topics.length < 4) return null;
    const streamId = u64FromTopic(topics[2]);
    const employerAddress = stringFromTopic(topics[3]);
    const workerAddress =
      valueArray && valueArray.length > 0 ? String(valueArray[0]) : null;
    const tokenAddress =
      valueArray && valueArray.length > 1 ? String(valueArray[1]) : undefined;

    if (streamId === null || !employerAddress || !workerAddress) return null;

    return {
      kind: "stream_cancelled",
      streamId,
      employerAddress,
      workerAddress,
      tokenAddress,
    };
  }

  return null;
};

/**
 * Best-effort parse of a Soroban XDR event into a structured record.
 * Returns null for unrecognised event types.
 */
const parseEvent = (event: rpc.Api.EventResponse): SyncedStreamEvent | null => {
  try {
    return decodeStreamEvent(event);
  } catch {
    return null;
  }
};

// ─── Batch ingest ─────────────────────────────────────────────────────────────

const ingestEvents = async (events: rpc.Api.EventResponse[]): Promise<void> => {
  for (const event of events) {
    const parsed = parseEvent(event);
    if (!parsed) continue;

    try {
      if (parsed.kind === "stream_created") {
        await upsertStream({
          streamId: parsed.streamId,
          employer: parsed.employerAddress,
          worker: parsed.workerAddress,
          totalAmount: parsed.totalAmount ?? 0n,
          withdrawnAmount: 0n,
          startTs: parsed.startTs ?? 0,
          endTs: parsed.endTs ?? 0,
          status: "active",
          ledger: event.ledger,
        });

        // Emit WebSocket event
        emitStreamEvent(
          "stream_created",
          parsed.streamId.toString(),
          { ledger: event.ledger, streamId: parsed.streamId },
          parsed.employerAddress,
          parsed.workerAddress,
        );
      } else if (parsed.kind === "funds_withdrawn") {
        await recordWithdrawal({
          streamId: parsed.streamId,
          worker: parsed.workerAddress,
          amount: parsed.withdrawnAmount ?? 0n,
          ledger: event.ledger,
          ledgerTs: event.ledger, // ledger timestamp approximation
        });

        // Emit WebSocket event
        emitStreamEvent(
          "withdrawal",
          parsed.streamId.toString(),
          {
            ledger: event.ledger,
            worker: parsed.workerAddress,
          },
          undefined,
          parsed.workerAddress,
        );
      } else if (parsed.kind === "stream_cancelled") {
        await upsertStream({
          streamId: parsed.streamId,
          employer: parsed.employerAddress,
          worker: parsed.workerAddress,
          totalAmount: parsed.totalAmount ?? 0n,
          withdrawnAmount: 0n,
          startTs: parsed.startTs ?? 0,
          endTs: parsed.endTs ?? 0,
          status: "cancelled",
          closedAt: event.ledger,
          ledger: event.ledger,
        });

        // Emit WebSocket event
        emitStreamEvent(
          "stream_cancelled",
          parsed.streamId.toString(),
          { ledger: event.ledger, streamId: parsed.streamId },
          parsed.employerAddress,
          parsed.workerAddress,
        );
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
