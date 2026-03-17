import { formatZodError, syncJobConfigSchema } from "./schemas";
import type { YFinanceDatabase } from "./db";
import { syncSymbol, type SymbolSyncResult } from "./sync-service";
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
  lastRunResults: SymbolSyncResult[];
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

  async run(source = "scheduler"): Promise<SyncJobState> {
    if (this.state.isRunning) {
      return this.snapshot();
    }

    this.state.isRunning = true;
    this.state.lastRunStartedAt = new Date().toISOString();
    this.state.lastRunFinishedAt = null;
    this.state.lastRunError = null;

    const results: SymbolSyncResult[] = [];
    const runId = this.db.createSyncJobRun({
      source,
      startedAt: this.state.lastRunStartedAt,
      status: "running",
      symbolCount: this.config.symbols.length,
    });

    try {
      for (const symbol of this.config.symbols) {
        results.push(
          await syncSymbol(this.db, this.yahoo, {
            symbol,
            history: {
              symbol,
              interval: this.config.historyInterval,
              range: this.config.historyRange,
              start: "",
              end: "",
              includePrePost: this.config.includePrePost,
            },
          }),
        );
      }

      this.state.lastRunResults = results;
      this.db.finishSyncJobRun({
        id: runId,
        finishedAt: new Date().toISOString(),
        status: "success",
        errorMessage: null,
        resultsJson: JSON.stringify(results),
      });
    } catch (error) {
      this.state.lastRunError = error instanceof Error ? error.message : String(error);
      this.db.finishSyncJobRun({
        id: runId,
        finishedAt: new Date().toISOString(),
        status: "error",
        errorMessage: this.state.lastRunError,
        resultsJson: JSON.stringify(results),
      });
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
  const result = syncJobConfigSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  return result.data;
}
