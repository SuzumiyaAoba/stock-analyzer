import { z } from "zod";

export const intervalOptions = [
  { value: "1d", label: "1日足" },
  { value: "1wk", label: "週足" },
  { value: "1mo", label: "月足" },
] as const;

export const instrumentSortOptions = [
  { value: "latestQuoteAsOf", label: "最新更新" },
  { value: "updatedAt", label: "保存更新" },
  { value: "symbol", label: "シンボル" },
] as const;

export const orderOptions = [
  { value: "desc", label: "降順" },
  { value: "asc", label: "昇順" },
] as const;

export const listLimitOptions = [
  { value: 12, label: "12件" },
  { value: 24, label: "24件" },
  { value: 48, label: "48件" },
] as const;

export const priceLimitOptions = [
  { value: 30, label: "30本" },
  { value: 60, label: "60本" },
  { value: 120, label: "120本" },
  { value: 240, label: "240本" },
] as const;

export const actionLimitOptions = [
  { value: 6, label: "6件" },
  { value: 12, label: "12件" },
  { value: 24, label: "24件" },
] as const;

export const actionTypeOptions = [
  { value: "all", label: "すべて" },
  { value: "dividend", label: "配当" },
  { value: "split", label: "分割" },
  { value: "capitalGain", label: "キャピタルゲイン" },
] as const;

export const dashboardViewOptions = [
  { value: "analysis", label: "分析" },
  { value: "universe", label: "監視" },
  { value: "operations", label: "運用" },
] as const;

export const syncHistoryIntervalOptions = [
  { value: "1d", label: "1日足" },
  { value: "5d", label: "5日足" },
  { value: "1wk", label: "週足" },
  { value: "1mo", label: "月足" },
  { value: "3mo", label: "3か月足" },
] as const;

export const syncHistoryRangeOptions = [
  { value: "5d", label: "5日" },
  { value: "1mo", label: "1か月" },
  { value: "3mo", label: "3か月" },
  { value: "6mo", label: "6か月" },
  { value: "1y", label: "1年" },
  { value: "2y", label: "2年" },
  { value: "5y", label: "5年" },
  { value: "max", label: "最大" },
] as const;

export type DashboardInterval = (typeof intervalOptions)[number]["value"];
export type DashboardSortBy = (typeof instrumentSortOptions)[number]["value"];
export type DashboardOrder = (typeof orderOptions)[number]["value"];
export type DashboardActionType = (typeof actionTypeOptions)[number]["value"];
export type DashboardView = (typeof dashboardViewOptions)[number]["value"];
export type SyncHistoryInterval = (typeof syncHistoryIntervalOptions)[number]["value"];
export type SyncHistoryRange = (typeof syncHistoryRangeOptions)[number]["value"];

function optionalTrimmedStringSchema() {
  return z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined);
}

function integerSearchSchema(defaultValue: number, min: number, max: number, fieldName: string) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === null || value === "") {
        return defaultValue;
      }

      const parsed = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({
          code: "custom",
          message: `${fieldName} は ${min} 以上 ${max} 以下の整数で指定してください`,
        });
        return z.NEVER;
      }

      return parsed;
    });
}

function dateSearchSchema(fieldName: string) {
  return z
    .string()
    .optional()
    .transform((value, ctx) => {
      const normalized = value?.trim();
      if (!normalized) {
        return undefined;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        ctx.addIssue({
          code: "custom",
          message: `${fieldName} は YYYY-MM-DD 形式で指定してください`,
        });
        return z.NEVER;
      }

      return normalized;
    });
}

export const dashboardSearchSchema = z
  .object({
    q: optionalTrimmedStringSchema(),
    view: z.enum(["analysis", "universe", "operations"]).optional().default("analysis"),
    symbol: optionalTrimmedStringSchema().transform((value) => value?.toUpperCase()),
    interval: z.enum(["1d", "1wk", "1mo"]).optional().default("1d"),
    sortBy: z
      .enum(["latestQuoteAsOf", "updatedAt", "symbol"])
      .optional()
      .default("latestQuoteAsOf"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
    listLimit: integerSearchSchema(24, 1, 200, "listLimit"),
    offset: integerSearchSchema(0, 0, 10_000, "offset"),
    priceLimit: integerSearchSchema(60, 1, 5000, "priceLimit"),
    actionType: z.enum(["all", "dividend", "split", "capitalGain"]).optional().default("all"),
    actionLimit: integerSearchSchema(12, 1, 5000, "actionLimit"),
    runsLimit: integerSearchSchema(10, 1, 200, "runsLimit"),
    from: dateSearchSchema("from"),
    to: dateSearchSchema("to"),
  })
  .superRefine((search, ctx) => {
    if (!search.from || !search.to) {
      return;
    }

    if (search.from > search.to) {
      ctx.addIssue({
        code: "custom",
        message: "from は to より前の日付を指定してください",
        path: ["from"],
      });
    }
  });

export type DashboardSearch = z.infer<typeof dashboardSearchSchema>;

export function labelForInterval(interval: DashboardInterval) {
  return intervalOptions.find((option) => option.value === interval)?.label || interval;
}
