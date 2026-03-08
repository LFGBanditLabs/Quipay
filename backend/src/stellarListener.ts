import { rpc } from "@stellar/stellar-sdk";
import { sendWebhookNotification } from "./delivery";
import { logger } from "./utils/logger";
import { withCorrelationContext } from "./middleware/correlationId";

const SOROBAN_RPC_URL =
  process.env.PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const QUIPAY_CONTRACT_ID = process.env.QUIPAY_CONTRACT_ID || "";

const server = new rpc.Server(SOROBAN_RPC_URL);

/**
 * Starts polling the Soroban RPC for Quipay contract events.
 */
export const startStellarListener = async () => {
  if (!QUIPAY_CONTRACT_ID) {
    logger.warn(
      "[Stellar Listener] ⚠️ QUIPAY_CONTRACT_ID is not set. The listener will simulate events for testing.",
    );
    simulateEvents();
    return;
  }

  logger.info(
    `[Stellar Listener] 📡 Listening for events on contract: ${QUIPAY_CONTRACT_ID}`,
  );

  try {
    let latestLedger = await getLatestLedger();

    // Poll every 5 seconds
    setInterval(async () => {
      try {
        const currentLedger = await getLatestLedger();
        if (currentLedger <= latestLedger) return;

        const eventsResponse = await server.getEvents({
          startLedger: latestLedger + 1,
          filters: [
            {
              type: "contract",
              contractIds: [QUIPAY_CONTRACT_ID],
            },
          ],
          limit: 100,
        });

        eventsResponse.events.forEach((event) => {
          parseAndDeliverEvent(event);
        });

        latestLedger = currentLedger;
      } catch (err: any) {
        logger.error(
          `[Stellar Listener] Error polling events: ${err.message}`,
          { error: err },
        );
      }
    }, 5000);
  } catch (err: any) {
    logger.error(`[Stellar Listener] Initialization failed: ${err.message}`, {
      error: err,
    });
  }
};

const getLatestLedger = async (): Promise<number> => {
  const health = await server.getLatestLedger();
  return health.sequence;
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
      // Generate correlation ID for event processing
      const correlationId = `stellar-${event.id}-${Date.now()}`;

      withCorrelationContext(correlationId, () => {
        sendWebhookNotification(eventType, payload);
      });
    }
  } catch (e) {
    logger.error("[Stellar Listener] Failed to parse event topic", {
      error: e,
    });
  }
};

// Simulation fallback for integration testing without a real contract
const simulateEvents = () => {
  setInterval(() => {
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

    logger.info(`[Stellar Listener] 🧪 Simulating ${randomType} event...`);

    // Generate correlation ID for simulated events
    const correlationId = `sim-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    withCorrelationContext(correlationId, () => {
      sendWebhookNotification(randomType, payload);
    });
  }, 15000); // Simulate an event every 15 seconds
};
