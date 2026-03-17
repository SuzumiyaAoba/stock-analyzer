import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import type {
  CorporateActionRecord,
  InstrumentRecord,
  PriceBarRecord,
  QuoteSnapshotRecord,
} from "./types";

const defaultDbPath = join(import.meta.dir, "..", "data", "yfinance.sqlite");

export class YFinanceDatabase {
  readonly db: Database;

  constructor(dbPath = process.env.DB_PATH || defaultDbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS instruments (
        symbol TEXT PRIMARY KEY,
        quote_type TEXT,
        exchange TEXT,
        currency TEXT,
        timezone TEXT,
        short_name TEXT,
        long_name TEXT,
        first_trade_at TEXT,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS price_bars (
        symbol TEXT NOT NULL,
        interval TEXT NOT NULL,
        timestamp_utc TEXT NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        adj_close REAL,
        volume REAL,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (symbol, interval, timestamp_utc)
      );

      CREATE TABLE IF NOT EXISTS corporate_actions (
        symbol TEXT NOT NULL,
        action_type TEXT NOT NULL,
        event_at TEXT NOT NULL,
        value REAL,
        raw_json TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (symbol, action_type, event_at)
      );

      CREATE TABLE IF NOT EXISTS quote_snapshots (
        symbol TEXT NOT NULL,
        as_of TEXT NOT NULL,
        regular_market_price REAL,
        previous_close REAL,
        day_high REAL,
        day_low REAL,
        market_cap REAL,
        regular_market_volume REAL,
        raw_json TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (symbol, as_of)
      );

      CREATE INDEX IF NOT EXISTS idx_price_bars_lookup
      ON price_bars (symbol, interval, timestamp_utc);

      CREATE INDEX IF NOT EXISTS idx_quote_snapshots_latest
      ON quote_snapshots (symbol, as_of DESC);

      CREATE TABLE IF NOT EXISTS sync_job_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        symbol_count INTEGER NOT NULL,
        error_message TEXT,
        results_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_sync_job_runs_started_at
      ON sync_job_runs (started_at DESC);
    `);
  }

  upsertInstrument(record: InstrumentRecord): void {
    this.db
      .query(`
        INSERT INTO instruments (
          symbol, quote_type, exchange, currency, timezone,
          short_name, long_name, first_trade_at, raw_json, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(symbol) DO UPDATE SET
          quote_type = COALESCE(excluded.quote_type, instruments.quote_type),
          exchange = COALESCE(excluded.exchange, instruments.exchange),
          currency = COALESCE(excluded.currency, instruments.currency),
          timezone = COALESCE(excluded.timezone, instruments.timezone),
          short_name = COALESCE(excluded.short_name, instruments.short_name),
          long_name = COALESCE(excluded.long_name, instruments.long_name),
          first_trade_at = COALESCE(excluded.first_trade_at, instruments.first_trade_at),
          raw_json = excluded.raw_json,
          updated_at = CURRENT_TIMESTAMP
      `)
      .run(
        record.symbol,
        record.quoteType,
        record.exchange,
        record.currency,
        record.timezone,
        record.shortName,
        record.longName,
        record.firstTradeAt,
        record.rawJson,
      );
  }

  upsertPriceBars(records: PriceBarRecord[]): void {
    if (records.length === 0) {
      return;
    }

    const statement = this.db.query(`
      INSERT INTO price_bars (
        symbol, interval, timestamp_utc, open, high, low, close, adj_close, volume, fetched_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(symbol, interval, timestamp_utc) DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        adj_close = excluded.adj_close,
        volume = excluded.volume,
        fetched_at = CURRENT_TIMESTAMP
    `);

    this.db.exec("BEGIN");
    try {
      for (const record of records) {
        statement.run(
          record.symbol,
          record.interval,
          record.timestampUtc,
          record.open,
          record.high,
          record.low,
          record.close,
          record.adjClose,
          record.volume,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  upsertCorporateActions(records: CorporateActionRecord[]): void {
    if (records.length === 0) {
      return;
    }

    const statement = this.db.query(`
      INSERT INTO corporate_actions (
        symbol, action_type, event_at, value, raw_json, fetched_at
      )
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(symbol, action_type, event_at) DO UPDATE SET
        value = excluded.value,
        raw_json = excluded.raw_json,
        fetched_at = CURRENT_TIMESTAMP
    `);

    this.db.exec("BEGIN");
    try {
      for (const record of records) {
        statement.run(
          record.symbol,
          record.actionType,
          record.eventAt,
          record.value,
          record.rawJson,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  insertQuoteSnapshot(record: QuoteSnapshotRecord): void {
    this.db
      .query(`
        INSERT INTO quote_snapshots (
          symbol, as_of, regular_market_price, previous_close, day_high,
          day_low, market_cap, regular_market_volume, raw_json, fetched_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(symbol, as_of) DO UPDATE SET
          regular_market_price = excluded.regular_market_price,
          previous_close = excluded.previous_close,
          day_high = excluded.day_high,
          day_low = excluded.day_low,
          market_cap = excluded.market_cap,
          regular_market_volume = excluded.regular_market_volume,
          raw_json = excluded.raw_json,
          fetched_at = CURRENT_TIMESTAMP
      `)
      .run(
        record.symbol,
        record.asOf,
        record.regularMarketPrice,
        record.previousClose,
        record.dayHigh,
        record.dayLow,
        record.marketCap,
        record.regularMarketVolume,
        record.rawJson,
      );
  }

  getInstrument(symbol: string): Record<string, unknown> | null {
    const instrument = this.db
      .query(`
        SELECT
          i.symbol,
          i.quote_type,
          i.exchange,
          i.currency,
          i.timezone,
          i.short_name,
          i.long_name,
          i.first_trade_at,
          i.updated_at
        FROM instruments i
        WHERE i.symbol = ?
      `)
      .get(symbol) as Record<string, unknown> | null;

    if (!instrument) {
      return null;
    }

    const latestQuote = this.db
      .query(`
        SELECT
          as_of AS asOf,
          regular_market_price AS regularMarketPrice,
          previous_close AS previousClose,
          day_high AS dayHigh,
          day_low AS dayLow,
          market_cap AS marketCap,
          regular_market_volume AS regularMarketVolume
        FROM quote_snapshots
        WHERE symbol = ?
        ORDER BY as_of DESC
        LIMIT 1
      `)
      .get(symbol) as Record<string, unknown> | null;

    return {
      symbol: instrument.symbol,
      quoteType: instrument.quote_type,
      exchange: instrument.exchange,
      currency: instrument.currency,
      timezone: instrument.timezone,
      shortName: instrument.short_name,
      longName: instrument.long_name,
      firstTradeAt: instrument.first_trade_at,
      updatedAt: instrument.updated_at,
      latestQuote,
    };
  }

  getPrices(input: {
    symbol: string;
    interval: string;
    from?: string | null;
    to?: string | null;
    limit?: number;
  }): Record<string, unknown>[] {
    const conditions = ["symbol = ?", "interval = ?"];
    const values: Array<string | number> = [input.symbol, input.interval];

    if (input.from) {
      conditions.push("timestamp_utc >= ?");
      values.push(input.from);
    }

    if (input.to) {
      conditions.push("timestamp_utc <= ?");
      values.push(input.to);
    }

    values.push(Math.min(Math.max(input.limit ?? 500, 1), 5000));

    return this.db
      .query(`
        SELECT
          symbol,
          interval,
          timestamp_utc AS timestampUtc,
          open,
          high,
          low,
          close,
          adj_close AS adjClose,
          volume
        FROM price_bars
        WHERE ${conditions.join(" AND ")}
        ORDER BY timestamp_utc ASC
        LIMIT ?
      `)
      .all(...values) as Record<string, unknown>[];
  }

  getCorporateActions(input: {
    symbol: string;
    actionType?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
  }): Record<string, unknown>[] {
    const conditions = ["symbol = ?"];
    const values: Array<string | number> = [input.symbol];

    if (input.actionType) {
      conditions.push("action_type = ?");
      values.push(input.actionType);
    }

    if (input.from) {
      conditions.push("event_at >= ?");
      values.push(input.from);
    }

    if (input.to) {
      conditions.push("event_at <= ?");
      values.push(input.to);
    }

    values.push(Math.min(Math.max(input.limit ?? 500, 1), 5000));

    return this.db
      .query(`
        SELECT
          symbol,
          action_type AS actionType,
          event_at AS eventAt,
          value
        FROM corporate_actions
        WHERE ${conditions.join(" AND ")}
        ORDER BY event_at ASC
        LIMIT ?
      `)
      .all(...values) as Record<string, unknown>[];
  }

  createSyncJobRun(input: {
    source: string;
    startedAt: string;
    status: string;
    symbolCount: number;
  }): number {
    const result = this.db
      .query(`
        INSERT INTO sync_job_runs (
          source, started_at, status, symbol_count
        )
        VALUES (?, ?, ?, ?)
      `)
      .run(input.source, input.startedAt, input.status, input.symbolCount);

    return Number(result.lastInsertRowid);
  }

  finishSyncJobRun(input: {
    id: number;
    finishedAt: string;
    status: string;
    errorMessage: string | null;
    resultsJson: string;
  }): void {
    this.db
      .query(`
        UPDATE sync_job_runs
        SET
          finished_at = ?,
          status = ?,
          error_message = ?,
          results_json = ?
        WHERE id = ?
      `)
      .run(input.finishedAt, input.status, input.errorMessage, input.resultsJson, input.id);
  }

  getSyncJobRuns(limit = 20): Record<string, unknown>[] {
    return this.db
      .query(`
        SELECT
          id,
          source,
          started_at AS startedAt,
          finished_at AS finishedAt,
          status,
          symbol_count AS symbolCount,
          error_message AS errorMessage,
          results_json AS resultsJson
        FROM sync_job_runs
        ORDER BY started_at DESC
        LIMIT ?
      `)
      .all(Math.min(Math.max(limit, 1), 200))
      .map((row) => {
        const record = row as Record<string, unknown>;
        const results =
          typeof record.resultsJson === "string" ? JSON.parse(record.resultsJson) : [];
        return {
          id: record.id,
          source: record.source,
          startedAt: record.startedAt,
          finishedAt: record.finishedAt,
          status: record.status,
          symbolCount: record.symbolCount,
          errorMessage: record.errorMessage,
          results,
        };
      });
  }
}
