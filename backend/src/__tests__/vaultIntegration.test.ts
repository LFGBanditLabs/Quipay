import { jest } from "@jest/globals";
import { VaultClient } from "../services/vaultClient";
import { SecretsBootstrap } from "../services/secretsBootstrap";
import { vaultService } from "../services/vaultService";

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock audit logger to avoid noise
jest.mock("../audit/serviceLogger", () => ({
  logServiceInfo: jest.fn(),
  logServiceWarn: jest.fn(),
  logServiceError: jest.fn(),
}));

describe("Vault Integration", () => {
  let vaultClient: VaultClient;
  let secretsBootstrap: SecretsBootstrap;

  beforeEach(() => {
    jest.clearAllMocks();
    vaultClient = new VaultClient({
      url: "http://vault:8200",
      token: "test-token",
    });
    
    // Create a new instance for testing to avoid side effects
    secretsBootstrap = new SecretsBootstrap();
    
    // Clear process.env secrets we might test
    delete process.env.HOT_WALLET_SECRET;
    delete process.env.PAYSLIP_SIGNING_KEY_PRIVATE;
    delete process.env.DATABASE_URL;
  });

  describe("VaultClient", () => {
    test("healthCheck returns true when Vault is healthy", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ initialized: true, sealed: false }),
      } as Response);

      const isHealthy = await vaultClient.healthCheck();
      expect(isHealthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("http://vault:8200/v1/sys/health", expect.any(Object));
    });

    test("healthCheck returns false when Vault is unhealthy", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const isHealthy = await vaultClient.healthCheck();
      expect(isHealthy).toBe(false);
    });

    test("lookupSelfToken returns true when token is valid", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "test-token" } }),
      } as Response);

      const isValid = await vaultClient.lookupSelfToken();
      expect(isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("http://vault:8200/v1/auth/token/lookup-self", expect.any(Object));
    });
  });

  describe("SecretsBootstrap", () => {
    test("bootstrapSecrets fetches secrets from Vault and injects them into process.env", async () => {
      // Mock health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);
      
      // Mock token validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      // Mock individual secret fetches
      // First, required secrets (DATABASE_URL, OPENAI_API_KEY, STELLAR_RPC_URL)
      // Then optional secrets (HOT_WALLET_SECRET, PAYSLIP_SIGNING_KEY_PRIVATE, etc.)
      
      // I'll mock vaultService.getSecret instead of multiple fetch calls for simplicity
      const getSecretSpy = jest.spyOn(vaultService, "getSecret");
      getSecretSpy.mockImplementation(async (key: string) => {
        if (key === "hot_wallet_secret") return "vault-hot-secret";
        if (key === "payslip_signing_key_private") return "vault-signing-key";
        if (key === "database_url") return "vault-db-url";
        return null;
      });

      // Mock isHealthy and isTokenValid on vaultService since SecretsBootstrap uses vaultService instance
      jest.spyOn(vaultService, "isHealthy").mockResolvedValue(true);
      jest.spyOn(vaultService, "isTokenValid").mockResolvedValue(true);

      await secretsBootstrap.bootstrapSecrets();

      expect(process.env.HOT_WALLET_SECRET).toBe("vault-hot-secret");
      expect(process.env.PAYSLIP_SIGNING_KEY_PRIVATE).toBe("vault-signing-key");
      expect(process.env.DATABASE_URL).toBe("vault-db-url");
      
      getSecretSpy.mockRestore();
    });

    test("bootstrapSecrets falls back to process.env if Vault is unavailable", async () => {
      // Mock health check failure
      jest.spyOn(vaultService, "isHealthy").mockResolvedValue(false);
      
      process.env.DATABASE_URL = "env-db-url";
      
      await secretsBootstrap.bootstrapSecrets();

      expect(process.env.DATABASE_URL).toBe("env-db-url");
    });
  });
});
