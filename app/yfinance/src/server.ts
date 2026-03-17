import { YFinanceDatabase } from "./db";
import { readSyncJobConfig, SyncJob } from "./sync-job";
import { syncBatch, syncHistory, syncQuote } from "./sync-service";
import {
  type BatchSyncRequest,
  type HistorySyncRequest,
  type QuoteSyncRequest,
} from "./types";
import { YahooFinanceClient } from "./yahoo-client";
import {
  HttpError,
  json,
  normalizeSymbol,
  parseActionType,
  parseInterval,
  parseLimit,
  parseJsonBody,
} from "./utils";

type AppDependencies = {
  db: YFinanceDatabase;
  yahoo: YahooFinanceClient;
  syncJob: SyncJob;
  logger?: Pick<Console, "error" | "log">;
};

function handlePricesRequest(db: YFinanceDatabase, url: URL): Response {
  const symbol = normalizeSymbol(url.searchParams.get("symbol"));
  const interval = parseInterval(url.searchParams.get("interval"));
  const prices = db.getPrices({
    symbol,
    interval,
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    limit: parseLimit(url.searchParams.get("limit"), {
      defaultValue: 500,
      max: 5000,
    }),
  });

  return json({
    symbol,
    interval,
    count: prices.length,
    prices,
  });
}

function handleActionsRequest(db: YFinanceDatabase, url: URL): Response {
  const symbol = normalizeSymbol(url.searchParams.get("symbol"));
  const actionType = parseActionType(url.searchParams.get("type"));
  const actions = db.getCorporateActions({
    symbol,
    actionType,
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    limit: parseLimit(url.searchParams.get("limit"), {
      defaultValue: 500,
      max: 5000,
    }),
  });

  return json({
    symbol,
    actionType,
    count: actions.length,
    actions,
  });
}

function handleSyncRunsRequest(db: YFinanceDatabase, url: URL): Response {
  const runs = db.getSyncJobRuns(
    parseLimit(url.searchParams.get("limit"), {
      defaultValue: 20,
      max: 200,
    }),
  );

  return json({
    count: runs.length,
    runs,
  });
}

function handleInstrumentRequest(db: YFinanceDatabase, path: string): Response {
  const symbol = normalizeSymbol(decodeURIComponent(path.split("/").pop() || ""));
  const instrument = db.getInstrument(symbol);
  if (!instrument) {
    throw new HttpError(404, "instrument が見つかりません");
  }
  return json(instrument);
}

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
          return handlePricesRequest(db, url);
        }

        if (request.method === "GET" && path === "/api/v1/actions") {
          return handleActionsRequest(db, url);
        }

        if (request.method === "GET" && path === "/api/v1/jobs/sync") {
          return json(syncJob.snapshot());
        }

        if (request.method === "GET" && path === "/api/v1/jobs/sync/runs") {
          return handleSyncRunsRequest(db, url);
        }

        if (request.method === "POST" && path === "/api/v1/jobs/sync/run") {
          if (syncJob.snapshot().symbols.length === 0) {
            throw new HttpError(400, "SYNC_SYMBOLS が未設定です");
          }
          const state = await syncJob.run("manual");
          return json(state);
        }

        if (request.method === "GET" && path.startsWith("/api/v1/instruments/")) {
          return handleInstrumentRequest(db, path);
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
