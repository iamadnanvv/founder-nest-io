import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "../supabase";

export default defineTool({
  name: "create_feed_post",
  title: "Create a community feed post",
  description: "Publish a post to the FounderHunt community feed as the signed-in user.",
  inputSchema: {
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
    category: z.string().trim().min(1).max(60).default("general"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, body, category }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("posts").insert({ title, body, category, user_id: ctx.getUserId()! }).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Post created: ${data.id}` }], structuredContent: { post: data } };
  },
});
