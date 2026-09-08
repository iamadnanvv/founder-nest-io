// Telegram webhook: handles all incoming updates and command routing.
// Registered via `setWebhook` with a secret_token = sha256("telegram-webhook:" + bot token).
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { deriveWebhookSecret, sendMessage } from "@/lib/telegram.server";

const PUBLIC_ORIGIN = "https://foundercommunity.vercel.app";

type TgMessage = {
  message_id: number;
  from?: { id: number; username?: string; first_name?: string };
  chat: { id: number };
  text?: string;
};
type TgUpdate = { update_id: number; message?: TgMessage; edited_message?: TgMessage };

function admin() {
  // Deferred import so the client bundle never sees the service-role key.
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Verify Telegram's secret header.
        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        const expected = deriveWebhookSecret();
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json()) as TgUpdate;
        const msg = update.message ?? update.edited_message;
        if (!msg?.chat?.id) return Response.json({ ok: true });

        try {
          await handleMessage(msg);
        } catch (err) {
          console.error("telegram webhook handler error", err);
          try {
            await sendMessage(
              msg.chat.id,
              "⚠️ Something went wrong handling that. Try again in a moment.",
            );
          } catch (notifyErr) {
            // Telegram is unreachable; the original error is already logged.
            console.error("telegram webhook notify failed", notifyErr);
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});

async function handleMessage(msg: TgMessage) {
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  if (!text) return;

  const [rawCmd, ...rest] = text.split(/\s+/);
  const cmd = rawCmd.toLowerCase().replace(/@.*/, ""); // strip @botname
  const arg = rest.join(" ").trim();

  const sb = await admin();
  const link = await getLinkedUser(sb, chatId);

  // Public commands (no link required)
  switch (cmd) {
    case "/start":
      return sendMessage(
        chatId,
        `👋 <b>Welcome to FounderHunt</b>\n\nTo connect your account:\n1. Open <a href="${PUBLIC_ORIGIN}/profile">${PUBLIC_ORIGIN}/profile</a>\n2. Generate a link code under <b>Telegram</b>\n3. Send it here as <code>/link YOUR_CODE</code>\n\nType /help to see all commands.`,
      );
    case "/help":
      return sendMessage(chatId, helpText(!!link));
    case "/link":
      return handleLink(sb, chatId, arg, msg);
  }

  // Everything below requires a linked account
  if (!link) {
    return sendMessage(
      chatId,
      "🔒 Link your account first. Send <code>/link YOUR_CODE</code> — get a code at " +
        PUBLIC_ORIGIN +
        "/profile",
    );
  }

  switch (cmd) {
    case "/whoami":
      return handleWhoAmI(sb, chatId, link.user_id);
    case "/unlink":
      return handleUnlink(sb, chatId, link.user_id);
    case "/mute":
      return handleMute(sb, chatId, link.user_id, arg);
    case "/unmute":
      return handleUnmute(sb, chatId, link.user_id, arg);
    case "/post":
      return handlePost(sb, chatId, link.user_id, arg);
    case "/feed":
      return handleFeed(sb, chatId);
    case "/discussions":
      return handleDiscussions(sb, chatId);
    case "/reply":
      return handleReply(sb, chatId, link.user_id, arg);
    case "/events":
      return handleEvents(sb, chatId);
    case "/resources":
      return handleResources(sb, chatId);
    case "/founders":
      return handleFounders(sb, chatId, arg);
    default:
      return sendMessage(chatId, "🤔 Unknown command. Type /help.");
  }
}

function helpText(linked: boolean) {
  const base = [
    "<b>FounderHunt Bot</b>",
    "",
    "🔗 /link CODE — connect your account",
    "/help — this menu",
  ];
  if (!linked) return base.join("\n");
  return [
    ...base,
    "/whoami — show linked account",
    "/unlink — disconnect",
    "",
    "<b>Discovery</b>",
    "/feed — latest community posts",
    "/discussions — recent threads",
    "/events — upcoming events",
    "/resources — resource library",
    "/founders QUERY — search founders",
    "",
    "<b>Interaction</b>",
    "/post TEXT — post to community feed",
    "/reply DISCUSSION_ID TEXT — reply to a discussion",
    "",
    "<b>Notifications</b>",
    "/mute dm|reply|engagement|events",
    "/unmute dm|reply|engagement|events",
  ].join("\n");
}

