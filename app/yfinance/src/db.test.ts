import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { YFinanceDatabase } from "./db";

describe("YFinanceDatabase", () => {
  let tempDir: string;
  let db: YFinanceDatabase;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "yfinance-db-test-"));
    db = new YFinanceDatabase(join(tempDir, "test.sqlite"));
  });

  afterEach(() => {
    db.db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("銘柄情報を upsert し、null では既存値を壊さない", () => {
    db.upsertInstrument({
      symbol: "AAPL",
      quoteType: "EQUITY",
      exchange: "NMS",
      currency: "USD",
      timezone: "America/New_York",
      shortName: "Apple",
      longName: "Apple Inc.",
      firstTradeAt: "1980-12-12T14:30:00.000Z",
      rawJson: "{}",
    });

    db.upsertInstrument({
      symbol: "AAPL",
      quoteType: null,
      exchange: null,
      currency: null,
      timezone: null,
      shortName: null,
      longName: "Apple Incorporated",
      firstTradeAt: null,
      rawJson: '{"v":2}',
    });

    const instrument = db.getInstrument("AAPL");
    expect(instrument).toMatchObject({
      symbol: "AAPL",
      quoteType: "EQUITY",
      timezone: "America/New_York",
      longName: "Apple Incorporated",
    });
  });

  it("価格データを保存して条件付きで取得できる", () => {
    db.upsertPriceBars([
      {
        symbol: "AAPL",
        interval: "1d",
        timestampUtc: "2026-01-01T00:00:00.000Z",
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        adjClose: 1.5,
        volume: 100,
      },
      {
        symbol: "AAPL",
        interval: "1d",
        timestampUtc: "2026-01-02T00:00:00.000Z",
        open: 2,
        high: 3,
        low: 1.5,
        close: 2.5,
        adjClose: 2.5,
        volume: 200,
      },
    ]);

    expect(
      db.getPrices({
        symbol: "AAPL",
        interval: "1d",
        from: "2026-01-02T00:00:00.000Z",
      }),
    ).toHaveLength(1);
  });

  it("保存済み銘柄を一覧・検索でき、最新 quote を含めて返す", () => {
    db.upsertInstrument({
      symbol: "AAPL",
      quoteType: "EQUITY",
      exchange: "NMS",
      currency: "USD",
      timezone: "America/New_York",
      shortName: "Apple",
      longName: "Apple Inc.",
      firstTradeAt: "1980-12-12T14:30:00.000Z",
      rawJson: "{}",
    });
    db.upsertInstrument({
      symbol: "MSFT",
      quoteType: "EQUITY",
      exchange: "NMS",
      currency: "USD",
      timezone: "America/New_York",
      shortName: "Microsoft",
      longName: "Microsoft Corporation",
      firstTradeAt: "1986-03-13T14:30:00.000Z",
      rawJson: "{}",
    });

    db.insertQuoteSnapshot({
      symbol: "AAPL",
      asOf: "2026-03-17T14:00:00.000Z",
      regularMarketPrice: 210,
      previousClose: 208,
      dayHigh: 211,
      dayLow: 207,
      marketCap: 1,
      regularMarketVolume: 100,
      rawJson: "{}",
    });
    db.insertQuoteSnapshot({
      symbol: "AAPL",
      asOf: "2026-03-18T14:00:00.000Z",
      regularMarketPrice: 215,
      previousClose: 210,
      dayHigh: 216,
      dayLow: 209,
      marketCap: 2,
      regularMarketVolume: 200,
      rawJson: "{}",
    });

    expect(
      db.getInstruments({
        q: "soft",
        sortBy: "symbol",
        order: "asc",
      }),
    ).toEqual([
      {
        symbol: "MSFT",
        quoteType: "EQUITY",
        exchange: "NMS",
        currency: "USD",
        timezone: "America/New_York",
        shortName: "Microsoft",
        longName: "Microsoft Corporation",
        firstTradeAt: "1986-03-13T14:30:00.000Z",
        updatedAt: expect.any(String),
        latestQuote: null,
      },
    ]);

    expect(
      db.getInstruments({
        sortBy: "latestQuoteAsOf",
        order: "desc",
        limit: 1,
      }),
    ).toEqual([
      {
        symbol: "AAPL",
        quoteType: "EQUITY",
        exchange: "NMS",
        currency: "USD",
        timezone: "America/New_York",
        shortName: "Apple",
        longName: "Apple Inc.",
        firstTradeAt: "1980-12-12T14:30:00.000Z",
        updatedAt: expect.any(String),
        latestQuote: {
          asOf: "2026-03-18T14:00:00.000Z",
          regularMarketPrice: 215,
          previousClose: 210,
          dayHigh: 216,
          dayLow: 209,
          marketCap: 2,
          regularMarketVolume: 200,
        },
      },
    ]);
  });

  it("コーポレートアクションを条件付きで取得できる", () => {
    db.upsertCorporateActions([
      {
        symbol: "AAPL",
        actionType: "dividend",
        eventAt: "2026-02-01T00:00:00.000Z",
        value: 0.24,
        rawJson: "{}",
      },
      {
        symbol: "AAPL",
        actionType: "split",
        eventAt: "2026-03-01T00:00:00.000Z",
        value: 2,
        rawJson: "{}",
      },
    ]);

    expect(
      db.getCorporateActions({
        symbol: "AAPL",
        actionType: "dividend",
      }),
    ).toEqual([
      {
        symbol: "AAPL",
        actionType: "dividend",
        eventAt: "2026-02-01T00:00:00.000Z",
        value: 0.24,
      },
    ]);
  });

  it("ジョブ実行履歴を保存して JSON を展開して返す", () => {
    const id = db.createSyncJobRun({
      source: "manual",
      startedAt: "2026-03-17T14:00:00.000Z",
      status: "running",
      symbolCount: 2,
    });

    db.finishSyncJobRun({
      id,
      finishedAt: "2026-03-17T14:01:00.000Z",
      status: "success",
      errorMessage: null,
      resultsJson: JSON.stringify([{ symbol: "AAPL" }]),
    });

    expect(db.getSyncJobRuns(1)).toEqual([
      {
        id,
        source: "manual",
        startedAt: "2026-03-17T14:00:00.000Z",
        finishedAt: "2026-03-17T14:01:00.000Z",
        status: "success",
        symbolCount: 2,
        errorMessage: null,
        results: [{ symbol: "AAPL" }],
      },
    ]);
  });
});
