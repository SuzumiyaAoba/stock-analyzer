import * as React from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { DashboardSearch, SyncHistoryInterval, SyncHistoryRange } from "./dashboard-config";
import {
  runSyncJobNow,
  syncBatchInstruments,
  syncInstrument,
  type BatchSyncResult,
  type SyncJobState,
} from "./yfinance";

type ActionFeedback = {
  type: "success" | "error";
  message: string;
} | null;

function normalizeSymbolInput(value: string) {
  return value.trim().toUpperCase();
}

function toActionError(error: unknown, fallbackMessage: string): ActionFeedback {
  return {
    type: "error",
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

function buildBatchSuccessMessage(result: BatchSyncResult) {
  const firstSymbol = result.results[0]?.symbol;

  if (result.count === 1) {
    return `${firstSymbol ?? "対象銘柄"} を一括同期しました。`;
  }

  return `${result.count}件の銘柄を一括同期しました。`;
}

function buildSyncJobSuccessMessage(result: Pick<SyncJobState, "lastRunError">) {
  if (result.lastRunError === null) {
    return "定期同期ジョブを実行しました。";
  }

  return `ジョブ実行は完了しましたが、エラーが発生しました: ${result.lastRunError}`;
}

export function useDashboardActions(search: DashboardSearch) {
  const router = useRouter();
  const runSyncInstrument = useServerFn(syncInstrument);
  const runBatchSync = useServerFn(syncBatchInstruments);
  const runSyncJob = useServerFn(runSyncJobNow);

  const [syncSymbolInput, setSyncSymbolInput] = React.useState(
    normalizeSymbolInput(search.symbol ?? search.q ?? ""),
  );
  const [syncFeedback, setSyncFeedback] = React.useState<ActionFeedback>(null);
  const [syncingSymbol, setSyncingSymbol] = React.useState<string | null>(null);
  const [isSyncPending, startSyncTransition] = React.useTransition();

  const [batchSymbolsInput, setBatchSymbolsInput] = React.useState(
    normalizeSymbolInput(search.symbol ?? ""),
  );
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
      resetScroll: false,
    });
  });

  React.useEffect(() => {
    setSyncSymbolInput(normalizeSymbolInput(search.symbol ?? search.q ?? ""));
  }, [search.q, search.symbol]);

  React.useEffect(() => {
    if (!search.symbol) {
      return;
    }

    setBatchSymbolsInput((current) =>
      current.trim() ? current : normalizeSymbolInput(search.symbol ?? ""),
    );
  }, [search.symbol]);

  function updateSyncSymbolInput(value: string) {
    setSyncFeedback(null);
    setSyncSymbolInput(normalizeSymbolInput(value));
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
        setSyncFeedback(toActionError(error, "同期に失敗しました。"));
      } finally {
        setSyncingSymbol(null);
      }
    });
  }

  function handleSyncSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitSync(normalizeSymbolInput(syncSymbolInput));
  }

  function handleSyncSymbol(symbol: string) {
    submitSync(normalizeSymbolInput(symbol));
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
          message: buildBatchSuccessMessage(result),
        });
      } catch (error) {
        setBatchFeedback(toActionError(error, "一括同期に失敗しました。"));
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
          message: buildSyncJobSuccessMessage(result),
        });
      } catch (error) {
        setJobFeedback(toActionError(error, "ジョブ実行に失敗しました。"));
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
