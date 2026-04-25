import { rpc } from "@stellar/stellar-sdk";
import { sendWebhookNotification } from "./delivery";
import { createCircuitBreaker } from "./utils/circuitBreaker";

const SOROBAN_RPC_URL =
  process.env.PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const getQUIPAY_CONTRACT_ID = () => process.env.QUIPAY_CONTRACT_ID || "";

// Store interval IDs for cleanup
let pollingIntervalId: NodeJS.Timeout | null = null;
let simulationIntervalId: NodeJS.Timeout | null = null;

// Circuit breakers - initialized lazily
let getLatestLedgerBreaker: ReturnType<typeof createCircuitBreaker> | null =
  null;
let getEventsBreaker: ReturnType<typeof createCircuitBreaker> | null = null;

interface DecodedStreamEventData {
  worker_address?: string;
  employer_address?: string;
  amount?: string;
  token?: string;
  stream_id?: number | string;
}

interface StreamWebhookPayload extends DecodedStreamEventData {
  id: string;
  ledger: number;
  contractId: string;
  type: string;
  eventType: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeKey = (key: string): string =>
  key.toLowerCase().replace(/[^a-z0-9]/g, "");

const primitiveToString = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  return null;
};

const flattenEventValue = (
  value: unknown,
  sink: Record<string, string>,
): void => {
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenEventValue(entry, sink));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [rawKey, nestedValue] of Object.entries(value)) {
    const normalized = normalizeKey(rawKey);
    const primitive = primitiveToString(nestedValue);

    if (primitive !== null && !sink[normalized]) {
      sink[normalized] = primitive;
    }

    flattenEventValue(nestedValue, sink);
  }
};

const decodeStreamEvent = (
  event: rpc.Api.EventResponse,
): DecodedStreamEventData => {
  const flattened: Record<string, string> = {};
  const rawValue = event.value as unknown;
  const normalizedValue =
    isRecord(rawValue) && typeof rawValue.toJSON === "function"
      ? (() => {
          try {
            return rawValue.toJSON() as unknown;
          } catch {
            return rawValue;
          }
        })()
      : rawValue;

  flattenEventValue(normalizedValue, flattened);

  const pick = (aliases: string[]): string | undefined => {
    for (const alias of aliases) {
      const value = flattened[normalizeKey(alias)];
      if (value) return value;
    }
    return undefined;
  };

  const streamIdRaw = pick(["streamid", "stream_id", "stream", "id"]);
  const parsedStreamId =
    streamIdRaw && !Number.isNaN(Number(streamIdRaw))
      ? Number(streamIdRaw)
      : streamIdRaw;

  return {
    worker_address: pick(["workeraddress", "worker", "recipient"]),
    employer_address: pick(["employeraddress", "employer", "sender"]),
    amount: pick(["amount", "value", "rate"]),
    token: pick(["token", "asset", "currency"]),
    stream_id: parsedStreamId,
  };
};

/**
 * Initializes the circuit breakers.
 * Exported for testing purposes.
 */
export const initCircuitBreakers = () => {
  const server = new rpc.Server(SOROBAN_RPC_URL);

  getLatestLedgerBreaker = createCircuitBreaker(
    server.getLatestLedger.bind(server),
    {
      name: "stellar_get_latest_ledger",
      timeout: 5000,
    },
  );

  getEventsBreaker = createCircuitBreaker(server.getEvents.bind(server), {
    name: "stellar_get_events",
    timeout: 10000,
  });
};

/**
 * Gets or creates the circuit breaker for getLatestLedger.
 */
const getGetLatestLedgerBreaker = () => {
  if (!getLatestLedgerBreaker) {
    initCircuitBreakers();
  }
  return getLatestLedgerBreaker!;
};

/**
 * Gets or creates the circuit breaker for getEvents.
 */
const getGetEventsBreaker = () => {
  if (!getEventsBreaker) {
    initCircuitBreakers();
  }
  return getEventsBreaker!;
};

/**
 * Starts polling the Soroban RPC for Quipay contract events.
 */
