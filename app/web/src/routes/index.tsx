import { createFileRoute } from "@tanstack/react-router";
import {
  AnalysisSidebarPanel,
  DashboardHero,
  InstrumentDetailPanel,
  InstrumentsPanel,
  OperationsPanel,
  SyncRunsPanel,
} from "~/components/dashboard";
import { WorkspacePageHeader, WorkspaceShell } from "~/components/workspace-layout";
import { dashboardSearchSchema } from "~/lib/dashboard-config";
import { useDashboardActions } from "~/lib/use-dashboard-actions";
import { useDashboardSearch } from "~/lib/use-dashboard-search";
import { getDashboardData } from "~/lib/yfinance";

export const Route = createFileRoute("/")({
  validateSearch: (search) => dashboardSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getDashboardData({ data: deps }),
  component: HomePage,
});

function HomePage() {
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  const actions = useDashboardActions(search);
  const searchBuilder = useDashboardSearch(search, data.selectedSymbol);

  const analysisView = (
    <>
      <DashboardHero data={data} />
      <section className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(340px,388px)_minmax(0,1fr)]">
        <AnalysisSidebarPanel
          search={search}
          instruments={data.instruments}
          japanMarketInstruments={data.japanMarketInstruments}
          hasPreviousPage={data.hasPreviousPage}
          hasNextPage={data.hasNextPage}
          selectedSymbol={data.selectedSymbol}
          errorMessage={data.errorMessage}
          instrumentSearchFor={searchBuilder.instrumentSearchFor}
          pageSearchFor={searchBuilder.pageSearchFor}
        />
        <InstrumentDetailPanel
          data={data}
          search={search}
          intervalSearchFor={searchBuilder.intervalSearchFor}
          clearDetailFiltersSearchFor={searchBuilder.mergeSearch}
        />
      </section>
    </>
  );

  const universeView = (
    <>
      <WorkspacePageHeader
        title="監視と探索"
        description="保存済み銘柄の監視、日本市場スクリーナー、並び替えと検索をまとめて扱います。"
        badge={`${data.instruments.length} symbols`}
      />
      <section className="mt-4 grid gap-4">
        <InstrumentsPanel
          search={search}
          instruments={data.instruments}
          japanMarketInstruments={data.japanMarketInstruments}
          japanMarketErrorMessage={data.japanMarketErrorMessage}
          hasPreviousPage={data.hasPreviousPage}
          hasNextPage={data.hasNextPage}
          selectedSymbol={data.selectedSymbol}
          errorMessage={data.errorMessage}
          instrumentSearchFor={searchBuilder.instrumentSearchFor}
          pageSearchFor={searchBuilder.pageSearchFor}
          isSyncPending={actions.isSyncPending}
          syncingSymbol={actions.syncingSymbol}
          onSyncSymbol={actions.handleSyncSymbol}
          sticky={false}
        />
      </section>
    </>
  );

  const operationsView = (
    <>
      <WorkspacePageHeader
        title="同期オペレーション"
        description="単体同期、一括同期、ジョブ状態と履歴確認を 1 画面で扱います。"
        badge={`${data.syncRuns.length} runs`}
      />
      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <OperationsPanel
          data={data}
          syncSymbolInput={actions.syncSymbolInput}
          syncFeedback={actions.syncFeedback}
          isSyncPending={actions.isSyncPending}
          onSyncInputChange={actions.updateSyncSymbolInput}
          onSyncSubmit={actions.handleSyncSubmit}
          batchSymbolsInput={actions.batchSymbolsInput}
          batchInterval={actions.batchInterval}
          batchRange={actions.batchRange}
          batchIncludePrePost={actions.batchIncludePrePost}
          batchSkipQuote={actions.batchSkipQuote}
          batchFeedback={actions.batchFeedback}
          isBatchPending={actions.isBatchPending}
          onBatchSymbolsInputChange={actions.updateBatchSymbolsInput}
          onBatchIntervalChange={actions.setBatchInterval}
          onBatchRangeChange={actions.setBatchRange}
          onBatchIncludePrePostChange={actions.setBatchIncludePrePost}
          onBatchSkipQuoteChange={actions.setBatchSkipQuote}
          onBatchSubmit={actions.handleBatchSubmit}
          jobFeedback={actions.jobFeedback}
          isJobPending={actions.isJobPending}
          onRunSyncJob={actions.handleRunSyncJob}
        />
        <SyncRunsPanel runs={data.syncRuns} compact />
      </section>
    </>
  );

  return (
    <WorkspaceShell search={search} activeView={search.view}>
      {search.view === "analysis" ? analysisView : null}
      {search.view === "universe" ? universeView : null}
      {search.view === "operations" ? operationsView : null}
    </WorkspaceShell>
  );
}
