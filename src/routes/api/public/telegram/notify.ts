// Called by the database trigger `on_notification_forward_telegram` whenever
// a notification is created for a user who has linked Telegram.
// Authenticated with the Supabase anon key in the `apikey` header (see
// migration 20260708 — matches the trigger's headers).
import { createFileRoute } from "@tanstack/react-router";
import { sendMessage } from "@/lib/telegram.server";

const PUBLIC_ORIGIN = "https://foundercommunity.vercel.app";

const TYPE_EMOJI: Record<string, string> = {
  message: "✉️",
  discussion_reply: "💬",
  post_like: "❤️",
  startup_upvote: "🔺",
  event_reminder: "⏰",
  new_event: "📅",
  system: "🔔",
};

export const Route = createFileRoute("/api/public/telegram/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { chat_id, type, message, link } = (await request.json()) as {
          chat_id: number;
          type: string;
          message: string;
          link?: string | null;
        };

        if (!chat_id || !message)
          return Response.json({ ok: false, error: "bad payload" }, { status: 400 });

        const emoji = TYPE_EMOJI[type] ?? "🔔";
        const url = link ? `${PUBLIC_ORIGIN}${link.startsWith("/") ? link : `/${link}`}` : null;
        const body = `${emoji} <b>${escapeHtml(message)}</b>${url ? `\n\n<a href="${url}">Open in FounderHunt</a>` : ""}`;

        try {
          await sendMessage(chat_id, body);
        } catch (err) {
          console.error("telegram notify failed", err);
          return Response.json({ ok: false }, { status: 502 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}
