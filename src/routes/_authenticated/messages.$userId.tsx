import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages/$userId")({
  head: () => ({ meta: [{ title: "Chat · founder/hunt" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { userId: otherId } = Route.useParams();
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const { data: other } = useQuery({
    queryKey: ["profile", otherId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, bio").eq("id", otherId).maybeSingle();
      return data;
    },
  });

  const { data: messages, refetch } = useQuery({
    queryKey: ["thread", me, otherId],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${me},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${me})`)
        .order("created_at", { ascending: true })
        .limit(500);
      return data ?? [];
    },
  });

  // Mark unread messages from other as read
  useEffect(() => {
    if (!me || !messages) return;
    const unread = messages.filter((m: any) => m.receiver_id === me && !m.read_at).map((m: any) => m.id);
    if (unread.length) {
      supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => {
        qc.invalidateQueries({ queryKey: ["notif-unread"] });
        qc.invalidateQueries({ queryKey: ["conversations"] });
      });
    }
  }, [me, messages, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`chat-${otherId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        const m = payload.new;
        if ((m.sender_id === me && m.receiver_id === otherId) || (m.sender_id === otherId && m.receiver_id === me)) {
          refetch();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, otherId, refetch]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || text.trim().length === 0) return;
    if (me === otherId) { toast.error("Can't message yourself"); return; }
    const content = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({ sender_id: me, receiver_id: otherId, content });
    if (error) { toast.error(error.message); setText(content); return; }
    refetch();
  };

  // Guard: DMing yourself is never valid — send the member back to the inbox.
  if (me && me === otherId) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          That&apos;s you — pick another founder to message.
        </p>
        <Link
          to="/members"
          className="mt-4 inline-block border-2 border-foreground bg-acid px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-background shadow-brutal-sm"
        >
          Browse members
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col lg:h-screen">
      <header className="flex items-center gap-3 border-b-2 border-foreground bg-surface p-4">
        <Link to="/messages" className="border-2 border-foreground bg-background p-2 hover:bg-acid hover:text-background">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="grid size-10 place-items-center border-2 border-foreground bg-electric font-mono text-sm font-bold text-background">
          {(other?.full_name ?? "F").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display font-bold text-foreground">{other?.full_name ?? "Founder"}</div>
          {other?.bio && <div className="truncate text-xs text-muted-foreground">{other.bio}</div>}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-background p-4">
        {(messages ?? []).length === 0 && (
          <p className="mt-10 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">Say hi 👋</p>
        )}
        {(messages ?? []).map((m: any) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] border-2 border-foreground px-3 py-2 text-sm ${mine ? "bg-acid text-background" : "bg-surface text-foreground"}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                <div className={`mt-1 font-mono text-[9px] uppercase ${mine ? "text-background/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {mine && m.read_at && " · read"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t-2 border-foreground bg-surface p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={2000}
          className="flex-1 border-2 border-foreground bg-background px-3 py-2 text-sm focus:outline-none"
        />
        <button type="submit" className="flex items-center gap-1 border-2 border-foreground bg-hot px-4 font-mono text-xs font-bold uppercase tracking-widest text-background shadow-brutal-sm">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
