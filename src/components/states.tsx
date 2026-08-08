/**
 * Shared UX state primitives — used across every major page so loading,
 * empty and error states look and behave consistently.
 */
import type { ReactNode } from "react";
import { Loader2, AlertTriangle, Inbox } from "lucide-react";

export function LoadingState({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> {label}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-surface/60" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center">
      <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-gold-soft text-gold">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
      <AlertTriangle className="mx-auto mb-2 size-5 text-destructive" />
      <p className="text-sm text-foreground">{message ?? "Something went wrong."}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-surface"
        >
          Try again
        </button>
      )}
    </div>
  );
}
