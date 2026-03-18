import * as React from "react";
import type { DashboardSearch } from "./dashboard-config";

export function useDashboardSearch(search: DashboardSearch, selectedSymbol: string | null) {
  return React.useMemo(() => {
    function mergeSearch(partial: Partial<DashboardSearch>): DashboardSearch {
      return {
        ...search,
        ...partial,
      };
    }

    return {
      mergeSearch,
      instrumentSearchFor(symbol: string) {
        return mergeSearch({
          symbol,
        });
      },
      intervalSearchFor(interval: DashboardSearch["interval"]) {
        return mergeSearch({
          symbol: selectedSymbol || undefined,
          interval,
        });
      },
      pageSearchFor(offset: number) {
        return mergeSearch({
          offset,
        });
      },
    };
  }, [search, selectedSymbol]);
}
