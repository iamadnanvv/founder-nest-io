import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "../supabase";

export default defineTool({
  name: "send_direct_message",
  title: "Send a direct message",
  description: "Send a 1:1 direct message to another founder by their user id.",
  inputSchema: {
    recipient_id: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ recipient_id, body }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("messages").insert({ sender_id: ctx.getUserId()!, receiver_id: recipient_id, content: body }).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Message sent: ${data.id}` }], structuredContent: { message: data } };
  },
});
