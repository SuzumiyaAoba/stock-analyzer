import { describe, expect, it } from "bun:test";
import { createApp } from "./server";

function createDependencies() {
  const db = {
    getPrices() {
      return [{ symbol: "AAPL" }];
    },
    getCorporateActions() {
      return [{ symbol: "AAPL", actionType: "dividend" }];
    },
    getSyncJobRuns() {
      return [{ id: 1 }];
    },
    getInstrument() {
      return { symbol: "AAPL" };
    },
    upsertInstrument() {},
    upsertPriceBars() {},
    upsertCorporateActions() {},
    insertQuoteSnapshot() {},
  };

  const yahoo = {
    async syncHistory() {
      return {
        instrument: {
          symbol: "AAPL",
          quoteType: "EQUITY",
          exchange: "NMS",
          currency: "USD",
          timezone: "America/New_York",
          shortName: "Apple",
          longName: "Apple Inc.",
          firstTradeAt: null,
          rawJson: "{}",
        },
        bars: [{ symbol: "AAPL" }],
        actions: [],
      };
    },
    async syncQuote() {
      return {
        instrument: {
          symbol: "AAPL",
          quoteType: "EQUITY",
          exchange: "NMS",
          currency: "USD",
          timezone: "America/New_York",
          shortName: "Apple",
          longName: "Apple Inc.",
          firstTradeAt: null,
          rawJson: "{}",
        },
        snapshot: {
          symbol: "AAPL",
          asOf: "2026-03-17T14:00:00.000Z",
          regularMarketPrice: 1,
          previousClose: 1,
          dayHigh: 1,
          dayLow: 1,
          marketCap: 1,
          regularMarketVolume: 1,
          rawJson: "{}",
        },
      };
    },
  };

  const syncJob = {
    snapshot() {
      return {
        enabled: true,
        isRunning: false,
        symbols: ["AAPL"],
        intervalMs: 1000,
        historyInterval: "1d",
        historyRange: "1mo",
        includePrePost: false,
        lastRunStartedAt: null,
        lastRunFinishedAt: null,
        lastRunError: null,
        lastRunResults: [],
      };
    },
    async run() {
      return this.snapshot();
    },
  };

  return { db, yahoo, syncJob };
}

describe("server", () => {
  it("GET /healthz は疎通確認を返す", async () => {
    const app = createApp(createDependencies() as any);
    const response = await app.fetch(new Request("http://localhost/healthz"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("GET /api/v1/prices は不正 interval を拒否する", async () => {
    const app = createApp(createDependencies() as any);
    const response = await app.fetch(
      new Request("http://localhost/api/v1/prices?symbol=AAPL&interval=bad"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "interval が不正です: bad" });
  });

  it("POST /api/v1/sync/batch は結果を返す", async () => {
    const app = createApp(createDependencies() as any);
    const response = await app.fetch(
      new Request("http://localhost/api/v1/sync/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: ["AAPL", "MSFT"],
          range: "5d",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      count: 2,
    });
  });

  it("POST /api/v1/jobs/sync/run は symbols 未設定なら 400", async () => {
    const deps = createDependencies();
    deps.syncJob.snapshot = () => ({
      enabled: false,
      isRunning: false,
      symbols: [],
      intervalMs: 0,
      historyInterval: "1d",
      historyRange: "1mo",
      includePrePost: false,
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      lastRunError: null,
      lastRunResults: [],
    });

    const app = createApp(deps as any);
    const response = await app.fetch(
      new Request("http://localhost/api/v1/jobs/sync/run", { method: "POST" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "SYNC_SYMBOLS が未設定です" });
  });

  it("GET /api/v1/instruments/:symbol は DB 結果を返す", async () => {
    const app = createApp(createDependencies() as any);
    const response = await app.fetch(
      new Request("http://localhost/api/v1/instruments/AAPL"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ symbol: "AAPL" });
  });
});
