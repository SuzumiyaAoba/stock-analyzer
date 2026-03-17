import { YFinanceDatabase } from "./db";
import { readSyncJobConfig, SyncJob } from "./sync-job";
import {
  VALID_ACTION_TYPES,
  VALID_INTERVALS,
  type HistorySyncRequest,
  type QuoteSyncRequest,
} from "./types";
import { YahooFinanceClient } from "./yahoo-client";
import {
  HttpError,
  json,
  normalizeSymbol,
  parseJsonBody,
  validateHistoryRequest,
} from "./utils";

const db = new YFinanceDatabase();
const yahoo = new YahooFinanceClient();
const syncJob = new SyncJob(db, yahoo, readSyncJobConfig());
syncJob.start();

const port = Number(process.env.PORT || 3000);

async function syncHistory(body: HistorySyncRequest) {
  const input = validateHistoryRequest(body);
  const result = await yahoo.syncHistory(input);

  db.upsertInstrument(result.instrument);
  db.upsertPriceBars(result.bars);
  db.upsertCorporateActions(result.actions);

  return {
    symbol: result.instrument.symbol,
    interval: input.interval,
    barsInserted: result.bars.length,
    actionsInserted: result.actions.length,
  };
}

async function syncQuote(body: QuoteSyncRequest) {
  const symbol = normalizeSymbol(body.symbol);
  const modules = body.modules?.length ? body.modules : undefined;
  const result = await yahoo.syncQuote(symbol, modules);

  db.upsertInstrument(result.instrument);
  db.insertQuoteSnapshot(result.snapshot);

  return {
    symbol,
    asOf: result.snapshot.asOf,
  };
}

const server = Bun.serve({
  port,
  idleTimeout: 30,
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === "GET" && path === "/healthz") {
        return json({ ok: true });
      }

      if (request.method === "POST" && path === "/api/v1/sync/history") {
        const body = await parseJsonBody<HistorySyncRequest>(request);
        return json(await syncHistory(body));
      }

      if (request.method === "POST" && path === "/api/v1/sync/quote") {
        const body = await parseJsonBody<QuoteSyncRequest>(request);
        return json(await syncQuote(body));
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

      if (request.method === "POST" && path === "/api/v1/jobs/sync/run") {
        const state = await syncJob.run();
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

      console.error(error);
      return json({ error: "internal server error" }, { status: 500 });
    }
  },
});

console.log(`yfinance API listening on http://localhost:${server.port}`);
