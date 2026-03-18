import * as React from "react";
import type { CandlestickData, IChartApi, Time, UTCTimestamp } from "lightweight-charts";
import { formatPrice } from "~/lib/dashboard-formatters";
import type { PriceBar } from "~/lib/yfinance";

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
  const seriesData = React.useMemo(() => toCandlestickData(prices), [prices]);
  const priceFormatter = React.useMemo(
    () => (value: number) => formatPrice(value, currency),
    [currency],
  );

  React.useEffect(() => {
    if (!chartContainerRef.current || seriesData.length < 2) {
      return;
    }

    const container = chartContainerRef.current;
    let chart: IChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    void import("lightweight-charts").then(({ CandlestickSeries, ColorType, createChart }) => {
      if (disposed || !chartContainerRef.current) {
        return;
      }

      const createdChart = createChart(container, {
        width: container.clientWidth || 640,
        height: 320,
        layout: {
          background: {
            type: ColorType.Solid,
            color: "#ffffff",
          },
          textColor: "#5b6777",
          fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
        },
        grid: {
          vertLines: {
            color: "#eef2f7",
          },
          horzLines: {
            color: "#eef2f7",
          },
        },
        rightPriceScale: {
          borderColor: "#d7dee8",
        },
        timeScale: {
          borderColor: "#d7dee8",
          timeVisible: true,
        },
        crosshair: {
          vertLine: {
            color: "#94a3b8",
            labelBackgroundColor: "#475569",
          },
          horzLine: {
            color: "#94a3b8",
            labelBackgroundColor: "#475569",
          },
        },
        localization: {
          locale: currency === "JPY" ? "ja-JP" : "en-US",
        },
      });

      chart = createdChart;

      const candlestickSeries = createdChart.addSeries(CandlestickSeries, {
        upColor: "#15803d",
        downColor: "#dc2626",
        wickUpColor: "#15803d",
        wickDownColor: "#dc2626",
        borderVisible: false,
        priceFormat: {
          type: "custom",
          minMove: currency === "JPY" ? 1 : 0.01,
          formatter: priceFormatter,
        },
      });

      candlestickSeries.setData(seriesData);
      createdChart.timeScale().fitContent();

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
      chart?.remove();
    };
  }, [currency, priceFormatter, seriesData]);

  if (seriesData.length < 2) {
    return <div className="empty-inline">ローソク足を表示する価格データが不足しています。</div>;
  }

  return (
    <div className="chart-wrap">
      <div ref={chartContainerRef} className="candlestick-chart" aria-label="candlestick chart" />
      <p className="chart-attribution">
        TradingView Lightweight Charts™ Copyright (c) 2025 TradingView, Inc.
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          TradingView
        </a>
      </p>
    </div>
  );
}
