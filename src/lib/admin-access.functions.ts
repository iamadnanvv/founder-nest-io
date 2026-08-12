/**
 * Admin-only access management.
 *
 * Members who pay through the hosted Razorpay payment link (instead of the
 * in-app checkout) cannot be auto-verified by signature, so an admin activates
 * their lifetime access manually here.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Grant or revoke ₹1,599 lifetime access for a member. Admins only. */
export const setMemberPaidStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; isPaid: boolean }) => {
    if (!input?.userId) throw new Error("userId is required");
    return { userId: input.userId, isPaid: !!input.isPaid };
  })
  .handler(async ({ data, context }) => {
    // Verify the caller is an admin using their own RLS-scoped role row.
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_paid: data.isPaid,
        paid_at: data.isPaid ? new Date().toISOString() : null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
