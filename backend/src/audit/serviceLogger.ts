import { getAuditLogger, isAuditLoggerInitialized } from "./init";
import { LogContext } from "./types";

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
    if (!isAuditLoggerInitialized()) {
      console.log(formatFallbackMessage(service, message), context);
      return;
    }

    await getAuditLogger().info(message, {
      action_type: "system",
      service,
      ...context,
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
    if (!isAuditLoggerInitialized()) {
      console.warn(formatFallbackMessage(service, message), context);
      return;
    }

    await getAuditLogger().warn(message, {
      action_type: "system",
      service,
      ...context,
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
    if (!isAuditLoggerInitialized()) {
      console.error(formatFallbackMessage(service, message), normalizedError);
      return;
    }

    await getAuditLogger().error(message, normalizedError, {
      action_type: "system",
      service,
      ...context,
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
