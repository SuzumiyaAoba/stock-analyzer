import * as React from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { DashboardSearch, SyncHistoryInterval, SyncHistoryRange } from "./dashboard-config";
import { runSyncJobNow, syncBatchInstruments, syncInstrument } from "./yfinance";

type ActionFeedback = {
  type: "success" | "error";
  message: string;
} | null;

export function useDashboardActions(search: DashboardSearch) {
  const router = useRouter();
  const runSyncInstrument = useServerFn(syncInstrument);
  const runBatchSync = useServerFn(syncBatchInstruments);
  const runSyncJob = useServerFn(runSyncJobNow);

  const [syncSymbolInput, setSyncSymbolInput] = React.useState(search.symbol ?? search.q ?? "");
  const [syncFeedback, setSyncFeedback] = React.useState<ActionFeedback>(null);
  const [syncingSymbol, setSyncingSymbol] = React.useState<string | null>(null);
  const [isSyncPending, startSyncTransition] = React.useTransition();

  const [batchSymbolsInput, setBatchSymbolsInput] = React.useState(search.symbol ?? "");
  const [batchInterval, setBatchInterval] = React.useState<SyncHistoryInterval>("1d");
  const [batchRange, setBatchRange] = React.useState<SyncHistoryRange>("1mo");
  const [batchIncludePrePost, setBatchIncludePrePost] = React.useState(false);
  const [batchSkipQuote, setBatchSkipQuote] = React.useState(false);
  const [batchFeedback, setBatchFeedback] = React.useState<ActionFeedback>(null);
  const [isBatchPending, startBatchTransition] = React.useTransition();

  const [jobFeedback, setJobFeedback] = React.useState<ActionFeedback>(null);
  const [isJobPending, startJobTransition] = React.useTransition();

  const refreshDashboard = React.useEffectEvent(async () => {
    await router.invalidate();
  });

  const moveToSyncedSymbol = React.useEffectEvent(async (symbol: string) => {
    await router.navigate({
      to: "/",
      search: {
        ...search,
        q: symbol,
        symbol,
        offset: 0,
      },
      replace: true,
    });
  });

  React.useEffect(() => {
    setSyncSymbolInput(search.symbol ?? search.q ?? "");
  }, [search.q, search.symbol]);

  React.useEffect(() => {
    if (!search.symbol) {
      return;
    }

    setBatchSymbolsInput((current) => (current.trim() ? current : (search.symbol ?? "")));
  }, [search.symbol]);

  function updateSyncSymbolInput(value: string) {
    setSyncFeedback(null);
    setSyncSymbolInput(value.toUpperCase());
  }

  function updateBatchSymbolsInput(value: string) {
    setBatchFeedback(null);
    setBatchSymbolsInput(value.toUpperCase());
  }

  function submitSync(symbol: string) {
    if (isSyncPending) {
      return;
    }
    if (!symbol) {
      setSyncFeedback({
        type: "error",
        message: "同期する symbol を入力してください。",
      });
      return;
    }

    startSyncTransition(async () => {
      setSyncFeedback(null);
      setSyncingSymbol(symbol);

      try {
        const result = await runSyncInstrument({
          data: {
            symbol,
          },
        });

        await moveToSyncedSymbol(result.symbol);
        await refreshDashboard();

        setSyncSymbolInput(result.symbol);
        setSyncFeedback({
          type: "success",
          message: `${result.symbol} の価格・配当・スナップショットを同期しました。`,
        });
      } catch (error) {
        setSyncFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "同期に失敗しました。",
        });
      } finally {
        setSyncingSymbol(null);
      }
    });
  }

  function handleSyncSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitSync(syncSymbolInput.trim().toUpperCase());
  }

  function handleSyncSymbol(symbol: string) {
    submitSync(symbol.trim().toUpperCase());
  }

  function handleBatchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBatchPending) {
      return;
    }

    if (!batchSymbolsInput.trim()) {
      setBatchFeedback({
        type: "error",
        message: "symbols を1件以上入力してください。",
      });
      return;
    }

    startBatchTransition(async () => {
      setBatchFeedback(null);

      try {
        const result = await runBatchSync({
          data: {
            symbolsText: batchSymbolsInput,
            interval: batchInterval,
            range: batchRange,
            includePrePost: batchIncludePrePost,
            skipQuote: batchSkipQuote,
          },
        });

        const firstSymbol = result.results[0]?.symbol;
        if (firstSymbol) {
          await moveToSyncedSymbol(firstSymbol);
        }
        await refreshDashboard();

        setBatchFeedback({
          type: "success",
          message:
            result.count === 1
              ? `${firstSymbol ?? "対象銘柄"} を一括同期しました。`
              : `${result.count}件の銘柄を一括同期しました。`,
        });
      } catch (error) {
        setBatchFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "一括同期に失敗しました。",
        });
      }
    });
  }

  function handleRunSyncJob() {
    if (isJobPending) {
      return;
    }

    startJobTransition(async () => {
      setJobFeedback(null);

      try {
        const result = await runSyncJob();
        await refreshDashboard();

        setJobFeedback({
          type: "success",
          message:
            result.lastRunError === null
              ? "定期同期ジョブを実行しました。"
              : `ジョブ実行は完了しましたが、エラーが発生しました: ${result.lastRunError}`,
        });
      } catch (error) {
        setJobFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "ジョブ実行に失敗しました。",
        });
      }
    });
  }

  return {
    syncSymbolInput,
    syncFeedback,
    syncingSymbol,
    isSyncPending,
    updateSyncSymbolInput,
    handleSyncSubmit,
    handleSyncSymbol,
    batchSymbolsInput,
    batchInterval,
    batchRange,
    batchIncludePrePost,
    batchSkipQuote,
    batchFeedback,
    isBatchPending,
    updateBatchSymbolsInput,
    setBatchInterval,
    setBatchRange,
    setBatchIncludePrePost,
    setBatchSkipQuote,
    handleBatchSubmit,
    jobFeedback,
    isJobPending,
    handleRunSyncJob,
  };
}
