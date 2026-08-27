import * as React from "react";
import { Server, Api } from "@stellar/stellar-sdk/rpc";
import { xdr } from "@stellar/stellar-sdk";
import { io } from "socket.io-client";
import { rpcUrl, stellarNetwork } from "../contracts/util";
import { useAuth } from "./useAuth";
import { useWallet } from "./useWallet";
import { type StreamEvent, type StreamEventType } from "../lib/notificationRules";

export type { StreamEvent, StreamEventType };

/**
 * Concatenated `${contractId}:${topic}`
 */
type PagingKey = string;

/**
 * Paging tokens for each contract/topic pair. These can be mutated directly,
 * rather than being stored as state within the React hook.
 */
const paging: Record<
  PagingKey,
  { lastLedgerStart?: number; pagingToken?: string }
> = {};

// NOTE: Server is configured using envvars which shouldn't change during runtime
const server = new Server(rpcUrl, { allowHttp: stellarNetwork === "LOCAL" });

/**
 * Subscribe to events for a given topic from a given contract, using a library
 * generated with `soroban contract bindings typescript`.
 */
export function useSubscription(
  contractId: string,
  topic: string,
  onEvent: (event: Api.EventResponse) => void,
  pollInterval = 5000,
) {
  const id = `${contractId}:${topic}`;

  React.useEffect(() => {
    if (!paging[id]) paging[id] = {};
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let stop = false;
    const controller = new AbortController();

    async function pollEvents(): Promise<void> {
      try {
        if (!paging[id].lastLedgerStart) {
          const latestLedgerState = await server.getLatestLedger();
          if (stop || controller.signal.aborted) return;
          paging[id].lastLedgerStart = latestLedgerState.sequence;
        }

        const lastLedger = paging[id].lastLedgerStart;

        const requestPromise = server.getEvents(
          paging[id].pagingToken
            ? {
                cursor: paging[id].pagingToken,
                filters: [
                  {
                    contractIds: [contractId],
                    topics: [[xdr.ScVal.scvSymbol(topic).toXDR("base64")]],
                    type: "contract",
                  },
                ],
                limit: 10,
              }
            : {
                startLedger: lastLedger,
                endLedger: lastLedger + 100,
                filters: [
                  {
                    contractIds: [contractId],
                    topics: [[xdr.ScVal.scvSymbol(topic).toXDR("base64")]],
                    type: "contract",
                  },
                ],
                limit: 10,
              },
        );

        const response = await new Promise<Api.GetEventsResponse>(
          (resolve, reject) => {
            if (controller.signal.aborted) {
              const abortError = new Error("Aborted");
              abortError.name = "AbortError";
              reject(abortError);
              return;
            }
            const abortHandler = () => {
              const abortError = new Error("Aborted");
              abortError.name = "AbortError";
              reject(abortError);
            };
            controller.signal.addEventListener("abort", abortHandler);
            requestPromise
              .then((res) => {
                controller.signal.removeEventListener("abort", abortHandler);
                resolve(res);
              })
              .catch((err) => {
                controller.signal.removeEventListener("abort", abortHandler);
                reject(err instanceof Error ? err : new Error(String(err)));
              });
          },
        );

        if (stop || controller.signal.aborted) return;

        paging[id].pagingToken = undefined;
        if (response.latestLedger) {
          paging[id].lastLedgerStart = response.latestLedger;
        }
        if (response.events && response.events.length > 0) {
          response.events.forEach((event) => {
            try {
              onEvent(event);
            } catch (error) {
              console.error(
                "Poll Events: subscription callback had error: ",
                error,
              );
            }
          });
          if (response.cursor) {
            paging[id].pagingToken = response.cursor;
          }
        }
      } catch (error: unknown) {
        if ((error instanceof Error && error.name === "AbortError") || stop) {
          return;
        }
        console.error("Poll Events: error: ", error);
      } finally {
        if (!stop) {
          timeoutId = setTimeout(() => void pollEvents(), pollInterval);
        }
      }
    }

    void pollEvents();

    return () => {
      if (timeoutId != null) clearTimeout(timeoutId);
      stop = true;
      controller.abort();
    };
  }, [contractId, topic, onEvent, id, pollInterval]);
}

/**
 * Subscribe to stream lifecycle events over WebSocket from the backend.
 */
export function useStreamLifecycleSubscription(
  onEvent: (event: StreamEvent) => void,
) {
  const { address } = useWallet();
  const { authenticated, getAccessToken } = useAuth();
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;

  React.useEffect(() => {
    const WS_URL = import.meta.env.PUBLIC_BACKEND_URL;
    if (!WS_URL || !authenticated) return;

    let socket: ReturnType<typeof io> | null = null;
    let isCancelled = false;

    const connect = async () => {
      try {
        const token = await getAccessToken();
        if (!token || isCancelled) return;

        socket = io(WS_URL, {
          path: "/socket.io",
          query: { token },
        });

        const eventTypes: StreamEventType[] = [
          "stream.started",
          "stream.paused",
          "stream.resumed",
          "stream.cancelled",
          "earnings.milestone",
          "vault.low_balance",
          "stream.ending_soon",
          "worker.joined",
          "deposit.confirmed",
          "withdrawal.completed",
          "batch.completed",
        ];

        socket.on("stream:event", (event: StreamEvent) => {
          onEventRef.current(event);
        });

        eventTypes.forEach((eventType) => {
          socket?.on(eventType, (payload: Partial<StreamEvent>) => {
            onEventRef.current({
              type: eventType,
              timestamp: payload.timestamp || Date.now(),
              ...payload,
            });
          });
        });
      } catch (err) {
        console.warn("WebSocket lifecycle subscription skipped:", err);
      }
    };

    void connect();

    return () => {
      isCancelled = true;
      socket?.disconnect();
    };
  }, [address, authenticated, getAccessToken]);
}