/* ---------------------------- linking ---------------------------- */

async function getLinkedUser(sb: any, chatId: number) {
  const { data } = await sb.from("telegram_links").select("*").eq("chat_id", chatId).maybeSingle();
  return data;
}

async function handleLink(sb: any, chatId: number, code: string, msg: TgMessage) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return sendMessage(chatId, "Usage: <code>/link YOUR_CODE</code>");

  const { data: row } = await sb
    .from("telegram_link_codes")
    .select("*")
    .eq("code", trimmed)
    .maybeSingle();
  if (!row) return sendMessage(chatId, "❌ Invalid code.");
  if (new Date(row.expires_at) < new Date()) {
    await sb.from("telegram_link_codes").delete().eq("code", trimmed);
    return sendMessage(chatId, "⌛ That code has expired. Generate a new one in your profile.");
  }

  const { error } = await sb.from("telegram_links").upsert(
    {
      user_id: row.user_id,
      chat_id: chatId,
      telegram_username: msg.from?.username ?? null,
      telegram_first_name: msg.from?.first_name ?? null,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return sendMessage(chatId, `❌ Link failed: ${escapeHtml(error.message)}`);

  await sb.from("telegram_link_codes").delete().eq("user_id", row.user_id);
  return sendMessage(
    chatId,
    "✅ Account linked! You'll now get notifications here. Type /help to explore.",
  );
}

async function handleUnlink(sb: any, chatId: number, userId: string) {
  await sb.from("telegram_links").delete().eq("user_id", userId);
  return sendMessage(chatId, "👋 Unlinked. Notifications paused. Use /link CODE to reconnect.");
}

async function handleWhoAmI(sb: any, chatId: number, userId: string) {
  const { data } = await sb
    .from("profiles")
    .select("full_name, startup_name")
    .eq("id", userId)
    .maybeSingle();
  return sendMessage(
    chatId,
    `🪪 Linked as <b>${escapeHtml(data?.full_name ?? "unknown")}</b>${data?.startup_name ? ` — ${escapeHtml(data.startup_name)}` : ""}`,
  );
}

async function handleMute(sb: any, chatId: number, userId: string, arg: string) {
  const col = prefColumn(arg);
  if (!col) return sendMessage(chatId, "Usage: <code>/mute dm|reply|engagement|events</code>");
  await sb
    .from("telegram_links")
    .update({ [col]: false })
    .eq("user_id", userId);
  return sendMessage(chatId, `🔕 Muted <b>${arg}</b>.`);
}
async function handleUnmute(sb: any, chatId: number, userId: string, arg: string) {
  const col = prefColumn(arg);
  if (!col) return sendMessage(chatId, "Usage: <code>/unmute dm|reply|engagement|events</code>");
  await sb
    .from("telegram_links")
    .update({ [col]: true })
    .eq("user_id", userId);
  return sendMessage(chatId, `🔔 Unmuted <b>${arg}</b>.`);
}
function prefColumn(a: string): string | null {
  return (
    (
      {
        dm: "notify_dm",
        reply: "notify_reply",
        engagement: "notify_engagement",
        events: "notify_events",
      } as Record<string, string>
    )[a.toLowerCase()] ?? null
  );
}

/* ---------------------------- interaction ---------------------------- */

async function handlePost(sb: any, chatId: number, userId: string, content: string) {
  if (!content) return sendMessage(chatId, "Usage: <code>/post What's on your mind?</code>");
  if (content.length > 5000) return sendMessage(chatId, "Post too long (max 5000 chars).");
  const { error } = await sb
    .from("posts")
    .insert({ user_id: userId, content, category: "general" });
  if (error) return sendMessage(chatId, `❌ ${escapeHtml(error.message)}`);
  return sendMessage(
    chatId,
    `✅ Posted to the community feed. <a href="${PUBLIC_ORIGIN}/feed">View feed</a>`,
  );
}

async function handleReply(sb: any, chatId: number, userId: string, arg: string) {
  const [id, ...rest] = arg.split(/\s+/);
  const body = rest.join(" ").trim();
  if (!id || !body)
    return sendMessage(
      chatId,
      "Usage: <code>/reply DISCUSSION_ID Your reply</code>\nGet IDs from /discussions",
    );
  const { error } = await sb
    .from("discussion_replies")
    .insert({ discussion_id: id, author_id: userId, content: body });
  if (error) return sendMessage(chatId, `❌ ${escapeHtml(error.message)}`);
  return sendMessage(
    chatId,
    `✅ Reply posted. <a href="${PUBLIC_ORIGIN}/discussions/${id}">Open thread</a>`,
  );
}

/* ---------------------------- discovery ---------------------------- */

async function handleFeed(sb: any, chatId: number) {
  const { data } = await sb
    .from("posts")
    .select("id, content, created_at, profiles:profiles!posts_user_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(5);
  if (!data?.length) return sendMessage(chatId, "No posts yet.");
  const lines = data.map(
    (p: any) =>
      `• <b>${escapeHtml(p.profiles?.full_name ?? "Anon")}</b>: ${escapeHtml(truncate(p.content, 140))}`,
  );
  return sendMessage(
    chatId,
    `📣 <b>Latest feed</b>\n\n${lines.join("\n\n")}\n\n<a href="${PUBLIC_ORIGIN}/feed">Open feed</a>`,
  );
}

async function handleDiscussions(sb: any, chatId: number) {
  const { data } = await sb
    .from("discussions")
    .select("id, title, category, reply_count")
    .order("updated_at", { ascending: false })
    .limit(5);
  if (!data?.length) return sendMessage(chatId, "No discussions yet.");
  const lines = data.map(
    (d: any) =>
      `• <b>${escapeHtml(d.title)}</b> · ${escapeHtml(d.category ?? "general")} · ${d.reply_count ?? 0} replies\n  <code>${d.id}</code>`,
  );
  return sendMessage(
    chatId,
    `💬 <b>Recent discussions</b>\n\n${lines.join("\n\n")}\n\nReply with <code>/reply ID your message</code>`,
  );
}

async function handleEvents(sb: any, chatId: number) {
  const { data } = await sb
    .from("events")
    .select("title, description, event_date, location")
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true })
    .limit(5);
  if (!data?.length)
    return sendMessage(
      chatId,
      'No upcoming events. <a href="' + PUBLIC_ORIGIN + '/events">Browse all</a>',
    );
  const lines = data.map(
    (e: any) =>
      `📅 <b>${escapeHtml(e.title)}</b>\n${new Date(e.event_date).toLocaleString()}${e.location ? ` · ${escapeHtml(e.location)}` : ""}`,
  );
  return sendMessage(
    chatId,
    `<b>Upcoming events</b>\n\n${lines.join("\n\n")}\n\n<a href="${PUBLIC_ORIGIN}/events">All events</a>`,
  );
}

