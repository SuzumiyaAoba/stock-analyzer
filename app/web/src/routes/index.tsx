import { createFileRoute } from "@tanstack/react-router";
import { InstrumentDetailPanel, InstrumentsPanel, OperationsPanel } from "~/components/dashboard";
import { dashboardSearchSchema, type DashboardSearch } from "~/lib/dashboard-config";
import { useDashboardActions } from "~/lib/use-dashboard-actions";
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

  function mergeSearch(partial: Partial<DashboardSearch>): DashboardSearch {
    return {
      ...search,
      ...partial,
    };
  }

  function instrumentSearchFor(symbol: string): DashboardSearch {
    return mergeSearch({
      symbol,
    });
  }

  function intervalSearchFor(interval: DashboardSearch["interval"]): DashboardSearch {
    return mergeSearch({
      symbol: data.selectedSymbol || undefined,
      interval,
    });
  }

  function pageSearchFor(offset: number): DashboardSearch {
    return mergeSearch({
      offset,
    });
  }

  return (
    <main className="app-shell">
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

      <section className="dashboard-grid">
        <InstrumentsPanel
          search={search}
          instruments={data.instruments}
          hasPreviousPage={data.hasPreviousPage}
          hasNextPage={data.hasNextPage}
          selectedSymbol={data.selectedSymbol}
          errorMessage={data.errorMessage}
          instrumentSearchFor={instrumentSearchFor}
          pageSearchFor={pageSearchFor}
        />
        <InstrumentDetailPanel
          data={data}
          search={search}
          intervalSearchFor={intervalSearchFor}
          clearDetailFiltersSearchFor={mergeSearch}
        />
      </section>
    </main>
  );
}
