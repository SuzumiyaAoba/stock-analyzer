import * as React from "react";
import { Link } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DataTable } from "~/components/ui/data-table";
import type { DashboardSearch } from "~/lib/dashboard-config";
import { derivePriceChange, formatPercentChange, formatPrice } from "~/lib/dashboard-formatters";
import type { InstrumentListItem, ScreenerInstrument } from "~/lib/yfinance";

type DashboardPath = "/" | "/universe";

const instrumentColumnHelper = createColumnHelper<InstrumentListItem>();
const screenerColumnHelper = createColumnHelper<ScreenerInstrument>();

type InstrumentTableProps = {
  detailTo?: DashboardPath;
  instrumentSearchFor: (symbol: string) => DashboardSearch;
  instruments: InstrumentListItem[];
  selectedSymbol: string | null;
  variant: "compact" | "full";
};

type JapanMarketTableProps = {
  isSyncPending: boolean;
  items: ScreenerInstrument[];
  onSyncSymbol: (symbol: string) => void;
  syncingSymbol: string | null;
};

export function InstrumentTable({
  detailTo = "/",
  instrumentSearchFor,
  instruments,
  selectedSymbol,
  variant,
}: Readonly<InstrumentTableProps>) {
  const columns = React.useMemo<ColumnDef<InstrumentListItem, unknown>[]>(() => {
    const baseColumns: ColumnDef<InstrumentListItem, unknown>[] = [
      instrumentColumnHelper.display({
        id: "symbol",
        header: "銘柄",
        meta: {
          cellClassName: variant === "full" ? "min-w-0" : undefined,
        },
        cell: ({ row }) => {
          const item = row.original;
          const isActive = item.symbol === selectedSymbol;

          return (
            <div className="grid gap-0.5">
              <Link
                to={detailTo}
                search={instrumentSearchFor(item.symbol)}
                resetScroll={false}
                className="app-display text-base font-semibold"
                aria-current={isActive ? "page" : undefined}
              >
                {item.symbol}
              </Link>
              <span className="truncate text-xs text-[color:var(--muted-foreground)]">
                {item.shortName || item.longName || "-"}
              </span>
            </div>
          );
        },
      }),
      instrumentColumnHelper.display({
        id: "price",
        header: "価格",
        meta: {
          headerClassName: variant === "compact" ? "text-right" : undefined,
          cellClassName:
            variant === "compact"
              ? "whitespace-nowrap text-right font-semibold"
              : "whitespace-nowrap font-semibold",
        },
        cell: ({ row }) =>
          formatPrice(row.original.latestQuote?.regularMarketPrice, row.original.currency),
      }),
      instrumentColumnHelper.display({
        id: "change",
        header: "騰落",
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
        cell: ({ row }) => (
          <PercentBadge value={quoteDiffRatio(row.original.latestQuote)}>
            {formatPercentChange(row.original.latestQuote)}
          </PercentBadge>
        ),
      }),
    ];

    if (variant === "full") {
      baseColumns.push(
        instrumentColumnHelper.display({
          id: "detail",
          header: "詳細",
          meta: {
            headerClassName: "text-right",
            cellClassName: "text-right",
          },
          cell: ({ row }) => {
            const item = row.original;
            const isActive = item.symbol === selectedSymbol;

            return (
              <Button asChild size="sm" variant={isActive ? "secondary" : "ghost"}>
                <Link to={detailTo} search={instrumentSearchFor(item.symbol)} resetScroll={false}>
                  {isActive ? "表示中" : "開く"}
                </Link>
              </Button>
            );
          },
        }),
      );
    }

    return baseColumns;
  }, [detailTo, instrumentSearchFor, selectedSymbol, variant]);

  return (
    <DataTable
      columns={columns}
      data={instruments}
      getRowId={(row) => row.symbol}
      hideHeader={variant === "compact"}
      rowProps={(row) => ({
        "data-state": row.original.symbol === selectedSymbol ? "selected" : undefined,
      })}
      tableClassName="min-w-full"
    />
  );
}

export function JapanMarketTable({
  isSyncPending,
  items,
  onSyncSymbol,
  syncingSymbol,
}: Readonly<JapanMarketTableProps>) {
  const tableData = React.useMemo(() => items.slice(0, 5), [items]);
  const columns = React.useMemo<ColumnDef<ScreenerInstrument, unknown>[]>(
    () => [
      screenerColumnHelper.display({
        id: "symbol",
        cell: ({ row }) => (
          <div className="grid gap-0.5">
            <span className="app-display text-sm font-semibold">{row.original.symbol}</span>
            <span className="truncate text-xs text-[color:var(--muted-foreground)]">
              {row.original.shortName || row.original.longName || "-"}
            </span>
          </div>
        ),
        meta: {
          cellClassName: "font-medium",
        },
      }),
      screenerColumnHelper.display({
        id: "change",
        cell: ({ row }) => (
          <PercentBadge value={row.original.regularMarketChangePercent}>
            {formatSignedPercent(row.original.regularMarketChangePercent)}
          </PercentBadge>
        ),
        meta: {
          cellClassName: "text-right",
        },
      }),
      screenerColumnHelper.display({
        id: "sync",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onSyncSymbol(row.original.symbol)}
            disabled={isSyncPending}
          >
            {syncingSymbol === row.original.symbol ? "同期中" : "同期"}
          </Button>
        ),
        meta: {
          cellClassName: "text-right",
        },
      }),
    ],
    [isSyncPending, onSyncSymbol, syncingSymbol],
  );

  return (
    <DataTable
      columns={columns}
      data={tableData}
      getRowId={(row) => row.symbol}
      hideHeader
      tableClassName="min-w-full"
    />
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

function changeBadgeVariant(value: number | null): "success" | "destructive" | "outline" {
  if (value === null) {
    return "outline";
  }

  if (value < 0) {
    return "destructive";
  }

  return "success";
}

function formatSignedPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function quoteDiffRatio(
  quote:
    | {
        previousClose: number | null;
        regularMarketPrice: number | null;
      }
    | null
    | undefined,
) {
  return derivePriceChange(quote).diffRatio;
}
