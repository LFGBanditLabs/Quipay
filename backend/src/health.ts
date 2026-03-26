import { rpc } from "@stellar/stellar-sdk";
import { getPool } from "./db/pool";
import { vaultService } from "./services/vaultService";

export type DependencyState = "healthy" | "unhealthy";

export interface DependencyHealth {
  status: DependencyState;
  latencyMs: number;
  details?: string;
}

export interface HealthResponseBody {
  status: "ok" | "degraded";
  uptime: string;
  timestamp: string;
  version: string;
  service: string;
  dependencies: {
    database: DependencyHealth;
    stellarRpc: DependencyHealth;
    vault: DependencyHealth;
  };
}

const SERVICE_NAME = "quipay-automation-engine";
const CHECK_TIMEOUT_MS = 5000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

async function checkDatabase(): Promise<DependencyHealth> {
  const startedAt = Date.now();
  const pool = getPool();

  if (!pool) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - startedAt,
      details: "DATABASE_URL not configured or pool not initialized",
    };
  }

  try {
    await withTimeout(pool.query("SELECT 1"), CHECK_TIMEOUT_MS);
    const total = pool.totalCount;
    const idle = pool.idleCount;
    const waiting = pool.waitingCount;
    const max = (pool as any).options?.max as number | undefined;

    return {
      status: "healthy",
      latencyMs: Date.now() - startedAt,
      details: `pool(total=${total}, idle=${idle}, waiting=${waiting}, max=${
        max ?? "unknown"
      })`,
    };
  } catch (error) {
    const total = pool.totalCount;
    const idle = pool.idleCount;
    const waiting = pool.waitingCount;
    const max = (pool as any).options?.max as number | undefined;

    return {
      status: "unhealthy",
      latencyMs: Date.now() - startedAt,
      details:
        error instanceof Error
          ? `${error.message}; pool(total=${total}, idle=${idle}, waiting=${waiting}, max=${
              max ?? "unknown"
            })`
          : `Database query failed; pool(total=${total}, idle=${idle}, waiting=${waiting}, max=${
              max ?? "unknown"
            })`,
    };
  }
}

async function checkStellarRpc(): Promise<DependencyHealth> {
  const startedAt = Date.now();
  const rpcUrl =
    process.env.STELLAR_RPC_URL ||
    process.env.PUBLIC_STELLAR_RPC_URL ||
    "https://soroban-testnet.stellar.org";

  try {
    const server = new rpc.Server(rpcUrl);
    const latestLedger = await withTimeout(
      server.getLatestLedger(),
      CHECK_TIMEOUT_MS,
    );

    if (!latestLedger?.sequence) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - startedAt,
        details: "Missing latest ledger sequence",
      };
    }

    return {
      status: "healthy",
      latencyMs: Date.now() - startedAt,
      details: `ledger=${latestLedger.sequence}`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - startedAt,
      details: error instanceof Error ? error.message : "RPC check failed",
    };
  }
}

async function checkVault(): Promise<DependencyHealth> {
  const startedAt = Date.now();

  if (!process.env.VAULT_ADDR) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - startedAt,
      details: "VAULT_ADDR is not configured",
    };
  }

  if (!process.env.VAULT_TOKEN) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - startedAt,
      details: "VAULT_TOKEN is not configured",
    };
  }

  try {
    const [healthy, tokenValid] = await Promise.all([
      withTimeout(vaultService.isHealthy(), CHECK_TIMEOUT_MS),
      withTimeout(vaultService.isTokenValid(), CHECK_TIMEOUT_MS),
    ]);

    if (!healthy) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - startedAt,
        details: "Vault health check failed",
      };
    }

    if (!tokenValid) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - startedAt,
        details: "Vault token is invalid or expired",
      };
    }

    return {
      status: "healthy",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - startedAt,
      details: error instanceof Error ? error.message : "Vault check failed",
    };
  }
}

export async function getHealthResponse(
  startTimeMs: number,
): Promise<{ httpStatus: 200 | 503; body: HealthResponseBody }> {
  const [database, stellarRpc, vault] = await Promise.all([
    checkDatabase(),
    checkStellarRpc(),
    checkVault(),
  ]);

  const allHealthy =
    database.status === "healthy" &&
    stellarRpc.status === "healthy" &&
    vault.status === "healthy";

  const body: HealthResponseBody = {
    status: allHealthy ? "ok" : "degraded",
    uptime: `${Math.floor((Date.now() - startTimeMs) / 1000)}s`,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.0.1",
    service: SERVICE_NAME,
    dependencies: {
      database,
      stellarRpc,
      vault,
    },
  };

  return {
    httpStatus: allHealthy ? 200 : 503,
    body,
  };
}
