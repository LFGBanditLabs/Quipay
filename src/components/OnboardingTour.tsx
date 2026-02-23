import React, { useState } from "react";
import Joyride, { Step, CallBackProps } from "react-joyride";

const OnboardingTour: React.FC = () => {
  const [run, setRun] = useState(() => {
    return !localStorage.getItem("hasSeenOnboardingTour");
  });

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = ["finished", "skipped"];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem("hasSeenOnboardingTour", "true");
    }
  };

  const steps: Step[] = [
    {
      target: "#tour-treasury-balance",
      content: (
        <div>
          <h3>Treasury Balance</h3>
          <p>
            This shows the total assets available in your protocol's treasury.
            It's the pool of funds used to pay your workers.
          </p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: "#tour-manage-treasury",
      content: (
        <div>
          <h3>Manage Treasury</h3>
          <p>
            Click here to deposit more tokens into your treasury or withdraw
            excess funds back to your wallet.
          </p>
        </div>
      ),
    },
    {
      target: "#tour-liabilities",
      content: (
        <div>
          <h3>
            Total Liabilities{" "}
            <span style={{ fontSize: "0.8em", opacity: 0.8 }}>
              ("What is this?")
            </span>
          </h3>
          <p>
            <strong>Liabilities</strong> represent your projected outgoing
            payments based on all currently active streams over a 30-day period.
            Keeping an eye on this ensures you don't run out of funds!
          </p>
        </div>
      ),
    },
    {
      target: "#tour-active-streams",
      content: (
        <div>
          <h3>Active Streams Count</h3>
          <p>
            This is the total number of workers or contracts you are currently
            streaming funds to in real-time.
          </p>
        </div>
      ),
    },
    {
      target: "#tour-create-stream",
      content: (
        <div>
          <h3>Create New Stream</h3>
          <p>
            Ready to pay someone? Click here to set up a new continuous payment
            stream for a worker. You'll need their wallet address and the
            desired Flow Rate.
          </p>
        </div>
      ),
    },
    {
      target: "#tour-streams-list",
      content: (
        <div>
          <h3>
            Your Streams{" "}
            <span style={{ fontSize: "0.8em", opacity: 0.8 }}>
              ("What is this?")
            </span>
          </h3>
          <p>
            Here you can monitor all ongoing streams. <br />
            <br />
            <strong>Flow Rate:</strong> The amount of tokens transferred per
            second.
            <br />
            <strong>Total Streamed:</strong> The exact amount that has
            successfully reached the worker so far.
          </p>
        </div>
      ),
    },
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "#0070f3",
          zIndex: 1000,
        },
      }}
    />
  );
};

export default OnboardingTour;
