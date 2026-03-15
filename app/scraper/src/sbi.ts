import process from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

import type { Page } from "playwright";

const SBI_LOGIN_URL = "https://login.sbisec.co.jp/";
const LOGIN_FORM_SELECTOR = 'input[name="username"]';
const LOGIN_ERROR_TEXT = "ログインエラー";
const MAINTENANCE_TEXT = "臨時メンテナンスのお知らせ";
const INVALID_CREDENTIALS_TEXT = "ユーザーネーム、ログインパスワードに誤りがないかご確認ください。";
const ADDITIONAL_AUTH_KEYWORDS = ["電話番号認証", "認証コード", "ワンタイムパスワード", "追加認証"];

/**
 * SBI ログイン処理と、その後の認証待機に利用するブラウザ設定です。
 */
export type SbiBrowserConfig = {
  channel: string | undefined;
  credentialsOutputPath: string;
  headless: boolean;
  slowMoMs: number;
  timeoutMs: number;
};

/**
 * 対話入力で取得した SBI 証券の認証情報です。
 */
export type SbiCredentials = {
  password: string;
  username: string;
};

/**
 * ログイン試行後の画面状態を表します。
 */
export type SbiLoginResult = {
  currentUrl: string;
  status: "additional-auth-required" | "logged-in";
  title: string;
};

/**
 * 標準入力から SBI のユーザーネームとログインパスワードを受け取ります。
 *
 * パスワードは TTY であれば非表示入力にし、どちらかが空文字の場合は例外を送出します。
 *
 * @returns 入力検証済みの SBI 認証情報
 * @throws 入力値が不足している場合
 */
export async function promptForSbiCredentials(): Promise<SbiCredentials> {
  const prompt = createPromptSession();

  try {
    const username = (await prompt.question("SBI ユーザーネーム: ")).trim();
    const password = (await prompt.hiddenQuestion("SBI ログインパスワード: ")).trim();

    if (username === "" || password === "") {
      throw new Error("SBI のユーザーネームとログインパスワードはどちらも必須です。");
    }

    return { password, username };
  } finally {
    prompt.close();
  }
}

/**
 * 暗号化ファイルの保護に使うパスワードを 2 回入力で確認しながら取得します。
 *
 * 復号耐性を確保するため 64 文字以上を必須にし、再入力一致もここで検証します。
 *
 * @returns 暗号化に利用するパスワード
 * @throws パスワード長が不足している場合
 * @throws 確認入力と一致しない場合
 */
export async function promptForEncryptionPassword(): Promise<string> {
  const prompt = createPromptSession();

  try {
    const password = (await prompt.hiddenQuestion("暗号化パスワード（64文字以上）: ")).trim();
    const confirmation = (await prompt.hiddenQuestion("暗号化パスワード再入力: ")).trim();

    if (password.length < 64) {
      throw new Error("暗号化パスワードは 64 文字以上で入力してください。");
    }

    if (password !== confirmation) {
      throw new Error("暗号化パスワードが一致しませんでした。");
    }

    return password;
  } finally {
    prompt.close();
  }
}

/**
 * SBI スクレイパーの実行設定を環境変数から組み立てます。
 *
 * 未設定の値には安全側の既定値を適用し、値の妥当性チェックは各パーサー関数へ委譲します。
 *
 * @returns 正規化済みのブラウザ設定
 */
export function readSbiBrowserConfigFromEnv(): SbiBrowserConfig {
  return {
    channel: readOptionalEnv("SBI_BROWSER_CHANNEL"),
    credentialsOutputPath:
      readOptionalEnv("SBI_CREDENTIALS_OUTPUT_PATH") ?? ".secrets/sbi-credentials.enc.json",
    headless: readBooleanEnv("SBI_HEADLESS", false),
    slowMoMs: readNumberEnv("SBI_SLOW_MO_MS", 0),
    timeoutMs: readNumberEnv("SBI_ADDITIONAL_AUTH_TIMEOUT_MS", 120_000),
  };
}

