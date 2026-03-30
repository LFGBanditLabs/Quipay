import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchStreamById } from "../lib/streams";
import { CopyLinkButton } from "../components/ui/CopyLinkButton";
import type { Stream } from "../lib/streams";

export const StreamDetailPage = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const navigate = useNavigate();
  const [stream, setStream] = useState<Stream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!streamId) return;

    document.title = `Stream ${streamId} — Quipay`;

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await fetchStreamById(streamId);
        setStream(data);
      } catch {
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    void load();

    return () => {
      document.title = "Quipay";
    };
  }, [streamId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-sm text-[var(--color-text-secondary)]">
          Loading stream...
        </span>
      </div>
    );
  }

  if (isError || !stream) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="text-sm text-[var(--color-destructive)]">
          Stream not found.
        </span>
        <button
          onClick={() => void navigate("/streams")}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          Back to streams
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-medium">
            Stream Detail
          </p>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            #{stream.id}
          </h1>
        </div>
        <CopyLinkButton />
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
        <StreamField label="Stream ID" value={stream.id} />
        <StreamField label="Recipient" value={stream.recipient} mono />
        <StreamField label="Amount" value={`${stream.amount} USDC`} />
        <StreamField label="Status" value={stream.status} />
        <StreamField
          label="Created"
          value={new Date(stream.startTime * 1000).toLocaleString()}
        />
        {stream.endTime && (
          <StreamField
            label="Ended"
            value={new Date(stream.endTime * 1000).toLocaleString()}
          />
        )}
      </div>

      <button
        onClick={() => void navigate("/streams")}
        className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
      >
        ← Back to streams
      </button>
    </div>
  );
};

const StreamField = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="flex items-center justify-between px-5 py-4">
    <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
    <span
      className={`text-sm text-[var(--color-text-primary)] ${mono ? "font-mono" : "font-medium"}`}
    >
      {value}
    </span>
  </div>
);
