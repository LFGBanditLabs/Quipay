import { act } from "react";
import renderer from "react-test-renderer";
import { useRelativeTime } from "../useRelativeTime";

const RelativeTimeProbe = ({
  timestamp,
  intervalMs,
}: {
  timestamp: number;
  intervalMs?: number;
}) => <span>{useRelativeTime(timestamp, intervalMs)}</span>;

describe("useRelativeTime", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-17T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("refreshes the relative label on the configured interval", () => {
    const timestamp = Date.now();
    let tree = null as unknown as ReturnType<typeof renderer.create>;

    act(() => {
      tree = renderer.create(
        <RelativeTimeProbe timestamp={timestamp} intervalMs={30_000} />,
      );
    });

    expect(tree.root.findByType("span").children).toEqual(["just now"]);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(tree.root.findByType("span").children).toEqual(["1m ago"]);
  });

  it("uses a new timestamp immediately without waiting for the next tick", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;

    act(() => {
      tree = renderer.create(
        <RelativeTimeProbe
          timestamp={Date.now() - 120_000}
          intervalMs={30_000}
        />,
      );
    });

    expect(tree.root.findByType("span").children).toEqual(["2m ago"]);

    act(() => {
      tree.update(
        <RelativeTimeProbe timestamp={Date.now()} intervalMs={30_000} />,
      );
    });

    expect(tree.root.findByType("span").children).toEqual(["just now"]);
  });

  it("clears its interval when the consumer unmounts", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;

    act(() => {
      tree = renderer.create(
        <RelativeTimeProbe timestamp={Date.now()} intervalMs={30_000} />,
      );
    });

    expect(jest.getTimerCount()).toBe(1);

    act(() => {
      tree.unmount();
    });

    expect(jest.getTimerCount()).toBe(0);
  });
});
