
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_post_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_startup_upvote() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_discussion_reply() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_discussion_reply_count() FROM PUBLIC, anon, authenticated;
