
-- Enable pg_net for background HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- telegram_links: connects a FounderLink user to a Telegram chat
-- ============================================================================
CREATE TABLE public.telegram_links (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  telegram_first_name TEXT,
  notify_dm BOOLEAN NOT NULL DEFAULT TRUE,
  notify_reply BOOLEAN NOT NULL DEFAULT TRUE,
  notify_engagement BOOLEAN NOT NULL DEFAULT TRUE,
  notify_events BOOLEAN NOT NULL DEFAULT TRUE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_links TO authenticated;
GRANT ALL ON public.telegram_links TO service_role;

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own telegram link select"
  ON public.telegram_links FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "own telegram link modify"
  ON public.telegram_links FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_telegram_links_updated_at
  BEFORE UPDATE ON public.telegram_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- telegram_link_codes: one-time codes for linking accounts
-- ============================================================================
CREATE TABLE public.telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_link_codes_user ON public.telegram_link_codes(user_id);
CREATE INDEX idx_telegram_link_codes_expires ON public.telegram_link_codes(expires_at);

GRANT SELECT, INSERT, DELETE ON public.telegram_link_codes TO authenticated;
GRANT ALL ON public.telegram_link_codes TO service_role;

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own link codes"
  ON public.telegram_link_codes FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Notification → Telegram forwarder
-- Fires after a notification is inserted; if the recipient has linked Telegram
-- and hasn't muted that category, POST to our /api/public/telegram/notify route.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.forward_notification_to_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  link RECORD;
  webhook_url TEXT := 'https://founder-nest-io.lovable.app/api/public/telegram/notify';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13endydXhrZnd4aHZ6bXJvenVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNDY1MzEsImV4cCI6MjA5NzYyMjUzMX0.GIPpBnghO4K0XaAOAO7DA4M2-27hGcdFv4pjMwTOFjw';
  should_send BOOLEAN := FALSE;
BEGIN
  SELECT * INTO link FROM public.telegram_links WHERE user_id = NEW.user_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  should_send := CASE NEW.type
    WHEN 'message' THEN link.notify_dm
    WHEN 'discussion_reply' THEN link.notify_reply
    WHEN 'post_like' THEN link.notify_engagement
    WHEN 'startup_upvote' THEN link.notify_engagement
    WHEN 'event_reminder' THEN link.notify_events
    WHEN 'new_event' THEN link.notify_events
    ELSE TRUE
  END;

  IF NOT should_send THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := webhook_url,
    headers := jsonb_build_object('Content-Type','application/json','apikey', anon_key),
    body := jsonb_build_object(
      'chat_id', link.chat_id,
      'type', NEW.type,
      'message', NEW.message,
      'link', NEW.link
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_notification_forward_telegram
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.forward_notification_to_telegram();
