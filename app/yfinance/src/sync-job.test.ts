import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { SyncJob, readSyncJobConfig } from "./sync-job";

describe("SyncJob", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("run は成功時に結果を保存する", async () => {
    const dbCalls = {
      created: [] as unknown[],
      finished: [] as unknown[],
    };

    const db = {
      createSyncJobRun(input: unknown) {
        dbCalls.created.push(input);
        return 1;
      },
      finishSyncJobRun(input: unknown) {
        dbCalls.finished.push(input);
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

    const job = new SyncJob(db as any, yahoo as any, {
      enabled: true,
      symbols: ["AAPL"],
      intervalMs: 1000,
      historyInterval: "1d",
      historyRange: "1mo",
      includePrePost: false,
      runOnStart: false,
    });

    const result = await job.run("manual");

    expect(result.isRunning).toBe(false);
    expect(result.lastRunError).toBeNull();
    expect(result.lastRunResults).toHaveLength(1);
    expect(dbCalls.created).toHaveLength(1);
    expect(dbCalls.finished).toHaveLength(1);
    expect((dbCalls.finished[0] as any).status).toBe("success");
  });

  it("run は失敗時に error を保存する", async () => {
    const finished: unknown[] = [];
    const db = {
      createSyncJobRun() {
        return 1;
      },
      finishSyncJobRun(input: unknown) {
        finished.push(input);
      },
      upsertInstrument() {},
      upsertPriceBars() {},
      upsertCorporateActions() {},
      insertQuoteSnapshot() {},
    };

    const yahoo = {
      async syncHistory() {
        throw new Error("boom");
      },
      async syncQuote() {
        throw new Error("boom");
      },
    };

    const job = new SyncJob(db as any, yahoo as any, {
      enabled: true,
      symbols: ["AAPL"],
      intervalMs: 1000,
      historyInterval: "1d",
      historyRange: "1mo",
      includePrePost: false,
      runOnStart: false,
    });

    const result = await job.run();

    expect(result.lastRunError).toBe("boom");
    expect((finished[0] as any).status).toBe("error");
  });

  it("start は有効時に interval を登録する", () => {
    const db = {
      createSyncJobRun() {
        return 1;
      },
      finishSyncJobRun() {},
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
          bars: [],
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

    const setIntervalSpy = spyOn(globalThis, "setInterval").mockImplementation(mock(() => 1 as any));

    try {
      const job = new SyncJob(db as any, yahoo as any, {
        enabled: true,
        symbols: ["AAPL"],
        intervalMs: 1000,
        historyInterval: "1d",
        historyRange: "1mo",
        includePrePost: false,
        runOnStart: false,
      });

      job.start();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  it("readSyncJobConfig は環境変数を解釈する", () => {
    process.env.SYNC_SYMBOLS = "aapl, msft";
    process.env.SYNC_INTERVAL_MS = "60000";
    process.env.SYNC_HISTORY_INTERVAL = "1h";
    process.env.SYNC_HISTORY_RANGE = "5d";
    process.env.SYNC_INCLUDE_PREPOST = "true";
    process.env.SYNC_RUN_ON_START = "false";

    expect(readSyncJobConfig()).toEqual({
      enabled: true,
      symbols: ["AAPL", "MSFT"],
      intervalMs: 60000,
      historyInterval: "1h",
      historyRange: "5d",
      includePrePost: true,
      runOnStart: false,
    });
  });
});
