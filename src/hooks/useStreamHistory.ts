import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchStreams } from "../lib/streams";

export const useStreamHistory = () => {
  return useInfiniteQuery({
    queryKey: ["streams"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchStreams(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
};
