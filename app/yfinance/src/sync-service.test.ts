import { describe, expect, it } from "bun:test";
import { HttpError } from "./utils";
import { syncBatch, syncHistory, syncQuote, syncSymbol } from "./sync-service";

function createFakeDb() {
  const calls = {
    upsertInstrument: [] as unknown[],
    upsertPriceBars: [] as unknown[],
    upsertCorporateActions: [] as unknown[],
    insertQuoteSnapshot: [] as unknown[],
  };

  return {
    calls,
    db: {
      upsertInstrument(value: unknown) {
        calls.upsertInstrument.push(value);
      },
      upsertPriceBars(value: unknown) {
        calls.upsertPriceBars.push(value);
      },
      upsertCorporateActions(value: unknown) {
        calls.upsertCorporateActions.push(value);
      },
      insertQuoteSnapshot(value: unknown) {
        calls.insertQuoteSnapshot.push(value);
      },
    },
  };
}

function createFakeYahoo() {
  const historyCalls: unknown[] = [];
  const quoteCalls: unknown[] = [];

  return {
    historyCalls,
    quoteCalls,
    yahoo: {
      async syncHistory(input: unknown) {
        historyCalls.push(input);
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
          actions: [{ symbol: "AAPL" }],
        };
      },
      async syncQuote(symbol: string, modules?: string[]) {
        quoteCalls.push({ symbol, modules });
        return {
          instrument: {
            symbol,
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
            symbol,
            asOf: "2026-03-17T14:00:00.000Z",
            regularMarketPrice: 100,
            previousClose: 99,
            dayHigh: 101,
            dayLow: 98,
            marketCap: 123,
            regularMarketVolume: 456,
            rawJson: "{}",
          },
        };
      },
    },
  };
}

describe("sync-service", () => {
  it("syncHistory は取得結果を DB に保存する", async () => {
    const fakeDb = createFakeDb();
    const fakeYahoo = createFakeYahoo();

    const result = await syncHistory(fakeDb.db as any, fakeYahoo.yahoo as any, { symbol: "aapl" });

    expect(result).toEqual({
      symbol: "AAPL",
      interval: "1d",
      barsInserted: 1,
      actionsInserted: 1,
    });
    expect(fakeDb.calls.upsertInstrument).toHaveLength(1);
    expect(fakeDb.calls.upsertPriceBars).toHaveLength(1);
    expect(fakeDb.calls.upsertCorporateActions).toHaveLength(1);
  });

  it("syncQuote は symbol を正規化して保存する", async () => {
    const fakeDb = createFakeDb();
    const fakeYahoo = createFakeYahoo();

    const result = await syncQuote(fakeDb.db as any, fakeYahoo.yahoo as any, { symbol: " msft " });

    expect(result).toEqual({
      symbol: "MSFT",
      asOf: "2026-03-17T14:00:00.000Z",
    });
    expect(fakeYahoo.quoteCalls).toEqual([{ symbol: "MSFT", modules: undefined }]);
    expect(fakeDb.calls.insertQuoteSnapshot).toHaveLength(1);
  });

  it("syncSymbol は skipQuote=true のとき quote を同期しない", async () => {
    const fakeDb = createFakeDb();
    const fakeYahoo = createFakeYahoo();

    const result = await syncSymbol(fakeDb.db as any, fakeYahoo.yahoo as any, {
      symbol: "AAPL",
      history: {
        symbol: "AAPL",
        interval: "1d",
        range: "1mo",
        start: "",
        end: "",
        includePrePost: false,
      },
      skipQuote: true,
    });

    expect(result.quoteSynced).toBe(false);
    expect(result.quoteAsOf).toBeNull();
    expect(fakeYahoo.quoteCalls).toHaveLength(0);
  });

  it("syncBatch は複数銘柄を順に同期する", async () => {
    const fakeDb = createFakeDb();
    const fakeYahoo = createFakeYahoo();

    const result = await syncBatch(fakeDb.db as any, fakeYahoo.yahoo as any, {
      symbols: ["aapl", "msft", "AAPL"],
      interval: "1d",
      range: "5d",
      modules: ["price"],
    });

    expect(result.count).toBe(2);
    expect(result.results.map((entry) => entry.symbol)).toEqual(["AAPL", "MSFT"]);
    expect(fakeYahoo.historyCalls).toHaveLength(2);
    expect(fakeYahoo.quoteCalls).toEqual([
      { symbol: "AAPL", modules: ["price"] },
      { symbol: "MSFT", modules: ["price"] },
    ]);
  });

  it("syncBatch は symbols 未指定を拒否する", async () => {
    const fakeDb = createFakeDb();
    const fakeYahoo = createFakeYahoo();

    await expect(
      syncBatch(fakeDb.db as any, fakeYahoo.yahoo as any, {
        symbols: [],
      }),
    ).rejects.toThrow(HttpError);
  });
});
