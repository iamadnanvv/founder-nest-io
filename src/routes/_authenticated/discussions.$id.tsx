import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Lock, Pin, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/discussions/$id")({
  head: () => ({ meta: [{ title: "Thread · founder/hunt" }] }),
  component: ThreadPage,
});

function ThreadPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");

  const { data: userId } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId!).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  const { data: thread } = useQuery({
    queryKey: ["discussion", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("discussions")
        .select("*, profiles:profiles!discussions_author_id_fkey(full_name, profile_image)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const { data: replies } = useQuery({
    queryKey: ["replies", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("discussion_replies")
        .select("id, body, created_at, author_id, profiles:profiles!discussion_replies_author_id_fkey(full_name)")
        .eq("discussion_id", id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const submitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reply.trim().length < 2) return;
    if (!userId) return;
    const { error } = await supabase.from("discussion_replies").insert({ discussion_id: id, author_id: userId, body: reply.trim() });
    if (error) { toast.error(error.message); return; }
    setReply("");
    qc.invalidateQueries({ queryKey: ["replies", id] });
    qc.invalidateQueries({ queryKey: ["discussion", id] });
  };

  const togglePin = async () => {
    if (!thread) return;
    await supabase.from("discussions").update({ pinned: !thread.pinned }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["discussion", id] });
  };
  const toggleLock = async () => {
    if (!thread) return;
    await supabase.from("discussions").update({ locked: !thread.locked }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["discussion", id] });
  };
  const del = async () => {
    if (!confirm("Delete this thread?")) return;
    await supabase.from("discussions").delete().eq("id", id);
    window.location.href = "/discussions";
  };

  if (!thread) {
    return <div className="p-10 text-center font-mono text-xs uppercase text-muted-foreground">Loading…</div>;
  }

  const canModerate = isAdmin || userId === thread.author_id;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-10">
      <Link to="/discussions" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Back
      </Link>

      <article className="space-y-4 border-2 border-foreground bg-surface p-6 shadow-brutal">
        <div className="flex items-center gap-2">
          {thread.pinned && <Pin className="size-4 text-hot" />}
          {thread.locked && <Lock className="size-4 text-muted-foreground" />}
          <span className="font-mono text-[10px] uppercase tracking-widest text-electric">{thread.category}</span>
        </div>
        <h1 className="font-display text-3xl font-black text-foreground">{thread.title}</h1>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {(thread as any).profiles?.full_name ?? "Founder"} · {new Date(thread.created_at).toLocaleDateString()}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{thread.body}</p>

        {canModerate && (
          <div className="flex flex-wrap gap-2 border-t-2 border-foreground pt-4">
            {isAdmin && (
              <>
                <button onClick={togglePin} className="border-2 border-foreground bg-background px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-hot hover:text-background">
                  {thread.pinned ? "Unpin" : "Pin"}
                </button>
                <button onClick={toggleLock} className="border-2 border-foreground bg-background px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-electric hover:text-background">
                  {thread.locked ? "Unlock" : "Lock"}
                </button>
              </>
            )}
            <button onClick={del} className="border-2 border-foreground bg-background px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-hot hover:text-background">
              <Trash2 className="mr-1 inline size-3" /> Delete
            </button>
          </div>
        )}
      </article>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{replies?.length ?? 0} replies</h2>
        {(replies ?? []).map((r: any) => (
          <div key={r.id} className="border-2 border-foreground bg-background p-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {r.profiles?.full_name ?? "Founder"} · {new Date(r.created_at).toLocaleString()}
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{r.body}</p>
          </div>
        ))}
      </section>

      {!thread.locked ? (
        <form onSubmit={submitReply} className="space-y-3 border-2 border-foreground bg-surface p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={3000}
            placeholder="Add your reply…"
            className="w-full resize-y border-2 border-foreground bg-background px-3 py-2 text-sm focus:outline-none"
          />
          <button type="submit" className="border-2 border-foreground bg-acid px-5 py-2 font-mono text-xs font-bold uppercase tracking-widest text-background shadow-brutal-sm">
            Reply
          </button>
        </form>
      ) : (
        <div className="border-2 border-dashed border-foreground p-4 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Thread locked
        </div>
      )}
    </div>
  );
}
