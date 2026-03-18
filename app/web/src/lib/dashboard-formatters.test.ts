import { describe, expect, it } from "vitest";
import { actionLabel, formatDate, formatDateTime } from "./dashboard-formatters";

describe("dashboard-formatters", () => {
  it("不正な日付はハイフンで扱う", () => {
    expect(formatDate("not-a-date")).toBe("-");
    expect(formatDateTime("not-a-date")).toBe("-");
  });

  it("アクション種別を日本語で表示する", () => {
    expect(actionLabel("dividend")).toBe("配当");
    expect(actionLabel("split")).toBe("株式分割");
    expect(actionLabel("capitalGain")).toBe("キャピタルゲイン");
  });
});
