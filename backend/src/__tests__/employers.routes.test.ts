jest.mock("../db/queries", () => ({
  getEmployerById: jest.fn(),
  getTreasuryBalanceByEmployer: jest.fn(),
  recordVaultEvent: jest.fn().mockResolvedValue(undefined),
  upsertEmployerVerification: jest.fn(),
  updateTreasuryBalance: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/kybService", () => ({
  verifyBusinessRegistration: jest.fn(),
}));

import express from "express";
import request from "supertest";
import { employersRouter } from "../routes/employers";
import {
  getEmployerById,
  getTreasuryBalanceByEmployer,
  upsertEmployerVerification,
} from "../db/queries";
import { verifyBusinessRegistration } from "../services/kybService";

const mockGetEmployerById = getEmployerById as jest.Mock;
const mockGetTreasuryBalanceByEmployer =
  getTreasuryBalanceByEmployer as jest.Mock;
const mockUpsertEmployerVerification = upsertEmployerVerification as jest.Mock;
const mockVerifyBusinessRegistration = verifyBusinessRegistration as jest.Mock;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/employers", employersRouter);
  return app;
};

describe("employer onboarding and verification routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("onboards an employer and stores verified status", async () => {
    const app = buildApp();

    mockVerifyBusinessRegistration.mockResolvedValueOnce({
      status: "verified",
      metadata: { provider: "mock" },
    });
    mockUpsertEmployerVerification.mockResolvedValueOnce({
      employer_id: "employer-1",
      verification_status: "verified",
    });

    const res = await request(app)
      .post("/api/employers/onboard")
      .set("x-user-id", "employer-1")
      .set("x-user-role", "user")
      .send({
        businessName: "Acme Payroll Ltd",
        registrationNumber: "RC-12345",
        countryCode: "ng",
      });

    expect(res.status).toBe(200);
    expect(mockVerifyBusinessRegistration).toHaveBeenCalled();
    expect(res.body.status).toBe("verified");
  });

  it("returns not_started when employer has not onboarded yet", async () => {
    const app = buildApp();
    mockGetEmployerById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get("/api/employers/status")
      .set("x-user-id", "employer-1")
      .set("x-user-role", "user");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("not_started");
  });

  it("blocks treasury deposits for unverified employers", async () => {
    const app = buildApp();
    mockGetEmployerById.mockResolvedValueOnce({
      employer_id: "employer-1",
      verification_status: "pending",
    });

    const res = await request(app)
      .post("/api/employers/treasury/deposit")
      .set("x-user-id", "employer-1")
      .set("x-user-role", "user")
      .send({ amount: "1000", token: "USDC" });

    expect(res.status).toBe(403);
  });

  it("allows treasury deposits for verified employers", async () => {
    const app = buildApp();
    mockGetEmployerById.mockResolvedValueOnce({
      employer_id: "employer-1",
      verification_status: "verified",
    });
    mockGetTreasuryBalanceByEmployer.mockResolvedValueOnce({
      employer: "employer-1",
      balance: "500",
      token: "USDC",
    });

    const res = await request(app)
      .post("/api/employers/treasury/deposit")
      .set("x-user-id", "employer-1")
      .set("x-user-role", "user")
      .send({ amount: "1000", token: "USDC" });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe("1000");
  });
});
