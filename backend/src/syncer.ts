import { rpc } from "@stellar/stellar-sdk";
import { getPool } from "./db/pool";
import {
  getLastSyncedLedger,
  updateSyncCursor,
  upsertStream,
  recordWithdrawal,
} from "./db/queries";

const SOROBAN_RPC_URL =
  process.env.PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.QUIPAY_CONTRACT_ID || "";
// Optional: override the first ledger to backfill from (defaults to 0 = full history)
const SYNC_START_LEDGER = parseInt(process.env.SYNC_START_LEDGER || "0", 10);
const POLL_INTERVAL_MS = parseInt(process.env.SYNCER_POLL_MS || "10000", 10);
const BATCH_SIZE = 200; // max events per RPC call

const server = new rpc.Server(SOROBAN_RPC_URL);

// ─── Event parsers ────────────────────────────────────────────────────────────

/**
 * Best-effort parse of a Soroban XDR event into a structured record.
 * Returns null for unrecognised event types.
 */
const parseEvent = (
  event: rpc.Api.EventResponse,
): null | {
  kind: "stream_created" | "withdrawal" | "stream_cancelled";
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
      } else if (parsed.kind === "withdrawal") {
        await recordWithdrawal({
          streamId: event.ledger,
          worker: (event.contractId as any).toString() || "",
          amount: 0n,
          ledger: event.ledger,
          ledgerTs: event.ledger, // ledger timestamp approximation
        });
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
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Syncer] Failed to ingest event ${event.id}: ${msg}`);
    }
  }
};

// ─── Core sync loop ────────────────────────────────────────────────────────────

const runSync = async (): Promise<number> => {
  const lastSynced = await getLastSyncedLedger(CONTRACT_ID || "default");
  const startLedger = Math.max(lastSynced + 1, SYNC_START_LEDGER + 1);

  const latestRes = await server.getLatestLedger();
  const latestLedger = latestRes.sequence;

  if (startLedger > latestLedger) {
    return latestLedger; // already up to date
  }

  let cursor = startLedger;
  let totalIngested = 0;

  while (cursor <= latestLedger) {
    try {
      const eventsRes = await server.getEvents({
        startLedger: cursor,
        filters: CONTRACT_ID
          ? [{ type: "contract", contractIds: [CONTRACT_ID] }]
          : [],
        limit: BATCH_SIZE,
      });

      await ingestEvents(eventsRes.events);
      totalIngested += eventsRes.events.length;

      // Advance cursor past the batch
      if (eventsRes.events.length > 0) {
        cursor = eventsRes.events[eventsRes.events.length - 1].ledger + 1;
      } else {
        cursor = latestLedger + 1; // no more events
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[Syncer] Error fetching events at ledger ${cursor}: ${msg}`,
      );
      break;
    }
  }

  await updateSyncCursor(CONTRACT_ID || "default", latestLedger);

  if (totalIngested > 0) {
    console.log(
      `[Syncer] ✅ Ingested ${totalIngested} events up to ledger ${latestLedger}`,
    );
  }

  return latestLedger;
};

// ─── Public entry point ────────────────────────────────────────────────────────

export const startSyncer = async (): Promise<void> => {
  if (!getPool()) {
    console.warn("[Syncer] ⚠️  Database not configured — syncer disabled.");
    return;
  }

  console.log("[Syncer] 🔄 Starting historical backfill…");

  const poll = async () => {
    try {
      await runSync();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Syncer] Unhandled error in sync cycle: ${msg}`);
    }
    setTimeout(poll, POLL_INTERVAL_MS);
  };

  await poll();
};