/**
 * SBI のログイン画面へ遷移し、認証情報を送信してログイン状態を判定します。
 *
 * 追加認証が必要なケースでは、ログイン URL 配下に留まったままログインフォームだけ消えることがあるため、
 * URL と DOM 文言の両方を組み合わせて状態を分類します。
 *
 * @param page 操作用 Playwright ページ
 * @param credentials 入力済みの SBI 認証情報
 * @returns 判定済みのログイン結果
 * @throws メンテナンス画面に到達した場合
 * @throws 認証エラーを検知した場合
 * @throws 画面状態を分類できなかった場合
 */
export async function loginToSbi(page: Page, credentials: SbiCredentials): Promise<SbiLoginResult> {
  await page.goto(SBI_LOGIN_URL, { waitUntil: "domcontentloaded" });
  await assertLoginPageAvailable(page);

  await page.locator('input[name="username"]').fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);

  // クリック直後の軽微な遷移失敗で全体を落とさないよう、送信と初期遷移待ちを並行させます。
  await Promise.all([
    page.locator('button[type="submit"]').click(),
    page.waitForLoadState("domcontentloaded").catch(() => undefined),
  ]);

  await waitForLoginTransition(page);

  const bodyText = await getBodyText(page);

  if (bodyText.includes(LOGIN_ERROR_TEXT) || bodyText.includes(INVALID_CREDENTIALS_TEXT)) {
    throw new Error(
      "SBI 証券へのログインに失敗しました。ユーザーネームまたはログインパスワードを確認してください。",
    );
  }

  if (
    // 追加認証画面ではログイン URL のままフォームだけ消えることがあるため、両条件を監視します。
    ADDITIONAL_AUTH_KEYWORDS.some((keyword) => bodyText.includes(keyword)) ||
    (!(await hasLoginForm(page)) && page.url().startsWith(SBI_LOGIN_URL))
  ) {
    return buildLoginResult(page, "additional-auth-required");
  }

  if (!(await hasLoginForm(page)) && !page.url().startsWith(SBI_LOGIN_URL)) {
    return buildLoginResult(page, "logged-in");
  }

  throw new Error(`SBI 証券のログイン状態を判定できませんでした。URL: ${page.url()}`);
}

/**
 * 追加認証が完了して通常セッションへ遷移するまで待機します。
 *
 * ブラウザ操作はユーザーに委ね、こちらでは一定間隔で画面状態を再評価して完了のみ検知します。
 *
 * @param page 追加認証が表示されている Playwright ページ
 * @param timeoutMs 待機上限時間
 * @returns 通常ログイン完了後のページ情報
 * @throws 認証エラーを検知した場合
 * @throws 指定時間内に通常セッションへ遷移しなかった場合
 */
export async function waitForSbiSessionReady(
  page: Page,
  timeoutMs: number,
): Promise<SbiLoginResult> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const bodyText = await getBodyText(page);

    if (bodyText.includes(LOGIN_ERROR_TEXT) || bodyText.includes(INVALID_CREDENTIALS_TEXT)) {
      throw new Error(
        "SBI 証券へのログインに失敗しました。ユーザーネームまたはログインパスワードを確認してください。",
      );
    }

    if (!(await hasLoginForm(page)) && !page.url().startsWith(SBI_LOGIN_URL)) {
      return buildLoginResult(page, "logged-in");
    }

    // 画面更新をユーザー操作に委ねるため、短いポーリング間隔で状態だけ確認します。
    await page.waitForTimeout(1_000);
  }

  throw new Error("追加認証の完了待ちがタイムアウトしました。ブラウザ上で認証を完了してください。");
}

/**
 * 真偽値系の環境変数をアプリ内で扱いやすい boolean へ変換します。
 *
 * @param name 環境変数名
 * @param defaultValue 未設定時に使う既定値
 * @returns パース済みの真偽値
 * @throws 許可されない文字列が設定されている場合
 */
export function readBooleanEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (value === undefined || value === "") {
    return defaultValue;
  }

  if (value === "1" || value === "true" || value === "yes") {
    return true;
  }

  if (value === "0" || value === "false" || value === "no") {
    return false;
  }

  throw new Error(`Environment variable ${name} must be one of: true, false, 1, 0, yes, no`);
}

