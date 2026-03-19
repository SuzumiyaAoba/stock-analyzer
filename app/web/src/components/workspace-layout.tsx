import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BarChart3, DatabaseZap, Radar } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { DashboardSearch, DashboardView } from "~/lib/dashboard-config";
import { cn } from "~/lib/utils";

const workspaceLinks: Array<{
  view: DashboardView;
  label: string;
  icon: typeof BarChart3;
}> = [
  {
    view: "analysis",
    label: "分析",
    icon: BarChart3,
  },
  {
    view: "universe",
    label: "監視",
    icon: Radar,
  },
  {
    view: "operations",
    label: "運用",
    icon: DatabaseZap,
  },
];

export function WorkspaceShell({
  search,
  activeView,
  children,
}: Readonly<{
  search: DashboardSearch;
  activeView: DashboardView;
  children: ReactNode;
}>) {
  return (
    <main className="dashboard-shell mx-auto max-w-[1560px] px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
      <WorkspaceNav search={search} activeView={activeView} />
      {children}
    </main>
  );
}

export function WorkspaceNav({
  search,
  activeView,
}: Readonly<{
  search: DashboardSearch;
  activeView: DashboardView;
}>) {
  return (
    <header className="dashboard-enter flex flex-wrap items-center justify-between gap-3 px-1 py-2">
      <div className="flex items-center gap-3">
        <div>
          <p className="section-kicker">Stock Analyzer</p>
          <h1 className="app-display text-xl font-semibold">Workspace</h1>
        </div>
        {search.symbol ? <Badge variant="secondary">{search.symbol}</Badge> : null}
      </div>

      <nav className="flex flex-wrap gap-2">
        {workspaceLinks.map((item) => {
          const Icon = item.icon;
          const isActive = item.view === activeView;
          return (
            <Button
              key={item.view}
              asChild
              size="sm"
              variant={isActive ? "default" : "ghost"}
              className={cn("justify-start", isActive && "pointer-events-none")}
            >
              <Link to="/" search={{ ...search, view: item.view }} resetScroll={false}>
                <Icon data-icon="inline-start" />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>
    </header>
  );
}

export function WorkspacePageHeader({
  title,
  description,
  badge,
}: Readonly<{
  title: string;
  description: string;
  badge?: string;
}>) {
  return (
    <section className="mt-4 dashboard-enter" data-delay="1">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1 py-2">
        <div>
          <p className="section-kicker">Page</p>
          <h2 className="app-display mt-1 text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{description}</p>
        </div>
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
      </div>
    </section>
  );
}
