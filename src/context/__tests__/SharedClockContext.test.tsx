import React from "react";
import renderer, { act } from "react-test-renderer";
import { SharedClockProvider, useElapsedTime } from "../SharedClockContext";

const ElapsedConsumer: React.FC<{ startTimestamp: number }> = ({
  startTimestamp,
}) => {
  const elapsed = useElapsedTime(startTimestamp);
  return <span>{elapsed}</span>;
};

describe("SharedClockProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("uses a single interval even with many elapsed-time consumers", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <SharedClockProvider>
          <>
            {Array.from({ length: 75 }, (_, index) => (
              <ElapsedConsumer
                key={index}
                startTimestamp={Math.floor(Date.now() / 1000) - index}
              />
            ))}
          </>
        </SharedClockProvider>,
      );
    });

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    tree!.unmount();
  });
});
