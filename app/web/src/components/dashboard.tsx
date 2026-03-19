import * as React from "react";
import type { FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { CandlestickChart } from "~/components/candlestick-chart";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
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
  ScreenerInstrument,
  SymbolSyncResult,
  SyncJobRun,
} from "~/lib/yfinance";
import { cn } from "~/lib/utils";

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
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-200 bg-gradient-to-b from-white to-slate-50/90">
          <CardHeader className="p-0">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-slate-600">
              Quick Sync
            </p>
            <CardTitle className="mt-1 text-xl">単体同期</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              `sync/history` と `sync/quote` をまとめて呼び出し、日足・週足・月足を保存します。
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <form className="grid gap-3" onSubmit={onSyncSubmit}>
              <div className="flex gap-2 max-sm:flex-col">
                <Input
                  id={syncSymbolId}
                  aria-label="銘柄コード"
                  className="min-w-0"
                  value={syncSymbolInput}
                  onChange={(event) => onSyncInputChange(event.target.value)}
                  placeholder="AAPL, MSFT, NVDA"
                />
                <Button className="min-w-28" type="submit" disabled={isSyncPending}>
                  {isSyncPending ? "取得中..." : "単体同期"}
                </Button>
              </div>
              <FeedbackMessage feedback={syncFeedback} />
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-b from-white to-slate-50/90">
          <CardHeader className="p-0">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-slate-600">
              Batch Sync
            </p>
            <CardTitle className="mt-1 text-xl">一括同期</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              `sync/batch`
              を使って複数銘柄をまとめて取得します。改行またはカンマ区切りで入力できます。
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <form className="grid gap-3" onSubmit={onBatchSubmit}>
              <div className="grid gap-1.5">
                <Label htmlFor={batchSymbolsId}>銘柄コード</Label>
                <Textarea
                  id={batchSymbolsId}
                  className="min-h-[104px] resize-y"
                  value={batchSymbolsInput}
                  onChange={(event) => onBatchSymbolsInputChange(event.target.value)}
                  placeholder={"AAPL\nMSFT\nNVDA"}
                  rows={4}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={batchIntervalId}>足種別</Label>
                  <Select value={batchInterval} onValueChange={onBatchIntervalChange}>
                    <SelectTrigger id={batchIntervalId}>
                      <SelectValue placeholder="足種別を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {syncHistoryIntervalOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={batchRangeId}>取得期間</Label>
                  <Select value={batchRange} onValueChange={onBatchRangeChange}>
                    <SelectTrigger id={batchRangeId}>
                      <SelectValue placeholder="取得期間を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {syncHistoryRangeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <Checkbox
                    checked={batchIncludePrePost}
                    onCheckedChange={(checked) => onBatchIncludePrePostChange(Boolean(checked))}
                  />
                  <span>時間外取引を含める</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <Checkbox
                    checked={batchSkipQuote}
                    onCheckedChange={(checked) => onBatchSkipQuoteChange(Boolean(checked))}
                  />
                  <span>quote 同期を省略</span>
                </label>
              </div>
              <Button type="submit" disabled={isBatchPending}>
                {isBatchPending ? "同期中..." : "一括同期"}
              </Button>
              <FeedbackMessage feedback={batchFeedback} />
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-b from-white to-slate-50/90">
          <CardHeader className="p-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-slate-600">
                  Scheduler
                </p>
                <CardTitle className="mt-1 text-xl">API / 定期同期</CardTitle>
              </div>
              <Badge variant={data.apiHealth.ok ? "success" : "destructive"}>
                {data.apiHealth.ok ? "API Online" : "API Error"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <dl className="grid grid-cols-[minmax(96px,120px)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
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
                  syncJob
                    ? `${syncJob.historyInterval} / ${syncJob.historyRange}`
                    : "取得できません"
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
              <InlineAlert message={data.apiHealth.errorMessage} />
            ) : null}
            {syncJob?.lastRunError ? <InlineAlert message={syncJob.lastRunError} /> : null}
            <Button
              className="w-full"
              type="button"
              onClick={onRunSyncJob}
              disabled={!canRunSyncJob || isJobPending}
            >
              {isJobPending ? "実行中..." : "定期同期ジョブを即時実行"}
            </Button>
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
              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                  直近ジョブ結果
                </p>
                <ul className="grid gap-2">
                  {syncJob.lastRunResults.map((result) => (
                    <SyncResultSummary
                      key={`${result.symbol}-${result.interval}`}
                      result={result}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function InstrumentsPanel({
  search,
  instruments,
  japanMarketInstruments,
  japanMarketErrorMessage,
  hasPreviousPage,
  hasNextPage,
  selectedSymbol,
  errorMessage,
  instrumentSearchFor,
  pageSearchFor,
  isSyncPending,
  syncingSymbol,
  onSyncSymbol,
}: Readonly<{
  search: DashboardSearch;
  instruments: InstrumentListItem[];
  japanMarketInstruments: ScreenerInstrument[];
  japanMarketErrorMessage: string | null;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  selectedSymbol: string | null;
  errorMessage: string | null;
  instrumentSearchFor: (symbol: string) => DashboardSearch;
  pageSearchFor: (offset: number) => DashboardSearch;
  isSyncPending: boolean;
  syncingSymbol: string | null;
  onSyncSymbol: (symbol: string) => void;
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
    <Card className="sticky top-6 rounded-2xl border-slate-200 shadow-sm max-[1100px]:static">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-slate-600">
              Universe
            </p>
            <CardTitle className="mt-1 text-xl">銘柄一覧</CardTitle>
          </div>
          <Badge variant="outline">{instruments.length} symbols</Badge>
        </div>

        <form className="grid gap-2" onSubmit={handleSearchSubmit}>
          <Label htmlFor={queryInputId}>銘柄名またはシンボル</Label>
          <div className="flex gap-2 max-sm:flex-col">
            <Input
              id={queryInputId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="AAPL, Microsoft, Tesla..."
            />
            <Button type="submit">検索</Button>
          </div>
        </form>

        <form
          className="grid gap-3 border-t border-slate-200 pt-4"
          onSubmit={handleListControlsSubmit}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor={sortById}>並び順</Label>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as DashboardSearch["sortBy"])}
              >
                <SelectTrigger id={sortById}>
                  <SelectValue placeholder="並び順を選択" />
                </SelectTrigger>
                <SelectContent>
                  {instrumentSortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={orderId}>順序</Label>
              <Select
                value={order}
                onValueChange={(value) => setOrder(value as DashboardSearch["order"])}
              >
                <SelectTrigger id={orderId}>
                  <SelectValue placeholder="順序を選択" />
                </SelectTrigger>
                <SelectContent>
                  {orderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={listLimitId}>件数</Label>
              <Select
                value={String(listLimit)}
                onValueChange={(value) => setListLimit(Number(value))}
              >
                <SelectTrigger id={listLimitId}>
                  <SelectValue placeholder="件数を選択" />
                </SelectTrigger>
                <SelectContent>
                  {listLimitOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit">一覧条件を反映</Button>
        </form>
      </CardHeader>

      <CardContent className="grid gap-4">
        <Card className="border-slate-200 bg-gradient-to-b from-sky-50/70 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-slate-600">
                  Japan Market
                </p>
                <CardTitle className="mt-1 text-lg">日本市場の注目銘柄</CardTitle>
              </div>
              <Badge variant="outline">{japanMarketInstruments.length} symbols</Badge>
            </div>
            <CardDescription>
              Yahoo Finance screener から東証銘柄を取得しています。クリックで DB
              同期して詳細表示できます。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0">
            {japanMarketErrorMessage ? <InlineAlert message={japanMarketErrorMessage} /> : null}
            {japanMarketInstruments.length > 0 ? (
              <div className="grid gap-3">
                {japanMarketInstruments.map((item) => (
                  <JapanMarketCard
                    key={item.symbol}
                    item={item}
                    isSyncPending={isSyncPending}
                    isSyncing={syncingSymbol === item.symbol}
                    onSyncSymbol={onSyncSymbol}
                  />
                ))}
              </div>
            ) : (
              <EmptyInlineMessage>日本市場の銘柄一覧を取得できませんでした。</EmptyInlineMessage>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 text-sm text-slate-600 max-sm:flex-col max-sm:items-stretch">
          <span>{pageStart > 0 ? `${pageStart}-${pageEnd}` : "0"} 件を表示中</span>
          <div className="flex gap-2 max-sm:w-full">
            <PagerLink
              enabled={hasPreviousPage}
              search={pageSearchFor(Math.max(search.offset - search.listLimit, 0))}
            >
              前へ
            </PagerLink>
            <PagerLink
              enabled={hasNextPage}
              search={pageSearchFor(search.offset + search.listLimit)}
            >
              次へ
            </PagerLink>
          </div>
        </div>

        <div className="grid gap-3">
          {errorMessage ? <InlineAlert message={errorMessage} /> : null}
          {instruments.length > 0 ? (
            instruments.map((item) => {
              const isActive = item.symbol === selectedSymbol;
              return (
                <Link
                  key={item.symbol}
                  to="/"
                  search={instrumentSearchFor(item.symbol)}
                  className="block"
                  aria-current={isActive ? "page" : undefined}
                >
                  <Card
                    className={cn(
                      "border-slate-200 transition-colors hover:border-slate-300 hover:bg-slate-50",
                      isActive && "border-blue-600 bg-blue-50",
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold">{item.symbol}</p>
                          <p className="mt-1 truncate text-sm text-slate-600">
                            {item.shortName || item.longName || "-"}
                          </p>
                        </div>
                        <p className="whitespace-nowrap text-base font-semibold">
                          {formatPrice(item.latestQuote?.regularMarketPrice, item.currency)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                        <span>{item.exchange || "-"}</span>
                        <span>{formatPercentChange(item.latestQuote)}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                        <span>{item.currency || "-"}</span>
                        <span>{formatDateTime(item.latestQuote?.asOf ?? item.updatedAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          ) : (
            <EmptyState
              title="一致する銘柄がありません。"
              description="上部フォームから symbol を同期すると、保存済みデータをここで閲覧できます。"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function JapanMarketCard({
  item,
  isSyncPending,
  isSyncing,
  onSyncSymbol,
}: Readonly<{
  item: ScreenerInstrument;
  isSyncPending: boolean;
  isSyncing: boolean;
  onSyncSymbol: (symbol: string) => void;
}>) {
  return (
    <Card className="border-slate-200 bg-white/90">
      <CardContent className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{item.symbol}</p>
            <p className="mt-1 truncate text-sm text-slate-600">
              {item.shortName || item.longName || "-"}
            </p>
          </div>
          <p className="whitespace-nowrap text-base font-semibold">
            {formatPrice(item.regularMarketPrice, item.currency)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span>{item.exchange || "-"}</span>
          <span>{formatSignedPercent(item.regularMarketChangePercent)}</span>
          <span>{formatCompactNumber(item.marketCap)}</span>
        </div>
        <Button
          variant="secondary"
          type="button"
          onClick={() => onSyncSymbol(item.symbol)}
          disabled={isSyncPending}
        >
          {isSyncing ? "同期中..." : "同期して表示"}
        </Button>
      </CardContent>
    </Card>
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
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-8">
          <EmptyState
            title="表示できる銘柄がありません"
            description="上部フォームから symbol を取得すると、この画面に一覧と詳細が表示されます。"
            kicker="No Selection"
          />
        </CardContent>
      </Card>
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
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4 max-lg:flex-col">
          <div className="min-w-0">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-slate-600">
              {selected.exchange || "Unknown Exchange"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl">
                {selected.longName || selected.shortName || selectedSymbol}
              </CardTitle>
              <Badge variant="outline">{selectedSymbol}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {intervalOptions.map((option) => (
              <Button
                key={option.value}
                asChild
                variant={search.interval === option.value ? "default" : "outline"}
                size="sm"
              >
                <Link
                  to="/"
                  search={intervalSearchFor(option.value)}
                  aria-current={search.interval === option.value ? "page" : undefined}
                >
                  {option.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4">
            <form className="grid gap-4" onSubmit={handleDetailFilterSubmit}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="grid gap-1.5">
                  <Label htmlFor={fromInputId}>開始日</Label>
                  <Input
                    id={fromInputId}
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={toInputId}>終了日</Label>
                  <Input
                    id={toInputId}
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={priceLimitId}>価格本数</Label>
                  <Select
                    value={String(priceLimit)}
                    onValueChange={(value) => setPriceLimit(Number(value))}
                  >
                    <SelectTrigger id={priceLimitId}>
                      <SelectValue placeholder="価格本数を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {priceLimitOptions.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={actionTypeId}>アクション種別</Label>
                  <Select
                    value={actionType}
                    onValueChange={(value) => setActionType(value as DashboardSearch["actionType"])}
                  >
                    <SelectTrigger id={actionTypeId}>
                      <SelectValue placeholder="アクション種別を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {actionTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={actionLimitId}>アクション件数</Label>
                  <Select
                    value={String(actionLimit)}
                    onValueChange={(value) => setActionLimit(Number(value))}
                  >
                    <SelectTrigger id={actionLimitId}>
                      <SelectValue placeholder="件数を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {actionLimitOptions.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">期間・表示条件を反映</Button>
                <Button asChild variant="outline">
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
                  >
                    フィルタを解除
                  </Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(0,1fr))]">
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                最新価格
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight">
                {formatPrice(latestPrice, currency)}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-semibold",
                  diff === null ? "text-slate-600" : diff < 0 ? "text-red-600" : "text-emerald-700",
                )}
              >
                {formatDiff(diff, diffRatio, currency)}
              </p>
            </CardContent>
          </Card>
          <MetricCard label="時価総額" value={formatCompactNumber(latest?.marketCap)} />
          <MetricCard label="出来高" value={formatCompactNumber(latest?.regularMarketVolume)} />
          <MetricCard label="取得時点" value={formatDateTime(latest?.asOf)} />
          <MetricCard label="DB 更新" value={formatDateTime(selected.updatedAt)} />
        </div>

        <Card className="border-slate-200">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-slate-600">
                Price Action
              </p>
              <CardTitle className="mt-1 text-lg">
                {labelForInterval(search.interval)}の価格推移
              </CardTitle>
            </div>
            <Badge variant="outline">{data.prices.length} 本</Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <CandlestickChart prices={data.prices} currency={currency} />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-slate-600">
                Snapshot
              </p>
              <CardTitle className="mt-1 text-lg">主要指標</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Stat label="前日終値" value={formatPrice(latest?.previousClose, currency)} />
                <Stat label="当日高値" value={formatPrice(latest?.dayHigh, currency)} />
                <Stat label="当日安値" value={formatPrice(latest?.dayLow, currency)} />
                <Stat label="通貨" value={selected.currency || "-"} />
                <Stat label="市場" value={selected.exchange || "-"} />
                <Stat label="種別" value={selected.quoteType || "-"} />
                <Stat label="タイムゾーン" value={selected.timezone || "-"} />
                <Stat label="初回取引日" value={formatDate(selected.firstTradeAt)} />
              </dl>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-slate-600">
                Corporate Actions
              </p>
              <CardTitle className="mt-1 text-lg">配当・分割</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.actions.length > 0 ? (
                <ul className="grid gap-3">
                  {data.actions.map((action) => (
                    <li
                      key={`${action.actionType}-${action.eventAt}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold">{actionLabel(action.actionType)}</p>
                        <p className="mt-1 text-sm text-slate-600">{formatDate(action.eventAt)}</p>
                      </div>
                      <strong>
                        {formatActionValue(action.value, action.actionType, currency)}
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyInlineMessage>
                  条件に一致するコーポレートアクションはありません。
                </EmptyInlineMessage>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-slate-600">
              Sync Runs
            </p>
            <CardTitle className="mt-1 text-lg">定期同期の実行履歴</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.syncRuns.length > 0 ? (
              <ul className="grid gap-3">
                {data.syncRuns.map((run) => (
                  <SyncRunItem key={run.id} run={run} />
                ))}
              </ul>
            ) : (
              <EmptyInlineMessage>実行履歴はまだありません。</EmptyInlineMessage>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

function SyncRunItem({ run }: Readonly<{ run: SyncJobRun }>) {
  return (
    <li>
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <strong>#{run.id}</strong>
              <Badge variant={statusBadgeVariant(run.status)}>{statusLabel(run.status)}</Badge>
              <span className="text-sm uppercase text-slate-600">{run.source}</span>
            </div>
            <Badge variant="outline">{run.symbolCount} 銘柄</Badge>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <InfoBlock label="開始" value={formatDateTime(run.startedAt)} />
            <InfoBlock label="終了" value={formatDateTime(run.finishedAt)} />
            <InfoBlock label="エラー" value={run.errorMessage || "-"} />
          </div>
          {run.results.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {run.results.map((result) => (
                <SyncResultSummary
                  key={`${run.id}-${result.symbol}-${result.interval}`}
                  result={result}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
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
    return (
      <Button className="max-sm:flex-1" variant="outline" disabled>
        {children}
      </Button>
    );
  }

  return (
    <Button asChild className="max-sm:flex-1" variant="outline">
      <Link to="/" search={search}>
        {children}
      </Link>
    </Button>
  );
}

function FeedbackMessage({ feedback }: Readonly<{ feedback: Feedback }>) {
  if (!feedback) {
    return null;
  }

  return (
    <Alert
      variant={feedback.type === "error" ? "destructive" : "success"}
      aria-live={feedback.type === "error" ? "assertive" : "polite"}
      className="py-3"
    >
      <AlertDescription>{feedback.message}</AlertDescription>
    </Alert>
  );
}

function MetricCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Card className="border-slate-200 bg-slate-50">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">{label}</p>
        <strong className="mt-2 block break-words text-sm font-semibold">{value}</strong>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function InfoRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <>
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="break-words text-sm font-semibold">{value}</dd>
    </>
  );
}

function InfoBlock({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="grid gap-1 rounded-lg border border-slate-200 bg-white p-3">
      <span className="text-xs text-slate-600">{label}</span>
      <strong className="break-words text-sm">{value}</strong>
    </div>
  );
}

function EmptyState({
  title,
  description,
  kicker,
}: Readonly<{
  title: string;
  description: string;
  kicker?: string;
}>) {
  return (
    <div className="grid gap-2 text-slate-600">
      {kicker ? (
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.04em]">{kicker}</p>
      ) : null}
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function EmptyInlineMessage({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="text-sm text-slate-600">{children}</p>;
}

function InlineAlert({ message }: Readonly<{ message: string }>) {
  return (
    <Alert variant="destructive" className="py-3">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
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

function statusBadgeVariant(status: string): "success" | "destructive" | "outline" {
  if (status === "success") {
    return "success";
  }

  if (status === "error") {
    return "destructive";
  }

  return "outline";
}

function formatSignedPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
