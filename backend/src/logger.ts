import pino from "pino";

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info");

export const logger = pino({
  level,
  base: {
    service: "quipay-backend",
    env: process.env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const patchConsoleWithLogger = (): void => {
  const toMessage = (args: unknown[]) =>
    args
      .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
      .join(" ");

  console.log = (...args: unknown[]) => logger.info({ args }, toMessage(args));
  console.info = (...args: unknown[]) => logger.info({ args }, toMessage(args));
  console.warn = (...args: unknown[]) => logger.warn({ args }, toMessage(args));
  console.error = (...args: unknown[]) => logger.error({ args }, toMessage(args));
};
