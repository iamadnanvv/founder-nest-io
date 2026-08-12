-- 1) has_premium_access: keep callable by signed-in users, but only about themselves (or by admins)
CREATE OR REPLACE FUNCTION public.has_premium_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN false
    ELSE COALESCE((SELECT is_paid FROM public.profiles WHERE id = _user_id), false)
         OR public.has_role(_user_id, 'admin'::public.app_role)
  END
$function$;

REVOKE ALL ON FUNCTION public.has_premium_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated;

-- 2) community_members: explicit, non-escalating UPDATE policy
DROP POLICY IF EXISTS "admins manage member roles" ON public.community_members;
CREATE POLICY "admins manage member roles"
ON public.community_members
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_members.community_id AND c.created_by = auth.uid()
  )
)
WITH CHECK (
  role IN ('member', 'moderator', 'admin')
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_members.community_id
        AND c.created_by = auth.uid()
        AND community_members.user_id <> auth.uid()
    )
  )
);

-- 3) telegram_link_codes: owner-only AND only while unexpired
DROP POLICY IF EXISTS "own link codes" ON public.telegram_link_codes;
CREATE POLICY "own link codes readable while valid"
ON public.telegram_link_codes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND expires_at > now());

CREATE POLICY "own link codes insert"
ON public.telegram_link_codes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own link codes delete"
ON public.telegram_link_codes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
