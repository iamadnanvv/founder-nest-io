// Server-only Telegram Bot API helper. Uses the raw Bot API since
// the token is brought-in-by-user, not a Lovable connector.
import { createHash } from "crypto";

const TG_API = "https://api.telegram.org";

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return t;
}

export function deriveWebhookSecret(): string {
  return createHash("sha256").update(`telegram-webhook:${token()}`).digest("base64url");
}

export async function tg<T = unknown>(method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${TG_API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  return json.result as T;
}

export async function sendMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}
