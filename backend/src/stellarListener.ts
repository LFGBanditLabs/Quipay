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

        const eventsResponse: any = await getGetEventsBreaker().fire({
          startLedger: latestLedger + 1,
          filters: [
            {
              type: "contract",
              contractIds: [QUIPAY_CONTRACT_ID],
            },
          ],
          limit: 100,
        });

        if (!eventsResponse) return; // Fallback or issue

        eventsResponse.events.forEach((event: any) => {
          parseAndDeliverEvent(event);
        });

        latestLedger = currentLedger;
      } catch (err: any) {
        console.error(
          `[Stellar Listener] Error polling events: ${err.message}`,
        );
      }
    }, 5000);
  } catch (err: any) {
    console.error(`[Stellar Listener] Initialization failed: ${err.message}`);
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

    const payload = {
      id: event.id,
      ledger: event.ledger,
      contractId: event.contractId,
      type: event.type,
      eventType: eventType,
      // we omit parsing the underlying XDR value deeply for simplicity
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
      amount: Math.floor(Math.random() * 500) + 50,
      asset: "USDC",
    };

    console.log(`[Stellar Listener] 🧪 Simulating ${randomType} event...`);
    sendWebhookNotification(randomType, payload);
  }, 15000); // Simulate an event every 15 seconds
};
