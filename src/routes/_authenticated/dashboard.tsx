import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MessageSquare, Rocket, TrendingUp, Megaphone, Users } from "lucide-react";

const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029VbClPX9KgsNsQnp5yB2E";
const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/KByJpDAN8JO0p5MhCgccdR";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · FounderHuntCommunity" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const { data: posts } = useQuery({
    queryKey: ["recent-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, content, category, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(3);
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-10">
      <header>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Welcome back</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-foreground">
          {profile?.full_name || "Founder"}
        </h1>
        <p className="mt-2 text-muted-foreground">Here's what's happening in your community today.</p>
      </header>

      <section className="grid gap-4 border-2 border-foreground bg-acid p-5 shadow-brutal-sm sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-background/80">Join the conversation</p>
          <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-background">
            FounderHunt on WhatsApp
          </h2>
          <p className="mt-1 text-sm text-background/90">
            Get shipping updates in the channel and hang out with founders in the community group.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-foreground shadow-brutal-sm transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px]"
          >
            <Megaphone className="size-4" /> Channel
          </a>
          <a
            href={WHATSAPP_COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border-2 border-foreground bg-foreground px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-background shadow-brutal-sm transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px]"
          >
            <Users className="size-4" /> Community
          </a>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={MessageSquare} label="Discussions" value={String(posts?.length ?? 0)} />
        <StatCard icon={Calendar} label="Upcoming Events" value={String(events?.length ?? 0)} />
        <StatCard icon={Rocket} label="Your Startup" value={profile?.startup_name ? "Live" : "—"} />
        <StatCard icon={TrendingUp} label="Membership" value={profile?.is_paid ? "Active" : "Pending"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 border-2 border-foreground bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-black uppercase tracking-tight text-foreground">Recent Discussions</h2>
            <Link to="/feed" className="border-2 border-foreground bg-background px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-foreground hover:bg-acid hover:text-background">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {(posts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No posts yet. Be the first to share what you're building.</p>
            ) : (
              posts!.map((p) => (
                <div key={p.id} className="border-2 border-foreground bg-background p-4">
                  <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-electric">{p.category.replace(/_/g, " ")}</div>
                  <p className="text-sm text-foreground">{p.content.slice(0, 180)}{p.content.length > 180 ? "…" : ""}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="border-2 border-foreground bg-surface p-6">
          <h2 className="mb-4 font-display text-xl font-black uppercase tracking-tight text-foreground">Upcoming Events</h2>
          <div className="space-y-3">
            {(events ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No events scheduled.</p>
            ) : (
              events!.map((e) => (
                <div key={e.id} className="border-2 border-foreground bg-background p-4">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-electric">
                    {new Date(e.event_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </div>
                  <h3 className="mt-1 font-semibold text-foreground">{e.title}</h3>
                  {e.speaker && <p className="text-xs text-muted-foreground">with {e.speaker}</p>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="border-2 border-foreground bg-surface p-5">
      <div className="mb-3 grid size-10 place-items-center border-2 border-foreground bg-electric text-background">
        <Icon className="size-5" />
      </div>
      <div className="font-display text-2xl font-black text-foreground">{value}</div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
