import { rpc } from "@stellar/stellar-sdk";
import { query } from "../db/pool";
import { emitStreamEvent } from "../websocket/server";

const SOROBAN_RPC_URL =
  process.env.PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const QUIPAY_CONTRACT_ID = process.env.QUIPAY_CONTRACT_ID || "";

let isIndexing = false;
let intervalId: NodeJS.Timeout | null = null;
const server = new rpc.Server(SOROBAN_RPC_URL);

/**
 * Starts the event indexer which polls Soroban RPC for contract events,
 * persists them to the database, and emits real-time WebSocket updates.
 */
export const startEventIndexer = async () => {
  if (isIndexing || !QUIPAY_CONTRACT_ID) {
    if (!QUIPAY_CONTRACT_ID)
      console.warn("[Event Indexer] QUIPAY_CONTRACT_ID not set.");
    return;
  }

  isIndexing = true;
  console.log(`[Event Indexer] Started indexing ${QUIPAY_CONTRACT_ID}`);

  let lastLedger = 0;
  try {
    const res = await query(
      "SELECT last_ledger FROM sync_cursors WHERE contract_id = $1",
      [QUIPAY_CONTRACT_ID],
    );
    if (res.rows.length > 0) {
      lastLedger = parseInt(res.rows[0].last_ledger, 10);
    } else {
      const health = await server.getLatestLedger();
      lastLedger = health.sequence;
      await query(
        "INSERT INTO sync_cursors (contract_id, last_ledger) VALUES ($1, $2)",
        [QUIPAY_CONTRACT_ID, lastLedger],
      );
    }
  } catch (err: any) {
    console.error(`[Event Indexer] init error: ${err.message}`);
    return;
  }

  intervalId = setInterval(async () => {
    try {
      const health = await server.getLatestLedger();
      if (health.sequence <= lastLedger) return;

      const eventsRes: any = await server.getEvents({
        startLedger: lastLedger + 1,
        filters: [{ type: "contract", contractIds: [QUIPAY_CONTRACT_ID] }],
        limit: 100,
      });

      if (eventsRes && eventsRes.events) {
        for (const event of eventsRes.events) {
          await persistAndEmitEvent(event);
        }
      }

      lastLedger = health.sequence;
      await query(
        "UPDATE sync_cursors SET last_ledger = $1, updated_at = NOW() WHERE contract_id = $2",
        [lastLedger, QUIPAY_CONTRACT_ID],
      );
    } catch (e: any) {
      console.error(`[Event Indexer] loop error: ${e.message}`);
    }
  }, 3000);
};

export const stopEventIndexer = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isIndexing = false;
  console.log("[Event Indexer] Stopped");
};

async function persistAndEmitEvent(event: any) {
  try {
    const topics = event.topic;
    if (!topics || topics.length === 0) return;
    const topicString = topics[0].toXDR("base64");

    let eventType: any = null;
    if (topicString.includes("stream") || topicString.includes("Stream")) {
      eventType = "stream_created";
    } else if (
      topicString.includes("withdrawal") ||
      topicString.includes("Withdraw")
    ) {
      eventType = "withdrawal";
    } else if (
      topicString.includes("cancel") ||
      topicString.includes("Cancel")
    ) {
      eventType = "stream_cancelled";
    }

    if (!eventType) return;

    // Simulate extracting data
    const streamId = event.id; // placeholder

    // In a real app we'd insert into payroll_streams / withdrawals here
    // await query("INSERT INTO withdrawals (stream_id, worker, amount, ledger, ledger_ts) VALUES ($1, $2, $3, $4, $5)", [...]);

    // Emit via WebSocket for frontend real-time dashboard update
    emitStreamEvent(eventType, streamId, event);
  } catch (e) {
    console.error("[Event Indexer] Failed to parse event topic", e);
  }
}
