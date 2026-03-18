import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const dashboardSearchSchema = z.object({
  q: z.string().optional().default(""),
  symbol: z.string().optional(),
  interval: z.enum(["1d", "1wk", "1mo"]).default("1d"),
});

const syncSymbolSchema = z.object({
  symbol: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().min(1, "symbol は必須です")),
});

type DashboardSearch = z.infer<typeof dashboardSearchSchema>;

type InstrumentListItem = {
  symbol: string;
  quoteType: string | null;
  exchange: string | null;
  currency: string | null;
  timezone: string | null;
  shortName: string | null;
  longName: string | null;
  firstTradeAt: string | null;
  updatedAt: string;
  latestQuote: {
    asOf: string;
    regularMarketPrice: number | null;
    previousClose: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    marketCap: number | null;
    regularMarketVolume: number | null;
  } | null;
};

type InstrumentsResponse = {
  count: number;
  items: InstrumentListItem[];
};

type InstrumentDetail = InstrumentListItem;

type PriceBar = {
  symbol: string;
  interval: string;
  timestampUtc: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjClose: number | null;
  volume: number | null;
};

type PricesResponse = {
  symbol: string;
  interval: string;
  count: number;
  prices: PriceBar[];
};

type CorporateAction = {
  symbol: string;
  actionType: "dividend" | "split" | "capitalGain";
  eventAt: string;
  value: number | null;
};

type CorporateActionsResponse = {
  symbol: string;
  actionType: string | null;
  count: number;
  actions: CorporateAction[];
};

export type DashboardData = {
  search: DashboardSearch;
  instruments: InstrumentListItem[];
  selectedSymbol: string | null;
  selectedInstrument: InstrumentDetail | null;
  prices: PriceBar[];
  actions: CorporateAction[];
  apiBaseUrl: string;
  errorMessage: string | null;
};

function getApiBaseUrl() {
  return process.env.YFINANCE_API_BASE_URL || "http://127.0.0.1:3000";
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("not_found");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`yfinance request failed: ${response.status} ${message.slice(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`yfinance request failed: ${response.status} ${message.slice(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

export const syncInstrument = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => syncSymbolSchema.parse(input))
  .handler(async ({ data }) => {
    const input = syncSymbolSchema.parse(data);
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    } satisfies RequestInit;

    await Promise.all([
      requestJson("/api/v1/sync/history", {
        ...requestOptions,
        body: JSON.stringify({
          symbol: input.symbol,
          interval: "1d",
          range: "6mo",
        }),
      }),
      requestJson("/api/v1/sync/history", {
        ...requestOptions,
        body: JSON.stringify({
          symbol: input.symbol,
          interval: "1wk",
          range: "2y",
        }),
      }),
      requestJson("/api/v1/sync/history", {
        ...requestOptions,
        body: JSON.stringify({
          symbol: input.symbol,
          interval: "1mo",
          range: "5y",
        }),
      }),
      requestJson("/api/v1/sync/quote", {
        ...requestOptions,
        body: JSON.stringify({
          symbol: input.symbol,
        }),
      }),
    ]);

    return {
      symbol: input.symbol,
    };
  });

export const getDashboardData = createServerFn({
  method: "GET",
})
  .inputValidator((input: unknown) => dashboardSearchSchema.parse(input))
  .handler(async ({ data }): Promise<DashboardData> => {
    const search = dashboardSearchSchema.parse(data);
    const query = new URLSearchParams({
      limit: "18",
      sortBy: "latestQuoteAsOf",
      order: "desc",
    });

    if (search.q) {
      query.set("q", search.q);
    }

    let instrumentsResponse: InstrumentsResponse;
    try {
      instrumentsResponse = await fetchJson<InstrumentsResponse>(
        `/api/v1/instruments?${query.toString()}`,
      );
    } catch (error) {
      return {
        search,
        instruments: [],
        selectedSymbol: null,
        selectedInstrument: null,
        prices: [],
        actions: [],
        apiBaseUrl: getApiBaseUrl(),
        errorMessage:
          error instanceof Error
            ? `API を取得できませんでした: ${error.message}`
            : "API を取得できませんでした",
      };
    }

    const selectedSymbol =
      search.symbol ||
      instrumentsResponse.items.find((item) => item.symbol.includes(search.q.toUpperCase()))
        ?.symbol ||
      instrumentsResponse.items[0]?.symbol ||
      null;

    if (!selectedSymbol) {
      return {
        search,
        instruments: instrumentsResponse.items,
        selectedSymbol: null,
        selectedInstrument: null,
        prices: [],
        actions: [],
        apiBaseUrl: getApiBaseUrl(),
        errorMessage: null,
      };
    }

    const [selectedInstrument, pricesResponse, actionsResponse] = await Promise.all([
      fetchJson<InstrumentDetail>(
        `/api/v1/instruments/${encodeURIComponent(selectedSymbol)}`,
      ).catch(() => null),
      fetchJson<PricesResponse>(
        `/api/v1/prices?symbol=${encodeURIComponent(selectedSymbol)}&interval=${search.interval}&limit=60`,
      ).catch(() => ({ symbol: selectedSymbol, interval: search.interval, count: 0, prices: [] })),
      fetchJson<CorporateActionsResponse>(
        `/api/v1/actions?symbol=${encodeURIComponent(selectedSymbol)}&limit=6`,
      ).catch(() => ({ symbol: selectedSymbol, actionType: null, count: 0, actions: [] })),
    ]);

    return {
      search,
      instruments: instrumentsResponse.items,
      selectedSymbol,
      selectedInstrument,
      prices: pricesResponse.prices,
      actions: actionsResponse.actions,
      apiBaseUrl: getApiBaseUrl(),
      errorMessage: null,
    };
  });
