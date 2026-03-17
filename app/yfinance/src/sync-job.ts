import type { YFinanceDatabase } from "./db";
import type { YahooFinanceClient } from "./yahoo-client";

type SyncJobConfig = {
  enabled: boolean;
  symbols: string[];
  intervalMs: number;
  historyInterval: string;
  historyRange: string;
  includePrePost: boolean;
  runOnStart: boolean;
};

type SymbolRunResult = {
  symbol: string;
  barsInserted: number;
  actionsInserted: number;
  quoteAsOf: string;
};

type SyncJobState = {
  enabled: boolean;
  isRunning: boolean;
  symbols: string[];
  intervalMs: number;
  historyInterval: string;
  historyRange: string;
  includePrePost: boolean;
  lastRunStartedAt: string | null;
  lastRunFinishedAt: string | null;
  lastRunError: string | null;
  lastRunResults: SymbolRunResult[];
};

export class SyncJob {
  private readonly state: SyncJobState;

  constructor(
    private readonly db: YFinanceDatabase,
    private readonly yahoo: YahooFinanceClient,
    private readonly config: SyncJobConfig,
  ) {
    this.state = {
      enabled: config.enabled,
      isRunning: false,
      symbols: config.symbols,
      intervalMs: config.intervalMs,
      historyInterval: config.historyInterval,
      historyRange: config.historyRange,
      includePrePost: config.includePrePost,
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      lastRunError: null,
      lastRunResults: [],
    };
  }

  start(): void {
    if (!this.config.enabled || this.config.symbols.length === 0) {
      return;
    }

    if (this.config.runOnStart) {
      queueMicrotask(() => {
        void this.run();
      });
    }

    setInterval(() => {
      void this.run();
    }, this.config.intervalMs);
  }

  async run(): Promise<SyncJobState> {
    if (this.state.isRunning) {
      return this.snapshot();
    }

    this.state.isRunning = true;
    this.state.lastRunStartedAt = new Date().toISOString();
    this.state.lastRunFinishedAt = null;
    this.state.lastRunError = null;

    const results: SymbolRunResult[] = [];

    try {
      for (const symbol of this.config.symbols) {
        const history = await this.yahoo.syncHistory({
          symbol,
          interval: this.config.historyInterval,
          range: this.config.historyRange,
          includePrePost: this.config.includePrePost,
        });
        this.db.upsertInstrument(history.instrument);
        this.db.upsertPriceBars(history.bars);
        this.db.upsertCorporateActions(history.actions);

        const quote = await this.yahoo.syncQuote(symbol);
        this.db.upsertInstrument(quote.instrument);
        this.db.insertQuoteSnapshot(quote.snapshot);

        results.push({
          symbol,
          barsInserted: history.bars.length,
          actionsInserted: history.actions.length,
          quoteAsOf: quote.snapshot.asOf,
        });
      }

      this.state.lastRunResults = results;
    } catch (error) {
      this.state.lastRunError = error instanceof Error ? error.message : String(error);
    } finally {
      this.state.isRunning = false;
      this.state.lastRunFinishedAt = new Date().toISOString();
    }

    return this.snapshot();
  }

  snapshot(): SyncJobState {
    return {
      ...this.state,
      symbols: [...this.state.symbols],
      lastRunResults: this.state.lastRunResults.map((entry) => ({ ...entry })),
    };
  }
}

export function readSyncJobConfig(): SyncJobConfig {
  const symbols = (process.env.SYNC_SYMBOLS || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const intervalMs = Number(process.env.SYNC_INTERVAL_MS || 0);

  return {
    enabled: intervalMs > 0 && symbols.length > 0,
    symbols,
    intervalMs,
    historyInterval: process.env.SYNC_HISTORY_INTERVAL || "1d",
    historyRange: process.env.SYNC_HISTORY_RANGE || "1mo",
    includePrePost: process.env.SYNC_INCLUDE_PREPOST === "true",
    runOnStart: process.env.SYNC_RUN_ON_START !== "false",
  };
}
