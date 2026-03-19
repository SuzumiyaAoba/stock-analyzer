import type { DashboardSearch } from "./dashboard-config";

type SearchSymbolSource = Pick<DashboardSearch, "q" | "symbol">;
type SymbolLike = {
  symbol: string;
};

function createAbortError(reason?: unknown) {
  if (reason instanceof DOMException && reason.name === "AbortError") {
    return reason;
  }

  return new DOMException("The operation was aborted.", "AbortError");
}

export function createRequestSignal(timeoutMs: number, upstreamSignal?: AbortSignal | null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "AbortError"));
  }, timeoutMs);

  function abortFromUpstream() {
    if (!controller.signal.aborted) {
      controller.abort(createAbortError(upstreamSignal?.reason));
    }
  }

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      abortFromUpstream();
    } else {
      upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
    }
  }

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
    },
  };
}

export function normalizeSymbolsText(symbolsText: string) {
  return [
    ...new Set(
      symbolsText
        .split(/[\s,]+/)
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

export function resolveSelectedSymbol(
  search: SearchSymbolSource,
  instruments: readonly SymbolLike[],
) {
  if (search.symbol) {
    return search.symbol;
  }

  const normalizedQuery = search.q?.toUpperCase();
  if (normalizedQuery) {
    const matchedSymbol = instruments.find((item) => item.symbol.includes(normalizedQuery))?.symbol;
    if (matchedSymbol) {
      return matchedSymbol;
    }
  }

  return instruments[0]?.symbol ?? null;
}
