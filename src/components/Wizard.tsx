import React, { useState } from "react";
import { Button, Text } from "@stellar/design-system";

interface WizardStep {
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
  const [currentStep, setCurrentStep] = useState(0);

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-8">
      <div className="relative mb-8 flex justify-between before:absolute before:left-0 before:right-0 before:top-[15px] before:z-0 before:h-[2px] before:bg-[var(--border)] before:content-['']">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={`relative z-[1] flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
              index < currentStep
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : index === currentStep
                  ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)] shadow-[0_0_0_4px_var(--accent-transparent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
            }`}
          >
            {index < currentStep ? "✓" : index + 1}
            <span
              className={`absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap text-xs ${
                index === currentStep
                  ? "font-medium text-[var(--text)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {step.title}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_1px_3px_var(--shadow-color)]">
        <Text
          as="h2"
          size="lg"
          weight="medium"
          style={{ marginBottom: "1.5rem" }}
        >
          {steps[currentStep].title}
        </Text>
        {steps[currentStep].component}
      </div>

      <div className="mt-4 flex justify-between">
        <div>
          {onCancel && isFirstStep && (
            <Button variant="secondary" size="md" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {!isFirstStep && (
            <Button variant="secondary" size="md" onClick={handleBack}>
              Back
            </Button>
          )}
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleNext}
          disabled={steps[currentStep].isValid === false}
        >
          {isLastStep ? "Complete" : "Next"}
        </Button>
      </div>
    </div>
  );
};

export default Wizard;
