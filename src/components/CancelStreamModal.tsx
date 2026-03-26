import React, { useState } from "react";
import { Button, Text } from "@stellar/design-system";

interface CancelStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  employeeName: string;
  flowRate: string;
  tokenSymbol: string;
}

export const CancelStreamModal: React.FC<CancelStreamModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  employeeName,
  flowRate,
  tokenSymbol,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Cancel failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-[var(--sds-color-content-primary)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--sds-color-neutral-border)] bg-[var(--sds-color-background-primary)] p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </div>
          <Text as="h3" size="lg" weight="bold">
            Cancel Stream
          </Text>
        </div>

        <Text
          as="p"
          size="md"
          className="mb-6 text-[var(--sds-color-content-secondary)]"
        >
          Are you sure you want to cancel the stream to{" "}
          <strong>{employeeName}</strong>?
        </Text>

        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <Text
            as="p"
            size="sm"
            className="mb-2 text-amber-600 dark:text-amber-500"
          >
            <strong>Impact:</strong> The worker will instantly receive any funds
            accrued up to this second based on the flow rate of {flowRate}{" "}
            {tokenSymbol}/sec. The remaining unstreamed funds will be released
            from liabilities back to your available treasury balance.
          </Text>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Keep Stream Active
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Cancelling..." : "Confirm Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
};
