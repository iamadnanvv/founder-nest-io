-- Author columns pointed at auth.users, so PostgREST had to *infer* the
-- profiles relationship through auth.users. That inference is cache-dependent
-- and intermittently failed with PGRST200 ("could not find a relationship"),
-- breaking Discussions and Opportunities. Point the author columns straight at
-- public.profiles (same constraint names, so client embed hints keep working).
-- profiles.id itself cascades from auth.users, so delete behaviour is unchanged.

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.discussions DROP CONSTRAINT IF EXISTS discussions_author_id_fkey;
ALTER TABLE public.discussions
  ADD CONSTRAINT discussions_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.discussion_replies DROP CONSTRAINT IF EXISTS discussion_replies_author_id_fkey;
ALTER TABLE public.discussion_replies
  ADD CONSTRAINT discussion_replies_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_author_id_fkey;
ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.collab_posts DROP CONSTRAINT IF EXISTS collab_posts_author_id_fkey;
ALTER TABLE public.collab_posts
  ADD CONSTRAINT collab_posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS startups_founder_id_fkey;
ALTER TABLE public.startups
  ADD CONSTRAINT startups_founder_id_fkey
  FOREIGN KEY (founder_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';