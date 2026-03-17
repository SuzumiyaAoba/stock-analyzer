import { HttpError, asNumber, isObject, toIsoUtc, unwrapYahooValue } from "./utils";
import type {
  ChartSyncResult,
  CorporateActionRecord,
  InstrumentRecord,
  PriceBarRecord,
  QuoteSnapshotRecord,
  QuoteSyncResult,
} from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const CHART_BASE_URL = "https://query2.finance.yahoo.com/v8/finance/chart";
const QUOTE_SUMMARY_BASE_URL = "https://query2.finance.yahoo.com/v10/finance/quoteSummary";
const DEFAULT_QUOTE_MODULES = ["price", "summaryDetail", "quoteType"] as const;

type ChartMeta = Record<string, unknown>;

export class YahooFinanceClient {
  private cookieHeader: string | null = null;
  private crumb: string | null = null;

  async syncHistory(input: {
    symbol: string;
    interval: string;
    range?: string;
    start?: string;
    end?: string;
    includePrePost?: boolean;
  }): Promise<ChartSyncResult> {
    const params = new URLSearchParams();
    params.set("interval", input.interval);
    params.set("includePrePost", String(input.includePrePost ?? false));
    params.set("events", "div,splits,capitalGains");

    if (input.range) {
      params.set("range", input.range);
    } else {
      if (input.start) {
        params.set("period1", String(Math.floor(new Date(input.start).getTime() / 1000)));
      }
      if (input.end) {
        params.set("period2", String(Math.floor(new Date(input.end).getTime() / 1000)));
      }
    }

    const payload = await this.requestJson(
      `${CHART_BASE_URL}/${encodeURIComponent(input.symbol)}`,
      params,
    );

    const chart = payload.chart;
    const result = chart?.result?.[0];
    if (!result) {
      const description = chart?.error?.description;
      throw new HttpError(502, description || "Yahoo Finance から価格データを取得できませんでした");
    }

    const meta = isObject(result.meta) ? result.meta : {};
    return {
      instrument: this.buildInstrumentFromChart(input.symbol, meta),
      bars: this.buildBars(input.symbol, input.interval, result),
      actions: this.buildCorporateActions(input.symbol, result.events),
    };
  }

  async syncQuote(symbol: string, modules = [...DEFAULT_QUOTE_MODULES]): Promise<QuoteSyncResult> {
    const params = new URLSearchParams();
    params.set("modules", modules.join(","));

    const payload = await this.requestJson(
      `${QUOTE_SUMMARY_BASE_URL}/${encodeURIComponent(symbol)}`,
      params,
    );

    const result = payload.quoteSummary?.result?.[0];
    if (!result) {
      const description = payload.quoteSummary?.error?.description;
      throw new HttpError(502, description || "Yahoo Finance から銘柄情報を取得できませんでした");
    }

    const flattened = unwrapYahooValue(result);
    if (!isObject(flattened)) {
      throw new HttpError(502, "Yahoo Finance のレスポンス形式が想定外です");
    }

    const merged = Object.assign(
      {},
      isObject(flattened.quoteType) ? flattened.quoteType : {},
      isObject(flattened.price) ? flattened.price : {},
      isObject(flattened.summaryDetail) ? flattened.summaryDetail : {},
      isObject(flattened.defaultKeyStatistics) ? flattened.defaultKeyStatistics : {},
      isObject(flattened.financialData) ? flattened.financialData : {},
    ) as Record<string, unknown>;

    const snapshotAt = asNumber(merged.regularMarketTime)
      ? toIsoUtc(merged.regularMarketTime as number)
      : new Date().toISOString();

    const snapshot: QuoteSnapshotRecord = {
      symbol,
      asOf: snapshotAt,
      regularMarketPrice:
        asNumber(merged.regularMarketPrice) ?? asNumber(merged.currentPrice),
      previousClose:
        asNumber(merged.regularMarketPreviousClose) ?? asNumber(merged.previousClose),
      dayHigh: asNumber(merged.regularMarketDayHigh) ?? asNumber(merged.dayHigh),
      dayLow: asNumber(merged.regularMarketDayLow) ?? asNumber(merged.dayLow),
      marketCap: asNumber(merged.marketCap),
      regularMarketVolume:
        asNumber(merged.regularMarketVolume) ?? asNumber(merged.volume),
      rawJson: JSON.stringify(flattened),
    };

    const instrument: InstrumentRecord = {
      symbol,
      quoteType: stringOrNull(merged.quoteType),
      exchange: stringOrNull(merged.exchange) ?? stringOrNull(merged.exchangeName),
      currency: stringOrNull(merged.currency),
      timezone: stringOrNull(merged.exchangeTimezoneName),
      shortName: stringOrNull(merged.shortName),
      longName: stringOrNull(merged.longName),
      firstTradeAt: null,
      rawJson: JSON.stringify(flattened),
    };

    return { instrument, snapshot };
  }

