import type { DashboardInterval } from "./dashboard-config";

export function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDiff(diff: number | null, ratio: number | null) {
  if (diff === null || ratio === null) {
    return "前日比 -";
  }

  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)} (${sign}${ratio.toFixed(2)}%)`;
}

export function formatPercentChange(
  quote:
    | {
        regularMarketPrice: number | null;
        previousClose: number | null;
      }
    | null
    | undefined,
) {
  if (
    !quote ||
    quote.regularMarketPrice === null ||
    quote.previousClose === null ||
    quote.previousClose === 0
  ) {
    return "-";
  }

  const ratio = ((quote.regularMarketPrice - quote.previousClose) / quote.previousClose) * 100;
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${ratio.toFixed(2)}%`;
}

export function formatActionValue(
  value: number | null,
  type: "dividend" | "split" | "capitalGain",
) {
  if (value === null) {
    return "-";
  }

  if (type === "split") {
    return `${value.toFixed(2)}x`;
  }

  return formatPrice(value);
}

export function actionLabel(type: "dividend" | "split" | "capitalGain") {
  if (type === "dividend") {
    return "Dividend";
  }

  if (type === "split") {
    return "Split";
  }

  return "Capital Gain";
}

export function derivePriceChange(
  latestQuote:
    | {
        regularMarketPrice: number | null;
        previousClose: number | null;
      }
    | null
    | undefined,
) {
  const latestPrice = latestQuote?.regularMarketPrice ?? null;
  const previousClose = latestQuote?.previousClose ?? null;
  const diff = latestPrice !== null && previousClose !== null ? latestPrice - previousClose : null;
  const diffRatio =
    diff !== null && previousClose && previousClose !== 0 ? (diff / previousClose) * 100 : null;

  return {
    latestPrice,
    diff,
    diffRatio,
  };
}

export function buildSearchLabel(
  interval: DashboardInterval,
  labelForInterval: (value: DashboardInterval) => string,
) {
  return labelForInterval(interval);
}
