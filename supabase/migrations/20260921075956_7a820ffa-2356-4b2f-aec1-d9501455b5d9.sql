-- Regression fix: EXECUTE on has_role had been revoked from `authenticated`,
-- but nearly every RLS policy calls it as the *calling* role. Result:
-- "permission denied for function has_role" on inserts (e.g. discussion replies).
-- has_role only reports whether a role row exists and is SECURITY DEFINER with a
-- pinned search_path, so granting EXECUTE to signed-in users is safe and required.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

NOTIFY pgrst, 'reload schema';