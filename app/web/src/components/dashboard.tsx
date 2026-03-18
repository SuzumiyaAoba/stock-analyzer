import type { FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { intervalOptions, labelForInterval, type DashboardSearch } from "~/lib/dashboard-config";
import {
  actionLabel,
  derivePriceChange,
  formatActionValue,
  formatCompactNumber,
  formatDate,
  formatDateTime,
  formatDiff,
  formatPercentChange,
  formatPrice,
} from "~/lib/dashboard-formatters";
import type { DashboardData, InstrumentListItem, PriceBar } from "~/lib/yfinance";

type SyncFeedback = {
  type: "success" | "error";
  message: string;
} | null;

export function HeroPanel({
  apiBaseUrl,
  instrumentCount,
  interval,
  syncSymbolInput,
  syncFeedback,
  isSyncPending,
  onSyncInputChange,
  onSyncSubmit,
}: Readonly<{
  apiBaseUrl: string;
  instrumentCount: number;
  interval: DashboardSearch["interval"];
  syncSymbolInput: string;
  syncFeedback: SyncFeedback;
  isSyncPending: boolean;
  onSyncInputChange: (value: string) => void;
  onSyncSubmit: (event: FormEvent<HTMLFormElement>) => void;
}>) {
  return (
    <section className="hero-panel">
      <p className="eyebrow">Market Data Dashboard</p>
      <div className="hero-heading">
        <div>
          <h1>銘柄探索と価格確認を、ひとつの画面で。</h1>
          <p className="hero-copy">
            同期済みの Yahoo Finance データから銘柄一覧、最新スナップショット、価格推移、
            コーポレートアクションを横断して確認できます。
          </p>
          <form className="sync-form" onSubmit={onSyncSubmit}>
            <label className="search-label" htmlFor="sync-symbol">
              Yahoo Finance から取得して保存
            </label>
            <div className="sync-row">
              <input
                id="sync-symbol"
                className="search-input sync-input"
                value={syncSymbolInput}
                onChange={(event) => onSyncInputChange(event.target.value)}
                placeholder="AAPL, MSFT, NVDA"
              />
              <button className="sync-button" type="submit" disabled={isSyncPending}>
                {isSyncPending ? "取得中..." : "取得して保存"}
              </button>
            </div>
            {syncFeedback ? (
              <p className={`sync-feedback is-${syncFeedback.type}`}>{syncFeedback.message}</p>
            ) : null}
          </form>
        </div>
        <div className="hero-meta">
          <MetricCard label="API Endpoint" value={apiBaseUrl.replace(/^https?:\/\//, "")} />
          <MetricCard label="表示銘柄数" value={`${instrumentCount}`} />
          <MetricCard label="選択中足種別" value={labelForInterval(interval)} />
        </div>
      </div>
    </section>
  );
}

export function InstrumentsPanel({
  search,
  instruments,
  selectedSymbol,
  errorMessage,
  instrumentSearchFor,
}: Readonly<{
  search: DashboardSearch;
  instruments: InstrumentListItem[];
  selectedSymbol: string | null;
  errorMessage: string | null;
  instrumentSearchFor: (symbol: string) => DashboardSearch;
}>) {
  return (
    <aside className="list-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Universe</p>
          <h2>銘柄一覧</h2>
        </div>
        <span className="panel-badge">{instruments.length} symbols</span>
      </div>

      <form className="search-form" action="/" method="get">
        <input type="hidden" name="interval" value={search.interval} />
        <label className="search-label" htmlFor="symbol-query">
          銘柄名またはシンボル
        </label>
        <div className="search-row">
          <input
            id="symbol-query"
            className="search-input"
            name="q"
            defaultValue={search.q ?? ""}
            placeholder="AAPL, Microsoft, Tesla..."
          />
          <button className="search-button" type="submit">
            検索
          </button>
        </div>
      </form>

      <div className="instrument-list">
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {instruments.length > 0 ? (
          instruments.map((item) => {
            const isActive = item.symbol === selectedSymbol;
            return (
              <Link
                key={item.symbol}
                to="/"
                search={instrumentSearchFor(item.symbol)}
                className={`instrument-card${isActive ? " is-active" : ""}`}
              >
                <div className="instrument-card-top">
                  <div>
                    <p className="instrument-symbol">{item.symbol}</p>
                    <p className="instrument-name">{item.shortName || item.longName || "-"}</p>
                  </div>
                  <p className="instrument-price">
                    {formatPrice(item.latestQuote?.regularMarketPrice)}
                  </p>
                </div>
                <div className="instrument-card-bottom">
                  <span>{item.exchange || "-"}</span>
                  <span>{formatPercentChange(item.latestQuote)}</span>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="empty-state">
            <p>一致する銘柄がありません。</p>
            <p>上のフォームから symbol を同期すると、保存済みデータをここで閲覧できます。</p>
          </div>
        )}
      </div>
    </aside>
  );
}

export function InstrumentDetailPanel({
  data,
  search,
  intervalSearchFor,
}: Readonly<{
  data: DashboardData;
  search: DashboardSearch;
  intervalSearchFor: (interval: DashboardSearch["interval"]) => DashboardSearch;
}>) {
  const selected = data.selectedInstrument;
  if (!selected) {
    return (
      <section className="detail-panel">
        <div className="empty-detail">
          <p className="panel-kicker">No Selection</p>
          <h2>表示できる銘柄がありません</h2>
          <p>上部フォームから symbol を取得すると、この画面に一覧と詳細が表示されます。</p>
        </div>
      </section>
    );
  }

  const latest = selected.latestQuote;
  const { latestPrice, diff, diffRatio } = derivePriceChange(latest);

  return (
    <section className="detail-panel">
      <div className="panel-header panel-header-wide">
        <div>
          <p className="panel-kicker">{selected.exchange || "Unknown Exchange"}</p>
          <h2>
            {selected.longName || selected.shortName || selected.symbol}
            <span className="symbol-inline">{selected.symbol}</span>
          </h2>
        </div>
        <div className="interval-switches">
          {intervalOptions.map((option) => (
            <Link
              key={option.value}
              to="/"
              search={intervalSearchFor(option.value)}
              className={`interval-chip${search.interval === option.value ? " is-active" : ""}`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="headline-metrics">
        <div className="price-block">
          <p className="price-label">Latest Quote</p>
          <p className="price-value">{formatPrice(latestPrice)}</p>
          <p className={`price-diff${diff !== null && diff < 0 ? " is-negative" : " is-positive"}`}>
            {formatDiff(diff, diffRatio)}
          </p>
        </div>
        <MetricCard label="Market Cap" value={formatCompactNumber(latest?.marketCap)} />
        <MetricCard label="Volume" value={formatCompactNumber(latest?.regularMarketVolume)} />
        <MetricCard label="As Of" value={formatDateTime(latest?.asOf)} />
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <div>
            <p className="panel-kicker">Price Action</p>
            <h3>{labelForInterval(search.interval)}の終値推移</h3>
          </div>
          <p className="chart-caption">{data.prices.length} points</p>
        </div>
        <PriceSparkline prices={data.prices} />
      </div>

      <div className="detail-grid">
        <section className="subpanel">
          <div className="subpanel-header">
            <p className="panel-kicker">Snapshot</p>
            <h3>主要指標</h3>
          </div>
          <dl className="stats-grid">
            <Stat label="前日終値" value={formatPrice(latest?.previousClose)} />
            <Stat label="当日高値" value={formatPrice(latest?.dayHigh)} />
            <Stat label="当日安値" value={formatPrice(latest?.dayLow)} />
            <Stat label="通貨" value={selected.currency || "-"} />
            <Stat label="種別" value={selected.quoteType || "-"} />
            <Stat label="初回取引日" value={formatDate(selected.firstTradeAt)} />
          </dl>
        </section>

        <section className="subpanel">
          <div className="subpanel-header">
            <p className="panel-kicker">Corporate Actions</p>
            <h3>配当・分割</h3>
          </div>
          {data.actions.length > 0 ? (
            <ul className="action-list">
              {data.actions.map((action) => (
                <li key={`${action.actionType}-${action.eventAt}`} className="action-item">
                  <div>
                    <p className="action-type">{actionLabel(action.actionType)}</p>
                    <p className="action-date">{formatDate(action.eventAt)}</p>
                  </div>
                  <strong>{formatActionValue(action.value, action.actionType)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-inline">コーポレートアクションはありません。</div>
          )}
        </section>
      </div>
    </section>
  );
}

function PriceSparkline({ prices }: Readonly<{ prices: PriceBar[] }>) {
  const points = prices
    .map((price) => price.close)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (points.length < 2) {
    return <div className="empty-inline">価格データが不足しています。</div>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const polyline = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;

  return (
    <div className="sparkline-wrap">
      <svg
        className="sparkline"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-label="price chart"
      >
        <defs>
          <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.18)" />
            <stop offset="100%" stopColor="rgba(37, 99, 235, 0.02)" />
          </linearGradient>
        </defs>
        <polyline points={`0,100 ${polyline} 100,100`} fill="url(#priceArea)" stroke="none" />
        <polyline
          points={polyline}
          fill="none"
          stroke={last >= first ? "#2563eb" : "#dc2626"}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="sparkline-scale">
        <span>{formatPrice(max)}</span>
        <span>{formatPrice(min)}</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="stat-cell">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
