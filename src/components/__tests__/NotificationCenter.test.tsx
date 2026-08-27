import React, { act } from "react";
import renderer from "react-test-renderer";
import { BrowserRouter } from "react-router-dom";
import { NotificationCenter } from "../NotificationCenter";
import { NotificationItem } from "../NotificationItem";
import { NotificationProvider } from "../../providers/NotificationProvider";

// Mock useWallet
jest.mock("../../hooks/useWallet", () => ({
  useWallet: () => ({
    address: "GTESTUSER",
  }),
}));

// Mock useAuth
jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    authenticated: false,
    getAccessToken: async () => null,
  }),
}));

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

describe("NotificationCenter UI", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders bell trigger button without badge when no unread notifications", async () => {
    let testRenderer!: renderer.ReactTestRenderer;
    await act(async () => {
      testRenderer = renderer.create(
        <BrowserRouter>
          <NotificationProvider>
            <NotificationCenter />
          </NotificationProvider>
        </BrowserRouter>,
      );
    });

    const button = testRenderer.root.findByType("button");
    expect(button.props["aria-label"]).toBe("Notification Center");
    expect(testRenderer.root.findAllByType("span").length).toBe(0);
  });

  it("renders NotificationItem with title, message, and relative time", async () => {
    const mockNotif = {
      id: "test-1",
      type: "stream.started" as const,
      title: "Stream Started",
      message: "Acme Corp started streaming 5,000 USDC/month to you",
      timestamp: Date.now() - 5 * 60 * 1000,
      read: false,
      actionUrl: "/stream/123",
    };

    const onRead = jest.fn();
    let testRenderer!: renderer.ReactTestRenderer;

    await act(async () => {
      testRenderer = renderer.create(
        <BrowserRouter>
          <NotificationItem notification={mockNotif} onRead={onRead} />
        </BrowserRouter>,
      );
    });

    const root = testRenderer.root;
    expect(nodeText(root.children)).toContain("Stream Started");
    expect(nodeText(root.children)).toContain("5,000 USDC/month");
    expect(nodeText(root.children)).toContain("5m ago");

    // Click item triggers onRead
    const item = root.findByProps({ role: "listitem" });
    await act(async () => {
      item.props.onClick({ stopPropagation: jest.fn() });
    });

    expect(onRead).toHaveBeenCalledWith("test-1");
  });
});
