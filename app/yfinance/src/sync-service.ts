import type { YFinanceDatabase } from "./db";
import type { BatchSyncRequest, HistorySyncRequest, QuoteSyncRequest } from "./types";
import type { YahooFinanceClient } from "./yahoo-client";
import { normalizeSymbol, validateHistoryRequest, validateSymbols } from "./utils";

export type SymbolSyncOptions = {
  symbol: string;
  history: Required<HistorySyncRequest>;
  quoteModules?: string[];
  skipQuote?: boolean;
};

export type SymbolSyncResult = {
  symbol: string;
  interval: string;
  barsInserted: number;
  actionsInserted: number;
  quoteSynced: boolean;
  quoteAsOf: string | null;
};

type HistorySyncPayload = Awaited<ReturnType<YahooFinanceClient["syncHistory"]>>;
type QuoteSyncPayload = Awaited<ReturnType<YahooFinanceClient["syncQuote"]>>;

function persistHistoryPayload(db: YFinanceDatabase, history: HistorySyncPayload): void {
  db.upsertInstrument(history.instrument);
  db.upsertPriceBars(history.bars);
  db.upsertCorporateActions(history.actions);
}

function persistQuotePayload(db: YFinanceDatabase, quote: QuoteSyncPayload): void {
  db.upsertInstrument(quote.instrument);
  db.insertQuoteSnapshot(quote.snapshot);
}

function normalizeQuoteModules(modules: string[] | undefined): string[] | undefined {
  return modules?.length ? modules : undefined;
}

export async function syncSymbol(
  db: YFinanceDatabase,
  yahoo: YahooFinanceClient,
  input: SymbolSyncOptions,
): Promise<SymbolSyncResult> {
  const history = await yahoo.syncHistory(input.history);
  persistHistoryPayload(db, history);

  let quoteAsOf: string | null = null;
  let quoteSynced = false;

  if (!input.skipQuote) {
    const quoteRequest: QuoteSyncRequest = {
      symbol: input.symbol,
      modules: input.quoteModules,
    };
    const quote = await syncQuote(db, yahoo, quoteRequest);
    quoteSynced = true;
    quoteAsOf = quote.asOf;
  }

  return {
    symbol: input.symbol,
    interval: input.history.interval,
    barsInserted: history.bars.length,
    actionsInserted: history.actions.length,
    quoteSynced,
    quoteAsOf,
  };
}

export async function syncHistory(
  db: YFinanceDatabase,
  yahoo: YahooFinanceClient,
  body: HistorySyncRequest,
) {
  const input = validateHistoryRequest(body);
  const history = await yahoo.syncHistory(input);
  persistHistoryPayload(db, history);

  return {
    symbol: history.instrument.symbol,
    interval: input.interval,
    barsInserted: history.bars.length,
    actionsInserted: history.actions.length,
  };
}

export async function syncQuote(
  db: YFinanceDatabase,
  yahoo: YahooFinanceClient,
  body: QuoteSyncRequest,
) {
  const symbol = normalizeSymbol(body.symbol);
  const modules = normalizeQuoteModules(body.modules);
  const result = await yahoo.syncQuote(symbol, modules);
  persistQuotePayload(db, result);

  return {
    symbol,
    asOf: result.snapshot.asOf,
  };
}

export async function syncBatch(
  db: YFinanceDatabase,
  yahoo: YahooFinanceClient,
  body: BatchSyncRequest,
) {
  const symbols = validateSymbols(body.symbols);
  const baseHistory = validateHistoryRequest({
    symbol: symbols[0],
    interval: body.interval,
    range: body.range,
    start: body.start,
    end: body.end,
    includePrePost: body.includePrePost,
  });

  const results: SymbolSyncResult[] = [];
  for (const symbol of symbols) {
    results.push(
      await syncSymbol(db, yahoo, {
        symbol,
        history: { ...baseHistory, symbol },
        quoteModules: body.modules,
        skipQuote: body.skipQuote,
      }),
    );
  }

  return {
    count: results.length,
    results,
  };
}
