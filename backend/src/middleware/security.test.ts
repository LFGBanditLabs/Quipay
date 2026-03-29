import { Response, NextFunction } from "express";
import {
  verifyDiscordSignature,
  verifySlackSignature,
  SecureRequest,
} from "../middleware/security";
import { inputSanitizationMiddleware } from "../middleware/inputSanitization";
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

  describe("inputSanitizationMiddleware", () => {
    it("should sanitize HTML tags from string fields", () => {
      const mockReq = {
        body: {
          name: "<script>alert('xss')</script>",
          description: "Normal text",
        },
      } as any;
      const mockRes = {} as Response;
      const next = jest.fn();

      inputSanitizationMiddleware(mockReq, mockRes, next);

      expect(mockReq.body.name).toBe("");
      expect(mockReq.body.description).toBe("Normal text");
      expect(next).toHaveBeenCalled();
    });

    it("should strip null bytes and control characters", () => {
      const mockReq = {
        body: {
          input: "test\x00\x01\x02string",
        },
      } as any;
      const mockRes = {} as Response;
      const next = jest.fn();

      inputSanitizationMiddleware(mockReq, mockRes, next);

      expect(mockReq.body.input).toBe("teststring");
      expect(next).toHaveBeenCalled();
    });

    it("should handle nested objects", () => {
      const mockReq = {
        body: {
          user: {
            name: "<b>Bold</b>",
            details: {
              bio: "Some\x00bio",
            },
          },
        },
      } as any;
      const mockRes = {} as Response;
      const next = jest.fn();

      inputSanitizationMiddleware(mockReq, mockRes, next);

      expect(mockReq.body.user.name).toBe("Bold");
      expect(mockReq.body.user.details.bio).toBe("Somebio");
      expect(next).toHaveBeenCalled();
    });

    it("should handle arrays", () => {
      const mockReq = {
        body: {
          items: ["<i>item1</i>", "item2\x00"],
        },
      } as any;
      const mockRes = {} as Response;
      const next = jest.fn();

      inputSanitizationMiddleware(mockReq, mockRes, next);

      expect(mockReq.body.items).toEqual(["item1", "item2"]);
      expect(next).toHaveBeenCalled();
    });

    it("should return 400 on depth exceeded", () => {
      const deepObject = { a: { b: { c: { d: { e: { f: "deep" } } } } } };
      const mockReq = { body: deepObject } as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      const next = jest.fn();

      inputSanitizationMiddleware(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid request body",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
