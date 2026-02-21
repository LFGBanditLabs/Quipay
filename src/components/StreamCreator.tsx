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
} from "react";
import { Button } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useNotification } from "../hooks/useNotification";
import {
  buildCreateStreamTx,
  checkTreasurySolvency,
  submitAndAwaitTx,
  PAYROLL_STREAM_CONTRACT_ID,
  type CreateStreamParams,
} from "../contracts/payroll_stream";
import styles from "./StreamCreator.module.css";

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

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const now = Date.now();

  if (!values.workerAddress.trim()) {
    errors.workerAddress = "Worker address is required.";
  } else if (!isValidStellarAddress(values.workerAddress.trim())) {
    errors.workerAddress =
      "Must be a valid Stellar public key (starts with G, 56 characters).";
  }

  if (!values.token) {
    errors.token = "Please select a token.";
  }

  const parsedRate = parseFloat(values.rate);
  if (!values.rate.trim()) {
    errors.rate = "Rate is required.";
  } else if (isNaN(parsedRate) || parsedRate <= 0) {
    errors.rate = "Rate must be a positive number.";
  }

  if (!values.startDate) {
    errors.startDate = "Start date is required.";
  }

  if (!values.endDate) {
    errors.endDate = "End date is required.";
  } else if (
    values.startDate &&
    new Date(values.endDate) <= new Date(values.startDate)
  ) {
    errors.endDate = "End date must be after the start date.";
  }

  if (
    values.startDate &&
    new Date(values.startDate).getTime() < now - 60_000 /* 1-min grace */
  ) {
    errors.startDate = "Start date cannot be in the past.";
  }

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

/** Truncates a hash for display. */
function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StreamCreatorProps {
  onSuccess?: (txHash: string) => void;
  onCancel?: () => void;
}

