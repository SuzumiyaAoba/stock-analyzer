import { compact, trim, uniq } from "es-toolkit";
import { z } from "zod";
import { VALID_ACTION_TYPES, VALID_INTERVALS } from "./types";

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  const normalized = trim(value ?? "");
  return normalized === "" ? undefined : normalized;
}

function createIntervalSchema(defaultValue = "1d") {
  return z
    .string()
    .optional()
    .transform((value, ctx) => {
      const interval = normalizeOptionalString(value) ?? defaultValue;
      if (!VALID_INTERVALS.has(interval)) {
        ctx.addIssue({
          code: "custom",
          message: `interval が不正です: ${interval}`,
        });
        return z.NEVER;
      }

      return interval;
    });
}

function createActionTypeSchema() {
  return z
    .string()
    .optional()
    .transform((value, ctx) => {
      const actionType = normalizeOptionalString(value) ?? null;
      if (actionType !== null && !VALID_ACTION_TYPES.has(actionType)) {
        ctx.addIssue({
          code: "custom",
          message: `type が不正です: ${actionType}`,
        });
        return z.NEVER;
      }

      return actionType;
    });
}

function createLimitSchema(defaultValue: number, max: number, fieldName = "limit") {
  return z
    .string()
    .optional()
    .transform((value, ctx) => {
      const normalized = normalizeOptionalString(value);
      if (!normalized) {
        return defaultValue;
      }

      const parsed = Number(normalized);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
        ctx.addIssue({
          code: "custom",
          message: `${fieldName} は 1 以上 ${max} 以下の整数で指定してください`,
        });
        return z.NEVER;
      }

      return parsed;
    });
}

function createBooleanEnvSchema(fieldName: string, defaultValue: boolean) {
  return z
    .string()
    .optional()
    .transform((value, ctx) => {
      const normalized = normalizeOptionalString(value);
      if (!normalized) {
        return defaultValue;
      }

      if (normalized === "true") {
        return true;
      }

      if (normalized === "false") {
        return false;
      }

      ctx.addIssue({
        code: "custom",
        message: `${fieldName} は true または false で指定してください`,
      });
      return z.NEVER;
    });
}

export function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "リクエストが不正です";
}

export const symbolSchema = z.string().transform((value, ctx) => {
  const normalized = trim(value).toUpperCase();
  if (!normalized) {
    ctx.addIssue({
      code: "custom",
      message: "symbol は必須です",
    });
    return z.NEVER;
  }

  return normalized;
});

export const symbolsSchema = z
  .array(symbolSchema)
  .min(1, { message: "symbols は1件以上必要です" })
  .transform((symbols) => uniq(symbols));

export const intervalSchema = createIntervalSchema();
export const actionTypeSchema = createActionTypeSchema();

export const historySyncRequestSchema = z
  .object({
    symbol: symbolSchema,
    interval: intervalSchema,
    range: z
      .string()
      .optional()
      .transform((value) => normalizeOptionalString(value) ?? ""),
    start: z
      .string()
      .optional()
      .transform((value) => normalizeOptionalString(value) ?? ""),
    end: z
      .string()
      .optional()
      .transform((value) => normalizeOptionalString(value) ?? ""),
    includePrePost: z.boolean().optional().default(false),
  })
  .superRefine(({ range, start, end }, ctx) => {
    if (!range && !start && !end) {
      return;
    }

    if (range && (start || end)) {
      ctx.addIssue({
        code: "custom",
        message: "range と start/end は同時に指定できません",
      });
    }

    if (start && Number.isNaN(new Date(start).getTime())) {
      ctx.addIssue({
        code: "custom",
        message: `start が不正です: ${start}`,
      });
    }

    if (end && Number.isNaN(new Date(end).getTime())) {
      ctx.addIssue({
        code: "custom",
        message: `end が不正です: ${end}`,
      });
    }
  })
  .transform((input) => {
    if (!input.range && !input.start && !input.end) {
      return {
        ...input,
        range: "1mo",
        start: "",
        end: "",
      };
    }

    return input;
  });

export const quoteSyncRequestSchema = z.object({
  symbol: symbolSchema,
  modules: z
    .array(z.string())
    .optional()
    .transform((modules) => {
      return modules?.length ? modules : undefined;
    }),
});

export const batchSyncRequestSchema = z.object({
  symbols: symbolsSchema,
  interval: z.string().optional(),
  range: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  includePrePost: z.boolean().optional(),
  modules: z.array(z.string()).optional(),
  skipQuote: z.boolean().optional(),
});

export const pricesQuerySchema = z.object({
  symbol: symbolSchema,
  interval: intervalSchema,
  from: z
    .string()
    .optional()
    .transform((value) => normalizeOptionalString(value)),
  to: z
    .string()
    .optional()
    .transform((value) => normalizeOptionalString(value)),
  limit: createLimitSchema(500, 5000),
});

export const actionsQuerySchema = z.object({
  symbol: symbolSchema,
  type: actionTypeSchema,
  from: z
    .string()
    .optional()
    .transform((value) => normalizeOptionalString(value)),
  to: z
    .string()
    .optional()
    .transform((value) => normalizeOptionalString(value)),
  limit: createLimitSchema(500, 5000),
});

export const syncRunsQuerySchema = z.object({
  limit: createLimitSchema(20, 200),
});

export const instrumentParamSchema = z.object({
  symbol: symbolSchema,
});

export const syncJobConfigSchema = z
  .object({
    SYNC_SYMBOLS: z
      .string()
      .optional()
      .transform((value) =>
        uniq(compact((value ?? "").split(",").map((entry) => trim(entry).toUpperCase()))),
      ),
    SYNC_INTERVAL_MS: z
      .string()
      .optional()
      .transform((value, ctx) => {
        const normalized = normalizeOptionalString(value);
        if (!normalized) {
          return 0;
        }

        const parsed = Number(normalized);
        if (!Number.isInteger(parsed) || parsed < 0) {
          ctx.addIssue({
            code: "custom",
            message: `SYNC_INTERVAL_MS が不正です: ${normalized}`,
          });
          return z.NEVER;
        }

        return parsed;
      }),
    SYNC_HISTORY_INTERVAL: createIntervalSchema("1d"),
    SYNC_HISTORY_RANGE: z
      .string()
      .optional()
      .transform((value) => normalizeOptionalString(value) ?? "1mo"),
    SYNC_INCLUDE_PREPOST: createBooleanEnvSchema("SYNC_INCLUDE_PREPOST", false),
    SYNC_RUN_ON_START: createBooleanEnvSchema("SYNC_RUN_ON_START", true),
  })
  .transform((input) => {
    const enabled = input.SYNC_INTERVAL_MS > 0 && input.SYNC_SYMBOLS.length > 0;
    return {
      enabled,
      symbols: input.SYNC_SYMBOLS,
      intervalMs: input.SYNC_INTERVAL_MS,
      historyInterval: input.SYNC_HISTORY_INTERVAL,
      historyRange: input.SYNC_HISTORY_RANGE,
      includePrePost: input.SYNC_INCLUDE_PREPOST,
      runOnStart: input.SYNC_RUN_ON_START,
    };
  });

export const serverConfigSchema = z.object({
  PORT: z
    .string()
    .optional()
    .transform((value, ctx) => {
      const normalized = normalizeOptionalString(value);
      if (!normalized) {
        return 3000;
      }

      const parsed = Number(normalized);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        ctx.addIssue({
          code: "custom",
          message: `PORT が不正です: ${normalized}`,
        });
        return z.NEVER;
      }

      return parsed;
    }),
});
