import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchStreams } from "../lib/streams";
import type { StreamsResponse } from "../lib/streams";

/**
 * Fetches paginated stream history using infinite scrolling / cursor-based pagination.
 *
 * Built on top of `@tanstack/react-query`'s `useInfiniteQuery`. Results are
 * cached for 30 seconds and automatically re-fetched on the same interval to
 * keep the list reasonably fresh without hammering the API.
 *
 * @returns The full `UseInfiniteQueryResult` from React Query, including
 *   `data.pages`, `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`,
 *   `isLoading`, and `isError`.
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useStreamHistory();
 * const allStreams = data?.pages.flatMap((p) => p.streams) ?? [];
 * ```
 */
export const useStreamHistory = () => {
  const result = useInfiniteQuery({
    queryKey: ["streams"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchStreams(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const streams =
    result.data?.pages.flatMap((page: StreamsResponse) => page.data) ?? [];

  return {
    ...result,
    streams,
    isLoading: result.isLoading,
    error: result.error,
  };
};
