import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Stream } from "./usePayroll";

export type StreamAction = "pause" | "resume" | "cancel";

export interface OptimisticStreamContext {
  previousStreams?: Stream[];
}

export const getOptimisticStatus = (action: StreamAction): Stream["status"] => {
  if (action === "pause") return "paused";
  if (action === "resume") return "active";
  return "cancelled";
};

export const applyOptimisticStreamAction = (
  streams: Stream[] | undefined,
  streamId: string,
  action: StreamAction,
): Stream[] =>
  (streams ?? []).map((stream) =>
    stream.id === streamId
      ? {
          ...stream,
          status: getOptimisticStatus(action),
          pendingAction: action,
        }
      : stream,
  );

export const clearOptimisticStreamAction = (
  streams: Stream[] | undefined,
  streamId: string,
): Stream[] =>
  (streams ?? []).map((stream) =>
    stream.id === streamId ? { ...stream, pendingAction: undefined } : stream,
  );

interface UseStreamActionOptions {
  employerAddress?: string;
  runAction: (stream: Stream, action: StreamAction) => Promise<void>;
  onLocalOptimisticUpdate?: (
    streamId: string,
    status: Stream["status"],
    action: StreamAction,
  ) => void;
  onLocalRollback?: (stream: Stream) => void;
  onLocalSettled?: (streamId: string) => void;
}

export function useStreamActionMutation({
  employerAddress,
  runAction,
  onLocalOptimisticUpdate,
  onLocalRollback,
  onLocalSettled,
}: UseStreamActionOptions) {
  const queryClient = useQueryClient();
  const queryKey = ["payroll-streams", employerAddress] as const;

  return useMutation<
    void,
    Error,
    { stream: Stream; action: StreamAction },
    OptimisticStreamContext
  >({
    mutationFn: ({ stream, action }) => runAction(stream, action),
    onMutate: async ({ stream, action }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousStreams = queryClient.getQueryData<Stream[]>(queryKey);
      queryClient.setQueryData<Stream[]>(
        queryKey,
        applyOptimisticStreamAction(previousStreams, stream.id, action),
      );
      onLocalOptimisticUpdate?.(stream.id, getOptimisticStatus(action), action);
      return { previousStreams };
    },
    onError: (error, { stream }, context) => {
      if (context?.previousStreams) {
        queryClient.setQueryData(queryKey, context.previousStreams);
      }
      onLocalRollback?.(stream);
      toast.error(
        `Failed to update stream ${stream.id}: ${error.message || "transaction failed"}`,
      );
    },
    onSettled: (_data, _error, { stream }) => {
      queryClient.setQueryData<Stream[]>(
        queryKey,
        clearOptimisticStreamAction(
          queryClient.getQueryData<Stream[]>(queryKey),
          stream.id,
        ),
      );
      onLocalSettled?.(stream.id);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
