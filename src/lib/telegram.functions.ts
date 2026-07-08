// Server functions the profile page calls to manage Telegram linking.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function makeCode() {
  // 8-char code, unambiguous alphabet.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const generateTelegramLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Clear any existing codes for this user first.
    await supabase.from("telegram_link_codes").delete().eq("user_id", userId);
    const code = makeCode();
    const { error } = await supabase.from("telegram_link_codes").insert({ code, user_id: userId });
    if (error) throw new Error(error.message);
    return { code, expires_in_minutes: 15 };
  });

export const getTelegramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("telegram_links").select("*").eq("user_id", userId).maybeSingle();
    return { linked: !!data, link: data };
  });

export const unlinkTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("telegram_links").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const prefsSchema = z.object({
  notify_dm: z.boolean().optional(),
  notify_reply: z.boolean().optional(),
  notify_engagement: z.boolean().optional(),
  notify_events: z.boolean().optional(),
});

export const updateTelegramPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => prefsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("telegram_links").update(data).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