  private async requestJson(url: string, params: URLSearchParams, retry = true): Promise<any> {
    await this.ensureAuth();
    params.set("crumb", this.crumb!);

    const response = await fetch(`${url}?${params.toString()}`, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        Cookie: this.cookieHeader!,
        "User-Agent": USER_AGENT,
      },
    });

    if (
      retry &&
      (response.status === 401 ||
        response.status === 403 ||
        response.status === 429 ||
        response.url.includes("consent.yahoo.com"))
    ) {
      this.cookieHeader = null;
      this.crumb = null;
      return this.requestJson(url, new URLSearchParams(params), false);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new HttpError(
        response.status === 429 ? 429 : 502,
        `Yahoo Finance request failed: ${response.status} ${body.slice(0, 200)}`,
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      const body = await response.text();
      throw new HttpError(502, `Yahoo Finance が JSON を返しませんでした: ${body.slice(0, 200)}`);
    }

    return response.json();
  }

  private async ensureAuth(): Promise<void> {
    if (this.cookieHeader && this.crumb) {
      return;
    }

    const cookieResponse = await fetch("https://fc.yahoo.com", {
      headers: {
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
    });

    const setCookie = cookieResponse.headers.get("set-cookie");
    if (!setCookie) {
      throw new HttpError(502, "Yahoo Finance の cookie を取得できませんでした");
    }

    const cookiePair = setCookie.split(";")[0]?.trim();
    if (!cookiePair) {
      throw new HttpError(502, "Yahoo Finance の cookie 形式が不正です");
    }

    this.cookieHeader = cookiePair;

    const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        Cookie: this.cookieHeader,
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
    });

    const crumbBody = (await crumbResponse.text()).trim();
    if (
      !crumbResponse.ok ||
      !crumbBody ||
      crumbBody.startsWith("{") ||
      crumbBody.includes("Too Many Requests")
    ) {
      throw new HttpError(502, "Yahoo Finance の crumb を取得できませんでした");
    }

    this.crumb = crumbBody;
  }

  private buildInstrumentFromChart(symbol: string, meta: ChartMeta): InstrumentRecord {
    const firstTrade = asNumber(meta.firstTradeDate);
    return {
      symbol,
      quoteType: stringOrNull(meta.instrumentType),
      exchange: stringOrNull(meta.exchangeName),
      currency: stringOrNull(meta.currency),
      timezone: stringOrNull(meta.exchangeTimezoneName),
      shortName: stringOrNull(meta.shortName),
      longName: stringOrNull(meta.longName),
      firstTradeAt: firstTrade ? toIsoUtc(firstTrade) : null,
      rawJson: JSON.stringify(meta),
    };
  }

  private buildBars(symbol: string, interval: string, result: Record<string, any>): PriceBarRecord[] {
    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const adjclose = result.indicators?.adjclose?.[0]?.adjclose ?? [];

    return timestamps.flatMap((timestamp: unknown, index: number) => {
      if (typeof timestamp !== "number") {
        return [];
      }

      const bar: PriceBarRecord = {
        symbol,
        interval,
        timestampUtc: toIsoUtc(timestamp),
        open: asNumber(quote.open?.[index]),
        high: asNumber(quote.high?.[index]),
        low: asNumber(quote.low?.[index]),
        close: asNumber(quote.close?.[index]),
        adjClose: asNumber(adjclose[index]),
        volume: asNumber(quote.volume?.[index]),
      };

      if (
        bar.open === null &&
        bar.high === null &&
        bar.low === null &&
        bar.close === null &&
        bar.adjClose === null &&
        bar.volume === null
      ) {
        return [];
      }

      return [bar];
    });
  }

  private buildCorporateActions(symbol: string, events: Record<string, any> | undefined): CorporateActionRecord[] {
    if (!isObject(events)) {
      return [];
    }

    const records: CorporateActionRecord[] = [];
    records.push(...this.extractActionMap(symbol, "dividend", events.dividends, "amount"));
    records.push(...this.extractActionMap(symbol, "capitalGain", events.capitalGains, "amount"));
    records.push(...this.extractActionMap(symbol, "split", events.splits, "numerator", "denominator"));
    return records;
  }

  private extractActionMap(
    symbol: string,
    actionType: CorporateActionRecord["actionType"],
    rawMap: unknown,
    numeratorKey: string,
    denominatorKey?: string,
  ): CorporateActionRecord[] {
    if (!isObject(rawMap)) {
      return [];
    }

    return Object.values(rawMap).flatMap((entry) => {
      if (!isObject(entry)) {
        return [];
      }

      const dateValue = asNumber(entry.date);
      if (!dateValue) {
        return [];
      }

      let value = asNumber(entry[numeratorKey]);
      if (denominatorKey) {
        const denominator = asNumber(entry[denominatorKey]);
        value = value !== null && denominator ? value / denominator : null;
      }

      return [
        {
          symbol,
          actionType,
          eventAt: toIsoUtc(dateValue),
          value,
          rawJson: JSON.stringify(entry),
        },
      ];
    });
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
