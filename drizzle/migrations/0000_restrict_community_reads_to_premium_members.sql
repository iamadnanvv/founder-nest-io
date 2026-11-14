DROP POLICY IF EXISTS "follows readable" ON public.follows;
CREATE POLICY "follows readable" ON public.follows FOR SELECT TO authenticated USING (auth.uid() = follower_id OR public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "discussions readable" ON public.discussions;
CREATE POLICY "discussions readable" ON public.discussions FOR SELECT TO authenticated USING (auth.uid() = author_id OR public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "likes readable" ON public.post_likes;
CREATE POLICY "likes readable" ON public.post_likes FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "posts readable by members" ON public.posts;
CREATE POLICY "posts readable by members" ON public.posts FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "collab readable" ON public.collab_posts;
CREATE POLICY "collab readable" ON public.collab_posts FOR SELECT TO authenticated USING (auth.uid() = author_id OR public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "memberships readable" ON public.community_members;
CREATE POLICY "memberships readable" ON public.community_members FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "profiles readable by all members" ON public.profiles;
CREATE POLICY "profiles readable by all members" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "replies readable" ON public.discussion_replies;
CREATE POLICY "replies readable" ON public.discussion_replies FOR SELECT TO authenticated USING (auth.uid() = author_id OR public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "upvotes readable" ON public.startup_upvotes;
CREATE POLICY "upvotes readable" ON public.startup_upvotes FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_premium_access(auth.uid()));

DROP POLICY IF EXISTS "comments readable" ON public.post_comments;
CREATE POLICY "comments readable" ON public.post_comments FOR SELECT TO authenticated USING (auth.uid() = author_id OR public.has_premium_access(auth.uid()));