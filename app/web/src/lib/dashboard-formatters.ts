import type { DashboardInterval } from "./dashboard-config";

const compactNumberFormatter = new Intl.NumberFormat("ja-JP", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function toValidDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCurrency(currency: string | null | undefined) {
  if (!currency) {
    return "USD";
  }

  try {
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(0);
    return currency;
  } catch {
    return "USD";
  }
}

function localeForCurrency(currency: string) {
  return currency === "JPY" ? "ja-JP" : "en-US";
}

function currencyFractionDigits(currency: string) {
  return currency === "JPY" ? 0 : 2;
}

function formatCurrencyNumber(value: number, currency: string) {
  const normalizedCurrency = normalizeCurrency(currency);
  const maximumFractionDigits = currencyFractionDigits(normalizedCurrency);

  return new Intl.NumberFormat(localeForCurrency(normalizedCurrency), {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export function formatPrice(value: number | null | undefined, currency?: string | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  return formatCurrencyNumber(value, currency ?? "USD");
}

export function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return compactNumberFormatter.format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = toValidDate(value);
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = toValidDate(value);
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDiff(diff: number | null, ratio: number | null, currency?: string | null) {
  if (diff === null || ratio === null) {
    return "前日比 -";
  }

  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  const formattedDiff = formatCurrencyNumber(Math.abs(diff), currency ?? "USD");
  const formattedRatio = `${ratio > 0 ? "+" : ratio < 0 ? "-" : ""}${Math.abs(ratio).toFixed(2)}%`;
  return `${sign}${formattedDiff} (${formattedRatio})`;
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
  currency?: string | null,
) {
  if (value === null) {
    return "-";
  }

  if (type === "split") {
    return `${value.toFixed(2)}x`;
  }

  return formatPrice(value, currency);
}

export function actionLabel(type: "dividend" | "split" | "capitalGain") {
  if (type === "dividend") {
    return "配当";
  }

  if (type === "split") {
    return "株式分割";
  }

  return "キャピタルゲイン";
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
