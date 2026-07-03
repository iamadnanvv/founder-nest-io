import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { ExternalLink, MessageCircle, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "Members · founder/hunt" }] }),
  component: MembersPage,
});

function MembersPage() {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [industry, setIndustry] = useState<string>("all");

  const { data: members } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const stages = Array.from(new Set((members ?? []).map((m: any) => m.startup_stage).filter(Boolean)));
  const industries = Array.from(new Set((members ?? []).map((m: any) => m.industry).filter(Boolean)));

  const filtered = (members ?? []).filter((m: any) => {
    const q = search.toLowerCase();
    const hit =
      !q ||
      (m.full_name ?? "").toLowerCase().includes(q) ||
      (m.startup_name ?? "").toLowerCase().includes(q) ||
      (m.bio ?? "").toLowerCase().includes(q) ||
      (m.industry ?? "").toLowerCase().includes(q) ||
      (m.skills ?? []).some((s: string) => s.toLowerCase().includes(q));
    return hit && (stage === "all" || m.startup_stage === stage) && (industry === "all" || m.industry === industry);
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-10">
      <header>
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-foreground">Members</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">Discover · Connect · Build together</p>
      </header>

      <div className="space-y-3 border-2 border-foreground bg-surface p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, startup, skills, bio…"
            className="w-full border-2 border-foreground bg-background py-2 pl-10 pr-3 text-sm focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="border-2 border-foreground bg-background px-2 py-1.5 font-mono text-[10px] uppercase">
            <option value="all">All stages</option>
            {stages.map((s: any) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="border-2 border-foreground bg-background px-2 py-1.5 font-mono text-[10px] uppercase">
            <option value="all">All industries</option>
            {industries.map((i: any) => <option key={i} value={i}>{i}</option>)}
          </select>
          <span className="ml-auto self-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{filtered.length} founders</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m: any) => {
          const initials = (m.full_name ?? "F").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
          return (
            <article key={m.id} className="flex flex-col border-2 border-foreground bg-surface p-5 transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="grid size-12 place-items-center border-2 border-foreground bg-electric font-display text-base font-black text-background">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-display font-bold text-foreground">{m.full_name ?? "Founder"}</h3>
                  {m.startup_name && <p className="truncate text-xs text-muted-foreground">{m.startup_name}</p>}
                </div>
              </div>
              {m.bio && <p className="mb-3 line-clamp-3 flex-1 text-sm text-muted-foreground">{m.bio}</p>}
              <div className="mb-3 flex flex-wrap gap-1">
                {m.industry && <span className="border border-foreground bg-background px-1.5 py-0.5 font-mono text-[9px] uppercase text-electric">{m.industry}</span>}
                {m.startup_stage && <span className="border border-foreground bg-background px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">{m.startup_stage}</span>}
                {(m.skills ?? []).slice(0, 3).map((s: string) => (
                  <span key={s} className="border border-foreground bg-background px-1.5 py-0.5 font-mono text-[9px] uppercase">{s}</span>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t-2 border-foreground pt-3">
                <Link to="/messages/$userId" params={{ userId: m.id }} className="flex flex-1 items-center justify-center gap-1 border-2 border-foreground bg-acid px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-background shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none">
                  <MessageCircle className="size-3" /> Message
                </Link>
                {m.linkedin_url && (
                  <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" className="border-2 border-foreground bg-background p-1.5 hover:bg-electric hover:text-background">
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
