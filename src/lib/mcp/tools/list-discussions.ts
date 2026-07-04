import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "../supabase";

export default defineTool({
  name: "list_discussions",
  title: "List discussion threads",
  description: "List discussion threads, optionally filtered by category.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20),
    category: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, category }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const sb = supabaseForUser(ctx);
    let q = sb.from("discussions").select("id, title, body, category, pinned, locked, view_count, created_at, author_id").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { discussions: data } };
  },
});
