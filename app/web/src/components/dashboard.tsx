import * as React from "react";
import type { FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { CandlestickChart } from "~/components/candlestick-chart";
import {
  actionLimitOptions,
  actionTypeOptions,
  instrumentSortOptions,
  intervalOptions,
  labelForInterval,
  listLimitOptions,
  orderOptions,
  priceLimitOptions,
  syncHistoryIntervalOptions,
  syncHistoryRangeOptions,
  type SyncHistoryInterval,
  type SyncHistoryRange,
  type DashboardSearch,
} from "~/lib/dashboard-config";
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
import type {
  DashboardData,
  InstrumentListItem,
  SymbolSyncResult,
  SyncJobRun,
} from "~/lib/yfinance";

type Feedback = {
  type: "success" | "error";
  message: string;
} | null;

type SearchFactory = (search: Partial<DashboardSearch>) => DashboardSearch;

export function OperationsPanel({
  data,
  syncSymbolInput,
  syncFeedback,
  isSyncPending,
  onSyncInputChange,
  onSyncSubmit,
  batchSymbolsInput,
  batchInterval,
  batchRange,
  batchIncludePrePost,
  batchSkipQuote,
  batchFeedback,
  isBatchPending,
  onBatchSymbolsInputChange,
  onBatchIntervalChange,
  onBatchRangeChange,
  onBatchIncludePrePostChange,
  onBatchSkipQuoteChange,
  onBatchSubmit,
  jobFeedback,
  isJobPending,
  onRunSyncJob,
}: Readonly<{
  data: DashboardData;
  syncSymbolInput: string;
  syncFeedback: Feedback;
  isSyncPending: boolean;
  onSyncInputChange: (value: string) => void;
  onSyncSubmit: (event: FormEvent<HTMLFormElement>) => void;
  batchSymbolsInput: string;
  batchInterval: SyncHistoryInterval;
  batchRange: SyncHistoryRange;
  batchIncludePrePost: boolean;
  batchSkipQuote: boolean;
  batchFeedback: Feedback;
  isBatchPending: boolean;
  onBatchSymbolsInputChange: (value: string) => void;
  onBatchIntervalChange: (value: SyncHistoryInterval) => void;
  onBatchRangeChange: (value: SyncHistoryRange) => void;
  onBatchIncludePrePostChange: (checked: boolean) => void;
  onBatchSkipQuoteChange: (checked: boolean) => void;
  onBatchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  jobFeedback: Feedback;
  isJobPending: boolean;
  onRunSyncJob: () => void;
}>) {
  const syncJob = data.syncJob;
  const canRunSyncJob = Boolean(syncJob && syncJob.symbols.length > 0);
  const syncSymbolId = React.useId();
  const batchSymbolsId = React.useId();
  const batchIntervalId = React.useId();
  const batchRangeId = React.useId();

  return (
    <section className="hero-panel">
      <div className="hero-grid">
        <article className="hero-card">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Quick Sync</p>
              <h2>単体同期</h2>
            </div>
          </div>
          <p className="hero-description">
            `sync/history` と `sync/quote` をまとめて呼び出し、日足・週足・月足を保存します。
          </p>
          <form className="stack-form" onSubmit={onSyncSubmit}>
            <div className="sync-row">
              <input
                id={syncSymbolId}
                aria-label="銘柄コード"
                className="search-input sync-input"
                value={syncSymbolInput}
                onChange={(event) => onSyncInputChange(event.target.value)}
                placeholder="AAPL, MSFT, NVDA"
              />
              <button className="sync-button" type="submit" disabled={isSyncPending}>
                {isSyncPending ? "取得中..." : "単体同期"}
              </button>
            </div>
            <FeedbackMessage feedback={syncFeedback} />
          </form>
        </article>

        <article className="hero-card">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Batch Sync</p>
              <h2>一括同期</h2>
            </div>
          </div>
          <p className="hero-description">
            `sync/batch`
            を使って複数銘柄をまとめて取得します。改行またはカンマ区切りで入力できます。
          </p>
          <form className="stack-form" onSubmit={onBatchSubmit}>
            <label className="field" htmlFor={batchSymbolsId}>
              <span>銘柄コード</span>
              <textarea
                id={batchSymbolsId}
                className="search-input batch-textarea"
                value={batchSymbolsInput}
                onChange={(event) => onBatchSymbolsInputChange(event.target.value)}
                placeholder={"AAPL\nMSFT\nNVDA"}
                rows={4}
              />
            </label>
            <div className="form-grid">
              <label className="field" htmlFor={batchIntervalId}>
                <span>足種別</span>
                <select
                  id={batchIntervalId}
                  className="search-input"
                  value={batchInterval}
                  onChange={(event) =>
                    onBatchIntervalChange(event.target.value as SyncHistoryInterval)
                  }
                >
                  {syncHistoryIntervalOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor={batchRangeId}>
                <span>取得期間</span>
                <select
                  id={batchRangeId}
                  className="search-input"
                  value={batchRange}
                  onChange={(event) => onBatchRangeChange(event.target.value as SyncHistoryRange)}
                >
                  {syncHistoryRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="checkbox-row">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={batchIncludePrePost}
                  onChange={(event) => onBatchIncludePrePostChange(event.target.checked)}
                />
                <span>時間外取引を含める</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={batchSkipQuote}
                  onChange={(event) => onBatchSkipQuoteChange(event.target.checked)}
                />
                <span>quote 同期を省略</span>
              </label>
            </div>
            <button className="sync-button" type="submit" disabled={isBatchPending}>
              {isBatchPending ? "同期中..." : "一括同期"}
            </button>
            <FeedbackMessage feedback={batchFeedback} />
          </form>
        </article>

        <article className="hero-card">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Scheduler</p>
              <h2>API / 定期同期</h2>
            </div>
            <span className={`status-pill${data.apiHealth.ok ? " is-success" : " is-error"}`}>
              {data.apiHealth.ok ? "API Online" : "API Error"}
            </span>
          </div>
          <dl className="info-list">
            <InfoRow label="API URL" value={data.apiBaseUrl} />
            <InfoRow
              label="ジョブ有効"
              value={syncJob ? formatBoolean(syncJob.enabled) : "取得できません"}
            />
            <InfoRow
              label="実行中"
              value={syncJob ? formatBoolean(syncJob.isRunning) : "取得できません"}
            />
            <InfoRow label="対象銘柄" value={syncJob?.symbols.join(", ") || "-"} />
            <InfoRow label="実行間隔" value={formatIntervalMs(syncJob?.intervalMs ?? 0)} />
            <InfoRow
              label="履歴設定"
              value={
                syncJob ? `${syncJob.historyInterval} / ${syncJob.historyRange}` : "取得できません"
              }
            />
            <InfoRow
              label="直近開始"
              value={syncJob ? formatDateTime(syncJob.lastRunStartedAt) : "取得できません"}
            />
            <InfoRow
              label="直近完了"
              value={syncJob ? formatDateTime(syncJob.lastRunFinishedAt) : "取得できません"}
            />
          </dl>
          {data.apiHealth.errorMessage ? (
            <div className="error-banner compact">{data.apiHealth.errorMessage}</div>
          ) : null}
          {syncJob?.lastRunError ? (
            <div className="error-banner compact">{syncJob.lastRunError}</div>
          ) : null}
          <button
            className="search-button full-width"
            type="button"
            onClick={onRunSyncJob}
            disabled={!canRunSyncJob || isJobPending}
          >
            {isJobPending ? "実行中..." : "定期同期ジョブを即時実行"}
          </button>
          {!canRunSyncJob ? (
            <FeedbackMessage
              feedback={{
                type: "error",
                message:
                  "`SYNC_SYMBOLS` が未設定、またはジョブ状態を取得できないため、実行できません。",
              }}
            />
          ) : null}
          <FeedbackMessage feedback={jobFeedback} />

          {syncJob?.lastRunResults.length ? (
            <div className="result-stack">
              <p className="section-label">直近ジョブ結果</p>
              <ul className="mini-result-list">
                {syncJob.lastRunResults.map((result) => (
                  <SyncResultSummary
                    key={`${result.symbol}-${result.interval}`}
                    result={result}
                    className="mini-result-item"
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}

export function InstrumentsPanel({
  search,
  instruments,
  hasPreviousPage,
  hasNextPage,
  selectedSymbol,
  errorMessage,
  instrumentSearchFor,
  pageSearchFor,
}: Readonly<{
  search: DashboardSearch;
  instruments: InstrumentListItem[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  selectedSymbol: string | null;
  errorMessage: string | null;
  instrumentSearchFor: (symbol: string) => DashboardSearch;
  pageSearchFor: (offset: number) => DashboardSearch;
}>) {
  const router = useRouter();
  const queryInputId = React.useId();
  const sortById = React.useId();
  const orderId = React.useId();
  const listLimitId = React.useId();
  const pageStart = instruments.length > 0 ? search.offset + 1 : 0;
  const pageEnd = search.offset + instruments.length;
  const [query, setQuery] = useSyncedState(search.q ?? "");
  const [sortBy, setSortBy] = useSyncedState(search.sortBy);
  const [order, setOrder] = useSyncedState(search.order);
  const [listLimit, setListLimit] = useSyncedState(search.listLimit);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void router.navigate({
      to: "/",
      search: {
        ...search,
        q: normalizeOptionalInputValue(query),
        symbol: undefined,
        offset: 0,
      },
    });
  }

  function handleListControlsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void router.navigate({
      to: "/",
      search: {
        ...search,
        sortBy,
        order,
        listLimit,
        offset: 0,
      },
    });
  }

  return (
    <aside className="list-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Universe</p>
          <h2>銘柄一覧</h2>
        </div>
        <span className="panel-badge">{instruments.length} symbols</span>
      </div>

      <form className="search-form" onSubmit={handleSearchSubmit}>
        <label className="search-label" htmlFor={queryInputId}>
          銘柄名またはシンボル
        </label>
        <div className="search-row">
          <input
            id={queryInputId}
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="AAPL, Microsoft, Tesla..."
          />
          <button className="search-button" type="submit">
            検索
          </button>
        </div>
      </form>

      <form className="list-controls-form" onSubmit={handleListControlsSubmit}>
        <div className="filter-grid compact">
          <label className="field" htmlFor={sortById}>
            <span>並び順</span>
            <select
              id={sortById}
              className="search-input"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as DashboardSearch["sortBy"])}
            >
              {instrumentSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor={orderId}>
            <span>順序</span>
            <select
              id={orderId}
              className="search-input"
              value={order}
              onChange={(event) => setOrder(event.target.value as DashboardSearch["order"])}
            >
              {orderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor={listLimitId}>
            <span>件数</span>
            <select
              id={listLimitId}
              className="search-input"
              value={String(listLimit)}
              onChange={(event) => setListLimit(Number(event.target.value))}
            >
              {listLimitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="search-button full-width" type="submit">
          一覧条件を反映
        </button>
      </form>

      <div className="list-summary">
        <span>{pageStart > 0 ? `${pageStart}-${pageEnd}` : "0"} 件を表示中</span>
        <div className="pagination-row">
          <PagerLink
            enabled={hasPreviousPage}
            search={pageSearchFor(Math.max(search.offset - search.listLimit, 0))}
          >
            前へ
          </PagerLink>
          <PagerLink enabled={hasNextPage} search={pageSearchFor(search.offset + search.listLimit)}>
            次へ
          </PagerLink>
        </div>
      </div>

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
                aria-current={isActive ? "page" : undefined}
              >
                <div className="instrument-card-top">
                  <div>
                    <p className="instrument-symbol">{item.symbol}</p>
                    <p className="instrument-name">{item.shortName || item.longName || "-"}</p>
                  </div>
                  <p className="instrument-price">
                    {formatPrice(item.latestQuote?.regularMarketPrice, item.currency)}
                  </p>
                </div>
                <div className="instrument-card-bottom">
                  <span>{item.exchange || "-"}</span>
                  <span>{formatPercentChange(item.latestQuote)}</span>
                </div>
                <div className="instrument-card-meta">
                  <span>{item.currency || "-"}</span>
                  <span>{formatDateTime(item.latestQuote?.asOf ?? item.updatedAt)}</span>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="empty-state">
            <p>一致する銘柄がありません。</p>
            <p>上部フォームから symbol を同期すると、保存済みデータをここで閲覧できます。</p>
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
  clearDetailFiltersSearchFor,
}: Readonly<{
  data: DashboardData;
  search: DashboardSearch;
  intervalSearchFor: (interval: DashboardSearch["interval"]) => DashboardSearch;
  clearDetailFiltersSearchFor: SearchFactory;
}>) {
  const router = useRouter();
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
  const selectedSymbol = selected.symbol;
  const currency = selected.currency;
  const { latestPrice, diff, diffRatio } = derivePriceChange(latest);
  const fromInputId = React.useId();
  const toInputId = React.useId();
  const priceLimitId = React.useId();
  const actionTypeId = React.useId();
  const actionLimitId = React.useId();
  const [from, setFrom] = useSyncedState(search.from ?? "");
  const [to, setTo] = useSyncedState(search.to ?? "");
  const [priceLimit, setPriceLimit] = useSyncedState(search.priceLimit);
  const [actionType, setActionType] = useSyncedState(search.actionType);
  const [actionLimit, setActionLimit] = useSyncedState(search.actionLimit);

  function handleDetailFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void router.navigate({
      to: "/",
      search: {
        ...search,
        symbol: selectedSymbol,
        from: normalizeOptionalInputValue(from),
        to: normalizeOptionalInputValue(to),
        priceLimit,
        actionType,
        actionLimit,
        offset: 0,
      },
    });
  }

  return (
    <section className="detail-panel">
      <div className="panel-header panel-header-wide">
        <div>
          <p className="panel-kicker">{selected.exchange || "Unknown Exchange"}</p>
          <h2>
            {selected.longName || selected.shortName || selectedSymbol}
            <span className="symbol-inline">{selectedSymbol}</span>
          </h2>
        </div>
        <div className="interval-switches">
          {intervalOptions.map((option) => (
            <Link
              key={option.value}
              to="/"
              search={intervalSearchFor(option.value)}
              className={`interval-chip${search.interval === option.value ? " is-active" : ""}`}
              aria-current={search.interval === option.value ? "page" : undefined}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <form className="detail-filter-form" onSubmit={handleDetailFilterSubmit}>
        <div className="filter-grid">
          <label className="field" htmlFor={fromInputId}>
            <span>開始日</span>
            <input
              id={fromInputId}
              className="search-input"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="field" htmlFor={toInputId}>
            <span>終了日</span>
            <input
              id={toInputId}
              className="search-input"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label className="field" htmlFor={priceLimitId}>
            <span>価格本数</span>
            <select
              id={priceLimitId}
              className="search-input"
              value={String(priceLimit)}
              onChange={(event) => setPriceLimit(Number(event.target.value))}
            >
              {priceLimitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor={actionTypeId}>
            <span>アクション種別</span>
            <select
              id={actionTypeId}
              className="search-input"
              value={actionType}
              onChange={(event) =>
                setActionType(event.target.value as DashboardSearch["actionType"])
              }
            >
              {actionTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor={actionLimitId}>
            <span>アクション件数</span>
            <select
              id={actionLimitId}
              className="search-input"
              value={String(actionLimit)}
              onChange={(event) => setActionLimit(Number(event.target.value))}
            >
              {actionLimitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button className="search-button" type="submit">
            期間・表示条件を反映
          </button>
          <Link
            to="/"
            search={clearDetailFiltersSearchFor({
              from: undefined,
              to: undefined,
              priceLimit: 60,
              actionType: "all",
              actionLimit: 12,
              offset: 0,
            })}
            className="secondary-button"
          >
            フィルタを解除
          </Link>
        </div>
      </form>

      <div className="headline-metrics">
        <div className="price-block">
          <p className="price-label">最新価格</p>
          <p className="price-value">{formatPrice(latestPrice, currency)}</p>
          <p
            className={`price-diff${
              diff === null ? "" : diff < 0 ? " is-negative" : " is-positive"
            }`}
          >
            {formatDiff(diff, diffRatio, currency)}
          </p>
        </div>
        <MetricCard label="時価総額" value={formatCompactNumber(latest?.marketCap)} />
        <MetricCard label="出来高" value={formatCompactNumber(latest?.regularMarketVolume)} />
        <MetricCard label="取得時点" value={formatDateTime(latest?.asOf)} />
        <MetricCard label="DB 更新" value={formatDateTime(selected.updatedAt)} />
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <div>
            <p className="panel-kicker">Price Action</p>
            <h3>{labelForInterval(search.interval)}の価格推移</h3>
          </div>
          <p className="chart-caption">{data.prices.length} 本</p>
        </div>
        <CandlestickChart prices={data.prices} currency={currency} />
      </div>

      <div className="detail-grid">
        <section className="subpanel">
          <div className="subpanel-header">
            <p className="panel-kicker">Snapshot</p>
            <h3>主要指標</h3>
          </div>
          <dl className="stats-grid">
            <Stat label="前日終値" value={formatPrice(latest?.previousClose, currency)} />
            <Stat label="当日高値" value={formatPrice(latest?.dayHigh, currency)} />
            <Stat label="当日安値" value={formatPrice(latest?.dayLow, currency)} />
            <Stat label="通貨" value={selected.currency || "-"} />
            <Stat label="市場" value={selected.exchange || "-"} />
            <Stat label="種別" value={selected.quoteType || "-"} />
            <Stat label="タイムゾーン" value={selected.timezone || "-"} />
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
                  <strong>{formatActionValue(action.value, action.actionType, currency)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-inline">条件に一致するコーポレートアクションはありません。</div>
          )}
        </section>
      </div>

      <section className="subpanel sync-runs-panel">
        <div className="subpanel-header">
          <p className="panel-kicker">Sync Runs</p>
          <h3>定期同期の実行履歴</h3>
        </div>
        {data.syncRuns.length > 0 ? (
          <ul className="run-list">
            {data.syncRuns.map((run) => (
              <SyncRunItem key={run.id} run={run} />
            ))}
          </ul>
        ) : (
          <div className="empty-inline">実行履歴はまだありません。</div>
        )}
      </section>
    </section>
  );
}

function SyncRunItem({ run }: Readonly<{ run: SyncJobRun }>) {
  return (
    <li className="run-item">
      <div className="run-item-header">
        <div className="run-title-row">
          <strong>#{run.id}</strong>
          <span className={`status-pill${statusPillClass(run.status)}`}>
            {statusLabel(run.status)}
          </span>
          <span className="run-source">{run.source}</span>
        </div>
        <span className="chart-caption">{run.symbolCount} 銘柄</span>
      </div>
      <div className="run-meta-grid">
        <InfoBlock label="開始" value={formatDateTime(run.startedAt)} />
        <InfoBlock label="終了" value={formatDateTime(run.finishedAt)} />
        <InfoBlock label="エラー" value={run.errorMessage || "-"} />
      </div>
      {run.results.length > 0 ? (
        <ul className="run-result-list">
          {run.results.map((result) => (
            <SyncResultSummary
              key={`${run.id}-${result.symbol}-${result.interval}`}
              result={result}
              className="run-result-item"
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SyncResultSummary({
  result,
  className,
}: Readonly<{
  result: SymbolSyncResult;
  className: string;
}>) {
  return (
    <li className={className}>
      <strong>{result.symbol}</strong>
      <span>{result.interval}</span>
      <span>{result.barsInserted} 本</span>
      <span>{result.actionsInserted} 件</span>
      <span>{result.quoteSynced ? "quote 同期済み" : "quote 省略"}</span>
    </li>
  );
}

function PagerLink({
  enabled,
  search,
  children,
}: Readonly<{
  enabled: boolean;
  search: DashboardSearch;
  children: string;
}>) {
  if (!enabled) {
    return <span className="pager-button is-disabled">{children}</span>;
  }

  return (
    <Link to="/" search={search} className="pager-button">
      {children}
    </Link>
  );
}

function FeedbackMessage({ feedback }: Readonly<{ feedback: Feedback }>) {
  if (!feedback) {
    return null;
  }

  return (
    <p
      className={`sync-feedback is-${feedback.type}`}
      role={feedback.type === "error" ? "alert" : "status"}
      aria-live={feedback.type === "error" ? "assertive" : "polite"}
    >
      {feedback.message}
    </p>
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

function InfoRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function InfoBlock({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="info-block">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatBoolean(value: boolean) {
  return value ? "はい" : "いいえ";
}

function formatIntervalMs(value: number) {
  if (!value) {
    return "無効";
  }

  if (value % (60 * 60 * 1000) === 0) {
    return `${value / (60 * 60 * 1000)}時間`;
  }

  if (value % (60 * 1000) === 0) {
    return `${value / (60 * 1000)}分`;
  }

  return `${Math.round(value / 1000)}秒`;
}

function useSyncedState<T>(value: T) {
  const [state, setState] = React.useState(value);

  React.useEffect(() => {
    setState(value);
  }, [value]);

  return [state, setState] as const;
}

function normalizeOptionalInputValue(value: string) {
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

function statusLabel(status: string) {
  if (status === "success") {
    return "成功";
  }

  if (status === "error") {
    return "失敗";
  }

  if (status === "running") {
    return "実行中";
  }

  return status;
}

function statusPillClass(status: string) {
  if (status === "success") {
    return " is-success";
  }

  if (status === "error") {
    return " is-error";
  }

  return " is-muted";
}
