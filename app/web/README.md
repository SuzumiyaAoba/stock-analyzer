# web

TanStack Start を使った `stock-analyzer` の Web アプリです。`app/yfinance` が提供する API を読み込み、銘柄一覧と詳細を表示します。

## 起動

```bash
npm install
npm run dev
```

デフォルトでは `http://localhost:3001` で起動します。

## 環境変数

- `YFINANCE_API_BASE_URL`: `app/yfinance` の URL。デフォルトは `http://127.0.0.1:3000`

## 補助コマンド

```bash
npm run build
npm run check
```
