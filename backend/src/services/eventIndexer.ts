import { rpc } from "@stellar/stellar-sdk";
import { getPool } from "../db/pool";
import {
  getLastSyncedLedger,
  updateSyncCursor,
  upsertStream,
  recordWithdrawal,
} from "../db/queries";
import { emitStreamEvent } from "../websocket/server";
import { serviceLogger } from "../audit/serviceLogger";

const SOROBAN_RPC_URL =
  process.env.PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const QUIPAY_CONTRACT_ID = process.env.QUIPAY_CONTRACT_ID || "";
const SYNC_START_LEDGER = parseInt(process.env.SYNC_START_LEDGER || "0", 10);
const POLL_INTERVAL_MS = parseInt(process.env.SYNCER_POLL_MS || "10000", 10);
const BATCH_SIZE = 100;

let isIndexing = false;
let indexerStopping = false;
let indexerTimeoutId: NodeJS.Timeout | null = null;
let inFlightCycle: Promise<void> | null = null;

const server = new rpc.Server(SOROBAN_RPC_URL);

// ─── Event parser ─────────────────────────────────────────────────────────────

type EventKind =
  | "stream_created"
  | "withdrawal"
  | "stream_cancelled"
  | "stream_completed";

const parseEvent = (
  event: rpc.Api.EventResponse,
): { kind: EventKind } | null => {
  try {
    const topics = event.topic;
    if (!topics || topics.length === 0) return null;

    const topicBase64 = topics[0].toXDR("base64");

    const isCreate =
      topicBase64.includes("create") || topicBase64.includes("stream");
    const isWithdraw = topicBase64.includes("withdraw");
    const isCancel = topicBase64.includes("cancel");
    const isComplete = topicBase64.includes("complete");

    if (isComplete) return { kind: "stream_completed" };
    if (isCreate && !isWithdraw && !isCancel) return { kind: "stream_created" };
    if (isWithdraw) return { kind: "withdrawal" };
    if (isCancel) return { kind: "stream_cancelled" };
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
      const contractIdStr = String(event.contractId);

      if (parsed.kind === "stream_created") {
        await upsertStream({
          streamId: event.ledger,
          employer: contractIdStr,
          worker: contractIdStr,
          totalAmount: 0n,
          withdrawnAmount: 0n,
          startTs: 0,
          endTs: 0,
          status: "active",
          ledger: event.ledger,
        });
        emitStreamEvent(
          "stream_created",
          event.ledger.toString(),
          { ledger: event.ledger },
          contractIdStr,
          contractIdStr,
        );
      } else if (parsed.kind === "withdrawal") {
        await recordWithdrawal({
          streamId: event.ledger,
          worker: contractIdStr,
          amount: 0n,
          ledger: event.ledger,
          ledgerTs: event.ledger,
        });
        emitStreamEvent(
          "withdrawal",
          event.ledger.toString(),
          { ledger: event.ledger, worker: contractIdStr },
          undefined,
          contractIdStr,
        );
      } else {
        await upsertStream({
          streamId: event.ledger,
          employer: contractIdStr,
          worker: contractIdStr,
          totalAmount: 0n,
          withdrawnAmount: 0n,
          startTs: 0,
          endTs: 0,
          status:
            parsed.kind === "stream_cancelled" ? "cancelled" : "completed",
          closedAt: event.ledger,
          ledger: event.ledger,
        });
        emitStreamEvent(
          parsed.kind,
          event.ledger.toString(),
          { ledger: event.ledger },
          contractIdStr,
          contractIdStr,
        );
      }
    } catch (err: unknown) {
      await serviceLogger.error("EventIndexer", "Failed to ingest event", err, {
        event_type: parsed.kind,
        ledger: event.ledger,
        event_id: event.id,
      });
    }
  }
};

// ─── Poll cycle ───────────────────────────────────────────────────────────────

const runCycle = async (): Promise<void> => {
  if (!QUIPAY_CONTRACT_ID) return;

  const lastSynced = await getLastSyncedLedger(QUIPAY_CONTRACT_ID);
  const startLedger = Math.max(lastSynced + 1, SYNC_START_LEDGER + 1);

  const latestRes = await server.getLatestLedger();
  const latestLedger = latestRes.sequence;

  if (startLedger > latestLedger) return;

  let cursor = startLedger;
  let totalIngested = 0;

  while (cursor <= latestLedger) {
    const eventsRes = await server.getEvents({
      startLedger: cursor,
      filters: [{ type: "contract", contractIds: [QUIPAY_CONTRACT_ID] }],
      limit: BATCH_SIZE,
    });

    await ingestEvents(eventsRes.events);
    totalIngested += eventsRes.events.length;

    if (eventsRes.events.length > 0) {
      cursor = eventsRes.events[eventsRes.events.length - 1].ledger + 1;
    } else {
      break;
    }
  }

  await updateSyncCursor(QUIPAY_CONTRACT_ID, latestLedger);

  if (totalIngested > 0) {
    await serviceLogger.info("EventIndexer", "Ingested events batch", {
      total_ingested: totalIngested,
      latest_ledger: latestLedger,
    });
  }
};

// ─── Public entry point ───────────────────────────────────────────────────────

export const startEventIndexer = async (): Promise<void> => {
  if (isIndexing) return;

  if (!QUIPAY_CONTRACT_ID) {
    await serviceLogger.warn(
      "EventIndexer",
      "QUIPAY_CONTRACT_ID not set — event indexer disabled",
    );
    return;
  }

  if (!getPool()) {
    await serviceLogger.warn(
      "EventIndexer",
      "Database not configured — event indexer disabled",
    );
    return;
  }

  isIndexing = true;
  indexerStopping = false;

  await serviceLogger.info("EventIndexer", "Event indexer started", {
    contract_id: QUIPAY_CONTRACT_ID,
    sync_start_ledger: SYNC_START_LEDGER,
    poll_interval_ms: POLL_INTERVAL_MS,
  });

  const poll = async () => {
    try {
      inFlightCycle = runCycle();
      await inFlightCycle;
    } catch (err: unknown) {
      await serviceLogger.error(
        "EventIndexer",
        "Unhandled error in indexer cycle",
        err,
      );
    } finally {
      inFlightCycle = null;
    }

    if (indexerStopping) return;

    indexerTimeoutId = setTimeout(poll, POLL_INTERVAL_MS);
  };

  await poll();
};

export const stopEventIndexer = async (): Promise<void> => {
  indexerStopping = true;

  if (indexerTimeoutId) {
    clearTimeout(indexerTimeoutId);
    indexerTimeoutId = null;
  }

  if (inFlightCycle) {
    await inFlightCycle;
  }

  isIndexing = false;
  await serviceLogger.info("EventIndexer", "Event indexer stopped");
};
