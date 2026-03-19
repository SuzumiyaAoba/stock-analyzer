import * as React from "react";
import type { FormEvent } from "react";
import {
  BarChart3,
  ListFilter,
  Play,
  RefreshCcw,
  Search,
  Waypoints,
} from "lucide-react";
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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

export function DashboardHero({ data }: Readonly<{ data: DashboardData }>) {
  const selected = data.selectedInstrument;
  const latest = selected?.latestQuote;
  const { latestPrice, diff, diffRatio } = derivePriceChange(latest);

  return (
    <section className="dashboard-enter overflow-hidden px-1 py-2">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.apiHealth.ok ? "success" : "destructive"}>
              {data.apiHealth.ok ? "API Ready" : "API Error"}
            </Badge>
            <Badge variant="outline">{data.syncJob?.symbols.length ?? 0} queued</Badge>
            <Badge variant="outline">{data.instruments.length} stored</Badge>
          </div>

          <div className="grid gap-1">
            <p className="section-kicker">Analysis Workspace</p>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <h1 className="app-display text-2xl font-semibold leading-none sm:text-3xl">
                {selected ? selected.symbol : "銘柄を選択してください"}
              </h1>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                {selected
                  ? selected.longName || selected.shortName || selected.exchange || "-"
                  : "左ペインの監視リストから銘柄を選択"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <CompactMetric
            label="現在値"
            value={selected ? formatPrice(latestPrice, selected.currency) : "--"}
            tone="accent"
          />
          <CompactMetric
            label="前日比"
            value={selected ? formatDiff(diff, diffRatio, selected.currency) : "-"}
            tone={diff === null ? "neutral" : diff < 0 ? "danger" : "success"}
          />
          <CompactMetric label="市場" value={selected?.exchange || "-"} />
          <CompactMetric
            label="出来高"
            value={selected ? formatCompactNumber(selected.latestQuote?.regularMarketVolume) : "-"}
          />
        </div>
      </div>
    </section>
  );
}

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
    <section className="dashboard-enter" data-delay="1">
      <Card className="overflow-hidden">
        <CardHeader className="gap-3 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Operations</p>
              <CardTitle className="mt-1 text-xl">運用コントロール</CardTitle>
            </div>
            <Badge variant={data.apiHealth.ok ? "success" : "destructive"}>
              {data.apiHealth.ok ? "Online" : "Error"}
            </Badge>
          </div>
          <CardDescription>
            左で監視対象を絞り込みながら、ここで同期系の操作だけを短い動線で実行します。
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3">
          <form className="grid gap-2 p-0" onSubmit={onSyncSubmit}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <RefreshCcw className="size-4 text-[color:var(--accent)]" />
              単体同期
            </div>
            <div className="flex gap-2">
              <Input
                id={syncSymbolId}
                aria-label="銘柄コード"
                value={syncSymbolInput}
                onChange={(event) => onSyncInputChange(event.target.value)}
                placeholder="AAPL"
              />
              <Button type="submit" size="sm" disabled={isSyncPending}>
                {isSyncPending ? "取得中" : "同期"}
              </Button>
            </div>
            <FeedbackMessage feedback={syncFeedback} />
          </form>

          <form className="grid gap-3 p-0" onSubmit={onBatchSubmit}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Waypoints className="size-4 text-[color:var(--page-foreground)]" />
              一括同期
            </div>
            <Textarea
              id={batchSymbolsId}
              className="min-h-[88px] resize-y"
              value={batchSymbolsInput}
              onChange={(event) => onBatchSymbolsInputChange(event.target.value)}
              placeholder={"AAPL\nMSFT\nNVDA"}
              rows={3}
            />
            <div className="grid grid-cols-2 gap-2">
              <Select value={batchInterval} onValueChange={onBatchIntervalChange}>
                <SelectTrigger id={batchIntervalId}>
                  <SelectValue placeholder="足種別" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {syncHistoryIntervalOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select value={batchRange} onValueChange={onBatchRangeChange}>
                <SelectTrigger id={batchRangeId}>
                  <SelectValue placeholder="取得期間" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {syncHistoryRangeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
              <label className="inline-flex items-center gap-2">
                <Checkbox
                  checked={batchIncludePrePost}
                  onCheckedChange={(checked) => onBatchIncludePrePostChange(Boolean(checked))}
                />
                <span>時間外取引を含める</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <Checkbox
                  checked={batchSkipQuote}
                  onCheckedChange={(checked) => onBatchSkipQuoteChange(Boolean(checked))}
                />
                <span>quote 同期を省略</span>
              </label>
            </div>
            <Button type="submit" size="sm" disabled={isBatchPending}>
              {isBatchPending ? "同期中" : "一括同期"}
            </Button>
            <FeedbackMessage feedback={batchFeedback} />
          </form>

          <div className="grid gap-3 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Play className="size-4" />
                Scheduler
              </div>
              <Badge variant="outline">{formatIntervalMs(syncJob?.intervalMs ?? 0)}</Badge>
            </div>
            <div className="grid gap-2">
              <InfoRow label="対象銘柄" value={syncJob?.symbols.join(", ") || "-"} />
              <InfoRow
                label="直近実行"
                value={syncJob ? formatDateTime(syncJob.lastRunStartedAt) : "取得できません"}
              />
            </div>

            {data.apiHealth.errorMessage ? <InlineAlert message={data.apiHealth.errorMessage} /> : null}
            {syncJob?.lastRunError ? <InlineAlert message={syncJob.lastRunError} /> : null}

            <Button
              className="w-full"
              type="button"
              size="sm"
              variant="secondary"
              onClick={onRunSyncJob}
              disabled={!canRunSyncJob || isJobPending}
            >
              {isJobPending ? "実行中" : "ジョブを即時実行"}
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
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function AnalysisSidebarPanel({
  search,
  instruments,
  japanMarketInstruments,
  hasPreviousPage,
  hasNextPage,
  selectedSymbol,
  errorMessage,
  instrumentSearchFor,
  pageSearchFor,
  controlsTo = "/",
  detailTo = "/",
}: Readonly<{
  search: DashboardSearch;
  instruments: InstrumentListItem[];
  japanMarketInstruments: ScreenerInstrument[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  selectedSymbol: string | null;
  errorMessage: string | null;
  instrumentSearchFor: (symbol: string) => DashboardSearch;
  pageSearchFor: (offset: number) => DashboardSearch;
  controlsTo?: "/" | "/universe";
  detailTo?: "/" | "/universe";
}>) {
  const router = useRouter();
  const queryInputId = React.useId();
  const [query, setQuery] = useSyncedState(search.q ?? "");
  const pageStart = instruments.length > 0 ? search.offset + 1 : 0;
  const pageEnd = search.offset + instruments.length;

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void router.navigate({
      to: controlsTo,
      search: {
        ...search,
        q: normalizeOptionalInputValue(query),
        offset: 0,
      },
    });
  }

  return (
    <Card className="dashboard-enter sticky top-4 overflow-hidden max-[1100px]:static" data-delay="2">
      <CardHeader className="gap-3 pb-3">
        <div>
          <p className="section-kicker">Symbol Navigator</p>
          <CardTitle className="mt-1 text-xl">監視銘柄</CardTitle>
          <CardDescription className="mt-1">
            監視対象から分析する銘柄を切り替えます。
          </CardDescription>
        </div>

        <form
          className="grid gap-2 p-0"
          onSubmit={handleSearchSubmit}
        >
          <Label htmlFor={queryInputId}>検索</Label>
          <div className="flex gap-2">
            <Input
              id={queryInputId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="AAPL, Tesla..."
            />
            <Button type="submit" size="sm">
              検索
            </Button>
          </div>
        </form>
      </CardHeader>

      <CardContent className="grid gap-4">
        {japanMarketInstruments.length > 0 ? (
          <div className="py-1">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="section-kicker">Japan Focus</p>
              <Badge variant="outline">{japanMarketInstruments.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {japanMarketInstruments.slice(0, 4).map((item) => (
                <Button key={item.symbol} asChild size="sm" variant="ghost">
                  <Link to={detailTo} search={instrumentSearchFor(item.symbol)}>
                    {item.symbol}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3">
          {errorMessage ? <InlineAlert message={errorMessage} /> : null}
          {instruments.length > 0 ? (
            <Card className="overflow-hidden">
              <CardContent className="max-h-[62vh] overflow-auto p-0">
                <Table className="min-w-full">
                  <TableBody>
                    {instruments.map((item) => {
                      const isActive = item.symbol === selectedSymbol;
                      return (
                        <TableRow key={item.symbol} data-state={isActive ? "selected" : undefined}>
                          <TableCell>
                            <div className="grid gap-0.5">
                              <Link
                                to={detailTo}
                                search={instrumentSearchFor(item.symbol)}
                                className="app-display text-base font-semibold"
                                aria-current={isActive ? "page" : undefined}
                              >
                                {item.symbol}
                              </Link>
                              <span className="truncate text-xs text-[color:var(--muted-foreground)]">
                                {item.shortName || item.longName || "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-semibold">
                            {formatPrice(item.latestQuote?.regularMarketPrice, item.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <PercentBadge value={quoteDiffRatio(item.latestQuote)}>
                              {formatPercentChange(item.latestQuote)}
                            </PercentBadge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="分析対象がありません"
              description="監視リストに表示する銘柄がまだありません。"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-sm text-[color:var(--muted-foreground)]">
          <span>{pageStart > 0 ? `${pageStart}-${pageEnd}` : "0"} 件</span>
          <div className="flex gap-2">
            <PagerLink
              to={controlsTo}
              enabled={hasPreviousPage}
              search={pageSearchFor(Math.max(search.offset - search.listLimit, 0))}
            >
              前へ
            </PagerLink>
            <PagerLink
              to={controlsTo}
              enabled={hasNextPage}
              search={pageSearchFor(search.offset + search.listLimit)}
            >
              次へ
            </PagerLink>
          </div>
        </div>
      </CardContent>
    </Card>
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
  sticky = true,
  controlsTo = "/",
  detailTo = "/",
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
  sticky?: boolean;
  controlsTo?: "/" | "/universe";
  detailTo?: "/" | "/universe";
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
      to: controlsTo,
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
      to: controlsTo,
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
    <Card
      className={cn(
        "dashboard-enter overflow-hidden",
        sticky && "sticky top-4 max-[1100px]:static",
      )}
      data-delay="2"
    >
      <CardHeader className="gap-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Universe</p>
            <CardTitle className="mt-1 text-xl">監視リスト</CardTitle>
            <CardDescription className="mt-1">
              監視対象を絞り込み、右ペインの分析対象を選びます。
            </CardDescription>
          </div>
          <Badge variant="outline">{instruments.length} symbols</Badge>
        </div>

        <form
          className="grid gap-3 p-0"
          onSubmit={handleSearchSubmit}
        >
          <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
            <Search className="size-4" />
            Search
          </div>
          <div className="flex gap-2 max-sm:flex-col">
            <Input
              id={queryInputId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="AAPL, Microsoft, Tesla..."
            />
            <Button type="submit" size="sm">
              検索
            </Button>
          </div>
        </form>

        <form
          className="grid gap-3 p-0"
          onSubmit={handleListControlsSubmit}
        >
          <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
            <ListFilter className="size-4" />
            Controls
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor={sortById}>並び順</Label>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as DashboardSearch["sortBy"])}
              >
                <SelectTrigger id={sortById}>
                  <SelectValue placeholder="並び順を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {instrumentSortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={orderId}>順序</Label>
              <Select
                value={order}
                onValueChange={(value) => setOrder(value as DashboardSearch["order"])}
              >
                <SelectTrigger id={orderId}>
                  <SelectValue placeholder="順序を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {orderOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={listLimitId}>件数</Label>
              <Select
                value={String(listLimit)}
                onValueChange={(value) => setListLimit(Number(value))}
              >
                <SelectTrigger id={listLimitId}>
                  <SelectValue placeholder="件数を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {listLimitOptions.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" variant="secondary" size="sm">
            一覧条件を反映
          </Button>
        </form>
      </CardHeader>

      <CardContent className="grid gap-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-kicker">Japan Market</p>
                <CardTitle className="mt-1 text-lg">注目候補</CardTitle>
              </div>
              <Badge variant="outline">{japanMarketInstruments.length} symbols</Badge>
            </div>
            <CardDescription>
              上位候補だけを短く確認して同期できます。
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {japanMarketErrorMessage ? <InlineAlert message={japanMarketErrorMessage} /> : null}
            {japanMarketInstruments.length > 0 ? (
              <Table className="min-w-full">
                <TableBody>
                  {japanMarketInstruments.slice(0, 5).map((item) => (
                    <TableRow key={item.symbol}>
                      <TableCell className="font-medium">
                        <div className="grid gap-0.5">
                          <span className="app-display text-sm font-semibold">{item.symbol}</span>
                          <span className="truncate text-xs text-[color:var(--muted-foreground)]">
                            {item.shortName || item.longName || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <PercentBadge value={item.regularMarketChangePercent}>
                          {formatSignedPercent(item.regularMarketChangePercent)}
                        </PercentBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => onSyncSymbol(item.symbol)}
                          disabled={isSyncPending}
                        >
                          {syncingSymbol === item.symbol ? "同期中" : "同期"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyInlineMessage>日本市場の銘柄一覧を取得できませんでした。</EmptyInlineMessage>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 text-sm text-[color:var(--muted-foreground)] max-sm:flex-col max-sm:items-stretch">
          <span>{pageStart > 0 ? `${pageStart}-${pageEnd}` : "0"} 件を表示中</span>
          <div className="flex gap-2 max-sm:w-full">
            <PagerLink
              to={controlsTo}
              enabled={hasPreviousPage}
              search={pageSearchFor(Math.max(search.offset - search.listLimit, 0))}
            >
              前へ
            </PagerLink>
            <PagerLink
              to={controlsTo}
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
            <Card className="overflow-hidden">
              <CardContent className="max-h-[56vh] overflow-auto p-0">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>銘柄</TableHead>
                      <TableHead>価格</TableHead>
                      <TableHead className="text-right">騰落</TableHead>
                      <TableHead className="text-right">詳細</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instruments.map((item) => {
                      const isActive = item.symbol === selectedSymbol;
                      return (
                        <TableRow key={item.symbol} data-state={isActive ? "selected" : undefined}>
                          <TableCell className="min-w-0">
                            <div className="grid gap-0.5">
                              <Link
                                to={detailTo}
                                search={instrumentSearchFor(item.symbol)}
                                className="app-display text-base font-semibold"
                                aria-current={isActive ? "page" : undefined}
                              >
                                {item.symbol}
                              </Link>
                              <span className="truncate text-xs text-[color:var(--muted-foreground)]">
                                {item.shortName || item.longName || "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-semibold">
                            {formatPrice(item.latestQuote?.regularMarketPrice, item.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <PercentBadge value={quoteDiffRatio(item.latestQuote)}>
                              {formatPercentChange(item.latestQuote)}
                            </PercentBadge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant={isActive ? "secondary" : "ghost"}>
                              <Link to={detailTo} search={instrumentSearchFor(item.symbol)}>
                                {isActive ? "表示中" : "開く"}
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
      <Card className="dashboard-enter overflow-hidden" data-delay="3">
        <CardContent className="p-8 sm:p-10">
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
    <Card className="dashboard-enter overflow-hidden" data-delay="3">
      <CardHeader className="gap-4 pb-3">
        <div className="flex items-start justify-between gap-4 max-lg:flex-col">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="section-kicker">{selected.exchange || "Unknown Exchange"}</p>
              <Badge variant="outline">{selectedSymbol}</Badge>
            </div>
            <CardTitle className="mt-2 text-3xl">
              {selected.longName || selected.shortName || selectedSymbol}
            </CardTitle>
            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="app-display text-4xl font-semibold">
                {formatPrice(latestPrice, currency)}
              </p>
              <p className={cn("text-sm font-semibold", trendTextClass(diff))}>
                {formatDiff(diff, diffRatio, currency)}
              </p>
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

      <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,340px)]">
        <div className="grid gap-4">
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <form className="grid gap-3" onSubmit={handleDetailFilterSubmit}>
                <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                  <BarChart3 className="size-4" />
                  Analysis Filters
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  <Input
                    id={fromInputId}
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                  <Input
                    id={toInputId}
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                  <Select
                    value={String(priceLimit)}
                    onValueChange={(value) => setPriceLimit(Number(value))}
                  >
                    <SelectTrigger id={priceLimitId}>
                      <SelectValue placeholder="価格本数" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {priceLimitOptions.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select
                    value={actionType}
                    onValueChange={(value) => setActionType(value as DashboardSearch["actionType"])}
                  >
                    <SelectTrigger id={actionTypeId}>
                      <SelectValue placeholder="アクション種別" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {actionTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(actionLimit)}
                    onValueChange={(value) => setActionLimit(Number(value))}
                  >
                    <SelectTrigger id={actionLimitId}>
                      <SelectValue placeholder="アクション件数" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {actionLimitOptions.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm">
                    条件を反映
                  </Button>
                  <Button asChild variant="ghost" size="sm">
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
                      リセット
                    </Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-[minmax(220px,1.2fr)_repeat(3,minmax(0,1fr))]">
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <p className="section-kicker">Latest Price</p>
                <p className="app-display mt-2 text-4xl font-semibold">
                  {formatPrice(latestPrice, currency)}
                </p>
                <p className={cn("mt-1 text-sm font-semibold", trendTextClass(diff))}>
                  {formatDiff(diff, diffRatio, currency)}
                </p>
              </CardContent>
            </Card>
            <MetricCard label="時価総額" value={formatCompactNumber(latest?.marketCap)} />
            <MetricCard label="出来高" value={formatCompactNumber(latest?.regularMarketVolume)} />
            <MetricCard label="更新" value={formatDateTime(latest?.asOf)} />
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
              <div>
                <p className="section-kicker">Price Action</p>
                <CardTitle className="mt-1 text-xl">
                  {labelForInterval(search.interval)}の価格推移
                </CardTitle>
              </div>
              <Badge variant="outline">{data.prices.length} bars</Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <CandlestickChart prices={data.prices} currency={currency} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <p className="section-kicker">Snapshot</p>
              <CardTitle className="mt-1 text-lg">主要指標</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid gap-2">
                <Stat label="前日終値" value={formatPrice(latest?.previousClose, currency)} />
                <Stat label="当日高値" value={formatPrice(latest?.dayHigh, currency)} />
                <Stat label="当日安値" value={formatPrice(latest?.dayLow, currency)} />
                <Stat label="市場" value={selected.exchange || "-"} />
                <Stat label="種別" value={selected.quoteType || "-"} />
                <Stat label="通貨" value={selected.currency || "-"} />
                <Stat label="タイムゾーン" value={selected.timezone || "-"} />
                <Stat label="初回取引日" value={formatDate(selected.firstTradeAt)} />
                <Stat label="DB 更新" value={formatDateTime(selected.updatedAt)} />
              </dl>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <p className="section-kicker">Corporate Actions</p>
              <CardTitle className="mt-1 text-lg">配当・分割</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.actions.length > 0 ? (
                <Table className="min-w-full">
                  <TableBody>
                    {data.actions.map((action) => (
                      <TableRow key={`${action.actionType}-${action.eventAt}`}>
                        <TableCell>
                          <div className="grid gap-0.5">
                            <span className="font-medium">{actionLabel(action.actionType)}</span>
                            <span className="text-xs text-[color:var(--muted-foreground)]">
                              {formatDate(action.eventAt)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatActionValue(action.value, action.actionType, currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyInlineMessage>
                  条件に一致するコーポレートアクションはありません。
                </EmptyInlineMessage>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <p className="section-kicker">Sync Runs</p>
              <CardTitle className="mt-1 text-lg">同期履歴</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.syncRuns.length > 0 ? (
                <div className="grid gap-2">
                  {data.syncRuns.slice(0, 6).map((run) => (
                    <SyncRunItem key={run.id} run={run} compact />
                  ))}
                </div>
              ) : (
                <EmptyInlineMessage>実行履歴はまだありません。</EmptyInlineMessage>
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

function SyncRunItem({ run, compact = false }: Readonly<{ run: SyncJobRun; compact?: boolean }>) {
  return (
    <li>
      <Card className="overflow-hidden">
        <CardContent className={cn("grid gap-3", compact ? "p-3" : "p-4")}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <strong>#{run.id}</strong>
              <Badge variant={statusBadgeVariant(run.status)}>{statusLabel(run.status)}</Badge>
              <span className="text-sm uppercase text-[color:var(--muted-foreground)]">
                {run.source}
              </span>
            </div>
            <Badge variant="outline">{run.symbolCount} 銘柄</Badge>
          </div>
          <div className={cn("grid gap-2", compact ? "grid-cols-1" : "md:grid-cols-3")}>
            <InfoBlock label="開始" value={formatDateTime(run.startedAt)} />
            <InfoBlock label="終了" value={formatDateTime(run.finishedAt)} />
            <InfoBlock label="エラー" value={run.errorMessage || "-"} />
          </div>
          {!compact && run.results.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {run.results.map((result) => (
                <SyncResultSummary
                  key={`${run.id}-${result.symbol}-${result.interval}`}
                  result={result}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm"
                />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}

export function SyncRunsPanel({
  runs,
  compact = false,
}: Readonly<{
  runs: SyncJobRun[];
  compact?: boolean;
}>) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-2 pb-3">
        <p className="section-kicker">Sync Runs</p>
        <CardTitle className="text-xl">同期履歴</CardTitle>
        <CardDescription>定期同期と手動同期の実行結果を確認します。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {runs.length > 0 ? (
          runs.map((run) => <SyncRunItem key={run.id} run={run} compact={compact} />)
        ) : (
          <EmptyInlineMessage>実行履歴はまだありません。</EmptyInlineMessage>
        )}
      </CardContent>
    </Card>
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

function CompactMetric({
  label,
  value,
  tone = "neutral",
}: Readonly<{
  label: string;
  value: string;
  tone?: "neutral" | "accent" | "success" | "danger";
}>) {
  return (
    <div
      className={cn(
        "px-3 py-2",
        tone === "accent" && "text-[color:var(--accent)]",
        tone === "success" && "text-[color:var(--success)]",
        tone === "danger" && "text-[color:var(--danger)]",
        tone === "neutral" && "text-[color:var(--page-foreground)]",
      )}
    >
      <p className="section-kicker">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function PercentBadge({
  value,
  children,
}: Readonly<{
  value: number | null;
  children: React.ReactNode;
}>) {
  return <Badge variant={changeBadgeVariant(value)}>{children}</Badge>;
}

function PagerLink({
  to,
  enabled,
  search,
  children,
}: Readonly<{
  to: "/" | "/universe";
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
      <Link to={to} search={search}>
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
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <p className="section-kicker">{label}</p>
        <strong className="mt-3 block break-words text-sm font-semibold">{value}</strong>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="p-3">
      <dt className="text-sm text-[color:var(--muted-foreground)]">{label}</dt>
      <dd className="mt-2 font-semibold">{value}</dd>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="grid gap-1 px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}

function InfoBlock({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="grid gap-1 p-3">
      <span className="text-xs uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
        {label}
      </span>
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
    <div className="grid gap-3 text-[color:var(--muted-foreground)]">
      {kicker ? (
        <p className="section-kicker">{kicker}</p>
      ) : null}
      <h2 className="app-display text-2xl font-semibold leading-tight text-[color:var(--page-foreground)]">
        {title}
      </h2>
      <p className="max-w-xl leading-7">{description}</p>
    </div>
  );
}

function EmptyInlineMessage({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{children}</p>;
}

function InlineAlert({ message }: Readonly<{ message: string }>) {
  return (
    <Alert variant="destructive" className="py-3">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function trendTextClass(value: number | null) {
  if (value === null) {
    return "text-[color:var(--muted-foreground)]";
  }

  if (value < 0) {
    return "text-[color:var(--danger)]";
  }

  return "text-[color:var(--success)]";
}

function changeBadgeVariant(value: number | null): "success" | "destructive" | "outline" {
  if (value === null) {
    return "outline";
  }

  if (value < 0) {
    return "destructive";
  }

  return "success";
}

function quoteDiffRatio(
  quote:
    | {
        regularMarketPrice: number | null;
        previousClose: number | null;
      }
    | null
    | undefined,
) {
  return derivePriceChange(quote).diffRatio;
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
