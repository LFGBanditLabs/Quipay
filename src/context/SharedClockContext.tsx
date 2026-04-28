import { createContext, useContext, useEffect, useMemo, useState } from "react";

const TICK_INTERVAL_MS = 1000;

const SharedClockContext = createContext<number | null>(null);

export const SharedClockProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, TICK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  const value = useMemo(() => nowMs, [nowMs]);

  return (
    <SharedClockContext.Provider value={value}>
      {children}
    </SharedClockContext.Provider>
  );
};

export const useSharedClockMs = () => {
  const nowMs = useContext(SharedClockContext);
  if (nowMs === null) {
    throw new Error("useSharedClockMs must be used within SharedClockProvider");
  }
  return nowMs;
};

export const useElapsedTime = (startTimestamp: number) => {
  const nowMs = useSharedClockMs();
  const startMs =
    startTimestamp > 1e12 ? startTimestamp : startTimestamp * 1000;
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
};
