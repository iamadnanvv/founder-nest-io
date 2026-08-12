import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Rocket,
  Calendar,
  Users,
  Briefcase,
  User as UserIcon,
  LogOut,
  MessagesSquare,
  Send,
  Bell,
  Shield,
  Users2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Premium gate: only members with a verified ₹1,599 payment (or admins)
    // may reach onboarding and the full platform. Everyone else goes to pricing.
    // Read own rows directly — RLS scopes both queries to the signed-in user.
    const [{ data: profile }, { data: adminRole }] = await Promise.all([
      supabase.from("profiles").select("is_paid").eq("id", data.user.id).maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle(),
    ]);
    const premium = !!profile?.is_paid || !!adminRole;
    if (!premium) throw redirect({ to: "/pricing" });

    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/feed", label: "Feed", icon: MessageSquare },
  { to: "/discussions", label: "Discussions", icon: MessagesSquare },
  { to: "/messages", label: "Messages", icon: Send },
  { to: "/resources", label: "Resources", icon: BookOpen },
  { to: "/showcase", label: "Showcase", icon: Rocket },
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/communities", label: "Communities", icon: Users2 },
  { to: "/members", label: "Members", icon: Users },
  { to: "/marketplace", label: "Opportunities", icon: Briefcase },
  { to: "/profile", label: "Profile", icon: UserIcon },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId!).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  const { data: unread } = useQuery({
    queryKey: ["notif-unread", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId!)
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  // Realtime notifications badge
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("notif-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["notif-unread", userId] });
        queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, queryClient]);

  const nav = [...baseNav, ...(isAdmin ? [{ to: "/admin" as const, label: "Admin", icon: Shield }] : [])];

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r-2 border-foreground bg-surface p-5 lg:flex">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2">
          <div className="grid size-9 place-items-center border-2 border-foreground bg-acid">
            <span className="font-mono text-sm font-bold text-background">FH</span>
          </div>
          <span className="font-display text-lg font-bold text-foreground">
            founder<span className="text-acid">/</span>hunt
          </span>
        </Link>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 border-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
                  active
                    ? "border-foreground bg-acid text-background shadow-brutal-sm"
                    : "border-transparent text-muted-foreground hover:border-foreground hover:bg-background hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          to="/notifications"
          className="mt-4 flex items-center justify-between border-2 border-foreground bg-background px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground shadow-brutal-sm hover:bg-electric hover:text-background"
        >
          <span className="flex items-center gap-2"><Bell className="size-4" /> Alerts</span>
          {unread ? <span className="grid size-5 place-items-center bg-hot text-[10px] text-background">{unread}</span> : null}
        </Link>
        <button
          onClick={handleSignOut}
          className="mt-2 flex items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </aside>

      <div className="flex w-full flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b-2 border-foreground bg-background px-4 py-3 lg:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid size-8 place-items-center border-2 border-foreground bg-acid">
              <span className="font-mono text-xs font-bold text-background">FH</span>
            </div>
            <span className="font-display text-base font-bold text-foreground">founder/hunt</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/notifications" className="relative border-2 border-foreground bg-background p-2">
              <Bell className="size-4" />
              {unread ? <span className="absolute -right-1 -top-1 grid size-4 place-items-center bg-hot text-[9px] text-background">{unread}</span> : null}
            </Link>
            <button onClick={handleSignOut} className="text-xs text-muted-foreground">Sign out</button>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b-2 border-foreground bg-surface px-3 py-2 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="shrink-0 border-2 border-transparent px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              activeProps={{ className: "border-foreground bg-acid text-background" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
