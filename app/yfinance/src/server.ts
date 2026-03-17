import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { YFinanceDatabase } from "./db";
import {
  actionsQuerySchema,
  batchSyncRequestSchema,
  formatZodError,
  historySyncRequestSchema,
  instrumentParamSchema,
  pricesQuerySchema,
  quoteSyncRequestSchema,
  serverConfigSchema,
  syncRunsQuerySchema,
} from "./schemas";
import { readSyncJobConfig, SyncJob } from "./sync-job";
import { syncBatch, syncHistory, syncQuote } from "./sync-service";
import { YahooFinanceClient } from "./yahoo-client";
import { HttpError } from "./utils";

type AppDependencies = {
  db: YFinanceDatabase;
  yahoo: YahooFinanceClient;
  syncJob: SyncJob;
  logger?: Pick<Console, "error" | "log">;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function validationHook(result: { success: boolean; error?: unknown }) {
  if (result.success) {
    return;
  }

  if (result.error && typeof result.error === "object" && "issues" in result.error) {
    return jsonError(formatZodError(result.error as any), 400);
  }

  return jsonError("リクエストが不正です", 400);
}

async function parseJsonWithSchema<T>(
  request: Request,
  schema: {
    safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: unknown };
  },
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "JSON ボディが不正です");
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, formatZodError(result.error as any));
  }

  return result.data;
}

export function createApp({ db, yahoo, syncJob, logger = console }: AppDependencies) {
  const app = new Hono();

  app.onError((error, _c) => {
    if (error instanceof HttpError) {
      return jsonError(error.message, error.status);
    }

    logger.error(error);
    return jsonError("internal server error", 500);
  });

  app.notFound((_c) => {
    return jsonError("endpoint が見つかりません", 404);
  });

  app.get("/healthz", (c) => {
    return c.json({ ok: true });
  });

  app.post("/api/v1/sync/history", async (c) => {
    const body = await parseJsonWithSchema(c.req.raw, historySyncRequestSchema);
    return c.json(await syncHistory(db, yahoo, body));
  });

  app.post("/api/v1/sync/quote", async (c) => {
    const body = await parseJsonWithSchema(c.req.raw, quoteSyncRequestSchema);
    return c.json(await syncQuote(db, yahoo, body));
  });

  app.post("/api/v1/sync/batch", async (c) => {
    const body = await parseJsonWithSchema(c.req.raw, batchSyncRequestSchema);
    return c.json(await syncBatch(db, yahoo, body));
  });

  app.get("/api/v1/prices", zValidator("query", pricesQuerySchema, validationHook), (c) => {
    const query = c.req.valid("query");
    const prices = db.getPrices(query);

    return c.json({
      symbol: query.symbol,
      interval: query.interval,
      count: prices.length,
      prices,
    });
  });

  app.get("/api/v1/actions", zValidator("query", actionsQuerySchema, validationHook), (c) => {
    const query = c.req.valid("query");
    const actions = db.getCorporateActions({
      symbol: query.symbol,
      actionType: query.type,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });

    return c.json({
      symbol: query.symbol,
      actionType: query.type,
      count: actions.length,
      actions,
    });
  });

  app.get("/api/v1/jobs/sync", (c) => {
    return c.json(syncJob.snapshot());
  });

  app.get(
    "/api/v1/jobs/sync/runs",
    zValidator("query", syncRunsQuerySchema, validationHook),
    (c) => {
      const query = c.req.valid("query");
      const runs = db.getSyncJobRuns(query.limit);

      return c.json({
        count: runs.length,
        runs,
      });
    },
  );

  app.post("/api/v1/jobs/sync/run", async (c) => {
    if (syncJob.snapshot().symbols.length === 0) {
      throw new HttpError(400, "SYNC_SYMBOLS が未設定です");
    }

    return c.json(await syncJob.run("manual"));
  });

  app.get(
    "/api/v1/instruments/:symbol",
    zValidator("param", instrumentParamSchema, validationHook),
    (c) => {
      const { symbol } = c.req.valid("param");
      const instrument = db.getInstrument(symbol);
      if (!instrument) {
        throw new HttpError(404, "instrument が見つかりません");
      }

      return c.json(instrument);
    },
  );

  return app;
}

export function createServer(dependencies?: Partial<AppDependencies>) {
  const db = dependencies?.db ?? new YFinanceDatabase();
  const yahoo = dependencies?.yahoo ?? new YahooFinanceClient();
  const syncJob = dependencies?.syncJob ?? new SyncJob(db, yahoo, readSyncJobConfig());

  if (!dependencies?.syncJob) {
    syncJob.start();
  }

  const config = serverConfigSchema.safeParse(process.env);
  if (!config.success) {
    throw new Error(formatZodError(config.error));
  }

  const app = createApp({
    db,
    yahoo,
    syncJob,
    logger: dependencies?.logger,
  });

  const server = Bun.serve({
    port: config.data.PORT,
    idleTimeout: 30,
    fetch: app.fetch,
  });

  return { server, app, db, yahoo, syncJob };
}

if (import.meta.main) {
  const { server } = createServer();
  console.log(`yfinance API listening on http://localhost:${server.port}`);
}
