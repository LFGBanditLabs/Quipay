import React, { useEffect, useState } from "react";

export type TransactionStage = "building" | "signing" | "submitting" | "confirmed";

export interface TransactionProgressOverlayProps {
  isVisible: boolean;
  stage: TransactionStage;
  onDismiss?: () => void;
}

const stageLabels: Record<TransactionStage, string> = {
  building: "Building",
  signing: "Signing",
  submitting: "Submitting",
  confirmed: "Confirmed",
};

const stageEmoji: Record<TransactionStage, string> = {
  building: "⚙️",
  signing: "✍️",
  submitting: "📤",
  confirmed: "✅",
};

export const TransactionProgressOverlay: React.FC<
  TransactionProgressOverlayProps
> = ({ isVisible, stage, onDismiss }) => {
  const [shouldDismiss, setShouldDismiss] = useState(false);

  // Auto-dismiss 3 seconds after confirmation
  useEffect(() => {
    if (stage === "confirmed" && !shouldDismiss) {
      const timer = setTimeout(() => {
        setShouldDismiss(true);
        onDismiss?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [stage, onDismiss, shouldDismiss]);

  if (!isVisible) return null;

  const stages: TransactionStage[] = ["building", "signing", "submitting", "confirmed"];
  const currentStageIndex = stages.indexOf(stage);

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/95 p-8 shadow-2xl max-w-sm">
        <h2 className="mb-8 text-center text-xl font-bold text-slate-100">
          Processing Transaction
        </h2>

        {/* Stepper */}
        <div className="space-y-4">
          {stages.map((s, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;

            return (
              <div key={s} className="flex items-center gap-4">
                {/* Step indicator */}
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold transition-all ${
                    isCurrent
                      ? prefersReducedMotion
                        ? "bg-indigo-500 text-white"
                        : "bg-indigo-500 text-white animate-pulse"
                      : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {isCompleted ? "✓" : stageEmoji[s]}
                </div>

                {/* Step label */}
                <div className="flex-1">
                  <p
                    className={`text-sm font-semibold transition-colors ${
                      isCurrent || isCompleted
                        ? "text-slate-100"
                        : "text-slate-400"
                    }`}
                  >
                    {stageLabels[s]}
                  </p>
                </div>

                {/* Progress indicator line */}
                {index < stages.length - 1 && (
                  <div
                    className={`ml-5 h-1 flex-1 transition-colors ${
                      isCompleted ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Dismiss button (appears after confirmation) */}
        {stage === "confirmed" && (
          <button
            onClick={onDismiss}
            className="mt-8 w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
          >
            Done
          </button>
        )}

        {/* Spinner for active stages */}
        {stage !== "confirmed" && (
          <div className="mt-6 flex justify-center">
            <div className="h-3 w-3 rounded-full bg-indigo-500 animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
};