export const startStellarListener = async () => {
  const QUIPAY_CONTRACT_ID = getQUIPAY_CONTRACT_ID();

  if (!QUIPAY_CONTRACT_ID) {
    console.warn(
      "[Stellar Listener] ⚠️ QUIPAY_CONTRACT_ID is not set. The listener will simulate events for testing.",
    );
    simulateEvents();
    return;
  }

  console.log(
    `[Stellar Listener] 📡 Listening for events on contract: ${QUIPAY_CONTRACT_ID}`,
  );

  try {
    let latestLedger = await getLatestLedgerInternal();

    // Poll every 5 seconds
    pollingIntervalId = setInterval(async () => {
      try {
        const currentLedger = await getLatestLedgerInternal();
        if (currentLedger <= latestLedger) return;

        const eventsResponse = (await getGetEventsBreaker().fire({
          startLedger: latestLedger + 1,
          filters: [
            {
              type: "contract",
              contractIds: [QUIPAY_CONTRACT_ID],
            },
          ],
          limit: 100,
        })) as { events?: rpc.Api.EventResponse[] };

        if (!eventsResponse) return; // Fallback or issue

        eventsResponse.events?.forEach((event) => parseAndDeliverEvent(event));

        latestLedger = currentLedger;
      } catch (err: unknown) {
        console.error(
          `[Stellar Listener] Error polling events: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }, 5000);
  } catch (err: unknown) {
    console.error(
      `[Stellar Listener] Initialization failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

/**
 * Stops the Stellar listener polling.
 * Used primarily for testing cleanup.
 */
export const stopStellarListener = () => {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
  if (simulationIntervalId) {
    clearInterval(simulationIntervalId);
    simulationIntervalId = null;
  }
  console.log("[Stellar Listener] 🛑 Listener stopped");
};

const getLatestLedgerInternal = async (): Promise<number> => {
  try {
    const health: any = await getGetLatestLedgerBreaker().fire();
    return health?.sequence || 0;
  } catch (err) {
    console.error("[Stellar Listener] Failed to get latest ledger", err);
    return 0;
  }
};

const parseAndDeliverEvent = (event: rpc.Api.EventResponse) => {
  // Soroban events typically encode topic segments in the `topic` array.
  // For this implementation, we will mock parsing logic based on assumed topics.
  try {
    const topics = event.topic;
    if (!topics || topics.length === 0) return;

    // Convert the xdr representation to a string for basic matching
    const topicString = topics[0].toXDR("base64");

    let eventType = "unknown";
    if (
      topicString.includes("withdrawal") ||
      topicString.includes("Withdraw")
    ) {
      eventType = "withdrawal";
    } else if (
      topicString.includes("stream") ||
      topicString.includes("Stream")
    ) {
      eventType = "new_stream";
    } else {
      // Unrecognized event type, ignore or pass generic
      eventType = "generic_contract_event";
    }

    const payload: StreamWebhookPayload = {
      id: String(event.id),
      ledger: event.ledger,
      contractId: String(event.contractId),
      type: event.type,
      eventType,
      ...decodeStreamEvent(event),
    };

    if (eventType !== "unknown") {
      sendWebhookNotification(eventType, payload);
    }
  } catch (e) {
    console.error("[Stellar Listener] Failed to parse event topic", e);
  }
};

// Simulation fallback for integration testing without a real contract
const simulateEvents = () => {
  simulationIntervalId = setInterval(() => {
    const simulatedEventTypes = ["withdrawal", "new_stream"];
    const randomType =
      simulatedEventTypes[
        Math.floor(Math.random() * simulatedEventTypes.length)
      ];

    const payload = {
      id: `sim-${Date.now()}`,
      ledger: Math.floor(Math.random() * 100000) + 1000000,
      contractId: "C_SIMULATED_QUIPAY_CONTRACT",
      type: "contract",
      eventType: randomType,
      worker_address: "GWORKER_SIMULATED",
      employer_address: "GEMPLOYER_SIMULATED",
      amount: Math.floor(Math.random() * 500) + 50,
      token: "USDC",
      stream_id: Math.floor(Math.random() * 100000),
    };

    console.log(`[Stellar Listener] 🧪 Simulating ${randomType} event...`);
    sendWebhookNotification(randomType, payload);
  }, 15000); // Simulate an event every 15 seconds
};
