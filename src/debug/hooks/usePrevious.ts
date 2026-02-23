import { useEffect, useState } from "react";

export const usePrevious = <T>(value: T): T | undefined => {
  const [current, setCurrent] = useState<T>(value);
  const [previous, setPrevious] = useState<T | undefined>(undefined);

  useEffect(() => {
    setPrevious(current);
    setCurrent(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return previous;
};
