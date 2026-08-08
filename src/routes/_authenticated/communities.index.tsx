import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users2, Plus } from "lucide-react";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/communities/")({
  head: () => ({ meta: [{ title: "Communities · Founder Community" }] }),
  component: CommunitiesPage,
});

function CommunitiesPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", topic: "", description: "" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: communities, isPending, error, refetch } = useQuery({
    queryKey: ["communities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("communities").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: memberships } = useQuery({
    queryKey: ["my-communities", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("community_members").select("community_id").eq("user_id", userId!);
      return new Set((data ?? []).map((r) => r.community_id));
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["community-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("community_members").select("community_id");
      const map: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        map[r.community_id] = (map[r.community_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const toggleJoin = async (communityId: string) => {
    if (!userId) return;
    if (memberships?.has(communityId)) {
      await supabase.from("community_members").delete().eq("community_id", communityId).eq("user_id", userId);
      toast.success("Left community");
    } else {
      const { error } = await supabase.from("community_members").insert({ community_id: communityId, user_id: userId, role: "member" });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Joined community");
    }
    qc.invalidateQueries({ queryKey: ["my-communities", userId] });
    qc.invalidateQueries({ queryKey: ["community-counts"] });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (form.name.trim().length < 3) {
      toast.error("Name needs at least 3 characters");
      return;
    }
    const slug = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const { error } = await supabase.from("communities").insert({
      slug,
      name: form.name.trim(),
      topic: form.topic.trim() || null,
      description: form.description.trim() || null,
      created_by: userId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("community_members").insert({ community_id: (await supabase.from("communities").select("id").eq("slug", slug).maybeSingle()).data!.id, user_id: userId, role: "member" });
    setForm({ name: "", topic: "", description: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["communities"] });
    qc.invalidateQueries({ queryKey: ["my-communities", userId] });
    toast.success("Community created");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Communities</h1>
          <p className="mt-1 text-sm text-muted-foreground">Topic-based spaces for focused conversations.</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> {open ? "Cancel" : "New"}
        </button>
      </header>

      {open && (
        <form onSubmit={create} className="grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
          <input
            required
            placeholder="Community name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none"
          />
          <input
            placeholder="Topic (e.g. AI, Growth)"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none"
          />
          <textarea
            placeholder="What is this community about?"
            rows={3}
            maxLength={400}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none sm:col-span-2"
          />
          <button type="submit" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground sm:col-span-2">
            Create community
          </button>
        </form>
      )}

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isPending ? (
        <LoadingState label="Loading communities…" />
      ) : (communities ?? []).length === 0 ? (
        <EmptyState icon={<Users2 className="size-5" />} title="No communities yet" description="Create the first one." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {communities!.map((c) => {
            const joined = memberships?.has(c.id);
            return (
              <article key={c.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5">
                <div className="mb-2 flex items-center gap-2">
                  {c.topic && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] text-gold">{c.topic}</span>}
                  <span className="text-[11px] text-muted-foreground">{counts?.[c.id] ?? 0} members</span>
                </div>
                <Link to="/communities/$slug" params={{ slug: c.slug }} className="font-display text-lg font-semibold text-foreground hover:text-primary">
                  {c.name}
                </Link>
                {c.description && <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted-foreground">{c.description}</p>}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => toggleJoin(c.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${
                      joined ? "border border-border text-muted-foreground hover:text-foreground" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {joined ? "Leave" : "Join"}
                  </button>
                  <Link
                    to="/communities/$slug"
                    params={{ slug: c.slug }}
                    className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-background"
                  >
                    Open
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
