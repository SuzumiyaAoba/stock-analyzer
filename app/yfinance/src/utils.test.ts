import { describe, expect, it } from "bun:test";
import { HttpError, asNumber, isObject, normalizeSymbol, parseJsonBody, unwrapYahooValue, validateHistoryRequest, validateSymbols } from "./utils";

describe("utils", () => {
  it("normalizeSymbol は大文字化して返す", () => {
    expect(normalizeSymbol(" aapl ")).toBe("AAPL");
  });

  it("normalizeSymbol は空文字で HttpError を投げる", () => {
    expect(() => normalizeSymbol("")).toThrow(HttpError);
  });

  it("validateSymbols は重複を除去して大文字化する", () => {
    expect(validateSymbols(["aapl", "AAPL", " msft "])).toEqual(["AAPL", "MSFT"]);
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

  it("asNumber と isObject は型判定を行う", () => {
    expect(asNumber(123)).toBe(123);
    expect(asNumber("123")).toBeNull();
    expect(isObject({ a: 1 })).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([1, 2])).toBe(false);
  });
});
