import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, Trash2, Pin, Lock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { setMemberPaidStatus } from "@/lib/admin-access.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · founder/hunt" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

type Tab = "users" | "posts" | "discussions" | "startups" | "payments" | "events" | "resources";

function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-10">
      <header className="flex items-center gap-3">
        <div className="grid size-12 place-items-center border-2 border-foreground bg-hot text-background shadow-brutal-sm">
          <Shield className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-4xl font-black uppercase tracking-tight text-foreground">
            Admin
          </h1>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Platform oversight
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 border-b-2 border-foreground pb-3">
        {(
          ["users", "posts", "discussions", "startups", "payments", "events", "resources"] as Tab[]
        ).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-2 border-foreground px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest ${
              tab === t
                ? "bg-acid text-background shadow-brutal-sm"
                : "bg-background hover:bg-surface"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "users" && <UsersTab />}
      {tab === "posts" && <PostsTab />}
      {tab === "discussions" && <DiscussionsTab />}
      {tab === "startups" && <StartupsTab />}
      {tab === "payments" && <PaymentsTab />}
      {tab === "events" && <EventsTab />}
      {tab === "resources" && <ResourcesTab />}
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const setPaid = useServerFn(setMemberPaidStatus);
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, is_paid, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      return (profs ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  const grantAdmin = async (uid: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Admin granted");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const revokeAdmin = async (uid: string) => {
    await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  /** Manually activate/deactivate lifetime access (e.g. hosted payment-link payers). */
  const togglePaid = async (uid: string, isPaid: boolean) => {
    try {
      await setPaid({ data: { userId: uid, isPaid } });
      toast.success(isPaid ? "Access activated" : "Access revoked");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update access");
    }
  };

  return (
    <div className="border-2 border-foreground bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b-2 border-foreground bg-background font-mono text-[10px] uppercase tracking-widest">
          <tr>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Paid</th>
            <th className="p-3 text-left">Roles</th>
            <th className="p-3 text-left">Joined</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((u) => (
            <tr key={u.id} className="border-b border-foreground/20">
              <td className="p-3 font-medium text-foreground">{u.full_name ?? "—"}</td>
              <td className="p-3">
                {u.is_paid ? (
                  <span className="border border-acid px-2 py-0.5 text-[10px] text-acid">PAID</span>
                ) : (
                  <span className="text-muted-foreground text-xs">free</span>
                )}
              </td>
              <td className="p-3 font-mono text-[10px] uppercase">{u.roles.join(", ") || "—"}</td>
              <td className="p-3 text-xs text-muted-foreground">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              <td className="p-3 text-right">
                {u.roles.includes("admin") ? (
                  <button
                    onClick={() => revokeAdmin(u.id)}
                    className="border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] uppercase hover:bg-hot hover:text-background"
                  >
                    Revoke
                  </button>
                ) : (
                  <button
                    onClick={() => grantAdmin(u.id)}
                    className="border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] uppercase hover:bg-acid hover:text-background"
                  >
                    Grant admin
                  </button>
                )}
                <button
                  onClick={() => togglePaid(u.id, !u.is_paid)}
                  className="ml-2 border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] uppercase hover:bg-electric hover:text-background"
                >
                  {u.is_paid ? "Revoke access" : "Mark paid"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PostsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select(
          "id, content, category, created_at, profiles:profiles!posts_user_id_fkey(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const del = async (id: string) => {
    if (!confirm("Delete post?")) return;
    await supabase.from("posts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
  };
  return (
    <div className="space-y-2">
      {(data ?? []).map((p: any) => (
        <div
          key={p.id}
          className="flex items-start gap-3 border-2 border-foreground bg-surface p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-electric">
              {p.category} · {p.profiles?.full_name ?? "?"}
            </div>
            <p className="line-clamp-2 text-sm text-foreground">{p.content}</p>
          </div>
          <button
            onClick={() => del(p.id)}
            className="border-2 border-foreground bg-background p-2 hover:bg-hot hover:text-background"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function DiscussionsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-discussions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("discussions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const upd = async (id: string, patch: any) => {
    await supabase.from("discussions").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-discussions"] });
  };
  const del = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("discussions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-discussions"] });
  };
  return (
    <div className="space-y-2">
      {(data ?? []).map((d: any) => (
        <div
          key={d.id}
          className="flex items-center gap-2 border-2 border-foreground bg-surface p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold">{d.title}</div>
            <div className="font-mono text-[10px] uppercase text-muted-foreground">
              {d.category} · {d.reply_count} replies
            </div>
          </div>
          <button
            onClick={() => upd(d.id, { pinned: !d.pinned })}
            className={`border-2 border-foreground p-2 ${d.pinned ? "bg-hot text-background" : "bg-background"}`}
          >
            <Pin className="size-3" />
          </button>
          <button
            onClick={() => upd(d.id, { locked: !d.locked })}
            className={`border-2 border-foreground p-2 ${d.locked ? "bg-electric text-background" : "bg-background"}`}
          >
            <Lock className="size-3" />
          </button>
          <button
            onClick={() => del(d.id)}
            className="border-2 border-foreground bg-background p-2 hover:bg-hot hover:text-background"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function StartupsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-startups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("startups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const del = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("startups").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-startups"] });
  };
  return (
    <div className="space-y-2">
      {(data ?? []).map((s: any) => (
        <div
          key={s.id}
          className="flex items-center gap-2 border-2 border-foreground bg-surface p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold">{s.startup_name}</div>
            <div className="text-xs text-muted-foreground">
              {s.industry ?? "—"} · {s.website ?? ""}
            </div>
          </div>
          <button
            onClick={() => del(s.id)}
            className="border-2 border-foreground bg-background p-2 hover:bg-hot hover:text-background"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function PaymentsTab() {
  const { data } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const total = (data ?? [])
    .filter((p: any) => p.status === "success")
    .reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  return (
    <div>
      <div className="mb-4 border-2 border-foreground bg-acid p-4 font-display text-xl font-black text-background shadow-brutal-sm">
        Total collected: ₹{(total / 100).toLocaleString()}
      </div>
      <div className="border-2 border-foreground bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-foreground bg-background font-mono text-[10px] uppercase tracking-widest">
            <tr>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Order</th>
              <th className="p-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((p: any) => (
              <tr key={p.id} className="border-b border-foreground/20">
                <td className="p-3 font-mono text-[10px]">{p.user_id.slice(0, 8)}</td>
                <td className="p-3">₹{(p.amount / 100).toFixed(2)}</td>
                <td className="p-3">
                  <span
                    className={`border px-2 py-0.5 text-[10px] uppercase ${p.status === "success" ? "border-acid text-acid" : p.status === "pending" ? "border-gold text-gold" : "border-hot text-hot"}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="p-3 font-mono text-[10px]">
                  {p.razorpay_order_id?.slice(-10) ?? "—"}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", event_date: "", speaker: "" });
  const { data } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () =>
      (await supabase.from("events").select("*").order("event_date", { ascending: false })).data ??
      [],
  });
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.event_date) {
      toast.error("Title + date required");
      return;
    }
    const { error } = await supabase.from("events").insert(form);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm({ title: "", description: "", event_date: "", speaker: "" });
    qc.invalidateQueries({ queryKey: ["admin-events"] });
    toast.success("Event created");
  };
  const del = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("events").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-events"] });
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={create}
        className="grid gap-2 border-2 border-foreground bg-surface p-4 md:grid-cols-2"
      >
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Title"
          className="border-2 border-foreground bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.event_date}
          onChange={(e) => setForm({ ...form, event_date: e.target.value })}
          placeholder="YYYY-MM-DD HH:MM"
          type="datetime-local"
          className="border-2 border-foreground bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.speaker}
          onChange={(e) => setForm({ ...form, speaker: e.target.value })}
          placeholder="Speaker"
          className="border-2 border-foreground bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="border-2 border-foreground bg-acid px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-background shadow-brutal-sm"
        >
          Create event
        </button>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description"
          rows={3}
          className="border-2 border-foreground bg-background px-3 py-2 text-sm md:col-span-2"
        />
      </form>
      <div className="space-y-2">
        {(data ?? []).map((ev: any) => (
          <div
            key={ev.id}
            className="flex items-center gap-2 border-2 border-foreground bg-surface p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="font-display font-bold">{ev.title}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(ev.event_date).toLocaleString()} · {ev.speaker}
              </div>
            </div>
            <button
              onClick={() => del(ev.id)}
              className="border-2 border-foreground bg-background p-2 hover:bg-hot hover:text-background"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourcesTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", category: "", description: "", file_url: "" });
  const { data } = useQuery({
    queryKey: ["admin-resources"],
    queryFn: async () =>
      (await supabase.from("resources").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.category || !form.file_url) {
      toast.error("Title, category, file URL required");
      return;
    }
    const { error } = await supabase.from("resources").insert(form);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm({ title: "", category: "", description: "", file_url: "" });
    qc.invalidateQueries({ queryKey: ["admin-resources"] });
    qc.invalidateQueries({ queryKey: ["resources"] });
    toast.success("Resource added");
  };
  const del = async (id: string) => {
    if (!confirm("Delete resource?")) return;
    await supabase.from("resources").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-resources"] });
    qc.invalidateQueries({ queryKey: ["resources"] });
  };
  return (
    <div className="space-y-4">
      <form
        onSubmit={create}
        className="grid gap-2 border-2 border-foreground bg-surface p-4 md:grid-cols-2"
      >
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Title"
          className="border-2 border-foreground bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Category (e.g. Playbooks, AI, SOPs)"
          className="border-2 border-foreground bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.file_url}
          onChange={(e) => setForm({ ...form, file_url: e.target.value })}
          placeholder="File URL (https://…)"
          className="border-2 border-foreground bg-background px-3 py-2 text-sm md:col-span-2"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description"
          rows={3}
          className="border-2 border-foreground bg-background px-3 py-2 text-sm md:col-span-2"
        />
        <button
          type="submit"
          className="border-2 border-foreground bg-acid px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-background shadow-brutal-sm md:col-span-2"
        >
          Publish resource
        </button>
      </form>
      <div className="space-y-2">
        {(data ?? []).map((r: any) => (
          <div
            key={r.id}
            className="flex items-center gap-2 border-2 border-foreground bg-surface p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="font-display font-bold">{r.title}</div>
              <div className="font-mono text-[10px] uppercase text-muted-foreground">
                {r.category}
              </div>
              {r.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
              )}
            </div>
            <a
              href={r.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] uppercase hover:bg-electric hover:text-background"
            >
              Open
            </a>
            <button
              onClick={() => del(r.id)}
              className="border-2 border-foreground bg-background p-2 hover:bg-hot hover:text-background"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