const StreamCreator: React.FC<StreamCreatorProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { address, signTransaction, networkPassphrase } = useWallet();
  const { addNotification } = useNotification();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { values, errors, txPhase, solvency } = state;

  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;

  const solvencyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Calculated metrics ─────────────────────────────────────────────────────

  const estimatedTotal = useMemo(() => {
    if (!values.rate || !values.startDate || !values.endDate) return 0;
    const start = new Date(values.startDate).getTime();
    const end = new Date(values.endDate).getTime();
    const durationSeconds = Math.max(0, (end - start) / 1000);
    return parseFloat(values.rate) * durationSeconds;
  }, [values.rate, values.startDate, values.endDate]);

  const tokenSymbol = useMemo(() => {
    const t = SUPPORTED_TOKENS.find((t) => t.value === values.token);
    return t ? t.label.split(" ")[0] : "Tokens";
  }, [values.token]);

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

        const ok = await checkTreasurySolvency(
          PAYROLL_VAULT_CONTRACT_ID,
          tokenContractId,
          stroops,
        );

        dispatch({
          type: "SET_SOLVENCY",
          solvency: ok ? { kind: "ok" } : { kind: "insufficient" },
        });
      } catch {
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

    if (!PAYROLL_STREAM_CONTRACT_ID) {
      addNotification("PayrollStream contract ID not configured.", "error");
      return;
    }

    if (solvency.kind === "insufficient") {
      addNotification("Treasury lacks funds for this stream total.", "warning");
    }

    try {
      dispatch({ type: "SET_TX_PHASE", phase: { kind: "simulating" } });

      const tokenDef = SUPPORTED_TOKENS.find((t) => t.value === values.token);
      const decimals = tokenDef?.decimal ?? 7;

      const rateStroops = toStroops(values.rate, decimals);
      const amountStroops = toStroops(estimatedTotal, decimals);
      const startTs = Math.floor(new Date(values.startDate).getTime() / 1000);
      const endTs = Math.floor(new Date(values.endDate).getTime() / 1000);

      const params: CreateStreamParams = {
        employer: address,
        worker: values.workerAddress.trim(),
        token: values.token === "native" ? "" : values.token,
        rate: rateStroops,
        amount: amountStroops,
        startTs,
        endTs,
      };

      const { preparedXdr } = await buildCreateStreamTx(params);

      dispatch({ type: "SET_TX_PHASE", phase: { kind: "signing" } });
      const { signedTxXdr } = await signTransaction(preparedXdr, {
        networkPassphrase,
      });

      dispatch({ type: "SET_TX_PHASE", phase: { kind: "submitting" } });
      const hash = await submitAndAwaitTx(signedTxXdr);

      dispatch({ type: "SET_TX_PHASE", phase: { kind: "success", hash } });
      addNotification("Stream created successfully!", "success");
      onSuccess?.(hash);

      setTimeout(() => dispatch({ type: "RESET" }), 3500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred.";
      dispatch({ type: "SET_TX_PHASE", phase: { kind: "error", message } });
      addNotification(`Stream failed: ${message}`, "error");
    }
  };

  const isBusy =
    txPhase.kind === "simulating" ||
    txPhase.kind === "signing" ||
    txPhase.kind === "submitting";

  if (!address) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <div className={styles.walletNotice}>
            <span className={styles.walletNoticeIcon}>💼</span>
            <p>Connect your wallet to create a payroll stream.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create Payroll Stream</h2>
          <p className={styles.subtitle}>
            Continuous payment flow for workers.
          </p>
        </div>

        <form
          id={id("form")}
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className={styles.form}
        >
          <div className={styles.fieldGroup}>
            <label htmlFor={id("workerAddress")} className={styles.label}>
              Worker Address <span className={styles.required}>*</span>
            </label>
            <input
              id={id("workerAddress")}
              name="workerAddress"
              type="text"
              className={`${styles.input} ${errors.workerAddress ? styles.inputError : ""}`}
              placeholder="G..."
              value={values.workerAddress}
              onChange={handleChange}
              disabled={isBusy}
              spellCheck={false}
            />
            {errors.workerAddress && (
              <p className={styles.errorText}>⚠ {errors.workerAddress}</p>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor={id("token")} className={styles.label}>
              Token <span className={styles.required}>*</span>
            </label>
            <div className={styles.selectWrapper}>
              <select
                id={id("token")}
                name="token"
                className={styles.select}
                value={values.token}
                onChange={handleChange}
                disabled={isBusy}
              >
                {SUPPORTED_TOKENS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor={id("rate")} className={styles.label}>
              Flow Rate ({tokenSymbol}/sec){" "}
              <span className={styles.required}>*</span>
            </label>
            <input
              id={id("rate")}
              name="rate"
              type="number"
              step="any"
              className={`${styles.input} ${errors.rate ? styles.inputError : ""}`}
              placeholder="e.g. 0.0001"
              value={values.rate}
              onChange={handleChange}
              disabled={isBusy}
            />
            {errors.rate && (
              <p className={styles.errorText}>⚠ {errors.rate}</p>
            )}
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor={id("startDate")} className={styles.label}>
                Start Date
              </label>
              <input
                id={id("startDate")}
                name="startDate"
                type="date"
                min={todayStr()}
                className={styles.input}
                value={values.startDate}
                onChange={handleChange}
                disabled={isBusy}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor={id("endDate")} className={styles.label}>
                End Date
              </label>
              <input
                id={id("endDate")}
                name="endDate"
                type="date"
                min={values.startDate || todayStr()}
                className={styles.input}
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
                background: "rgba(0,0,0,0.02)",
                borderRadius: "8px",
                border: "1px dashed var(--sds-color-neutral-border)",
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
                    color: "var(--sds-color-content-secondary)",
                  }}
                >
                  Estimated Total Commitment:
                </span>
                <span style={{ fontWeight: 600 }}>
                  {estimatedTotal.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  {tokenSymbol}
                </span>
              </div>
              <SolvencyBanner status={solvency} />
            </div>
          )}

          <TxStatusBox phase={txPhase} />

          <div className={styles.footer}>
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
              disabled={isBusy || txPhase.kind === "success"}
            >
              {isBusy ? <span className={styles.spinner} /> : "Create Stream"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

function SolvencyBanner({ status }: { status: SolvencyStatus }) {
  if (status.kind === "idle") return null;
  if (status.kind === "checking")
    return (
      <p style={{ fontSize: "0.75rem", margin: 0 }}>
        Checking treasury solvency...
      </p>
    );
  if (status.kind === "ok")
    return (
      <p style={{ fontSize: "0.75rem", margin: 0, color: "green" }}>
        ✅ Treasury funds confirmed
      </p>
    );
  if (status.kind === "insufficient")
    return (
      <p style={{ fontSize: "0.75rem", margin: 0, color: "red" }}>
        ⚠️ Treasury may be insufficient
      </p>
    );
  return null;
}

function TxStatusBox({ phase }: { phase: TxPhase }) {
  if (phase.kind === "idle") return null;
  if (phase.kind === "success")
    return (
      <div className={`${styles.statusBox} ${styles.statusSuccess}`}>
        Success! Hash: {shortHash(phase.hash)}
      </div>
    );
  if (phase.kind === "error")
    return (
      <div className={`${styles.statusBox} ${styles.statusError}`}>
        {phase.message}
      </div>
    );
  return (
    <div className={`${styles.statusBox} ${styles.statusLoading}`}>
      Processing...
    </div>
  );
}

export default StreamCreator;
