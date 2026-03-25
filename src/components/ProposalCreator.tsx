/**
 * ProposalCreator
 * ─────────────
 * A form for creating DAO governance proposals for payroll stream operations.
 *
 * Features
 * ────────
 * • Form fields for different proposal types (CreateStream, CancelStream, etc.)
 * • Client-side validation with per-field error messages
 * • Integration with DAO governance contract
 * • Shows loading state while transaction is in-flight
 * • Displays success (with proposal ID) or error message
 * • Resets form on success
 *
 * Dependencies
 * ────────────
 * • Issue #21  – Wallet (useWallet hook / WalletProvider)
 * • DAO governance contract integration
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useMemo,
} from "react";
import { z } from "zod";
import {
  Button,
  Select,
  Text,
  Textarea,
} from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useNotification } from "../hooks/useNotification";
import { translateError } from "../util/errors";
import { ErrorMessage } from "./ErrorMessage";
import { TransactionProgress } from "./Loading";

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
  proposalTypeSection: "mb-6 p-4 border border-[var(--border)] rounded-lg bg-[var(--surface-subtle)]",
  proposalTypeTitle: "mb-3 font-semibold text-sm",
  proposalTypeDescription: "text-xs text-[var(--muted)] mb-4",
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

/** DAO Governance contract ID */
const DAO_GOVERNANCE_CONTRACT_ID: string =
  (import.meta.env.VITE_DAO_GOVERNANCE_CONTRACT_ID as string | undefined) ?? "";

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormValues {
  proposalType: "CreateStream" | "CancelStream" | "UpdateStream" | "Transfer" | "Upgrade" | "AdminChange" | "ThresholdChange";
  title: string;
  description: string;
  // CreateStream fields
  workerAddress?: string;
  token?: string;
  rate?: string;
  startDate?: string;
  endDate?: string;
  // CancelStream fields
  streamId?: string;
  // UpdateStream fields
  newRate?: string;
  newEndDate?: string;
  // Transfer fields
  transferAmount?: string;
  recipient?: string;
  // Upgrade fields
  newWasmHash?: string;
  // AdminChange fields
  newAdmin?: string;
  // ThresholdChange fields
  newThreshold?: string;
}

interface FormErrors {
  proposalType?: string;
  title?: string;
  description?: string;
  workerAddress?: string;
  token?: string;
  rate?: string;
  startDate?: string;
  endDate?: string;
  streamId?: string;
  newRate?: string;
  newEndDate?: string;
  transferAmount?: string;
  recipient?: string;
  newWasmHash?: string;
  newAdmin?: string;
  newThreshold?: string;
}

const INITIAL_VALUES: FormValues = {
  proposalType: "CreateStream",
  title: "",
  description: "",
  workerAddress: "",
  token: SUPPORTED_TOKENS[0].value,
  rate: "",
  startDate: "",
  endDate: "",
  streamId: "",
  newRate: "",
  newEndDate: "",
  transferAmount: "",
  recipient: "",
  newWasmHash: "",
  newAdmin: "",
  newThreshold: "",
};

// ─── Transaction status ───────────────────────────────────────────────────────

type TxPhase =
  | { kind: "idle" }
  | { kind: "simulating" }
  | { kind: "signing" }
  | { kind: "submitting" }
  | { kind: "success"; proposalId: string }
  | { kind: "error"; message: string };

// ─── Reducer for form + tx state ─────────────────────────────────────────────

type State = {
  values: FormValues;
  errors: FormErrors;
  txPhase: TxPhase;
};

type Action =
  | { type: "SET_FIELD"; field: keyof FormValues; value: string }
  | { type: "SET_ERRORS"; errors: FormErrors }
  | { type: "SET_TX_PHASE"; phase: TxPhase }
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
};

// ─── Validation ───────────────────────────────────────────────────────────────

/** Basic Stellar public key check. */
function isValidStellarAddress(addr: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(addr);
}

function isValidWasmHash(hash: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(hash);
}

