import { isNumber, trim } from "es-toolkit";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { z } from "zod";
import {
  actionTypeSchema,
  formatZodError,
  historySyncRequestSchema,
  intervalSchema,
  symbolSchema,
  symbolsSchema,
} from "./schemas";
import { type HistorySyncRequest } from "./types";

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

function parseZodResult<T>(schema: z.ZodType<T>, input: unknown, status = 400): AppResult<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return err(new HttpError(status, formatZodError(result.error)));
  }

  return ok(result.data);
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
  return parseZodResult(symbolSchema, symbol ?? "");
}

export function normalizeSymbol(symbol: string | null | undefined): string {
  return unwrapOrThrow(normalizeSymbolResult(symbol));
}

export function validateSymbolsResult(symbols: string[] | null | undefined): AppResult<string[]> {
  return parseZodResult(symbolsSchema, symbols ?? []);
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

  return parseZodResult(
    z
      .string()
      .optional()
      .transform((input, ctx) => {
        const normalized = trim(input ?? "");
        if (!normalized) {
          return defaultValue;
        }

        const parsed = Number(normalized);
        if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
          ctx.addIssue({
            code: "custom",
            message: `${fieldName} は ${min} 以上 ${max} 以下の整数で指定してください`,
          });
          return z.NEVER;
        }

        return parsed;
      }),
    value ?? undefined,
  );
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
  _fallback = "1d",
): AppResult<string> {
  return parseZodResult(intervalSchema, value ?? undefined);
}

export function parseInterval(value: string | null | undefined, fallback = "1d"): string {
  return unwrapOrThrow(parseIntervalResult(value, fallback));
}

export function parseActionTypeResult(value: string | null | undefined): AppResult<string | null> {
  return parseZodResult(actionTypeSchema, value ?? undefined);
}

export function parseActionType(value: string | null | undefined): string | null {
  return unwrapOrThrow(parseActionTypeResult(value));
}

export function validateHistoryRequestResult(
  input: HistorySyncRequest,
): AppResult<Required<HistorySyncRequest>> {
  return parseZodResult(historySyncRequestSchema, input);
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
