import { act } from "react";
import renderer from "react-test-renderer";
import { TransactionProgressOverlay } from "../TransactionProgressOverlay";

const nodeText = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((child) => nodeText(child)).join("");
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "children" in value &&
    Array.isArray(value.children)
  ) {
    return nodeText((value as { children: unknown[] }).children);
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
    let testRenderer!: renderer.ReactTestRenderer;
    act(() => {
      testRenderer = renderer.create(
        <TransactionProgressOverlay isVisible stage="signing" />,
      );
    });
    const root = testRenderer.root;

    expect(nodeText(root.findByType("h2").children)).toContain(
      "Processing Transaction",
    );

    const labels = root
      .findAllByType("p")
      .map((node: ReturnType<typeof renderer.create>["root"]) =>
        nodeText(node.children),
      );

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
    let testRenderer!: renderer.ReactTestRenderer;
    act(() => {
      testRenderer = renderer.create(
        <TransactionProgressOverlay
          isVisible
          stage="confirmed"
          onDismiss={onDismiss}
        />,
      );
    });
    const root = testRenderer.root;

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
