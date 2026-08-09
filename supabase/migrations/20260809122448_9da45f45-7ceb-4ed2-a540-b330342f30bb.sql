ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paid_at timestamptz;

UPDATE public.profiles SET paid_at = COALESCE(paid_at, updated_at) WHERE is_paid = true AND paid_at IS NULL;

CREATE OR REPLACE FUNCTION public.has_premium_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_paid FROM public.profiles WHERE id = _user_id), false)
      OR public.has_role(_user_id, 'admin'::public.app_role)
$$;

GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated;