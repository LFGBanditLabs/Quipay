import { z } from "zod";

export const employerOnboardingSchema = z.object({
  businessName: z.string().trim().min(2).max(200),
  registrationNumber: z.string().trim().min(3).max(100),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  contactName: z.string().trim().min(2).max(120).optional(),
  contactEmail: z.string().trim().email().max(320).optional(),
});

export const employerTreasuryDepositSchema = z.object({
  amount: z.coerce.bigint().positive(),
  token: z.string().trim().min(2).max(20).default("USDC"),
});

export type EmployerOnboardingInput = z.infer<typeof employerOnboardingSchema>;
export type EmployerTreasuryDepositInput = z.infer<
  typeof employerTreasuryDepositSchema
>;
