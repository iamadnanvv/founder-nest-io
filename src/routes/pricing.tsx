import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

/** Hosted Razorpay payment link for ₹1,599 lifetime access. */
const PAYMENT_LINK = "https://razorpay.com/payment-link/plink_TIvxE12DZ3a2us";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = RAZORPAY_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const PERKS = [
  "Lifetime access to the founder community",
  "Private feed: validation, fundraising, growth",
  "Curated resource library and templates",
  "Startup showcase with upvotes & feedback",
  "Member directory + DMs with vetted founders",
  "Early access to events and AI tools",
];

function PricingPage() {
  const navigate = useNavigate();
  const createOrder = useServerFn(createRazorpayOrder);
  const verifyPayment = useServerFn(verifyRazorpayPayment);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  /** Whether the signed-in member already has lifetime access. */
  const [isPaid, setIsPaid] = useState(false);
  /** True while re-checking access after an external (hosted link) payment. */
  const [checking, setChecking] = useState(false);

  /**
   * Reads the signed-in member's payment flag. Returns null when signed out.
   * Used on mount, on tab focus (people come back from the hosted Razorpay
   * link in another tab) and from the manual "I already paid" button.
   */
  async function readAccess(): Promise<boolean | null> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setEmail(null);
      return null;
    }
    setEmail(data.user.email ?? null);
    setName((data.user.user_metadata?.full_name as string | undefined) ?? null);
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_paid")
      .eq("id", data.user.id)
      .maybeSingle();
    const paid = !!profile?.is_paid;
    setIsPaid(paid);
    return paid;
  }

  useEffect(() => {
    loadRazorpay();
    void readAccess();
    const onFocus = () => void readAccess();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  /** Manual re-check for members who paid through the hosted link. */
  async function handleRefreshAccess() {
    setChecking(true);
    try {
      const paid = await readAccess();
      if (paid === null) {
        toast.error("Please sign in first");
        navigate({ to: "/auth" });
      } else if (paid) {
        toast.success("Access unlocked. Welcome aboard!");
        navigate({ to: "/dashboard" });
      } else {
        toast.info(
          "Payment not confirmed yet. Hosted-link payments can take a few minutes — try again shortly.",
        );
      }
    } finally {
      setChecking(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function handlePay() {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Please sign in to continue");
        navigate({ to: "/auth" });
        return;
      }

      const ok = await loadRazorpay();
      if (!ok) {
        toast.error("Failed to load checkout. Check your connection.");
        return;
      }

      const order = await createOrder();

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "FounderHuntCommunity",
        description: "Lifetime access",
        prefill: {
          email: email ?? undefined,
          name: name ?? undefined,
        },
        theme: { color: "#D4AF37" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifyPayment({ data: response });
            toast.success("Welcome aboard! Lifetime access unlocked.");
            navigate({ to: "/dashboard" });
          } catch (err) {
            console.error(err);
            toast.error("Payment verification failed. Contact support.");
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rzp.on("payment.failed", (resp: any) => {
        console.error("payment.failed", resp);
        toast.error(resp?.error?.description ?? "Payment failed");
        setLoading(false);
      });

      rzp.open();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="mb-10 text-center">
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground"
          >
            ← Back home
          </Link>
          <h1 className="mt-6 font-display text-5xl md:text-6xl">
            One payment. <span className="text-gold">Lifetime access.</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            No subscriptions. No upsells. Join the founder community for life.
          </p>
        </div>

        {email && isPaid ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
            <span>
              <strong className="text-gold">You already have lifetime access.</strong> Signed in as{" "}
              {email}.
            </span>
            <Link
              to="/dashboard"
              className="rounded-md bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-widest text-background"
            >
              Go to dashboard
            </Link>
          </div>
        ) : null}

        {email && !isPaid ? (
          <div className="mb-6 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
            <strong className="text-gold">Your account is ready.</strong> Complete the one-time
            ₹1,599 payment to unlock onboarding, the feed, founder discovery, messaging and every
            other member feature.
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Signed in as {email}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="underline hover:text-foreground"
              >
                Use another account
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-card p-10 shadow-2xl">
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-display text-6xl text-gold">₹1,599</span>
            <span className="text-sm text-muted-foreground">one-time</span>
          </div>

          <ul className="mt-8 grid gap-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>{p}</span>
              </li>
            ))}
          </ul>

          {/* In-app checkout is primary: the payment is verified server-side and
              access unlocks instantly. The hosted link is the fallback. */}
          <Button
            onClick={handlePay}
            disabled={loading}
            className="mt-10 h-12 w-full bg-gold font-medium text-background hover:bg-gold/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening checkout…
              </>
            ) : (
              "Get lifetime access — ₹1,599"
            )}
          </Button>

          <a
            href={PAYMENT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex h-11 w-full items-center justify-center rounded-md border border-border text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Pay via Razorpay payment link instead
          </a>

          <button
            type="button"
            onClick={handleRefreshAccess}
            disabled={checking}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-gold disabled:opacity-60"
          >
            {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}I already paid — refresh
            my access
          </button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Secure payments by Razorpay. UPI, cards, net banking & wallets.
          </p>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — FounderHuntCommunity" },
      {
        name: "description",
        content: "Lifetime access to FounderHuntCommunity for a single ₹1,599 payment.",
      },
    ],
  }),
});
