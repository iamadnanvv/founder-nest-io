import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "../supabase";

export default defineTool({
  name: "list_feed_posts",
  title: "List community feed posts",
  description: "List the most recent posts on the FounderHunt community feed.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Max posts to return."),
    category: z.string().optional().describe("Optional category filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, category }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("posts")
      .select("id, content, category, image_url, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (category) q = q.eq("category", category as never);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { posts: data },
    };
  },
});
