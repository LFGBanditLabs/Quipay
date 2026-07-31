import { useEffect, useState } from "react";

export const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const useRelativeTime = (
  timestamp: number,
  intervalMs = 30_000,
): string => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((tick) => tick + 1);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [intervalMs]);

  return formatTimeAgo(timestamp);
};
