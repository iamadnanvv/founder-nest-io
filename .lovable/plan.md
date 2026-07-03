
## Current state

Already functional (real DB, RLS, UI): Founder Profiles, Community Feed (posts + likes), Startup Showcase (with upvotes), Events (list + register), Members directory (basic), Resources.

Gaps to close: Discussions, Direct Messaging UI, Notifications, Admin Dashboard, richer Founder Discovery filters, and replacing the Marketplace "coming soon".

## Scope of this build

### 1. Discussions (new)
- New tables: `discussions` (title, body, category, author_id, pinned, locked, view_count) and `discussion_replies` (threaded — parent_reply_id nullable for 1-level nesting).
- Categories: Validation, Fundraising, Growth, Product, Hiring, General.
- Routes: `/discussions` (list + filter + new thread), `/discussions/$id` (thread + replies + reply composer).
- Upvote replies via reuse of a `discussion_reply_votes` table.
- RLS: all authenticated members can read/create; only author or admin can edit/delete; only admin can pin/lock.

### 2. Direct Messaging (UI on existing `messages` table)
- Extend `messages` schema if needed: add `read_at`. Verify RLS scopes to sender/recipient.
- Route `/messages` — split view: conversation list (left) + active thread (right, or mobile-full).
- Route `/messages/$userId` — starts/opens a 1:1 thread.
- Realtime subscription on `messages` filtered by recipient=me OR sender=me.
- "Message" button on member cards and profiles.

### 3. Notifications (new)
- New table `notifications` (user_id, type, actor_id, entity_type, entity_id, message, read_at).
- Trigger-based inserts:
  - New reply on your discussion / post
  - New like on your post
  - New upvote on your startup
  - New DM
  - Event you registered for is <24h away (handled at event registration read-time; no cron)
- Bell icon in header with unread badge, realtime subscription, dropdown list, mark-as-read.
- Route `/notifications` for full history.

### 4. Admin Dashboard (new)
- Route `/admin` gated by `has_role(auth.uid(),'admin')` — redirect non-admins.
- Tabs: Users (list, promote to admin, ban toggle), Posts (moderate/delete), Discussions (pin/lock/delete), Startups (feature toggle), Payments (recent list + totals), Events (create/edit/delete).
- Server functions with `requireSupabaseAuth` + explicit admin check before every mutation.

### 5. Founder Discovery (upgrade existing Members)
- Add filters: role/stage, location, skills (multi-select), text search across name+bio.
- Add "Connect / Message" CTAs.
- Sort by recently active, most upvoted startup.

### 6. Marketplace → Collab Board (replace "coming soon")
- New table `collab_posts` (author_id, kind [cofounder|hire|offer], title, description, category, tags, status).
- Route `/marketplace`: list + filters + create-post modal + contact-via-DM button.

### 7. Header / Sidebar wiring
- Add nav entries: Discussions, Messages, Notifications bell, Admin (if role=admin).
- Remove any remaining "coming soon" copy.

## Technical notes

- All new tables: `GRANT` block + RLS + policies + `updated_at` trigger where relevant.
- Realtime: enable publication on `messages` and `notifications`.
- Notifications inserted via `AFTER INSERT` triggers on `post_likes`, `startup_upvotes`, `messages`, `discussion_replies`.
- Reuse existing brutalist tokens (`shadow-brutal`, acid/hot/electric, mono display) — no new design primitives.
- All server writes through `createServerFn` + `requireSupabaseAuth`; admin actions verify `has_role` before touching `supabaseAdmin`.
- No changes to Razorpay flow or auth routes.

## Out of scope

- Email digests for notifications (email infra pending domain setup from prior turn).
- Group DMs / attachments (1:1 text only).
- Rich-text editor (markdown-lite: line breaks + links only).
- Push notifications / mobile app.

## Build order

1. Migrations (all new tables, triggers, realtime publication, RLS) — one migration.
2. Server functions for discussions, messages, notifications, admin, collab.
3. Route files + UI, wired into sidebar + header bell.
4. Typecheck + smoke via Playwright against `/`, `/auth`, `/discussions`, `/messages`, `/notifications`, `/admin`.
