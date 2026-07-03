import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, Plus, MessageCircle, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/marketplace")({
  head: () => ({ meta: [{ title: "Collab Board · founder/hunt" }] }),
  component: MarketplacePage,
});

const KINDS = [
  { value: "cofounder", label: "Co-founder", color: "bg-hot" },
  { value: "hire", label: "Hire", color: "bg-electric" },
  { value: "offer", label: "Offer", color: "bg-acid" },
] as const;
type Kind = (typeof KINDS)[number]["value"];

function MarketplacePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "cofounder" as Kind, title: "", description: "", category: "", tags: "" });

  const { data: posts } = useQuery({
    queryKey: ["collab", filter],
    queryFn: async () => {
      let q = supabase
        .from("collab_posts")
        .select("*, profiles:profiles!collab_posts_author_id_fkey(full_name)")
        .eq("is_open", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("kind", filter);
      return (await q).data ?? [];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 5 || form.description.trim().length < 20) { toast.error("Title 5+, description 20+ chars"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("collab_posts").insert({
      author_id: u.user.id, kind: form.kind, title: form.title.trim(), description: form.description.trim(),
      category: form.category.trim() || null, tags: tags.length ? tags : null,
    });
    if (error) { toast.error(error.message); return; }
    setForm({ kind: "cofounder", title: "", description: "", category: "", tags: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["collab"] });
    toast.success("Posted to the board");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black uppercase tracking-tight text-foreground">Collab Board</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">Find co-founders. Hire talent. Offer services.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 border-2 border-foreground bg-hot px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-background shadow-brutal-sm">
          <Plus className="size-4" /> Post
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")} className={`border-2 border-foreground px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest ${filter === "all" ? "bg-acid text-background shadow-brutal-sm" : "bg-background"}`}>All</button>
        {KINDS.map((k) => (
          <button key={k.value} onClick={() => setFilter(k.value)} className={`border-2 border-foreground px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest ${filter === k.value ? `${k.color} text-background shadow-brutal-sm` : "bg-background"}`}>
            {k.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(posts ?? []).length === 0 && (
          <div className="md:col-span-2 border-2 border-dashed border-foreground p-8 text-center">
            <Briefcase className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">No posts yet. Be first.</p>
          </div>
        )}
        {(posts ?? []).map((p: any) => {
          const kindMeta = KINDS.find((k) => k.value === p.kind)!;
          return (
            <div key={p.id} className="flex flex-col border-2 border-foreground bg-surface p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className={`border-2 border-foreground ${kindMeta.color} px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-background`}>{kindMeta.label}</span>
                {p.category && <span className="font-mono text-[10px] uppercase tracking-widest text-electric">{p.category}</span>}
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">{p.title}</h3>
              <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted-foreground">{p.description}</p>
              {p.tags && p.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.tags.map((t: string) => <span key={t} className="border border-foreground px-1.5 py-0.5 font-mono text-[9px] uppercase">{t}</span>)}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between border-t-2 border-foreground pt-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {p.profiles?.full_name ?? "Founder"} · {new Date(p.created_at).toLocaleDateString()}
                </div>
                <Link to="/messages/$userId" params={{ userId: p.author_id }} className="flex items-center gap-1 border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-electric hover:text-background">
                  <MessageCircle className="size-3" /> DM
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <form onSubmit={submit} className="w-full max-w-lg space-y-3 border-2 border-foreground bg-surface p-6 shadow-brutal">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-black uppercase">New post</h2>
              <button type="button" onClick={() => setOpen(false)}><X className="size-5" /></button>
            </div>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })} className="w-full border-2 border-foreground bg-background px-3 py-2 font-mono text-xs uppercase">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" maxLength={200} className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what you're looking for or offering…" rows={5} maxLength={3000} className="w-full resize-y border-2 border-foreground bg-background px-3 py-2 text-sm" />
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category (e.g. Engineering, Design)" className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm" />
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tags, comma, separated" className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm" />
            <button type="submit" className="w-full border-2 border-foreground bg-acid px-5 py-2 font-mono text-xs font-bold uppercase tracking-widest text-background shadow-brutal-sm">Publish</button>
          </form>
        </div>
      )}
    </div>
  );
}
