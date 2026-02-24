/**
 * Audit Logging Middleware
 *
 * Express middleware for automatic logging of contract interactions and API requests.
 */

import { Request, Response, NextFunction } from "express";
import { AuditLogger } from "./auditLogger";

/**
 * Extract contract interaction context from request
 */
function extractContractContext(req: Request): {
  contractAddress?: string;
  functionName?: string;
  parameters?: Record<string, unknown>;
  employer?: string;
} {
  const body = req.body || {};

  return {
    contractAddress:
      body.contractAddress || body.contract_address || body.contract,
    functionName:
      body.functionName || body.function_name || body.function || body.method,
    parameters: body.parameters || body.params || body.args || {},
    employer:
      body.employer ||
      body.employerId ||
      (req.headers["x-employer-id"] as string),
  };
}

/**
 * Create logging middleware for Express
 */
export function createLoggingMiddleware(auditLogger: AuditLogger) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const context = extractContractContext(req);

    // Only log if this looks like a contract interaction
    const isContractInteraction =
      context.contractAddress || context.functionName;

    if (isContractInteraction) {
      // Log request initiation
      await auditLogger.info("Contract interaction initiated", {
        action_type: "contract_interaction",
        contract_address: context.contractAddress,
        function_name: context.functionName,
        parameters: context.parameters,
      });
    }

    // Capture the original send function
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);

    // Override send to capture response
    res.send = function (data: any) {
      const duration = Date.now() - startTime;

      if (isContractInteraction) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          auditLogger
            .logContractInteraction({
              contractAddress: context.contractAddress || "unknown",
              functionName: context.functionName || "unknown",
              parameters: context.parameters || {},
              employer: context.employer,
              success: true,
              durationMs: duration,
            })
            .catch((err) => {
              console.error(
                "[AuditLogger] Failed to log successful interaction:",
                err,
              );
            });
        } else {
          auditLogger
            .logContractInteraction({
              contractAddress: context.contractAddress || "unknown",
              functionName: context.functionName || "unknown",
              parameters: context.parameters || {},
              employer: context.employer,
              success: false,
              durationMs: duration,
              error: new Error(`Request failed with status ${res.statusCode}`),
            })
            .catch((err) => {
              console.error(
                "[AuditLogger] Failed to log failed interaction:",
                err,
              );
            });
        }
      }

      return originalSend(data);
    };

    // Override json to capture response
    res.json = function (data: any) {
      const duration = Date.now() - startTime;

      if (isContractInteraction) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          auditLogger
            .logContractInteraction({
              contractAddress: context.contractAddress || "unknown",
              functionName: context.functionName || "unknown",
              parameters: context.parameters || {},
              employer: context.employer,
              transactionHash:
                data?.transactionHash || data?.txHash || data?.hash,
              blockNumber: data?.blockNumber || data?.ledger,
              success: true,
              durationMs: duration,
            })
            .catch((err) => {
              console.error(
                "[AuditLogger] Failed to log successful interaction:",
                err,
              );
            });
        } else {
          auditLogger
            .logContractInteraction({
              contractAddress: context.contractAddress || "unknown",
              functionName: context.functionName || "unknown",
              parameters: context.parameters || {},
              employer: context.employer,
              success: false,
              durationMs: duration,
              error: new Error(`Request failed with status ${res.statusCode}`),
            })
            .catch((err) => {
              console.error(
                "[AuditLogger] Failed to log failed interaction:",
                err,
              );
            });
        }
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Create error logging middleware
 */
export function createErrorLoggingMiddleware(auditLogger: AuditLogger) {
  return async (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    // Log the error
    await auditLogger.error("Request error", err, {
      action_type: "system",
      path: req.path,
      method: req.method,
      body: req.body,
    });

    // Pass error to next error handler
    next(err);
  };
}
