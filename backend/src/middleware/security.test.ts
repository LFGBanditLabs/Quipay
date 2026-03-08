import { Response, NextFunction } from "express";
import {
  verifyDiscordSignature,
  verifySlackSignature,
  SecureRequest,
} from "../middleware/security";
import { secretsBootstrap } from "../services/secretsBootstrap";
import { verifyKey } from "discord-interactions";
import crypto from "crypto";

jest.mock("../services/secretsBootstrap");
jest.mock("discord-interactions");

describe("Security Middleware", () => {
  let mockReq: Partial<SecureRequest>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();

  beforeEach(() => {
    mockReq = {
      get: jest.fn(),
      rawBody: Buffer.from('{"test":"body"}'),
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe("verifyDiscordSignature", () => {
    it("should pass if signature is valid", () => {
      (secretsBootstrap.getSecret as jest.Mock).mockReturnValue(
        "valid_pub_key",
      );
      (mockReq.get as jest.Mock).mockImplementation((header) => {
        if (header === "X-Signature-Ed25519") return "valid_sig";
        if (header === "X-Signature-Timestamp") return "valid_ts";
        return undefined;
      });
      (verifyKey as jest.Mock).mockReturnValue(true);

      verifyDiscordSignature(
        mockReq as SecureRequest,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should return 401 if signature is invalid", () => {
      (secretsBootstrap.getSecret as jest.Mock).mockReturnValue(
        "valid_pub_key",
      );
      (mockReq.get as jest.Mock).mockImplementation((header) => {
        if (header === "X-Signature-Ed25519") return "invalid_sig";
        if (header === "X-Signature-Timestamp") return "valid_ts";
        return undefined;
      });
      (verifyKey as jest.Mock).mockReturnValue(false);

      verifyDiscordSignature(
        mockReq as SecureRequest,
        mockRes as Response,
        nextFunction,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid request signature",
      });
    });

    it("should return 500 if public key is missing", () => {
      (secretsBootstrap.getSecret as jest.Mock).mockReturnValue(null);

      verifyDiscordSignature(
        mockReq as SecureRequest,
        mockRes as Response,
        nextFunction,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("verifySlackSignature", () => {
    const signingSecret = "slack_secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = '{"type":"url_verification"}';
    const sigBasestring = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac("sha256", signingSecret);
    const validSignature = `v0=${hmac.update(sigBasestring).digest("hex")}`;

    beforeEach(() => {
      mockReq.rawBody = Buffer.from(body);
    });

    it("should pass if Slack signature is valid", () => {
      (secretsBootstrap.getSecret as jest.Mock).mockReturnValue(signingSecret);
      (mockReq.get as jest.Mock).mockImplementation((header) => {
        if (header === "X-Slack-Signature") return validSignature;
        if (header === "X-Slack-Request-Timestamp") return timestamp;
        return undefined;
      });

      verifySlackSignature(
        mockReq as SecureRequest,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it("should return 401 if Slack signature is invalid", () => {
      (secretsBootstrap.getSecret as jest.Mock).mockReturnValue(signingSecret);
      (mockReq.get as jest.Mock).mockImplementation((header) => {
        if (header === "X-Slack-Signature") return "v0=invalid";
        if (header === "X-Slack-Request-Timestamp") return timestamp;
        return undefined;
      });

      verifySlackSignature(
        mockReq as SecureRequest,
        mockRes as Response,
        nextFunction,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 401 if Slack request is too old", () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
      (secretsBootstrap.getSecret as jest.Mock).mockReturnValue(signingSecret);
      (mockReq.get as jest.Mock).mockImplementation((header) => {
        if (header === "X-Slack-Signature") return validSignature;
        if (header === "X-Slack-Request-Timestamp") return oldTimestamp;
        return undefined;
      });

      verifySlackSignature(
        mockReq as SecureRequest,
        mockRes as Response,
        nextFunction,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Request expired" });
    });
  });
});
