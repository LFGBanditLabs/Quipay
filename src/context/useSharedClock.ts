import { useContext } from "react";
import { SharedClockContext } from "./SharedClockContext";

export type SharedClockContextValue = number | null;

export const useSharedClockMs = (): number => {
  const nowMs = useContext(SharedClockContext);
  if (nowMs === null) {
    throw new Error("useSharedClockMs must be used within SharedClockProvider");
  }
  return nowMs;
};

export const useElapsedTime = (startTimestamp: number): number => {
  const nowMs = useSharedClockMs();
  const startMs =
    startTimestamp > 1e12 ? startTimestamp : startTimestamp * 1000;
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
};
