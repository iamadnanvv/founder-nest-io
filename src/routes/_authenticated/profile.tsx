import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  generateTelegramLinkCode,
  getTelegramStatus,
  unlinkTelegram,
  updateTelegramPrefs,
} from "@/lib/telegram.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile · FounderHuntCommunity" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["my-profile-edit"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    full_name: "", bio: "", startup_name: "", startup_website: "",
    startup_stage: "", industry: "", linkedin_url: "", looking_for: "", funding_status: "",
    location: "", founder_type: "", profile_image: "", skills: "", interests: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        bio: profile.bio ?? "",
        startup_name: profile.startup_name ?? "",
        startup_website: profile.startup_website ?? "",
        startup_stage: profile.startup_stage ?? "",
        industry: profile.industry ?? "",
        linkedin_url: profile.linkedin_url ?? "",
        looking_for: profile.looking_for ?? "",
        funding_status: profile.funding_status ?? "",
        location: (profile as any).location ?? "",
        founder_type: (profile as any).founder_type ?? "",
        profile_image: profile.profile_image ?? "",
        skills: (profile.skills ?? []).join(", "),
        interests: ((profile as any).interests ?? []).join(", "),
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const toList = (v: string) => {
      const list = v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
      return list.length ? list : null;
    };
    const url = form.profile_image.trim();
    if (url && !/^https?:\/\//i.test(url)) { toast.error("Photo URL must start with http(s)://"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        ...form,
        profile_image: url || null,
        skills: toList(form.skills),
        interests: toList(form.interests),
      })
      .eq("id", u.user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["my-profile-edit"] });
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-10">
      <header>
        <h1 className="font-display text-3xl font-bold text-foreground">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Help other founders find and connect with you.</p>
      </header>

      <form onSubmit={handleSave} className="space-y-5 rounded-3xl border border-border bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Input label="LinkedIn URL" value={form.linkedin_url} onChange={(v) => setForm({ ...form, linkedin_url: v })} placeholder="https://linkedin.com/in/..." />
        </div>
        <Textarea label="Bio" value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Startup name" value={form.startup_name} onChange={(v) => setForm({ ...form, startup_name: v })} />
          <Input label="Startup website" value={form.startup_website} onChange={(v) => setForm({ ...form, startup_website: v })} placeholder="https://" />
          <Input label="Stage" value={form.startup_stage} onChange={(v) => setForm({ ...form, startup_stage: v })} placeholder="idea / mvp / launched / scaling" />
          <Input label="Industry" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
          <Input label="Funding status" value={form.funding_status} onChange={(v) => setForm({ ...form, funding_status: v })} placeholder="bootstrapped / pre-seed / seed…" />
          <Input label="Looking for" value={form.looking_for} onChange={(v) => setForm({ ...form, looking_for: v })} placeholder="co-founder / advisors / customers…" />
        </div>
        <button type="submit" className="rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-background">Save profile</button>
      </form>

      <TelegramCard />
    </div>
  );
}

function TelegramCard() {
  const qc = useQueryClient();
  const genCode = useServerFn(generateTelegramLinkCode);
  const status = useServerFn(getTelegramStatus);
  const unlink = useServerFn(unlinkTelegram);
  const savePrefs = useServerFn(updateTelegramPrefs);

  const { data } = useQuery({
    queryKey: ["telegram-status"],
    queryFn: () => status(),
  });
  const [code, setCode] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      const res = await genCode();
      setCode(res.code);
      toast.success("Code generated — valid 15 minutes");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const handleUnlink = async () => {
    await unlink();
    toast.success("Telegram unlinked");
    qc.invalidateQueries({ queryKey: ["telegram-status"] });
  };

  const togglePref = async (key: "notify_dm" | "notify_reply" | "notify_engagement" | "notify_events", value: boolean) => {
    await savePrefs({ data: { [key]: value } as any });
    qc.invalidateQueries({ queryKey: ["telegram-status"] });
  };

  const linked = data?.linked;
  const link = data?.link as any;

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-surface p-6">
      <header>
        <h2 className="font-display text-2xl font-bold text-foreground">Telegram Bot</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Get notifications, browse the feed, and post from Telegram. Open <a className="underline" href="https://t.me" target="_blank" rel="noopener noreferrer">your bot</a> and send <code className="rounded bg-background px-1">/start</code>.
        </p>
      </header>

      {!linked ? (
        <div className="space-y-3">
          <button onClick={handleGenerate} type="button" className="rounded-full bg-electric px-5 py-2 text-sm font-bold text-background">
            Generate link code
          </button>
          {code && (
            <div className="rounded-2xl border-2 border-dashed border-foreground bg-background p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Send this in Telegram:</p>
              <p className="mt-2 font-mono text-2xl font-black tracking-widest text-foreground">/link {code}</p>
              <p className="mt-2 text-xs text-muted-foreground">Expires in 15 minutes.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-background p-4 text-sm">
            ✅ Linked{link?.telegram_username ? ` as @${link.telegram_username}` : ""} · <button className="underline" onClick={handleUnlink}>Unlink</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <PrefToggle label="Direct messages" checked={!!link?.notify_dm} onChange={(v) => togglePref("notify_dm", v)} />
            <PrefToggle label="Discussion replies" checked={!!link?.notify_reply} onChange={(v) => togglePref("notify_reply", v)} />
            <PrefToggle label="Likes & upvotes" checked={!!link?.notify_engagement} onChange={(v) => togglePref("notify_engagement", v)} />
            <PrefToggle label="Event updates" checked={!!link?.notify_events} onChange={(v) => togglePref("notify_events", v)} />
          </div>
        </div>
      )}
    </section>
  );
}

function PrefToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-gold" />
    </label>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none" />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} maxLength={500} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none" />
    </label>
  );
}
