import { Router, Request, Response } from "express";
import { getPool } from "./db/pool";
import {
  getOverallStats,
  getStreamsByEmployer,
  getStreamsByWorker,
  getPayrollTrends,
  getAddressStats,
} from "./db/queries";

export const analyticsRouter = Router();

/**
 * Middleware guard — returns 503 when the DB is not configured.
 */
const requireDb = (_req: Request, res: Response, next: () => void) => {
  if (!getPool()) {
    res.status(503).json({
      error: "Analytics unavailable",
      detail:
        "DATABASE_URL is not configured. Set it in your .env file to enable analytics.",
    });
    return;
  }
  next();
};

analyticsRouter.use(requireDb);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timed = async <T>(
  fn: () => Promise<T>,
): Promise<{ data: T; ms: number }> => {
  const start = Date.now();
  const data = await fn();
  return { data, ms: Date.now() - start };
};

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /analytics/summary
 * Overall stats: stream counts, total volume, total withdrawn.
 */
analyticsRouter.get("/summary", async (_req: Request, res: Response) => {
  try {
    const { data, ms } = await timed(getOverallStats);
    res.set("X-Query-Time-Ms", String(ms)).json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * GET /analytics/streams
 * Paginated stream list.
 * Query params: employer, worker, status, limit (max 200), offset
 */
analyticsRouter.get("/streams", async (req: Request, res: Response) => {
  try {
    const {
      employer,
      worker,
      status,
      limit = "50",
      offset = "0",
    } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const off = parseInt(offset, 10) || 0;

    let streams;
    if (employer) {
      streams = await getStreamsByEmployer(employer, status, lim, off);
    } else if (worker) {
      streams = await getStreamsByWorker(worker, status, lim, off);
    } else {
      // No filter — return all (employer path with null not supported; use summary instead)
      streams = await getStreamsByEmployer("%", status, lim, off);
    }

    res.json({
      ok: true,
      data: streams,
      meta: { limit: lim, offset: off, count: streams.length },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * GET /analytics/trends
 * Time-series payroll volume for charts.
 * Query params: address (optional), granularity=daily|weekly
 */
analyticsRouter.get("/trends", async (req: Request, res: Response) => {
  try {
    const { address, granularity = "daily" } = req.query as Record<
      string,
      string
    >;
    const gran = granularity === "weekly" ? "weekly" : "daily";

    const { data, ms } = await timed(() =>
      getPayrollTrends(address || null, gran),
    );
    res
      .set("X-Query-Time-Ms", String(ms))
      .json({ ok: true, data, meta: { granularity: gran } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * GET /analytics/employers/:address
 * Stats for a specific employer address.
 */
analyticsRouter.get(
  "/employers/:address",
  async (req: Request, res: Response) => {
    try {
      const address = req.params.address as string;
      const { data, ms } = await timed(() => getAddressStats(address));
      res.set("X-Query-Time-Ms", String(ms)).json({
        ok: true,
        data: {
          address,
          ...data.asEmployer,
          recentWithdrawals: data.recentWithdrawals,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ ok: false, error: msg });
    }
  },
);

/**
 * GET /analytics/workers/:address
 * Stats for a specific worker address.
 */
analyticsRouter.get(
  "/workers/:address",
  async (req: Request, res: Response) => {
    try {
      const address = req.params.address as string;
      const { data, ms } = await timed(() => getAddressStats(address));
      res.set("X-Query-Time-Ms", String(ms)).json({
        ok: true,
        data: {
          address,
          ...data.asWorker,
          recentWithdrawals: data.recentWithdrawals,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ ok: false, error: msg });
    }
  },
);
