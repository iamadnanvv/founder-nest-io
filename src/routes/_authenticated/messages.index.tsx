import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages · founder/hunt" }] }),
  component: InboxPage,
});

type ConvoRow = {
  other_id: string;
  full_name: string | null;
  last_message: string;
  last_at: string;
  unread: number;
};

function InboxPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: convos, refetch } = useQuery({
    queryKey: ["conversations", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ConvoRow[]> => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, content, created_at, read_at")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(500);

      const byOther = new Map<string, ConvoRow>();
      for (const m of msgs ?? []) {
        const other = m.sender_id === userId ? m.receiver_id : m.sender_id;
        if (byOther.has(other)) {
          const c = byOther.get(other)!;
          if (m.receiver_id === userId && !m.read_at) c.unread += 1;
          continue;
        }
        byOther.set(other, {
          other_id: other,
          full_name: null,
          last_message: m.content,
          last_at: m.created_at,
          unread: m.receiver_id === userId && !m.read_at ? 1 : 0,
        });
      }
      const ids = [...byOther.keys()];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        for (const p of profs ?? []) {
          const c = byOther.get(p.id);
          if (c) c.full_name = p.full_name;
        }
      }
      return [...byOther.values()].sort((a, b) => (a.last_at > b.last_at ? -1 : 1));
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, refetch]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-10">
      <header>
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-foreground">
          Messages
        </h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Founder-to-founder DMs
        </p>
      </header>

      {(convos ?? []).length === 0 && (
        <div className="border-2 border-dashed border-foreground p-8 text-center">
          <Send className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No conversations yet
          </p>
          <Link
            to="/members"
            className="mt-3 inline-block border-2 border-foreground bg-acid px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-background shadow-brutal-sm"
          >
            Find members
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {(convos ?? []).map((c) => (
          <Link
            key={c.other_id}
            to="/messages/$userId"
            params={{ userId: c.other_id }}
            className="flex items-center gap-3 border-2 border-foreground bg-surface p-4 transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-sm"
          >
            <div className="grid size-10 shrink-0 place-items-center border-2 border-foreground bg-electric font-mono text-sm font-bold text-background">
              {(c.full_name ?? "F").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate font-display font-bold text-foreground">
                  {c.full_name ?? "Founder"}
                </div>
                <div className="font-mono text-[10px] uppercase text-muted-foreground">
                  {new Date(c.last_at).toLocaleDateString()}
                </div>
              </div>
              <div className="truncate text-sm text-muted-foreground">{c.last_message}</div>
            </div>
            {c.unread > 0 && (
              <div className="grid size-6 place-items-center bg-hot font-mono text-[10px] font-bold text-background">
                {c.unread}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
