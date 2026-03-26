import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./rbac";
import { getEmployerById } from "../db/queries";

export const requireVerifiedEmployer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized: not authenticated" });
    return;
  }

  const employer = await getEmployerById(req.user.id);
  if (!employer || employer.verification_status !== "verified") {
    res.status(403).json({
      error: "Employer must complete KYB verification before this action",
      status: employer?.verification_status ?? "not_started",
    });
    return;
  }

  next();
};
