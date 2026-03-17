import { chromium } from "playwright";

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://site0.sbisec.co.jp/marble/domestic/top.do", {
    waitUntil: "domcontentloaded",
  });

  console.log(`Loaded page title: ${await page.title()}`);

  await browser.close();
}

main().catch((error: unknown) => {
  console.error("Scraper bootstrap failed:", error);
  process.exitCode = 1;
});
