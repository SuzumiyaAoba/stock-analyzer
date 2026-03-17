export const VALID_INTERVALS = new Set([
  "1m",
  "2m",
  "5m",
  "15m",
  "30m",
  "60m",
  "90m",
  "1h",
  "1d",
  "5d",
  "1wk",
  "1mo",
  "3mo",
]);

export const VALID_ACTION_TYPES = new Set(["dividend", "split", "capitalGain"]);

export type Interval = string;

export type HistorySyncRequest = {
  symbol: string;
  interval?: string;
  range?: string;
  start?: string;
  end?: string;
  includePrePost?: boolean;
};

export type QuoteSyncRequest = {
  symbol: string;
  modules?: string[];
};

export type BatchSyncRequest = {
  symbols: string[];
  interval?: string;
  range?: string;
  start?: string;
  end?: string;
  includePrePost?: boolean;
  modules?: string[];
  skipQuote?: boolean;
};

export type InstrumentRecord = {
  symbol: string;
  quoteType: string | null;
  exchange: string | null;
  currency: string | null;
  timezone: string | null;
  shortName: string | null;
  longName: string | null;
  firstTradeAt: string | null;
  rawJson: string;
};

export type QuoteSnapshotRecord = {
  symbol: string;
  asOf: string;
  regularMarketPrice: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  marketCap: number | null;
  regularMarketVolume: number | null;
  rawJson: string;
};

export type PriceBarRecord = {
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

export type CorporateActionRecord = {
  symbol: string;
  actionType: "dividend" | "split" | "capitalGain";
  eventAt: string;
  value: number | null;
  rawJson: string;
};

export type ChartSyncResult = {
  instrument: InstrumentRecord;
  bars: PriceBarRecord[];
  actions: CorporateActionRecord[];
};

export type QuoteSyncResult = {
  instrument: InstrumentRecord;
  snapshot: QuoteSnapshotRecord;
};
