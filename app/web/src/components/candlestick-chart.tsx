import * as React from "react";
import type {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { formatPrice } from "~/lib/dashboard-formatters";
import type { PriceBar } from "~/lib/yfinance";

const useChartEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

type ChartTheme = {
  background: string;
  text: string;
  grid: string;
  crosshair: string;
  crosshairBackground: string;
  up: string;
  down: string;
  fontFamily: string;
};

function readThemeValue(name: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function getChartTheme(): ChartTheme {
  return {
    background: readThemeValue("--page-background", "#f7f1e6"),
    text: readThemeValue("--muted-foreground", "#5f6a77"),
    grid: "rgba(0, 0, 0, 0)",
    crosshair: readThemeValue("--accent", "#1f6c73"),
    crosshairBackground: readThemeValue("--page-background", "#f7f1e6"),
    up: readThemeValue("--success", "#13795b"),
    down: readThemeValue("--danger", "#b45144"),
    fontFamily: readThemeValue("--font-body", '"IBM Plex Sans JP", sans-serif'),
  };
}

function toCandlestickData(prices: PriceBar[]): CandlestickData<Time>[] {
  return prices.flatMap((price) => {
    const { open, high, low, close } = price;
    if (
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      return [];
    }

    const timestamp = Date.parse(price.timestampUtc);
    if (!Number.isFinite(timestamp)) {
      return [];
    }

    return [
      {
        time: Math.floor(timestamp / 1000) as UTCTimestamp,
        open,
        high,
        low,
        close,
      },
    ];
  });
}

export function CandlestickChart({
  prices,
  currency,
}: Readonly<{
  prices: PriceBar[];
  currency?: string | null;
}>) {
  const chartContainerRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const seriesRef = React.useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const deferredPrices = React.useDeferredValue(prices);
  const seriesData = React.useMemo(() => toCandlestickData(deferredPrices), [deferredPrices]);
  const chartTheme = React.useMemo(() => getChartTheme(), []);
  const priceFormatter = React.useMemo(
    () => (value: number) => formatPrice(value, currency),
    [currency],
  );
  const canRenderChart = seriesData.length >= 2;

  useChartEffect(() => {
    if (!chartContainerRef.current || !canRenderChart) {
      return;
    }

    const container = chartContainerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    void import("lightweight-charts").then(({ CandlestickSeries, ColorType, createChart }) => {
      if (disposed || !chartContainerRef.current || chartRef.current) {
        return;
      }

      const createdChart = createChart(container, {
        width: container.clientWidth || 640,
        height: 320,
        layout: {
          background: {
            type: ColorType.Solid,
            color: chartTheme.background,
          },
          textColor: chartTheme.text,
          fontFamily: chartTheme.fontFamily,
        },
        grid: {
          vertLines: {
            color: chartTheme.grid,
          },
          horzLines: {
            color: chartTheme.grid,
          },
        },
        rightPriceScale: {
          borderVisible: false,
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
        },
        crosshair: {
          vertLine: {
            color: chartTheme.crosshair,
            labelBackgroundColor: chartTheme.crosshairBackground,
          },
          horzLine: {
            color: chartTheme.crosshair,
            labelBackgroundColor: chartTheme.crosshairBackground,
          },
        },
        localization: {
          locale: "en-US",
        },
      });

      chartRef.current = createdChart;

      const candlestickSeries = createdChart.addSeries(CandlestickSeries, {
        upColor: chartTheme.up,
        downColor: chartTheme.down,
        wickUpColor: chartTheme.up,
        wickDownColor: chartTheme.down,
        borderVisible: false,
        priceFormat: {
          type: "custom",
          minMove: 0.01,
          formatter: (value: number) => formatPrice(value),
        },
      });

      seriesRef.current = candlestickSeries;

      resizeObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? container.clientWidth;
        if (!width) {
          return;
        }

        createdChart.applyOptions({
          width,
        });
      });

      resizeObserver.observe(container);
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      seriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [canRenderChart, chartTheme]);

  useChartEffect(() => {
    if (!canRenderChart || !chartRef.current || !seriesRef.current) {
      return;
    }

    chartRef.current.applyOptions({
      localization: {
        locale: currency === "JPY" ? "ja-JP" : "en-US",
      },
    });
    seriesRef.current.applyOptions({
      priceFormat: {
        type: "custom",
        minMove: currency === "JPY" ? 1 : 0.01,
        formatter: priceFormatter,
      },
    });
    seriesRef.current.setData(seriesData);
    chartRef.current.timeScale().fitContent();
  }, [canRenderChart, currency, priceFormatter, seriesData]);

  if (!canRenderChart) {
    return (
      <div className="text-sm text-[color:var(--muted-foreground)]">
        ローソク足を表示する価格データが不足しています。
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div
        ref={chartContainerRef}
        className="h-[320px] w-full overflow-hidden max-sm:h-[260px]"
        role="img"
        aria-label="株価のローソク足チャート"
      />
      <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
        TradingView Lightweight Charts™ Copyright (c) 2025 TradingView, Inc.
        <a
          className="ml-1 text-[color:var(--accent)] hover:underline"
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noreferrer"
        >
          TradingView
        </a>
      </p>
    </div>
  );
}
