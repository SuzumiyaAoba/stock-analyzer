import { chromium } from "playwright";

import { saveEncryptedJson } from "./secrets.js";
import {
  loginToSbi,
  promptForEncryptionPassword,
  promptForSbiCredentials,
  readSbiBrowserConfigFromEnv,
  waitForSbiSessionReady,
} from "./sbi.js";

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

    if (result.status === "additional-auth-required") {
      console.log("Additional authentication is required on SBI.");
      console.log("Complete the additional authentication in the browser window.");
      result = await waitForSbiSessionReady(page, browserConfig.timeoutMs);
    }

    console.log(`SBI login status: ${result.status}`);
    console.log(`Current URL: ${result.currentUrl}`);
    console.log(`Current page title: ${result.title}`);

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
