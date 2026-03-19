import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formatHttpErrorMessage } from "./api-error";
import { dashboardSearchSchema, type DashboardSearch } from "./dashboard-config";

const API_TIMEOUT_MS = 10_000;

const syncSymbolSchema = z.object({
  symbol: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().min(1, "symbol は必須です")),
});

const batchSyncInputSchema = z
  .object({
    symbolsText: z.string().trim().min(1, "symbols は必須です"),
    interval: z.enum(["1d", "5d", "1wk", "1mo", "3mo"]),
    range: z.enum(["5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max"]),
    includePrePost: z.boolean().optional().default(false),
    skipQuote: z.boolean().optional().default(false),
  })
  .transform((input, ctx) => {
    const symbols = [
      ...new Set(
        input.symbolsText
          .split(/[\s,]+/)
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    if (symbols.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "symbols は1件以上必要です",
      });
      return z.NEVER;
    }

    return {
      symbols,
      interval: input.interval,
      range: input.range,
      includePrePost: input.includePrePost,
      skipQuote: input.skipQuote,
    };
  });

const nullableNumberSchema = z.number().finite().nullable();
const nullableStringSchema = z.string().nullable();

const latestQuoteSchema = z.object({
  asOf: z.string(),
  regularMarketPrice: nullableNumberSchema,
  previousClose: nullableNumberSchema,
  dayHigh: nullableNumberSchema,
  dayLow: nullableNumberSchema,
  marketCap: nullableNumberSchema,
  regularMarketVolume: nullableNumberSchema,
});

const instrumentSchema = z.object({
  symbol: z.string(),
  quoteType: nullableStringSchema,
  exchange: nullableStringSchema,
  currency: nullableStringSchema,
  timezone: nullableStringSchema,
  shortName: nullableStringSchema,
  longName: nullableStringSchema,
  firstTradeAt: nullableStringSchema,
  updatedAt: z.string(),
  latestQuote: latestQuoteSchema.nullable(),
});

const instrumentsResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(instrumentSchema),
});

const priceBarSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  timestampUtc: z.string(),
  open: nullableNumberSchema,
  high: nullableNumberSchema,
  low: nullableNumberSchema,
  close: nullableNumberSchema,
  adjClose: nullableNumberSchema,
  volume: nullableNumberSchema,
});

const pricesResponseSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  count: z.number().int().nonnegative(),
  prices: z.array(priceBarSchema),
});

const corporateActionSchema = z.object({
  symbol: z.string(),
  actionType: z.enum(["dividend", "split", "capitalGain"]),
  eventAt: z.string(),
  value: nullableNumberSchema,
});

const corporateActionsResponseSchema = z.object({
  symbol: z.string(),
  actionType: nullableStringSchema,
  count: z.number().int().nonnegative(),
  actions: z.array(corporateActionSchema),
});

const healthResponseSchema = z.object({
  ok: z.boolean(),
});

const symbolSyncResultSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  barsInserted: z.number().int().nonnegative(),
  actionsInserted: z.number().int().nonnegative(),
  quoteSynced: z.boolean(),
  quoteAsOf: nullableStringSchema,
});

const batchSyncResultSchema = z.object({
  count: z.number().int().nonnegative(),
  results: z.array(symbolSyncResultSchema),
});

const syncJobStateSchema = z.object({
  enabled: z.boolean(),
  isRunning: z.boolean(),
  symbols: z.array(z.string()),
  intervalMs: z.number().int().nonnegative(),
  historyInterval: z.string(),
  historyRange: z.string(),
  includePrePost: z.boolean(),
  lastRunStartedAt: nullableStringSchema,
  lastRunFinishedAt: nullableStringSchema,
  lastRunError: nullableStringSchema,
  lastRunResults: z.array(symbolSyncResultSchema),
});

const syncJobRunSchema = z.object({
  id: z.number().int().nonnegative(),
  source: z.string(),
  startedAt: z.string(),
  finishedAt: nullableStringSchema,
  status: z.string(),
  symbolCount: z.number().int().nonnegative(),
  errorMessage: nullableStringSchema,
  results: z.array(symbolSyncResultSchema),
});

const syncRunsResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  runs: z.array(syncJobRunSchema),
});

const screenerInstrumentSchema = z.object({
  symbol: z.string(),
  quoteType: nullableStringSchema,
  exchange: nullableStringSchema,
  currency: nullableStringSchema,
  shortName: nullableStringSchema,
  longName: nullableStringSchema,
  regularMarketPrice: nullableNumberSchema,
  regularMarketChangePercent: nullableNumberSchema,
  marketCap: nullableNumberSchema,
  rawJson: z.string(),
});

const screenerResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(screenerInstrumentSchema),
});

export type InstrumentListItem = z.infer<typeof instrumentSchema>;
export type InstrumentDetail = InstrumentListItem;
export type PriceBar = z.infer<typeof priceBarSchema>;
export type CorporateAction = z.infer<typeof corporateActionSchema>;
export type SymbolSyncResult = z.infer<typeof symbolSyncResultSchema>;
export type BatchSyncResult = z.infer<typeof batchSyncResultSchema>;
export type SyncJobState = z.infer<typeof syncJobStateSchema>;
export type SyncJobRun = z.infer<typeof syncJobRunSchema>;
export type ScreenerInstrument = z.infer<typeof screenerInstrumentSchema>;

export type ApiHealth = {
  ok: boolean;
  errorMessage: string | null;
};

export type DashboardData = {
  search: DashboardSearch;
  instruments: InstrumentListItem[];
  japanMarketInstruments: ScreenerInstrument[];
  japanMarketErrorMessage: string | null;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  selectedSymbol: string | null;
  selectedInstrument: InstrumentDetail | null;
  prices: PriceBar[];
  actions: CorporateAction[];
  apiBaseUrl: string;
  apiHealth: ApiHealth;
  syncJob: SyncJobState | null;
  syncRuns: SyncJobRun[];
  errorMessage: string | null;
};

function getApiBaseUrl() {
  return process.env.YFINANCE_API_BASE_URL || "http://127.0.0.1:3000";
}

function formatZodError(error: z.ZodError) {
  return error.issues[0]?.message ?? "レスポンスの形式が不正です";
}

function toApiErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return `API レスポンスが不正です: ${formatZodError(error)}`;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return `API リクエストが ${Math.round(API_TIMEOUT_MS / 1000)} 秒でタイムアウトしました`;
  }

  return error instanceof Error ? error.message : "不明なエラー";
}

function buildDateRangeQuery(search: DashboardSearch, query: URLSearchParams) {
  if (search.from) {
    query.set("from", `${search.from}T00:00:00.000Z`);
  }

  if (search.to) {
    query.set("to", `${search.to}T23:59:59.999Z`);
  }
}

function createTimeoutSignal() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

async function requestJson<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const timeout = createTimeoutSignal();
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: timeout.signal,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        formatHttpErrorMessage(
          response.status,
          response.statusText,
          message,
          response.headers.get("content-type"),
        ),
      );
    }

    const payload = (await response.json()) as unknown;
    return schema.parse(payload);
  } finally {
    timeout.clear();
  }
}

function fetchJson<T>(path: string, schema: z.ZodType<T>) {
  return requestJson(path, schema);
}

function postJson<T>(path: string, schema: z.ZodType<T>, body: unknown): Promise<T> {
  return requestJson(path, schema, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export const syncInstrument = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => syncSymbolSchema.parse(input))
  .handler(async ({ data }) => {
    const input = syncSymbolSchema.parse(data);

    await Promise.all([
      postJson("/api/v1/sync/history", z.unknown(), {
        symbol: input.symbol,
        interval: "1d",
        range: "6mo",
      }),
      postJson("/api/v1/sync/history", z.unknown(), {
        symbol: input.symbol,
        interval: "1wk",
        range: "2y",
      }),
      postJson("/api/v1/sync/history", z.unknown(), {
        symbol: input.symbol,
        interval: "1mo",
        range: "5y",
      }),
      postJson("/api/v1/sync/quote", z.unknown(), {
        symbol: input.symbol,
      }),
    ]);

    return {
      symbol: input.symbol,
    };
  });

export const syncBatchInstruments = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => batchSyncInputSchema.parse(input))
  .handler(async ({ data }) => {
    const input = batchSyncInputSchema.parse(data);
    return postJson("/api/v1/sync/batch", batchSyncResultSchema, input);
  });

export const runSyncJobNow = createServerFn({
  method: "POST",
}).handler(async () => {
  return requestJson("/api/v1/jobs/sync/run", syncJobStateSchema, {
    method: "POST",
  });
});

