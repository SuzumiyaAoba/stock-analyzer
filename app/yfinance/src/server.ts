import { YFinanceDatabase } from "./db";
import { readSyncJobConfig, SyncJob } from "./sync-job";
import { syncBatch, syncHistory, syncQuote } from "./sync-service";
import {
  VALID_ACTION_TYPES,
  VALID_INTERVALS,
  type BatchSyncRequest,
  type HistorySyncRequest,
  type QuoteSyncRequest,
} from "./types";
import { YahooFinanceClient } from "./yahoo-client";
import {
  HttpError,
  json,
  normalizeSymbol,
  parseJsonBody,
} from "./utils";

type AppDependencies = {
  db: YFinanceDatabase;
  yahoo: YahooFinanceClient;
  syncJob: SyncJob;
  logger?: Pick<Console, "error" | "log">;
};

export function createApp({
  db,
  yahoo,
  syncJob,
  logger = console,
}: AppDependencies) {
  return {
    async fetch(request: Request) {
      try {
        const url = new URL(request.url);
        const path = url.pathname;

        if (request.method === "GET" && path === "/healthz") {
          return json({ ok: true });
        }

        if (request.method === "POST" && path === "/api/v1/sync/history") {
          const body = await parseJsonBody<HistorySyncRequest>(request);
          return json(await syncHistory(db, yahoo, body));
        }

        if (request.method === "POST" && path === "/api/v1/sync/quote") {
          const body = await parseJsonBody<QuoteSyncRequest>(request);
          return json(await syncQuote(db, yahoo, body));
        }

        if (request.method === "POST" && path === "/api/v1/sync/batch") {
          const body = await parseJsonBody<BatchSyncRequest>(request);
          return json(await syncBatch(db, yahoo, body));
        }

        if (request.method === "GET" && path === "/api/v1/prices") {
          const symbol = normalizeSymbol(url.searchParams.get("symbol"));
          const interval = url.searchParams.get("interval")?.trim() || "1d";
          if (!VALID_INTERVALS.has(interval)) {
            throw new HttpError(400, `interval が不正です: ${interval}`);
          }
          const from = url.searchParams.get("from");
          const to = url.searchParams.get("to");
          const limit = url.searchParams.get("limit")
            ? Number(url.searchParams.get("limit"))
            : undefined;

          const prices = db.getPrices({ symbol, interval, from, to, limit });
          return json({
            symbol,
            interval,
            count: prices.length,
            prices,
          });
        }

        if (request.method === "GET" && path === "/api/v1/actions") {
          const symbol = normalizeSymbol(url.searchParams.get("symbol"));
          const actionType = url.searchParams.get("type")?.trim() || null;
          if (actionType && !VALID_ACTION_TYPES.has(actionType)) {
            throw new HttpError(400, `type が不正です: ${actionType}`);
          }
          const from = url.searchParams.get("from");
          const to = url.searchParams.get("to");
          const limit = url.searchParams.get("limit")
            ? Number(url.searchParams.get("limit"))
            : undefined;

          const actions = db.getCorporateActions({ symbol, actionType, from, to, limit });
          return json({
            symbol,
            actionType,
            count: actions.length,
            actions,
          });
        }

        if (request.method === "GET" && path === "/api/v1/jobs/sync") {
          return json(syncJob.snapshot());
        }

        if (request.method === "GET" && path === "/api/v1/jobs/sync/runs") {
          const limit = url.searchParams.get("limit")
            ? Number(url.searchParams.get("limit"))
            : 20;
          const runs = db.getSyncJobRuns(limit);
          return json({
            count: runs.length,
            runs,
          });
        }

        if (request.method === "POST" && path === "/api/v1/jobs/sync/run") {
          if (syncJob.snapshot().symbols.length === 0) {
            throw new HttpError(400, "SYNC_SYMBOLS が未設定です");
          }
          const state = await syncJob.run("manual");
          return json(state);
        }

        if (request.method === "GET" && path.startsWith("/api/v1/instruments/")) {
          const symbol = normalizeSymbol(decodeURIComponent(path.split("/").pop() || ""));
          const instrument = db.getInstrument(symbol);
          if (!instrument) {
            throw new HttpError(404, "instrument が見つかりません");
          }
          return json(instrument);
        }

        throw new HttpError(404, "endpoint が見つかりません");
      } catch (error) {
        if (error instanceof HttpError) {
          return json({ error: error.message }, { status: error.status });
        }

        logger.error(error);
        return json({ error: "internal server error" }, { status: 500 });
      }
    },
  };
}

export function createServer(dependencies?: Partial<AppDependencies>) {
  const db = dependencies?.db ?? new YFinanceDatabase();
  const yahoo = dependencies?.yahoo ?? new YahooFinanceClient();
  const syncJob = dependencies?.syncJob ?? new SyncJob(db, yahoo, readSyncJobConfig());

  if (!dependencies?.syncJob) {
    syncJob.start();
  }

  const port = Number(process.env.PORT || 3000);
  const app = createApp({
    db,
    yahoo,
    syncJob,
    logger: dependencies?.logger,
  });

  const server = Bun.serve({
    port,
    idleTimeout: 30,
    fetch: app.fetch,
  });

  return { server, app, db, yahoo, syncJob };
}

if (import.meta.main) {
  const { server } = createServer();
  console.log(`yfinance API listening on http://localhost:${server.port}`);
}
