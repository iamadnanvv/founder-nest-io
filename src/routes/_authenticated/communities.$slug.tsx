import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/communities/$slug")({
  head: () => ({ meta: [{ title: "Community · Founder Community" }] }),
  component: CommunityPage,
});

function CommunityPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: community, isPending, error, refetch } = useQuery({
    queryKey: ["community", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("communities").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: joined } = useQuery({
    queryKey: ["community-joined", community?.id, userId],
    enabled: !!community?.id && !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("community_id", community!.id)
        .eq("user_id", userId!)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["community-members", community?.id],
    enabled: !!community?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("community_members")
        .select("*", { count: "exact", head: true })
        .eq("community_id", community!.id);
      return count ?? 0;
    },
  });

  const { data: posts } = useQuery({
    queryKey: ["community-posts", community?.id],
    enabled: !!community?.id,
    queryFn: async () =>
      (
        await supabase
          .from("posts")
          .select("id, content, category, created_at, profiles:profiles!posts_user_id_fkey(full_name)")
          .eq("community_id", community!.id)
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  const toggleJoin = async () => {
    if (!userId || !community) return;
    if (joined) await supabase.from("community_members").delete().eq("community_id", community.id).eq("user_id", userId);
    else {
      const { error } = await supabase.from("community_members").insert({ community_id: community.id, user_id: userId, role: "member" });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    qc.invalidateQueries({ queryKey: ["community-joined", community.id, userId] });
    qc.invalidateQueries({ queryKey: ["community-members", community.id] });
    toast.success(joined ? "Left community" : "Joined community");
  };

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !community) return;
    if (!joined) {
      toast.error("Join the community to post");
      return;
    }
    if (content.trim().length < 5) {
      toast.error("Say a bit more");
      return;
    }
    const { error } = await supabase
      .from("posts")
      .insert({ user_id: userId, content: content.trim(), category: "general", community_id: community.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setContent("");
    qc.invalidateQueries({ queryKey: ["community-posts", community.id] });
    toast.success("Posted");
  };

  if (error) return <div className="p-6"><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></div>;
  if (isPending) return <div className="mx-auto max-w-3xl p-6"><LoadingState label="Loading community…" /></div>;
  if (!community)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState
          title="Community not found"
          description="It may have been removed."
          action={<Link to="/communities" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Back to communities</Link>}
        />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-10">
      <Link to="/communities" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All communities
      </Link>

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl border border-border bg-surface p-5">
        <div className="min-w-0">
          {community.topic && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] text-gold">{community.topic}</span>}
          <h1 className="mt-2 font-display text-2xl font-semibold text-foreground">{community.name}</h1>
          {community.description && <p className="mt-1 text-sm text-muted-foreground">{community.description}</p>}
          <p className="mt-2 text-xs text-muted-foreground">{members ?? 0} members</p>
        </div>
        <button
          onClick={toggleJoin}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
            joined ? "border border-border text-muted-foreground hover:text-foreground" : "bg-primary text-primary-foreground"
          }`}
        >
          {joined ? "Leave" : "Join"}
        </button>
      </header>

      <form onSubmit={post} className="rounded-2xl border border-border bg-surface p-5">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={joined ? `Share something with ${community.name}…` : "Join this community to post"}
          disabled={!joined}
          className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
        />
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={!joined} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Post
          </button>
        </div>
      </form>

      {(posts ?? []).length === 0 ? (
        <EmptyState title="No posts in this community yet" description="Start the conversation." />
      ) : (
        <div className="space-y-3">
          {posts!.map((p: any) => (
            <article key={p.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="mb-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{p.profiles?.full_name ?? "Founder"}</span>
                {" · "}
                {new Date(p.created_at).toLocaleDateString()}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{p.content}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
