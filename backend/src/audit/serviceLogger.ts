import { getAuditLogger, isAuditLoggerInitialized } from "./init";
import { LogContext } from "./types";
import { requestContext } from "../middleware/requestId";

function enrichContext(context: LogContext = {}): LogContext {
  const store = requestContext.getStore();
  if (!store) return context;

  const enriched: LogContext = { ...context };

  if (store.requestId) enriched.request_id = store.requestId;
  if (store.correlationId) enriched.correlation_id = store.correlationId;
  if (store.walletAddress) enriched.wallet_address = store.walletAddress;
  if (store.method) enriched.method = store.method;
  if (store.path) enriched.path = store.path;

  return enriched;
}

function formatFallbackMessage(service: string, message: string): string {
  return `[${service}] ${message}`;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown error");
}

export async function logServiceInfo(
  service: string,
  message: string,
  context: LogContext = {},
): Promise<void> {
  try {
    const enrichedContext = enrichContext(context);
    if (!isAuditLoggerInitialized()) {
      console.log(formatFallbackMessage(service, message), enrichedContext);
      return;
    }

    await getAuditLogger().info(message, {
      action_type: "system",
      service,
      ...enrichedContext,
    });
  } catch (error) {
    console.error(formatFallbackMessage(service, message), error);
  }
}

export async function logServiceWarn(
  service: string,
  message: string,
  context: LogContext = {},
): Promise<void> {
  try {
    const enrichedContext = enrichContext(context);
    if (!isAuditLoggerInitialized()) {
      console.warn(formatFallbackMessage(service, message), enrichedContext);
      return;
    }

    await getAuditLogger().warn(message, {
      action_type: "system",
      service,
      ...enrichedContext,
    });
  } catch (error) {
    console.error(formatFallbackMessage(service, message), error);
  }
}

export async function logServiceError(
  service: string,
  message: string,
  error: unknown,
  context: LogContext = {},
): Promise<void> {
  const normalizedError = normalizeError(error);

  try {
    const enrichedContext = enrichContext(context);
    if (!isAuditLoggerInitialized()) {
      console.error(
        formatFallbackMessage(service, message),
        normalizedError,
        enrichedContext,
      );
      return;
    }

    await getAuditLogger().error(message, normalizedError, {
      action_type: "system",
      service,
      ...enrichedContext,
    });
  } catch (logError) {
    console.error(formatFallbackMessage(service, message), normalizedError);
    console.error(
      formatFallbackMessage(service, "Failed to write to audit logger"),
      logError,
    );
  }
}

export const serviceLogger = {
  info: logServiceInfo,
  warn: logServiceWarn,
  error: logServiceError,
};
