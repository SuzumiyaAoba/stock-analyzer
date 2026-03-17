import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { HttpError } from "./utils";
import { YahooFinanceClient } from "./yahoo-client";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("YahooFinanceClient", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("syncHistory は chart レスポンスを価格バーへ変換する", async () => {
    const responses = [
      new Response("", {
        headers: { "set-cookie": "A3=cookie-value; Path=/; HttpOnly" },
      }),
      new Response("crumb-value"),
      jsonResponse({
        chart: {
          result: [
            {
              meta: {
                instrumentType: "EQUITY",
                exchangeName: "NMS",
                currency: "USD",
                exchangeTimezoneName: "America/New_York",
                shortName: "Apple",
                longName: "Apple Inc.",
                firstTradeDate: 345479400,
              },
              timestamp: [1700000000, 1700086400],
              indicators: {
                quote: [
                  {
                    open: [100, 101],
                    high: [110, 111],
                    low: [90, 91],
                    close: [105, 106],
                    volume: [1000, 2000],
                  },
                ],
                adjclose: [{ adjclose: [104, 105] }],
              },
              events: {
                dividends: {
                  a: {
                    date: 1700000000,
                    amount: 0.24,
                  },
                },
              },
            },
          ],
          error: null,
        },
      }),
    ];

    fetchSpy.mockImplementation(mock(async () => responses.shift()!));

    const client = new YahooFinanceClient();
    const result = await client.syncHistory({
      symbol: "AAPL",
      interval: "1d",
      range: "1mo",
    });

    expect(result.instrument).toMatchObject({
      symbol: "AAPL",
      quoteType: "EQUITY",
      exchange: "NMS",
    });
    expect(result.bars).toHaveLength(2);
    expect(result.actions).toEqual([
      {
        symbol: "AAPL",
        actionType: "dividend",
        eventAt: new Date(1700000000 * 1000).toISOString(),
        value: 0.24,
        rawJson: JSON.stringify({ date: 1700000000, amount: 0.24 }),
      },
    ]);
  });

  it("syncQuote は quoteSummary レスポンスを正規化する", async () => {
    const responses = [
      new Response("", {
        headers: { "set-cookie": "A3=cookie-value; Path=/; HttpOnly" },
      }),
      new Response("crumb-value"),
      jsonResponse({
        quoteSummary: {
          result: [
            {
              price: {
                quoteType: { raw: "EQUITY" },
                exchange: { raw: "NMS" },
                currency: { raw: "USD" },
                shortName: { raw: "Apple" },
                longName: { raw: "Apple Inc." },
                regularMarketPrice: { raw: 123 },
                regularMarketTime: { raw: 1700000000 },
                regularMarketVolume: { raw: 456 },
                regularMarketPreviousClose: { raw: 120 },
                regularMarketDayHigh: { raw: 124 },
                regularMarketDayLow: { raw: 119 },
                marketCap: { raw: 789 },
              },
              quoteType: {
                exchangeTimezoneName: { raw: "America/New_York" },
              },
            },
          ],
          error: null,
        },
      }),
    ];

    fetchSpy.mockImplementation(mock(async () => responses.shift()!));

    const client = new YahooFinanceClient();
    const result = await client.syncQuote("AAPL");

    expect(result.instrument).toMatchObject({
      symbol: "AAPL",
      quoteType: "EQUITY",
      timezone: "America/New_York",
    });
    expect(result.snapshot).toMatchObject({
      symbol: "AAPL",
      regularMarketPrice: 123,
      marketCap: 789,
    });
  });

  it("syncQuote は不正レスポンスで HttpError を投げる", async () => {
    const responses = [
      new Response("", {
        headers: { "set-cookie": "A3=cookie-value; Path=/; HttpOnly" },
      }),
      new Response("crumb-value"),
      jsonResponse({
        quoteSummary: {
          result: null,
          error: {
            description: "not found",
          },
        },
      }),
    ];

    fetchSpy.mockImplementation(mock(async () => responses.shift()!));

    const client = new YahooFinanceClient();
    await expect(client.syncQuote("AAPL")).rejects.toThrow(HttpError);
  });

  it("認証 cookie が取得できないときは HttpError を投げる", async () => {
    fetchSpy.mockImplementation(
      mock(async () => new Response("", { headers: { "content-type": "text/plain" } })),
    );

    const client = new YahooFinanceClient();
    await expect(
      client.syncHistory({
        symbol: "AAPL",
        interval: "1d",
        range: "1mo",
      }),
    ).rejects.toThrow(HttpError);
  });
});
