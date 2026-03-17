import { err, errAsync, ok, okAsync, ResultAsync } from "neverthrow";
import { YFinanceDatabase } from "./db";
import { readSyncJobConfig, SyncJob } from "./sync-job";
import { syncBatch, syncHistory, syncQuote } from "./sync-service";
import { type BatchSyncRequest, type HistorySyncRequest, type QuoteSyncRequest } from "./types";
import { YahooFinanceClient } from "./yahoo-client";
import {
  type AppResult,
  HttpError,
  json,
  normalizeSymbolResult,
  parseActionTypeResult,
  parseIntervalResult,
  parseJsonBodyResult,
  parseLimitResult,
} from "./utils";

type AppDependencies = {
  db: YFinanceDatabase;
  yahoo: YahooFinanceClient;
  syncJob: SyncJob;
  logger?: Pick<Console, "error" | "log">;
};

type RouteResult = ResultAsync<Response, unknown>;

function toAsyncResult<T>(result: AppResult<T>): ResultAsync<T, HttpError> {
  return result.match(
    (value) => okAsync(value),
    (error) => errAsync(error),
  );
}

function runAsync<T>(work: () => Promise<T>): ResultAsync<T, unknown> {
  return ResultAsync.fromPromise(work(), (error) => error);
}

function handlePricesRequest(db: YFinanceDatabase, url: URL): AppResult<Response> {
  return normalizeSymbolResult(url.searchParams.get("symbol")).andThen((symbol) => {
    return parseIntervalResult(url.searchParams.get("interval")).andThen((interval) => {
      return parseLimitResult(url.searchParams.get("limit"), {
        defaultValue: 500,
        max: 5000,
      }).map((limit) => {
        const prices = db.getPrices({
          symbol,
          interval,
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          limit,
        });

        return json({
          symbol,
          interval,
          count: prices.length,
          prices,
        });
      });
    });
  });
}

function handleActionsRequest(db: YFinanceDatabase, url: URL): AppResult<Response> {
  return normalizeSymbolResult(url.searchParams.get("symbol")).andThen((symbol) => {
    return parseActionTypeResult(url.searchParams.get("type")).andThen((actionType) => {
      return parseLimitResult(url.searchParams.get("limit"), {
        defaultValue: 500,
        max: 5000,
      }).map((limit) => {
        const actions = db.getCorporateActions({
          symbol,
          actionType,
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          limit,
        });

        return json({
          symbol,
          actionType,
          count: actions.length,
          actions,
        });
      });
    });
  });
}

function handleSyncRunsRequest(db: YFinanceDatabase, url: URL): AppResult<Response> {
  return parseLimitResult(url.searchParams.get("limit"), {
    defaultValue: 20,
    max: 200,
  }).map((limit) => {
    const runs = db.getSyncJobRuns(limit);
    return json({
      count: runs.length,
      runs,
    });
  });
}

function handleInstrumentRequest(db: YFinanceDatabase, path: string): AppResult<Response> {
  return normalizeSymbolResult(decodeURIComponent(path.split("/").pop() || "")).andThen(
    (symbol) => {
      const instrument = db.getInstrument(symbol);
      if (!instrument) {
        return err(new HttpError(404, "instrument が見つかりません"));
      }

      return ok(json(instrument));
    },
  );
}

function handleHistorySyncRequest(
  db: YFinanceDatabase,
  yahoo: YahooFinanceClient,
  request: Request,
): RouteResult {
  return parseJsonBodyResult<HistorySyncRequest>(request)
    .andThen((body) => runAsync(() => syncHistory(db, yahoo, body)))
    .map((result) => json(result));
}

function handleQuoteSyncRequest(
  db: YFinanceDatabase,
  yahoo: YahooFinanceClient,
  request: Request,
): RouteResult {
  return parseJsonBodyResult<QuoteSyncRequest>(request)
    .andThen((body) => runAsync(() => syncQuote(db, yahoo, body)))
    .map((result) => json(result));
}

function handleBatchSyncRequest(
  db: YFinanceDatabase,
  yahoo: YahooFinanceClient,
  request: Request,
): RouteResult {
  return parseJsonBodyResult<BatchSyncRequest>(request)
    .andThen((body) => runAsync(() => syncBatch(db, yahoo, body)))
    .map((result) => json(result));
}

function handleManualSyncRequest(syncJob: SyncJob): RouteResult {
  const state = syncJob.snapshot();
  if (state.symbols.length === 0) {
    return errAsync(new HttpError(400, "SYNC_SYMBOLS が未設定です"));
  }

  return runAsync(() => syncJob.run("manual")).map((result) => json(result));
}

function routeRequest(
  request: Request,
  { db, yahoo, syncJob }: Pick<AppDependencies, "db" | "yahoo" | "syncJob">,
): RouteResult {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === "/healthz") {
    return okAsync(json({ ok: true }));
  }

  if (request.method === "POST" && path === "/api/v1/sync/history") {
    return handleHistorySyncRequest(db, yahoo, request);
  }

  if (request.method === "POST" && path === "/api/v1/sync/quote") {
    return handleQuoteSyncRequest(db, yahoo, request);
  }

  if (request.method === "POST" && path === "/api/v1/sync/batch") {
    return handleBatchSyncRequest(db, yahoo, request);
  }

  if (request.method === "GET" && path === "/api/v1/prices") {
    return toAsyncResult(handlePricesRequest(db, url));
  }

  if (request.method === "GET" && path === "/api/v1/actions") {
    return toAsyncResult(handleActionsRequest(db, url));
  }

  if (request.method === "GET" && path === "/api/v1/jobs/sync") {
    return okAsync(json(syncJob.snapshot()));
  }

  if (request.method === "GET" && path === "/api/v1/jobs/sync/runs") {
    return toAsyncResult(handleSyncRunsRequest(db, url));
  }

  if (request.method === "POST" && path === "/api/v1/jobs/sync/run") {
    return handleManualSyncRequest(syncJob);
  }

  if (request.method === "GET" && path.startsWith("/api/v1/instruments/")) {
    return toAsyncResult(handleInstrumentRequest(db, path));
  }

  return errAsync(new HttpError(404, "endpoint が見つかりません"));
}

export function createApp({ db, yahoo, syncJob, logger = console }: AppDependencies) {
  return {
    async fetch(request: Request) {
      return routeRequest(request, { db, yahoo, syncJob }).match(
        (response) => response,
        (error) => {
          if (error instanceof HttpError) {
            return json({ error: error.message }, { status: error.status });
          }

          logger.error(error);
          return json({ error: "internal server error" }, { status: 500 });
        },
      );
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
