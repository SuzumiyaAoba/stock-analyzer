import { VALID_INTERVALS, type HistorySyncRequest } from "./types";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "JSON ボディが不正です");
  }
}

export function normalizeSymbol(symbol: string | null | undefined): string {
  const normalized = symbol?.trim().toUpperCase();
  if (!normalized) {
    throw new HttpError(400, "symbol は必須です");
  }
  return normalized;
}

export function validateSymbols(symbols: string[] | null | undefined): string[] {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new HttpError(400, "symbols は1件以上必要です");
  }

  const normalized = symbols.map((symbol) => normalizeSymbol(symbol));
  return [...new Set(normalized)];
}

export function validateHistoryRequest(input: HistorySyncRequest): Required<HistorySyncRequest> {
  const symbol = normalizeSymbol(input.symbol);
  const interval = input.interval?.trim() || "1d";
  if (!VALID_INTERVALS.has(interval)) {
    throw new HttpError(400, `interval が不正です: ${interval}`);
  }

  const range = input.range?.trim() || "";
  const start = input.start?.trim() || "";
  const end = input.end?.trim() || "";
  if (!range && !start && !end) {
    return {
      symbol,
      interval,
      range: "1mo",
      start: "",
      end: "",
      includePrePost: input.includePrePost ?? false,
    };
  }

  if (range && (start || end)) {
    throw new HttpError(400, "range と start/end は同時に指定できません");
  }

  if (start && Number.isNaN(new Date(start).getTime())) {
    throw new HttpError(400, `start が不正です: ${start}`);
  }

  if (end && Number.isNaN(new Date(end).getTime())) {
    throw new HttpError(400, `end が不正です: ${end}`);
  }

  return {
    symbol,
    interval,
    range,
    start,
    end,
    includePrePost: input.includePrePost ?? false,
  };
}

export function toIsoUtc(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

export function unwrapYahooValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => unwrapYahooValue(entry));
  }

  if (typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  if ("raw" in record) {
    return unwrapYahooValue(record.raw);
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, unwrapYahooValue(entry)]),
  );
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
