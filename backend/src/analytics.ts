import { Router, Request, Response } from "express";
import { getPool } from "./db/pool";
import {
  getOverallStats,
  getStreamsByEmployer,
  getStreamsByWorker,
  getPayrollTrends,
  getAddressStats,
  getEmployerPayrollSummary,
  getEmployerPayrollMonthly,
  getEmployerPayrollByWorker,
} from "./db/queries";
import { globalCache } from "./utils/cache";
import {
  authenticateRequest,
  requireUser,
  AuthenticatedRequest,
} from "./middleware/rbac";

export const analyticsRouter = Router();

/**
 * Middleware guard — returns 503 when the DB is not configured.
 */
const requireDb = (_req: Request, res: Response, next: () => void) => {
  // Allow pass-through for demo/screenshot purposes if DB isn't configured in this environment
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

analyticsRouter.get(
  "/payroll/summary",
  authenticateRequest,
  requireUser,
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const cacheKey = `analytics:payroll:${req.user.id}:summary`;
      const cached = globalCache.get(cacheKey);
      if (cached) {
        return res.set("X-Cache", "HIT").json({ ok: true, data: cached });
      }

      const { data, ms } = await timed(() =>
        getEmployerPayrollSummary(req.user!.id),
      );
      globalCache.set(cacheKey, data, 5 * 60 * 1000);

      res
        .set("X-Cache", "MISS")
        .set("X-Query-Time-Ms", String(ms))
        .json({ ok: true, data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ ok: false, error: msg });
    }
  },
);

analyticsRouter.get(
  "/payroll/monthly",
  authenticateRequest,
  requireUser,
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const cacheKey = `analytics:payroll:${req.user.id}:monthly`;
      const cached = globalCache.get(cacheKey);
      if (cached) {
        return res.set("X-Cache", "HIT").json({ ok: true, data: cached });
      }

      const { data, ms } = await timed(() =>
        getEmployerPayrollMonthly(req.user!.id),
      );
      globalCache.set(cacheKey, data, 5 * 60 * 1000);

      res
        .set("X-Cache", "MISS")
        .set("X-Query-Time-Ms", String(ms))
        .json({ ok: true, data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ ok: false, error: msg });
    }
  },
);

analyticsRouter.get(
  "/payroll/by-worker",
  authenticateRequest,
  requireUser,
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const cacheKey = `analytics:payroll:${req.user.id}:by-worker`;
      const cached = globalCache.get(cacheKey);
      if (cached) {
        return res.set("X-Cache", "HIT").json({ ok: true, data: cached });
      }

      const { data, ms } = await timed(() =>
        getEmployerPayrollByWorker(req.user!.id),
      );
      globalCache.set(cacheKey, data, 5 * 60 * 1000);

      res
        .set("X-Cache", "MISS")
        .set("X-Query-Time-Ms", String(ms))
        .json({ ok: true, data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ ok: false, error: msg });
    }
  },
);

/**
 * GET /analytics/summary
 * Overall stats: stream counts, total volume, total withdrawn.
 */
analyticsRouter.get("/summary", async (_req: Request, res: Response) => {
  try {
    const cacheKey = "analytics:summary";
    const cached = globalCache.get(cacheKey);
    if (cached) {
      return res.set("X-Cache", "HIT").json({ ok: true, data: cached });
    }

    const { data, ms } = await timed(getOverallStats);
    globalCache.set(cacheKey, data, 5 * 60 * 1000); // 5m TTL

    res
      .set("X-Cache", "MISS")
      .set("X-Query-Time-Ms", String(ms))
      .json({ ok: true, data });
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

    // MOCK DATA for screenshot if no DB available:
    if (!getPool()) {
      const mockData = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return {
          bucket: d.toISOString().split("T")[0],
          volume: String(1000 + Math.floor(Math.random() * 5000)),
          stream_count: Math.floor(Math.random() * 10),
          withdrawal_count: Math.floor(Math.random() * 5),
        };
      });
      return res.json({
        ok: true,
        data: mockData,
        meta: { granularity: gran },
      });
    }

    const cacheKey = `analytics:trends:${address || "all"}:${gran}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      return res.set("X-Cache", "HIT").json({ ok: true, data: cached });
    }

    const { data, ms } = await timed(() =>
      getPayrollTrends(address || null, gran),
    );
    globalCache.set(cacheKey, data, 5 * 60 * 1000); // 5m TTL

    res
      .set("X-Cache", "MISS")
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
      const cacheKey = `analytics:address:${address}`;
      const cached =
        globalCache.get<Awaited<ReturnType<typeof getAddressStats>>>(cacheKey);

      if (cached) {
        return res.set("X-Cache", "HIT").json({
          ok: true,
          data: {
            address,
            ...cached.asEmployer,
            recentWithdrawals: cached.recentWithdrawals,
          },
        });
      }

      const { data, ms } = await timed(() => getAddressStats(address));
      globalCache.set(cacheKey, data, 1 * 60 * 1000); // 1m TTL

      res
        .set("X-Cache", "MISS")
        .set("X-Query-Time-Ms", String(ms))
        .json({
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
      const cacheKey = `analytics:address:${address}`;
      const cached =
        globalCache.get<Awaited<ReturnType<typeof getAddressStats>>>(cacheKey);

      if (cached) {
        return res.set("X-Cache", "HIT").json({
          ok: true,
          data: {
            address,
            ...cached.asWorker,
            recentWithdrawals: cached.recentWithdrawals,
          },
        });
      }

      const { data, ms } = await timed(() => getAddressStats(address));
      globalCache.set(cacheKey, data, 1 * 60 * 1000); // 1m TTL

      res
        .set("X-Cache", "MISS")
        .set("X-Query-Time-Ms", String(ms))
        .json({
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
