DROP POLICY IF EXISTS "communities readable" ON public.communities;
CREATE POLICY "communities readable" ON public.communities FOR SELECT TO authenticated USING (auth.uid() = created_by OR public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "resources readable by members" ON public.resources;
CREATE POLICY "resources readable by members" ON public.resources FOR SELECT TO authenticated USING (public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "events readable" ON public.events;
CREATE POLICY "events readable" ON public.events FOR SELECT TO authenticated USING (public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "startups readable" ON public.startups;
CREATE POLICY "startups readable" ON public.startups FOR SELECT TO authenticated USING (auth.uid() = founder_id OR public.has_premium_access(auth.uid()));