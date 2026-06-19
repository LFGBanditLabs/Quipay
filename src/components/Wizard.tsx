import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export interface WizardStep {
  title: string;
  component: React.ReactNode;
  isValid?: boolean;
}

interface WizardProps {
  steps: WizardStep[];
  onComplete: () => void;
  onCancel?: () => void;
}

const Wizard: React.FC<WizardProps> = ({ steps, onComplete, onCancel }) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  if (steps.length === 0) return null;

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const stepValid = steps[currentStep]?.isValid !== false;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      {/* Step indicator */}
      <div className="relative flex items-start justify-between pt-2">
        <div className="absolute left-4 right-4 top-6 h-px bg-white/[0.07]" />
        <div
          className="absolute left-4 top-6 h-px transition-all duration-500"
          style={{
            backgroundColor: "#facc15",
            opacity: 0.6,
            right:
              steps.length > 1
                ? `${((steps.length - 1 - currentStep) / (steps.length - 1)) * 100}%`
                : "100%",
          }}
        />
        {steps.map((step, i) => {
          const done = i < currentStep;
          const current = i === currentStep;
          return (
            <div
              key={step.title}
              className="relative z-10 flex flex-col items-center gap-2"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-black transition-all duration-300 ${
                  done
                    ? "bg-yellow-400 text-black"
                    : current
                      ? "bg-black text-yellow-400 shadow-[0_0_0_4px_rgba(250,204,21,0.12)]"
                      : "bg-black text-neutral-600"
                }`}
                style={{
                  borderColor:
                    done || current ? "#facc15" : "rgba(255,255,255,0.12)",
                }}
              >
                {done ? (
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <polyline
                      points="20 6 9 17 4 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${current ? "text-white" : "text-neutral-600"}`}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6 sm:p-8">
        <h2 className="mb-6 text-[18px] font-bold text-white">
          {steps[currentStep]?.title}
        </h2>
        {steps[currentStep]?.component}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {isFirstStep && onCancel && (
            <button
              onClick={onCancel}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              {t("common.cancel")}
            </button>
          )}
          {!isFirstStep && (
            <button
              onClick={() => setCurrentStep((s) => s - 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  d="M19 12H5M5 12L12 19M5 12L12 5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("common.back")}
            </button>
          )}
        </div>
        <button
          disabled={!stepValid}
          onClick={() => {
            if (isLastStep) onComplete();
            else setCurrentStep((s) => s + 1);
          }}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#facc15" }}
        >
          {isLastStep ? t("common.complete") : t("common.next")}
          {!isLastStep && (
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                d="M5 12H19M19 12L12 5M19 12L12 19"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default Wizard;
