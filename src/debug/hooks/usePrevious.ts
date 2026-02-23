import { useState } from "react";

export const usePrevious = <T>(value: T): T | undefined => {
  const [tuple, setTuple] = useState<[T | undefined, T]>([undefined, value]);

  if (tuple[1] !== value) {
    setTuple([tuple[1], value]);
  }

  return tuple[0];
};
