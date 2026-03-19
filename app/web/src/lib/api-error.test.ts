import { describe, expect, it } from "vitest";
import { formatHttpErrorMessage } from "./api-error";

describe("formatHttpErrorMessage", () => {
  it("HTML エラーページは本文を露出しない", () => {
    expect(
      formatHttpErrorMessage(
        502,
        "Bad Gateway",
        "<!DOCTYPE html><html><body><h1>502 - Bad Gateway</h1></body></html>",
        "text/html; charset=utf-8",
      ),
    ).toBe(
      "YFinance API が 502 Bad Gateway を返しました。上流サービスが一時的に利用できません。時間をおいて再試行してください。",
    );
  });

  it("JSON の message は詳細として取り出す", () => {
    expect(
      formatHttpErrorMessage(
        400,
        "Bad Request",
        JSON.stringify({ message: "symbol は必須です" }),
        "application/json",
      ),
    ).toBe(
      "YFinance API が 400 Bad Request を返しました。リクエストが不正です。 詳細: symbol は必須です",
    );
  });

  it("通常テキストは詳細として短く付与する", () => {
    expect(
      formatHttpErrorMessage(503, "Service Unavailable", "temporary upstream outage", "text/plain"),
    ).toBe(
      "YFinance API が 503 Service Unavailable を返しました。サービスが一時的に利用できません。時間をおいて再試行してください。 詳細: temporary upstream outage",
    );
  });
});
