import { memo } from "react";
import { useStreamHistory } from "../hooks/useStreamHistory";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { StreamCardSkeleton } from "./Loading";
import { History } from "lucide-react";
import type { Stream } from "../lib/streams";

export const StreamHistory = () => {
  const {
    streams,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useStreamHistory();

  const { containerRef } = useInfiniteScroll(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-3 py-2" aria-busy="true">
        <StreamCardSkeleton />
        <StreamCardSkeleton />
        <StreamCardSkeleton />
      </div>
    );
  }

  if (error) {
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
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <History className="w-12 h-12 text-gray-600" />
          <div className="text-center space-y-1">
            <h3 className="text-sm font-medium text-gray-300">
              No stream history yet
            </h3>
            <p className="text-xs text-gray-500">
              When you start streaming, your history will appear here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {streams.map((stream: Stream) => (
            <StreamCard key={stream.id} stream={stream} />
          ))}

          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-4">
              <StreamCardSkeleton className="w-full" />
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

const StreamCard = memo(({ stream }: { stream: Stream }) => {
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
});