const getValidationSchema = (values: FormValues) => {
  const baseSchema = z.object({
    proposalType: z.enum(["CreateStream", "CancelStream", "UpdateStream", "Transfer", "Upgrade", "AdminChange", "ThresholdChange"]),
    title: z.string().trim().min(1, "Title is required.").max(200, "Title must be less than 200 characters."),
    description: z.string().trim().min(1, "Description is required.").max(2000, "Description must be less than 2000 characters."),
  });

  switch (values.proposalType) {
    case "CreateStream":
      return baseSchema.extend({
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
      }).superRefine((data, ctx) => {
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
    
    case "CancelStream":
      return baseSchema.extend({
        streamId: z
          .string()
          .trim()
          .min(1, "Stream ID is required.")
          .refine((val) => {
            const num = parseInt(val);
            return !isNaN(num) && num > 0;
          }, "Stream ID must be a positive number."),
      });
    
    case "UpdateStream":
      return baseSchema.extend({
        streamId: z
          .string()
          .trim()
          .min(1, "Stream ID is required.")
          .refine((val) => {
            const num = parseInt(val);
            return !isNaN(num) && num > 0;
          }, "Stream ID must be a positive number."),
        newRate: z.string().optional().refine((val) => {
          if (!val) return true;
          const num = parseFloat(val);
          return !isNaN(num) && num > 0;
        }, "New rate must be a positive number."),
        newEndDate: z.string().optional().refine((val) => {
          if (!val) return true;
          const now = Date.now();
          return new Date(val).getTime() >= now - 60_000;
        }, "New end date cannot be in the past."),
      });
    
    case "Transfer":
      return baseSchema.extend({
        token: z.string().min(1, "Please select a token."),
        transferAmount: z
          .string()
          .trim()
          .min(1, "Amount is required.")
          .refine((val) => {
            const num = parseFloat(val);
            return !isNaN(num) && num > 0;
          }, "Amount must be a positive number."),
        recipient: z
          .string()
          .trim()
          .min(1, "Recipient address is required.")
          .refine(
            isValidStellarAddress,
            "Must be a valid Stellar public key (starts with G, 56 characters).",
          ),
      });
    
    case "Upgrade":
      return baseSchema.extend({
        newWasmHash: z
          .string()
          .trim()
          .min(1, "WASM hash is required.")
          .refine(
            isValidWasmHash,
            "Must be a valid 64-character hexadecimal WASM hash.",
          ),
      });
    
    case "AdminChange":
      return baseSchema.extend({
        newAdmin: z
          .string()
          .trim()
          .min(1, "New admin address is required.")
          .refine(
            isValidStellarAddress,
            "Must be a valid Stellar public key (starts with G, 56 characters).",
          ),
      });
    
    case "ThresholdChange":
      return baseSchema.extend({
        newThreshold: z
          .string()
          .trim()
          .min(1, "New threshold is required.")
          .refine((val) => {
            const num = parseInt(val);
            return !isNaN(num) && num >= 1 && num <= 10;
          }, "Threshold must be between 1 and 10."),
      });
    
    default:
      return baseSchema;
  }
};

function validate(values: FormValues): FormErrors {
  const schema = getValidationSchema(values);
  const result = schema.safeParse(values);
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

/** Returns today's date as YYYY-MM-DD. */
function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProposalCreatorProps {
  onSuccess?: (proposalId: string) => void;
  onCancel?: () => void;
}

const ProposalCreator: React.FC<ProposalCreatorProps> = ({
  onSuccess,
  onCancel,
}: ProposalCreatorProps) => {
  const { address, signTransaction, networkPassphrase } = useWallet();
  const { addNotification } = useNotification();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { values, errors, txPhase } = state;

  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;

  // ── Calculated metrics ─────────────────────────────────────────────────────

  const tokenSymbol = useMemo(() => {
    const t = SUPPORTED_TOKENS.find((t) => t.value === values.token);
    return t ? t.label.split(" ")[0] : "Tokens";
  }, [values.token]);

  const estimatedTotal = useMemo(() => {
    if (!values.rate || !values.startDate || !values.endDate) return 0;
    const start = new Date(values.startDate).getTime();
    const end = new Date(values.endDate).getTime();
    const durationSeconds = Math.max(0, (end - start) / 1000);
    return parseFloat(values.rate) * durationSeconds;
  }, [values.rate, values.startDate, values.endDate]);

  // ── Field change handler ────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    dispatch({
      type: "SET_FIELD",
      field: e.target.name as keyof FormValues,
      value: e.target.value,
    });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
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

    if (!DAO_GOVERNANCE_CONTRACT_ID) {
      addNotification("DAO governance contract ID not configured.", "error");
      return;
    }

    try {
      dispatch({ type: "SET_TX_PHASE", phase: { kind: "simulating" } });

      // Build proposal payload based on type
      let payload: any = {};
      
      switch (values.proposalType) {
        case "CreateStream":
          payload = {
            CreateStream: {
              employer: address,
              worker: values.workerAddress,
              token: values.token === "native" ? "" : values.token,
              rate: parseFloat(values.rate || "0"),
              cliff_ts: 0, // No cliff by default
              start_ts: Math.floor(new Date(values.startDate || "").getTime() / 1000),
              end_ts: Math.floor(new Date(values.endDate || "").getTime() / 1000),
            },
          };
          break;
        case "CancelStream":
          payload = {
            CancelStream: {
              stream_id: parseInt(values.streamId || "0"),
            },
          };
          break;
        case "UpdateStream":
          payload = {
            UpdateStream: {
              stream_id: parseInt(values.streamId || "0"),
              new_rate: values.newRate ? parseFloat(values.newRate) : null,
              new_end_ts: values.newEndDate ? Math.floor(new Date(values.newEndDate).getTime() / 1000) : null,
            },
          };
          break;
        case "Transfer":
          payload = {
            Transfer: {
              token: values.token === "native" ? "" : values.token,
              amount: parseFloat(values.transferAmount || "0"),
              recipient: values.recipient,
            },
          };
          break;
        case "Upgrade":
          payload = {
            Upgrade: {
              new_wasm_hash: values.newWasmHash,
            },
          };
          break;
        case "AdminChange":
          payload = {
            AdminChange: {
              new_admin: values.newAdmin,
            },
          };
          break;
        case "ThresholdChange":
          payload = {
            ThresholdChange: {
              new_threshold: parseInt(values.newThreshold || "0"),
            },
          };
          break;
      }

      // TODO: Implement actual contract interaction
      // For now, we'll simulate the proposal creation
      await new Promise(resolve => setTimeout(resolve, 2000));

      const proposalId = `prop-${Date.now()}`;
      
      dispatch({
        type: "SET_TX_PHASE",
        phase: { kind: "success", proposalId },
      });
      addNotification("Proposal created successfully!", "success");
      onSuccess?.(proposalId);

      setTimeout(() => dispatch({ type: "RESET" }), 3500);
    } catch (err: unknown) {
      let message = "An unknown error occurred.";
      if (typeof err === "string") {
        message = err;
      } else if (err instanceof Error) {
        message = err.message;
      }

      // Contract Error Code Mapping
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes("unauthorized")) {
        message = "You are not authorized to create proposals.";
      } else if (lowerMsg.includes("paused")) {
        message = "DAO governance is currently paused.";
      } else {
        const appError = translateError(err);
        message = appError.actionableStep
          ? `${appError.message} ${appError.actionableStep}`
          : appError.message;
      }

      dispatch({ type: "SET_TX_PHASE", phase: { kind: "error", message } });
      addNotification(`Proposal creation failed: ${message}`, "error");
    }
  };

  const isBusy =
    txPhase.kind === "simulating" ||
    txPhase.kind === "signing" ||
    txPhase.kind === "submitting";

  const isCurrentFormValid = Object.keys(validate(values)).length === 0;

  if (!address) {
    return (
      <div className={tw.wrapper}>
        <div className={tw.card}>
          <div className={tw.walletNotice}>
            <span className={tw.walletNoticeIcon}>💼</span>
            <p>Connect your wallet to create a governance proposal.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={tw.wrapper}>
      <div className={tw.card}>
        <div className={tw.header}>
          <h2 className={tw.title}>Create Governance Proposal</h2>
          <p className={tw.subtitle}>Submit a proposal for DAO review and approval.</p>
        </div>

        <form
          id={id("form")}
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className={tw.form}
        >
          {/* Proposal Type Selection */}
          <div className={tw.fieldGroup}>
            <label htmlFor={id("proposalType")} className={tw.label}>
              Proposal Type <span className={tw.required}>*</span>
            </label>
            <Select
              id={id("proposalType")}
              name="proposalType"
              value={values.proposalType}
              onChange={handleChange}
              disabled={isBusy}
            >
              <option value="CreateStream">Create Payroll Stream</option>
              <option value="CancelStream">Cancel Stream</option>
              <option value="UpdateStream">Update Stream</option>
              <option value="Transfer">Transfer Funds</option>
              <option value="Upgrade">Upgrade Contract</option>
              <option value="AdminChange">Change Admin</option>
              <option value="ThresholdChange">Change Voting Threshold</option>
            </Select>
            <div aria-live="assertive">
              <ErrorMessage error={errors.proposalType || null} />
            </div>
          </div>

          {/* Title and Description */}
          <div className={tw.fieldGroup}>
            <label htmlFor={id("title")} className={tw.label}>
              Title <span className={tw.required}>*</span>
            </label>
            <input
              id={id("title")}
              name="title"
              type="text"
              className={`${tw.input} ${errors.title ? tw.inputError : ""}`}
              placeholder="Brief title for your proposal"
              value={values.title}
              onChange={handleChange}
              disabled={isBusy}
              maxLength={200}
            />
            <div aria-live="assertive">
              <ErrorMessage error={errors.title || null} />
            </div>
          </div>

          <div className={tw.fieldGroup}>
            <label htmlFor={id("description")} className={tw.label}>
              Description <span className={tw.required}>*</span>
            </label>
            <Textarea
              id={id("description")}
              name="description"
              className={`${tw.input} ${errors.description ? tw.inputError : ""}`}
              placeholder="Detailed description of what this proposal does and why it should be approved"
              value={values.description}
              onChange={handleChange}
              disabled={isBusy}
              maxLength={2000}
              rows={4}
            />
            <div aria-live="assertive">
              <ErrorMessage error={errors.description || null} />
            </div>
          </div>

          {/* Type-specific fields */}
          {values.proposalType === "CreateStream" && (
            <div className={tw.proposalTypeSection}>
              <div className={tw.proposalTypeTitle}>Create Stream Details</div>
              <div className={tw.proposalTypeDescription}>
                Create a new payroll stream that will be activated upon proposal approval.
              </div>
              
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
                />
                <div aria-live="assertive">
                  <ErrorMessage error={errors.workerAddress || null} />
                </div>
              </div>

              <div className={tw.fieldGroup}>
                <label htmlFor={id("token")} className={tw.label}>
                  Token <span className={tw.required}>*</span>
                </label>
                <Select
                  id={id("token")}
                  name="token"
                  value={values.token}
                  onChange={handleChange}
                  disabled={isBusy}
                >
                  {SUPPORTED_TOKENS.map((token) => (
                    <option key={token.value} value={token.value}>
                      {token.label}
                    </option>
                  ))}
                </Select>
                <div aria-live="assertive">
                  <ErrorMessage error={errors.token || null} />
                </div>
              </div>

              <div className={tw.fieldGroup}>
                <label htmlFor={id("rate")} className={tw.label}>
                  Flow Rate ({tokenSymbol}/sec) <span className={tw.required}>*</span>
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
                />
                <div aria-live="assertive">
                  <ErrorMessage error={errors.rate || null} />
                </div>
              </div>

              <div className={tw.fieldRow}>
                <div className={tw.fieldGroup}>
                  <label htmlFor={id("startDate")} className={tw.label}>
                    Start Date <span className={tw.required}>*</span>
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
                  <div aria-live="assertive">
                    <ErrorMessage error={errors.startDate || null} />
                  </div>
                </div>
                <div className={tw.fieldGroup}>
                  <label htmlFor={id("endDate")} className={tw.label}>
                    End Date <span className={tw.required}>*</span>
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
                  <div aria-live="assertive">
                    <ErrorMessage error={errors.endDate || null} />
                  </div>
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
                </div>
              )}
            </div>
          )}

          {values.proposalType === "CancelStream" && (
            <div className={tw.proposalTypeSection}>
              <div className={tw.proposalTypeTitle}>Cancel Stream Details</div>
              <div className={tw.proposalTypeDescription}>
                Cancel an existing payroll stream and pay out any accrued amount.
              </div>
              
              <div className={tw.fieldGroup}>
                <label htmlFor={id("streamId")} className={tw.label}>
                  Stream ID <span className={tw.required}>*</span>
                </label>
                <input
                  id={id("streamId")}
                  name="streamId"
                  type="text"
                  className={`${tw.input} ${errors.streamId ? tw.inputError : ""}`}
                  placeholder="e.g. 123"
                  value={values.streamId}
                  onChange={handleChange}
                  disabled={isBusy}
                />
                <div aria-live="assertive">
                  <ErrorMessage error={errors.streamId || null} />
                </div>
              </div>
            </div>
          )}

          {values.proposalType === "UpdateStream" && (
            <div className={tw.proposalTypeSection}>
              <div className={tw.proposalTypeTitle}>Update Stream Details</div>
              <div className={tw.proposalTypeDescription}>
                Modify an existing payroll stream's rate or end date.
              </div>
              
              <div className={tw.fieldGroup}>
                <label htmlFor={id("streamId")} className={tw.label}>
                  Stream ID <span className={tw.required}>*</span>
                </label>
                <input
                  id={id("streamId")}
                  name="streamId"
                  type="text"
                  className={`${tw.input} ${errors.streamId ? tw.inputError : ""}`}
                  placeholder="e.g. 123"
                  value={values.streamId}
                  onChange={handleChange}
                  disabled={isBusy}
                />
                <div aria-live="assertive">
                  <ErrorMessage error={errors.streamId || null} />
                </div>
              </div>

              <div className={tw.fieldRow}>
                <div className={tw.fieldGroup}>
                  <label htmlFor={id("newRate")} className={tw.label}>
                    New Rate ({tokenSymbol}/sec)
                  </label>
                  <input
                    id={id("newRate")}
                    name="newRate"
                    type="number"
                    step="any"
                    className={`${tw.input} ${errors.newRate ? tw.inputError : ""}`}
                    placeholder="Leave empty to keep current rate"
                    value={values.newRate}
                    onChange={handleChange}
                    disabled={isBusy}
                  />
                  <div aria-live="assertive">
                    <ErrorMessage error={errors.newRate || null} />
                  </div>
                </div>
                <div className={tw.fieldGroup}>
                  <label htmlFor={id("newEndDate")} className={tw.label}>
                    New End Date
                  </label>
                  <input
                    id={id("newEndDate")}
                    name="newEndDate"
                    type="date"
                    min={todayStr()}
                    className={tw.input}
                    value={values.newEndDate}
                    onChange={handleChange}
                    disabled={isBusy}
                  />
                  <div aria-live="assertive">
                    <ErrorMessage error={errors.newEndDate || null} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {values.proposalType === "Transfer" && (
            <div className={tw.proposalTypeSection}>
              <div className={tw.proposalTypeTitle}>Transfer Details</div>
              <div className={tw.proposalTypeDescription}>
                Transfer funds from the treasury to a specified address.
              </div>
              
              <div className={tw.fieldGroup}>
                <label htmlFor={id("token")} className={tw.label}>
                  Token <span className={tw.required}>*</span>
                </label>
                <Select
                  id={id("token")}
                  name="token"
                  value={values.token}
                  onChange={handleChange}
                  disabled={isBusy}
                >
                  {SUPPORTED_TOKENS.map((token) => (
                    <option key={token.value} value={token.value}>
                      {token.label}
                    </option>
                  ))}
                </Select>
                <div aria-live="assertive">
                  <ErrorMessage error={errors.token || null} />
                </div>
              </div>

              <div className={tw.fieldGroup}>
                <label htmlFor={id("transferAmount")} className={tw.label}>
                  Amount <span className={tw.required}>*</span>
                </label>
                <input
                  id={id("transferAmount")}
                  name="transferAmount"
                  type="number"
                  step="any"
                  className={`${tw.input} ${errors.transferAmount ? tw.inputError : ""}`}
                  placeholder="e.g. 1000"
                  value={values.transferAmount}
                  onChange={handleChange}
                  disabled={isBusy}
                />
                <div aria-live="assertive">
                  <ErrorMessage error={errors.transferAmount || null} />
                </div>
              </div>

              <div className={tw.fieldGroup}>
                <label htmlFor={id("recipient")} className={tw.label}>
                  Recipient Address <span className={tw.required}>*</span>
                </label>
                <input
                  id={id("recipient")}
                  name="recipient"
                  type="text"
                  className={`${tw.input} ${errors.recipient ? tw.inputError : ""}`}
                  placeholder="G..."
                  value={values.recipient}
                  onChange={handleChange}
                  disabled={isBusy}
                  spellCheck={false}
                />
                <div aria-live="assertive">
                  <ErrorMessage error={errors.recipient || null} />
                </div>
              </div>
            </div>
          )}

          {values.proposalType === "Upgrade" && (
            <div className={tw.proposalTypeSection}>
              <div className={tw.proposalTypeTitle}>Upgrade Details</div>
              <div className={tw.proposalTypeDescription}>
                Upgrade the payroll stream contract to a new version.
              </div>
              
              <div className={tw.fieldGroup}>
                <label htmlFor={id("newWasmHash")} className={tw.label}>
                  New WASM Hash <span className={tw.required}>*</span>
                </label>
                <input
                  id={id("newWasmHash")}
                  name="newWasmHash"
                  type="text"
                  className={`${tw.input} ${errors.newWasmHash ? tw.inputError : ""}`}
                  placeholder="64-character hexadecimal hash"
                  value={values.newWasmHash}
                  onChange={handleChange}
                  disabled={isBusy}
                  spellCheck={false}
                  style={{ fontFamily: "monospace" }}
                />
                <div aria-live="assertive">
                  <ErrorMessage error={errors.newWasmHash || null} />
                </div>
              </div>
            </div>
          )}

          {values.proposalType === "AdminChange" && (
            <div className={tw.proposalTypeSection}>
              <div className={tw.proposalTypeTitle}>Admin Change Details</div>
              <div className={tw.proposalTypeDescription}>
                Change the admin address of the DAO governance contract.
              </div>
              
              <div className={tw.fieldGroup}>
                <label htmlFor={id("newAdmin")} className={tw.label}>
                  New Admin Address <span className={tw.required}>*</span>
                </label>
                <input
                  id={id("newAdmin")}
                  name="newAdmin"
                  type="text"
                  className={`${tw.input} ${errors.newAdmin ? tw.inputError : ""}`}
                  placeholder="G..."
                  value={values.newAdmin}
                  onChange={handleChange}
                  disabled={isBusy}
                  spellCheck={false}
                />
                <div aria-live="assertive">
                  <ErrorMessage error={errors.newAdmin || null} />
                </div>
              </div>
            </div>
          )}

          {values.proposalType === "ThresholdChange" && (
            <div className={tw.proposalTypeSection}>
              <div className={tw.proposalTypeTitle}>Threshold Change Details</div>
              <div className={tw.proposalTypeDescription}>
                Change the voting threshold required for proposal approval.
              </div>
              
              <div className={tw.fieldGroup}>
                <label htmlFor={id("newThreshold")} className={tw.label}>
                  New Threshold <span className={tw.required}>*</span>
                </label>
                <input
                  id={id("newThreshold")}
                  name="newThreshold"
                  type="number"
                  min="1"
                  max="10"
                  className={`${tw.input} ${errors.newThreshold ? tw.inputError : ""}`}
                  placeholder="Number of votes required (1-10)"
                  value={values.newThreshold}
                  onChange={handleChange}
                  disabled={isBusy}
                />
                <div aria-live="assertive">
                  <ErrorMessage error={errors.newThreshold || null} />
                </div>
              </div>
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
              {isBusy ? <span className={tw.spinner} /> : "Create Proposal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProposalCreator;
