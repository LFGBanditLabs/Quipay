import axios from "axios";
import { useEffect, useState } from "react";

export type StreamCurve = "Linear" | "FrontLoaded" | "BackLoaded";

export interface Stream {
  id: string;
  recipient: string;
  amount: number;
  startTime: number;
  endTime: number;
  status: "active" | "completed" | "cancelled" | "paused";
  curve?: StreamCurve;
  paused_at?: number;
}

export const fetchStreamById = async (id: string): Promise<Stream> => {
  const { data } = await axios.get<Stream>(`/api/streams/${id}`);
  return data;
};

export interface StreamsResponse {
  data: Stream[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const fetchStreams = async (
  cursor?: string,
): Promise<StreamsResponse> => {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.append("cursor", cursor);

  const { data } = await axios.get<StreamsResponse>(`/api/streams?${params}`);
  return data;
};

export function calculateStreamProgress(stream: Stream, now: number): number {
  if (now < stream.startTime) return 0;

  const effectiveNow =
    stream.status === "paused" && stream.paused_at
      ? Math.min(stream.paused_at, now)
      : now;

  if (effectiveNow >= stream.endTime) return 1;

  const duration = stream.endTime - stream.startTime;
  const elapsed = effectiveNow - stream.startTime;
  const t = elapsed / duration;

  const curve = stream.curve || "Linear";

  switch (curve) {
    case "Linear":
      return t;
    case "FrontLoaded":
      // payout(t) = total × (2t − t²)
      return 2 * t - t * t;
    case "BackLoaded":
      // payout(t) = total × √t
      return Math.sqrt(t);
    default:
      return t;
  }
}

export function useStreamProgress(stream: Stream) {
  const [progress, setProgress] = useState(() =>
    calculateStreamProgress(stream, Date.now() / 1000),
  );

  useEffect(() => {
    if (
      stream.status === "completed" ||
      stream.status === "cancelled" ||
      stream.status === "paused"
    ) {
      requestAnimationFrame(() =>
        setProgress(calculateStreamProgress(stream, Date.now() / 1000)),
      );
      return;
    }

    let animationFrameId: number;
    let lastUpdate = 0;

    const update = (timestamp: number) => {
      // Update at most once per second
      if (timestamp - lastUpdate >= 1000) {
        setProgress(calculateStreamProgress(stream, Date.now() / 1000));
        lastUpdate = timestamp;
      }
      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [stream]);

  return progress;
}
