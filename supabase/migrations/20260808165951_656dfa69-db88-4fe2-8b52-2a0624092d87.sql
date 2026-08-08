-- enum extensions
ALTER TYPE public.collab_kind ADD VALUE IF NOT EXISTS 'job';
ALTER TYPE public.collab_kind ADD VALUE IF NOT EXISTS 'partnership';
ALTER TYPE public.collab_kind ADD VALUE IF NOT EXISTS 'mentorship';
ALTER TYPE public.collab_kind ADD VALUE IF NOT EXISTS 'funding';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'post_comment';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'follow';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'mention';

-- profile enrichment
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS founder_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests text[];

-- follows / connections
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows readable" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "users follow" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "users unfollow" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "users comment" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author update comment" ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author or admin delete comment" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments(post_id, created_at);

-- bookmarks
CREATE TABLE IF NOT EXISTS public.post_bookmarks (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_bookmarks TO authenticated;
GRANT ALL ON public.post_bookmarks TO service_role;
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookmarks readable" ON public.post_bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users bookmark" ON public.post_bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unbookmark" ON public.post_bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- communities
CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  topic text,
  cover_image text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "communities readable" ON public.communities FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create communities" ON public.communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "creator or admin update communities" ON public.communities FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "creator or admin delete communities" ON public.communities FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER communities_updated BEFORE UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.community_members (
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships readable" ON public.community_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "users join" ON public.community_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role = 'member');
CREATE POLICY "users leave" ON public.community_members FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS posts_community_idx ON public.posts(community_id, created_at DESC);

-- reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporter or admin read reports" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "members report" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "admins resolve reports" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete reports" ON public.reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- notification triggers
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE post_author uuid; actor_name text;
BEGIN
  SELECT user_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NULL OR post_author = NEW.author_id THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name,'Someone') INTO actor_name FROM public.profiles WHERE id = NEW.author_id;
  INSERT INTO public.notifications (user_id, actor_id, type, entity_type, entity_id, message, link)
  VALUES (post_author, NEW.author_id, 'post_comment', 'post', NEW.post_id,
          actor_name || ' commented on your post', '/feed');
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_post_comment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_post_comment AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

CREATE OR REPLACE FUNCTION public.notify_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE actor_name text;
BEGIN
  SELECT COALESCE(full_name,'Someone') INTO actor_name FROM public.profiles WHERE id = NEW.follower_id;
  INSERT INTO public.notifications (user_id, actor_id, type, entity_type, entity_id, message, link)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'profile', NEW.follower_id,
          actor_name || ' started following you', '/members');
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_follow() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.notify_follow();

-- starter communities
INSERT INTO public.communities (slug, name, description, topic) VALUES
  ('saas', 'SaaS Builders', 'Pricing, churn, onboarding and everything B2B SaaS.', 'SaaS'),
  ('ai', 'AI Founders', 'Building with LLMs, agents and AI-native products.', 'AI'),
  ('indie-hackers', 'Indie Hackers', 'Bootstrapped, solo and small-team products.', 'Bootstrapping'),
  ('fundraising', 'Fundraising', 'Angels, micro-VCs, decks and term sheets.', 'Fundraising'),
  ('growth', 'Growth & GTM', 'Distribution, content, SEO, outbound and paid.', 'Growth')
ON CONFLICT (slug) DO NOTHING;