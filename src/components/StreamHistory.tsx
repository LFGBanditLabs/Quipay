import { useStreamHistory } from "../hooks/useStreamHistory";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import type { Stream, StreamsResponse } from "../lib/streams";

export const StreamHistory = () => {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useStreamHistory();

  const { containerRef } = useInfiniteScroll(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  });

  const streams =
    data?.pages.flatMap((page: StreamsResponse) => page.data) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-gray-400">Loading streams...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-red-400">Failed to load streams.</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[600px] overflow-y-auto space-y-3 pr-1"
    >
      {streams.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-gray-400">No streams found.</span>
        </div>
      ) : (
        <>
          {streams.map((stream: Stream) => (
            <StreamCard key={stream.id} stream={stream} />
          ))}

          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-4">
              <span className="text-sm text-gray-400">Loading more...</span>
            </div>
          )}

          {!hasNextPage && streams.length > 0 && (
            <div className="flex items-center justify-center py-4 border-t border-gray-700">
              <span className="text-sm text-gray-500">
                You have reached the end of your stream history.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const StreamCard = ({ stream }: { stream: Stream }) => {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-white">{stream.recipient}</p>
        <p className="text-xs text-gray-400">
          {new Date(stream.startTime * 1000).toLocaleDateString()}
        </p>
      </div>
      <div className="text-right space-y-1">
        <p className="text-sm font-bold text-white">{stream.amount} USDC</p>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            stream.status === "active"
              ? "bg-green-900 text-green-400"
              : stream.status === "completed"
                ? "bg-blue-900 text-blue-400"
                : "bg-red-900 text-red-400"
          }`}
        >
          {stream.status}
        </span>
      </div>
    </div>
  );
};
