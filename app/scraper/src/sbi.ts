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

export type SbiBrowserConfig = {
  channel: string | undefined;
  credentialsOutputPath: string;
  headless: boolean;
  slowMoMs: number;
  timeoutMs: number;
};

export type SbiCredentials = {
  password: string;
  username: string;
};

export type SbiLoginResult = {
  currentUrl: string;
  status: "additional-auth-required" | "logged-in";
  title: string;
};

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

export async function loginToSbi(page: Page, credentials: SbiCredentials): Promise<SbiLoginResult> {
  await page.goto(SBI_LOGIN_URL, { waitUntil: "domcontentloaded" });
  await assertLoginPageAvailable(page);

  await page.locator('input[name="username"]').fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);

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

    await page.waitForTimeout(1_000);
  }

  throw new Error("追加認証の完了待ちがタイムアウトしました。ブラウザ上で認証を完了してください。");
}

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

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();

  if (value === undefined || value === "") {
    return undefined;
  }

  return value;
}

async function waitForLoginTransition(page: Page): Promise<void> {
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

async function assertLoginPageAvailable(page: Page): Promise<void> {
  const bodyText = await getBodyText(page);

  if (page.url().includes("/attention/maintenance.html") || bodyText.includes(MAINTENANCE_TEXT)) {
    throw new Error(
      "SBI 証券のログインページに到達できませんでした。メンテナンス中、または headless アクセスが制限されている可能性があります。",
    );
  }
}

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

async function getBodyText(page: Page): Promise<string> {
  return page
    .locator("body")
    .innerText()
    .catch(() => "");
}

async function hasLoginForm(page: Page): Promise<boolean> {
  return (await page.locator(LOGIN_FORM_SELECTOR).count()) > 0;
}

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

type PromptSession = {
  close: () => void;
  hiddenQuestion: (promptText: string) => Promise<string>;
  question: (promptText: string) => Promise<string>;
};
