import { useEffect, useMemo, useState } from "react";
import { SharedClockContext } from "./SharedClockContext";

export const SharedClockProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const value = useMemo(() => nowMs, [nowMs]);

  return (
    <SharedClockContext.Provider value={value}>
      {children}
    </SharedClockContext.Provider>
  );
};