async function handleResources(sb: any, chatId: number) {
  const { data } = await sb
    .from("resources")
    .select("title, category, url")
    .order("created_at", { ascending: false })
    .limit(8);
  if (!data?.length) return sendMessage(chatId, "Resource library is empty.");
  const lines = data.map(
    (r: any) =>
      `📚 <a href="${escapeHtml(r.url ?? "#")}">${escapeHtml(r.title)}</a>${r.category ? ` · ${escapeHtml(r.category)}` : ""}`,
  );
  return sendMessage(
    chatId,
    `<b>Resource library</b>\n\n${lines.join("\n")}\n\n<a href="${PUBLIC_ORIGIN}/resources">Full library</a>`,
  );
}

async function handleFounders(sb: any, chatId: number, q: string) {
  if (!q)
    return sendMessage(
      chatId,
      "Usage: <code>/founders keyword</code> — searches names, startups, industries",
    );
  const like = `%${q}%`;
  const { data } = await sb
    .from("profiles")
    .select("full_name, startup_name, industry, bio")
    .or(`full_name.ilike.${like},startup_name.ilike.${like},industry.ilike.${like}`)
    .limit(8);
  if (!data?.length) return sendMessage(chatId, `No founders match "${escapeHtml(q)}".`);
  const lines = data.map(
    (p: any) =>
      `• <b>${escapeHtml(p.full_name ?? "Founder")}</b>${p.startup_name ? ` — ${escapeHtml(p.startup_name)}` : ""}${p.industry ? ` (${escapeHtml(p.industry)})` : ""}`,
  );
  return sendMessage(
    chatId,
    `🔎 <b>Founders matching "${escapeHtml(q)}"</b>\n\n${lines.join("\n")}\n\n<a href="${PUBLIC_ORIGIN}/members">Full directory</a>`,
  );
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}
