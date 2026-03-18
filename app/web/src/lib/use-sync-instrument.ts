import * as React from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { DashboardSearch } from "./dashboard-config";
import { syncInstrument } from "./yfinance";

type SyncFeedback = {
  type: "success" | "error";
  message: string;
} | null;

export function useSyncInstrumentForm(search: DashboardSearch) {
  const router = useRouter();
  const runSyncInstrument = useServerFn(syncInstrument);
  const [syncSymbolInput, setSyncSymbolInput] = React.useState(search.symbol ?? search.q ?? "");
  const [syncFeedback, setSyncFeedback] = React.useState<SyncFeedback>(null);
  const [isSyncPending, startSyncTransition] = React.useTransition();

  React.useEffect(() => {
    if (search.symbol || search.q) {
      setSyncSymbolInput(search.symbol ?? search.q ?? "");
    }
  }, [search.q, search.symbol]);

  function updateSyncSymbolInput(value: string) {
    setSyncSymbolInput(value.toUpperCase());
  }

  function handleSyncSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = syncSymbolInput.trim().toUpperCase();
    if (!symbol) {
      setSyncFeedback({
        type: "error",
        message: "同期する symbol を入力してください。",
      });
      return;
    }

    startSyncTransition(async () => {
      setSyncFeedback(null);

      try {
        const result = await runSyncInstrument({
          data: {
            symbol,
          },
        });

        await router.navigate({
          to: "/",
          search: (prev) => ({
            ...prev,
            q: result.symbol,
            symbol: result.symbol,
            interval: prev.interval ?? "1d",
          }),
          replace: true,
        });
        await router.invalidate();

        setSyncSymbolInput(result.symbol);
        setSyncFeedback({
          type: "success",
          message: `${result.symbol} のデータを取得して保存しました。`,
        });
      } catch (error) {
        setSyncFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "同期に失敗しました。",
        });
      }
    });
  }

  return {
    syncSymbolInput,
    syncFeedback,
    isSyncPending,
    updateSyncSymbolInput,
    handleSyncSubmit,
  };
}
