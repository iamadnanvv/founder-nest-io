import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { MessagesSquare, Pin, Lock, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/discussions")({
  head: () => ({ meta: [{ title: "Discussions · founder/hunt" }] }),
  component: DiscussionsPage,
});

const CATEGORIES = ["general", "validation", "fundraising", "growth", "product", "hiring"] as const;
type Cat = (typeof CATEGORIES)[number];

function DiscussionsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Cat | "all">("all");
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cat, setCat] = useState<Cat>("general");

  const { data: threads } = useQuery({
    queryKey: ["discussions", filter],
    queryFn: async () => {
      let q = supabase
        .from("discussions")
        .select(
          "id, title, body, category, pinned, locked, reply_count, created_at, author_id, profiles:profiles!discussions_author_id_fkey(full_name)",
        )
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("category", filter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5 || body.trim().length < 10) {
      toast.error("Title 5+ chars, body 10+ chars");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("discussions")
      .insert({ author_id: u.user.id, title: title.trim(), body: body.trim(), category: cat });
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setBody("");
    setComposing(false);
    qc.invalidateQueries({ queryKey: ["discussions"] });
    toast.success("Thread posted");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black uppercase tracking-tight text-foreground">
            Discussions
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Long-form threads. Q&A. Deep dives.
          </p>
        </div>
        <button
          onClick={() => setComposing((v) => !v)}
          className="flex items-center gap-2 border-2 border-foreground bg-hot px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-background shadow-brutal-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          <Plus className="size-4" /> New thread
        </button>
      </header>

      {composing && (
        <form
          onSubmit={submit}
          className="space-y-3 border-2 border-foreground bg-surface p-5 shadow-brutal"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Thread title"
            maxLength={200}
            className="w-full border-2 border-foreground bg-background px-3 py-2 font-display text-lg font-bold text-foreground focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's on your mind?"
            rows={5}
            maxLength={5000}
            className="w-full resize-y border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value as Cat)}
              className="border-2 border-foreground bg-background px-3 py-2 font-mono text-xs uppercase tracking-widest text-foreground"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="border-2 border-foreground bg-acid px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-background shadow-brutal-sm"
            >
              Publish
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="space-y-3">
        {(threads ?? []).length === 0 && (
          <div className="border-2 border-dashed border-foreground p-8 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No threads yet. Start one.
          </div>
        )}
        {(threads ?? []).map((t: any) => (
          <Link
            key={t.id}
            to="/discussions/$id"
            params={{ id: t.id }}
            className="block border-2 border-foreground bg-surface p-5 transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {t.pinned && <Pin className="size-3.5 text-hot" />}
                  {t.locked && <Lock className="size-3.5 text-muted-foreground" />}
                  <span className="font-mono text-[10px] uppercase tracking-widest text-electric">
                    {t.category}
                  </span>
                </div>
                <h3 className="mt-1 font-display text-xl font-bold text-foreground">{t.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.body}</p>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t.profiles?.full_name ?? "Founder"} ·{" "}
                  {new Date(t.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex flex-col items-center border-2 border-foreground bg-background px-3 py-2">
                <MessagesSquare className="size-4 text-electric" />
                <span className="font-mono text-sm font-bold text-foreground">
                  {t.reply_count ?? 0}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-2 border-foreground px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest transition ${
        active
          ? "bg-acid text-background shadow-brutal-sm"
          : "bg-background text-foreground hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
