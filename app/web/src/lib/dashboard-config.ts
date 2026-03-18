import { z } from "zod";

export const intervalOptions = [
  { value: "1d", label: "1日足" },
  { value: "1wk", label: "週足" },
  { value: "1mo", label: "月足" },
] as const;

export type DashboardInterval = (typeof intervalOptions)[number]["value"];

export const dashboardSearchSchema = z.object({
  q: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  symbol: z
    .string()
    .optional()
    .transform((value) => value?.trim().toUpperCase() || undefined),
  interval: z.enum(["1d", "1wk", "1mo"]).optional().default("1d"),
});

export type DashboardSearch = z.infer<typeof dashboardSearchSchema>;

export function labelForInterval(interval: DashboardInterval) {
  return intervalOptions.find((option) => option.value === interval)?.label || interval;
}
