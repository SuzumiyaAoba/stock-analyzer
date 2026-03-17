import { describe, expect, it } from "bun:test";
import {
  type AppResult,
  HttpError,
  asNumber,
  normalizeSymbol,
  normalizeSymbolResult,
  parseActionType,
  parseInterval,
  parseJsonBody,
  parseJsonBodyResult,
  parseLimit,
  unwrapYahooValue,
  validateHistoryRequest,
  validateSymbols,
} from "./utils";

function getErrorMessage<T>(result: AppResult<T>): string | null {
  return result.match(
    () => null,
    (error) => error.message,
  );
}

describe("utils", () => {
  it("normalizeSymbol は大文字化して返す", () => {
    expect(normalizeSymbol(" aapl ")).toBe("AAPL");
  });

  it("normalizeSymbolResult は失敗を Result で返す", () => {
    expect(getErrorMessage(normalizeSymbolResult(""))).toBe("symbol は必須です");
  });

  it("normalizeSymbol は空文字で HttpError を投げる", () => {
    expect(() => normalizeSymbol("")).toThrow(HttpError);
  });

  it("validateSymbols は重複を除去して大文字化する", () => {
    expect(validateSymbols(["aapl", "AAPL", " msft "])).toEqual(["AAPL", "MSFT"]);
  });

  it("parseLimit は空値ならデフォルト値を返す", () => {
    expect(parseLimit(null, { defaultValue: 20, max: 200 })).toBe(20);
  });

  it("parseLimit は範囲外や非整数を拒否する", () => {
    expect(() => parseLimit("1.5", { defaultValue: 20, max: 200 })).toThrow(HttpError);
    expect(() => parseLimit("0", { defaultValue: 20, max: 200 })).toThrow(HttpError);
  });

  it("parseInterval と parseActionType は許可値を返す", () => {
    expect(parseInterval(" 1wk ")).toBe("1wk");
    expect(parseActionType(" dividend ")).toBe("dividend");
    expect(parseActionType("")).toBeNull();
  });

  it("validateHistoryRequest はデフォルト値を補う", () => {
    expect(validateHistoryRequest({ symbol: "aapl" })).toEqual({
      symbol: "AAPL",
      interval: "1d",
      range: "1mo",
      start: "",
      end: "",
      includePrePost: false,
    });
  });

  it("validateHistoryRequest は range と start/end の同時指定を拒否する", () => {
    expect(() =>
      validateHistoryRequest({
        symbol: "AAPL",
        range: "1mo",
        start: "2026-01-01",
      }),
    ).toThrow(HttpError);
  });

  it("validateHistoryRequest は不正な日付を拒否する", () => {
    expect(() =>
      validateHistoryRequest({
        symbol: "AAPL",
        start: "bad-date",
      }),
    ).toThrow(HttpError);
  });

  it("parseJsonBody は不正 JSON を拒否する", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: "{bad",
      headers: { "content-type": "application/json" },
    });

    await expect(parseJsonBody(request)).rejects.toThrow(HttpError);
  });

  it("parseJsonBodyResult は不正 JSON を Result で返す", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: "{bad",
      headers: { "content-type": "application/json" },
    });

    const result = await parseJsonBodyResult(request);
    expect(getErrorMessage(result)).toBe("JSON ボディが不正です");
  });

  it("unwrapYahooValue は raw フィールドを再帰的に展開する", () => {
    expect(
      unwrapYahooValue({
        price: { raw: 123 },
        nested: {
          value: { raw: "abc" },
        },
        list: [{ raw: 1 }, { raw: 2 }],
      }),
    ).toEqual({
      price: 123,
      nested: {
        value: "abc",
      },
      list: [1, 2],
    });
  });

  it("asNumber は数値だけを返す", () => {
    expect(asNumber(123)).toBe(123);
    expect(asNumber("123")).toBeNull();
  });
});
