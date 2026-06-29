import { priceFeedService } from "../services/priceFeedService";

describe("priceFeedService", () => {
  beforeEach(() => {
    priceFeedService.invalidateAllCache();
    jest.restoreAllMocks();
  });

  describe("getPrice", () => {
    it("returns correct mock prices when mock provider is used", async () => {
      const result = await priceFeedService.getPrice("USDC", {
        provider: "mock",
        cacheTTL: 60000,
      });
      expect(result).toBeDefined();
      expect(result?.price).toBe(1.0);
      expect(result?.source).toBe("cached");
      expect(result?.tokenSymbol).toBe("USDC");
    });

    it("throws a clear error when band provider is requested", async () => {
      const badConfig = {
        provider: "band" as unknown as "mock",
        cacheTTL: 60000,
      };
      await expect(
        priceFeedService.getPrice("USDC", badConfig),
      ).rejects.toThrow(
        "Band/Pyth provider not yet implemented — use 'coingecko' or 'mock'",
      );
    });

    it("throws a clear error when pyth provider is requested", async () => {
      const badConfig = {
        provider: "pyth" as unknown as "mock",
        cacheTTL: 60000,
      };
      await expect(
        priceFeedService.getPrice("USDC", badConfig),
      ).rejects.toThrow(
        "Band/Pyth provider not yet implemented — use 'coingecko' or 'mock'",
      );
    });

    it("fetches from coingecko when coingecko provider is used", async () => {
      const mockResponse = {
        "usd-coin": {
          usd: 1.01,
          usd_24h_change: 0.1,
        },
      };

      const globalFetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = globalFetchMock;

      const result = await priceFeedService.getPrice("USDC", {
        provider: "coingecko",
        cacheTTL: 60000,
      });

      expect(globalFetchMock).toHaveBeenCalledWith(
        expect.stringContaining("api.coingecko.com/api/v3/simple/price"),
        expect.any(Object),
      );
      expect(result).toBeDefined();
      expect(result?.price).toBe(1.01);
      expect(result?.source).toBe("coingecko");
    });
  });
});
