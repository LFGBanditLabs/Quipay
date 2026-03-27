import React, { useState } from "react";
import Joyride, { Step, CallBackProps, STATUS } from "react-joyride";

const ONBOARDING_KEY = "hasSeenOnboardingTour";

const stepContent = [
  {
    icon: "👋",
    heading: "Welcome to Quipay!",
    body: "This quick tour will walk you through the four steps to get started as an employer: connect your wallet, fund your treasury, register a worker, and create your first payment stream.",
  },
  {
    icon: "🔗",
    heading: "Step 1 — Connect Your Wallet",
    body: "Click the button in the top-right corner to connect your Stellar wallet. This is your identity on the protocol and required for all on-chain actions.",
  },
  {
    icon: "💰",
    heading: "Step 2 — Deposit to Treasury",
    body: "Before streaming any payments, deposit tokens into your treasury. The treasury acts as your payment pool — workers draw from it in real-time.",
  },
  {
    icon: "👷",
    heading: "Step 3 — Register a Worker",
    body: "Add workers to your workforce registry. Each worker needs to be registered with their Stellar wallet address before you can create a stream for them.",
  },
  {
    icon: "⚡",
    heading: "Step 4 — Create a Stream",
    body: "Set up a continuous payment stream for a registered worker. Define a flow rate (tokens/second) and the stream starts immediately. You're all set!",
  },
];

function StepContent({ index }: { index: number }) {
  const { icon, heading, body } = stepContent[index];
  return (
    <div style={{ maxWidth: 280 }}>
      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{icon}</div>
      <h3
        style={{
          margin: "0 0 0.5rem",
          fontSize: "1rem",
          fontWeight: 700,
          lineHeight: 1.3,
        }}
      >
        {heading}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: "0.875rem",
          lineHeight: 1.6,
          opacity: 0.85,
        }}
      >
        {body}
      </p>
    </div>
  );
}

const steps: Step[] = [
  {
    target: "body",
    placement: "center",
    content: <StepContent index={0} />,
    disableBeacon: true,
  },
  {
    target: "#tour-connect-wallet",
    content: <StepContent index={1} />,
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: "#tour-treasury-nav",
    content: <StepContent index={2} />,
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: "#tour-workforce-nav",
    content: <StepContent index={3} />,
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: "#tour-create-stream-nav",
    content: <StepContent index={4} />,
    disableBeacon: true,
    placement: "bottom",
  },
];

const OnboardingTour: React.FC = () => {
  const [run, setRun] = useState(() => !localStorage.getItem(ONBOARDING_KEY));

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(ONBOARDING_KEY, "true");
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      callback={handleCallback}
      locale={{
        back: "← Back",
        close: "Close",
        last: "Done ✓",
        next: "Next →",
        skip: "Skip tour",
      }}
      styles={{
        options: {
          primaryColor: "#6366f1",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: "12px",
          padding: "20px 24px",
        },
        tooltipTitle: {
          display: "none",
        },
        buttonNext: {
          borderRadius: "8px",
          padding: "8px 16px",
          fontSize: "0.875rem",
          fontWeight: 600,
        },
        buttonBack: {
          borderRadius: "8px",
          padding: "8px 16px",
          fontSize: "0.875rem",
        },
        buttonSkip: {
          fontSize: "0.8rem",
          opacity: 0.7,
        },
      }}
    />
  );
};

export default OnboardingTour;
