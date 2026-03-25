/**
 * StreamCreator
 * ─────────────
 * An employer-facing form to create a new payroll stream on-chain.
 *
 * Features
 * ────────
 * • Form fields: worker address, token, rate, start date, end date
 * • Client-side input validation with per-field error messages
 * • Treasury solvency check (reads PayrollVault.get_balance) before submit
 * • Calls payroll_stream.create_stream via the Soroban RPC
 * • Shows loading state while the transaction is in-flight
 * • Displays success (with tx hash) or error message
 * • Resets form on success
 *
 * Dependencies
 * ────────────
 * • Issue #21  – Wallet (useWallet hook / WalletProvider)
 * • Issue #2   – create_stream contract function (payroll_stream.ts)
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useMemo,
  useState,
} from "react";
import { z } from "zod";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { Button } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useNotification } from "../hooks/useNotification";
import { translateError } from "../util/errors";
import { ErrorMessage } from "./ErrorMessage";
import TransactionSimulationModal, {
  type TransactionPreview,
} from "./TransactionSimulationModal";
import {
  buildCreateStreamTx,
  checkTreasurySolvency,
  submitAndAwaitTx,
  PAYROLL_STREAM_CONTRACT_ID,
  type CreateStreamParams,
} from "../contracts/payroll_stream";
import { TransactionProgress } from "./Loading";
import {
  simulateTransaction,
  type CurrentBalance,
  type SimulationResult,
} from "../util/simulationUtils";

const tw = {
  wrapper: "mx-auto max-w-[680px]",
  card: "rounded-xl border border-[var(--sds-color-neutral-border,#e2e8f0)] bg-[var(--sds-color-background-primary,#fff)] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]",
  header: "mb-7",
  title:
    "mb-1.5 text-[1.375rem] font-bold text-[var(--sds-color-content-primary,#0f172a)]",
  subtitle: "m-0 text-sm text-[var(--sds-color-content-secondary,#4b5563)]",
  form: "flex flex-col gap-5",
  fieldGroup: "flex flex-col gap-1.5",
  fieldRow: "grid grid-cols-2 gap-4 max-[540px]:grid-cols-1",
  label:
    "text-[0.8125rem] font-semibold tracking-[0.01em] text-[var(--sds-color-content-primary,#0f172a)]",
  required: "ml-0.5 text-[var(--sds-color-feedback-error,#ef4444)]",
  input:
    "box-border w-full appearance-none rounded-lg border-[1.5px] border-[var(--sds-color-neutral-border,#cbd5e1)] bg-[var(--sds-color-background-primary,#fff)] px-[14px] py-2.5 text-[0.9375rem] text-[var(--sds-color-content-primary,#0f172a)] transition-all duration-150 placeholder:text-[var(--sds-color-content-placeholder,#94a3b8)] hover:border-[var(--sds-color-neutral-border-hover,#94a3b8)] focus:border-[var(--sds-color-brand-primary,#6366f1)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] focus:outline-none",
  inputError:
    "!border-[var(--sds-color-feedback-error,#ef4444)] !shadow-[0_0_0_3px_rgba(239,68,68,0.12)]",
  footer: "mt-1 flex items-center justify-end gap-3",
  spinner:
    "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white align-middle",
  walletNotice:
    "flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--muted)]",
  walletNoticeIcon: "text-base leading-6",
};

// ─── Constants ───────────────────────────────────────────────────────────────

/** Known tokens. In a real app this would come from the contract or an API. */
const SUPPORTED_TOKENS: { label: string; value: string; decimal: number }[] = [
  { label: "XLM (Native)", value: "native", decimal: 7 },
  {
    label: "USDC",
    value: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    decimal: 7,
  },
];

/** PayrollVault contract ID for solvency checks */
const PAYROLL_VAULT_CONTRACT_ID: string =
  (import.meta.env.VITE_PAYROLL_VAULT_CONTRACT_ID as string | undefined) ?? "";

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormValues {
  workerAddress: string;
  token: string;
  /** Human-readable rate (e.g. "0.0001") tokens per second */
  rate: string;
  startDate: string;
  endDate: string;
}

interface FormErrors {
  workerAddress?: string;
  token?: string;
  rate?: string;
  startDate?: string;
  endDate?: string;
}

