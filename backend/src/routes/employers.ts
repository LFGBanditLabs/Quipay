import { Router, Response } from "express";
import { validateRequest } from "../middleware/validation";
import {
  authenticateRequest,
  requireUser,
  AuthenticatedRequest,
} from "../middleware/rbac";
import { requireVerifiedEmployer } from "../middleware/employerVerification";
import {
  employerOnboardingSchema,
  employerTreasuryDepositSchema,
} from "../schemas/employers.schema";
import {
  getTreasuryBalanceByEmployer,
  getEmployerById,
  recordVaultEvent,
  upsertEmployerVerification,
  updateTreasuryBalance,
} from "../db/queries";
import { verifyBusinessRegistration } from "../services/kybService";

export const employersRouter = Router();

employersRouter.use(authenticateRequest, requireUser);

employersRouter.post(
  "/onboard",
  validateRequest({ body: employerOnboardingSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const verification = await verifyBusinessRegistration(req.body);
    const employer = await upsertEmployerVerification({
      employerId: req.user.id,
      businessName: req.body.businessName,
      registrationNumber: req.body.registrationNumber,
      countryCode: req.body.countryCode,
      contactName: req.body.contactName,
      contactEmail: req.body.contactEmail,
      verificationStatus: verification.status,
      verificationReason: verification.reason ?? null,
      verificationMetadata: verification.metadata ?? {},
    });

    res.status(verification.status === "verified" ? 200 : 202).json({
      employer,
      status: employer.verification_status,
    });
  },
);

employersRouter.get(
  "/status",
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const employer = await getEmployerById(req.user.id);
    if (!employer) {
      return res.json({ status: "not_started" });
    }

    res.json({
      status: employer.verification_status,
      employer,
    });
  },
);

employersRouter.post(
  "/treasury/deposit",
  validateRequest({ body: employerTreasuryDepositSchema }),
  requireVerifiedEmployer,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const existingBalance = await getTreasuryBalanceByEmployer(req.user.id);
    const currentBalance = BigInt(existingBalance?.balance ?? "0");
    const amount = req.body.amount as bigint;
    const token = req.body.token as string;

    await updateTreasuryBalance(req.user.id, currentBalance + amount, token);
    await recordVaultEvent({
      eventType: "deposit",
      address: req.user.id,
      token,
      amount,
      ledger: 0,
      ledgerTs: Math.floor(Date.now() / 1000),
    });

    res.status(201).json({
      employerId: req.user.id,
      amount: amount.toString(),
      token,
      status: "accepted",
    });
  },
);
