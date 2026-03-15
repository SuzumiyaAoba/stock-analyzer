import { initContract } from "@ts-rest/core";

const c = initContract();

export type ScrapedQuote = {
  ticker: string;
  market: string;
  name: string;
  priceJpy: number;
  scrapedAt: string;
  sourceUrl: string;
};

export const scraperContract = c.router({
  health: {
    method: "GET",
    path: "/health",
    responses: {
      200: c.type<{ status: "ok" }>(),
    },
    summary: "Check scraper availability",
  },
  submitQuote: {
    method: "POST",
    path: "/quotes",
    body: c.type<ScrapedQuote>(),
    responses: {
      201: c.type<{ accepted: true }>(),
    },
    summary: "Submit a scraped quote",
  },
});

export type ScraperContract = typeof scraperContract;
