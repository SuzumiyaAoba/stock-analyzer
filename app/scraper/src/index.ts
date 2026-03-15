import { chromium } from "playwright";

import { saveEncryptedJson } from "./secrets.js";
import {
  loginToSbi,
  promptForEncryptionPassword,
  promptForSbiCredentials,
  readSbiBrowserConfigFromEnv,
  waitForSbiSessionReady,
} from "./sbi.js";

/**
 * SBI 証券へログインし、入力した認証情報を暗号化して保存する CLI エントリーポイントです。
 *
 * 処理の流れ:
 * 1. 環境変数から Playwright の起動設定を読み込みます。
 * 2. 対話入力で SBI 認証情報を受け取り、ログイン状態を判定します。
 * 3. 追加認証が必要な場合は、ブラウザ上での完了を待機します。
 * 4. ログインに使った認証情報をユーザー指定のパスワードで暗号化し、ファイルへ保存します。
 */
async function main(): Promise<void> {
  const browserConfig = readSbiBrowserConfigFromEnv();
  const browser = await chromium.launch({
    headless: browserConfig.headless,
    slowMo: browserConfig.slowMoMs,
    ...(browserConfig.channel === undefined ? {} : { channel: browserConfig.channel }),
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const credentials = await promptForSbiCredentials();
    let result = await loginToSbi(page, credentials);

    // 追加認証は自動化せず、ユーザーがブラウザ上で完了したことをセッション状態で検知します。
    if (result.status === "additional-auth-required") {
      console.log("Additional authentication is required on SBI.");
      console.log("Complete the additional authentication in the browser window.");
      result = await waitForSbiSessionReady(page, browserConfig.timeoutMs);
    }

    console.log(`SBI login status: ${result.status}`);
    console.log(`Current URL: ${result.currentUrl}`);
    console.log(`Current page title: ${result.title}`);

    // 保存前に別パスワードで再暗号化することで、SBI の平文資格情報をそのまま残さないようにします。
    const encryptionPassword = await promptForEncryptionPassword();
    const encryptedFilePath = await saveEncryptedJson(
      browserConfig.credentialsOutputPath,
      {
        encryptedAt: new Date().toISOString(),
        service: "sbi",
        username: credentials.username,
        password: credentials.password,
      },
      encryptionPassword,
    );

    console.log(`Encrypted credentials saved to: ${encryptedFilePath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error("Scraper bootstrap failed:", error);
  process.exitCode = 1;
});
