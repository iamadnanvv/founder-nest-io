import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "../supabase";

export default defineTool({
  name: "list_events",
  title: "List upcoming events",
  description: "List upcoming FounderHunt community events (meetups, webinars).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("events").select("*").order("event_date", { ascending: true }).limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { events: data } };
  },
});
