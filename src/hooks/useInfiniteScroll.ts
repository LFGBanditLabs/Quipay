import { useEffect, useRef, useCallback } from "react";

/**
 * Attaches a scroll listener to a container element and fires a callback
 * when the user scrolls within `threshold` pixels of the bottom.
 *
 * Designed to be paired with `useStreamHistory` (or any paginated data
 * source) to implement infinite-scroll UIs without a third-party library.
 *
 * @param onBottomReached - Callback invoked when the scroll position is
 *   within `threshold` pixels of the container's bottom edge.
 * @param threshold - Distance in pixels from the bottom that triggers the
 *   callback. Defaults to `200`.
 * @returns An object containing `containerRef` — a `RefObject<HTMLDivElement>`
 *   that must be attached to the scrollable container element.
 *
 * @example
 * ```tsx
 * const { containerRef } = useInfiniteScroll(fetchNextPage, 300);
 * return <div ref={containerRef} style={{ overflowY: "auto", height: "600px" }}>
 *   {items.map((item) => <Row key={item.id} {...item} />)}
 * </div>;
 * ```
 */
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
