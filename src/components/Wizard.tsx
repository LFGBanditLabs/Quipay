import React, { useState } from "react";
import { Button, Text } from "@stellar/design-system";
import styles from "./Wizard.module.css";

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
    <div className={styles.wizard}>
      <div className={styles.stepsIndicator}>
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={`${styles.step} ${
              index === currentStep ? styles.stepActive : ""
            } ${index < currentStep ? styles.stepCompleted : ""}`}
          >
            {index < currentStep ? "✓" : index + 1}
            <span
              className={`${styles.stepLabel} ${
                index === currentStep ? styles.stepLabelActive : ""
              }`}
            >
              {step.title}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.content}>
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

      <div className={styles.footer}>
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
