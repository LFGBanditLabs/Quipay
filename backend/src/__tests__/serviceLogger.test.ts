import { jest } from "@jest/globals";
import { getAuditLogger, isAuditLoggerInitialized } from "../audit/init";
import {
  logServiceError,
  logServiceInfo,
  logServiceWarn,
} from "../audit/serviceLogger";

const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockError = jest.fn();

jest.mock("../audit/init", () => ({
  getAuditLogger: jest.fn(),
  isAuditLoggerInitialized: jest.fn(),
}));

const mockGetAuditLogger = jest.mocked(getAuditLogger);
const mockIsAuditLoggerInitialized = jest.mocked(isAuditLoggerInitialized);

describe("serviceLogger", () => {
  const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  const consoleWarnSpy = jest
    .spyOn(console, "warn")
    .mockImplementation(() => {});
  const consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuditLogger.mockReturnValue({
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
    } as any);
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("logs info through the audit logger when initialized", async () => {
    mockIsAuditLoggerInitialized.mockReturnValue(true);

    await logServiceInfo("KeyRotation", "Rotation finished", {
      key_name: "hot-wallet",
    });

    expect(mockInfo).toHaveBeenCalledWith("Rotation finished", {
      action_type: "system",
      service: "KeyRotation",
      key_name: "hot-wallet",
    });
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  test("falls back to console when audit logger is not initialized", async () => {
    mockIsAuditLoggerInitialized.mockReturnValue(false);

    await logServiceWarn("SecretsBootstrap", "Vault unavailable", {
      vault_available: false,
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[SecretsBootstrap] Vault unavailable",
      { vault_available: false },
    );
    expect(mockWarn).not.toHaveBeenCalled();
  });

  test("normalizes unknown errors before sending them to the audit logger", async () => {
    mockIsAuditLoggerInitialized.mockReturnValue(true);

    await logServiceError("VaultService", "Secret fetch failed", "boom", {
      key_name: "api-key",
    });

    expect(mockError).toHaveBeenCalledWith(
      "Secret fetch failed",
      expect.objectContaining({ message: "boom" }),
      {
        action_type: "system",
        service: "VaultService",
        key_name: "api-key",
      },
    );
  });
});
