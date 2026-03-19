import { describe, expect, it } from "vitest";
import { createRequestSignal, normalizeSymbolsText, resolveSelectedSymbol } from "./yfinance-utils";

describe("normalizeSymbolsText", () => {
  it("大文字化しつつ重複を除去する", () => {
    expect(normalizeSymbolsText(" aapl, msft\nAAPL  nvda ")).toEqual(["AAPL", "MSFT", "NVDA"]);
  });

  it("空入力なら空配列を返す", () => {
    expect(normalizeSymbolsText(" , \n ")).toEqual([]);
  });
});

describe("resolveSelectedSymbol", () => {
  const instruments = [{ symbol: "AAPL" }, { symbol: "MSFT" }, { symbol: "NVDA" }];

  it("search.symbol を最優先する", () => {
    expect(resolveSelectedSymbol({ symbol: "TSLA", q: "AAP" }, instruments)).toBe("TSLA");
  });

  it("query が一致すればその symbol を選ぶ", () => {
    expect(resolveSelectedSymbol({ symbol: undefined, q: "msf" }, instruments)).toBe("MSFT");
  });

  it("候補がなければ先頭を返す", () => {
    expect(resolveSelectedSymbol({ symbol: undefined, q: undefined }, instruments)).toBe("AAPL");
  });
});

describe("createRequestSignal", () => {
  it("上流の abort を伝播する", () => {
    const upstreamController = new AbortController();
    const { signal, clear } = createRequestSignal(10_000, upstreamController.signal);

    upstreamController.abort();

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBeInstanceOf(DOMException);
    expect((signal.reason as DOMException).name).toBe("AbortError");

    clear();
  });
});
