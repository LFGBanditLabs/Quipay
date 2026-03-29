import { useEffect, useRef, useCallback } from "react";

export const useInfiniteScroll = (
  onBottomReached: () => void,
  threshold = 200,
) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < threshold) {
      onBottomReached();
    }
  }, [onBottomReached, threshold]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return { containerRef };
};
