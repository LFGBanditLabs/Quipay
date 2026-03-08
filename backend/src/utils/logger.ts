import pino, { Logger } from "pino";
import { AsyncLocalStorage } from "async_hooks";

export interface CorrelationContext {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

class StructuredLogger {
  private logger: Logger;
  private contextStorage = new AsyncLocalStorage<CorrelationContext>();

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || "info",
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        service: "quipay-automation-engine",
        version: process.env.npm_package_version || "0.0.1",
        environment: process.env.NODE_ENV || "development",
      },
    });
  }

  private getLoggerWithContext(): Logger {
    const context = this.contextStorage.getStore() || {};
    return this.logger.child(context);
  }

  withContext<T>(context: CorrelationContext, fn: () => T): T {
    return this.contextStorage.run(context, fn);
  }

  getCurrentContext(): CorrelationContext {
    return this.contextStorage.getStore() || {};
  }

  updateContext(updates: Partial<CorrelationContext>): void {
    const current = this.contextStorage.getStore() || {};
    this.contextStorage.enterWith({ ...current, ...updates });
  }

  info(message: string, meta?: object): void {
    this.getLoggerWithContext().info(meta, message);
  }

  warn(message: string, meta?: object): void {
    this.getLoggerWithContext().warn(meta, message);
  }

  error(message: string, error?: Error | object, meta?: object): void {
    const errorMeta =
      error instanceof Error
        ? {
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name,
            },
          }
        : { error };

    this.getLoggerWithContext().error({ ...errorMeta, ...meta }, message);
  }

  debug(message: string, meta?: object): void {
    this.getLoggerWithContext().debug(meta, message);
  }

  trace(message: string, meta?: object): void {
    this.getLoggerWithContext().trace(meta, message);
  }

  child(meta: object): StructuredLogger {
    const childLogger = new StructuredLogger();
    childLogger.logger = this.getLoggerWithContext().child(meta);
    return childLogger;
  }

  // Raw pino logger access for advanced use cases
  get raw(): Logger {
    return this.getLoggerWithContext();
  }
}

export const logger = new StructuredLogger();
export default logger;
