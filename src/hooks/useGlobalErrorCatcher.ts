/**
 * useGlobalErrorCatcher.ts
 * ────────────────────────
 * Ensures ZERO silent failures by catching all unhandled errors
 * and unhandled promise rejections at the window level and
 * surfacing them in the notification center.
 */

import { useEffect } from "react";
import { alertStore } from "../components/NotificationCenter";
import { translateError, ErrorType } from "../util/errors";

export function useGlobalErrorCatcher() {
  useEffect(() => {
    /** Catch unhandled synchronous errors */
    const handleError = (event: ErrorEvent) => {
      // Ignore ResizeObserver loop errors (browser noise)
      if (event.message?.includes("ResizeObserver")) return;

      const appError = translateError(event.error ?? event.message);

      alertStore.addAlert({
        title: appError.message,
        message:
          appError.actionableStep ??
          "An unexpected error occurred. Check the console for details.",
        severity: appError.severity === "warning" ? "warning" : "critical",
        category:
          appError.type === ErrorType.NETWORK
            ? "network"
            : appError.type === ErrorType.WALLET
              ? "wallet"
              : "system",
        autoDismissMs: 15_000,
      });

      console.error("[GlobalErrorCatcher] Unhandled error:", event.error);
    };

    /** Catch unhandled promise rejections */
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;

      // Skip user-cancelled wallet prompts (intentional, not a bug)
      if (
        reason instanceof Error &&
        (reason.message.toLowerCase().includes("user rejected") ||
          reason.message.toLowerCase().includes("cancelled"))
      ) {
        return;
      }

      const appError = translateError(reason);

      alertStore.addAlert({
        title: appError.message,
        message:
          appError.actionableStep ??
          "An async operation failed. Check the console for details.",
        severity: appError.severity === "warning" ? "warning" : "critical",
        category:
          appError.type === ErrorType.NETWORK
            ? "network"
            : appError.type === ErrorType.WALLET
              ? "wallet"
              : "system",
        autoDismissMs: 15_000,
      });

      console.error("[GlobalErrorCatcher] Unhandled rejection:", reason);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);
}