export const getDashboardData = createServerFn({
  method: "GET",
})
  .inputValidator((input: unknown) => dashboardSearchSchema.parse(input))
  .handler(async ({ data }): Promise<DashboardData> => {
    const search = dashboardSearchSchema.parse(data);
    const instrumentsQuery = new URLSearchParams({
      limit: String(search.listLimit),
      offset: String(search.offset),
      sortBy: search.sortBy,
      order: search.order,
    });

    if (search.q) {
      instrumentsQuery.set("q", search.q);
    }

    const [healthResult, instrumentsResult, japanMarketResult, syncJobResult, syncRunsResult] =
      await Promise.allSettled([
        fetchJson("/healthz", healthResponseSchema),
        fetchJson(`/api/v1/instruments?${instrumentsQuery.toString()}`, instrumentsResponseSchema),
        fetchJson(
          "/api/v1/yahoo/screener?exchange=TSE&region=jp&quoteType=EQUITY&count=12&offset=0",
          screenerResponseSchema,
        ),
        fetchJson("/api/v1/jobs/sync", syncJobStateSchema),
        fetchJson(`/api/v1/jobs/sync/runs?limit=${search.runsLimit}`, syncRunsResponseSchema),
      ]);

    const apiHealth: ApiHealth =
      healthResult.status === "fulfilled"
        ? { ok: healthResult.value.ok, errorMessage: null }
        : { ok: false, errorMessage: toApiErrorMessage(healthResult.reason) };

    const syncJob = syncJobResult.status === "fulfilled" ? syncJobResult.value : null;
    const syncRuns = syncRunsResult.status === "fulfilled" ? syncRunsResult.value.runs : [];
    const japanMarketInstruments =
      japanMarketResult.status === "fulfilled" ? japanMarketResult.value.items : [];
    const japanMarketErrorMessage =
      japanMarketResult.status === "rejected" ? toApiErrorMessage(japanMarketResult.reason) : null;

    if (instrumentsResult.status === "rejected") {
      return {
        search,
        instruments: [],
        japanMarketInstruments,
        japanMarketErrorMessage,
        hasPreviousPage: search.offset > 0,
        hasNextPage: false,
        selectedSymbol: null,
        selectedInstrument: null,
        prices: [],
        actions: [],
        apiBaseUrl: getApiBaseUrl(),
        apiHealth,
        syncJob,
        syncRuns,
        errorMessage: `API を取得できませんでした: ${toApiErrorMessage(instrumentsResult.reason)}`,
      };
    }

    const instrumentsResponse = instrumentsResult.value;
    const normalizedQuery = search.q?.toUpperCase();
    const selectedSymbol =
      search.symbol ||
      instrumentsResponse.items.find((item) =>
        normalizedQuery ? item.symbol.includes(normalizedQuery) : false,
      )?.symbol ||
      instrumentsResponse.items[0]?.symbol ||
      null;

    if (!selectedSymbol) {
      return {
        search,
        instruments: instrumentsResponse.items,
        japanMarketInstruments,
        japanMarketErrorMessage,
        hasPreviousPage: search.offset > 0,
        hasNextPage: instrumentsResponse.items.length >= search.listLimit,
        selectedSymbol: null,
        selectedInstrument: null,
        prices: [],
        actions: [],
        apiBaseUrl: getApiBaseUrl(),
        apiHealth,
        syncJob,
        syncRuns,
        errorMessage: null,
      };
    }

    const pricesQuery = new URLSearchParams({
      symbol: selectedSymbol,
      interval: search.interval,
      limit: String(search.priceLimit),
    });
    buildDateRangeQuery(search, pricesQuery);

    const actionsQuery = new URLSearchParams({
      symbol: selectedSymbol,
      limit: String(search.actionLimit),
    });
    if (search.actionType !== "all") {
      actionsQuery.set("type", search.actionType);
    }
    buildDateRangeQuery(search, actionsQuery);

    const [selectedInstrument, pricesResponse, actionsResponse] = await Promise.all([
      fetchJson(
        `/api/v1/instruments/${encodeURIComponent(selectedSymbol)}`,
        instrumentSchema,
      ).catch(() => null),
      fetchJson(`/api/v1/prices?${pricesQuery.toString()}`, pricesResponseSchema).catch(() => ({
        symbol: selectedSymbol,
        interval: search.interval,
        count: 0,
        prices: [],
      })),
      fetchJson(`/api/v1/actions?${actionsQuery.toString()}`, corporateActionsResponseSchema).catch(
        () => ({
          symbol: selectedSymbol,
          actionType: null,
          count: 0,
          actions: [],
        }),
      ),
    ]);

    return {
      search,
      instruments: instrumentsResponse.items,
      japanMarketInstruments,
      japanMarketErrorMessage,
      hasPreviousPage: search.offset > 0,
      hasNextPage: instrumentsResponse.items.length >= search.listLimit,
      selectedSymbol,
      selectedInstrument,
      prices: pricesResponse.prices,
      actions: actionsResponse.actions,
      apiBaseUrl: getApiBaseUrl(),
      apiHealth,
      syncJob,
      syncRuns,
      errorMessage: null,
    };
  });
