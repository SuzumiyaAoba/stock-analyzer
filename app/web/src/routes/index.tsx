import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getDashboardData } from "~/lib/yfinance";

const intervalOptions = [
  { value: "1d", label: "1日足" },
  { value: "1wk", label: "週足" },
  { value: "1mo", label: "月足" },
] as const;

const searchSchema = z.object({
  q: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  symbol: z
    .string()
    .optional()
    .transform((value) => value?.trim().toUpperCase() || undefined),
  interval: z.enum(["1d", "1wk", "1mo"]).optional().default("1d"),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getDashboardData({ data: deps }),
  component: HomePage,
});

function HomePage() {
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  const selected = data.selectedInstrument;
  const latest = selected?.latestQuote;
  const latestPrice = latest?.regularMarketPrice ?? null;
  const previousClose = latest?.previousClose ?? null;
  const diff = latestPrice !== null && previousClose !== null ? latestPrice - previousClose : null;
  const diffRatio =
    diff !== null && previousClose && previousClose !== 0 ? (diff / previousClose) * 100 : null;

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">TanStack Start x yfinance</p>
        <div className="hero-heading">
          <div>
            <h1>銘柄探索と価格確認を、ひとつの画面で。</h1>
            <p className="hero-copy">
              同期済みの Yahoo Finance データから銘柄一覧、最新スナップショット、価格推移、
              コーポレートアクションを横断して確認できます。
            </p>
          </div>
          <div className="hero-meta">
            <MetricCard label="API Endpoint" value={data.apiBaseUrl.replace(/^https?:\/\//, "")} />
            <MetricCard label="表示銘柄数" value={`${data.instruments.length}`} />
            <MetricCard label="選択中足種別" value={labelForInterval(search.interval)} />
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <aside className="list-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Universe</p>
              <h2>銘柄一覧</h2>
            </div>
            <span className="panel-badge">{data.instruments.length} symbols</span>
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
                Search
              </button>
            </div>
          </form>

          <div className="instrument-list">
            {data.errorMessage ? <div className="error-banner">{data.errorMessage}</div> : null}
            {data.instruments.length > 0 ? (
              data.instruments.map((item) => {
                const isActive = item.symbol === data.selectedSymbol;
                return (
                  <Link
                    key={item.symbol}
                    to="/"
                    search={(prev) => ({
                      ...prev,
                      q: search.q,
                      interval: search.interval,
                      symbol: item.symbol,
                    })}
                    className={`instrument-card${isActive ? " is-active" : ""}`}
                  >
                    <div className="instrument-card-top">
                      <div>
                        <p className="instrument-symbol">{item.symbol}</p>
                        <p className="instrument-name">{item.shortName || item.longName || "-"}</p>
                      </div>
                      <p className="instrument-price">{formatPrice(item.latestQuote?.regularMarketPrice)}</p>
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
                <p>`app/yfinance` で同期済み銘柄を追加してから再度確認してください。</p>
              </div>
            )}
          </div>
        </aside>

        <section className="detail-panel">
          {selected ? (
            <>
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
                      search={(prev) => ({
                        ...prev,
                        q: search.q,
                        symbol: data.selectedSymbol || undefined,
                        interval: option.value,
                      })}
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
            </>
          ) : (
            <div className="empty-detail">
              <p className="panel-kicker">No Selection</p>
              <h2>表示できる銘柄がありません</h2>
              <p>
                `app/yfinance` の同期 API で銘柄データを保存すると、この画面に一覧と詳細が表示されます。
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function PriceSparkline({ prices }: Readonly<{ prices: Array<{ timestampUtc: string; close: number | null }> }>) {
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
      <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="price chart">
        <defs>
          <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(233, 145, 56, 0.45)" />
            <stop offset="100%" stopColor="rgba(233, 145, 56, 0.02)" />
          </linearGradient>
        </defs>
        <polyline
          points={`0,100 ${polyline} 100,100`}
          fill="url(#priceArea)"
          stroke="none"
        />
        <polyline
          points={polyline}
          fill="none"
          stroke={last >= first ? "#f1a95b" : "#d36d4c"}
          strokeWidth="2.5"
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

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDiff(diff: number | null, ratio: number | null) {
  if (diff === null || ratio === null) {
    return "前日比 -";
  }

  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)} (${sign}${ratio.toFixed(2)}%)`;
}

function formatPercentChange(
  quote:
    | {
        regularMarketPrice: number | null;
        previousClose: number | null;
      }
    | null
    | undefined,
) {
  if (!quote || quote.regularMarketPrice === null || quote.previousClose === null || quote.previousClose === 0) {
    return "-";
  }

  const ratio = ((quote.regularMarketPrice - quote.previousClose) / quote.previousClose) * 100;
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${ratio.toFixed(2)}%`;
}

function formatActionValue(value: number | null, type: "dividend" | "split" | "capitalGain") {
  if (value === null) {
    return "-";
  }

  if (type === "split") {
    return `${value.toFixed(2)}x`;
  }

  return formatPrice(value);
}

function actionLabel(type: "dividend" | "split" | "capitalGain") {
  if (type === "dividend") {
    return "Dividend";
  }

  if (type === "split") {
    return "Split";
  }

  return "Capital Gain";
}

function labelForInterval(interval: "1d" | "1wk" | "1mo") {
  return intervalOptions.find((option) => option.value === interval)?.label || interval;
}
