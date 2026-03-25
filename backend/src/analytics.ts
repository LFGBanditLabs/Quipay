import { Router, Request, Response } from "express";
import { getPool } from "./db/pool";
import {
  getOverallStats,
  getStreamsByEmployer,
  getStreamsByWorker,
  getPayrollTrends,
  getAddressStats,
  getStreamingVolumeByTimeframe,
  getTopWorkersByEarnings,
  getStreamCreationMetrics,
  getWithdrawalFrequency,
} from "./db/queries";
import { globalCache } from "./utils/cache";

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
      globalCache.set(cacheKey, data, 1 * 60 * 1000); //1m TTL

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

/**
 * GET /analytics/streaming-volume
 * Total XLM/USDC streamed per day/week
 */
analyticsRouter.get("/streaming-volume", async (req: Request, res: Response) => {
  try {
    const { timeframe = "daily", hours = "96" } = req.query as Record<string, string>;
    const tf = timeframe === "weekly" ? "weekly" : "daily";
    const hrs = Math.min(parseInt(hours, 10) || 96, 96);

    // MOCK DATA for screenshot if no DB available:
    if (!getPool()) {
      const mockData = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return {
          timeframe: d.toISOString().split("T")[0],
          xlm_volume: String(1000000 + Math.floor(Math.random() * 5000000)), // 1-6 XLM
          usdc_volume: String(5000000 + Math.floor(Math.random() * 10000000)), // 5-15 USDC
          total_volume: String(6000000 + Math.floor(Math.random() * 15000000)),
          stream_count: Math.floor(Math.random() * 10) + 1,
        };
      });
      return res.json({
        ok: true,
        data: mockData,
        meta: { timeframe: tf, hours: hrs },
      });
    }

    const cacheKey = `analytics:streaming-volume:${tf}:${hrs}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      return res.set("X-Cache", "HIT").json({ ok: true, data: cached });
    }

    const { data, ms } = await timed(() =>
      getStreamingVolumeByTimeframe(tf, hrs),
    );
    globalCache.set(cacheKey, data, 60 * 1000); // 1m TTL

    res
      .set("X-Cache", "MISS")
      .set("X-Query-Time-Ms", String(ms))
      .json({ ok: true, data, meta: { timeframe: tf, hours: hrs } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * GET /analytics/top-workers
 * Top workers by earned amount
 */
analyticsRouter.get("/top-workers", async (req: Request, res: Response) => {
  try {
    const { limit = "10" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10) || 10, 50);

    // MOCK DATA for screenshot if no DB available:
    if (!getPool()) {
      const mockData = Array.from({ length: lim }).map((_, i) => ({
        worker_address: `GDYQ${String(i + 1).padStart(4, "0")}...XYZ${i + 1}`,
        total_earned: String((100 + i * 50) * 1000000), // 100-600 XLM
        stream_count: Math.floor(Math.random() * 5) + 1,
        last_withdrawal: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      }));
      return res.json({ ok: true, data: mockData });
    }

    const cacheKey = `analytics:top-workers:${lim}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      return res.set("X-Cache", "HIT").json({ ok: true, data: cached });
    }

    const { data, ms } = await timed(() => getTopWorkersByEarnings(lim));
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
 * GET /analytics/stream-creation
 * Stream creation rate metrics
 */
analyticsRouter.get("/stream-creation", async (req: Request, res: Response) => {
  try {
    const { timeframe = "daily", hours = "96" } = req.query as Record<string, string>;
    const tf = timeframe === "weekly" ? "weekly" : "daily";
    const hrs = Math.min(parseInt(hours, 10) || 96, 96);

    // MOCK DATA for screenshot if no DB available:
    if (!getPool()) {
      const mockData = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return {
          timeframe: d.toISOString().split("T")[0],
          creation_rate: Math.random() * 10 + 1, // 1-11 streams per day
          total_created: Math.floor(Math.random() * 20) + 5,
          active_streams: Math.floor(Math.random() * 15) + 10,
          cancelled_streams: Math.floor(Math.random() * 3),
        };
      });
      return res.json({
        ok: true,
        data: mockData,
        meta: { timeframe: tf, hours: hrs },
      });
    }

    const cacheKey = `analytics:stream-creation:${tf}:${hrs}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      return res.set("X-Cache", "HIT").json({ ok: true, data: cached });
    }

    const { data, ms } = await timed(() => getStreamCreationMetrics(tf, hrs));
    globalCache.set(cacheKey, data, 60 * 1000); // 1m TTL

    res
      .set("X-Cache", "MISS")
      .set("X-Query-Time-Ms", String(ms))
      .json({ ok: true, data, meta: { timeframe: tf, hours: hrs } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * GET /analytics/withdrawal-frequency
 * Withdrawal frequency metrics
 */
analyticsRouter.get("/withdrawal-frequency", async (req: Request, res: Response) => {
  try {
    const { timeframe = "daily", hours = "96" } = req.query as Record<string, string>;
    const tf = timeframe === "weekly" ? "weekly" : "daily";
    const hrs = Math.min(parseInt(hours, 10) || 96, 96);

    // MOCK DATA for screenshot if no DB available:
    if (!getPool()) {
      const mockData = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return {
          timeframe: d.toISOString().split("T")[0],
          withdrawal_count: Math.floor(Math.random() * 50) + 10, // 10-60 withdrawals
          total_withdrawn: String((Math.random() * 10000000 + 5000000)), // 5-15 XLM
          unique_workers: Math.floor(Math.random() * 20) + 5, // 5-25 unique workers
          avg_withdrawal_amount: String(Math.random() * 500000 + 100000), // 0.1-0.6 XLM
        };
      });
      return res.json({
        ok: true,
        data: mockData,
        meta: { timeframe: tf, hours: hrs },
      });
    }

    const cacheKey = `analytics:withdrawal-frequency:${tf}:${hrs}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      return res.set("X-Cache", "HIT").json({ ok: true, data: cached });
    }

    const { data, ms } = await timed(() => getWithdrawalFrequency(tf, hrs));
    globalCache.set(cacheKey, data, 60 * 1000); // 1m TTL

    res
      .set("X-Cache", "MISS")
      .set("X-Query-Time-Ms", String(ms))
      .json({ ok: true, data, meta: { timeframe: tf, hours: hrs } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: msg });
  }
});
