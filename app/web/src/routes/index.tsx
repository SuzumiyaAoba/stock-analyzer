import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HeroPanel, InstrumentDetailPanel, InstrumentsPanel } from "~/components/dashboard";
import { dashboardSearchSchema, type DashboardSearch } from "~/lib/dashboard-config";
import { useSyncInstrumentForm } from "~/lib/use-sync-instrument";
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
  const syncForm = useSyncInstrumentForm(search);

  function instrumentSearchFor(symbol: string): DashboardSearch {
    return {
      q: search.q,
      interval: search.interval,
      symbol,
    };
  }

  function intervalSearchFor(interval: DashboardSearch["interval"]): DashboardSearch {
    return {
      q: search.q,
      symbol: data.selectedSymbol || undefined,
      interval,
    };
  }

  return (
    <main className="app-shell">
      <HeroPanel
        syncSymbolInput={syncForm.syncSymbolInput}
        syncFeedback={syncForm.syncFeedback}
        isSyncPending={syncForm.isSyncPending}
        onSyncInputChange={syncForm.updateSyncSymbolInput}
        onSyncSubmit={syncForm.handleSyncSubmit}
      />

      <section className="dashboard-grid">
        <InstrumentsPanel
          search={search}
          instruments={data.instruments}
          selectedSymbol={data.selectedSymbol}
          errorMessage={data.errorMessage}
          instrumentSearchFor={instrumentSearchFor}
        />
        <InstrumentDetailPanel data={data} search={search} intervalSearchFor={intervalSearchFor} />
      </section>
    </main>
  );
}
