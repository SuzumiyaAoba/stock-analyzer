# yfinance API

Bun で Yahoo Finance の価格データと銘柄情報を取得し、SQLite に保存する API です。

## 起動

```bash
bun run dev
```

## テスト

```bash
bun test
```

環境変数:

- `PORT`: デフォルト `3000`
- `DB_PATH`: デフォルト `app/yfinance/data/yfinance.sqlite`
- `SYNC_SYMBOLS`: 定期同期する銘柄をカンマ区切りで指定
- `SYNC_INTERVAL_MS`: 定期同期の間隔ミリ秒。`0` または未指定で無効
- `SYNC_HISTORY_INTERVAL`: 定期同期で使う価格足。デフォルト `1d`
- `SYNC_HISTORY_RANGE`: 定期同期で使う取得期間。デフォルト `1mo`
- `SYNC_INCLUDE_PREPOST`: `true` のとき時間外を含める
- `SYNC_RUN_ON_START`: `false` で起動時の即時実行を無効化

## API

### `GET /healthz`

疎通確認です。

### `POST /api/v1/sync/history`

価格時系列を Yahoo Finance から取得して保存します。

```json
{
  "symbol": "AAPL",
  "interval": "1d",
  "range": "1mo"
}
```

`range` の代わりに `start` / `end` も使えます。

### `POST /api/v1/sync/quote`

銘柄のスナップショット情報を取得して保存します。

```json
{
  "symbol": "AAPL"
}
```

### `POST /api/v1/sync/batch`

複数銘柄をまとめて価格・スナップショット同期します。

```json
{
  "symbols": ["AAPL", "MSFT"],
  "interval": "1d",
  "range": "1mo",
  "skipQuote": false
}
```

### `GET /api/v1/prices?symbol=AAPL&interval=1d&limit=100`

保存済みの価格データを返します。

### `GET /api/v1/actions?symbol=AAPL&type=dividend&limit=100`

保存済みの配当・分割データを返します。

### `GET /api/v1/instruments/AAPL`

保存済みの銘柄情報と最新スナップショットを返します。

### `GET /api/v1/jobs/sync`

定期同期ジョブの設定と直近実行状態を返します。

### `POST /api/v1/jobs/sync/run`

定期同期ジョブを即時実行します。`SYNC_SYMBOLS` が設定されている必要があります。

### `GET /api/v1/jobs/sync/runs?limit=20`

定期同期ジョブの実行履歴を返します。
