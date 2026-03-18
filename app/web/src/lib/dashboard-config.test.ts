import { describe, expect, it } from "vitest";
import { dashboardSearchSchema } from "./dashboard-config";

describe("dashboardSearchSchema", () => {
  it("既定値を補い、symbol を正規化する", () => {
    const search = dashboardSearchSchema.parse({
      symbol: " aapl ",
    });

    expect(search).toMatchObject({
      symbol: "AAPL",
      interval: "1d",
      sortBy: "latestQuoteAsOf",
      order: "desc",
      listLimit: 24,
      offset: 0,
      priceLimit: 60,
      actionType: "all",
      actionLimit: 12,
      runsLimit: 10,
    });
  });

  it("from が to より後なら拒否する", () => {
    const result = dashboardSearchSchema.safeParse({
      from: "2026-03-02",
      to: "2026-03-01",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("validation should fail");
    }

    expect(result.error.issues[0]?.message).toBe("from は to より前の日付を指定してください");
  });
});
