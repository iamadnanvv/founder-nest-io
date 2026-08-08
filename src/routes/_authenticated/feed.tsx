import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Heart, MessageCircle, Bookmark, Send, Users } from "lucide-react";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Community Feed · Founder Community" }] }),
  component: FeedPage,
});

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "product_launch", label: "Product Launch" },
  { value: "validation", label: "Validation" },
  { value: "saas_growth", label: "SaaS Growth" },
  { value: "ai_tools", label: "AI Tools" },
  { value: "fundraising", label: "Fundraising" },
  { value: "hiring", label: "Hiring" },
  { value: "partnerships", label: "Partnerships" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];
type Scope = "all" | "following" | "saved";

const POST_SELECT =
  "id, content, category, created_at, user_id, community_id, profiles:profiles!posts_user_id_fkey(full_name, profile_image), communities(name, slug)";

function FeedPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [communityId, setCommunityId] = useState<string>("");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [scope, setScope] = useState<Scope>("all");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: communities } = useQuery({
    queryKey: ["communities-lite"],
    queryFn: async () => (await supabase.from("communities").select("id, name, slug").order("name")).data ?? [],
  });

  const {
    data: posts,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["feed", filter, scope, userId],
    enabled: scope === "all" || !!userId,
    queryFn: async () => {
      let ids: string[] | null = null;

      if (scope === "following") {
        const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", userId!);
        const authors = (f ?? []).map((r) => r.following_id);
        if (authors.length === 0) return [];
        let q = supabase.from("posts").select(POST_SELECT).in("user_id", authors).order("created_at", { ascending: false }).limit(50);
        if (filter !== "all") q = q.eq("category", filter);
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      }

      if (scope === "saved") {
        const { data: b } = await supabase.from("post_bookmarks").select("post_id").eq("user_id", userId!);
        ids = (b ?? []).map((r) => r.post_id);
        if (ids.length === 0) return [];
      }

      let q = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(50);
      if (ids) q = q.in("id", ids);
      if (filter !== "all") q = q.eq("category", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length < 5) {
      toast.error("Say a bit more — at least 5 characters.");
      return;
    }
    if (!userId) return;
    setPosting(true);
    const { error } = await supabase.from("posts").insert({
      user_id: userId,
      content: content.trim(),
      category,
      community_id: communityId || null,
    });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setContent("");
    qc.invalidateQueries({ queryKey: ["feed"] });
    toast.success("Posted to the community");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-10">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Community Feed</h1>
        <p className="mt-1 text-sm text-muted-foreground">Share an update, ask for feedback, celebrate a win.</p>
      </header>

      <form onSubmit={handlePost} className="rounded-2xl border border-border bg-surface p-5 shadow-brutal-sm">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What are you building today?"
          rows={3}
          maxLength={2000}
          className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground focus:outline-none"
            >
              <option value="">No community</option>
              {(communities ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={posting}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "following", "saved"] as Scope[]).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
              scope === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "Everyone" : s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All topics</FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c.value} active={filter === c.value} onClick={() => setFilter(c.value)}>
            {c.label}
          </FilterChip>
        ))}
      </div>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isPending ? (
        <LoadingState label="Loading posts…" />
      ) : (posts ?? []).length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title={
            scope === "following"
              ? "Your network is quiet"
              : scope === "saved"
                ? "No saved posts yet"
                : "No posts yet"
          }
          description={
            scope === "following"
              ? "Follow founders in the directory and their updates will show up here."
              : scope === "saved"
                ? "Tap the bookmark icon on any post to save it for later."
                : "Be the first to share what you're building."
          }
          action={
            scope === "following" ? (
              <Link to="/members" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                Discover founders
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {posts!.map((p: any) => (
            <PostCard key={p.id} post={p} userId={userId} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-gold-soft text-gold" : "border border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PostCard({ post, userId }: { post: any; userId: string | null }) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");

  const { data: likes } = useQuery({
    queryKey: ["post-likes", post.id, userId],
    queryFn: async () => {
      const { count } = await supabase.from("post_likes").select("*", { count: "exact", head: true }).eq("post_id", post.id);
      let mine = false;
      if (userId) {
        const { data } = await supabase.from("post_likes").select("post_id").eq("post_id", post.id).eq("user_id", userId).maybeSingle();
        mine = !!data;
      }
      return { count: count ?? 0, mine };
    },
  });

  const { data: saved } = useQuery({
    queryKey: ["post-saved", post.id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("post_bookmarks").select("post_id").eq("post_id", post.id).eq("user_id", userId!).maybeSingle();
      return !!data;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["post-comments", post.id],
    enabled: showComments,
    queryFn: async () =>
      (
        await supabase
          .from("post_comments")
          .select("id, body, created_at, author_id, profiles:profiles!post_comments_author_id_fkey(full_name)")
          .eq("post_id", post.id)
          .order("created_at")
      ).data ?? [],
  });

  const { data: commentCount } = useQuery({
    queryKey: ["post-comment-count", post.id],
    queryFn: async () => {
      const { count } = await supabase.from("post_comments").select("*", { count: "exact", head: true }).eq("post_id", post.id);
      return count ?? 0;
    },
  });

  const toggleLike = async () => {
    if (!userId) return;
    if (likes?.mine) await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", userId);
    else await supabase.from("post_likes").insert({ post_id: post.id, user_id: userId });
    qc.invalidateQueries({ queryKey: ["post-likes", post.id, userId] });
  };

  const toggleSave = async () => {
    if (!userId) return;
    if (saved) await supabase.from("post_bookmarks").delete().eq("post_id", post.id).eq("user_id", userId);
    else await supabase.from("post_bookmarks").insert({ post_id: post.id, user_id: userId });
    qc.invalidateQueries({ queryKey: ["post-saved", post.id, userId] });
    qc.invalidateQueries({ queryKey: ["feed"] });
    toast.success(saved ? "Removed from saved" : "Saved for later");
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || comment.trim().length < 2) return;
    const { error } = await supabase.from("post_comments").insert({ post_id: post.id, author_id: userId, body: comment.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setComment("");
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
    qc.invalidateQueries({ queryKey: ["post-comment-count", post.id] });
  };

  const author = post.profiles?.full_name ?? "Founder";
  const initials = author.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <header className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-soft font-display text-sm font-semibold text-gold">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{author}</div>
            <div className="truncate text-xs text-muted-foreground">
              <span className="text-gold">{post.category.replace(/_/g, " ")}</span>
              {" · "}
              {new Date(post.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        {post.communities?.slug && (
          <Link
            to="/communities/$slug"
            params={{ slug: post.communities.slug }}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {post.communities.name}
          </Link>
        )}
      </header>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post.content}</p>

      <footer className="mt-4 flex items-center gap-5 text-xs text-muted-foreground">
        <button onClick={toggleLike} className={`flex items-center gap-1.5 ${likes?.mine ? "text-gold" : "hover:text-foreground"}`}>
          <Heart className={`size-4 ${likes?.mine ? "fill-current" : ""}`} /> {likes?.count ?? 0}
        </button>
        <button onClick={() => setShowComments((v) => !v)} className="flex items-center gap-1.5 hover:text-foreground">
          <MessageCircle className="size-4" /> {commentCount ?? 0}
        </button>
        <button onClick={toggleSave} className={`ml-auto flex items-center gap-1.5 ${saved ? "text-primary" : "hover:text-foreground"}`}>
          <Bookmark className={`size-4 ${saved ? "fill-current" : ""}`} /> {saved ? "Saved" : "Save"}
        </button>
      </footer>

      {showComments && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {(comments ?? []).length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
          {(comments ?? []).map((c: any) => (
            <div key={c.id} className="text-sm">
              <span className="font-semibold text-foreground">{c.profiles?.full_name ?? "Founder"}</span>
              <span className="ml-2 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
              <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{c.body}</p>
            </div>
          ))}
          <form onSubmit={addComment} className="flex items-center gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={800}
              placeholder="Add a comment…"
              className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none"
            />
            <button type="submit" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
