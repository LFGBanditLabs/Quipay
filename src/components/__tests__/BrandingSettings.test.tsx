import { act } from "react";
import renderer from "react-test-renderer";
import BrandingSettings from "../BrandingSettings";

jest.mock("../../hooks/useWallet", () => ({
  useWallet: () => ({ address: "GEMPLOYER" }),
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

const okResponse = (body: unknown) =>
  ({
    ok: true,
    json: () => Promise.resolve(body),
  }) as Response;

const failedResponse = () => ({ ok: false }) as Response;

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("BrandingSettings", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const renderWithExistingLogo = async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({
        logoUrl: "https://cdn.example/logo.png",
        primaryColor: "#111111",
        secondaryColor: "#222222",
      }),
    );

    let tree = null as unknown as ReturnType<typeof renderer.create>;
    await act(async () => {
      tree = renderer.create(<BrandingSettings employerAddress="GEMPLOYER" />);
      await flushAsyncWork();
    });

    return tree;
  };

  const clickRemoveLogo = async (tree: ReturnType<typeof renderer.create>) => {
    const removeButton = tree.root
      .findAllByType("button")
      .find((button) => nodeText(button.children) === "Remove Logo");

    if (!removeButton) {
      throw new Error("Remove Logo button not found");
    }

    await act(async () => {
      removeButton.props.onClick();
      await flushAsyncWork();
    });
  };

  it("shows an error and keeps the logo preview when delete returns non-ok", async () => {
    const tree = await renderWithExistingLogo();
    fetchMock.mockResolvedValueOnce(failedResponse());

    await clickRemoveLogo(tree);

    expect(nodeText(tree.toJSON())).toContain(
      "Failed to delete logo. Please try again.",
    );
    expect(tree.root.findByProps({ alt: "Logo preview" }).props.src).toBe(
      "https://cdn.example/logo.png",
    );
  });

  it("shows an error and keeps the logo preview when delete throws", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const tree = await renderWithExistingLogo();
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await clickRemoveLogo(tree);

    expect(nodeText(tree.toJSON())).toContain(
      "Failed to delete logo. Please try again.",
    );
    expect(tree.root.findByProps({ alt: "Logo preview" }).props.src).toBe(
      "https://cdn.example/logo.png",
    );
    consoleSpy.mockRestore();
  });
});