const INITIAL_VALUES: FormValues = {
  workerAddress: "",
  token: SUPPORTED_TOKENS[0].value,
  rate: "",
  startDate: "",
  endDate: "",
};

// ─── Transaction status ───────────────────────────────────────────────────────

type TxPhase =
  | { kind: "idle" }
  | { kind: "simulating" }
  | { kind: "signing" }
  | { kind: "submitting" }
  | { kind: "success"; hash: string }
  | { kind: "error"; message: string };

// ─── Solvency status ─────────────────────────────────────────────────────────

type SolvencyStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "insufficient" }
  | { kind: "error" };

// ─── Reducer for form + tx state ─────────────────────────────────────────────

type State = {
  values: FormValues;
  errors: FormErrors;
  txPhase: TxPhase;
  solvency: SolvencyStatus;
};

type Action =
  | { type: "SET_FIELD"; field: keyof FormValues; value: string }
  | { type: "SET_ERRORS"; errors: FormErrors }
  | { type: "SET_TX_PHASE"; phase: TxPhase }
  | { type: "SET_SOLVENCY"; solvency: SolvencyStatus }
  | { type: "RESET" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        // Clear the error for this field as the user starts typing
        errors: { ...state.errors, [action.field]: undefined },
      };
    case "SET_ERRORS":
      return { ...state, errors: action.errors };
    case "SET_TX_PHASE":
      return { ...state, txPhase: action.phase };
    case "SET_SOLVENCY":
      return { ...state, solvency: action.solvency };
    case "RESET":
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

const INITIAL_STATE: State = {
  values: INITIAL_VALUES,
  errors: {},
  txPhase: { kind: "idle" },
  solvency: { kind: "idle" },
};

// ─── Validation ───────────────────────────────────────────────────────────────

/** Basic Stellar public key check. */
function isValidStellarAddress(addr: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(addr);
}

const streamSchema = z
  .object({
    workerAddress: z
      .string()
      .trim()
      .min(1, "Worker address is required.")
      .refine(
        isValidStellarAddress,
        "Must be a valid Stellar public key (starts with G, 56 characters).",
      ),
    token: z.string().min(1, "Please select a token."),
    rate: z
      .string()
      .trim()
      .min(1, "Rate is required.")
      .refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, "Rate must be a positive number."),
    startDate: z
      .string()
      .min(1, "Start date is required.")
      .refine((val) => {
        const now = Date.now();
        return new Date(val).getTime() >= now - 60_000;
      }, "Start date cannot be in the past."),
    endDate: z.string().min(1, "End date is required."),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate) {
      if (new Date(data.endDate) <= new Date(data.startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be after the start date.",
          path: ["endDate"],
        });
      }
    }
  });

function validate(values: FormValues): FormErrors {
  const result = streamSchema.safeParse(values);
  if (result.success) {
    return {};
  }
  const errors: FormErrors = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path[0] as keyof FormErrors;
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  });
  return errors;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts a human-readable decimal amount to stroops (bigint). */
function toStroops(amount: number | string, decimals: number): bigint {
  const factor = Math.pow(10, decimals);
  return BigInt(
    Math.round(
      typeof amount === "string" ? parseFloat(amount) : amount * factor,
    ),
  );
}

/** Returns today's date as YYYY-MM-DD. */
function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function calculateEstimatedTotal(values: FormValues): number {
  if (!values.rate || !values.startDate || !values.endDate) return 0;
  const start = new Date(values.startDate).getTime();
  const end = new Date(values.endDate).getTime();
  const durationSeconds = Math.max(0, (end - start) / 1000);
  return parseFloat(values.rate) * durationSeconds;
}

function formatTokenAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function shortenContractId(contractId: string): string {
  if (contractId.length <= 10) return contractId;
  return `${contractId.slice(0, 5)}...${contractId.slice(-4)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StreamCreatorProps {
  onSuccess?: (txHash: string) => void;
  onCancel?: () => void;
}

const StreamCreator: React.FC<StreamCreatorProps> = ({
  onSuccess,
  onCancel,
}: StreamCreatorProps) => {
  const { address, signTransaction, networkPassphrase } = useWallet();
  const { addNotification } = useNotification();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const { values, errors, txPhase, solvency } = state;

  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;

  const solvencyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Calculated metrics ─────────────────────────────────────────────────────

  const estimatedTotal = useMemo(() => {
    return calculateEstimatedTotal(values);
  }, [values]);

  const tokenSymbol = useMemo(() => {
    const t = SUPPORTED_TOKENS.find((t) => t.value === values.token);
    return t ? t.label.split(" ")[0] : "Tokens";
  }, [values.token]);

  const previewValues = pendingValues ?? values;
  const previewEstimatedTotal = useMemo(
    () => calculateEstimatedTotal(previewValues),
    [previewValues],
  );
  const previewTokenSymbol = useMemo(() => {
    const t = SUPPORTED_TOKENS.find(
      (token) => token.value === previewValues.token,
    );
    return t ? t.label.split(" ")[0] : "Tokens";
  }, [previewValues.token]);

  const createParamsFromValues = useCallback(
    (formValues: FormValues): CreateStreamParams => {
      const tokenDef = SUPPORTED_TOKENS.find(
        (t) => t.value === formValues.token,
      );
      const decimals = tokenDef?.decimal ?? 7;
      const rateStroops = toStroops(formValues.rate, decimals);
      const amountStroops = toStroops(
        calculateEstimatedTotal(formValues),
        decimals,
      );
      const startTs = Math.floor(
        new Date(formValues.startDate).getTime() / 1000,
      );
      const endTs = Math.floor(new Date(formValues.endDate).getTime() / 1000);

      return {
        employer: address ?? "",
        worker: formValues.workerAddress.trim(),
        token: formValues.token === "native" ? "" : formValues.token,
        rate: rateStroops,
        amount: amountStroops,
        startTs,
        endTs,
      };
    },
    [address],
  );

  const simulationPreview = useMemo<TransactionPreview | null>(() => {
    if (!pendingValues || !PAYROLL_STREAM_CONTRACT_ID) {
      return null;
    }

    const worker = pendingValues.workerAddress.trim();
    if (
      !worker ||
      !pendingValues.rate ||
      !pendingValues.startDate ||
      !pendingValues.endDate
    ) {
      return null;
    }

    return {
      description: `Create stream for ${worker.slice(0, 6)}...${worker.slice(-4)}`,
      contractFunction: "create_stream",
      contractAddress: shortenContractId(PAYROLL_STREAM_CONTRACT_ID),
      currentBalances: [
        {
          token: previewTokenSymbol,
          symbol: previewTokenSymbol,
          amount: previewEstimatedTotal,
        },
        {
          token: "XLM",
          symbol: "XLM",
          amount: 1,
        },
      ],
      expectedTransfers: [
        {
          label: "Payroll vault reserves",
          symbol: previewTokenSymbol,
          amount: previewEstimatedTotal,
        },
      ],
      stateChanges: [
        `Create an active payroll stream for ${worker.slice(0, 6)}...${worker.slice(-4)}`,
        `Reserve ${formatTokenAmount(previewEstimatedTotal)} ${previewTokenSymbol} as vault liability`,
        "Store the worker, schedule, and rate on-chain",
      ],
    };
  }, [pendingValues, previewEstimatedTotal, previewTokenSymbol]);

  const runCreateSimulation =
    useCallback(async (): Promise<SimulationResult> => {
      if (!pendingValues) {
        throw new Error("No pending stream submission.");
      }
      if (!address) {
        throw new Error("Please connect your wallet first.");
      }
      if (!networkPassphrase) {
        throw new Error("Network passphrase is not configured.");
      }
      if (!PAYROLL_STREAM_CONTRACT_ID) {
        throw new Error("PayrollStream contract ID not configured.");
      }

      const { preparedXdr } = await buildCreateStreamTx(
        createParamsFromValues(pendingValues),
      );
      const preparedTx = TransactionBuilder.fromXDR(
        preparedXdr,
        networkPassphrase,
      );
      const currentBalances: CurrentBalance[] = [
        {
          token: previewTokenSymbol,
          symbol: previewTokenSymbol,
          amount: previewEstimatedTotal,
        },
        {
          token: "XLM",
          symbol: "XLM",
          amount: 1,
        },
      ];

      return simulateTransaction(preparedTx, currentBalances);
    }, [
      address,
      createParamsFromValues,
      networkPassphrase,
      pendingValues,
      previewEstimatedTotal,
      previewTokenSymbol,
    ]);

  const performStreamCreation = useCallback(
    async (formValues: FormValues) => {
      if (!address) {
        addNotification("Please connect your wallet first.", "warning");
        return;
      }

      if (!PAYROLL_STREAM_CONTRACT_ID) {
        addNotification("PayrollStream contract ID not configured.", "error");
        return;
      }

      try {
        dispatch({ type: "SET_TX_PHASE", phase: { kind: "simulating" } });

        const { preparedXdr } = await buildCreateStreamTx(
          createParamsFromValues(formValues),
        );

        dispatch({ type: "SET_TX_PHASE", phase: { kind: "signing" } });
        const signResult = await signTransaction(preparedXdr, {
          networkPassphrase,
        });
        if (
          !signResult ||
          typeof signResult !== "object" ||
          !("signedTxXdr" in signResult)
        ) {
          throw new Error("Invalid response from signTransaction");
        }
        const { signedTxXdr } = signResult as { signedTxXdr: string };

        dispatch({ type: "SET_TX_PHASE", phase: { kind: "submitting" } });
        const submitFn = submitAndAwaitTx as (xdr: string) => Promise<string>;
        const hash = await submitFn(signedTxXdr);

        dispatch({
          type: "SET_TX_PHASE",
          phase: { kind: "success", hash: String(hash) },
        });
        addNotification("Stream created successfully!", "success");
        onSuccess?.(String(hash));

        setTimeout(() => dispatch({ type: "RESET" }), 3500);
      } catch (err: unknown) {
        let message = "An unknown error occurred.";
        if (typeof err === "string") {
          message = err;
        } else if (err instanceof Error) {
          message = err.message;
        }

        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes("invalidtimerange")) {
          message = "Start date cannot be in the past (InvalidTimeRange).";
        } else if (
          lowerMsg.includes("1006") ||
          lowerMsg.includes("insufficientbalance") ||
          lowerMsg.includes("insufficient balance")
        ) {
          message =
            "Treasury lacks sufficient funds for this stream (InsufficientBalance).";
        } else if (lowerMsg.includes("invalidcliff")) {
          message = "The configured cliff is invalid (InvalidCliff).";
        } else if (
          lowerMsg.includes("invalidamount") ||
          lowerMsg.includes("1005")
        ) {
          message = "The stream amount or rate is invalid (InvalidAmount).";
        } else if (lowerMsg.includes("streamnotfound")) {
          message = "The specified stream could not be found (StreamNotFound).";
        } else if (
          lowerMsg.includes("invalidaddress") ||
          lowerMsg.includes("1010")
        ) {
          message = "The provided address is invalid (InvalidAddress).";
        } else {
          const appError = translateError(err);
          message = appError.actionableStep
            ? `${appError.message} ${appError.actionableStep}`
            : appError.message;
        }

        dispatch({ type: "SET_TX_PHASE", phase: { kind: "error", message } });
        addNotification(`Stream failed: ${message}`, "error");
      }
    },
    [
      address,
      addNotification,
      createParamsFromValues,
      networkPassphrase,
      onSuccess,
      signTransaction,
    ],
  );

  const openSimulation = useCallback((formValues: FormValues) => {
    setPendingValues(formValues);
    setIsPreviewOpen(true);
  }, []);

  const closeSimulation = useCallback(() => {
    setIsPreviewOpen(false);
    setPendingValues(null);
  }, []);

  const confirmSimulation = useCallback(() => {
    if (!pendingValues) return;
    const snapshot = pendingValues;
    closeSimulation();
    void performStreamCreation(snapshot);
  }, [closeSimulation, pendingValues, performStreamCreation]);

  // ── Solvency check ─────────────────────────────────────────────────────────
  const runSolvencyCheck = useCallback(
    async (totalAmount: number, tokenValue: string) => {
      if (totalAmount <= 0 || !tokenValue) {
        dispatch({ type: "SET_SOLVENCY", solvency: { kind: "idle" } });
        return;
      }

      dispatch({ type: "SET_SOLVENCY", solvency: { kind: "checking" } });

      try {
        const tokenDef = SUPPORTED_TOKENS.find((t) => t.value === tokenValue);
        const decimals = tokenDef?.decimal ?? 7;
        const stroops = toStroops(totalAmount, decimals);

        const tokenContractId =
          tokenValue === "native" ? "" : (tokenValue.split(":")[1] ?? "");

        const solvencyFn = checkTreasurySolvency as (
          vaultId: string,
          tokenId: string,
          amount: bigint,
        ) => Promise<boolean>;
        const result = await solvencyFn(
          PAYROLL_VAULT_CONTRACT_ID,
          tokenContractId,
          stroops,
        );
        const ok = typeof result === "boolean" ? result : !!result;

        dispatch({
          type: "SET_SOLVENCY",
          solvency: ok ? { kind: "ok" } : { kind: "insufficient" },
        });
      } catch (err: unknown) {
        let message = "An unknown error occurred.";
        if (typeof err === "string") {
          message = err;
        } else if (err instanceof Error) {
          message = err.message;
        }
        console.error("Solvency check failed:", message);
        dispatch({ type: "SET_SOLVENCY", solvency: { kind: "error" } });
      }
    },
    [],
  );

  useEffect(() => {
    if (solvencyTimer.current) clearTimeout(solvencyTimer.current);
    solvencyTimer.current = setTimeout(() => {
      void runSolvencyCheck(estimatedTotal, values.token);
    }, 600);

    return () => {
      if (solvencyTimer.current) clearTimeout(solvencyTimer.current);
    };
  }, [estimatedTotal, values.token, runSolvencyCheck]);

  // ── Field change handler ────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    dispatch({
      type: "SET_FIELD",
      field: e.target.name as keyof FormValues,
      value: e.target.value,
    });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formErrors = validate(values);
    if (Object.keys(formErrors).length > 0) {
      dispatch({ type: "SET_ERRORS", errors: formErrors });
      return;
    }

    if (!address) {
      addNotification("Please connect your wallet first.", "warning");
      return;
    }

    if (!PAYROLL_STREAM_CONTRACT_ID) {
      addNotification("PayrollStream contract ID not configured.", "error");
      return;
    }

    if (solvency.kind === "insufficient") {
      addNotification("Treasury lacks funds for this stream total.", "warning");
    }
    openSimulation(values);
  };

  const isBusy =
    txPhase.kind === "simulating" ||
    txPhase.kind === "signing" ||
    txPhase.kind === "submitting" ||
    isPreviewOpen;

  const isCurrentFormValid = Object.keys(validate(values)).length === 0;

  if (!address) {
    return (
      <div className={tw.wrapper}>
        <div className={tw.card}>
          <div className={tw.walletNotice}>
            <span className={tw.walletNoticeIcon}>💼</span>
            <p>Connect your wallet to create a payroll stream.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={tw.wrapper}>
      <div className={tw.card}>
        <div className={tw.header}>
          <h2 className={tw.title}>Create Payroll Stream</h2>
          <p className={tw.subtitle}>Continuous payment flow for workers.</p>
        </div>

        <form
          id={id("form")}
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className={tw.form}
        >
          <div className={tw.fieldGroup}>
            <label htmlFor={id("workerAddress")} className={tw.label}>
              Worker Address <span className={tw.required}>*</span>
            </label>
            <input
              id={id("workerAddress")}
              name="workerAddress"
              type="text"
              className={`${tw.input} ${errors.workerAddress ? tw.inputError : ""}`}
              placeholder="G..."
              value={values.workerAddress}
              onChange={handleChange}
              disabled={isBusy}
              spellCheck={false}
              aria-describedby={
                errors.workerAddress ? id("workerAddress-error") : undefined
              }
              aria-invalid={!!errors.workerAddress}
            />
            <div aria-live="assertive">
              <ErrorMessage error={errors.workerAddress || null} />
            </div>
          </div>

          {/* ... existing token field ... */}

          <div className={tw.fieldGroup}>
            <label htmlFor={id("rate")} className={tw.label}>
              Flow Rate ({tokenSymbol}/sec){" "}
              <span className={tw.required}>*</span>
            </label>
            <input
              id={id("rate")}
              name="rate"
              type="number"
              step="any"
              className={`${tw.input} ${errors.rate ? tw.inputError : ""}`}
              placeholder="e.g. 0.0001"
              value={values.rate}
              onChange={handleChange}
              disabled={isBusy}
              aria-describedby={errors.rate ? id("rate-error") : undefined}
              aria-invalid={!!errors.rate}
            />
            <div aria-live="assertive">
              <ErrorMessage error={errors.rate || null} />
            </div>
          </div>

          <div className={tw.fieldRow}>
            <div className={tw.fieldGroup}>
              <label htmlFor={id("startDate")} className={tw.label}>
                Start Date
              </label>
              <input
                id={id("startDate")}
                name="startDate"
                type="date"
                min={todayStr()}
                className={tw.input}
                value={values.startDate}
                onChange={handleChange}
                disabled={isBusy}
              />
            </div>
            <div className={tw.fieldGroup}>
              <label htmlFor={id("endDate")} className={tw.label}>
                End Date
              </label>
              <input
                id={id("endDate")}
                name="endDate"
                type="date"
                min={values.startDate || todayStr()}
                className={tw.input}
                value={values.endDate}
                onChange={handleChange}
                disabled={isBusy}
              />
            </div>
          </div>

          {estimatedTotal > 0 && (
            <div
              style={{
                padding: "12px",
                background: "rgba(var(--text-rgb), 0.03)",
                borderRadius: "8px",
                border: "1px dashed var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--muted)",
                  }}
                >
                  Estimated Total Commitment:
                </span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>
                  {estimatedTotal.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  {tokenSymbol}
                </span>
              </div>
              <SolvencyBanner status={solvency} />
            </div>
          )}

          {txPhase.kind !== "idle" && (
            <TransactionProgress
              steps={["Simulating", "Signing", "Submitting"]}
              currentStep={
                txPhase.kind === "simulating"
                  ? 0
                  : txPhase.kind === "signing"
                    ? 1
                    : txPhase.kind === "submitting"
                      ? 2
                      : txPhase.kind === "success"
                        ? 3
                        : txPhase.kind === "error"
                          ? 2
                          : 0
              }
              status={
                txPhase.kind === "success"
                  ? "success"
                  : txPhase.kind === "error"
                    ? "error"
                    : "loading"
              }
              errorMessage={
                txPhase.kind === "error" ? txPhase.message : undefined
              }
              timeoutMs={30_000}
            />
          )}

          <div className={tw.footer}>
            {onCancel && (
              <Button
                variant="secondary"
                size="md"
                type="button"
                disabled={isBusy}
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={
                isBusy || txPhase.kind === "success" || !isCurrentFormValid
              }
            >
              {isBusy ? <span className={tw.spinner} /> : "Create Stream"}
            </Button>
          </div>
        </form>
      </div>

      <TransactionSimulationModal
        open={isPreviewOpen}
        preview={
          simulationPreview ?? {
            description: "Create payroll stream",
            contractFunction: "create_stream",
            contractAddress: shortenContractId(
              PAYROLL_STREAM_CONTRACT_ID ?? "",
            ),
            currentBalances: [],
          }
        }
        onSimulate={runCreateSimulation}
        onConfirm={() => {
          void confirmSimulation();
        }}
        onCancel={closeSimulation}
      />
    </div>
  );
};

function SolvencyBanner({ status }: { status: SolvencyStatus }) {
  if (status.kind === "idle") return null;
  if (status.kind === "checking")
    return (
      <p style={{ fontSize: "0.75rem", margin: 0, color: "var(--muted)" }}>
        Checking treasury solvency...
      </p>
    );
  if (status.kind === "ok")
    return (
      <p style={{ fontSize: "0.75rem", margin: 0, color: "#10b981" }}>
        ✅ Treasury funds confirmed
      </p>
    );
  if (status.kind === "insufficient")
    return (
      <p
        style={{
          fontSize: "0.75rem",
          margin: 0,
          color: "var(--sds-color-feedback-error, #ef4444)",
        }}
      >
        ⚠️ Treasury may be insufficient
      </p>
    );
  return null;
}

export default StreamCreator;
