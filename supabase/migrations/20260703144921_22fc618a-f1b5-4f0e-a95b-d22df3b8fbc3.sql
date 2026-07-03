
-- Discussion category enum
CREATE TYPE public.discussion_category AS ENUM ('validation','fundraising','growth','product','hiring','general');

-- Notification type enum
CREATE TYPE public.notification_type AS ENUM ('post_like','startup_upvote','discussion_reply','message','event_reminder','system');

-- Collab kind enum
CREATE TYPE public.collab_kind AS ENUM ('cofounder','hire','offer');

-- ============ DISCUSSIONS ============
CREATE TABLE public.discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  category public.discussion_category NOT NULL DEFAULT 'general',
  pinned boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discussions TO authenticated;
GRANT ALL ON public.discussions TO service_role;
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discussions readable" ON public.discussions FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create discussions" ON public.discussions FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author or admin update discussions" ON public.discussions FOR UPDATE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "author or admin delete discussions" ON public.discussions FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_discussions_created ON public.discussions(created_at DESC);
CREATE INDEX idx_discussions_category ON public.discussions(category);
CREATE TRIGGER discussions_updated BEFORE UPDATE ON public.discussions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DISCUSSION REPLIES ============
CREATE TABLE public.discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discussion_replies TO authenticated;
GRANT ALL ON public.discussion_replies TO service_role;
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "replies readable" ON public.discussion_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "members reply" ON public.discussion_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND NOT EXISTS (SELECT 1 FROM public.discussions d WHERE d.id = discussion_id AND d.locked = true));
CREATE POLICY "author or admin delete replies" ON public.discussion_replies FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_replies_discussion ON public.discussion_replies(discussion_id, created_at);

-- Reply count trigger
CREATE OR REPLACE FUNCTION public.bump_discussion_reply_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.discussions SET reply_count = reply_count + 1, updated_at = now() WHERE id = NEW.discussion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.discussions SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.discussion_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_bump_reply_count AFTER INSERT OR DELETE ON public.discussion_replies FOR EACH ROW EXECUTE FUNCTION public.bump_discussion_reply_count();

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.notification_type NOT NULL,
  entity_type text,
  entity_id uuid,
  message text NOT NULL,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;

-- ============ MESSAGES: add read_at ============
ALTER TABLE public.messages ADD COLUMN read_at timestamptz;
CREATE POLICY "recipient marks read" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);

-- ============ COLLAB POSTS ============
CREATE TABLE public.collab_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.collab_kind NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text,
  tags text[],
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collab_posts TO authenticated;
GRANT ALL ON public.collab_posts TO service_role;
ALTER TABLE public.collab_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collab readable" ON public.collab_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "author create collab" ON public.collab_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author or admin update collab" ON public.collab_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "author or admin delete collab" ON public.collab_posts FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_collab_created ON public.collab_posts(created_at DESC);
CREATE TRIGGER collab_updated BEFORE UPDATE ON public.collab_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NOTIFICATION TRIGGERS ============
-- New message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender_name text;
BEGIN
  IF NEW.sender_id = NEW.receiver_id THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name,'Someone') INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, actor_id, type, entity_type, entity_id, message, link)
  VALUES (NEW.receiver_id, NEW.sender_id, 'message', 'message', NEW.id,
          sender_name || ' sent you a message', '/messages/' || NEW.sender_id);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- Post like
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE post_author uuid; actor_name text;
BEGIN
  SELECT user_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NULL OR post_author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name,'Someone') INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, actor_id, type, entity_type, entity_id, message, link)
  VALUES (post_author, NEW.user_id, 'post_like', 'post', NEW.post_id,
          actor_name || ' liked your post', '/feed');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_post_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

-- Startup upvote
CREATE OR REPLACE FUNCTION public.notify_startup_upvote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE founder uuid; actor_name text; s_name text;
BEGIN
  SELECT founder_id, startup_name INTO founder, s_name FROM public.startups WHERE id = NEW.startup_id;
  IF founder IS NULL OR founder = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name,'Someone') INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, actor_id, type, entity_type, entity_id, message, link)
  VALUES (founder, NEW.user_id, 'startup_upvote', 'startup', NEW.startup_id,
          actor_name || ' upvoted ' || COALESCE(s_name,'your startup'), '/showcase');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_startup_upvote AFTER INSERT ON public.startup_upvotes FOR EACH ROW EXECUTE FUNCTION public.notify_startup_upvote();

-- Discussion reply
CREATE OR REPLACE FUNCTION public.notify_discussion_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d_author uuid; actor_name text; d_title text;
BEGIN
  SELECT author_id, title INTO d_author, d_title FROM public.discussions WHERE id = NEW.discussion_id;
  IF d_author IS NULL OR d_author = NEW.author_id THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name,'Someone') INTO actor_name FROM public.profiles WHERE id = NEW.author_id;
  INSERT INTO public.notifications (user_id, actor_id, type, entity_type, entity_id, message, link)
  VALUES (d_author, NEW.author_id, 'discussion_reply', 'discussion', NEW.discussion_id,
          actor_name || ' replied to "' || d_title || '"', '/discussions/' || NEW.discussion_id);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_discussion_reply AFTER INSERT ON public.discussion_replies FOR EACH ROW EXECUTE FUNCTION public.notify_discussion_reply();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
