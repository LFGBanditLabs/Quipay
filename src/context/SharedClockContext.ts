import { createContext } from "react";
import type { SharedClockContextValue } from "./useSharedClock";

export const SharedClockContext = createContext<SharedClockContextValue | null>(
  null,
);
