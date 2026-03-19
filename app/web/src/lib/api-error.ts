const HTML_PATTERN = /<(?:!doctype|html|head|body)\b/i;
const JSON_LIKE_PATTERN = /^\s*[{[]/;
const WHITESPACE_PATTERN = /\s+/g;

const STATUS_MESSAGE_MAP: Record<number, string> = {
  400: "リクエストが不正です。",
  401: "認証に失敗しました。",
  403: "アクセスが拒否されました。",
  404: "対象の API が見つかりません。",
  429: "リクエストが多すぎます。時間をおいて再試行してください。",
  500: "サーバー内部でエラーが発生しました。",
  502: "上流サービスが一時的に利用できません。時間をおいて再試行してください。",
  503: "サービスが一時的に利用できません。時間をおいて再試行してください。",
  504: "上流サービスの応答がタイムアウトしました。時間をおいて再試行してください。",
};

function normalizeText(value: string) {
  return value.replace(WHITESPACE_PATTERN, " ").trim();
}

function extractMessageFromJson(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  for (const key of ["message", "error", "detail"]) {
    const field = candidate[key];
    if (typeof field === "string" && field.trim()) {
      return normalizeText(field);
    }
  }

  return null;
}

function extractResponseDetail(body: string, contentType: string | null) {
  const normalizedBody = normalizeText(body);
  if (!normalizedBody) {
    return null;
  }

  if (contentType?.includes("application/json") || JSON_LIKE_PATTERN.test(body)) {
    try {
      const parsed = JSON.parse(body) as unknown;
      return extractMessageFromJson(parsed) ?? null;
    } catch {
      return normalizedBody.slice(0, 200);
    }
  }

  if (HTML_PATTERN.test(normalizedBody)) {
    return null;
  }

  return normalizedBody.slice(0, 200);
}

export function formatHttpErrorMessage(
  status: number,
  statusText: string,
  body: string,
  contentType: string | null,
) {
  const detail = extractResponseDetail(body, contentType);
  const summary = STATUS_MESSAGE_MAP[status] ?? "API リクエストに失敗しました。";
  const statusLine = `${status}${statusText ? ` ${statusText}` : ""}`;

  if (detail) {
    return `YFinance API が ${statusLine} を返しました。${summary} 詳細: ${detail}`;
  }

  return `YFinance API が ${statusLine} を返しました。${summary}`;
}
