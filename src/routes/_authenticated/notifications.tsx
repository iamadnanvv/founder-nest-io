import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · founder/hunt" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: notifs } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const markAll = async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
    qc.invalidateQueries({ queryKey: ["notif-unread", userId] });
  };

  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
    qc.invalidateQueries({ queryKey: ["notif-unread", userId] });
  };

  const removeOne = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
    qc.invalidateQueries({ queryKey: ["notif-unread", userId] });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black uppercase tracking-tight text-foreground">
            Notifications
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Recent activity across your feeds
          </p>
        </div>
        <button
          onClick={markAll}
          className="border-2 border-foreground bg-background px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-acid hover:text-background"
        >
          <Check className="mr-1 inline size-3" /> Mark all read
        </button>
      </header>

      <div className="space-y-2">
        {(notifs ?? []).length === 0 && (
          <div className="border-2 border-dashed border-foreground p-8 text-center">
            <Bell className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              You're all caught up
            </p>
          </div>
        )}
        {(notifs ?? []).map((n: any) => (
          <div
            key={n.id}
            className={`flex items-center gap-3 border-2 border-foreground p-3 ${n.read_at ? "bg-background" : "bg-surface shadow-brutal-sm"}`}
          >
            <div
              className={`grid size-8 shrink-0 place-items-center border-2 border-foreground font-mono text-[9px] font-bold uppercase ${typeColor(n.type)}`}
            >
              {typeLabel(n.type)}
            </div>
            <div className="min-w-0 flex-1">
              {n.link ? (
                <Link
                  to={n.link}
                  onClick={() => markOne(n.id)}
                  className="text-sm text-foreground hover:text-electric"
                >
                  {n.message}
                </Link>
              ) : (
                <span className="text-sm text-foreground">{n.message}</span>
              )}
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
              </div>
            </div>
            {!n.read_at && (
              <button
                onClick={() => markOne(n.id)}
                className="border-2 border-foreground bg-background p-1.5 hover:bg-acid hover:text-background"
              >
                <Check className="size-3" />
              </button>
            )}
            <button
              onClick={() => removeOne(n.id)}
              className="border-2 border-foreground bg-background p-1.5 hover:bg-hot hover:text-background"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function typeColor(t: string) {
  return (
    (
      {
        post_like: "bg-hot text-background",
        startup_upvote: "bg-acid text-background",
        discussion_reply: "bg-electric text-background",
        message: "bg-gold text-background",
        event_reminder: "bg-foreground text-background",
        system: "bg-muted text-foreground",
      } as Record<string, string>
    )[t] ?? "bg-muted text-foreground"
  );
}
function typeLabel(t: string) {
  return (
    (
      {
        post_like: "♥",
        startup_upvote: "▲",
        discussion_reply: "💬",
        message: "✉",
        event_reminder: "⏰",
        system: "!",
      } as Record<string, string>
    )[t] ?? "•"
  );
}
