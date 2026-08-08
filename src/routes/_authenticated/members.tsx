import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, MessageCircle, Search, UserPlus, UserCheck, Sparkles, MapPin } from "lucide-react";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "Founder Directory · Founder Community" }] }),
  component: MembersPage,
});

type Tab = "all" | "matches" | "following";

function MembersPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [location, setLocation] = useState("all");
  const [founderType, setFounderType] = useState("all");
  const [lookingFor, setLookingFor] = useState("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: members, isPending, error, refetch } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: following } = useQuery({
    queryKey: ["following", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId!);
      return new Set((data ?? []).map((r) => r.following_id));
    },
  });

  const me = useMemo(() => (members ?? []).find((m: any) => m.id === userId), [members, userId]);

  const toggleFollow = async (targetId: string) => {
    if (!userId) return;
    if (following?.has(targetId)) {
      await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
      toast.success("Removed connection");
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: userId, following_id: targetId });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Connected");
    }
    qc.invalidateQueries({ queryKey: ["following", userId] });
  };

  const uniq = (key: string) => Array.from(new Set((members ?? []).map((m: any) => m[key]).filter(Boolean))) as string[];
  const stages = uniq("startup_stage");
  const industries = uniq("industry");
  const locations = uniq("location");
  const founderTypes = uniq("founder_type");
  const lookingFors = uniq("looking_for");

  /** Complementary-skill score: skills they have that I don't + shared industry/interests. */
  const matchScore = (m: any) => {
    if (!me) return 0;
    const mySkills = new Set<string>((me.skills ?? []).map((s: string) => s.toLowerCase()));
    const theirSkills: string[] = (m.skills ?? []).map((s: string) => s.toLowerCase());
    const complementary = theirSkills.filter((s) => !mySkills.has(s)).length;
    const sharedIndustry = me.industry && m.industry === me.industry ? 3 : 0;
    const myInterests = new Set<string>((me.interests ?? []).map((s: string) => s.toLowerCase()));
    const sharedInterests = ((m.interests ?? []) as string[]).filter((s) => myInterests.has(s.toLowerCase())).length * 2;
    const sameStage = me.startup_stage && m.startup_stage === me.startup_stage ? 1 : 0;
    return complementary * 2 + sharedIndustry + sharedInterests + sameStage;
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = (members ?? []).filter((m: any) => {
      if (m.id === userId) return false;
      const hit =
        !q ||
        (m.full_name ?? "").toLowerCase().includes(q) ||
        (m.startup_name ?? "").toLowerCase().includes(q) ||
        (m.bio ?? "").toLowerCase().includes(q) ||
        (m.industry ?? "").toLowerCase().includes(q) ||
        (m.location ?? "").toLowerCase().includes(q) ||
        (m.skills ?? []).some((s: string) => s.toLowerCase().includes(q));
      return (
        hit &&
        (stage === "all" || m.startup_stage === stage) &&
        (industry === "all" || m.industry === industry) &&
        (location === "all" || m.location === location) &&
        (founderType === "all" || m.founder_type === founderType) &&
        (lookingFor === "all" || m.looking_for === lookingFor)
      );
    });
    if (tab === "following") list = list.filter((m: any) => following?.has(m.id));
    if (tab === "matches") list = [...list].sort((a, b) => matchScore(b) - matchScore(a)).filter((m) => matchScore(m) > 0);
    return list;
  }, [members, search, stage, industry, location, founderType, lookingFor, tab, following, userId, me]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-10">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Founder Directory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Discover founders, connect, and find a complementary co-founder.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {([
          ["all", "All founders"],
          ["matches", "Co-founder matches"],
          ["following", "My network"],
        ] as [Tab, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === value ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {value === "matches" && <Sparkles className="size-3.5" />}
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, startup, skills, location…"
            className="w-full rounded-full border border-border bg-background py-2.5 pl-10 pr-3 text-sm focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={stage} onChange={setStage} label="All stages" options={stages} />
          <Select value={industry} onChange={setIndustry} label="All industries" options={industries} />
          <Select value={location} onChange={setLocation} label="All locations" options={locations} />
          <Select value={founderType} onChange={setFounderType} label="All founder types" options={founderTypes} />
          <Select value={lookingFor} onChange={setLookingFor} label="Looking for anything" options={lookingFors} />
          <span className="ml-auto self-center text-xs text-muted-foreground">{filtered.length} founders</span>
        </div>
      </div>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isPending ? (
        <LoadingState label="Loading founders…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === "following" ? "You haven't connected with anyone yet" : "No founders match these filters"}
          description={
            tab === "following"
              ? "Browse all founders and hit Connect to start building your network."
              : "Try clearing a filter or searching for a different skill."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m: any) => {
            const initials = (m.full_name ?? "F").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
            const isFollowing = following?.has(m.id);
            return (
              <article key={m.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5 hover:shadow-brutal-sm">
                <div className="mb-3 flex min-w-0 items-center gap-3">
                  {m.profile_image ? (
                    <img src={m.profile_image} alt={m.full_name ?? "Founder"} className="size-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-12 shrink-0 place-items-center rounded-full bg-gold-soft font-display text-base font-semibold text-gold">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-display font-semibold text-foreground">{m.full_name ?? "Founder"}</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.founder_type, m.startup_name].filter(Boolean).join(" · ") || "Founder"}
                    </p>
                  </div>
                </div>
                {m.location && (
                  <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {m.location}
                  </p>
                )}
                {m.bio && <p className="mb-3 line-clamp-3 flex-1 text-sm text-muted-foreground">{m.bio}</p>}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {m.industry && <Tag className="text-electric">{m.industry}</Tag>}
                  {m.startup_stage && <Tag>{m.startup_stage}</Tag>}
                  {(m.skills ?? []).slice(0, 3).map((s: string) => (
                    <Tag key={s}>{s}</Tag>
                  ))}
                </div>
                {m.looking_for && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    <span className="text-gold">Looking for:</span> {m.looking_for}
                  </p>
                )}
                <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => toggleFollow(m.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${
                      isFollowing
                        ? "border border-border text-muted-foreground hover:text-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {isFollowing ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
                    {isFollowing ? "Connected" : "Connect"}
                  </button>
                  <Link
                    to="/messages/$userId"
                    params={{ userId: m.id }}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-background"
                  >
                    <MessageCircle className="size-3.5" /> Message
                  </Link>
                  {m.linkedin_url && (
                    <a
                      href={m.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn profile"
                      className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground ${className}`}>{children}</span>;
}

function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
}) {
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground focus:outline-none"
    >
      <option value="all">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
