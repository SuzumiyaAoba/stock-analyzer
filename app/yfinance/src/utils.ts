import { isNumber, trim, uniq } from "es-toolkit";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { VALID_ACTION_TYPES, VALID_INTERVALS, type HistorySyncRequest } from "./types";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type AppResult<T> = Result<T, HttpError>;
export type AppResultAsync<T> = ResultAsync<T, HttpError>;

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function unwrapOrThrow<T>(result: AppResult<T>): T {
  return result.match(
    (value) => value,
    (error) => {
      throw error;
    },
  );
}

export function parseJsonBodyResult<T>(request: Request): AppResultAsync<T> {
  return ResultAsync.fromPromise(request.json() as Promise<T>, () => {
    return new HttpError(400, "JSON ボディが不正です");
  });
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  return (await parseJsonBodyResult<T>(request)).match(
    (value) => value,
    (error) => {
      throw error;
    },
  );
}

export function normalizeSymbolResult(symbol: string | null | undefined): AppResult<string> {
  const normalized = trim(symbol ?? "").toUpperCase();
  if (!normalized) {
    return err(new HttpError(400, "symbol は必須です"));
  }

  return ok(normalized);
}

export function normalizeSymbol(symbol: string | null | undefined): string {
  return unwrapOrThrow(normalizeSymbolResult(symbol));
}

export function validateSymbolsResult(symbols: string[] | null | undefined): AppResult<string[]> {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return err(new HttpError(400, "symbols は1件以上必要です"));
  }

  const normalized: string[] = [];
  for (const symbol of symbols) {
    const result = normalizeSymbolResult(symbol);
    if (result.isErr()) {
      return err(result.error);
    }
    normalized.push(result.value);
  }

  return ok(uniq(normalized));
}

export function validateSymbols(symbols: string[] | null | undefined): string[] {
  return unwrapOrThrow(validateSymbolsResult(symbols));
}

export function parseLimitResult(
  value: string | null | undefined,
  options: {
    defaultValue: number;
    min?: number;
    max: number;
    fieldName?: string;
  },
): AppResult<number> {
  const { defaultValue, min = 1, max, fieldName = "limit" } = options;

  if (value === null || value === undefined || trim(value) === "") {
    return ok(defaultValue);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return err(
      new HttpError(400, `${fieldName} は ${min} 以上 ${max} 以下の整数で指定してください`),
    );
  }

  return ok(parsed);
}

export function parseLimit(
  value: string | null | undefined,
  options: {
    defaultValue: number;
    min?: number;
    max: number;
    fieldName?: string;
  },
): number {
  return unwrapOrThrow(parseLimitResult(value, options));
}

export function parseIntervalResult(
  value: string | null | undefined,
  fallback = "1d",
): AppResult<string> {
  const interval = trim(value ?? "") || fallback;
  if (!VALID_INTERVALS.has(interval)) {
    return err(new HttpError(400, `interval が不正です: ${interval}`));
  }

  return ok(interval);
}

export function parseInterval(value: string | null | undefined, fallback = "1d"): string {
  return unwrapOrThrow(parseIntervalResult(value, fallback));
}

export function parseActionTypeResult(value: string | null | undefined): AppResult<string | null> {
  const actionType = trim(value ?? "") || null;
  if (actionType && !VALID_ACTION_TYPES.has(actionType)) {
    return err(new HttpError(400, `type が不正です: ${actionType}`));
  }

  return ok(actionType);
}

export function parseActionType(value: string | null | undefined): string | null {
  return unwrapOrThrow(parseActionTypeResult(value));
}

export function validateHistoryRequestResult(
  input: HistorySyncRequest,
): AppResult<Required<HistorySyncRequest>> {
  return normalizeSymbolResult(input.symbol).andThen((symbol) => {
    return parseIntervalResult(input.interval).andThen((interval) => {
      const range = trim(input.range ?? "");
      const start = trim(input.start ?? "");
      const end = trim(input.end ?? "");
      if (!range && !start && !end) {
        return ok({
          symbol,
          interval,
          range: "1mo",
          start: "",
          end: "",
          includePrePost: input.includePrePost ?? false,
        });
      }

      if (range && (start || end)) {
        return err(new HttpError(400, "range と start/end は同時に指定できません"));
      }

      if (start && Number.isNaN(new Date(start).getTime())) {
        return err(new HttpError(400, `start が不正です: ${start}`));
      }

      if (end && Number.isNaN(new Date(end).getTime())) {
        return err(new HttpError(400, `end が不正です: ${end}`));
      }

      return ok({
        symbol,
        interval,
        range,
        start,
        end,
        includePrePost: input.includePrePost ?? false,
      });
    });
  });
}

export function validateHistoryRequest(input: HistorySyncRequest): Required<HistorySyncRequest> {
  return unwrapOrThrow(validateHistoryRequestResult(input));
}

export function toIsoUtc(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

export function asNumber(value: unknown): number | null {
  if (isNumber(value) && Number.isFinite(value)) {
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
