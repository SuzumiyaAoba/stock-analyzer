import { createFileRoute } from "@tanstack/react-router";
import { InstrumentDetailPanel, InstrumentsPanel, OperationsPanel } from "~/components/dashboard";
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

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-6 max-sm:px-4 max-sm:py-4">
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

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
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
        />
        <InstrumentDetailPanel
          data={data}
          search={search}
          intervalSearchFor={searchBuilder.intervalSearchFor}
          clearDetailFiltersSearchFor={searchBuilder.mergeSearch}
        />
      </section>
    </main>
  );
}
