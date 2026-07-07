import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const LAST_UPDATED = "July 2026";

export function TermsLink({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={className}>{children ?? "terms"}</button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-2 border-foreground bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-black uppercase tracking-tight">Terms of Service</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-foreground/90">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Last updated · {LAST_UPDATED}</p>
          <Section title="1. Acceptance of Terms">
            By creating an account or using founder/hunt ("the Platform"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, do not use the Platform.
          </Section>
          <Section title="2. Membership & Payment">
            founder/hunt offers a one-time lifetime membership. Payments are processed by Razorpay. Access is granted upon successful payment confirmation. All fees are non-refundable except where required by applicable law or explicitly stated at the time of purchase.
          </Section>
          <Section title="3. Acceptable Use">
            You agree not to post unlawful, misleading, harassing, or infringing content; spam or promote unrelated products; scrape, reverse-engineer, or abuse the Platform; or impersonate other founders. We may remove content and suspend accounts at our discretion.
          </Section>
          <Section title="4. User Content">
            You retain ownership of content you post. By posting, you grant founder/hunt a non-exclusive, worldwide license to display and distribute that content within the Platform. You are responsible for the accuracy and legality of what you share.
          </Section>
          <Section title="5. Community Conduct">
            Founders are expected to build in public with respect. Harassment, discrimination, doxxing, or coordinated promotion is grounds for immediate removal without refund.
          </Section>
          <Section title="6. Third-Party Services">
            The Platform integrates with services such as Razorpay (payments) and WhatsApp (community channels). Your use of those services is governed by their respective terms.
          </Section>
          <Section title="7. Disclaimers & Limitation of Liability">
            The Platform is provided "as is" without warranties of any kind. founder/hunt is not liable for indirect, incidental, or consequential damages arising from your use of the Platform, to the fullest extent permitted by law.
          </Section>
          <Section title="8. Termination">
            We may suspend or terminate accounts that violate these terms. You may request account deletion at any time by contacting support.
          </Section>
          <Section title="9. Changes to Terms">
            We may update these terms from time to time. Continued use of the Platform after changes constitutes acceptance of the revised terms.
          </Section>
          <Section title="10. Contact">
            Questions about these terms? Reach us at <a href="mailto:hello@founderhunt.community" className="text-acid underline">hello@founderhunt.community</a>.
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PrivacyLink({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={className}>{children ?? "privacy"}</button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-2 border-foreground bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-black uppercase tracking-tight">Privacy Policy</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-foreground/90">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Last updated · {LAST_UPDATED}</p>
          <Section title="1. Information We Collect">
            Account data you provide (name, email, phone, profile details), content you post (updates, discussions, messages, startup info), and payment metadata from Razorpay (order id, status, amount). We do not receive or store your card details.
          </Section>
          <Section title="2. How We Use Your Data">
            To operate the community (auth, notifications, messaging), to verify membership, to send transactional emails (receipts, access confirmations), and to improve the Platform.
          </Section>
          <Section title="3. Sharing">
            We share data with service providers strictly to run the Platform: our cloud database and auth provider, Razorpay for payments, and email delivery. We do not sell personal data to third parties.
          </Section>
          <Section title="4. Public vs Private">
            Profile information, posts, discussions, showcase entries, and collab-board posts are visible to signed-in members. Direct messages are visible only to sender and recipient.
          </Section>
          <Section title="5. Cookies & Analytics">
            We use essential cookies for authentication and session management. We may use privacy-friendly analytics to understand aggregate usage. No third-party ad trackers.
          </Section>
          <Section title="6. Data Retention">
            We retain your data while your account is active. On deletion request, we remove personal data within 30 days, retaining minimal records required by tax and payment regulations.
          </Section>
          <Section title="7. Your Rights">
            You can access, correct, export, or delete your data by editing your profile or contacting support. If you are in a region with additional rights (EU/UK/India), you can exercise those rights by writing to us.
          </Section>
          <Section title="8. Security">
            Access is protected by row-level security and encrypted in transit. No system is 100% secure — do not post information you would not share publicly.
          </Section>
          <Section title="9. Children">
            The Platform is not intended for anyone under 16. We do not knowingly collect data from children.
          </Section>
          <Section title="10. Contact">
            Privacy questions: <a href="mailto:privacy@founderhunt.community" className="text-acid underline">privacy@founderhunt.community</a>.
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LegalTriggerButtons({ className }: { className?: string }) {
  const [_, force] = useState(0);
  void force;
  return (
    <>
      <TermsLink className={className}>terms</TermsLink>
      <PrivacyLink className={className}>privacy</PrivacyLink>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">{title}</h3>
      <p className="leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