/**
 * 数値系の環境変数を非負整数・実数として受け取り、未設定時は既定値を返します。
 */
function readNumberEnv(name: string, defaultValue: number): number {
  const value = process.env[name]?.trim();

  if (value === undefined || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative number.`);
  }

  return parsed;
}

/**
 * 文字列環境変数を読み込み、空文字を未設定として扱います。
 */
function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();

  if (value === undefined || value === "") {
    return undefined;
  }

  return value;
}

/**
 * ログイン送信後に主要な状態変化が起こるまで待機します。
 *
 * URL 遷移、エラー表示、追加認証表示、ネットワーク安定化のいずれかを先に観測した時点で判定フェーズへ進みます。
 */
async function waitForLoginTransition(page: Page): Promise<void> {
  // どの分岐へ進むかは次段の判定ロジックで決めるため、ここでは「変化が起きた」ことだけを待ちます。
  await Promise.race([
    page
      .waitForURL((url) => !url.toString().startsWith(SBI_LOGIN_URL), {
        timeout: 15_000,
      })
      .catch(() => undefined),
    page
      .getByText(LOGIN_ERROR_TEXT, { exact: false })
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => undefined),
    page
      .getByText("電話番号認証", { exact: false })
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => undefined),
    page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined),
  ]);
}

/**
 * ログインページがメンテナンスやアクセス制限状態でないことを確認します。
 */
async function assertLoginPageAvailable(page: Page): Promise<void> {
  const bodyText = await getBodyText(page);

  if (page.url().includes("/attention/maintenance.html") || bodyText.includes(MAINTENANCE_TEXT)) {
    throw new Error(
      "SBI 証券のログインページに到達できませんでした。メンテナンス中、または headless アクセスが制限されている可能性があります。",
    );
  }
}

/**
 * 現在のページ情報から共通のログイン結果オブジェクトを構築します。
 */
async function buildLoginResult(
  page: Page,
  status: SbiLoginResult["status"],
): Promise<SbiLoginResult> {
  return {
    currentUrl: page.url(),
    status,
    title: await page.title(),
  };
}

/**
 * 本文取得に失敗しても判定処理全体は継続できるよう、失敗時は空文字を返します。
 */
async function getBodyText(page: Page): Promise<string> {
  return page
    .locator("body")
    .innerText()
    .catch(() => "");
}

/**
 * ログインフォームの有無を使って、認証後の画面へ進んだかを補助判定します。
 */
async function hasLoginForm(page: Page): Promise<boolean> {
  return (await page.locator(LOGIN_FORM_SELECTOR).count()) > 0;
}

/**
 * 標準入力からの通常入力と非表示入力をまとめて扱うプロンプトセッションを生成します。
 */
function createPromptSession(): PromptSession {
  const terminal = process.stdin.isTTY && process.stdout.isTTY;
  const output = terminal ? new MutableStdout() : process.stdout;
  const readline = createInterface({
    input: process.stdin,
    output,
    terminal,
  });

  return {
    close(): void {
      readline.close();
    },
    async hiddenQuestion(promptText: string): Promise<string> {
      if (output instanceof MutableStdout) {
        // 入力そのものは受け付けつつ画面へのエコーバックだけ抑止します。
        process.stdout.write(promptText);
        output.muted = true;
        const answer = await readline.question("");
        output.muted = false;
        process.stdout.write("\n");
        return answer;
      }

      return readline.question(promptText);
    },
    question(promptText: string): Promise<string> {
      return readline.question(promptText);
    },
  };
}

/**
 * readline が書き出す文字列を一時的に抑止するための Writable 実装です。
 */
class MutableStdout extends Writable {
  muted = false;

  override _write(
    chunk: string | Uint8Array,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (!this.muted) {
      process.stdout.write(chunk, encoding);
    }

    callback();
  }
}

/**
 * CLI 入力セッションが提供する最小インターフェースです。
 */
type PromptSession = {
  close: () => void;
  hiddenQuestion: (promptText: string) => Promise<string>;
  question: (promptText: string) => Promise<string>;
};
