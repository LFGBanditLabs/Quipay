import React from "react";
import renderer, { act } from "react-test-renderer";
import { TransactionProgressOverlay } from "../TransactionProgressOverlay";

const nodeText = (value: React.ReactNode): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((child) => nodeText(child)).join("");
  }

  return "";
};

describe("TransactionProgressOverlay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders nothing when not visible", () => {
    const tree = renderer
      .create(<TransactionProgressOverlay isVisible={false} stage="building" />)
      .toJSON();

    expect(tree).toBeNull();
  });

  it("renders processing title and all stages when visible", () => {
    const root = renderer.create(
      <TransactionProgressOverlay isVisible stage="signing" />,
    ).root;

    expect(nodeText(root.findByType("h2").children)).toContain(
      "Processing Transaction",
    );

    const labels = root
      .findAllByType("p")
      .map((node) => nodeText(node.children));

    expect(labels).toEqual(
      expect.arrayContaining([
        "Building",
        "Signing",
        "Submitting",
        "Confirmed",
      ]),
    );
  });

  it("shows Done button on confirmed stage and calls onDismiss", () => {
    const onDismiss = jest.fn();
    const root = renderer.create(
      <TransactionProgressOverlay
        isVisible
        stage="confirmed"
        onDismiss={onDismiss}
      />,
    ).root;

    const doneButton = root.findByType("button");
    expect(nodeText(doneButton.children)).toBe("Done");

    act(() => {
      doneButton.props.onClick();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses 3 seconds after confirmation", () => {
    const onDismiss = jest.fn();
    act(() => {
      renderer.create(
        <TransactionProgressOverlay
          isVisible
          stage="confirmed"
          onDismiss={onDismiss}
        />,
      );
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
